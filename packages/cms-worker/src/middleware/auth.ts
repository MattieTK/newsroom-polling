import { Context, Next } from 'hono';

/**
 * Cloudflare Access JWT validation middleware
 * 
 * When Cloudflare Access is configured, it adds a JWT token in the
 * `CF-Access-JWT-Assertion` header. This middleware validates that token.
 * 
 * To configure:
 * 1. Create an Access Application in Cloudflare Zero Trust dashboard
 * 2. Set the Application Audience (AUD) tag
 * 3. Add CF_ACCESS_AUD and CF_ACCESS_TEAM environment variables to wrangler.toml
 * 
 * @see https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

interface AccessJWTPayload {
  aud: string[];
  email: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  type: string;
  identity_nonce?: string;
  country?: string;
}

interface JWKSKey {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  e: string;
  n: string;
}

interface JWKS {
  keys: JWKSKey[];
}

// Cache for JWKS keys (in-memory, per worker instance)
let jwksCache: { keys: Map<string, CryptoKey>; expiresAt: number } | null = null;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetches and caches the JWKS keys from Cloudflare Access
 */
async function getJWKS(teamDomain: string): Promise<Map<string, CryptoKey>> {
  const now = Date.now();
  
  if (jwksCache && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }
  
  const jwksUrl = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const response = await fetch(jwksUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }
  
  const jwks: JWKS = await response.json();
  const keys = new Map<string, CryptoKey>();
  
  for (const key of jwks.keys) {
    if (key.kty === 'RSA' && key.alg === 'RS256') {
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        {
          kty: key.kty,
          e: key.e,
          n: key.n,
          alg: key.alg,
          use: key.use,
        },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      keys.set(key.kid, cryptoKey);
    }
  }
  
  jwksCache = { keys, expiresAt: now + JWKS_CACHE_TTL };
  return keys;
}

/**
 * Base64URL decode (JWT uses base64url encoding)
 */
function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  const padded = str + '==='.slice(0, (4 - (str.length % 4)) % 4);
  // Convert base64url to base64
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  // Decode
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Validates a Cloudflare Access JWT token
 */
async function validateAccessJWT(
  token: string,
  expectedAud: string,
  teamDomain: string
): Promise<AccessJWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }
    
    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Decode header to get kid
    const headerJson = new TextDecoder().decode(base64UrlDecode(headerB64));
    const header = JSON.parse(headerJson);
    
    if (!header.kid) {
      console.error('JWT missing kid');
      return null;
    }
    
    // Get public keys
    const keys = await getJWKS(teamDomain);
    const publicKey = keys.get(header.kid);
    
    if (!publicKey) {
      console.error('Unknown key id:', header.kid);
      return null;
    }
    
    // Verify signature
    const signatureData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);
    
    const valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      publicKey,
      signature,
      signatureData
    );
    
    if (!valid) {
      console.error('Invalid JWT signature');
      return null;
    }
    
    // Decode and validate payload
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload: AccessJWTPayload = JSON.parse(payloadJson);
    
    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('JWT expired');
      return null;
    }
    
    // Verify audience
    if (!payload.aud.includes(expectedAud)) {
      console.error('Invalid JWT audience');
      return null;
    }
    
    return payload;
  } catch (err) {
    console.error('JWT validation error:', err);
    return null;
  }
}

/**
 * Middleware that requires Cloudflare Access authentication
 * 
 * Sets `c.get('userEmail')` on successful authentication.
 * 
 * If CF_ACCESS_AUD is not set, authentication is bypassed (for local development).
 */
export async function requireAuth(c: Context, next: Next) {
  const accessAud = c.env.CF_ACCESS_AUD;
  const accessTeam = c.env.CF_ACCESS_TEAM;
  
  // If not configured, skip auth (local development)
  if (!accessAud || !accessTeam) {
    console.warn('Cloudflare Access not configured - skipping authentication');
    c.set('userEmail', 'dev@localhost');
    return next();
  }
  
  // Get JWT from header or cookie
  const jwt = c.req.header('CF-Access-JWT-Assertion') || 
              getCookie(c.req.header('Cookie') || '', 'CF_Authorization');
  
  if (!jwt) {
    return c.json({ 
      error: 'Unauthorized', 
      message: 'Missing authentication token' 
    }, 401);
  }
  
  const payload = await validateAccessJWT(jwt, accessAud, accessTeam);
  
  if (!payload) {
    return c.json({ 
      error: 'Unauthorized', 
      message: 'Invalid authentication token' 
    }, 401);
  }
  
  // Set user email for downstream handlers
  c.set('userEmail', payload.email);
  
  return next();
}

/**
 * Helper to extract a cookie value
 */
function getCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? match[2] : null;
}

/**
 * Optional: Get the current user's email (after auth middleware)
 */
export function getUserEmail(c: Context): string | null {
  return c.get('userEmail') || null;
}
