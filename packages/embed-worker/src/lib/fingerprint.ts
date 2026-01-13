/**
 * Generate a voter fingerprint based on IP address and User-Agent
 * This creates a SHA-256 hash for privacy-preserving vote deduplication
 */
export async function generateFingerprint(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';

  const data = `${ip}:${userAgent}`;
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(data)
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
