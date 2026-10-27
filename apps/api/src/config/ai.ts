import OpenAI from 'openai';
import { env, features } from './env';

// ─── Singleton AI client ────────────────────────────────────────────────────

let aiClient: OpenAI | null = null;

if (features.ai) {
  aiClient = new OpenAI({
    apiKey: env.AI_API_KEY!,
    baseURL: env.AI_BASE_URL || undefined,
    // Conservative timeout: generation can take 30-60 s on free tier
    timeout: 120_000,
    // SDK-level retries: 2 automatic retries for transient 5xx/connection errors.
    // 429 quota-exhausted is NOT retried here; handled explicitly in ai.service.ts.
    maxRetries: 2,
  });
}

export { aiClient };

export function requireAI(): OpenAI {
  if (!aiClient) {
    throw new Error(
      'AI is not configured. Set AI_API_KEY (and AI_PROVIDER, AI_MODEL, AI_BASE_URL) in your .env.'
    );
  }
  return aiClient;
}

// Primary model from env; fallback from env (optional).
export const aiModel = env.AI_MODEL;
export const aiFallbackModel = env.AI_FALLBACK_MODEL || null;
export const isGemini = env.AI_PROVIDER === 'google';
