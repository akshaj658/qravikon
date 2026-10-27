import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  // Supabase — required for auth
  SUPABASE_URL: z.string().min(1, 'SUPABASE_URL is required').optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().min(1).optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional().or(z.literal('')),

  // AI — optional (enables AI features)
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'groq', 'together', 'google']).default('openai'),
  AI_API_KEY: z.string().optional().or(z.literal('')),
  AI_MODEL: z.string().default('gpt-4o-mini'),
  AI_BASE_URL: z.string().optional().or(z.literal('')),
  // Optional fallback model when primary quota is exhausted. Must share the same API key & endpoint.
  // Set this to a provider-supported model for the configured endpoint.
  AI_FALLBACK_MODEL: z.string().optional().or(z.literal('')),

  // Research — optional (enables live research)
  TAVILY_API_KEY: z.string().optional().or(z.literal('')),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌ Environment configuration error:');
  console.error(parsed.error.format());
  console.error('\nCopy .env.example to .env and fill in the required values.\n');
  process.exit(1);
}

export const env = parsed.data;

export const features = {
  supabase: !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY),
  ai: !!(env.AI_API_KEY),
  research: !!(env.TAVILY_API_KEY),
};

if (env.NODE_ENV === 'development') {
  const providerLabel = env.AI_PROVIDER === 'google' ? 'Google Gemini' : env.AI_PROVIDER;
  const aiLabel = features.ai
    ? `✅ ${providerLabel}/${env.AI_MODEL}${env.AI_FALLBACK_MODEL ? ` (fallback: ${env.AI_FALLBACK_MODEL})` : ''}`
    : '⚠️  not configured (set AI_API_KEY)';
  console.log('\n🔧 Qravikon API — Feature flags:');
  console.log(`  Supabase: ${features.supabase ? '✅ connected' : '⚠️  not configured (set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)'}`);
  console.log(`  AI:       ${aiLabel}`);
  console.log(`  Research: ${features.research ? '✅ Tavily' : '⚠️  not configured (set TAVILY_API_KEY)'}`);
  console.log('');
}
