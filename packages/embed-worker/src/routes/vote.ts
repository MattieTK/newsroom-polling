import { Context } from 'hono';
import { errorResponse, jsonResponse } from '../lib/utils.js';
import { ERROR_CODES, voteRequestSchema } from '@newsroom-polling/shared';
import { generateFingerprint } from '../lib/fingerprint.js';

/**
 * POST /api/poll/:pollId/vote
 * Submits a vote for a specific answer in a poll
 * 
 * All data is stored in the poll's Durable Object (SQLite storage).
 * No D1 database is used.
 */
export async function handleVote(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  // Parse and validate request body
  let body;
  try {
    body = await c.req.json();
  } catch {
    return errorResponse('Invalid JSON', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  
  const validation = voteRequestSchema.safeParse(body);

  if (!validation.success) {
    return errorResponse(
      'Invalid request body',
      400,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const { answerId, clientId } = validation.data;

  // Generate fingerprint server-side from IP + client ID
  const voterFingerprint = await generateFingerprint(c.req.raw, clientId);

  // Get Durable Object stub for this poll
  const doId = c.env.POLL_COUNTER.idFromName(pollId);
  const stub = c.env.POLL_COUNTER.get(doId);

  // Submit vote to Durable Object
  const doResponse = await stub.fetch(
    new Request('http://internal/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answerId, voterFingerprint }),
    })
  );

  // Handle DO response
  if (!doResponse.ok) {
    const error = (await doResponse.json()) as { error: string };
    
    if (doResponse.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    if (doResponse.status === 409) {
      return errorResponse('Already voted', 409, ERROR_CODES.DUPLICATE_VOTE);
    }
    if (error.error === 'Poll not published') {
      return errorResponse('Poll not published', 403, ERROR_CODES.POLL_NOT_PUBLISHED);
    }
    if (error.error === 'Poll is closed') {
      return errorResponse('Poll is closed', 403, ERROR_CODES.POLL_CLOSED);
    }
    if (error.error === 'Invalid answer') {
      return errorResponse('Invalid answer ID', 400, ERROR_CODES.INVALID_ANSWER);
    }
    
    return errorResponse('Failed to record vote', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  const result = (await doResponse.json()) as { totalVotes: number; answers: any[] };

  return jsonResponse({
    success: true,
    totalVotes: result.totalVotes,
    answers: result.answers,
  });
}
