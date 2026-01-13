import { z } from 'zod';
import { errorResponse } from './utils.js';
import { ERROR_CODES } from '@newsroom-polling/shared';

/**
 * Validate request body against a Zod schema
 * Returns error response if validation fails, otherwise returns parsed data
 */
export function validateBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: Response } {
  const result = schema.safeParse(body);

  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return {
      success: false,
      response: errorResponse(
        'Validation failed',
        400,
        ERROR_CODES.VALIDATION_ERROR,
        errors
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  queryParams: Record<string, string>,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: Response } {
  const result = schema.safeParse(queryParams);

  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return {
      success: false,
      response: errorResponse(
        'Invalid query parameters',
        400,
        ERROR_CODES.VALIDATION_ERROR,
        errors
      ),
    };
  }

  return { success: true, data: result.data };
}
