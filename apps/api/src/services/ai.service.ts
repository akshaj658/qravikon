import { requireAI, aiModel, aiFallbackModel, isGemini } from '../config/ai';
import { z } from 'zod';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── Error classification ────────────────────────────────────────────────────

export type AiErrorCategory =
  | 'quota_exhausted'
  | 'rate_limited'
  | 'invalid_model'
  | 'auth_failure'
  | 'timeout'
  | 'provider_error'
  | 'malformed_response'
  | 'schema_error'
  | 'unknown';

export interface AiError extends Error {
  category: AiErrorCategory;
  retryable: boolean;
  httpStatus?: number;
  model?: string;
  retryAfter?: string;
}

function classifyError(err: unknown, model: string): AiError {
  const base = err instanceof Error ? err : new Error(String(err));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = err as any;
  const status: number | undefined = anyErr?.status ?? anyErr?.statusCode;
  const code: string | undefined = anyErr?.code ?? anyErr?.error?.code;
  const errorMessage: string = anyErr?.error?.message ?? base.message ?? '';

  let category: AiErrorCategory = 'unknown';
  let retryable = false;
  let retryAfter: string | undefined;

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
      const match = errorMessage.match(/retry in (\w+)/i);
      if (match) retryAfter = match[1];
    } else {
      category = 'rate_limited';
      retryable = true;
    }
  } else if (
    base.name === 'APIConnectionTimeoutError' ||
    base.message.includes('timed out') ||
    base.message.includes('timeout')
  ) {
    category = 'timeout';
    retryable = true;
  } else if (status && status >= 500) {
    category = 'provider_error';
    retryable = true;
  }

  const aiErr = new Error(
    category === 'quota_exhausted'
      ? `Daily quota exhausted for model "${model}". ${retryAfter ? `Retry in ${retryAfter}.` : 'Try again tomorrow or switch to a different model via AI_MODEL in your .env.'}`
      : category === 'auth_failure'
      ? 'AI authentication failed. Check your AI_API_KEY.'
      : category === 'invalid_model'
      ? `AI model "${model}" not found. Update AI_MODEL in your .env.`
      : category === 'rate_limited'
      ? 'AI rate limit hit. Please wait a moment and try again.'
      : category === 'timeout'
      ? 'AI request timed out. The model may be under load — please try again.'
      : category === 'provider_error'
      ? 'AI provider returned a server error. Please try again in a moment.'
      : base.message
  ) as AiError;

  aiErr.category = category;
  aiErr.retryable = retryable;
  aiErr.httpStatus = status;
  aiErr.model = model;
  aiErr.retryAfter = retryAfter;
  aiErr.name = 'AiError';
  return aiErr;
}

// ─── Logging (never logs keys or user content) ───────────────────────────────

function logAiAttempt(
  op: string,
  model: string,
  attempt: number,
  durationMs: number,
  outcome: 'ok' | AiErrorCategory
) {
  const tag = outcome === 'ok' ? '✅' : '⚠️ ';
  console.log(`[AI] ${tag} ${op} | model=${model} attempt=${attempt} duration=${durationMs}ms status=${outcome}`);
}

// ─── Schema shape extractor ──────────────────────────────────────────────────
// Generates a compact, human-readable field map from a Zod schema so that
// Gemini knows EXACTLY which fields to include — preventing "Required" errors.

function zodToFieldHint(schema: z.ZodTypeAny, depth = 0): string {
  const indent = '  '.repeat(depth);

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const lines = Object.entries(shape).map(([key, val]) => {
      const inner = zodToFieldHint(val, depth + 1);
      return `${indent}  "${key}": ${inner}`;
    });
    return `{\n${lines.join(',\n')}\n${indent}}`;
  }

  if (schema instanceof z.ZodArray) {
    const inner = zodToFieldHint(schema.element, depth);
    return `[${inner}]`;
  }

  if (schema instanceof z.ZodEnum) {
    return `"${(schema.options as string[]).join('" | "')}"`;
  }

  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return zodToFieldHint(schema.unwrap(), depth) + ' (optional)';
  }

  if (schema instanceof z.ZodDefault) {
    return zodToFieldHint(schema._def.innerType, depth);
  }

  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodString) return '"string"';

  return '"value"';
}

function buildSchemaInstruction(schema: z.ZodTypeAny): string {
  const hint = zodToFieldHint(schema);
  return (
    '\n\nCRITICAL OUTPUT RULES:\n' +
    '1. Respond with a single valid JSON object ONLY. No markdown, no fences, no explanation.\n' +
    '2. Start your response with { and end with }.\n' +
    '3. ALL fields listed below are REQUIRED — do not omit any.\n' +
    '4. Use exactly this structure (fill in real values):\n' +
    hint
  );
}

// ─── JSON fence stripper ─────────────────────────────────────────────────────

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();
}

// ─── Core request helper with fallback ──────────────────────────────────────

async function withFallback<T>(
  primaryModel: string,
  op: (model: string) => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await op(primaryModel);
    logAiAttempt('completion', primaryModel, 1, Date.now() - start, 'ok');
    return result;
  } catch (err) {
    const classified = classifyError(err, primaryModel);
    logAiAttempt('completion', primaryModel, 1, Date.now() - start, classified.category);

    if (classified.category === 'quota_exhausted' && aiFallbackModel) {
      console.log(`[AI] Primary model quota exhausted. Trying fallback: ${aiFallbackModel}`);
      const fallbackStart = Date.now();
      try {
        const result = await op(aiFallbackModel);
        logAiAttempt('completion', aiFallbackModel, 2, Date.now() - fallbackStart, 'ok');
        return result;
      } catch (fallbackErr) {
        const fallbackClassified = classifyError(fallbackErr, aiFallbackModel);
        logAiAttempt('completion', aiFallbackModel, 2, Date.now() - fallbackStart, fallbackClassified.category);
        throw fallbackClassified;
      }
    }

    throw classified;
  }
}

// ─── Parse + validate helper ─────────────────────────────────────────────────

function parseAndValidate<T>(raw: string, schema: z.ZodSchema<T>, model: string): T {
  const cleaned = stripFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // One repair: try to extract first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* fall through */ }
    }
    if (parsed === undefined) {
      const e = new Error('AI response contained no parseable JSON object.') as AiError;
      e.category = 'malformed_response';
      e.retryable = false;
      e.model = model;
      throw e;
    }
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    // Surface the specific missing fields
    const issues = validated.error.issues
      .map(i => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    const e = new Error(`AI output did not match expected schema: ${issues}`) as AiError;
    e.category = 'schema_error';
    e.retryable = false;
    e.model = model;
    throw e;
  }

  return validated.data;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateStructuredOutput<T>(
  schema: z.ZodSchema<T>,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<T> {
  const client = requireAI();

  // Build schema-aware instruction so Gemini knows every required field
  const schemaInstruction = buildSchemaInstruction(schema as z.ZodTypeAny);

  const augmentedMessages: ChatMessage[] = isGemini
    ? messages.map((m, i) =>
        i === 0 && m.role === 'system'
          ? { ...m, content: m.content + schemaInstruction }
          : m
      )
    : messages;

  return withFallback(aiModel, async (model) => {
    const response = await client.chat.completions.create({
      model,
      messages: augmentedMessages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
      stream: false as const,
      ...(isGemini ? {} : { response_format: { type: 'json_object' as const } }),
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw || raw.trim() === '') {
      const e = new Error('AI returned an empty response.') as AiError;
      e.category = 'malformed_response';
      e.retryable = false;
      e.model = model;
      throw e;
    }

    // First parse attempt
    try {
      return parseAndValidate(raw, schema, model);
    } catch (firstErr) {
      const isSchemaErr = (firstErr as AiError).category === 'schema_error';
      const isMalformed = (firstErr as AiError).category === 'malformed_response';

      // One structured repair pass for schema/parse failures on Gemini
      if (isGemini && (isSchemaErr || isMalformed)) {
        console.log(`[AI] Schema/parse error — attempting repair pass. Error: ${(firstErr as Error).message}`);

        const repairMessages: ChatMessage[] = [
          ...augmentedMessages,
          { role: 'assistant', content: raw },
          {
            role: 'user',
            content:
              `Your previous response had this problem: ${(firstErr as Error).message}\n\n` +
              `Return the CORRECTED JSON object with ALL required fields included. ` +
              `Do not omit any field. Start with { and end with }.`,
          },
        ];

        const repairResponse = await client.chat.completions.create({
          model,
          messages: repairMessages,
          temperature: 0.1,
          max_tokens: options?.maxTokens ?? 4096,
          stream: false as const,
        });

        const repairRaw = repairResponse.choices[0]?.message?.content;
        if (!repairRaw || repairRaw.trim() === '') {
          throw firstErr; // surface original error
        }

        return parseAndValidate(repairRaw, schema, model);
      }

      throw firstErr;
    }
  });
}

export async function generateText(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const client = requireAI();

  return withFallback(aiModel, async (model) => {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature ?? 0.5,
      max_tokens: options?.maxTokens ?? 2048,
      stream: false as const,
    });

    return response.choices[0]?.message?.content ?? '';
  });
}

export async function* streamText(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): AsyncGenerator<string> {
  const client = requireAI();
  const start = Date.now();

  let stream;
  try {
    stream = await client.chat.completions.create({
      model: aiModel,
      messages,
      temperature: options?.temperature ?? 0.5,
      max_tokens: options?.maxTokens ?? 2048,
      stream: true,
    });
  } catch (err) {
    const classified = classifyError(err, aiModel);
    logAiAttempt('stream', aiModel, 1, Date.now() - start, classified.category);
    throw classified;
  }

  try {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
    logAiAttempt('stream', aiModel, 1, Date.now() - start, 'ok');
  } catch (err) {
    const classified = classifyError(err, aiModel);
    logAiAttempt('stream', aiModel, 1, Date.now() - start, classified.category);
    throw classified;
  }
}
