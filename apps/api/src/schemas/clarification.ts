import { z } from 'zod';

export const ClarificationAnswersSchema = z.record(z.string(), z.string());

export const ClarificationEditsSchema = z.object({
  ideaSummary: z.string().trim().min(10),
  assumptions: z.array(z.string().trim().min(1)),
  answers: ClarificationAnswersSchema,
});
