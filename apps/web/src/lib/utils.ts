import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency = 'USD',
  compact = true
): string {
  if (compact) {
    if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatRelativeTime(dateString: string): string {
  return formatDate(dateString);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '…';
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

export const STAGE_LABELS: Record<StageKey, string> = {
  idea_clarification: 'Idea Clarification',
  viability: 'Problem & Viability',
  target_customer: 'Target Customer',
  market_sizing: 'Market Sizing',
  competitors: 'Competitor Research',
  differentiation: 'Differentiation',
  gtm: 'Go-to-Market',
  final_report: 'Final Report',
};

export const STAGE_TRANSITIONS: Record<StageKey, {
  nextStage: StageKey | 'completion';
  approveLabel: string;
  loadingLabel: string;
}> = {
  idea_clarification: {
    nextStage: 'viability',
    approveLabel: 'Approve & Assess Problem',
    loadingLabel: 'Approving & assessing problem…',
  },
  viability: {
    nextStage: 'target_customer',
    approveLabel: 'Approve & Find Customers',
    loadingLabel: 'Approving & finding customers…',
  },
  target_customer: {
    nextStage: 'market_sizing',
    approveLabel: 'Approve & Size Market',
    loadingLabel: 'Approving & sizing market…',
  },
  market_sizing: {
    nextStage: 'competitors',
    approveLabel: 'Approve & Research Competitors',
    loadingLabel: 'Approving & researching competitors…',
  },
  competitors: {
    nextStage: 'differentiation',
    approveLabel: 'Approve & Explore Differentiation',
    loadingLabel: 'Approving & exploring differentiation…',
  },
  differentiation: {
    nextStage: 'gtm',
    approveLabel: 'Approve & Build Go-to-Market',
    loadingLabel: 'Approving & building Go-to-Market…',
  },
  gtm: {
    nextStage: 'final_report',
    approveLabel: 'Approve & Generate Final Report',
    loadingLabel: 'Approving & generating final report…',
  },
  final_report: {
    nextStage: 'completion',
    approveLabel: 'Approve & Complete Project',
    loadingLabel: 'Approving & completing project…',
  },
};

export function getStageIndex(stageKey: StageKey): number {
  return STAGE_ORDER.indexOf(stageKey);
}

export function getProgressPercent(currentStage: number): number {
  return Math.round((currentStage / 8) * 100);
}
