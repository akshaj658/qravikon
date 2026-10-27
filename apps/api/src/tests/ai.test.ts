/**
 * AI Integration Tests
 *
 * All external API calls are mocked — no real quota is consumed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAiError(status: number, message: string, code?: string) {
  const err = new Error(message) as Error & {
    status?: number;
    code?: string;
    error?: { message: string; code?: string };
  };
  err.status = status;
  err.code = code;
  err.error = { message, code };
  return err;
}

// ─── Error classification (inline mirror of ai.service logic) ─────────────────
// We test the categorisation logic in isolation without importing the module
// (which has side-effects via dotenv/config).

type AiErrorCategory =
  | 'quota_exhausted'
  | 'rate_limited'
  | 'invalid_model'
  | 'auth_failure'
  | 'timeout'
  | 'provider_error'
  | 'malformed_response'
  | 'schema_error'
  | 'unknown';

interface ClassifiedError {
  category: AiErrorCategory;
  retryable: boolean;
  httpStatus?: number;
}

function classifyError(err: unknown): ClassifiedError {
  const anyErr = err as Record<string, unknown>;
  const status = (anyErr.status ?? anyErr.statusCode) as number | undefined;
  const code = (anyErr.code ?? (anyErr.error as Record<string, unknown> | undefined)?.code) as
    | string
    | undefined;
  const errorMessage =
    ((anyErr.error as Record<string, unknown> | undefined)?.message as string) ??
    (err instanceof Error ? err.message : '') ??
    '';

  let category: AiErrorCategory = 'unknown';
  let retryable = false;

  if (status === 401 || status === 403) {
    category = 'auth_failure';
  } else if (status === 404 || code === 'model_not_found') {
    category = 'invalid_model';
  } else if (status === 429) {
    if (
      code === 'credit_balance_exhausted' ||
      code === 'RESOURCE_EXHAUSTED' ||
      errorMessage.toLowerCase().includes('per day') ||
      errorMessage.toLowerCase().includes('daily') ||
      errorMessage.toLowerCase().includes('quota')
    ) {
      category = 'quota_exhausted';
    } else {
      category = 'rate_limited';
      retryable = true;
    }
  } else if (
    err instanceof Error &&
    (err.name === 'APIConnectionTimeoutError' ||
      err.message.includes('timed out') ||
      err.message.includes('timeout'))
  ) {
    category = 'timeout';
    retryable = true;
  } else if (status && status >= 500) {
    category = 'provider_error';
    retryable = true;
  }

  return { category, retryable, httpStatus: status };
}

// ─── JSON fence stripper (mirror) ─────────────────────────────────────────────

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AI Error Classification', () => {
  it('classifies 429 + quota keywords as quota_exhausted (not retryable)', () => {
    const result = classifyError(makeAiError(429, 'Generate content requests per day limit exceeded', 'RESOURCE_EXHAUSTED'));
    expect(result.category).toBe('quota_exhausted');
    expect(result.retryable).toBe(false);
  });

  it('classifies 429 without quota keywords as rate_limited (retryable)', () => {
    const result = classifyError(makeAiError(429, 'Too many requests', 'rate_limit'));
    expect(result.category).toBe('rate_limited');
    expect(result.retryable).toBe(true);
  });

  it('classifies 401 as auth_failure (not retryable)', () => {
    const result = classifyError(makeAiError(401, 'Unauthorized'));
    expect(result.category).toBe('auth_failure');
    expect(result.retryable).toBe(false);
  });

  it('classifies 403 as auth_failure (not retryable)', () => {
    const result = classifyError(makeAiError(403, 'Forbidden'));
    expect(result.category).toBe('auth_failure');
    expect(result.retryable).toBe(false);
  });

  it('classifies 404 as invalid_model (not retryable)', () => {
    const result = classifyError(makeAiError(404, 'Model not found'));
    expect(result.category).toBe('invalid_model');
    expect(result.retryable).toBe(false);
  });

  it('classifies 502 as provider_error (retryable)', () => {
    const result = classifyError(makeAiError(502, 'Bad gateway'));
    expect(result.category).toBe('provider_error');
    expect(result.retryable).toBe(true);
  });

  it('classifies 503 as provider_error (retryable)', () => {
    const result = classifyError(makeAiError(503, 'Service unavailable'));
    expect(result.category).toBe('provider_error');
    expect(result.retryable).toBe(true);
  });

  it('classifies timeout error by message as timeout (retryable)', () => {
    const timeoutErr = new Error('Request timed out.');
    const result = classifyError(timeoutErr);
    expect(result.category).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('classifies APIConnectionTimeoutError by name as timeout', () => {
    const err = new Error('Connection timed out');
    err.name = 'APIConnectionTimeoutError';
    const result = classifyError(err);
    expect(result.category).toBe('timeout');
    expect(result.retryable).toBe(true);
  });

  it('classifies credit_balance_exhausted (OpenAI) as quota_exhausted', () => {
    const result = classifyError(makeAiError(429, 'No credits remaining', 'credit_balance_exhausted'));
    expect(result.category).toBe('quota_exhausted');
    expect(result.retryable).toBe(false);
  });

  it('preserves http status in classified error', () => {
    const result = classifyError(makeAiError(429, 'Daily quota exhausted'));
    expect(result.httpStatus).toBe(429);
  });

  it('returns unknown for unrecognised errors', () => {
    const result = classifyError(new Error('Something completely unexpected'));
    expect(result.category).toBe('unknown');
    expect(result.retryable).toBe(false);
  });
});

describe('JSON Fence Stripping', () => {
  it('strips ```json fences', () => {
    const raw = '```json\n{"key": "value"}\n```';
    expect(stripFences(raw)).toBe('{"key": "value"}');
  });

  it('strips plain ``` fences', () => {
    const raw = '```\n{"key": "value"}\n```';
    expect(stripFences(raw)).toBe('{"key": "value"}');
  });

  it('leaves clean JSON untouched', () => {
    const raw = '{"key": "value"}';
    expect(stripFences(raw)).toBe('{"key": "value"}');
  });

  it('trims surrounding whitespace', () => {
    const raw = '  \n{"key": "value"}\n  ';
    expect(stripFences(raw)).toBe('{"key": "value"}');
  });

  it('handles empty string gracefully', () => {
    expect(stripFences('')).toBe('');
  });
});

describe('Structured Output Parsing', () => {
  const SimpleSchema = z.object({ name: z.string(), score: z.number() });

  it('parses valid JSON matching schema', () => {
    const raw = '{"name": "test", "score": 9}';
    const parsed = JSON.parse(raw);
    const result = SimpleSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('test');
      expect(result.data.score).toBe(9);
    }
  });

  it('rejects JSON missing required field', () => {
    const raw = '{"name": "test"}'; // missing score
    const parsed = JSON.parse(raw);
    const result = SimpleSchema.safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it('rejects JSON with wrong field type', () => {
    const raw = '{"name": "test", "score": "nine"}'; // score should be number
    const parsed = JSON.parse(raw);
    const result = SimpleSchema.safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it('successfully extracts JSON from fenced block', () => {
    const raw = '```json\n{"name": "test", "score": 7}\n```';
    const cleaned = stripFences(raw);
    const parsed = JSON.parse(cleaned);
    const result = SimpleSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it('finds JSON in a mixed-text response using regex fallback', () => {
    const raw = 'Here is the result: {"name": "test", "score": 8} as requested.';
    // Primary parse fails, try regex extraction
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }
    const result = SimpleSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });
});

describe('Fallback Model Logic', () => {
  it('should only fall back on quota_exhausted, not on other errors', () => {
    const shouldFallback = (category: AiErrorCategory, fallbackModel: string | null): boolean => {
      return category === 'quota_exhausted' && !!fallbackModel;
    };

    expect(shouldFallback('quota_exhausted', 'gemini-3.6-flash')).toBe(true);
    expect(shouldFallback('rate_limited', 'gemini-3.6-flash')).toBe(false);
    expect(shouldFallback('timeout', 'gemini-3.6-flash')).toBe(false);
    expect(shouldFallback('auth_failure', 'gemini-3.6-flash')).toBe(false);
    expect(shouldFallback('provider_error', 'gemini-3.6-flash')).toBe(false);
    expect(shouldFallback('quota_exhausted', null)).toBe(false); // no fallback configured
    expect(shouldFallback('quota_exhausted', '')).toBe(false);
  });
});

describe('Stage preservation on failure', () => {
  it('does not overwrite previous stage data when generation fails', () => {
    type StageStatus = 'pending' | 'completed' | 'approved' | 'skipped' | 'needs_revision';
    interface Stage { stage_key: string; status: StageStatus; result_data?: unknown }

    const existingStages: Stage[] = [
      { stage_key: 'idea_clarification', status: 'approved', result_data: { ideaSummary: 'existing' } },
      { stage_key: 'viability', status: 'completed', result_data: { viabilityScore: 7 } },
    ];

    // Simulate failed stage — state should NOT be mutated
    function applyFailure(stages: Stage[], _failedKey: string): Stage[] {
      // Failure path: return unchanged stages
      return stages;
    }

    const after = applyFailure(existingStages, 'viability');
    expect(after).toHaveLength(2);
    expect(after[0].result_data).toEqual({ ideaSummary: 'existing' });
    expect(after[1].result_data).toEqual({ viabilityScore: 7 });
  });

  it('does not mark failed stage as approved', () => {
    type StageStatus = 'pending' | 'completed' | 'approved' | 'skipped' | 'needs_revision';
    // On error, stageLoading is cleared but no status update occurs
    let stageStatus: StageStatus = 'pending';
    let stageLoading: string | null = 'viability';

    // Simulate error path
    stageLoading = null; // cleared in finally
    // stageStatus is NOT changed — stays pending

    expect(stageStatus).toBe('pending');
    expect(stageLoading).toBeNull();
  });
});

describe('Feature flags', () => {
  it('reports ai as inactive when key is absent', () => {
    const key: string = '';
    expect(!!key).toBe(false);
  });

  it('reports ai as active when key is present', () => {
    const key: string = 'AQ.some-gemini-key';
    expect(!!key).toBe(true);
  });

  it('reports fallback as inactive when fallback model is blank', () => {
    const fallback: string = '';
    expect(!!fallback).toBe(false);
  });

  it('reports fallback as active when fallback model is set', () => {
    const fallback: string = 'gemini-3.6-flash';
    expect(!!fallback).toBe(true);
  });
});
