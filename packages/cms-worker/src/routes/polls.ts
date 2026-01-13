import { Context } from 'hono';
import { errorResponse, jsonResponse } from '../lib/utils.js';
import { validateBody, validateQuery } from '../lib/validation.js';
import {
  ERROR_CODES,
  createPollSchema,
  updatePollSchema,
  pollListQuerySchema,
} from '@newsroom-polling/shared';

/**
 * Helper to call a Durable Object
 */
async function callDO(c: Context, pollId: string, path: string, method = 'GET', body?: any): Promise<Response> {
  const doId = c.env.POLL_COUNTER.idFromName(pollId);
  const stub = c.env.POLL_COUNTER.get(doId);
  
  const init: RequestInit = { method };
  if (body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  
  return stub.fetch(new Request(`http://internal${path}`, init));
}

/**
 * In-memory poll index for listing
 * In production, you might use KV or a separate index DO
 * For now, we store poll IDs in a simple KV-like structure
 */
const POLL_INDEX_KEY = 'poll-index';

async function getPollIndex(c: Context): Promise<string[]> {
  // Use a dedicated DO for the index
  const indexId = c.env.POLL_COUNTER.idFromName(POLL_INDEX_KEY);
  const stub = c.env.POLL_COUNTER.get(indexId);
  
  try {
    const response = await stub.fetch(new Request('http://internal/get-index'));
    if (response.ok) {
      const data = await response.json();
      return (data as any).pollIds || [];
    }
  } catch {
    // Index doesn't exist yet
  }
  return [];
}

async function addToPollIndex(c: Context, pollId: string): Promise<void> {
  const indexId = c.env.POLL_COUNTER.idFromName(POLL_INDEX_KEY);
  const stub = c.env.POLL_COUNTER.get(indexId);
  
  await stub.fetch(new Request('http://internal/add-to-index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pollId }),
  }));
}

async function removeFromPollIndex(c: Context, pollId: string): Promise<void> {
  const indexId = c.env.POLL_COUNTER.idFromName(POLL_INDEX_KEY);
  const stub = c.env.POLL_COUNTER.get(indexId);
  
  await stub.fetch(new Request('http://internal/remove-from-index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pollId }),
  }));
}

/**
 * GET /api/polls
 * Lists all polls with optional filtering
 */
export async function handleListPolls(c: Context): Promise<Response> {
  const queryParams = Object.fromEntries(new URL(c.req.url).searchParams);
  const validation = validateQuery(queryParams, pollListQuerySchema);

  if (!validation.success) {
    return validation.response;
  }

  const { status, limit, offset } = validation.data;

  // Get poll index
  const pollIds = await getPollIndex(c);
  
  // Fetch each poll from its DO
  const pollPromises = pollIds.map(async (pollId) => {
    try {
      const response = await callDO(c, pollId, '/get');
      if (response.ok) {
        return response.json();
      }
    } catch {
      // Poll DO might not exist
    }
    return null;
  });

  const allPolls = (await Promise.all(pollPromises)).filter(Boolean) as any[];
  
  // Filter by status if specified
  let filteredPolls = status 
    ? allPolls.filter(p => p.status === status)
    : allPolls;
  
  // Sort by created_at descending
  filteredPolls.sort((a, b) => b.created_at - a.created_at);
  
  // Paginate
  const paginatedPolls = filteredPolls.slice(offset ?? 0, (offset ?? 0) + (limit ?? 50));
  
  // Transform to summary format
  const polls = paginatedPolls.map(p => ({
    id: p.id,
    question: p.question,
    status: p.status,
    totalVotes: p.totalVotes,
    createdAt: p.created_at,
    publishedAt: p.published_at,
    closedAt: p.closed_at,
  }));

  return jsonResponse({
    polls,
    total: filteredPolls.length,
    limit,
    offset,
  });
}

/**
 * POST /api/polls
 * Creates a new poll in draft status
 */
export async function handleCreatePoll(c: Context): Promise<Response> {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return errorResponse('Invalid JSON', 400, ERROR_CODES.VALIDATION_ERROR);
  }
  
  const validation = validateBody(body, createPollSchema);

  if (!validation.success) {
    return validation.response;
  }

  const { question, answers } = validation.data;
  const pollId = crypto.randomUUID();

  // Create poll in its dedicated DO
  const response = await callDO(c, pollId, '/create', 'POST', {
    id: pollId,
    question,
    answers,
  });

  if (!response.ok) {
    const error = await response.json();
    return errorResponse(
      (error as any).error || 'Failed to create poll',
      response.status,
      ERROR_CODES.INTERNAL_ERROR
    );
  }

  // Add to poll index
  await addToPollIndex(c, pollId);

  // Fetch the created poll
  const pollResponse = await callDO(c, pollId, '/get');
  const poll = await pollResponse.json();

  return jsonResponse(transformPollResponse(poll as any), 201);
}

/**
 * GET /api/polls/:pollId
 * Retrieves detailed information about a specific poll
 */
export async function handleGetPoll(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  const response = await callDO(c, pollId, '/get');

  if (!response.ok) {
    if (response.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    return errorResponse('Failed to get poll', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  const poll = await response.json();
  return jsonResponse(transformPollResponse(poll as any));
}

/**
 * PUT /api/polls/:pollId
 * Updates a poll's question and answers (draft only)
 */
export async function handleUpdatePoll(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  let body;
  try {
    body = await c.req.json();
  } catch {
    return errorResponse('Invalid JSON', 400, ERROR_CODES.VALIDATION_ERROR);
  }

  const validation = validateBody(body, updatePollSchema);

  if (!validation.success) {
    return validation.response;
  }

  const { question, answers } = validation.data;

  const response = await callDO(c, pollId, '/update', 'POST', { question, answers });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    if ((error as any).error === 'Can only update draft polls') {
      return errorResponse('Cannot modify published poll', 403, ERROR_CODES.POLL_IMMUTABLE);
    }
    return errorResponse('Failed to update poll', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  const poll = await response.json();
  return jsonResponse(transformPollResponse(poll as any));
}

/**
 * DELETE /api/polls/:pollId
 * Deletes a poll
 */
export async function handleDeletePoll(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  const response = await callDO(c, pollId, '/delete', 'POST');

  if (!response.ok) {
    if (response.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    return errorResponse('Failed to delete poll', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  // Remove from index
  await removeFromPollIndex(c, pollId);

  return jsonResponse({
    success: true,
    message: 'Poll deleted successfully',
  });
}

/**
 * POST /api/polls/:pollId/publish
 * Publishes a draft poll
 */
export async function handlePublishPoll(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  const response = await callDO(c, pollId, '/publish', 'POST');

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    if ((error as any).error === 'Poll is not in draft status') {
      return errorResponse('Poll is not in draft status', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    return errorResponse('Failed to publish poll', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  const poll = await response.json();
  return jsonResponse(transformPollResponse(poll as any));
}

/**
 * POST /api/polls/:pollId/close
 * Closes a published poll
 */
export async function handleClosePoll(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  const response = await callDO(c, pollId, '/close', 'POST');

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    if ((error as any).error === 'Poll is not published') {
      return errorResponse('Poll is not published', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    return errorResponse('Failed to close poll', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  const poll = await response.json();
  return jsonResponse(transformPollResponse(poll as any));
}

/**
 * POST /api/polls/:pollId/reset
 * Resets a poll by removing all votes (keeps poll and answers)
 */
export async function handleResetPoll(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  const response = await callDO(c, pollId, '/reset', 'POST');

  if (!response.ok) {
    if (response.status === 404) {
      return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
    }
    return errorResponse('Failed to reset poll', 500, ERROR_CODES.INTERNAL_ERROR);
  }

  const poll = await response.json();
  return jsonResponse(transformPollResponse(poll as any));
}

/**
 * Transform DO response to API format
 */
function transformPollResponse(poll: any) {
  return {
    id: poll.id,
    question: poll.question,
    status: poll.status,
    created_at: poll.created_at,
    updated_at: poll.updated_at,
    published_at: poll.published_at,
    closed_at: poll.closed_at,
    totalVotes: poll.totalVotes,
    answers: poll.answers?.map((a: any) => ({
      id: a.answer_id,
      text: a.answer_text,
      order: a.display_order,
      votes: a.votes,
      percentage: a.percentage,
    })) || [],
  };
}
