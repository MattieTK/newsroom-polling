import { ErrorResponse } from '@newsroom-polling/shared';

/**
 * Create a JSON error response
 */
export function errorResponse(
  error: string,
  status: number,
  code?: string,
  details?: any
): Response {
  const body: ErrorResponse = { error, code, details };
  return Response.json(body, { status });
}

/**
 * Create a JSON success response
 */
export function jsonResponse(data: any, status: number = 200): Response {
  return Response.json(data, { status });
}
