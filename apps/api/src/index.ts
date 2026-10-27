import './config/env'; // Load and validate env first
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env, features } from './config/env';
import { aiClient, aiModel, aiFallbackModel } from './config/ai';
import { errorHandler } from './middleware/errorHandler';
import projectsRouter from './routes/projects';
import stagesRouter from './routes/stages';
import chatRouter from './routes/chat';

const app = express();

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── Global rate limit ─────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait before retrying.' },
});
app.use(limiter);

// ─── Expensive operation rate limit (AI calls) ────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    features: {
      ai: features.ai,
      supabase: features.supabase,
      research: features.research,
    },
  });
});

// ─── AI diagnostics (model-list only — no generation, no quota cost) ─────────
app.get('/api/health/ai', async (_req, res) => {
  if (!features.ai || !aiClient) {
    res.status(503).json({ status: 'unconfigured', message: 'AI_API_KEY not set.' });
    return;
  }
  const start = Date.now();
  try {
    const list = await aiClient.models.list();
    const modelIds = list.data.map((m) => m.id);
    const primaryAvailable = modelIds.includes(aiModel) || modelIds.includes(`models/${aiModel}`);
    const fallbackAvailable = aiFallbackModel
      ? modelIds.includes(aiFallbackModel) || modelIds.includes(`models/${aiFallbackModel}`)
      : null;
    res.json({
      status: 'ok',
      provider: env.AI_PROVIDER,
      primaryModel: aiModel,
      primaryAvailable,
      fallbackModel: aiFallbackModel || null,
      fallbackAvailable,
      latencyMs: Date.now() - start,
      modelsReturned: modelIds.length,
    });
  } catch (err) {
    res.status(502).json({
      status: 'error',
      provider: env.AI_PROVIDER,
      primaryModel: aiModel,
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use('/api/projects', projectsRouter);
app.use('/api/projects/:projectId/stages', aiLimiter, stagesRouter);
app.use('/api/projects/:projectId/chat', aiLimiter, chatRouter);

// ─── 404 ───────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ─── Error handler ────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ─────────────────────────────────────────────────────────────────
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`\n🚀 Qravikon API running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

export default app;
