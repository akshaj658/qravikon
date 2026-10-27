import { describe, expect, it } from 'vitest';
import { buildClarificationPayload, readClarificationAnswers } from './clarification';

describe('Idea Clarification payload construction', () => {
  const questionIds = ['q1', 'q2'];

  it('preserves actual string answers and excludes unknown fields', () => {
    const answers = readClarificationAnswers({
      answers: { q1: 'Independent grocery stores', q2: 'CSV upload first', stale: false },
      staleAt: null,
    }, questionIds);

    expect(answers).toEqual({
      q1: 'Independent grocery stores',
      q2: 'CSV upload first',
    });
  });

  it('omits unanswered and whitespace-only questions without coercion', () => {
    const answers = readClarificationAnswers({
      answers: { q1: '   ', q2: null },
      stale: false,
      staleAt: null,
    }, questionIds);

    expect(answers).toEqual({});
  });

  it('uses the same validated shape for save, approve, and skip payloads', () => {
    const payload = buildClarificationPayload(
      '  Inventory forecasting for independent retailers.  ',
      '  POS data access  \n\n  Retailers will pay  ',
      { q1: 'Owner-operated stores', q2: '' },
      questionIds
    );

    expect(payload).toEqual({
      ideaSummary: 'Inventory forecasting for independent retailers.',
      assumptions: ['POS data access', 'Retailers will pay'],
      answers: { q1: 'Owner-operated stores' },
    });
  });
});
