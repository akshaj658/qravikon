export function isReusableStageResult(
  resultData: unknown,
  status: string | undefined,
  inputData: unknown
): boolean {
  if (
    typeof resultData !== 'object'
    || resultData === null
    || Array.isArray(resultData)
    || Object.keys(resultData).length === 0
  ) {
    return false;
  }

  const stageInput = typeof inputData === 'object' && inputData !== null && !Array.isArray(inputData)
    ? inputData as Record<string, unknown>
    : {};
  return stageInput.stale !== true && status !== 'needs_revision';
}
