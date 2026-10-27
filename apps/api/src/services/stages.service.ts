import { z } from 'zod';
import { generateStructuredOutput, streamText, ChatMessage } from './ai.service';
import { SearchResponse } from './research.service';
import { features } from '../config/env';



// ─── Shared schemas ────────────────────────────────────────────────────────

export const SourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  summary: z.string(),
  retrievedAt: z.string(),
  publishedDate: z.string().optional(),
  verified: z.boolean().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

// ─── Stage 1: Idea Clarification ──────────────────────────────────────────

export const IdeaClarificationSchema = z.object({
  ideaSummary: z.string().describe('One-sentence restatement of the idea'),
  coreAssumptions: z.array(z.string()).describe('Key assumptions the idea depends on'),
  missingInformation: z.array(z.string()).describe('Information that would help validate this'),
  clarificationQuestions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    why: z.string().describe('Why this question matters'),
    category: z.enum(['customer', 'geography', 'pricing', 'distribution', 'model', 'alternatives']),
  })).max(3),
  customerHypothesis: z.string().describe('Who is most likely the primary customer'),
  businessModelAssumptions: z.array(z.string()),
});

export type IdeaClarification = z.infer<typeof IdeaClarificationSchema>;

export async function analyzeIdea(idea: string, projectName: string): Promise<IdeaClarification> {
  return generateStructuredOutput(
    IdeaClarificationSchema,
    [
      {
        role: 'system',
        content: `You are a rigorous startup validation advisor helping founders stress-test their ideas.
Your job is to extract assumptions, identify gaps, and ask sharp clarifying questions.
Be precise and specific. Do not invent information. Do not ask obvious questions.
Return valid JSON matching the requested schema.`,
      },
      {
        role: 'user',
        content: `Project: "${projectName}"
Idea: "${idea}"

Analyze this startup idea and return:
1. A clear one-sentence restatement
2. The 3-5 core assumptions it depends on
3. What information is missing to validate it
4. Exactly 2-3 targeted clarification questions (not obvious ones)
5. A customer hypothesis
6. Business model assumptions`,
      },
    ]
  );
}

// ─── Stage 2: Problem & Viability ─────────────────────────────────────────

export const ViabilitySchema = z.object({
  problemSeverity: z.number().min(1).max(10),
  problemFrequency: z.string(),
  urgency: z.string(),
  currentWorkarounds: z.array(z.string()),
  vitaminOrPainkiller: z.enum(['vitamin', 'painkiller', 'unclear']),
  vitaminOrPainkillerReason: z.string(),
  topRisksOfFailure: z.array(z.string()).max(5),
  viabilityScore: z.number().min(1).max(10),
  viabilityRationale: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  uncertainties: z.array(z.string()),
  disclaimer: z.string(),
});

export type Viability = z.infer<typeof ViabilitySchema>;

export async function analyzeViability(
  idea: string,
  clarification: IdeaClarification
): Promise<Viability> {
  return generateStructuredOutput(
    ViabilitySchema,
    [
      {
        role: 'system',
        content: `You are a startup due-diligence analyst. Evaluate problem-solution fit honestly.
Do not be overly optimistic. Label estimates clearly. Return valid JSON.`,
      },
      {
        role: 'user',
        content: `Idea: "${idea}"
Summary: "${clarification.ideaSummary}"
Customer hypothesis: "${clarification.customerHypothesis}"
Assumptions: ${JSON.stringify(clarification.coreAssumptions)}

Evaluate:
- Problem severity (1-10)
- How frequently the problem occurs
- Urgency
- Current workarounds people use
- Is this a vitamin (nice-to-have) or painkiller (must-have)?
- Top reasons this idea might fail
- Overall viability score (1-10) with rationale
- Your confidence level and key uncertainties`,
      },
    ]
  );
}

// ─── Stage 3: Target Customer ─────────────────────────────────────────────

export const TargetCustomerSchema = z.object({
  primarySegment: z.string(),
  buyerVsUser: z.string().describe('Who pays vs who uses'),
  characteristics: z.array(z.string()),
  painPoints: z.array(z.string()),
  existingAlternatives: z.array(z.string()),
  onlineCommunities: z.array(z.string()),
  acquisitionChannels: z.array(z.string()),
  willingnessToPay: z.object({
    estimate: z.string(),
    reasoning: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
    disclaimer: z.string(),
  }),
  assumptions: z.array(z.string()).describe('Items that are assumptions, not sourced facts'),
});

export type TargetCustomer = z.infer<typeof TargetCustomerSchema>;

export async function analyzeTargetCustomer(
  idea: string,
  clarification: IdeaClarification,
  clarificationAnswers: Record<string, string>
): Promise<TargetCustomer> {
  return generateStructuredOutput(
    TargetCustomerSchema,
    [
      {
        role: 'system',
        content: `You are a customer research specialist. Identify target customers precisely.
Distinguish sourced facts from assumptions. Never invent customer counts or willingness-to-pay data.
Return valid JSON.`,
      },
      {
        role: 'user',
        content: `Idea: "${idea}"
Customer hypothesis: "${clarification.customerHypothesis}"
Clarification answers: ${JSON.stringify(clarificationAnswers)}

Identify the target customer profile including segment, characteristics, pain points,
where they spend time online, how to reach them, and willingness to pay.
Clearly label what is an assumption vs. a known fact.`,
      },
    ]
  );
}

// ─── Stage 4: Market Sizing ────────────────────────────────────────────────

export const MarketSizingSchema = z.object({
  currency: z.string(),
  assumptions: z.object({
    totalPotentialCustomers: z.number(),
    segmentPercentage: z.number().min(0).max(100),
    geographyNote: z.string(),
    annualRevenuePerCustomer: z.number(),
    reachableShare: z.number().min(0).max(100),
    timeHorizonYears: z.number(),
  }),
  calculations: z.object({
    tam: z.number(),
    sam: z.number(),
    som: z.number(),
    tamFormula: z.string(),
    samFormula: z.string(),
    somFormula: z.string(),
  }),
  scenarios: z.object({
    low: z.object({ tam: z.number(), sam: z.number(), som: z.number() }),
    base: z.object({ tam: z.number(), sam: z.number(), som: z.number() }),
    high: z.object({ tam: z.number(), sam: z.number(), som: z.number() }),
  }),
  sources: z.array(SourceSchema),
  disclaimer: z.string(),
});

export type MarketSizing = z.infer<typeof MarketSizingSchema>;

export async function analyzeMarketSize(
  idea: string,
  customer: TargetCustomer,
  clarificationAnswers: Record<string, string>
): Promise<MarketSizing> {
  return generateStructuredOutput(
    MarketSizingSchema,
    [
      {
        role: 'system',
        content: `You are a market sizing analyst. Provide realistic, bottom-up estimates.
Always show your math with explicit formulas. Provide low/base/high scenarios.
Never fabricate market size data. Return valid JSON with numbers (not strings).`,
      },
      {
        role: 'user',
        content: `Idea: "${idea}"
Customer segment: "${customer.primarySegment}"
Geography from answers: ${JSON.stringify(clarificationAnswers)}
Willingness to pay: "${customer.willingnessToPay.estimate}"

Estimate TAM, SAM, SOM with:
- Clear assumptions (total customers, segment %, annual revenue per customer, reachable %)
- Explicit formulas
- Low, base, and high scenarios
- Currency in USD unless specified otherwise`,
      },
    ]
  );
}

// ─── Stage 5: Competitor Research ────────────────────────────────────────

export const CompetitorSchema = z.object({
  name: z.string(),
  type: z.enum(['direct', 'indirect', 'manual', 'spreadsheet', 'opensource']),
  description: z.string(),
  positioning: z.string(),
  keyFeatures: z.array(z.string()),
  pricing: z.string(),
  pricingVerified: z.boolean(),
  funding: z.string().optional(),
  fundingVerified: z.boolean(),
  customerComplaints: z.array(z.string()),
  source: SourceSchema.optional(),
});

export const CompetitorAnalysisSchema = z.object({
  competitors: z.array(CompetitorSchema),
  marketGaps: z.array(z.string()),
  competitiveDynamics: z.string(),
  disclaimer: z.string(),
});

export type CompetitorAnalysis = z.infer<typeof CompetitorAnalysisSchema>;

export async function analyzeCompetitors(
  idea: string,
  customer: TargetCustomer,
  researchResults?: SearchResponse[]
): Promise<CompetitorAnalysis> {
  const researchContext = researchResults
    ? `\n\nWeb research results:\n${researchResults
        .flatMap((r) => r.results)
        .map((r) => `Source: ${r.url}\nTitle: ${r.title}\nContent: ${r.content.slice(0, 500)}`)
        .join('\n\n---\n\n')}`
    : '';

  return generateStructuredOutput(
    CompetitorAnalysisSchema,
    [
      {
        role: 'system',
        content: `You are a competitive intelligence analyst. Identify real competitors honestly.
Never fabricate company data, URLs, pricing, or funding amounts.
Mark pricing and funding as unverified unless confirmed in the research.
Return valid JSON.`,
      },
      {
        role: 'user',
        content: `Idea: "${idea}"
Customer: "${customer.primarySegment}"
Existing alternatives mentioned: ${JSON.stringify(customer.existingAlternatives)}
${researchContext}

Find: direct competitors, indirect competitors, manual workarounds, spreadsheet solutions, open-source alternatives.
For each: description, positioning, features, pricing (mark if unverified), funding (mark if unverified), customer complaints.`,
      },
    ]
  );
}

// ─── Stage 6: Differentiation ─────────────────────────────────────────────

export const DifferentiationSchema = z.object({
  comparisonAxes: z.array(z.object({
    axis: z.string(),
    description: z.string(),
  })),
  strategies: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    positioning: z.string(),
    targetSegment: z.string(),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
    risks: z.array(z.string()),
  })).min(2).max(3),
  recommendedStrategyId: z.string(),
  recommendationRationale: z.string(),
});

export type Differentiation = z.infer<typeof DifferentiationSchema>;

export async function analyzeDifferentiation(
  idea: string,
  competitors: CompetitorAnalysis,
  customer: TargetCustomer
): Promise<Differentiation> {
  return generateStructuredOutput(
    DifferentiationSchema,
    [
      {
        role: 'system',
        content: `You are a product strategist specializing in positioning and differentiation.
Propose distinct, actionable strategies. Return valid JSON.`,
      },
      {
        role: 'user',
        content: `Idea: "${idea}"
Customer: "${customer.primarySegment}"
Competitors: ${JSON.stringify(competitors.competitors.map(c => ({ name: c.name, positioning: c.positioning, type: c.type })))}
Market gaps: ${JSON.stringify(competitors.marketGaps)}

Propose 2-3 differentiation strategies with pros, cons, and risks.
Identify 4-5 comparison axes (e.g., price, ease of use, specialization, feature depth, support).
Recommend the best strategy and explain why.`,
      },
    ]
  );
}

// ─── Stage 7: Go-to-Market ────────────────────────────────────────────────

export const GtmSchema = z.object({
  channels: z.array(z.object({
    name: z.string(),
    type: z.enum(['organic', 'paid', 'partnership', 'community', 'content', 'direct']),
    rationale: z.string(),
    estimatedCac: z.string(),
    effort: z.enum(['low', 'medium', 'high']),
    priority: z.number().min(1),
  })),
  first100Usersplan: z.object({
    weeks1to2: z.array(z.string()),
    weeks3to4: z.array(z.string()),
    months2to3: z.array(z.string()),
  }),
  outreachExperiments: z.array(z.object({
    name: z.string(),
    description: z.string(),
    successCriteria: z.string(),
    timeframe: z.string(),
  })),
  validationMilestones: z.array(z.object({
    milestone: z.string(),
    metric: z.string(),
    target: z.string(),
  })),
  disclaimer: z.string(),
});

export type Gtm = z.infer<typeof GtmSchema>;

export async function analyzeGtm(
  idea: string,
  customer: TargetCustomer,
  differentiation: Differentiation,
  selectedStrategyId: string,
  revisionFeedback?: string | null
): Promise<Gtm> {
  const strategy = differentiation.strategies.find(s => s.id === selectedStrategyId)
    || differentiation.strategies[0];

  return generateStructuredOutput(
    GtmSchema,
    [
      {
        role: 'system',
        content: `You are a go-to-market strategist for early-stage startups.
Be specific and actionable. Distinguish assumptions from measured results. Return valid JSON.`,
      },
      {
        role: 'user',
        content: `Idea: "${idea}"
Customer: "${customer.primarySegment}"
Acquisition channels already identified: ${JSON.stringify(customer.acquisitionChannels)}
Differentiation strategy: "${strategy?.name}" — ${strategy?.description}
${revisionFeedback ? `Revision feedback to address while preserving useful findings: "${revisionFeedback}"` : ''}

Design a go-to-market plan with:
- Top acquisition channels (rank by priority) with rationale and rough CAC estimates
- First 100 users plan (weeks 1-2, 3-4, months 2-3)
- 3-4 outreach experiments with success criteria
- Key validation milestones with measurable targets`,
      },
    ]
  );
}

// ─── Stage 8: Final Report ────────────────────────────────────────────────

export const FinalReportSchema = z.object({
  executiveSummary: z.string(),
  problemAndCustomer: z.string(),
  viabilityAssessment: z.string(),
  marketSizing: z.string(),
  competitorLandscape: z.string(),
  differentiation: z.string(),
  goToMarket: z.string(),
  keyRisks: z.array(z.string()),
  unvalidatedAssumptions: z.array(z.string()),
  recommendedExperiments: z.array(z.object({
    experiment: z.string(),
    hypothesis: z.string(),
    successCriteria: z.string(),
  })),
  verdict: z.enum(['GO', 'PIVOT', 'DROP']),
  verdictReason: z.string(),
  verdictConfidence: z.enum(['low', 'medium', 'high']),
  whatCouldChangeVerdict: z.string(),
  landingPageCopy: z.object({
    headline: z.string(),
    subheadline: z.string(),
    heroValue: z.string(),
    features: z.array(z.object({ title: z.string(), description: z.string() })),
    cta: z.string(),
    targetAudience: z.string(),
  }),
});

export type FinalReport = z.infer<typeof FinalReportSchema>;

export async function generateFinalReport(
  idea: string,
  stageData: {
    clarification?: IdeaClarification;
    viability?: Viability;
    customer?: TargetCustomer;
    marketSizing?: MarketSizing;
    competitors?: CompetitorAnalysis;
    differentiation?: Differentiation;
    gtm?: Gtm;
    selectedStrategyId?: string;
    stageStatuses: Array<{ stageKey: string; status: string; stale: boolean }>;
  }
): Promise<FinalReport> {
  const findings = [
    ['Idea Clarification', stageData.clarification],
    ['Problem & Viability', stageData.viability],
    ['Target Customer', stageData.customer],
    ['Market Sizing', stageData.marketSizing],
    ['Competitor Research', stageData.competitors],
    ['Differentiation', stageData.differentiation],
    ['Go-to-Market', stageData.gtm],
  ]
    .map(([stage, result]) => `${stage}: ${result ? JSON.stringify(result) : 'No current saved findings.'}`)
    .join('\n');

  return generateStructuredOutput(
    FinalReportSchema,
    [
      {
        role: 'system',
        content: `You are a senior startup analyst writing a comprehensive validation report.
Be honest, evidence-based, and actionable. Do not be falsely optimistic.
The verdict (GO/PIVOT/DROP) must be justified by evidence, not enthusiasm.
Do not invent missing findings or describe unapproved, skipped, incomplete, or stale stages as validated. State their limitations explicitly and reduce confidence when evidence is incomplete.
Return valid JSON.`,
      },
      {
        role: 'user',
        content: `Generate a final validation report for: "${idea}"

Stage status (the only approved/skipped signals are the saved statuses shown here):
${JSON.stringify(stageData.stageStatuses)}

Available stage findings (missing findings are explicitly marked; do not infer them):
${findings}

Selected differentiation strategy: ${stageData.selectedStrategyId ?? 'No saved selection.'}

Generate the complete report with executive summary, all sections, a cautious verdict (GO/PIVOT/DROP), explicit workflow limitations, and landing page copy. Treat completion of this workflow as an assessment, not proof that the business is validated.`,
      },
    ],
    { maxTokens: 6000 }
  );
}

// ─── Copilot ──────────────────────────────────────────────────────────────

export interface ProjectContext {
  projectName: string;
  idea: string;
  currentStage: number;
  approvedFindings: Record<string, unknown>;
  sources: Array<{ title: string; url: string; summary: string }>;
}

export async function* runCopilot(
  question: string,
  context: ProjectContext,
  history: ChatMessage[],
  researchEnabled: boolean
): AsyncGenerator<string> {
  const systemPrompt = `You are Qravikon Copilot, an AI assistant embedded in the Qravikon startup validation workspace.

You have full context of the user's project:
Project: "${context.projectName}"
Idea: "${context.idea}"
Current stage: ${context.currentStage}/8
Approved findings: ${JSON.stringify(context.approvedFindings, null, 2)}
Sources: ${JSON.stringify(context.sources.slice(0, 10))}

Guidelines:
- Answer in the context of this specific project
- Cite sources when making research-based claims  
- Distinguish facts, estimates, and recommendations
- Request confirmation before suggesting changes to approved decisions
- Be concise and editorial — this is a compact side panel, not a long essay
- If asked to run research, confirm that research is ${researchEnabled ? 'available' : 'not configured (TAVILY_API_KEY missing)'}`;

  yield* streamText([
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: question },
  ]);
}
