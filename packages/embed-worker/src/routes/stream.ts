import { Context } from 'hono';

/**
 * GET /api/poll/:pollId/stream
 * Server-Sent Events stream for real-time vote updates.
 * Connects directly to the Durable Object's SSE endpoint.
 */
export async function handleStream(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  // Get Durable Object stub for this poll
  const doId = c.env.POLL_COUNTER.idFromName(pollId);
  const stub = c.env.POLL_COUNTER.get(doId);

  // Connect to the DO's SSE stream
  const response = await stub.fetch(new Request('http://internal/stream'));

  // If DO returned an error, pass it through with fresh headers
  if (!response.ok) {
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
  }

  // Return a new Response with fresh mutable headers (required for Hono CORS middleware)
  return new Response(response.body, {
    status: 200,
    headers: new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }),
  });
}
