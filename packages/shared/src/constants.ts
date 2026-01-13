// Poll Validation
export const POLL_CONSTRAINTS = {
  QUESTION_MIN_LENGTH: 1,
  QUESTION_MAX_LENGTH: 500,
  ANSWER_MIN_LENGTH: 1,
  ANSWER_MAX_LENGTH: 200,
  MIN_ANSWERS: 2,
  MAX_ANSWERS: 10,
} as const;

// Error Codes
export const ERROR_CODES = {
  POLL_NOT_FOUND: 'POLL_NOT_FOUND',
  POLL_NOT_PUBLISHED: 'POLL_NOT_PUBLISHED',
  POLL_CLOSED: 'POLL_CLOSED',
  POLL_IMMUTABLE: 'POLL_IMMUTABLE',
  DUPLICATE_VOTE: 'DUPLICATE_VOTE',
  INVALID_ANSWER: 'INVALID_ANSWER',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Status Values
export const POLL_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CLOSED: 'closed',
} as const;

// SSE Configuration
export const SSE_CONFIG = {
  KEEPALIVE_INTERVAL: 30000, // 30 seconds
  RETRY_DELAY: 3000, // 3 seconds
} as const;

// Durable Object Configuration
export const DO_CONFIG = {
  SYNC_INTERVAL: 30000, // 30 seconds
  BATCH_SIZE: 10, // Sync after this many votes
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
} as const;

// Analytics Intervals
export const ANALYTICS_INTERVALS = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
} as const;
