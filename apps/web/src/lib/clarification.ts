export interface ClarificationPayload {
  ideaSummary: string;
  assumptions: string[];
  answers: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readClarificationAnswers(
  inputData: unknown,
  questionIds: readonly string[]
): Record<string, string> {
  if (!isRecord(inputData)) return {};
  const rawAnswers = isRecord(inputData.answers) ? inputData.answers : inputData;
  const answers: Record<string, string> = {};

  for (const questionId of questionIds) {
    const answer = rawAnswers[questionId];
    if (typeof answer === 'string' && answer.trim().length > 0) {
      answers[questionId] = answer;
    }
  }
  return answers;
}

export function buildClarificationPayload(
  ideaSummary: string,
  assumptionsText: string,
  answers: Record<string, string>,
  questionIds: readonly string[]
): ClarificationPayload {
  return {
    ideaSummary: ideaSummary.trim(),
    assumptions: assumptionsText.split('\n').map(value => value.trim()).filter(Boolean),
    answers: readClarificationAnswers({ answers }, questionIds),
  };
}
