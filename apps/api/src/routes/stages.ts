import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { requireSupabase } from '../config/supabase';
import { ApiError } from '../utils/errors';
import { features } from '../config/env';
import { ClarificationAnswersSchema, ClarificationEditsSchema } from '../schemas/clarification';
import {
  analyzeIdea,
  analyzeViability,
  analyzeTargetCustomer,
  analyzeMarketSize,
  analyzeCompetitors,
  analyzeDifferentiation,
  analyzeGtm,
  generateFinalReport,
  IdeaClarification,
  Viability,
  TargetCustomer,
  MarketSizing,
  CompetitorAnalysis,
  Differentiation,
  Gtm,
} from '../services/stages.service';
import { search, SearchResponse } from '../services/research.service';
import {
  getNextStageIndex,
  getPreviousStageKey,
  getStageActionStatus,
  isStageUnblockedBy,
  STAGE_ORDER,
  type StageKey,
} from '../workflow';
import { isReusableStageResult } from '../workflow-results';

const router = Router({ mergeParams: true });

interface ProjectRow {
  id: string;
  name: string;
  original_idea: string;
  assumptions: string[] | null;
  current_stage: number;
}

async function verifyPreviousStageApproved(projectId: string, stageKey: StageKey): Promise<void> {
  const previousStageKey = getPreviousStageKey(stageKey);
  if (!previousStageKey) return;
  const db = requireSupabase();
  const { data, error } = await db
    .from('workflow_stages')
    .select('status')
    .eq('project_id', projectId)
    .eq('stage_key', previousStageKey)
    .maybeSingle();
  if (error) throw new ApiError(500, `Failed to verify workflow progress: ${error.message}`);
  if (!isStageUnblockedBy(data?.status)) {
    throw new ApiError(
      400,
      `The ${previousStageKey.replaceAll('_', ' ')} findings are saved but not approved. Review and approve or skip that stage before continuing.`,
      { requiredStageKey: previousStageKey }
    );
  }
}

// Helper: verify project ownership
async function verifyProjectOwnership(projectId: string, userId: string): Promise<ProjectRow> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('projects')
    .select('id, name, original_idea, assumptions, current_stage')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (error) throw new ApiError(500, `Failed to verify project ownership: ${error.message}`);
  if (!data) throw new ApiError(404, 'Project not found or access denied.');
  return data as ProjectRow;
}

// Helper: save stage result
async function saveStageResult(
  projectId: string,
  stageKey: string,
  resultData: unknown,
  status: 'completed' | 'approved' | 'skipped' = 'completed'
) {
  const db = requireSupabase();
  const { data: current, error: currentError } = await db
    .from('workflow_stages')
    .select('input_data')
    .eq('project_id', projectId)
    .eq('stage_key', stageKey)
    .maybeSingle();
  if (currentError) throw new ApiError(500, `Failed to load stage input: ${currentError.message}`);
  const { error } = await db
    .from('workflow_stages')
    .upsert(
      {
        project_id: projectId,
        stage_key: stageKey,
        status,
        input_data: {
          ...((current?.input_data ?? {}) as Record<string, unknown>),
          stale: false,
          staleAt: null,
          staleReason: null,
        },
        result_data: resultData,
        approval_notes: null,
        approved_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,stage_key' }
    );

  if (error) throw new ApiError(500, `Failed to save stage: ${error.message}`);
}

async function getReusableStageResult<T>(projectId: string, stageKey: string): Promise<T | null> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('workflow_stages')
    .select('status, input_data, result_data')
    .eq('project_id', projectId)
    .eq('stage_key', stageKey)
    .maybeSingle();
  if (error) throw new ApiError(500, `Failed to load saved stage: ${error.message}`);
  const inputData = (data?.input_data ?? {}) as Record<string, unknown>;
  if (!isReusableStageResult(data?.result_data, data?.status, inputData)) return null;
  return data.result_data as T;
}

// Helper: get stage result
async function getStageResult<T>(projectId: string, stageKey: string): Promise<T | null> {
  const db = requireSupabase();
  const { data } = await db
    .from('workflow_stages')
    .select('result_data, status')
    .eq('project_id', projectId)
    .eq('stage_key', stageKey)
    .single();

  return (data as { result_data: T } | null)?.result_data ?? null;
}

// Helper: get stage input data
async function getStageInputData<T>(projectId: string, stageKey: string): Promise<T | null> {
  const db = requireSupabase();
  const { data } = await db
    .from('workflow_stages')
    .select('input_data')
    .eq('project_id', projectId)
    .eq('stage_key', stageKey)
    .single();

  return (data as { input_data: T } | null)?.input_data ?? null;
}

async function getStageApprovalNotes(projectId: string, stageKey: StageKey): Promise<string | null> {
  const db = requireSupabase();
  const { data, error } = await db
    .from('workflow_stages')
    .select('approval_notes')
    .eq('project_id', projectId)
    .eq('stage_key', stageKey)
    .maybeSingle();
  if (error) throw new ApiError(500, `Failed to load revision feedback: ${error.message}`);
  return data?.approval_notes ?? null;
}

// ─── Stage 1: Idea clarification ──────────────────────────────────────────
router.post('/stage/idea-clarification', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!features.ai) {
      res.status(503).json({
        error: 'AI is not configured.',
        hint: 'Set AI_API_KEY to enable this feature. Demo mode is available in the frontend.',
        demo: true,
      });
      return;
    }

    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    await verifyPreviousStageApproved(project.id, 'idea_clarification');
    const savedResult = await getReusableStageResult<IdeaClarification>(project.id, 'idea_clarification');
    if (savedResult) {
      res.json({ result: savedResult });
      return;
    }
    const result = await analyzeIdea(project.original_idea, project.name);
    await saveStageResult(project.id, 'idea_clarification', result);

    res.json({ result });
  } catch (err) {
    next(err);
  }
});

// ─── Stage 1 confirmation ──────────────────────────────────────────────────
const ConfirmIdeaSchema = z.object({
  ideaSummary: z.string().min(10),
  assumptions: z.array(z.string()),
  answers: ClarificationAnswersSchema,
});

router.post('/stage/confirm-idea', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    const body = ConfirmIdeaSchema.parse(req.body);
    const db = requireSupabase();
    const { data: currentStage, error: currentStageError } = await db
      .from('workflow_stages')
      .select('input_data, result_data')
      .eq('project_id', project.id)
      .eq('stage_key', 'idea_clarification')
      .maybeSingle();
    if (currentStageError) throw new ApiError(500, `Failed to load idea clarification: ${currentStageError.message}`);
    if (!currentStage?.result_data) throw new ApiError(400, 'Generate idea clarification before approving it.');

    const currentInput = (currentStage.input_data ?? {}) as Record<string, unknown>;
    const currentResult = (currentStage.result_data ?? {}) as Record<string, unknown>;
    const changed = currentResult.ideaSummary !== body.ideaSummary
      || JSON.stringify(currentResult.coreAssumptions ?? []) !== JSON.stringify(body.assumptions)
      || JSON.stringify(currentInput.answers ?? currentInput) !== JSON.stringify(body.answers);
    const updatedAt = new Date().toISOString();

    const { error: stageError } = await db.from('workflow_stages').upsert({
      project_id: project.id,
      stage_key: 'idea_clarification',
      status: 'approved',
      input_data: { ...currentInput, answers: body.answers },
      result_data: {
        ...currentResult,
        ideaSummary: body.ideaSummary,
        coreAssumptions: body.assumptions,
      },
      approved_at: updatedAt,
      updated_at: updatedAt,
    }, { onConflict: 'project_id,stage_key' });
    if (stageError) throw new ApiError(500, `Failed to save idea clarification: ${stageError.message}`);

    const { error: projectError } = await db.from('projects').update({
      idea_summary: body.ideaSummary,
      assumptions: body.assumptions,
      current_stage: 1,
      overall_status: 'in_progress',
      updated_at: updatedAt,
    }).eq('id', project.id);
    if (projectError) throw new ApiError(500, `Failed to save idea clarification: ${projectError.message}`);

    if (changed) {
      const { data: downstreamStages, error: downstreamError } = await db
        .from('workflow_stages')
        .select('stage_key, input_data')
        .eq('project_id', project.id)
        .neq('stage_key', 'idea_clarification');
      if (downstreamError) throw new ApiError(500, `Failed to mark dependent findings stale: ${downstreamError.message}`);
      for (const downstream of downstreamStages ?? []) {
        const { error } = await db.from('workflow_stages')
          .update({
            input_data: {
              ...((downstream.input_data ?? {}) as Record<string, unknown>),
              stale: true,
              staleAt: updatedAt,
              staleReason: 'Idea clarification changed',
            },
            updated_at: updatedAt,
          })
          .eq('project_id', project.id)
          .eq('stage_key', downstream.stage_key);
        if (error) throw new ApiError(500, `Failed to mark dependent findings stale: ${error.message}`);
      }
    }

    res.json({ success: true, currentStage: 1 });
  } catch (err) {
    next(err);
  }
});

// ─── Stage 2: Problem & Viability ─────────────────────────────────────────
router.post('/stage/viability', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!features.ai) {
      res.status(503).json({ error: 'AI not configured.', hint: 'Set AI_API_KEY.', demo: true });
      return;
    }

    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    await verifyPreviousStageApproved(project.id, 'viability');
    const savedResult = await getReusableStageResult<Viability>(project.id, 'viability');
    if (savedResult) {
      res.json({ result: savedResult });
      return;
    }
    const clarification = await getStageResult<IdeaClarification>(project.id, 'idea_clarification');
    if (!clarification) throw new ApiError(400, 'Complete idea clarification first.');

    const result = await analyzeViability(project.original_idea, clarification);
    await saveStageResult(project.id, 'viability', result);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

// ─── Stage 3: Target Customer ─────────────────────────────────────────────
router.post('/stage/target-customer', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!features.ai) {
      res.status(503).json({ error: 'AI not configured.', hint: 'Set AI_API_KEY.', demo: true });
      return;
    }

    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    await verifyPreviousStageApproved(project.id, 'target_customer');
    const savedResult = await getReusableStageResult<TargetCustomer>(project.id, 'target_customer');
    if (savedResult) {
      res.json({ result: savedResult });
      return;
    }
    const clarification = await getStageResult<IdeaClarification>(project.id, 'idea_clarification');
    const answers = await getStageInputData<Record<string, string>>(project.id, 'idea_clarification');

    if (!clarification) throw new ApiError(400, 'Complete idea clarification first.');

    const result = await analyzeTargetCustomer(project.original_idea, clarification, answers || {});
    await saveStageResult(project.id, 'target_customer', result);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

// ─── Stage 4: Market Sizing ────────────────────────────────────────────────
router.post('/stage/market-sizing', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!features.ai) {
      res.status(503).json({ error: 'AI not configured.', hint: 'Set AI_API_KEY.', demo: true });
      return;
    }

    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    await verifyPreviousStageApproved(project.id, 'market_sizing');
    const savedResult = await getReusableStageResult<MarketSizing>(project.id, 'market_sizing');
    if (savedResult) {
      res.json({ result: savedResult });
      return;
    }
    const clarification = await getStageResult<IdeaClarification>(project.id, 'idea_clarification');
    const customer = await getStageResult<TargetCustomer>(project.id, 'target_customer');
    const answers = await getStageInputData<Record<string, string>>(project.id, 'idea_clarification');

    if (!clarification || !customer) throw new ApiError(400, 'Complete previous stages first.');

    const result = await analyzeMarketSize(project.original_idea, customer, answers || {});
    await saveStageResult(project.id, 'market_sizing', result);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

// ─── Stage 5: Competitor Research ─────────────────────────────────────────
router.post('/stage/competitors', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!features.ai) {
      res.status(503).json({ error: 'AI not configured.', hint: 'Set AI_API_KEY.', demo: true });
      return;
    }

    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    await verifyPreviousStageApproved(project.id, 'competitors');
    const savedResult = await getReusableStageResult<CompetitorAnalysis>(project.id, 'competitors');
    if (savedResult) {
      res.json({ result: savedResult });
      return;
    }
    const customer = await getStageResult<TargetCustomer>(project.id, 'target_customer');
    if (!customer) throw new ApiError(400, 'Complete target customer stage first.');

    let researchResults: SearchResponse[] | undefined;
    if (features.research) {
      try {
        const settled = await Promise.allSettled([
          search(`${project.name} competitors alternatives`, { maxResults: 5 }),
          search(`${project.original_idea.slice(0, 100)} software tools comparison`, { maxResults: 5 }),
        ]);
        researchResults = settled
          .filter((r): r is PromiseFulfilledResult<SearchResponse> => r.status === 'fulfilled')
          .map(r => r.value);
      } catch {
        // Research optional — proceed without it
      }
    }

    const result = await analyzeCompetitors(project.original_idea, customer, researchResults);

    // Save sources to DB
    const sourcesWithData = result.competitors.filter(c => c.source);
    if (sourcesWithData.length > 0) {
      const db = requireSupabase();
      const sources = sourcesWithData.map(c => ({
        project_id: project.id,
        stage_key: 'competitors',
        url: c.source!.url,
        title: c.source!.title,
        evidence_summary: c.source!.summary,
        retrieved_at: c.source!.retrievedAt,
        published_date: c.source!.publishedDate || null,
      }));
      await db.from('sources').insert(sources);
    }

    await saveStageResult(project.id, 'competitors', result);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

// ─── Stage 6: Differentiation ─────────────────────────────────────────────
router.post('/stage/differentiation', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!features.ai) {
      res.status(503).json({ error: 'AI not configured.', hint: 'Set AI_API_KEY.', demo: true });
      return;
    }

    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    await verifyPreviousStageApproved(project.id, 'differentiation');
    const savedResult = await getReusableStageResult<Differentiation>(project.id, 'differentiation');
    if (savedResult) {
      res.json({ result: savedResult });
      return;
    }
    const competitors = await getStageResult<CompetitorAnalysis>(project.id, 'competitors');
    const customer = await getStageResult<TargetCustomer>(project.id, 'target_customer');
    if (!competitors || !customer) throw new ApiError(400, 'Complete previous stages first.');

    const result = await analyzeDifferentiation(project.original_idea, competitors, customer);
    await saveStageResult(project.id, 'differentiation', result);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

// ─── Stage 6: Select Strategy ─────────────────────────────────────────────
const SelectStrategySchema = z.object({ strategyId: z.string() });

router.post('/stage/select-strategy', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    await verifyPreviousStageApproved(project.id, 'differentiation');
    const body = SelectStrategySchema.parse(req.body);
    const db = requireSupabase();

    const { data: current, error: currentError } = await db
      .from('workflow_stages')
      .select('status, input_data, result_data, approved_at, approval_notes')
      .eq('project_id', project.id)
      .eq('stage_key', 'differentiation')
      .maybeSingle();
    if (currentError) throw new ApiError(500, `Failed to load differentiation: ${currentError.message}`);
    const currentInput = (current?.input_data ?? {}) as Record<string, unknown>;
    const changed = currentInput.selectedStrategyId !== body.strategyId;
    const status = changed && current?.status === 'approved' ? 'needs_revision' : current?.status ?? 'completed';
    const { error: saveError } = await db.from('workflow_stages').upsert({
      project_id: project.id,
      stage_key: 'differentiation',
      status,
      input_data: { ...currentInput, selectedStrategyId: body.strategyId },
      result_data: current?.result_data ?? {},
      approved_at: status === 'needs_revision' ? null : current?.approved_at ?? null,
      approval_notes: current?.approval_notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,stage_key' });
    if (saveError) throw new ApiError(500, `Failed to save strategy selection: ${saveError.message}`);

    if (changed) {
      const staleAt = new Date().toISOString();
      for (const stageKey of ['gtm', 'final_report']) {
        const { data: downstream, error } = await db.from('workflow_stages')
          .select('input_data')
          .eq('project_id', project.id)
          .eq('stage_key', stageKey)
          .maybeSingle();
        if (error) throw new ApiError(500, `Failed to load dependent stage: ${error.message}`);
        if (!downstream) continue;
        const { error: staleError } = await db.from('workflow_stages')
          .update({
            input_data: {
              ...((downstream.input_data ?? {}) as Record<string, unknown>),
              stale: true,
              staleAt,
              staleReason: 'Differentiation strategy changed',
            },
            updated_at: staleAt,
          })
          .eq('project_id', project.id)
          .eq('stage_key', stageKey);
        if (staleError) throw new ApiError(500, `Failed to mark dependent findings stale: ${staleError.message}`);
      }
    }

    res.json({ success: true, status });
  } catch (err) {
    next(err);
  }
});

// ─── Stage 7: Go-to-Market ─────────────────────────────────────────────────
router.post('/stage/gtm', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!features.ai) {
      res.status(503).json({ error: 'AI not configured.', hint: 'Set AI_API_KEY.', demo: true });
      return;
    }

    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    await verifyPreviousStageApproved(project.id, 'gtm');
    const savedResult = await getReusableStageResult<Gtm>(project.id, 'gtm');
    if (savedResult) {
      res.json({ result: savedResult });
      return;
    }
    const customer = await getStageResult<TargetCustomer>(project.id, 'target_customer');
    const differentiation = await getStageResult<Differentiation>(project.id, 'differentiation');
    const diffInput = await getStageInputData<{ selectedStrategyId?: string }>(project.id, 'differentiation');

    if (!customer || !differentiation) throw new ApiError(400, 'Complete previous stages first.');

    const revisionFeedback = await getStageApprovalNotes(project.id, 'gtm');
    const selectedStrategyId = diffInput?.selectedStrategyId || differentiation.recommendedStrategyId;

    const result = await analyzeGtm(project.original_idea, customer, differentiation, selectedStrategyId, revisionFeedback);
    await saveStageResult(project.id, 'gtm', result);
    res.json({ result });
  } catch (err) {
    next(err);
  }
});

// ─── Stage 8: Final Report ─────────────────────────────────────────────────
router.post('/stage/final-report', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!features.ai) {
      res.status(503).json({ error: 'AI not configured.', hint: 'Set AI_API_KEY.', demo: true });
      return;
    }

    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    await verifyPreviousStageApproved(project.id, 'final_report');
    const savedResult = await getReusableStageResult<Awaited<ReturnType<typeof generateFinalReport>>>(project.id, 'final_report');
    if (savedResult) {
      const { error } = await requireSupabase().from('projects')
        .update({ verdict: savedResult.verdict, updated_at: new Date().toISOString() })
        .eq('id', project.id);
      if (error) throw new ApiError(500, `Failed to synchronize the saved report: ${error.message}`);
      res.json({ result: savedResult });
      return;
    }
    const db = requireSupabase();

    const { data: stageStatuses, error: stageStatusError } = await db
      .from('workflow_stages')
      .select('stage_key, status, result_data, input_data')
      .eq('project_id', project.id);
    if (stageStatusError) throw new ApiError(500, `Failed to read workflow statuses: ${stageStatusError.message}`);
    const stageRows = stageStatuses ?? [];
    const stageRow = (stageKey: StageKey) => stageRows.find(stage => stage.stage_key === stageKey);
    const currentFinding = <T,>(stageKey: StageKey): T | undefined => {
      const row = stageRow(stageKey);
      if (!row?.result_data || (row.input_data as Record<string, unknown> | null)?.stale === true) return undefined;
      return row.result_data as T;
    };
    const differentiation = currentFinding<Differentiation>('differentiation');
    const diffInput = stageRow('differentiation')?.input_data as { selectedStrategyId?: string } | undefined;
    const stageStatusSummary = STAGE_ORDER
      .filter(stageKey => stageKey !== 'final_report')
      .map(stageKey => ({
        stageKey,
        status: stageRow(stageKey)?.status ?? 'pending',
        stale: (stageRow(stageKey)?.input_data as Record<string, unknown> | null)?.stale === true,
      }));
    const skippedStages = stageStatusSummary
      .filter(stage => stage.status === 'skipped')
      .map(stage => stage.stageKey);
    const workflowLimitations = stageStatusSummary.flatMap(stage => {
      if (stage.stale) return [`${stage.stageKey.replaceAll('_', ' ')} findings are potentially stale and were excluded.`];
      if (stage.status === 'skipped') return [`${stage.stageKey.replaceAll('_', ' ')} was skipped; dependent conclusions may be incomplete.`];
      if (stage.status !== 'approved') return [`${stage.stageKey.replaceAll('_', ' ')} is ${stage.status}; its findings are not approved.`];
      return [];
    });
    const result = await generateFinalReport(project.original_idea, {
      clarification: currentFinding<IdeaClarification>('idea_clarification'),
      viability: currentFinding<Viability>('viability'),
      customer: currentFinding<TargetCustomer>('target_customer'),
      marketSizing: currentFinding<MarketSizing>('market_sizing'),
      competitors: currentFinding<CompetitorAnalysis>('competitors'),
      differentiation,
      gtm: currentFinding<Gtm>('gtm'),
      selectedStrategyId: diffInput?.selectedStrategyId || differentiation?.recommendedStrategyId,
      stageStatuses: stageStatusSummary,
    });
    const reportResult = {
      ...result,
      skippedStages,
      stageStatuses: stageStatusSummary,
      workflowLimitations,
    };

    await saveStageResult(project.id, 'final_report', reportResult, 'completed');
    const { error: projectError } = await db.from('projects').update({
      verdict: result.verdict,
      updated_at: new Date().toISOString(),
    }).eq('id', project.id);
    if (projectError) throw new ApiError(500, `Failed to save final report status: ${projectError.message}`);

    res.json({ result: reportResult });
  } catch (err) {
    next(err);
  }
});

// ─── Approve / revise / skip stage ────────────────────────────────────────
const ApproveStageSchema = z.object({
  action: z.enum(['approve', 'revise', 'skip', 'save']),
  stageKey: z.enum([
    'idea_clarification', 'viability', 'target_customer', 'market_sizing',
    'competitors', 'differentiation', 'gtm', 'final_report',
  ]),
  notes: z.string().optional(),
  clarification: ClarificationEditsSchema.optional(),
  marketSizing: z.object({
    assumptions: z.object({
      totalPotentialCustomers: z.number().positive(),
      segmentPercentage: z.number().min(0).max(100),
      geographyNote: z.string(),
      annualRevenuePerCustomer: z.number().positive(),
      reachableShare: z.number().min(0).max(100),
      timeHorizonYears: z.number(),
    }),
    calculations: z.object({
      tam: z.number(),
      sam: z.number(),
      som: z.number(),
      tamFormula: z.string(),
      samFormula: z.string(),
      somFormula: z.string(),
    }),
    scenarios: z.object({
      low: z.object({ tam: z.number(), sam: z.number(), som: z.number() }),
      base: z.object({ tam: z.number(), sam: z.number(), som: z.number() }),
      high: z.object({ tam: z.number(), sam: z.number(), som: z.number() }),
    }),
  }).optional(),
});

router.post('/stage/action', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const project = await verifyProjectOwnership(req.params.projectId, req.user!.id);
    const body = ApproveStageSchema.parse(req.body);
    if (body.clarification && body.stageKey !== 'idea_clarification') {
      throw new ApiError(400, 'Clarification edits can only be saved to Idea Clarification.');
    }
    if (body.marketSizing && (body.stageKey !== 'market_sizing' || body.action !== 'approve')) {
      throw new ApiError(400, 'Market sizing edits can only be saved while approving Market Sizing.');
    }
    if (body.clarification && body.marketSizing) {
      throw new ApiError(400, 'Only one stage edit payload can be saved at a time.');
    }
    if (body.action === 'approve') await verifyPreviousStageApproved(project.id, body.stageKey);
    const db = requireSupabase();

    const { data: existingStage, error: existingStageError } = await db
      .from('workflow_stages')
      .select('status, input_data, result_data, approved_at, approval_notes, updated_at')
      .eq('project_id', project.id)
      .eq('stage_key', body.stageKey)
      .maybeSingle();
    if (existingStageError) throw new ApiError(500, `Failed to load stage: ${existingStageError.message}`);

    const hasResult = existingStage?.result_data
      && typeof existingStage.result_data === 'object'
      && Object.keys(existingStage.result_data).length > 0;
    if (body.action === 'approve' && !hasResult) {
      throw new ApiError(400, 'Generate and save this stage before approving it.');
    }

    const status = getStageActionStatus(body.action, existingStage?.status);
    const existingInput = (existingStage?.input_data ?? {}) as Record<string, unknown>;
    const existingResult = (existingStage?.result_data ?? {}) as Record<string, unknown>;
    const clarificationChanged = body.stageKey === 'idea_clarification'
      && body.clarification !== undefined
      && (
        existingResult.ideaSummary !== body.clarification.ideaSummary
        || JSON.stringify(existingResult.coreAssumptions ?? []) !== JSON.stringify(body.clarification.assumptions)
        || JSON.stringify(existingInput.answers ?? {}) !== JSON.stringify(body.clarification.answers)
      );
    const stageResult = body.marketSizing
      ? { ...existingResult, ...body.marketSizing }
      : body.clarification
        ? {
          ...existingResult,
          ideaSummary: body.clarification.ideaSummary,
          coreAssumptions: body.clarification.assumptions,
        }
        : existingResult;
    const stageInput = body.clarification
      ? { ...existingInput, answers: body.clarification.answers }
      : existingInput;
    const updatedAt = new Date().toISOString();
    const { data: savedStage, error: saveStageError } = await db.from('workflow_stages').upsert({
      project_id: project.id,
      stage_key: body.stageKey,
      status,
      input_data: stageInput,
      result_data: stageResult,
      approval_notes: body.notes || null,
      approved_at: body.action === 'approve' ? updatedAt : null,
      updated_at: updatedAt,
    }, { onConflict: 'project_id,stage_key' }).select().single();
    if (saveStageError) throw new ApiError(500, `Failed to save stage: ${saveStageError.message}`);

    const nextStage = getNextStageIndex(body.stageKey, body.action);
    const projectUpdate: Record<string, unknown> = { updated_at: updatedAt };
    if (body.clarification) {
      projectUpdate.idea_summary = body.clarification.ideaSummary;
      projectUpdate.assumptions = body.clarification.assumptions;
    }
    if (body.action === 'approve' || body.action === 'skip') {
      projectUpdate.current_stage = nextStage;
      projectUpdate.overall_status = body.stageKey === 'final_report' && body.action === 'approve'
        ? 'complete'
        : 'in_progress';
    } else {
      projectUpdate.current_stage = nextStage;
    }
    const { error: projectUpdateError } = await db.from('projects')
      .update(projectUpdate)
      .eq('id', project.id);
    if (projectUpdateError) {
      const rollback = existingStage
        ? await db.from('workflow_stages')
            .update({
              status: existingStage.status,
              input_data: existingStage.input_data,
              result_data: existingStage.result_data,
              approved_at: existingStage.approved_at,
              approval_notes: existingStage.approval_notes,
              updated_at: existingStage.updated_at,
            })
            .eq('project_id', project.id)
            .eq('stage_key', body.stageKey)
        : await db.from('workflow_stages')
            .delete()
            .eq('project_id', project.id)
            .eq('stage_key', body.stageKey);
      if (rollback.error) {
        throw new ApiError(500, `Failed to update project progress and rollback stage approval: ${rollback.error.message}`);
      }
      throw new ApiError(500, `Failed to update project progress: ${projectUpdateError.message}`);
    }

    if (clarificationChanged) {
      const { data: downstreamStages, error: downstreamError } = await db
        .from('workflow_stages')
        .select('stage_key, input_data')
        .eq('project_id', project.id)
        .neq('stage_key', 'idea_clarification');
      if (downstreamError) throw new ApiError(500, `Failed to mark dependent findings stale: ${downstreamError.message}`);
      const staleAt = updatedAt;
      for (const downstream of downstreamStages ?? []) {
        const { error } = await db.from('workflow_stages')
          .update({
            input_data: {
              ...((downstream.input_data ?? {}) as Record<string, unknown>),
              stale: true,
              staleAt,
              staleReason: 'Idea clarification changed',
            },
            updated_at: updatedAt,
          })
          .eq('project_id', project.id)
          .eq('stage_key', downstream.stage_key);
        if (error) throw new ApiError(500, `Failed to mark dependent findings stale: ${error.message}`);
      }
    }

    res.json({ success: true, status, currentStage: nextStage, stage: savedStage });
  } catch (err) {
    next(err);
  }
});

export default router;
