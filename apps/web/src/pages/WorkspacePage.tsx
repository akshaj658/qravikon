import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  CheckCircle,
  Circle,
  SkipForward,
  RotateCcw,
  Send,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  History,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  BarChart3,
  TrendingUp,
  Users,
  Target,
  Zap,
  FileText,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';
import { api, ApiError, type CopilotConversation, type MarketSizingEdits, type Project, type WorkflowStage, type Message } from '../lib/api';
import { buildClarificationPayload, readClarificationAnswers } from '../lib/clarification';
import { createDemoCopilotReply, DEMO_PROJECT, DEMO_STAGES, DEMO_MESSAGES } from '../lib/demo';
import { STAGE_LABELS, STAGE_ORDER, STAGE_TRANSITIONS, type StageKey, cn, formatRelativeTime } from '../lib/utils';
import MarketCalculator, { type MarketData } from '../components/MarketCalculator';

function createDemoStages(): WorkflowStage[] {
  return STAGE_ORDER.map(stageKey => {
    const sample = DEMO_STAGES[stageKey];
    return {
      id: `demo-${stageKey}`,
      project_id: 'demo',
      stage_key: stageKey,
      status: sample.status,
      result_data: sample.result,
      updated_at: DEMO_PROJECT.updated_at,
    };
  });
}

const STAGE_GUIDANCE: Record<StageKey, { objective: string; why: string; uses: string; output: string }> = {
  idea_clarification: {
    objective: 'Define the idea, key assumptions, and the customer problem to investigate.',
    why: 'A clear starting point keeps later research focused on the same business hypothesis.',
    uses: 'Your original project description.',
    output: 'A confirmed idea summary and saved clarification answers.',
  },
  viability: {
    objective: 'Assess whether the problem is urgent, painful, and worth solving.',
    why: 'Problem severity is a key signal of whether customers will seek a solution.',
    uses: 'Your approved idea and its assumptions.',
    output: 'A viability assessment, risks, and evidence gaps.',
  },
  target_customer: {
    objective: 'Identify the primary customer and how they currently address the problem.',
    why: 'A specific buyer and user hypothesis makes market and channel research useful.',
    uses: 'The approved idea and clarification answers.',
    output: 'A customer segment, pain points, and willingness-to-pay hypothesis.',
  },
  market_sizing: {
    objective: 'Estimate TAM, SAM, and SOM with transparent assumptions.',
    why: 'A market estimate helps test the scale and reach of this opportunity.',
    uses: 'Your target customer definition.',
    output: 'An interactive market-sizing model.',
  },
  competitors: {
    objective: 'Map direct, indirect, and substitute solutions.',
    why: 'Understanding alternatives reveals customer expectations and open gaps.',
    uses: 'Your target customer and stated problem.',
    output: 'Competitor research, sources, and market gaps.',
  },
  differentiation: {
    objective: 'Find credible ways to stand apart from existing alternatives.',
    why: 'A focused advantage can make a new solution easier to choose.',
    uses: 'Competitor research and target-customer needs.',
    output: 'Differentiation strategies and a recommended position.',
  },
  gtm: {
    objective: 'Plan how to reach early customers and test acquisition.',
    why: 'A practical route to first users makes the idea measurable in the real world.',
    uses: 'Your customer profile and selected differentiation strategy.',
    output: 'Priority channels, first-user steps, and validation milestones.',
  },
  final_report: {
    objective: 'Bring the findings together into a decision-oriented assessment.',
    why: 'The report summarizes evidence, uncertainty, and options for what to do next.',
    uses: 'Saved findings from the previous workflow stages.',
    output: 'A GO, PIVOT, or DROP recommendation with risks and experiments.',
  },
};

// ─── Stage Status indicator ────────────────────────────────────────────────
function StageStatusIcon({ status }: { status: string }) {
  if (status === 'approved') return <CheckCircle className="w-3.5 h-3.5 text-success" />;
  if (status === 'skipped') return <SkipForward className="w-3.5 h-3.5 text-text-disabled" />;
  if (status === 'completed') return <Circle className="w-3.5 h-3.5 text-accent" />;
  if (status === 'needs_revision') return <RotateCcw className="w-3.5 h-3.5 text-warning" />;
  return <Circle className="w-3.5 h-3.5 text-text-disabled" />;
}

// ─── Source Citation ───────────────────────────────────────────────────────
function SourceCitation({ url, title, retrievedAt }: { url: string; title: string; retrievedAt?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
    >
      <ExternalLink className="w-3 h-3" />
      <span className="truncate max-w-[240px]">{title}</span>
      {retrievedAt && <span className="text-text-disabled ml-1">· {formatRelativeTime(retrievedAt)}</span>}
    </a>
  );
}

// ─── Approval Controls ─────────────────────────────────────────────────────
function ApprovalControls({
  stageKey,
  currentStatus,
  onAction,
  loading,
  approvalPending,
  approvalDisabled = false,
  isDemo,
}: {
  stageKey: StageKey;
  currentStatus: string;
  onAction: (action: 'approve' | 'revise' | 'skip', notes?: string) => void;
  loading: boolean;
  approvalPending: boolean;
  approvalDisabled?: boolean;
  isDemo?: boolean;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');

  if (currentStatus === 'approved') {
    return (
      <div className="flex items-center gap-3 pt-4 border-t border-border-subtle">
        <div className="flex items-center gap-1.5 text-sm text-success">
          <CheckCircle className="w-4 h-4" />
          Approved
        </div>
        <button
          className="btn-ghost btn-sm ml-auto"
          onClick={() => onAction('revise')}
          disabled={loading}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reopen
        </button>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-border-subtle">
      {currentStatus === 'needs_revision' && (
        <p className="mb-3 rounded border border-warning/20 bg-warning-subtle p-2 text-xs text-warning">
          Revision requested. Review the sample findings, then approve them or request another revision.
        </p>
      )}
      {showNotes && (
        <div className="mb-3">
          <textarea
            className="textarea h-16 text-xs"
            placeholder="Describe what should change before approval…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          className="btn-primary btn-sm"
          onClick={() => onAction('approve')}
          disabled={loading || approvalDisabled}
          id={`approve-${stageKey}`}
          aria-live="polite"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          {approvalPending
            ? STAGE_TRANSITIONS[stageKey].loadingLabel
            : isDemo
              ? `Approve ${STAGE_LABELS[stageKey]}`
              : STAGE_TRANSITIONS[stageKey].approveLabel}
        </button>
        <button
          className="btn-secondary btn-sm"
          onClick={() => {
            if (showNotes) {
              if (!notes.trim()) return;
              onAction('revise', notes.trim());
              setShowNotes(false);
            } else {
              setShowNotes(true);
            }
          }}
          disabled={loading || (showNotes && !notes.trim())}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {showNotes ? 'Submit revision' : 'Request revision'}
        </button>
        <button
          className="btn-ghost btn-sm ml-auto"
          onClick={() => onAction('skip')}
          disabled={loading}
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip
        </button>
      </div>
    </div>
  );
}

// ─── Stage 1: Idea Clarification ──────────────────────────────────────────
function IdeaClarificationStage({
  project,
  stageData,
  onAction,
  onDirtyChange,
  onGenerate,
  loading,
  approvalPending,
  isDemo,
}: {
  project: Project;
  stageData?: WorkflowStage;
  onAction: (
    action: 'approve' | 'revise' | 'skip' | 'save',
    payload?: { ideaSummary: string; assumptions: string[]; answers: Record<string, string> }
  ) => void;
  onDirtyChange: (dirty: boolean) => void;
  onGenerate: () => void;
  loading: boolean;
  approvalPending: boolean;
  isDemo?: boolean;
}) {
  const result = (stageData?.result_data ?? (isDemo ? DEMO_STAGES.idea_clarification.result : null)) as {
    ideaSummary?: string;
    coreAssumptions?: string[];
    clarificationQuestions?: Array<{ id: string; question: string; why: string }>;
    customerHypothesis?: string;
    businessModelAssumptions?: string[];
  } | null;

  const questionIds = useMemo(
    () => result?.clarificationQuestions?.map(question => question.id) ?? [],
    [result?.clarificationQuestions]
  );
  const savedAnswers = useMemo(
    () => readClarificationAnswers(stageData?.input_data, questionIds),
    [stageData?.input_data, questionIds]
  );
  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [ideaSummary, setIdeaSummary] = useState(result?.ideaSummary ?? project.idea_summary ?? '');
  const [assumptionsText, setAssumptionsText] = useState((result?.coreAssumptions ?? project.assumptions ?? []).join('\n'));
  const [isEditing, setIsEditing] = useState(stageData?.status !== 'approved');
  const savedSummary = (stageData?.result_data?.ideaSummary as string | undefined) ?? result?.ideaSummary ?? project.idea_summary ?? '';
  const savedAssumptions = ((stageData?.result_data?.coreAssumptions as string[] | undefined) ?? result?.coreAssumptions ?? project.assumptions ?? []).join('\n');
  const isDirty = ideaSummary !== savedSummary
    || assumptionsText !== savedAssumptions
    || JSON.stringify(answers) !== JSON.stringify(savedAnswers);

  useEffect(() => {
    setAnswers(savedAnswers);
    setIdeaSummary(result?.ideaSummary ?? project.idea_summary ?? '');
    setAssumptionsText((result?.coreAssumptions ?? project.assumptions ?? []).join('\n'));
    setIsEditing(stageData?.status !== 'approved');
  }, [
    stageData?.updated_at,
    stageData?.status,
    result?.ideaSummary,
    result?.coreAssumptions,
    project.idea_summary,
    project.assumptions,
    savedAnswers,
  ]);

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const preventLeavingWithUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventLeavingWithUnsavedChanges);
    return () => window.removeEventListener('beforeunload', preventLeavingWithUnsavedChanges);
  }, [isDirty]);

  if (!result) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Qravikon will analyze your idea, identify key assumptions, and ask targeted clarification questions.
        </p>
        <div className="p-3 bg-bg-elevated rounded border border-border-default">
          <p className="text-xs text-text-muted font-medium mb-1">Your idea</p>
          <p className="text-sm text-text-primary">{project.original_idea}</p>
        </div>
        <button
          className="btn-primary"
          onClick={onGenerate}
          disabled={loading}
          id="generate-clarification-btn"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Analyze idea
        </button>
        {isDemo && <p className="text-xs text-warning">Sample clarification findings are not available. Reset the demo to restore them.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stageData?.status === 'approved' && !isEditing ? (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="badge badge-success">Approved clarification</span>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setIsEditing(true)}>
              <RotateCcw className="w-3.5 h-3.5" />
              Edit clarification
            </button>
          </div>
          <div>
            <div className="section-label mb-2">Confirmed idea</div>
            <p className="text-sm text-text-primary leading-relaxed bg-bg-elevated rounded p-3 border border-border-default">
              {stageData.result_data?.ideaSummary as string ?? result.ideaSummary}
            </p>
          </div>
          <div>
            <div className="section-label mb-2">Key assumptions</div>
            <ul className="space-y-1.5">
              {((stageData.result_data?.coreAssumptions as string[] | undefined) ?? result.coreAssumptions ?? []).map((assumption, index) => (
                <li key={index} className="flex gap-2 text-sm text-text-secondary">
                  <span className="text-text-disabled mt-0.5">·</span>{assumption}
                </li>
              ))}
            </ul>
          </div>
          {result.clarificationQuestions?.some(question => answers[question.id]?.trim()) && (
            <div>
              <div className="section-label mb-2">Saved answers</div>
              <div className="space-y-3">
                {result.clarificationQuestions.filter(question => answers[question.id]?.trim()).map(question => (
                  <div key={question.id}>
                    <p className="text-xs font-medium text-text-secondary">{question.question}</p>
                    <p className="text-sm text-text-primary mt-1">{answers[question.id]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.customerHypothesis && (
            <div>
              <div className="section-label mb-2">Customer hypothesis</div>
              <p className="text-sm text-text-secondary">{result.customerHypothesis}</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {stageData?.status === 'approved' && isEditing && (
            <p className="text-xs text-warning border-l-2 border-warning pl-3">
              You are modifying previously approved information. Save or approve your changes before leaving this stage.
            </p>
          )}
          <div>
            <label className="section-label mb-2 block" htmlFor="clarification-idea">Idea statement</label>
            <textarea
              id="clarification-idea"
              className="textarea min-h-20 text-sm"
              value={ideaSummary}
              onChange={event => setIdeaSummary(event.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label className="section-label mb-2 block" htmlFor="clarification-assumptions">Core assumptions</label>
            <textarea
              id="clarification-assumptions"
              className="textarea min-h-24 text-sm"
              value={assumptionsText}
              onChange={event => setAssumptionsText(event.target.value)}
              disabled={loading}
              aria-describedby="assumption-hint"
            />
            <p id="assumption-hint" className="text-2xs text-text-muted mt-1">Use one assumption per line.</p>
          </div>

          {result.clarificationQuestions && result.clarificationQuestions.length > 0 && (
        <div>
          <div className="section-label mb-3">Clarification questions</div>
          <div className="space-y-4">
            {result.clarificationQuestions.map((q) => (
              <div key={q.id}>
                <p className="text-sm font-medium text-text-primary mb-1">{q.question}</p>
                <p className="text-xs text-text-muted mb-2">{q.why}</p>
                <textarea
                  className="textarea h-16 text-sm"
                  aria-label={q.question}
                  placeholder="Your answer…"
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  disabled={loading}
                />
              </div>
            ))}
          </div>
        </div>
      )}

          {result.customerHypothesis && (
            <div>
              <div className="section-label mb-2">Customer hypothesis</div>
              <p className="text-sm text-text-secondary">{result.customerHypothesis}</p>
            </div>
          )}
          {isDemo && <p className="text-xs text-text-muted">Demo changes stay in this browser session and are not saved to a project.</p>}
          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
            <button
              className="btn-primary btn-sm"
              onClick={() => onAction('approve', buildClarificationPayload(ideaSummary, assumptionsText, answers, questionIds))}
              disabled={loading || !ideaSummary.trim()}
              aria-live="polite"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {approvalPending
                ? STAGE_TRANSITIONS.idea_clarification.loadingLabel
                : STAGE_TRANSITIONS.idea_clarification.approveLabel}
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => onAction('save', buildClarificationPayload(ideaSummary, assumptionsText, answers, questionIds))}
              disabled={loading}
            >
              Save Progress
            </button>
            <button
              className="btn-ghost btn-sm ml-auto"
              onClick={() => onAction('skip', buildClarificationPayload(ideaSummary, assumptionsText, answers, questionIds))}
              disabled={loading}
            >
              <SkipForward className="w-3.5 h-3.5" />
              Skip
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type ClarificationEdits = {
  ideaSummary: string;
  assumptions: string[];
  answers: Record<string, string>;
};

function isClarificationEdits(
  payload: string | ClarificationEdits | MarketSizingEdits | undefined
): payload is ClarificationEdits {
  return typeof payload === 'object' && payload !== null && 'ideaSummary' in payload;
}

function isMarketSizingEdits(
  payload: string | ClarificationEdits | MarketSizingEdits | undefined
): payload is MarketSizingEdits {
  return typeof payload === 'object'
    && payload !== null
    && 'calculations' in payload
    && 'scenarios' in payload;
}

// ─── Stage 2: Viability ────────────────────────────────────────────────────
function ViabilityStage({
  stageData,
  onAction,
  onGenerate,
  loading,
  approvalPending,
  isDemo,
}: {
  stageData?: WorkflowStage;
  onAction: (action: 'approve' | 'revise' | 'skip') => void;
  onGenerate: () => void;
  loading: boolean;
  approvalPending: boolean;
  isDemo?: boolean;
}) {
  const result = (stageData?.result_data ?? (isDemo ? DEMO_STAGES.viability.result : null)) as {
    problemSeverity?: number;
    vitaminOrPainkiller?: string;
    vitaminOrPainkillerReason?: string;
    currentWorkarounds?: string[];
    topRisksOfFailure?: string[];
    viabilityScore?: number;
    viabilityRationale?: string;
    confidence?: string;
    uncertainties?: string[];
    disclaimer?: string;
  } | null;

  if (!result) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">
          Evaluate problem severity, urgency, current workarounds, and overall viability.
        </p>
        <button className="btn-primary" onClick={onGenerate} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          Run viability analysis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="bg-bg-elevated rounded p-4 border border-border-default">
          <div className="text-2xs text-text-muted mb-1">Problem severity</div>
          <div className="text-3xl font-semibold text-text-primary">{result.problemSeverity}<span className="text-base text-text-muted">/10</span></div>
        </div>
        <div className="bg-bg-elevated rounded p-4 border border-border-default">
          <div className="text-2xs text-text-muted mb-1">Viability score</div>
          <div className="flex items-end gap-1">
            <div className="text-3xl font-semibold text-text-primary">{result.viabilityScore}<span className="text-base text-text-muted">/10</span></div>
            <span className={`badge mb-1 ml-1 ${result.confidence === 'high' ? 'badge-success' : result.confidence === 'medium' ? 'badge-warning' : 'badge-danger'}`}>
              {result.confidence} confidence
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="section-label">Classification</div>
          <span className={`badge ${result.vitaminOrPainkiller === 'painkiller' ? 'badge-success' : result.vitaminOrPainkiller === 'vitamin' ? 'badge-warning' : 'badge-default'}`}>
            {result.vitaminOrPainkiller}
          </span>
        </div>
        <p className="text-sm text-text-secondary">{result.vitaminOrPainkillerReason}</p>
      </div>

      <div>
        <div className="section-label mb-2">Current workarounds</div>
        <ul className="space-y-1">
          {result.currentWorkarounds?.map((w, i) => (
            <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-text-disabled">·</span>{w}</li>
          ))}
        </ul>
      </div>

      <div>
        <div className="section-label mb-2">Top risks of failure</div>
        <ul className="space-y-1">
          {result.topRisksOfFailure?.map((r, i) => (
            <li key={i} className="text-sm text-danger flex gap-2"><span>·</span>{r}</li>
          ))}
        </ul>
      </div>

      <div>
        <div className="section-label mb-2">Rationale</div>
        <p className="text-sm text-text-secondary">{result.viabilityRationale}</p>
      </div>

      {result.disclaimer && (
        <p className="text-xs text-text-disabled border-t border-border-subtle pt-3">{result.disclaimer}</p>
      )}

      <ApprovalControls
        stageKey="viability"
        currentStatus={stageData?.status ?? (isDemo ? 'approved' : 'completed')}
        onAction={onAction}
        loading={loading}
        approvalPending={approvalPending}
        isDemo={isDemo}
      />
    </div>
  );
}

// ─── Stage 3: Target Customer ─────────────────────────────────────────────
function TargetCustomerStage({
  stageData,
  onAction,
  onGenerate,
  loading,
  approvalPending,
  isDemo,
}: {
  stageData?: WorkflowStage;
  onAction: (action: 'approve' | 'revise' | 'skip') => void;
  onGenerate: () => void;
  loading: boolean;
  approvalPending: boolean;
  isDemo?: boolean;
}) {
  const result = (stageData?.result_data ?? (isDemo ? DEMO_STAGES.target_customer.result : null)) as {
    primarySegment?: string;
    buyerVsUser?: string;
    characteristics?: string[];
    painPoints?: string[];
    existingAlternatives?: string[];
    onlineCommunities?: string[];
    acquisitionChannels?: string[];
    willingnessToPay?: { estimate?: string; reasoning?: string; confidence?: string; disclaimer?: string };
    assumptions?: string[];
  } | null;

  if (!result) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">Identify who your primary customer is, where to reach them, and how much they'll pay.</p>
        <button className="btn-primary" onClick={onGenerate} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          Identify target customer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="section-label mb-1">Primary segment</div>
        <p className="text-sm font-medium text-text-primary">{result.primarySegment}</p>
      </div>
      <div>
        <div className="section-label mb-1">Buyer vs. user</div>
        <p className="text-sm text-text-secondary">{result.buyerVsUser}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="section-label mb-2">Characteristics</div>
          <ul className="space-y-1">
            {result.characteristics?.map((c, i) => (
              <li key={i} className="text-xs text-text-secondary flex gap-1.5"><span className="text-text-disabled">·</span>{c}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="section-label mb-2">Pain points</div>
          <ul className="space-y-1">
            {result.painPoints?.map((p, i) => (
              <li key={i} className="text-xs text-text-secondary flex gap-1.5"><span className="text-text-disabled">·</span>{p}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <div className="section-label mb-2">Acquisition channels</div>
        <div className="flex flex-wrap gap-1.5">
          {result.acquisitionChannels?.map((c, i) => (
            <span key={i} className="badge badge-accent">{c}</span>
          ))}
        </div>
      </div>

      {result.existingAlternatives && result.existingAlternatives.length > 0 && (
        <div>
          <div className="section-label mb-2">Existing alternatives</div>
          <ul className="space-y-1">
            {result.existingAlternatives.map((alternative, index) => (
              <li key={index} className="flex gap-1.5 text-xs text-text-secondary">
                <span className="text-text-disabled">·</span>{alternative}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.onlineCommunities && result.onlineCommunities.length > 0 && (
        <div>
          <div className="section-label mb-2">Where customers gather</div>
          <div className="flex flex-wrap gap-1.5">
            {result.onlineCommunities.map((community, index) => (
              <span key={index} className="badge badge-default">{community}</span>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 bg-bg-elevated rounded border border-border-default">
        <div className="section-label mb-1">Willingness to pay</div>
        <div className="text-lg font-semibold text-text-primary mb-1">{result.willingnessToPay?.estimate}</div>
        <p className="text-xs text-text-secondary mb-2">{result.willingnessToPay?.reasoning}</p>
        {result.willingnessToPay?.disclaimer && (
          <p className="text-2xs text-text-disabled">{result.willingnessToPay.disclaimer}</p>
        )}
      </div>

      {result.assumptions && result.assumptions.length > 0 && (
        <div>
          <div className="section-label mb-2 text-warning">Unverified assumptions</div>
          <ul className="space-y-1">
            {result.assumptions.map((a, i) => (
              <li key={i} className="text-xs text-text-secondary flex gap-1.5"><span className="text-warning">·</span>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <ApprovalControls
        stageKey="target_customer"
        currentStatus={stageData?.status ?? (isDemo ? 'approved' : 'completed')}
        onAction={onAction}
        loading={loading}
        approvalPending={approvalPending}
        isDemo={isDemo}
      />
    </div>
  );
}

// ─── Stage 4: Market Sizing ────────────────────────────────────────────────
function toMarketSizingEdits(data: MarketData): MarketSizingEdits {
  return {
    assumptions: data.assumptions,
    calculations: data.calculations,
    scenarios: data.scenarios,
  };
}

function MarketSizingStage({
  stageData,
  onAction,
  onGenerate,
  loading,
  approvalPending,
  isDemo,
}: {
  stageData?: WorkflowStage;
  onAction: (action: 'approve' | 'revise' | 'skip', payload?: string | MarketSizingEdits) => void;
  onGenerate: () => void;
  loading: boolean;
  approvalPending: boolean;
  isDemo?: boolean;
}) {
  const result = stageData?.result_data ?? (isDemo ? DEMO_STAGES.market_sizing.result : null);
  const [marketSizingEdits, setMarketSizingEdits] = useState<MarketSizingEdits | undefined>(
    () => result ? toMarketSizingEdits(result as MarketData) : undefined
  );
  const [marketSizingValid, setMarketSizingValid] = useState(true);

  useEffect(() => {
    if (!result) return;
    setMarketSizingEdits(toMarketSizingEdits(result as MarketData));
    setMarketSizingValid(true);
  }, [result, stageData?.updated_at]);

  if (!result) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">Calculate TAM, SAM, and SOM with interactive assumptions.</p>
        <button className="btn-primary" onClick={onGenerate} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          Generate market sizing
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MarketCalculator
        initialData={result as MarketData}
        onChange={setMarketSizingEdits}
        onValidityChange={setMarketSizingValid}
      />
      <ApprovalControls
        stageKey="market_sizing"
        currentStatus={stageData?.status ?? (isDemo ? 'approved' : 'completed')}
        onAction={(action, notes) => onAction(action, action === 'approve' ? marketSizingEdits : notes)}
        loading={loading}
        approvalPending={approvalPending}
        approvalDisabled={!marketSizingValid}
        isDemo={isDemo}
      />
    </div>
  );
}

// ─── Stage 5: Competitors ─────────────────────────────────────────────────
function CompetitorsStage({
  stageData,
  onAction,
  onGenerate,
  loading,
  approvalPending,
  isDemo,
}: {
  stageData?: WorkflowStage;
  onAction: (action: 'approve' | 'revise' | 'skip') => void;
  onGenerate: () => void;
  loading: boolean;
  approvalPending: boolean;
  isDemo?: boolean;
}) {
  const result = (stageData?.result_data ?? (isDemo ? DEMO_STAGES.competitors.result : null)) as {
    competitors?: Array<{
      name: string;
      type: string;
      description: string;
      positioning: string;
      keyFeatures: string[];
      pricing: string;
      pricingVerified: boolean;
      customerComplaints: string[];
      source?: { url: string; title: string; retrievedAt: string };
    }>;
    marketGaps?: string[];
    competitiveDynamics?: string;
    disclaimer?: string;
  } | null;

  const typeLabel: Record<string, string> = {
    direct: 'Direct',
    indirect: 'Indirect',
    manual: 'Manual workaround',
    spreadsheet: 'Spreadsheet',
    opensource: 'Open source',
  };

  if (!result) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">Find real competitors, pricing, and customer feedback using live web search.</p>
        <button className="btn-primary" onClick={onGenerate} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Research competitors
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {result.competitors?.map((c, i) => (
          <div key={i} className="border border-border-default rounded-md p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-text-primary">{c.name}</span>
                  <span className="badge badge-default">{typeLabel[c.type] ?? c.type}</span>
                </div>
                <p className="text-xs text-text-secondary">{c.description}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <div className="text-sm font-medium text-text-primary">{c.pricing}</div>
                {!c.pricingVerified && <span className="text-2xs text-warning">Unverified</span>}
              </div>
            </div>
            <p className="text-xs text-text-muted mb-2">{c.positioning}</p>
            {c.customerComplaints.length > 0 && (
              <div className="mt-2">
                <span className="text-2xs text-text-disabled font-medium">Customer complaints: </span>
                <span className="text-xs text-text-muted">{c.customerComplaints.join(' · ')}</span>
              </div>
            )}
            {c.source && (
              <div className="mt-2">
                <SourceCitation url={c.source.url} title={c.source.title} retrievedAt={c.source.retrievedAt} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div>
        <div className="section-label mb-2">Market gaps</div>
        <ul className="space-y-1">
          {result.marketGaps?.map((g, i) => (
            <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-success">+</span>{g}</li>
          ))}
        </ul>
      </div>

      <div>
        <div className="section-label mb-1">Competitive dynamics</div>
        <p className="text-sm text-text-secondary">{result.competitiveDynamics}</p>
      </div>

      {result.disclaimer && (
        <p className="text-xs text-text-disabled border-t border-border-subtle pt-3">{result.disclaimer}</p>
      )}

      <ApprovalControls
        stageKey="competitors"
        currentStatus={stageData?.status ?? (isDemo ? 'approved' : 'completed')}
        onAction={onAction}
        loading={loading}
        approvalPending={approvalPending}
        isDemo={isDemo}
      />
    </div>
  );
}

// ─── Stage 6: Differentiation ─────────────────────────────────────────────
function DifferentiationStage({
  stageData,
  onAction,
  onGenerate,
  onSelectStrategy,
  loading,
  approvalPending,
  isDemo,
}: {
  stageData?: WorkflowStage;
  onAction: (action: 'approve' | 'revise' | 'skip') => void;
  onGenerate: () => void;
  onSelectStrategy: (id: string) => void;
  loading: boolean;
  approvalPending: boolean;
  isDemo?: boolean;
}) {
  const result = (stageData?.result_data ?? (isDemo ? DEMO_STAGES.differentiation.result : null)) as {
    strategies?: Array<{
      id: string;
      name: string;
      description: string;
      positioning: string;
      pros: string[];
      cons: string[];
      risks: string[];
    }>;
    recommendedStrategyId?: string;
    recommendationRationale?: string;
  } | null;

  const selectedId = (stageData?.input_data as { selectedStrategyId?: string })?.selectedStrategyId
    ?? result?.recommendedStrategyId;
  const [localSelected, setLocalSelected] = useState(selectedId ?? '');

  if (!result) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">Develop 2-3 differentiation strategies based on competitor research.</p>
        <button className="btn-primary" onClick={onGenerate} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
          Generate strategies
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {result.strategies?.map((s) => (
          <div
            key={s.id}
            className={cn(
              'border rounded-md p-4 cursor-pointer transition-all duration-150',
              localSelected === s.id
                ? 'border-accent bg-accent-subtle'
                : 'border-border-default hover:border-border-muted'
            )}
            onClick={() => {
              setLocalSelected(s.id);
              onSelectStrategy(s.id);
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text-primary">{s.name}</span>
              {s.id === result.recommendedStrategyId && (
                <span className="badge badge-accent">Recommended</span>
              )}
            </div>
            <p className="text-xs text-text-secondary mb-3">{s.description}</p>
            <p className="text-xs text-text-muted italic mb-3">"{s.positioning}"</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-2xs text-success font-medium mb-1">Pros</div>
                {s.pros.map((p, i) => <p key={i} className="text-xs text-text-secondary">+ {p}</p>)}
              </div>
              <div>
                <div className="text-2xs text-danger font-medium mb-1">Risks</div>
                {s.risks.map((r, i) => <p key={i} className="text-xs text-text-secondary">− {r}</p>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {result.recommendationRationale && (
        <div className="p-3 bg-bg-elevated rounded border border-border-default">
          <div className="text-2xs text-text-muted font-medium mb-1">Recommendation rationale</div>
          <p className="text-sm text-text-secondary">{result.recommendationRationale}</p>
        </div>
      )}

      <ApprovalControls
        stageKey="differentiation"
        currentStatus={stageData?.status ?? (isDemo ? 'approved' : 'completed')}
        onAction={onAction}
        loading={loading}
        approvalPending={approvalPending}
        isDemo={isDemo}
      />
    </div>
  );
}

// ─── Stage 7: Go-to-Market ────────────────────────────────────────────────
function GtmStage({
  stageData,
  onAction,
  onGenerate,
  loading,
  approvalPending,
  isDemo,
}: {
  stageData?: WorkflowStage;
  onAction: (action: 'approve' | 'revise' | 'skip') => void;
  onGenerate: () => void;
  loading: boolean;
  approvalPending: boolean;
  isDemo?: boolean;
}) {
  const result = (stageData?.result_data ?? (isDemo ? DEMO_STAGES.gtm.result : null)) as {
    channels?: Array<{ name: string; type: string; rationale: string; estimatedCac: string; priority: number }>;
    first100Usersplan?: { weeks1to2: string[]; weeks3to4: string[]; months2to3: string[] };
    outreachExperiments?: Array<{ name: string; description: string; successCriteria: string; timeframe: string }>;
    validationMilestones?: Array<{ milestone: string; metric: string; target: string }>;
    disclaimer?: string;
  } | null;

  if (!result) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">Plan acquisition channels, first 100 users strategy, and validation milestones.</p>
        <button className="btn-primary" onClick={onGenerate} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          Generate GTM plan
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="section-label mb-3">Acquisition channels</div>
        <div className="space-y-2">
          {result.channels?.sort((a, b) => a.priority - b.priority).map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-bg-elevated rounded border border-border-default">
              <span className="text-xs font-mono text-text-disabled w-4 flex-shrink-0 mt-0.5">{String(c.priority).padStart(2, '0')}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-text-primary">{c.name}</span>
                  <span className="badge badge-default">{c.type}</span>
                </div>
                <p className="text-xs text-text-secondary">{c.rationale}</p>
              </div>
              <div className="text-xs text-text-muted text-right flex-shrink-0">
                <div>CAC ~{c.estimatedCac}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-label mb-3">First 100 users plan</div>
        {[
          { label: 'Weeks 1–2', items: result.first100Usersplan?.weeks1to2 },
          { label: 'Weeks 3–4', items: result.first100Usersplan?.weeks3to4 },
          { label: 'Months 2–3', items: result.first100Usersplan?.months2to3 },
        ].map(({ label, items }) => (
          <div key={label} className="mb-3">
            <div className="text-xs font-medium text-text-secondary mb-1">{label}</div>
            <ul className="space-y-0.5">
              {items?.map((item, i) => (
                <li key={i} className="text-xs text-text-muted flex gap-2"><span>·</span>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div>
        <div className="section-label mb-2">Validation milestones</div>
        <div className="space-y-2">
          {result.validationMilestones?.map((m, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <Circle className="w-3 h-3 text-text-disabled flex-shrink-0" />
              <span className="text-text-secondary">{m.milestone}</span>
              <span className="text-text-muted ml-auto text-xs">{m.target}</span>
            </div>
          ))}
        </div>
      </div>

      {result.disclaimer && (
        <p className="text-xs text-text-disabled border-t border-border-subtle pt-3">{result.disclaimer}</p>
      )}

      {stageData?.status === 'needs_revision' && (
        <div className="flex items-center justify-between gap-3 border border-warning/20 bg-warning-subtle rounded p-3">
          <p className="text-xs text-text-secondary">
            {isDemo
              ? 'Revision noted in this sandbox. The sample plan remains available to review; approve it or choose another stage.'
              : 'Revision requested. Your current plan is preserved until a replacement is generated and saved.'}
          </p>
          {!isDemo && (
            <button className="btn-primary btn-sm flex-shrink-0" onClick={onGenerate} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Generate revision
            </button>
          )}
        </div>
      )}

      <ApprovalControls
        stageKey="gtm"
        currentStatus={stageData?.status ?? (isDemo ? 'completed' : 'completed')}
        onAction={onAction}
        loading={loading}
        approvalPending={approvalPending}
        isDemo={isDemo}
      />
    </div>
  );
}

// ─── Stage 8: Final Report ────────────────────────────────────────────────
function FinalReportStage({
  stageData,
  onGenerate,
  loading,
  isDemo,
}: {
  stageData?: WorkflowStage;
  onGenerate: () => void;
  loading: boolean;
  isDemo?: boolean;
}) {
  const result = stageData?.result_data as {
    executiveSummary?: string;
    verdict?: string;
    verdictReason?: string;
    verdictConfidence?: string;
    problemAndCustomer?: string;
    marketOpportunity?: string;
    marketAssumptions?: string[];
    competitorAnalysis?: string;
    differentiationStrategy?: string;
    goToMarketStrategy?: string;
    whatCouldChangeVerdict?: string;
    keyRisks?: string[];
    validationMilestones?: Array<{ milestone: string; target: string }>;
    recommendedNextSteps?: string[];
    unvalidatedAssumptions?: string[];
    workflowLimitations?: string[];
    stageStatuses?: Array<{ stageKey: string; status: string; stale: boolean }>;
    recommendedExperiments?: Array<{ experiment: string; hypothesis: string; successCriteria: string }>;
    landingPageCopy?: { headline: string; subheadline: string; cta: string; targetAudience: string };
  } | null;

  if (!result) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">
          Generate your final GO / PIVOT / DROP verdict with full rationale, risk analysis, and landing page copy.
        </p>
        {!isDemo && (
          <button className="btn-primary" onClick={onGenerate} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate final report
          </button>
        )}
        {isDemo && <p className="text-xs text-danger" role="alert">The sample report is unavailable. Reset the demo to restore the complete example.</p>}
      </div>
    );
  }

  const verdictColors = {
    GO: 'text-success border-success/30 bg-success-subtle',
    PIVOT: 'text-warning border-warning/30 bg-warning-subtle',
    DROP: 'text-danger border-danger/30 bg-danger-subtle',
  };

  return (
    <article className="space-y-6 break-words">
      <div className={cn('p-5 rounded border', verdictColors[result.verdict as keyof typeof verdictColors] ?? 'border-border-default bg-bg-elevated')}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-2xs font-medium opacity-60 mb-1">Verdict</div>
            <div className="text-4xl font-bold">{result.verdict}</div>
          </div>
          <div className="text-right">
            <div className="text-2xs opacity-60 mb-1">Confidence</div>
            <div className="text-sm font-medium">{result.verdictConfidence}</div>
          </div>
        </div>
        <p className="text-sm opacity-80 leading-relaxed">{result.verdictReason}</p>
      </div>

      <div>
        <div className="section-label mb-2">Executive summary</div>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{result.executiveSummary}</p>
      </div>

      {result.problemAndCustomer && (
        <section>
          <h3 className="section-label mb-2">Problem and target customer</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{result.problemAndCustomer}</p>
        </section>
      )}

      {result.marketOpportunity && (
        <section>
          <h3 className="section-label mb-2">Market opportunity</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{result.marketOpportunity}</p>
          {result.marketAssumptions && (
            <ul className="mt-2 space-y-1">
              {result.marketAssumptions.map((assumption, index) => (
                <li key={index} className="text-xs text-text-muted leading-relaxed">· {assumption}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {result.competitorAnalysis && (
        <section>
          <h3 className="section-label mb-2">Competitor analysis</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{result.competitorAnalysis}</p>
        </section>
      )}

      {result.differentiationStrategy && (
        <section>
          <h3 className="section-label mb-2">Differentiation strategy</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{result.differentiationStrategy}</p>
        </section>
      )}

      {result.goToMarketStrategy && (
        <section>
          <h3 className="section-label mb-2">Go-to-market strategy</h3>
          <p className="text-sm text-text-secondary leading-relaxed">{result.goToMarketStrategy}</p>
        </section>
      )}

      <div>
        <div className="section-label mb-2 text-warning">What could change this verdict</div>
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{result.whatCouldChangeVerdict}</p>
      </div>

      {result.validationMilestones && (
        <section>
          <h3 className="section-label mb-2">Validation milestones</h3>
          <ul className="space-y-2">
            {result.validationMilestones.map((milestone, index) => (
              <li key={index} className="border-l-2 border-accent/40 pl-3">
                <p className="text-sm text-text-primary">{milestone.milestone}</p>
                <p className="text-xs text-text-muted mt-0.5">{milestone.target}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.recommendedNextSteps && (
        <section>
          <h3 className="section-label mb-2">Recommended next steps</h3>
          <ol className="list-decimal space-y-1.5 pl-5">
            {result.recommendedNextSteps.map((step, index) => (
              <li key={index} className="text-sm text-text-secondary leading-relaxed">{step}</li>
            ))}
          </ol>
        </section>
      )}

      <div>
        <div className="section-label mb-2">Key risks</div>
        <ul className="space-y-1">
          {result.keyRisks?.map((r, i) => (
            <li key={i} className="text-sm text-text-secondary flex gap-2 leading-relaxed"><span className="text-danger flex-shrink-0">·</span><span>{r}</span></li>
          ))}
        </ul>
      </div>

      {result.workflowLimitations && result.workflowLimitations.length > 0 && (
        <div className="border border-warning/20 bg-warning-subtle rounded p-3">
          <div className="section-label text-warning mb-2">Workflow limitations</div>
          <ul className="space-y-1">
            {result.workflowLimitations.map((limitation, index) => (
              <li key={index} className="text-xs text-text-secondary">· {limitation}</li>
            ))}
          </ul>
        </div>
      )}

      {result.unvalidatedAssumptions && result.unvalidatedAssumptions.length > 0 && (
        <section>
          <h3 className="section-label mb-2">Unvalidated assumptions</h3>
          <ul className="space-y-1">
            {result.unvalidatedAssumptions.map((assumption, index) => (
              <li key={index} className="text-sm text-text-secondary flex gap-2 leading-relaxed">
                <span className="text-warning flex-shrink-0">·</span><span>{assumption}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.stageStatuses && (
        <div>
          <div className="section-label mb-2">Workflow status</div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {result.stageStatuses.map(stage => (
              <li key={stage.stageKey} className="text-xs text-text-secondary flex justify-between gap-2">
                <span>{STAGE_LABELS[stage.stageKey as StageKey] ?? stage.stageKey.replace(/_/g, ' ')}</span>
                <span className={stage.stale || stage.status !== 'approved' ? 'text-warning' : 'text-success'}>
                  {stage.stale ? 'potentially stale' : stage.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.recommendedExperiments && result.recommendedExperiments.length > 0 && (
        <section>
          <h3 className="section-label mb-2">Recommended experiments</h3>
          <ul className="space-y-3">
            {result.recommendedExperiments.map((experiment, index) => (
              <li key={index} className="border-l-2 border-accent/40 pl-3">
                <p className="text-sm text-text-primary leading-relaxed">{experiment.experiment}</p>
                {experiment.hypothesis && <p className="text-xs text-text-secondary mt-1">{experiment.hypothesis}</p>}
                {experiment.successCriteria && <p className="text-xs text-text-muted mt-1">Success: {experiment.successCriteria}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.landingPageCopy && (
        <div className="p-4 border border-border-default rounded-md bg-bg-elevated">
          <div className="section-label mb-3">Landing page copy</div>
          <p className="text-lg font-semibold text-text-primary mb-1">{result.landingPageCopy.headline}</p>
          <p className="text-sm text-text-secondary mb-3">{result.landingPageCopy.subheadline}</p>
          <p className="text-xs text-text-muted">
            Audience: <span className="text-text-secondary">{result.landingPageCopy.targetAudience}</span>
          </p>
          <p className="text-xs text-text-muted mt-1">
            Call to action: <span className="text-text-secondary">{result.landingPageCopy.cta}</span>
          </p>
        </div>
      )}
    </article>
  );
}

// ─── Copilot Panel ─────────────────────────────────────────────────────────
function conversationGroup(updatedAt: string): string {
  const date = new Date(updatedAt);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const age = todayStart - dateStart;
  if (age <= 0) return 'Today';
  return age < 7 * 24 * 60 * 60 * 1000 ? 'Previous 7 Days' : 'Older';
}

function conversationTimestamp(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function CopilotPanel({
  projectId,
  isDemo,
  activeStage,
}: {
  projectId: string;
  isDemo?: boolean;
  activeStage: StageKey;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(!isDemo);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingError, setSendingError] = useState<string | null>(null);
  const [retryDemoQuestion, setRetryDemoQuestion] = useState<string | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const streamingContentRef = useRef('');
  const activeConversationRef = useRef<string | null>(null);
  const operationRef = useRef(0);
  const sendingRef = useRef(false);
  const sendControllerRef = useRef<AbortController | null>(null);

  const openConversation = useCallback(async (conversationId: string) => {
    if (sendingRef.current) return;
    const operationId = ++operationRef.current;
    setLoadingMessages(true);
    setHistoryError(null);
    setSendingError(null);
    shouldAutoScrollRef.current = true;
    try {
      const { conversation, messages: history } = await api.chat.getConversation(projectId, conversationId);
      if (operationId !== operationRef.current) return;
      activeConversationRef.current = conversation.id;
      setActiveConversationId(conversation.id);
      setMessages(history);
      setConversations(prev => [conversation, ...prev.filter(item => item.id !== conversation.id)]);
      try {
        window.localStorage.setItem(`qravikon:${projectId}:copilotConversation`, conversation.id);
      } catch {
        setHistoryError('Conversation opened, but the selected conversation could not be saved in this browser.');
      }
    } catch (err) {
      if (operationId === operationRef.current) setHistoryError(err instanceof Error ? err.message : 'Failed to load this conversation.');
    } finally {
      if (operationId === operationRef.current) setLoadingMessages(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const operationId = ++operationRef.current;
    activeConversationRef.current = null;
    setActiveConversationId(null);
    setConversations([]);
    setHasMoreConversations(false);
    setMessages([]);
    setHistoryError(null);
    if (isDemo) {
      setMessages(DEMO_MESSAGES as Message[]);
      setLoadingConversations(false);
      return () => {
        cancelled = true;
        operationRef.current += 1;
        sendControllerRef.current?.abort();
      };
    }
    setLoadingConversations(true);
    async function initialize() {
      try {
        const { conversations: loaded, hasMore } = await api.chat.listConversations(projectId);
        if (cancelled || operationRef.current !== operationId) return;
        setConversations(loaded);
        setHasMoreConversations(hasMore);
        let savedId: string | null = null;
        try {
          savedId = window.localStorage.getItem(`qravikon:${projectId}:copilotConversation`);
        } catch {
          setHistoryError('Conversation selection cannot be saved in this browser.');
        }
        const selected = loaded.find(conversation => conversation.id === savedId) ?? loaded[0];
        if (selected) {
          await openConversation(selected.id);
        } else {
          const { conversation } = await api.chat.createConversation(projectId);
          if (cancelled || operationRef.current !== operationId) return;
          setConversations([conversation]);
          await openConversation(conversation.id);
        }
      } catch (err) {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : 'Failed to load Copilot history.');
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      operationRef.current += 1;
      sendControllerRef.current?.abort();
    };
  }, [projectId, isDemo, openConversation]);

  async function createConversation() {
    if (isDemo || sendingRef.current || loadingConversations) return;
    setHistoryError(null);
    try {
      const { conversation } = await api.chat.createConversation(projectId);
      setConversations(prev => [conversation, ...prev].slice(0, 100));
      activeConversationRef.current = conversation.id;
      setActiveConversationId(conversation.id);
      setMessages([]);
      setSendingError(null);
      setHistoryOpen(false);
      try {
        window.localStorage.setItem(`qravikon:${projectId}:copilotConversation`, conversation.id);
      } catch {
        setHistoryError('Conversation created, but the selected conversation could not be saved in this browser.');
      }
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to create a conversation.');
    }
  }

  async function renameConversation(conversationId: string) {
    if (!titleDraft.trim()) return;
    try {
      const { conversation } = await api.chat.renameConversation(projectId, conversationId, titleDraft.trim());
      setConversations(prev => prev.map(item => item.id === conversationId ? conversation : item));
      setEditingConversationId(null);
      setTitleDraft('');
      setOpenMenuId(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to rename conversation.');
    }
  }

  async function deleteConversation(conversation: CopilotConversation) {
    if (!window.confirm(`Permanently delete "${conversation.title}" and its messages? Project research and workflow findings will remain.`)) return;
    try {
      await api.chat.deleteConversation(projectId, conversation.id);
      const remaining = conversations.filter(item => item.id !== conversation.id);
      setConversations(remaining);
      setOpenMenuId(null);
      if (activeConversationId !== conversation.id) return;
      activeConversationRef.current = null;
      setActiveConversationId(null);
      setMessages([]);
      try {
        window.localStorage.removeItem(`qravikon:${projectId}:copilotConversation`);
      } catch {
        setHistoryError('Conversation deleted, but the saved selection could not be cleared in this browser.');
      }
      if (remaining[0]) {
        await openConversation(remaining[0].id);
      } else {
        const { conversation: nextConversation } = await api.chat.createConversation(projectId);
        setConversations([nextConversation]);
        activeConversationRef.current = nextConversation.id;
        setActiveConversationId(nextConversation.id);
        try {
          window.localStorage.setItem(`qravikon:${projectId}:copilotConversation`, nextConversation.id);
        } catch {
          setHistoryError('Conversation created, but the selected conversation could not be saved in this browser.');
        }
      }
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to delete conversation.');
    }
  }

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !shouldAutoScrollRef.current) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent]);

  async function handleSend() {
    if (!input.trim() || streaming || sendingRef.current || loadingMessages) return;
    const question = input.trim();
    if (isDemo) {
      setInput('');
      await sendDemoQuestion(question, true);
      return;
    }
    if (!activeConversationId) return;
    const conversationId = activeConversationId;
    const operationId = ++operationRef.current;
    const controller = new AbortController();
    sendControllerRef.current = controller;
    sendingRef.current = true;
    setInput('');
    setStreaming(true);
    setSendingError(null);
    setStreamingContent('');
    streamingContentRef.current = '';

    try {
      await api.chat.streamMessage(
        projectId,
        conversationId,
        question,
        (chunk) => setStreamingContent(prev => {
          const next = prev + chunk;
          streamingContentRef.current = next;
          return next;
        }),
        controller.signal
      );
      if (operationId !== operationRef.current || activeConversationRef.current !== conversationId) return;
      const responseContent = streamingContentRef.current;
      const timestamp = new Date().toISOString();
      setMessages(prev => [
        ...prev,
        {
          id: `${Date.now()}-user`,
          project_id: projectId,
          user_id: '',
          conversation_id: conversationId,
          role: 'user',
          content: question,
          created_at: timestamp,
        },
        ...(responseContent ? [{
          id: `${Date.now()}-assistant`,
          project_id: projectId,
          user_id: '',
          conversation_id: conversationId,
          role: 'assistant' as const,
          content: responseContent,
          created_at: timestamp,
        }] : []),
      ]);
      setConversations(prev => prev.map(item => item.id === conversationId
        ? {
            ...item,
            title: item.title === 'New conversation'
              ? question.length > 120 ? `${question.slice(0, 117).trimEnd()}…` : question
              : item.title,
            last_message_preview: responseContent || question,
            updated_at: timestamp,
          }
        : item));
    } catch (err) {
      if (operationId !== operationRef.current || activeConversationRef.current !== conversationId) return;
      setSendingError(err instanceof Error ? err.message : 'Copilot request failed.');
      try {
        const { messages: latest } = await api.chat.getConversation(projectId, conversationId);
        if (activeConversationRef.current === conversationId) setMessages(latest);
      } catch {
        setHistoryError('Could not reload this conversation after the message failed.');
      }
      if (!streamingContentRef.current) setInput(question);
    } finally {
      if (operationId === operationRef.current) {
        setStreaming(false);
        setStreamingContent('');
        streamingContentRef.current = '';
        sendingRef.current = false;
        sendControllerRef.current = null;
      }
    }
  }

  async function sendDemoQuestion(question: string, appendUser: boolean) {
    if (sendingRef.current || !question.trim()) return;
    sendingRef.current = true;
    setStreaming(true);
    setSendingError(null);
    setRetryDemoQuestion(null);
    if (appendUser) {
      setMessages(previous => [...previous, {
        id: `${Date.now()}-demo-user`,
        project_id: 'demo',
        user_id: 'demo',
        conversation_id: 'demo-session',
        role: 'user',
        content: question,
        created_at: new Date().toISOString(),
      }]);
    }
    try {
      await new Promise<void>(resolve => window.setTimeout(resolve, 350));
      const answer = createDemoCopilotReply(question, activeStage);
      setMessages(previous => [...previous, {
        id: `${Date.now()}-demo-assistant`,
        project_id: 'demo',
        user_id: 'demo',
        conversation_id: 'demo-session',
        role: 'assistant',
        content: answer,
        created_at: new Date().toISOString(),
      }]);
    } catch (err) {
      setSendingError(err instanceof Error ? err.message : 'Could not prepare the demo response.');
      setRetryDemoQuestion(question);
    } finally {
      sendingRef.current = false;
      setStreaming(false);
    }
  }

  const allMessages = streamingContent
    ? [...messages, { id: 'streaming', project_id: projectId, user_id: '', conversation_id: activeConversationId ?? '', role: 'assistant' as const, content: streamingContent, created_at: '' }]
    : messages;

  const groupedConversations = ['Today', 'Previous 7 Days', 'Older'].map(group => ({
    group,
    items: conversations.filter(conversation =>
      conversationGroup(conversation.updated_at) === group
      && `${conversation.title} ${conversation.last_message_preview ?? ''}`
        .toLocaleLowerCase()
        .includes(searchQuery.trim().toLocaleLowerCase())
    ),
  })).filter(item => item.items.length > 0);

  function renderMessage(message: Message) {
    if (message.role === 'user') {
      return <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>;
    }
    return (
      <div className="min-w-0 max-w-full break-words text-text-secondary [overflow-wrap:anywhere] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-sm [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-xs [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-xs [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1 [&_a]:text-accent [&_a]:underline [&_pre]:my-2 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-bg-base [&_pre]:p-2 [&_code]:break-all [&_blockquote]:border-l-2 [&_blockquote]:border-border-muted [&_blockquote]:pl-2 [&_blockquote]:text-text-muted">
        <ReactMarkdown components={{
          a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
          pre: ({ children }) => <pre className="whitespace-pre-wrap break-words">{children}</pre>,
        }}>
          {message.content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-border-subtle px-3 py-3">
        <div className="flex items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-accent" />
            <span className="text-xs font-medium text-text-primary">Copilot</span>
          </div>
          {!isDemo && <div className="flex flex-shrink-0 items-center gap-1">
            <button type="button" className="btn-ghost btn-sm px-2" onClick={() => setHistoryOpen(true)} disabled={streaming} aria-label="Conversation history">
              <History className="h-3.5 w-3.5" /><span>History</span>
            </button>
            <button type="button" className="btn-ghost btn-sm px-1.5" onClick={createConversation} disabled={streaming || loadingConversations} aria-label="New conversation" title="New conversation">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>}
        </div>
        <p className="mt-0.5 truncate text-2xs text-text-muted">
          {conversations.find(item => item.id === activeConversationId)?.title ?? 'Project-aware AI assistant'}
        </p>
        {isDemo && <p className="text-2xs text-warning mt-1">Deterministic sample responses · messages stay in this session.</p>}
        {historyError && <p className="mt-1 text-2xs text-danger" role="alert">{historyError}</p>}
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={event => {
          const container = event.currentTarget;
          shouldAutoScrollRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 72;
        }}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-3"
        role="log"
        aria-label="Copilot conversation"
        aria-live="polite"
      >
        {loadingMessages && <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading conversation…</div>}
        {!loadingMessages && allMessages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-text-muted mb-3">{isDemo ? 'Sample conversation' : 'Ask anything about your project.'}</p>
            {!isDemo &&
            <div className="space-y-1.5">
              {[
                'Why this viability score?',
                'Find more competitors',
                'What should I validate first?',
                'Explain the SOM calculation',
              ].map(s => (
                <button
                  key={s}
                  className="w-full text-left text-xs text-text-muted hover:text-accent transition-colors px-2 py-1 rounded hover:bg-bg-elevated"
                  onClick={() => setInput(s)}
                >
                  {s}
                </button>
              ))}
            </div>}
          </div>
        )}

        <div className="space-y-3">
          {allMessages.map(message => (
            <div key={message.id} className={cn('min-w-0 max-w-full text-xs', message.role === 'user' ? 'pl-2 text-text-primary' : '')}>
              <div className={cn('mb-1 text-2xs font-medium', message.role === 'user' ? 'text-text-muted' : 'text-accent')}>
                {message.role === 'user' ? 'You' : <BrandLogo size="small" wordmarkClassName="text-2xs font-medium text-accent" />}
              </div>
              {renderMessage(message)}
            </div>
          ))}
          {streaming && !streamingContent && <div className="flex items-center gap-2 py-1 text-2xs text-text-muted"><Loader2 className="h-3 w-3 animate-spin" /> {isDemo ? 'Preparing demo response…' : 'Thinking…'}</div>}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-border-subtle p-3">
        {sendingError && (
          <div className="mb-2 flex items-center gap-2 text-2xs text-danger" role="alert">
            <p className="flex-1">{sendingError}</p>
            {isDemo && retryDemoQuestion && (
              <button type="button" className="underline" onClick={() => void sendDemoQuestion(retryDemoQuestion, false)}>Retry</button>
            )}
          </div>
        )}
        <div className="flex min-w-0 gap-2">
          <input
            className="input h-8 min-w-0 flex-1 text-xs"
            placeholder={isDemo ? 'Ask about the SmartStock AI sample…' : 'Ask about this project…'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={streaming || (!isDemo && (loadingConversations || loadingMessages || !activeConversationId))}
          />
          <button
            type="button"
            className="btn-primary btn-sm flex-shrink-0 px-2"
            onClick={handleSend}
            disabled={!input.trim() || streaming || (!isDemo && !activeConversationId)}
            aria-label="Send message"
          >
            {streaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        {historyOpen && (
          <div className="absolute inset-0 z-30 flex min-h-0 min-w-0 flex-col overflow-hidden bg-bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-3">
              <div className="flex items-center gap-2"><History className="h-3.5 w-3.5 text-accent" /><span className="text-xs font-medium text-text-primary">Copilot history</span></div>
              <button type="button" className="btn-ghost btn-sm px-2" onClick={() => setHistoryOpen(false)} aria-label="Close conversation history"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="border-b border-border-subtle p-3">
              <button type="button" className="btn-primary btn-sm w-full justify-center" onClick={createConversation} disabled={streaming || loadingConversations}><Plus className="h-3.5 w-3.5" /> New conversation</button>
              <label className="relative mt-2 block">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <input className="input h-8 pl-7 text-xs" placeholder="Search conversations…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} aria-label="Search conversations" />
              </label>
            </div>
            {historyError && <p className="px-3 py-2 text-2xs text-danger" role="alert">{historyError}</p>}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
              {loadingConversations && <p className="px-2 py-4 text-center text-xs text-text-muted">Loading history…</p>}
              {!loadingConversations && groupedConversations.length === 0 && <p className="px-2 py-6 text-center text-xs text-text-muted">No conversations found.</p>}
              {groupedConversations.map(({ group, items }) => (
                <section key={group} className="mb-3">
                  <h3 className="px-2 py-1 text-2xs font-medium uppercase tracking-wide text-text-muted">{group}</h3>
                  <ul className="space-y-1">
                    {items.map(conversation => (
                      <li key={conversation.id} className={cn('relative min-w-0 rounded border p-2', conversation.id === activeConversationId ? 'border-accent/40 bg-accent-subtle' : 'border-transparent hover:bg-bg-elevated')}>
                        {editingConversationId === conversation.id ? (
                          <form className="flex gap-1" onSubmit={event => { event.preventDefault(); void renameConversation(conversation.id); }}>
                            <input className="input h-7 min-w-0 px-2 text-xs" value={titleDraft} onChange={event => setTitleDraft(event.target.value)} maxLength={120} autoFocus aria-label="Conversation title" />
                            <button type="submit" className="btn-ghost btn-sm px-1.5" aria-label="Save title" disabled={!titleDraft.trim()}><Check className="h-3.5 w-3.5" /></button>
                            <button type="button" className="btn-ghost btn-sm px-1.5" onClick={() => setEditingConversationId(null)} aria-label="Cancel rename"><X className="h-3.5 w-3.5" /></button>
                          </form>
                        ) : (
                          <div className="flex items-start gap-1">
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { if (!streaming) { void openConversation(conversation.id); setHistoryOpen(false); } }} disabled={streaming || loadingMessages} aria-current={conversation.id === activeConversationId ? 'true' : undefined}>
                              <span className="block truncate text-xs font-medium text-text-primary">{conversation.title}</span>
                              <span className="mt-1 block line-clamp-2 break-words text-2xs text-text-muted [overflow-wrap:anywhere]">{conversation.last_message_preview || 'No messages yet'}</span>
                              <span className="mt-1 block text-2xs text-text-disabled">{conversationTimestamp(conversation.updated_at)}</span>
                            </button>
                            <button type="button" className="btn-ghost btn-sm px-1.5" onClick={() => setOpenMenuId(prev => prev === conversation.id ? null : conversation.id)} aria-label={`Conversation actions for ${conversation.title}`} aria-expanded={openMenuId === conversation.id}><MoreHorizontal className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                        {openMenuId === conversation.id && (
                          <div className="absolute right-2 top-9 z-10 w-32 rounded border border-border-default bg-bg-elevated p-1 shadow-md">
                            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-text-secondary hover:bg-bg-overlay hover:text-text-primary" onClick={() => { setEditingConversationId(conversation.id); setTitleDraft(conversation.title); setOpenMenuId(null); }}><Pencil className="h-3 w-3" /> Rename</button>
                            <button type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-danger hover:bg-danger-subtle" onClick={() => void deleteConversation(conversation)}><Trash2 className="h-3 w-3" /> Delete</button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {hasMoreConversations && <p className="px-2 py-2 text-center text-2xs text-text-muted">Showing the 100 most recently updated conversations.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main WorkspacePage ────────────────────────────────────────────────────
export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const isDemo = projectId === 'demo';
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(
    isDemo ? (DEMO_PROJECT as unknown as Project) : null
  );
  const [stages, setStages] = useState<WorkflowStage[]>(() => isDemo ? createDemoStages() : []);
  const [demoResetKey, setDemoResetKey] = useState(0);
  const [loading, setLoading] = useState(!isDemo);
  const [stageLoading, setStageLoading] = useState<string | null>(null);
  const [stageLoadingMode, setStageLoadingMode] = useState<'generating' | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [activeStage, setActiveStage] = useState<StageKey | 'completion'>('idea_clarification');
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [lastFailedStage, setLastFailedStage] = useState<StageKey | null>(null);
  const [blockedByStage, setBlockedByStage] = useState<StageKey | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clarificationDirty, setClarificationDirty] = useState(false);
  const [pendingApprovalStage, setPendingApprovalStage] = useState<StageKey | null>(null);
  const pendingStageRequests = useRef(new Set<string>());
  const [retryStageAction, setRetryStageAction] = useState<{
    stageKey: StageKey;
    action: 'approve' | 'revise' | 'skip' | 'save';
    payload?: string | ClarificationEdits | MarketSizingEdits;
  } | null>(null);

  const loadProject = useCallback(async () => {
    if (isDemo || !projectId) return;
    try {
      const { project } = await api.projects.get(projectId);
      setProject(project);
      setStages(project.workflow_stages ?? []);
      const finalReport = project.workflow_stages?.find(stage => stage.stage_key === 'final_report');
      setActiveStage(project.current_stage >= STAGE_ORDER.length && finalReport?.status === 'approved'
        ? 'completion'
        : STAGE_ORDER[Math.min(project.current_stage, STAGE_ORDER.length - 1)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project.');
    } finally {
      setLoading(false);
    }
  }, [projectId, isDemo]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const getStageData = (key: StageKey): WorkflowStage | undefined => {
    const savedStage = stages.find(stage => stage.stage_key === key);
    if (savedStage) {
      return savedStage.result_data && Object.keys(savedStage.result_data).length > 0
        ? savedStage
        : { ...savedStage, result_data: undefined };
    }
    const demoStage = Object.entries(DEMO_STAGES).find(([stageKey]) => stageKey === key)?.[1];
    return isDemo
      ? {
          id: '',
          project_id: 'demo',
          stage_key: key,
          status: demoStage?.status ?? 'pending',
          updated_at: '',
        } as WorkflowStage
      : undefined;
  };

  async function runStage(stageKey: StageKey): Promise<boolean> {
    if (isDemo || !projectId || pendingStageRequests.current.has(stageKey)) return false;
    pendingStageRequests.current.add(stageKey);
    setStageLoading(stageKey);
    setStageLoadingMode('generating');
    setError(null);
    setRequiresSignIn(false);
    setNotice(null);
    setLastFailedStage(null);
    try {
      let result;
      switch (stageKey) {
        case 'idea_clarification': result = await api.stages.ideaClarification(projectId); break;
        case 'viability': result = await api.stages.viability(projectId); break;
        case 'target_customer': result = await api.stages.targetCustomer(projectId); break;
        case 'market_sizing': result = await api.stages.marketSizing(projectId); break;
        case 'competitors': result = await api.stages.competitors(projectId); break;
        case 'differentiation': result = await api.stages.differentiation(projectId); break;
        case 'gtm': result = await api.stages.gtm(projectId); break;
        case 'final_report': result = await api.stages.finalReport(projectId); break;
        default: return false;
      }
      if (!result || typeof result.result !== 'object' || result.result === null
        || Array.isArray(result.result) || Object.keys(result.result).length === 0) {
        throw new Error(`${STAGE_LABELS[stageKey]} generation returned no findings. Please retry.`);
      }
      setStages(prev => {
        const current = prev.find(stage => stage.stage_key === stageKey);
        const updated: WorkflowStage = {
          id: current?.id ?? '',
          project_id: projectId,
          stage_key: stageKey,
          status: 'completed',
          input_data: { ...(current?.input_data ?? {}), stale: false, staleAt: null, staleReason: null },
          result_data: result.result as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        };
        return [...prev.filter(stage => stage.stage_key !== stageKey), updated];
      });
      return true;
    } catch (err) {
      const isApiErr = err instanceof ApiError;
      const category = isApiErr ? err.errorCategory : undefined;

      let message: string;
      if (category === 'quota_exhausted') {
        message = (err as Error).message; // already user-friendly from backend
      } else if (category === 'auth_failure') {
        message = 'AI authentication failed. Check your AI_API_KEY configuration.';
      } else if (category === 'invalid_model') {
        message = 'The configured AI model is unavailable. Update AI_MODEL in your server .env.';
      } else if (category === 'timeout') {
        message = 'AI request timed out. The model may be under load — try again in a moment.';
      } else if (category === 'rate_limited') {
        message = 'AI rate limit hit. Wait a moment, then try again.';
      } else if (category === 'malformed_response' || category === 'schema_error') {
        message = 'AI returned an unexpected response format. Try again.';
      } else {
        message = err instanceof Error ? err.message : 'Stage generation failed.';
      }

      setError(message);
      setRequiresSignIn(isApiErr && err.statusCode === 401);
      setLastFailedStage(stageKey);
      return false;
    } finally {
      pendingStageRequests.current.delete(stageKey);
      setStageLoading(null);
      setStageLoadingMode(null);
    }
  }

  async function handleStageAction(
    stageKey: StageKey,
    action: 'approve' | 'revise' | 'skip' | 'save',
    notesOrClarification?: string | ClarificationEdits | MarketSizingEdits
  ) {
    if (isDemo) {
      const current = stages.find(stage => stage.stage_key === stageKey);
      if (!current) return;
      const updatedAt = new Date().toISOString();
      const nextStatus: WorkflowStage['status'] = action === 'approve'
        ? 'approved'
        : action === 'skip'
          ? 'skipped'
          : action === 'revise'
            ? 'needs_revision'
            : 'completed';
      const clarification = isClarificationEdits(notesOrClarification) ? notesOrClarification : null;
      const marketSizing = isMarketSizingEdits(notesOrClarification) ? notesOrClarification : null;

      setStages(previous => previous.map(stage => stage.stage_key !== stageKey ? stage : {
        ...stage,
        status: nextStatus,
        updated_at: updatedAt,
        approval_notes: typeof notesOrClarification === 'string' ? notesOrClarification : stage.approval_notes,
        input_data: {
          ...(stage.input_data ?? {}),
          ...(clarification ? { answers: clarification.answers } : {}),
          ...(stageKey === 'differentiation' && stage.input_data?.selectedStrategyId
            ? { selectedStrategyId: stage.input_data.selectedStrategyId }
            : {}),
        },
        result_data: {
          ...(stage.result_data ?? {}),
          ...(clarification ? {
            ideaSummary: clarification.ideaSummary,
            coreAssumptions: clarification.assumptions,
          } : {}),
          ...(marketSizing ? {
            assumptions: marketSizing.assumptions,
            calculations: marketSizing.calculations,
            scenarios: marketSizing.scenarios,
          } : {}),
        },
      }));

      if (stageKey === 'idea_clarification' && clarification) {
        setProject(previous => previous ? {
          ...previous,
          idea_summary: clarification.ideaSummary,
          assumptions: clarification.assumptions,
        } : previous);
      }
      if (stageKey === 'idea_clarification') setClarificationDirty(false);

      if (action === 'approve' || action === 'skip') {
        const next = STAGE_TRANSITIONS[stageKey].nextStage;
        setProject(previous => previous ? {
          ...previous,
          current_stage: next === 'completion' ? STAGE_ORDER.length : STAGE_ORDER.indexOf(next),
          overall_status: next === 'completion' && action === 'approve' ? 'complete' : 'in_progress',
        } : previous);
        setActiveStage(next);
        setNotice(action === 'approve'
          ? `${STAGE_LABELS[stageKey]} approved in this demo. You can revisit it from the workflow.`
          : `${STAGE_LABELS[stageKey]} skipped in this demo. No project data was changed.`);
      } else if (action === 'revise') {
        setNotice(`${STAGE_LABELS[stageKey]} revision requested in this demo${typeof notesOrClarification === 'string' ? `: ${notesOrClarification}` : '.'}`);
      } else {
        setNotice('Demo clarification changes saved for this browser session only.');
      }
      return;
    }

    if (!projectId || pendingStageRequests.current.has(stageKey)) return;
    pendingStageRequests.current.add(stageKey);
    setStageLoading(stageKey);
    setStageLoadingMode('saving');
    setPendingApprovalStage(action === 'approve' ? stageKey : null);
    setError(null);
    setRequiresSignIn(false);
    setNotice(null);
    setBlockedByStage(null);
    try {
      const response = await api.stages.action(projectId, {
        action,
        stageKey,
        ...(typeof notesOrClarification === 'string' ? { notes: notesOrClarification } : {}),
        ...(isClarificationEdits(notesOrClarification)
          ? { clarification: notesOrClarification }
          : {}),
        ...(stageKey === 'market_sizing'
          && action === 'approve'
          && isMarketSizingEdits(notesOrClarification)
          ? { marketSizing: notesOrClarification }
          : {}),
      });
      const currentClarification = stages.find(stage => stage.stage_key === 'idea_clarification');
      const currentClarificationInput = (currentClarification?.input_data ?? {}) as Record<string, unknown>;
      const currentClarificationResult = currentClarification?.result_data ?? {};
      const clarificationChanged = stageKey === 'idea_clarification'
        && action === 'approve'
        && isClarificationEdits(notesOrClarification)
        && (
          currentClarificationResult.ideaSummary !== notesOrClarification.ideaSummary
          || JSON.stringify(currentClarificationResult.coreAssumptions ?? []) !== JSON.stringify(notesOrClarification.assumptions)
          || JSON.stringify(currentClarificationInput.answers ?? currentClarificationInput) !== JSON.stringify(notesOrClarification.answers)
        );
      setStages(prev => {
        const updatedStages = [...prev.filter(stage => stage.stage_key !== stageKey), response.stage];
        if (!clarificationChanged) return updatedStages;
        return updatedStages.map(stage => stage.stage_key === 'idea_clarification'
          ? stage
          : {
              ...stage,
              input_data: {
                ...(stage.input_data ?? {}),
                stale: true,
                staleAt: response.stage.updated_at,
                staleReason: 'Idea clarification changed',
              },
            });
      });
      if (stageKey === 'idea_clarification' && (action === 'save' || action === 'approve')) {
        setClarificationDirty(false);
      }
      setProject(prev => prev ? {
        ...prev,
        current_stage: response.currentStage,
        overall_status: stageKey === 'final_report' && action === 'approve' ? 'complete'
          : action === 'approve' || action === 'skip' ? 'in_progress' : prev.overall_status,
        ...(isClarificationEdits(notesOrClarification)
          ? { idea_summary: notesOrClarification.ideaSummary, assumptions: notesOrClarification.assumptions }
          : {}),
      } : prev);
      setRetryStageAction(null);
      if (action === 'approve' || action === 'skip') {
        const next = STAGE_TRANSITIONS[stageKey].nextStage;
        setActiveStage(next);
        if (action === 'skip') {
          setNotice(`${STAGE_LABELS[stageKey]} was skipped, not approved. Findings that depend on it may be limited; you can reopen the stage from the workflow.`);
        } else if (next === 'completion') {
          setNotice('Your report is approved. Review the recommendation and decide what to validate next.');
        } else {
          const nextStage = stages.find(stage => stage.stage_key === next);
          const hasReusableResult = !!nextStage?.result_data
            && Object.keys(nextStage.result_data).length > 0
            && (nextStage.input_data as { stale?: boolean } | undefined)?.stale !== true
            && nextStage.status !== 'needs_revision';
          if (hasReusableResult) {
            setNotice(`${STAGE_LABELS[stageKey]} is approved. Restored saved ${STAGE_LABELS[next]} findings.`);
          } else if (await runStage(next)) {
            setNotice(`${STAGE_LABELS[next]} findings are ready for review. Approval is still required.`);
          }
        }
      } else if (action === 'save') {
        setNotice('Your clarification progress was saved.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stage.');
      setRequiresSignIn(err instanceof ApiError && err.statusCode === 401);
      setRetryStageAction({ stageKey, action, payload: notesOrClarification });
      if (err instanceof ApiError && typeof err.details === 'object' && err.details !== null) {
        const requiredStageKey = (err.details as { requiredStageKey?: unknown }).requiredStageKey;
        if (typeof requiredStageKey === 'string' && STAGE_ORDER.includes(requiredStageKey as StageKey)) {
          setBlockedByStage(requiredStageKey as StageKey);
        }
      }
    } finally {
      pendingStageRequests.current.delete(stageKey);
      setStageLoading(null);
      setStageLoadingMode(null);
      setPendingApprovalStage(null);
    }
  }

  async function handleSelectStrategy(strategyId: string) {
    if (isDemo) {
      setStages(previous => previous.map(stage => stage.stage_key !== 'differentiation' ? stage : {
        ...stage,
        status: stage.status === 'approved' ? 'needs_revision' : stage.status,
        input_data: { ...(stage.input_data ?? {}), selectedStrategyId: strategyId },
        updated_at: new Date().toISOString(),
      }));
      setNotice('Demo strategy selection updated. Approve the stage to confirm this choice.');
      return;
    }
    if (!projectId) return;
    try {
      const { status } = await api.stages.selectStrategy(projectId, strategyId);
      setStages(prev => prev.map(s =>
        s.stage_key === 'differentiation'
          ? {
              ...s,
              status,
              input_data: { ...(s.input_data ?? {}), selectedStrategyId: strategyId },
            }
          : s
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save strategy selection.');
    }
  }

  async function navigateToStage(stageKey: StageKey): Promise<boolean> {
    if (activeStage === 'idea_clarification' && clarificationDirty && stageKey !== 'idea_clarification') {
      const discard = window.confirm('You have unsaved clarification changes. Leave this stage and discard them?');
      if (!discard) return false;
    }
    if (pendingStageRequests.current.has('navigation')) return false;
    pendingStageRequests.current.add('navigation');
    try {
      if (!isDemo && projectId) {
        const currentStage = STAGE_ORDER.indexOf(stageKey);
        const { project: updatedProject } = await api.projects.update(projectId, {
          currentStage,
          overallStatus: 'in_progress',
        });
        setProject(updatedProject);
      }
      setActiveStage(stageKey);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the active workflow stage.');
      return false;
    } finally {
      pendingStageRequests.current.delete('navigation');
    }
  }

  async function continueToNextStage() {
    if (activeStage === 'completion') return;
    const nextStage = STAGE_TRANSITIONS[activeStage].nextStage;
    if (nextStage !== 'completion') {
      if (!await navigateToStage(nextStage)) return;
      const savedNextStage = getStageData(nextStage);
      const hasReusableResult = !!savedNextStage?.result_data
        && Object.keys(savedNextStage.result_data).length > 0
        && (savedNextStage.input_data as { stale?: boolean } | undefined)?.stale !== true
        && savedNextStage.status !== 'needs_revision';
      if (hasReusableResult) {
        setNotice(`Restored saved ${STAGE_LABELS[nextStage]} findings.`);
      } else if (await runStage(nextStage)) {
        setNotice(`${STAGE_LABELS[nextStage]} findings are ready for review. Approval is still required.`);
      }

      return;
    }

    if (isDemo) {
      setActiveStage('completion');
      return;
    }
    if (!projectId || pendingStageRequests.current.has('navigation')) return;

    pendingStageRequests.current.add('navigation');
    try {
      const { project: updatedProject } = await api.projects.update(projectId, {
        currentStage: STAGE_ORDER.length,
        overallStatus: 'complete',
      });
      setProject(updatedProject);
      setActiveStage('completion');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open the completion view.');
    } finally {
      pendingStageRequests.current.delete('navigation');
    }
  }

  function resetDemo() {
    if (!isDemo || !window.confirm('Reset this interactive demo to its original sample state? Demo decisions and chat in this session will be cleared.')) return;
    setProject(DEMO_PROJECT as unknown as Project);
    setStages(createDemoStages());
    setActiveStage('idea_clarification');
    setClarificationDirty(false);
    setNotice('Demo reset. The original SmartStock AI sample has been restored.');
    setError(null);
    setLastFailedStage(null);
    setRetryStageAction(null);
    setDemoResetKey(key => key + 1);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center text-center">
        <div>
          <p className="text-text-secondary mb-3">Project not found.</p>
          <Link to="/dashboard" className="btn-primary btn-sm">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const resolvedDemoStages = stages.filter(stage => stage.status === 'approved' || stage.status === 'skipped').length;
  const demoProgressPercent = Math.round((resolvedDemoStages / STAGE_ORDER.length) * 100);

  const renderStageContent = () => {
    const activeStageKey: StageKey = activeStage === 'completion' ? 'final_report' : activeStage;
    const stageData = getStageData(activeStageKey);
    const stageLoadingActive = stageLoading === activeStageKey;
    const finalResult = getStageData('final_report')?.result_data as {
      verdict?: string;
      verdictReason?: string;
      keyRisks?: string[];
      unvalidatedAssumptions?: string[];
      workflowLimitations?: string[];
      stageStatuses?: Array<{ stageKey: string; status: string; stale: boolean }>;
      recommendedExperiments?: Array<{ experiment: string; hypothesis: string; successCriteria: string }>;
    } | undefined;

    const commonProps = {
      stageData,
      onAction: (action: 'approve' | 'revise' | 'skip', notes?: string) => handleStageAction(activeStageKey, action, notes),
      onGenerate: () => runStage(activeStageKey),
      loading: stageLoadingActive,
      approvalPending: pendingApprovalStage === activeStageKey,
      isDemo,
    };

    if (activeStage === 'completion') {
      return (
        <div className="space-y-5">
          <div className="border border-success/20 bg-success-subtle rounded p-4">
            <div className="section-label mb-1">Workflow complete</div>
            <p className="text-sm text-text-secondary">
              {stages.filter(stage => stage.status === 'approved').length} approved · {stages.filter(stage => stage.status === 'skipped').length} skipped. This evidence-based assessment is not a guarantee of business success.
            </p>
          </div>
          <div className="border border-border-default bg-bg-elevated rounded p-4">
            <div className="section-label mb-1">Recommendation</div>
            <div className="text-2xl font-semibold text-text-primary">{finalResult?.verdict ?? project.verdict}</div>
            <p className="text-sm text-text-secondary mt-2">{finalResult?.verdictReason}</p>
          </div>
          {finalResult?.keyRisks && (
            <div>
              <div className="section-label mb-2">Main risks</div>
              <ul className="space-y-1">{finalResult.keyRisks.map((risk, index) => <li key={index} className="text-sm text-text-secondary">· {risk}</li>)}</ul>
            </div>
          )}
          {finalResult?.unvalidatedAssumptions && (
            <div>
              <div className="section-label mb-2">Unresolved assumptions</div>
              <ul className="space-y-1">{finalResult.unvalidatedAssumptions.map((item, index) => <li key={index} className="text-sm text-text-secondary">· {item}</li>)}</ul>
            </div>
          )}
          {finalResult?.workflowLimitations && finalResult.workflowLimitations.length > 0 && (
            <div className="border border-warning/20 bg-warning-subtle rounded p-3">
              <div className="section-label text-warning mb-2">Skipped-stage limitations</div>
              <ul className="space-y-1">{finalResult.workflowLimitations.map((item, index) => <li key={index} className="text-xs text-text-secondary">· {item}</li>)}</ul>
            </div>
          )}
          {finalResult?.stageStatuses && (
            <div>
              <div className="section-label mb-2">Workflow status</div>
              <ul className="grid gap-1 sm:grid-cols-2">
                {finalResult.stageStatuses.map(stage => (
                  <li key={stage.stageKey} className="text-xs text-text-secondary flex justify-between gap-2">
                    <span>{STAGE_LABELS[stage.stageKey as StageKey] ?? stage.stageKey.replace(/_/g, ' ')}</span>
                    <span className={stage.stale || stage.status !== 'approved' ? 'text-warning' : 'text-success'}>
                      {stage.stale ? 'potentially stale' : stage.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {finalResult?.recommendedExperiments && (
            <div>
              <div className="section-label mb-2">Recommended next actions</div>
              <ul className="space-y-2">{finalResult.recommendedExperiments.map((item, index) => <li key={index} className="text-sm text-text-secondary"><span className="text-text-primary">{item.experiment}</span><span className="block text-xs text-text-muted">{item.successCriteria}</span></li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
            <button className="btn-secondary btn-sm" onClick={() => navigateToStage('final_report')}>
              <FileText className="w-3.5 h-3.5" /> Reopen final report
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setCopilotOpen(true)}>
              <MessageSquare className="w-3.5 h-3.5" /> Ask Copilot
            </button>
          </div>
        </div>
      );
    }

    switch (activeStage) {
      case 'idea_clarification':
        return (
          <IdeaClarificationStage
            project={project}
            {...commonProps}
            onDirtyChange={setClarificationDirty}
            onAction={(action, clarification) => handleStageAction('idea_clarification', action, clarification)}
          />
        );
      case 'viability':
        return <ViabilityStage {...commonProps} />;
      case 'target_customer':
        return <TargetCustomerStage {...commonProps} />;
      case 'market_sizing':
        return (
          <MarketSizingStage
            {...commonProps}
            onAction={(action, payload) => handleStageAction('market_sizing', action, payload)}
          />
        );
      case 'competitors':
        return <CompetitorsStage {...commonProps} />;
      case 'differentiation':
        return (
          <DifferentiationStage
            {...commonProps}
            onSelectStrategy={handleSelectStrategy}
          />
        );
      case 'gtm':
        return <GtmStage {...commonProps} />;
      case 'final_report':
        return (
          <FinalReportStage
            stageData={stageData}
            onGenerate={() => runStage('final_report')}
            loading={stageLoadingActive}
            isDemo={isDemo}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen h-[100dvh] min-w-0 overflow-hidden bg-bg-base flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border-subtle bg-bg-surface flex-shrink-0">
        <div className="flex items-center px-4 h-12 gap-3">
          <Link to="/dashboard" className="btn-ghost btn-sm py-1">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <BrandLogo symbolOnly size="small" />
          <div className="w-px h-5 bg-border-default" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-text-primary">{project.name}</span>
            {isDemo && <span className="ml-2 badge badge-warning">Interactive Demo</span>}
          </div>
          {isDemo && (
            <div className="flex flex-shrink-0 items-center gap-1">
              <button type="button" className="btn-ghost btn-sm px-2" onClick={resetDemo}>
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Demo</span>
              </button>
              <Link
                to={user ? '/projects?create=1' : '/auth/signup'}
                state={user ? undefined : { from: '/projects?create=1' }}
                className="btn-primary btn-sm px-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Start Your Own Project</span>
                <span className="sm:hidden">Start</span>
              </Link>
            </div>
          )}
          <button
            className="btn-ghost btn-sm"
            onClick={() => setCopilotOpen(!copilotOpen)}
          >
            <MessageSquare className="w-4 h-4" />
            Copilot
          </button>
        </div>
      </header>

      {error && (
        <div className="px-4 py-2 bg-danger-subtle border-b border-danger/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
          <p className="text-xs text-danger flex-1">{error}</p>
          {(lastFailedStage || retryStageAction) && (
            <button
              id={retryStageAction ? 'retry-stage-action-btn' : 'retry-stage-btn'}
              onClick={() => {
                setError(null);
                if (retryStageAction) {
                  handleStageAction(retryStageAction.stageKey, retryStageAction.action, retryStageAction.payload);
                } else if (lastFailedStage) {
                  runStage(lastFailedStage);
                }
              }}
              className="text-xs text-danger underline underline-offset-2 hover:no-underline flex-shrink-0"
            >
              Retry
            </button>
          )}
          {requiresSignIn && (
            <Link
              to="/auth/login"
              state={{ from: `/project/${projectId}` }}
              className="text-xs text-danger underline underline-offset-2 hover:no-underline flex-shrink-0"
            >
              Sign in again
            </Link>
          )}
          {blockedByStage && (
            <button
              onClick={() => {
                const stageKey = blockedByStage;
                setBlockedByStage(null);
                setError(null);
                setRetryStageAction(null);
                void navigateToStage(stageKey);
              }}
              className="text-xs text-danger underline underline-offset-2 hover:no-underline flex-shrink-0"
            >
              Open {STAGE_LABELS[blockedByStage]}
            </button>
          )}
          <button onClick={() => {
            setError(null);
            setLastFailedStage(null);
            setRequiresSignIn(false);
            setBlockedByStage(null);
            setRetryStageAction(null);
          }} className="text-danger flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="px-4 py-2 bg-bg-elevated border-b border-border-subtle flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
          <p className="text-xs text-text-secondary flex-1">{notice}</p>
          <button aria-label="Dismiss message" onClick={() => setNotice(null)} className="text-text-muted hover:text-text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden">
        {/* Left rail — stage nav */}
        <aside className="w-36 sm:w-52 flex-shrink-0 border-r border-border-subtle bg-bg-surface overflow-y-auto">
          <div className="p-3">
            <div className="section-label mb-3 px-2">Workflow</div>
            {isDemo && (
              <div className="mb-3 rounded border border-border-subtle bg-bg-elevated p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-2xs text-text-muted">Demo progress</span>
                  <span className="text-2xs tabular-nums text-text-secondary">{demoProgressPercent}%</span>
                </div>
                <div
                  className="h-1 overflow-hidden rounded-full bg-bg-overlay"
                  role="progressbar"
                  aria-label="Demo workflow progress"
                  aria-valuemin={0}
                  aria-valuemax={STAGE_ORDER.length}
                  aria-valuenow={resolvedDemoStages}
                >
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${demoProgressPercent}%` }} />
                </div>
                <p className="mt-1.5 text-2xs text-text-muted">{resolvedDemoStages} of {STAGE_ORDER.length} stages resolved</p>
              </div>
            )}
            <div className="space-y-0.5">
              {STAGE_ORDER.map((key) => {
                const stageData = getStageData(key);
                const status = stageData?.status ?? 'pending';
                const isActive = activeStage === key || (activeStage === 'completion' && key === 'final_report');
                const isStale = (stageData?.input_data as { stale?: boolean } | undefined)?.stale === true;

                return (
                  <button
                    key={key}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2 py-2 rounded text-left transition-all duration-150',
                      isActive
                        ? 'bg-bg-elevated text-text-primary'
                        : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50'
                    )}
                    onClick={() => navigateToStage(key)}
                  >
                    <StageStatusIcon status={status} />
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-xs truncate', isActive && 'font-medium text-text-primary')}>
                        {STAGE_LABELS[key]}
                      </div>
                      {isStale && <div className="text-2xs text-warning">Potentially stale</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6">
            {/* Stage header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-2xs text-text-muted mb-2">
                <span>{activeStage === 'completion' ? 'Completion' : `Stage ${STAGE_ORDER.indexOf(activeStage) + 1}/8`}</span>
                <span>·</span>
                <span>{activeStage === 'completion' ? 'Completion and Next Steps' : STAGE_LABELS[activeStage]}</span>
                {stageLoading === (activeStage === 'completion' ? 'final_report' : activeStage) && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-accent">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {stageLoadingMode === 'saving' ? 'Saving…' : 'Generating…'}
                    </span>
                  </>
                )}
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-text-primary">
                {activeStage === 'completion' ? 'Completion and Next Steps' : STAGE_LABELS[activeStage]}
              </h2>
            </div>

            {activeStage !== 'completion' && (() => {
              const stageData = getStageData(activeStage);
              const guide = STAGE_GUIDANCE[activeStage];
              const stale = (stageData?.input_data as { stale?: boolean } | undefined)?.stale === true;
              const hasResult = !!stageData?.result_data && Object.keys(stageData.result_data).length > 0;
              const nextStage = STAGE_TRANSITIONS[activeStage].nextStage;
              const recommendation = stale
                ? 'Review upstream changes and regenerate these potentially stale findings when ready.'
                : activeStage === 'final_report'
                  ? 'Review the complete sample report, then use the workflow navigation to revisit any stage.'
                : stageData?.status === 'approved'
                  ? 'This stage is approved. Continue to the next workflow stage, or reopen it if you need to revise the saved decision.'
                  : !hasResult
                    ? `Start ${STAGE_LABELS[activeStage]} to create this stage’s findings.`
                    : 'Review the saved findings, then approve, revise, or skip this stage.';
              return (
                <div className="mb-5 p-3 border border-border-subtle rounded bg-bg-surface">
                  {stageData?.status === 'needs_revision' && (
                    <p className="text-xs text-warning mb-2">
                      {isDemo
                        ? 'Revision requested in this demo. Sample findings are unchanged; approve or skip the stage to continue.'
                        : 'You are revising a stage that was previously approved. Save and approve the updated findings; dependent results are flagged for review.'}
                    </p>
                  )}
                  <p className="text-sm text-text-primary">{guide.objective}</p>
                  <div className="grid gap-2 sm:grid-cols-3 mt-2 text-xs text-text-muted">
                    <p><span className="text-text-secondary">Why it matters:</span> {guide.why}</p>
                    <p><span className="text-text-secondary">Builds on:</span> {guide.uses}</p>
                    <p><span className="text-text-secondary">You’ll receive:</span> {guide.output}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-3 pt-2 border-t border-border-subtle">
                    <p className="text-2xs text-text-muted"><span className="text-text-secondary">Recommended next step:</span> {recommendation}</p>
                    {stale && hasResult && (
                      <button className="btn-ghost btn-sm flex-shrink-0" onClick={() => runStage(activeStage)} disabled={stageLoading !== null || isDemo}>
                        Regenerate
                      </button>
                    )}
                    {activeStage !== 'final_report' && !hasResult && stageData?.status !== 'skipped' && stageData?.status !== 'approved' && (
                      <button
                        className="btn-ghost btn-sm flex-shrink-0"
                        onClick={() => handleStageAction(activeStage, 'skip')}
                        disabled={stageLoading !== null || isDemo}
                      >
                        <SkipForward className="w-3.5 h-3.5" /> Skip stage
                      </button>
                    )}
                    {stageData?.status === 'approved' && (
                      <button
                        className="btn-primary btn-sm flex-shrink-0"
                        onClick={() => void continueToNextStage()}
                        disabled={stageLoading !== null || pendingStageRequests.current.has('navigation')}
                      >
                        {nextStage === 'completion' ? 'View completion' : `Continue to ${STAGE_LABELS[nextStage]}`}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Stage content */}
            <motion.div
              key={activeStage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              {renderStageContent()}
            </motion.div>
          </div>
        </main>

        {/* Right copilot */}
        <AnimatePresence>
          {copilotOpen && (
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-y-0 right-0 z-20 w-72 max-w-[88vw] border-l border-border-subtle bg-bg-surface overflow-hidden flex min-h-0 min-w-0 flex-col md:relative md:inset-auto md:z-auto md:w-72 md:max-w-none md:flex-shrink-0"
            >
              <CopilotPanel
                key={isDemo ? `demo-${demoResetKey}` : projectId}
                projectId={projectId!}
                isDemo={isDemo}
                activeStage={activeStage === 'completion' ? 'final_report' : activeStage}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
