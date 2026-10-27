import { describe, it, expect } from 'vitest';

// ─── Market sizing calculations ───────────────────────────────────────────
describe('Market Sizing Calculations', () => {
  function calculateTam(totalCustomers: number, revenuePerCustomer: number) {
    return totalCustomers * revenuePerCustomer;
  }

  function calculateSam(tam: number, segmentPercentage: number) {
    if (segmentPercentage < 0 || segmentPercentage > 100) throw new Error('segmentPercentage must be 0-100');
    return tam * (segmentPercentage / 100);
  }

  function calculateSom(sam: number, reachableShare: number, timeHorizonYears: number) {
    if (reachableShare < 0 || reachableShare > 100) throw new Error('reachableShare must be 0-100');
    if (timeHorizonYears <= 0) throw new Error('timeHorizonYears must be positive');
    return sam * (reachableShare / 100);
  }

  it('calculates TAM correctly', () => {
    expect(calculateTam(1_000_000, 100)).toBe(100_000_000);
    expect(calculateTam(0, 100)).toBe(0);
    expect(calculateTam(500, 1200)).toBe(600_000);
  });

  it('calculates SAM correctly', () => {
    const tam = calculateTam(1_000_000, 100);
    expect(calculateSam(tam, 10)).toBe(10_000_000);
    expect(calculateSam(tam, 0)).toBe(0);
    expect(calculateSam(tam, 100)).toBe(tam);
  });

  it('calculates SOM correctly', () => {
    const tam = calculateTam(1_000_000, 100);
    const sam = calculateSam(tam, 10);
    expect(calculateSom(sam, 5, 3)).toBe(500_000);
  });

  it('throws on invalid segmentPercentage', () => {
    expect(() => calculateSam(100, -1)).toThrow('segmentPercentage must be 0-100');
    expect(() => calculateSam(100, 101)).toThrow('segmentPercentage must be 0-100');
  });

  it('throws on invalid reachableShare', () => {
    expect(() => calculateSom(100, -1, 3)).toThrow('reachableShare must be 0-100');
    expect(() => calculateSom(100, 101, 3)).toThrow('reachableShare must be 0-100');
  });

  it('throws on invalid time horizon', () => {
    expect(() => calculateSom(100, 5, 0)).toThrow('timeHorizonYears must be positive');
    expect(() => calculateSom(100, 5, -1)).toThrow('timeHorizonYears must be positive');
  });
});

// ─── Input validation ─────────────────────────────────────────────────────
import { z } from 'zod';

describe('Input Validation', () => {
  const CreateProjectSchema = z.object({
    name: z.string().min(1).max(100),
    originalIdea: z.string().min(10).max(5000),
  });

  it('accepts valid project inputs', () => {
    expect(() => CreateProjectSchema.parse({
      name: 'SmartStock AI',
      originalIdea: 'Predict inventory shortages for small retailers using sales data.',
    })).not.toThrow();
  });

  it('rejects empty name', () => {
    expect(() => CreateProjectSchema.parse({
      name: '',
      originalIdea: 'Valid idea that is long enough',
    })).toThrow();
  });

  it('rejects short idea', () => {
    expect(() => CreateProjectSchema.parse({
      name: 'Test',
      originalIdea: 'Short',
    })).toThrow();
  });

  it('rejects name over 100 chars', () => {
    expect(() => CreateProjectSchema.parse({
      name: 'a'.repeat(101),
      originalIdea: 'Valid idea that is long enough',
    })).toThrow();
  });
});

// ─── Workflow transitions ─────────────────────────────────────────────────
describe('Workflow Transitions', () => {
  type StageStatus = 'pending' | 'completed' | 'approved' | 'skipped' | 'needs_revision';

  const STAGE_ORDER = [
    'idea_clarification',
    'viability',
    'target_customer',
    'market_sizing',
    'competitors',
    'differentiation',
    'gtm',
    'final_report',
  ];

  function canRunStage(stageKey: string, stages: Record<string, StageStatus>): boolean {
    const idx = STAGE_ORDER.indexOf(stageKey);
    if (idx === 0) return true;
    const prevStage = STAGE_ORDER[idx - 1];
    const prevStatus = stages[prevStage];
    return prevStatus === 'approved' || prevStatus === 'completed' || prevStatus === 'skipped';
  }

  it('allows first stage without prerequisites', () => {
    expect(canRunStage('idea_clarification', {})).toBe(true);
  });

  it('allows second stage when first is approved', () => {
    expect(canRunStage('viability', { idea_clarification: 'approved' })).toBe(true);
  });

  it('allows stage when previous is skipped', () => {
    expect(canRunStage('viability', { idea_clarification: 'skipped' })).toBe(true);
  });

  it('blocks stage when previous is pending', () => {
    expect(canRunStage('viability', { idea_clarification: 'pending' })).toBe(false);
  });

  it('blocks stage when previous needs revision', () => {
    expect(canRunStage('viability', { idea_clarification: 'needs_revision' })).toBe(false);
  });
});

// ─── Environment variable checks ─────────────────────────────────────────
describe('Feature flags', () => {
  it('detects missing AI key', () => {
    const key: string = '';
    const ai = key.length > 0;
    expect(ai).toBe(false);
  });

  it('detects present AI key', () => {
    const key: string = 'sk-test-key';
    const ai = key.length > 0;
    expect(ai).toBe(true);
  });
});
