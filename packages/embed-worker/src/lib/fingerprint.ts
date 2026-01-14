/**
 * Generate a voter fingerprint based on IP address and client ID
 * The clientId is a UUID generated in the browser and stored in localStorage
 * This creates a SHA-256 hash for privacy-preserving vote deduplication
 */
export async function generateFingerprint(request: Request, clientId: string): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  const data = `${ip}:${clientId}`;
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(data)
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
