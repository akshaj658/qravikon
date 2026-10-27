export const STAGE_ORDER = [
  'idea_clarification',
  'viability',
  'target_customer',
  'market_sizing',
  'competitors',
  'differentiation',
  'gtm',
  'final_report',
] as const;

export type StageKey = (typeof STAGE_ORDER)[number];
export type StageStatus = 'pending' | 'completed' | 'approved' | 'skipped' | 'needs_revision';
export type StageAction = 'approve' | 'revise' | 'skip' | 'save';

export const STAGE_TRANSITIONS: Record<StageKey, StageKey | 'completion'> = {
  idea_clarification: 'viability',
  viability: 'target_customer',
  target_customer: 'market_sizing',
  market_sizing: 'competitors',
  competitors: 'differentiation',
  differentiation: 'gtm',
  gtm: 'final_report',
  final_report: 'completion',
};

export function getStageActionStatus(action: StageAction, currentStatus?: StageStatus): StageStatus {
  if (action === 'approve') return 'approved';
  if (action === 'skip') return 'skipped';
  if (action === 'revise' || currentStatus === 'approved') return 'needs_revision';
  return currentStatus ?? 'pending';
}

export function getNextStageIndex(stageKey: StageKey, action: StageAction): number {
  const index = STAGE_ORDER.indexOf(stageKey);
  return action === 'approve' || action === 'skip' ? index + 1 : index;
}

export function getPreviousStageKey(stageKey: StageKey): StageKey | null {
  const index = STAGE_ORDER.indexOf(stageKey);
  return index > 0 ? STAGE_ORDER[index - 1] : null;
}

export function isStageUnblockedBy(status: StageStatus | undefined): boolean {
  return status === 'approved' || status === 'skipped';
}
