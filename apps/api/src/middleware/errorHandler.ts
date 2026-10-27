import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/errors';
import type { AiError } from '../services/ai.service';

function isAiError(err: unknown): err is AiError {
  return err instanceof Error && (err as AiError).category !== undefined;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error.',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (isAiError(err)) {
    // Map AI error categories to HTTP status codes and user-friendly messages.
    // Never leak raw provider error messages or API keys.
    const categoryToStatus: Record<string, number> = {
      quota_exhausted: 503,
      rate_limited: 429,
      invalid_model: 503,
      auth_failure: 503,     // 401 would expose config issues — mask as 503
      timeout: 504,
      provider_error: 502,
      malformed_response: 502,
      schema_error: 502,
      unknown: 500,
    };

    const status = categoryToStatus[err.category] ?? 500;

    res.status(status).json({
      error: err.message,
      errorCategory: err.category,
      retryable: err.retryable,
      ...(err.category === 'quota_exhausted' && err.retryAfter
        ? { retryAfter: err.retryAfter }
        : {}),
    });
    return;
  }

  // Generic fallback — log the raw error server-side, return a safe message
  console.error('[API Error]', err);
  const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
  res.status(500).json({ error: message });
}
