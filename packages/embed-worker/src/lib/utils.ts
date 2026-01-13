import { ErrorResponse, ERROR_CODES } from '@newsroom-polling/shared';

/**
 * Create a JSON error response
 */
export function errorResponse(
  error: string,
  status: number,
  code?: string
): Response {
  const body: ErrorResponse = { error, code };
  return Response.json(body, {
    status,
    headers: corsHeaders(),
  });
}

/**
 * Create a JSON success response with CORS headers
 */
export function jsonResponse(data: any, status: number = 200): Response {
  return Response.json(data, {
    status,
    headers: corsHeaders(),
  });
}

/**
 * Get CORS headers for public embed worker
 */
export function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
