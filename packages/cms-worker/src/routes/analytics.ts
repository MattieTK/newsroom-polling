import { Context } from 'hono';
import { errorResponse, jsonResponse } from '../lib/utils.js';
import { validateQuery } from '../lib/validation.js';
import {
  ERROR_CODES,
  analyticsQuerySchema,
  PollAnalytics,
  AnswerAnalytics,
  VoteOverTime,
} from '@newsroom-polling/shared';

/**
 * GET /api/polls/:pollId/analytics
 * Retrieves detailed analytics and voting trends for a poll
 */
export async function handleGetAnalytics(c: Context): Promise<Response> {
  const pollId = c.req.param('pollId');

  const queryParams = Object.fromEntries(new URL(c.req.url).searchParams);
  const validation = validateQuery(queryParams, analyticsQuerySchema);

  if (!validation.success) {
    return validation.response;
  }

  const { interval } = validation.data;

  // Get poll data
  const poll = await c.env.DB
    .prepare('SELECT * FROM polls WHERE id = ?')
    .bind(pollId)
    .first();

  if (!poll) {
    return errorResponse('Poll not found', 404, ERROR_CODES.POLL_NOT_FOUND);
  }

  // Get answers with vote counts
  const answersResult = await c.env.DB
    .prepare(`
      SELECT
        a.id,
        a.answer_text,
        a.display_order,
        COUNT(v.id) as vote_count
      FROM answers a
      LEFT JOIN votes v ON v.answer_id = a.id
      WHERE a.poll_id = ?
      GROUP BY a.id
      ORDER BY a.display_order
    `)
    .bind(pollId)
    .all();

  const totalVotes = answersResult.results.reduce(
    (sum: number, answer: any) => sum + Number(answer.vote_count),
    0
  );

  // Calculate time bucket based on interval
  let timeFormat: string;
  let bucketSize: number; // in milliseconds

  switch (interval) {
    case 'hour':
      timeFormat = '%Y-%m-%d %H:00:00';
      bucketSize = 3600000; // 1 hour
      break;
    case 'day':
      timeFormat = '%Y-%m-%d 00:00:00';
      bucketSize = 86400000; // 1 day
      break;
    case 'week':
      timeFormat = '%Y-%W';
      bucketSize = 604800000; // 1 week
      break;
    default:
      timeFormat = '%Y-%m-%d %H:00:00';
      bucketSize = 3600000;
  }

  // Get votes over time for each answer
  const answersWithTrends: AnswerAnalytics[] = await Promise.all(
    answersResult.results.map(async (answer: any) => {
      const votesOverTimeResult = await c.env.DB
        .prepare(`
          SELECT
            strftime('${timeFormat}', datetime(voted_at / 1000, 'unixepoch')) as time_bucket,
            COUNT(*) as count
          FROM votes
          WHERE answer_id = ?
          GROUP BY time_bucket
          ORDER BY time_bucket ASC
        `)
        .bind(answer.id)
        .all();

      const votesOverTime: VoteOverTime[] = votesOverTimeResult.results.map((row: any) => {
        // Convert time_bucket back to timestamp
        const date = new Date(row.time_bucket);
        return {
          timestamp: date.getTime(),
          count: Number(row.count),
        };
      });

      return {
        id: answer.id,
        text: answer.answer_text,
        votes: Number(answer.vote_count),
        percentage: totalVotes > 0 ? (Number(answer.vote_count) / totalVotes) * 100 : 0,
        votesOverTime,
      };
    })
  );

  // Calculate voting rate metrics
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const oneDayAgo = now - 86400000;

  const lastHourVotes = await c.env.DB
    .prepare('SELECT COUNT(*) as count FROM votes WHERE poll_id = ? AND voted_at >= ?')
    .bind(pollId, oneHourAgo)
    .first();

  const last24HoursVotes = await c.env.DB
    .prepare('SELECT COUNT(*) as count FROM votes WHERE poll_id = ? AND voted_at >= ?')
    .bind(pollId, oneDayAgo)
    .first();

  // Find peak hour
  const peakHourResult = await c.env.DB
    .prepare(`
      SELECT
        strftime('%Y-%m-%d %H:00:00', datetime(voted_at / 1000, 'unixepoch')) as hour,
        COUNT(*) as count
      FROM votes
      WHERE poll_id = ?
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 1
    `)
    .bind(pollId)
    .first();

  const peakHour = peakHourResult
    ? {
        timestamp: new Date(peakHourResult.hour as string).getTime(),
        votes: Number(peakHourResult.count),
      }
    : { timestamp: now, votes: 0 };

  const response: PollAnalytics = {
    pollId: poll.id as string,
    question: poll.question as string,
    status: poll.status as any,
    totalVotes,
    answers: answersWithTrends,
    votingRate: {
      lastHour: Number(lastHourVotes?.count || 0),
      last24Hours: Number(last24HoursVotes?.count || 0),
      peakHour,
    },
    publishedAt: poll.published_at ? Number(poll.published_at) : null,
    closedAt: poll.closed_at ? Number(poll.closed_at) : null,
  };

  return jsonResponse(response);
}
