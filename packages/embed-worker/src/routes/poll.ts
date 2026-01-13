import { Context } from 'hono';
import { errorResponse, jsonResponse } from '../lib/utils.js';
import { ERROR_CODES } from '@newsroom-polling/shared';

/**
 * GET /api/poll/:pollId
 * Retrieves poll data including question, answers, and current vote counts
 * from the poll's Durable Object.
 */
export async function handleGetPoll(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  // Get Durable Object stub for this poll
  const doId = c.env.POLL_COUNTER.idFromName(pollId);
  const stub = c.env.POLL_COUNTER.get(doId);

  // Get poll data from Durable Object
  const doResponse = await stub.fetch(new Request('http://internal/get'));

  if (!doResponse.ok) {
    if (doResponse.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    return errorResponse('Failed to get poll', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  const poll = await doResponse.json();

  // Only return published or closed polls to public
  if ((poll as any).status === 'draft') {
    return errorResponse('Poll not published', 403, ERROR_CODES.POLL_NOT_PUBLISHED);
  }

  // Transform to match expected API format
  const response = {
    id: (poll as any).id,
    question: (poll as any).question,
    status: (poll as any).status,
    created_at: (poll as any).created_at,
    updated_at: (poll as any).updated_at,
    published_at: (poll as any).published_at,
    closed_at: (poll as any).closed_at,
    reset_count: (poll as any).reset_count || 0,
    totalVotes: (poll as any).totalVotes,
    answers: (poll as any).answers.map((a: any) => ({
      id: a.answer_id,
      text: a.answer_text,
      order: a.display_order,
      votes: a.votes,
      percentage: a.percentage,
    })),
  };

  return jsonResponse(response);
}
