import { describe, expect, it } from 'vitest';
import {
  getNextStageIndex,
  getStageActionStatus,
  getPreviousStageKey,
  isStageUnblockedBy,
  STAGE_ORDER,
  STAGE_TRANSITIONS,
} from '../workflow';

describe('persisted workflow transitions', () => {
  it('defines each stable stage transition in order', () => {
    expect(STAGE_ORDER.map(stage => STAGE_TRANSITIONS[stage])).toEqual([
      'viability',
      'target_customer',
      'market_sizing',
      'competitors',
      'differentiation',
      'gtm',
      'final_report',
      'completion',
    ]);
  });

  it('moves an approved go-to-market stage directly to the final report', () => {
    expect(STAGE_ORDER[6]).toBe('gtm');
    expect(STAGE_TRANSITIONS.gtm).toBe('final_report');
    expect(getNextStageIndex('gtm', 'approve')).toBe(7);
    expect(getPreviousStageKey('final_report')).toBe('gtm');
  });

  it('advances the persisted stage only after approval or skip', () => {
    expect(getNextStageIndex('idea_clarification', 'approve')).toBe(1);
    expect(getNextStageIndex('viability', 'skip')).toBe(2);
    expect(getNextStageIndex('target_customer', 'save')).toBe(2);
    expect(getNextStageIndex('target_customer', 'revise')).toBe(2);
  });

  it('keeps skip distinct from approval', () => {
    expect(getStageActionStatus('skip', 'completed')).toBe('skipped');
    expect(getStageActionStatus('approve', 'completed')).toBe('approved');
  });

  it('does not treat generated-but-unapproved findings as an approval gate', () => {
    expect(isStageUnblockedBy('completed')).toBe(false);
    expect(isStageUnblockedBy('approved')).toBe(true);
    expect(isStageUnblockedBy('skipped')).toBe(true);
  });

  it('reopens approved findings for revision without deleting their results', () => {
    expect(getStageActionStatus('save', 'approved')).toBe('needs_revision');
    expect(getStageActionStatus('save', 'completed')).toBe('completed');
  });
});
