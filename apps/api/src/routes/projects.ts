import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { requireSupabase } from '../config/supabase';
import { ApiError } from '../utils/errors';

const router = Router();

// ─── GET /projects ─────────────────────────────────────────────────────────
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const db = requireSupabase();
    const { data, error } = await db
      .from('projects')
      .select('*, workflow_stages(stage_key, status)')
      .eq('user_id', req.user!.id)
      .order('updated_at', { ascending: false });

    if (error) throw new ApiError(500, error.message);
    res.json({ projects: data || [] });
  } catch (err) {
    next(err);
  }
});

// ─── POST /projects ────────────────────────────────────────────────────────
const CreateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  originalIdea: z.string().trim().min(10).max(5000),
});

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const body = CreateProjectSchema.parse(req.body);
    const db = requireSupabase();

    const { data, error } = await db
      .from('projects')
      .insert({
        user_id: req.user!.id,
        name: body.name,
        original_idea: body.originalIdea,
        current_stage: 0,
        overall_status: 'intake',
      })
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);
    res.status(201).json({ project: data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /projects/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const db = requireSupabase();
    const { data, error } = await db
      .from('projects')
      .select('*, workflow_stages(*), sources(*)')
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .single();

    if (error || !data) throw new ApiError(404, 'Project not found.');
    res.json({ project: data });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /projects/:id ───────────────────────────────────────────────────
const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  ideaSummary: z.string().optional(),
  assumptions: z.array(z.string()).optional(),
  currentStage: z.number().min(0).max(8).optional(),
  overallStatus: z.enum(['intake', 'in_progress', 'complete', 'archived']).optional(),
  verdict: z.enum(['GO', 'PIVOT', 'DROP']).nullable().optional(),
});

router.patch('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const body = UpdateProjectSchema.parse(req.body);
    const db = requireSupabase();

    // Verify ownership first
    const { data: existing } = await db
      .from('projects')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .single();

    if (!existing) throw new ApiError(404, 'Project not found.');

    const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.ideaSummary !== undefined) updatePayload.idea_summary = body.ideaSummary;
    if (body.assumptions !== undefined) updatePayload.assumptions = body.assumptions;
    if (body.currentStage !== undefined) updatePayload.current_stage = body.currentStage;
    if (body.overallStatus !== undefined) updatePayload.overall_status = body.overallStatus;
    if (body.verdict !== undefined) updatePayload.verdict = body.verdict;

    const { data, error } = await db
      .from('projects')
      .update(updatePayload)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);
    res.json({ project: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /projects/:id ──────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const db = requireSupabase();
    const { data, error } = await db
      .from('projects')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .select('id')
      .maybeSingle();

    if (error) throw new ApiError(500, error.message);
    if (!data) throw new ApiError(404, 'Project not found.');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
