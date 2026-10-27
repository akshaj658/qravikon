import { describe, expect, it } from 'vitest';
import { ClarificationEditsSchema } from '../schemas/clarification';

describe('Idea Clarification request validation', () => {
  const basePayload = {
    ideaSummary: 'Inventory forecasting for independent retailers.',
    assumptions: ['Retailers can provide sales history.'],
  };

  it('accepts provided string answers', () => {
    const result = ClarificationEditsSchema.safeParse({
      ...basePayload,
      answers: { q1: 'Independent grocery stores', q2: 'CSV upload first' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.answers).toEqual({ q1: 'Independent grocery stores', q2: 'CSV upload first' });
    }
  });

  it('accepts unanswered optional questions as an empty answers map', () => {
    const result = ClarificationEditsSchema.safeParse({ ...basePayload, answers: {} });

    expect(result.success).toBe(true);
  });

  it.each([
    ['boolean', { q1: true }],
    ['null', { q1: null }],
  ])('rejects malformed %s answers instead of coercing them', (_kind, answers) => {
    const result = ClarificationEditsSchema.safeParse({ ...basePayload, answers });

    expect(result.success).toBe(false);
  });

  it('rejects missing answer maps and malformed clarification fields', () => {
    expect(ClarificationEditsSchema.safeParse(basePayload).success).toBe(false);
    expect(ClarificationEditsSchema.safeParse({
      ...basePayload,
      answers: { q1: 42 },
    }).success).toBe(false);
  });
});
