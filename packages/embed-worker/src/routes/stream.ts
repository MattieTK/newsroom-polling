import { Context } from 'hono';
import { errorResponse } from '../lib/utils.js';
import { ERROR_CODES } from '@newsroom-polling/shared';

/**
 * GET /api/poll/:pollId/stream
 * Server-Sent Events stream for real-time vote updates.
 * Proxies to the poll's Durable Object.
 */
export async function handleStream(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  // Get Durable Object stub for this poll
  const doId = c.env.POLL_COUNTER.idFromName(pollId);
  const stub = c.env.POLL_COUNTER.get(doId);

  // First check if poll exists and is published
  const checkResponse = await stub.fetch(new Request('http://internal/get'));
  
  if (!checkResponse.ok) {
    if (checkResponse.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    return errorResponse('Failed to get poll', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  const poll = await checkResponse.json();
  
  if ((poll as any).status === 'draft') {
    return errorResponse('Poll not published', 403, ERROR_CODES.POLL_NOT_PUBLISHED);
  }

  // Proxy SSE connection to Durable Object
  return stub.fetch(
    new Request('http://internal/stream', {
      headers: c.req.raw.headers,
      signal: c.req.raw.signal,
    })
  );
}
