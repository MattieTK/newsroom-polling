import { z } from 'zod';
import { POLL_CONSTRAINTS, POLL_STATUS } from './constants.js';

// Poll Status Schema
export const pollStatusSchema = z.enum([
  POLL_STATUS.DRAFT,
  POLL_STATUS.PUBLISHED,
  POLL_STATUS.CLOSED,
]);

// Create Poll Request Schema
export const createPollSchema = z.object({
  question: z.string()
    .min(POLL_CONSTRAINTS.QUESTION_MIN_LENGTH, 'Question is required')
    .max(POLL_CONSTRAINTS.QUESTION_MAX_LENGTH, `Question must be ${POLL_CONSTRAINTS.QUESTION_MAX_LENGTH} characters or less`),
  answers: z.array(
    z.string()
      .min(POLL_CONSTRAINTS.ANSWER_MIN_LENGTH, 'Answer text is required')
      .max(POLL_CONSTRAINTS.ANSWER_MAX_LENGTH, `Answer must be ${POLL_CONSTRAINTS.ANSWER_MAX_LENGTH} characters or less`)
  )
    .min(POLL_CONSTRAINTS.MIN_ANSWERS, `Must have at least ${POLL_CONSTRAINTS.MIN_ANSWERS} answers`)
    .max(POLL_CONSTRAINTS.MAX_ANSWERS, `Must have at most ${POLL_CONSTRAINTS.MAX_ANSWERS} answers`)
    .refine((answers) => {
      const uniqueAnswers = new Set(answers);
      return uniqueAnswers.size === answers.length;
    }, 'Answer texts must be unique'),
});

// Update Poll Request Schema
export const updatePollSchema = z.object({
  question: z.string()
    .min(POLL_CONSTRAINTS.QUESTION_MIN_LENGTH)
    .max(POLL_CONSTRAINTS.QUESTION_MAX_LENGTH)
    .optional(),
  answers: z.array(
    z.string()
      .min(POLL_CONSTRAINTS.ANSWER_MIN_LENGTH)
      .max(POLL_CONSTRAINTS.ANSWER_MAX_LENGTH)
  )
    .min(POLL_CONSTRAINTS.MIN_ANSWERS)
    .max(POLL_CONSTRAINTS.MAX_ANSWERS)
    .refine((answers) => {
      const uniqueAnswers = new Set(answers);
      return uniqueAnswers.size === answers.length;
    }, 'Answer texts must be unique')
    .optional(),
}).refine((data) => data.question !== undefined || data.answers !== undefined, {
  message: 'At least one field must be provided',
});

// Vote Request Schema
// Note: voterFingerprint is generated server-side from IP + User-Agent
export const voteRequestSchema = z.object({
  answerId: z.string().uuid('Invalid answer ID format'),
});

// Query Parameter Schemas
export const pollListQuerySchema = z.object({
  status: pollStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const analyticsQuerySchema = z.object({
  interval: z.enum(['hour', 'day', 'week']).default('hour'),
});
