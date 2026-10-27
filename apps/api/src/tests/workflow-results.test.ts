import { describe, expect, it } from 'vitest';
import { isReusableStageResult } from '../workflow-results';

describe('saved workflow result reuse', () => {
  it('does not treat an empty saved object as generated findings', () => {
    expect(isReusableStageResult({}, 'completed', {})).toBe(false);
  });

  it('reuses nonempty saved findings when they are current', () => {
    expect(isReusableStageResult({ primarySegment: 'Independent retailers' }, 'completed', {})).toBe(true);
  });

  it('regenerates stale or revision-requested findings', () => {
    expect(isReusableStageResult({ primarySegment: 'Independent retailers' }, 'completed', { stale: true })).toBe(false);
    expect(isReusableStageResult({ primarySegment: 'Independent retailers' }, 'needs_revision', {})).toBe(false);
  });

  it('does not reuse null, arrays, or primitive values as stage findings', () => {
    expect(isReusableStageResult(null, 'completed', {})).toBe(false);
    expect(isReusableStageResult([], 'completed', {})).toBe(false);
    expect(isReusableStageResult('findings', 'completed', {})).toBe(false);
  });
});
