import { STAGE_LABELS, STAGE_ORDER, type StageKey } from './utils';

export const DEMO_PROJECT = {
  id: 'demo',
  name: 'SmartStock AI',
  original_idea: 'Predict inventory shortages for small retailers using their historical sales data and AI forecasting.',
  idea_summary: 'An AI-powered inventory prediction tool for small retailers that reduces stockouts by forecasting demand from historical sales data.',
  assumptions: [
    'Small retailers are willing to pay for a SaaS solution',
    'Historical POS data is accessible via API or CSV',
    'Prediction accuracy of 80%+ is achievable with 3+ months of data',
    'Retailers currently lose 4-8% revenue to stockouts',
  ],
  current_stage: 0,
  overall_status: 'in_progress' as const,
  verdict: null,
  created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
};

export const DEMO_STAGES = {
  idea_clarification: {
    status: 'approved' as const,
    result: {
      ideaSummary: 'An AI inventory prediction SaaS for small retailers to reduce stockouts using historical sales data.',
      coreAssumptions: [
        'Retailers lose significant revenue to stockouts',
        'Small retailers have accessible POS/sales data',
        'AI forecasting can outperform manual methods',
        'Retailers will pay $99-299/mo for this solution',
      ],
      missingInformation: ['Exact willingness-to-pay data', 'Integration complexity with existing POS systems'],
      clarificationQuestions: [
        {
          id: 'q1',
          question: 'What type of small retailer are you targeting — grocery, apparel, specialty?',
          why: 'Inventory patterns differ dramatically by category, affecting model accuracy',
          category: 'customer' as const,
        },
        {
          id: 'q2',
          question: 'Will this integrate with existing POS systems or require manual CSV uploads?',
          why: 'Integration depth determines both adoption friction and engineering scope',
          category: 'distribution' as const,
        },
      ],
      customerHypothesis: 'Independent grocery and specialty retailers with 1-5 locations doing $500K-$5M annual revenue',
      businessModelAssumptions: ['Monthly SaaS subscription', 'Tiered by number of SKUs or locations'],
    },
  },
  viability: {
    status: 'approved' as const,
    result: {
      problemSeverity: 7,
      problemFrequency: 'Stockouts occur weekly; major restocking decisions are made 2-3x per week',
      urgency: 'High — each stockout is immediate lost revenue with customer satisfaction impact',
      currentWorkarounds: [
        'Manual intuition and experience',
        'Basic reorder point formulas in spreadsheets',
        'Expensive ERP systems out of reach for small retailers',
      ],
      vitaminOrPainkiller: 'painkiller' as const,
      vitaminOrPainkillerReason: 'Stockouts cause immediate, quantifiable revenue loss — retailers are actively losing money without a solution.',
      topRisksOfFailure: [
        'POS data quality is too poor for accurate predictions',
        'Adoption friction — retailers resistant to new software',
        'Large ERPs (QuickBooks Commerce, Square) add this feature for free',
        'Sales cycles too long given small retailer budget constraints',
      ],
      viabilityScore: 7,
      viabilityRationale: 'Clear painkiller with quantifiable problem, but market is fragmented and integration complexity is high.',
      confidence: 'medium' as const,
      uncertainties: ['Actual willingness to pay', 'POS data accessibility'],
      disclaimer: 'This is an AI-assisted estimate, not a guarantee.',
    },
  },
  target_customer: {
    status: 'approved' as const,
    result: {
      primarySegment: 'Independent specialty retailers (grocery, pet supply, hardware) with 1-3 locations',
      buyerVsUser: 'Buyer is the owner/manager; user is the same person or a store manager',
      characteristics: [
        '$300K-$3M annual revenue',
        'Currently using basic POS (Square, Clover, Lightspeed)',
        'Losing 3-7% revenue to stockouts or overstock',
        'Has 500-5000 active SKUs',
      ],
      painPoints: [
        'Over-ordering to compensate for uncertainty',
        'Stockouts during high-demand periods',
        'Time spent on manual ordering (3-5 hrs/week)',
        'No visibility into seasonal demand patterns',
      ],
      existingAlternatives: [
        'Spreadsheet models (manual, error-prone)',
        'QuickBooks Commerce',
        'Cin7',
        'Lightspeed Analytics (basic)',
      ],
      onlineCommunities: [
        'r/retailoperations',
        'Independent Retail Forum',
        'Specialty Food Association groups',
        'Lightspeed community forums',
      ],
      acquisitionChannels: [
        'POS system app marketplaces (Square, Lightspeed)',
        'Direct outreach via LinkedIn',
        'Small Business Development Centers',
        'Trade shows (NGA Show, Specialty Food Expo)',
      ],
      willingnessToPay: {
        estimate: '$99-249/month',
        reasoning: 'Based on comparable SaaS tools in SMB retail ops; ROI positive if it recovers even 1% of stockout losses',
        confidence: 'medium' as const,
        disclaimer: 'This is an estimate — validate with 10 real customer conversations before pricing.',
      },
      assumptions: [
        'Retailer has 6+ months of accessible sales history',
        'Owner is tech-comfortable enough to use SaaS',
        'Current tools don\'t already provide this',
      ],
    },
  },
  market_sizing: {
    status: 'approved' as const,
    result: {
      currency: 'USD',
      assumptions: {
        totalPotentialCustomers: 1_000_000,
        segmentPercentage: 8,
        geographyNote: 'US small independent retailers with 1-5 locations',
        annualRevenuePerCustomer: 1800,
        reachableShare: 3,
        timeHorizonYears: 3,
      },
      calculations: {
        tam: 1_800_000_000,
        sam: 144_000_000,
        som: 4_320_000,
        tamFormula: '1,000,000 customers × $1,800/yr = $1.8B',
        samFormula: 'TAM × 8% segment = $144M',
        somFormula: 'SAM × 3% reachable in 3 years = $4.3M',
      },
      scenarios: {
        low: { tam: 1_200_000_000, sam: 72_000_000, som: 1_440_000 },
        base: { tam: 1_800_000_000, sam: 144_000_000, som: 4_320_000 },
        high: { tam: 2_500_000_000, sam: 225_000_000, som: 9_000_000 },
      },
      sources: [],
      disclaimer: 'Market sizing is based on estimates and assumptions. It does not prove customer demand.',
    },
  },
  competitors: {
    status: 'approved' as const,
    result: {
      competitors: [
        {
          name: 'Cin7 Omni',
          type: 'direct' as const,
          description: 'Cloud inventory management with demand planning',
          positioning: 'Mid-market inventory management with multi-channel support',
          keyFeatures: ['Demand forecasting', 'Multi-channel sync', 'POS integrations'],
          pricing: '$349/mo+',
          pricingVerified: false,
          funding: 'Bootstrapped then acquired by Access Group',
          fundingVerified: false,
          customerComplaints: ['Complex setup', 'Expensive for small businesses', 'Slow customer support'],
        },
        {
          name: 'Lightspeed Analytics',
          type: 'indirect' as const,
          description: 'Built-in analytics for Lightspeed POS customers',
          positioning: 'POS-native reporting, not standalone',
          keyFeatures: ['Basic trend reports', 'Sales analytics', 'Limited forecasting'],
          pricing: 'Included with Lightspeed subscription',
          pricingVerified: true,
          fundingVerified: false,
          customerComplaints: ['Shallow forecasting', 'No cross-channel view', 'Basic insights only'],
        },
        {
          name: 'Excel / Google Sheets',
          type: 'manual' as const,
          description: 'Manual spreadsheet-based inventory tracking',
          positioning: 'Free but requires manual maintenance',
          keyFeatures: ['Fully customizable', 'Free', 'No learning curve'],
          pricing: 'Free',
          pricingVerified: true,
          fundingVerified: false,
          customerComplaints: ['Error-prone', 'Time-consuming', 'No automation', 'Hard to scale'],
        },
      ],
      marketGaps: [
        'No affordable AI-native solution for single-location independents',
        'Existing tools require complex setup or expensive consultants',
        'No tool focused specifically on specialty/niche category retailers',
      ],
      competitiveDynamics: 'Market is served at the high end (ERPs) and low end (spreadsheets) with a gap in the $100-300/mo range for AI-powered predictions.',
      disclaimer: 'Competitor data may be incomplete or outdated. Verify independently.',
    },
  },
  differentiation: {
    status: 'approved' as const,
    result: {
      comparisonAxes: [
        { axis: 'Price', description: 'Monthly subscription cost' },
        { axis: 'Setup complexity', description: 'Time to first value' },
        { axis: 'AI sophistication', description: 'Prediction accuracy and automation' },
        { axis: 'SMB focus', description: 'Tailored for small retailers vs. enterprise' },
      ],
      strategies: [
        {
          id: 's1',
          name: 'POS-Native Integration Specialist',
          description: 'Deep 1-click integrations with the 5 most popular SMB POS systems',
          positioning: 'The inventory AI that works with your existing POS — live in 5 minutes',
          targetSegment: 'Square, Lightspeed, and Clover users',
          pros: ['Lowest setup friction', 'Clear distribution through app marketplaces'],
          cons: ['Platform dependency risk', 'Constrained by POS API limits'],
          risks: ['POS vendor could build competing feature'],
        },
        {
          id: 's2',
          name: 'Category Specialist — Grocery & Specialty',
          description: 'Pre-trained models optimized for perishables and specialty category dynamics',
          positioning: 'Inventory AI built for the complexity of grocery and specialty retail',
          targetSegment: 'Grocery, deli, specialty food, pet supply',
          pros: ['Higher accuracy for niche categories', 'Premium pricing justified'],
          cons: ['Narrower market', 'Longer model training period'],
          risks: ['Market too small for venture scale'],
        },
      ],
      recommendedStrategyId: 's1',
      recommendationRationale: 'Distribution through POS marketplaces solves the acquisition problem and lowest friction setup is the strongest response to spreadsheet inertia.',
    },
  },
  gtm: {
    status: 'completed' as const,
    result: {
      channels: [
        {
          name: 'Square App Marketplace',
          type: 'partnership' as const,
          rationale: 'Access to 4M+ Square merchants with native trust and one-click install',
          estimatedCac: '$80-150',
          effort: 'high' as const,
          priority: 1,
        },
        {
          name: 'LinkedIn Direct Outreach',
          type: 'direct' as const,
          rationale: 'Retail owners and managers are active on LinkedIn; personal outreach converts well',
          estimatedCac: '$200-400',
          effort: 'medium' as const,
          priority: 2,
        },
        {
          name: 'Content — Retail Operations Blog',
          type: 'content' as const,
          rationale: 'SEO for "inventory forecasting for small retailers" — long-term moat',
          estimatedCac: '$50-100 at scale',
          effort: 'medium' as const,
          priority: 3,
        },
      ],
      first100Usersplan: {
        weeks1to2: [
          'Manual outreach to 50 indie retailers in target categories',
          'Offer 60-day free trial in exchange for weekly feedback calls',
          'Apply to Square and Lightspeed app marketplaces',
        ],
        weeks3to4: [
          'Run 5 onboarding calls per week — identify friction points',
          'Publish 2 case studies from early users',
          'Join 3 retail-owner communities and contribute (no pitching)',
        ],
        months2to3: [
          'Launch on Square Marketplace (if approved)',
          'Convert 20 trial users to paid at $149/mo',
          'Hire first part-time customer success person',
        ],
      },
      outreachExperiments: [
        {
          name: 'Cold LinkedIn DM',
          description: 'Personalized message to 100 retail owners referencing their specific category',
          successCriteria: '≥10% reply rate, ≥3% demo booking',
          timeframe: '2 weeks',
        },
        {
          name: 'Trade Association Partnership',
          description: 'Partner with NGA (National Grocers Association) for member discounts',
          successCriteria: '≥50 qualified leads from partnership',
          timeframe: '8 weeks',
        },
      ],
      validationMilestones: [
        { milestone: 'Problem validation', metric: 'Customer interviews', target: '20 discovery calls with target customers' },
        { milestone: 'Product validation', metric: 'Trial activation rate', target: '≥60% of trials connect POS data' },
        { milestone: 'Revenue validation', metric: 'Paid conversion', target: '20 paying customers at $149/mo' },
      ],
      disclaimer: 'CAC estimates are rough assumptions, not measured results.',
    },
  },
  final_report: {
    status: 'completed' as const,
    result: {
      verdict: 'PIVOT',
      verdictReason: 'The stockout problem is credible, but willingness to pay, POS data quality, and integration effort still need direct validation.',
      verdictConfidence: 'Medium-low',
      executiveSummary: 'SmartStock AI could help independent retailers make better replenishment decisions using their existing sales history. The sample assessment supports testing a focused, POS-native offer, but it does not establish product-market fit or verified demand.',
      problemAndCustomer: 'Independent specialty retailers with 1–3 locations often rely on spreadsheets and owner intuition to order inventory. Stockouts and over-ordering tie up cash and can damage customer trust. The owner or store manager is typically both buyer and day-to-day user.',
      marketOpportunity: 'The illustrative serviceable market is approximately $144M annually, with a three-year obtainable-market scenario of about $4.3M. These are assumption-driven estimates, not measured market demand.',
      marketAssumptions: [
        '1,000,000 potential US independent retail businesses, with 8% matching the initial segment.',
        'Annual revenue per customer modeled at $1,800 ($150/month).',
        'A 3% reachable share of the serviceable segment over three years.',
        'All market figures are sample assumptions and require independent validation.',
      ],
      competitorAnalysis: 'Alternatives range from free spreadsheets to broader inventory suites such as Cin7 Omni and built-in Lightspeed analytics. The opportunity to test is simpler forecasting for smaller retailers; pricing, competitor capabilities, and customer complaints must be verified directly.',
      differentiationStrategy: 'Lead with a fast, POS-native setup for Square, Lightspeed, and Clover users. Treat category-specific forecasting for grocery and specialty retail as a focused follow-on advantage after sufficient data is available.',
      goToMarketStrategy: 'Interview 20 target retailers, manually recruit an initial pilot cohort, and test a POS marketplace route alongside targeted owner outreach. Measure POS connection completion, forecast usefulness, and paid conversion before investing in broad acquisition.',
      keyRisks: [
        'Sales history may be incomplete or inconsistent, limiting forecast quality.',
        'Retailers may not pay enough to support integrations and ongoing customer support.',
        'POS platforms or larger inventory vendors may add comparable forecasting.',
        'Early CAC estimates and marketplace reach have not been measured.',
      ],
      validationMilestones: [
        { milestone: 'Problem validation', target: 'Complete 20 interviews; at least 12 independently describe recurring ordering pain.' },
        { milestone: 'Data feasibility', target: 'Connect usable sales history for 10 pilot retailers and measure setup time.' },
        { milestone: 'Value and pricing', target: 'Run a paid pilot; test whether customers will pay around $149/month.' },
      ],
      recommendedNextSteps: [
        'Interview independent grocery, pet supply, and hardware retailers before building deeper integrations.',
        'Request representative, permissioned POS exports and measure data-cleaning effort.',
        'Prototype a weekly reorder recommendation and compare it with each retailer’s current process.',
        'Ask pilot users for a paid commitment rather than relying on stated interest.',
      ],
      whatCouldChangeVerdict: 'Evidence of repeated use, usable POS data, measurable reductions in stockouts or excess inventory, and paid pilot commitments could support a stronger recommendation. If interviews show that built-in POS tools are sufficient, narrow the segment or reconsider the offer.',
      unvalidatedAssumptions: [
        'Stockouts cause enough recoverable loss to justify a separate subscription.',
        'Target retailers can provide at least six months of usable sales history.',
        'A $99–249 monthly price is acceptable to the initial segment.',
      ],
      workflowLimitations: [
        'This is a fictional sample project. No customer interviews, integrations, or live market research were conducted.',
        'Market size, competitor descriptions, pricing, and channel estimates are illustrative assumptions.',
      ],
      stageStatuses: STAGE_ORDER.map(stageKey => ({
        stageKey,
        status: stageKey === 'gtm' || stageKey === 'final_report' ? 'completed' : 'approved',
        stale: false,
      })),
      recommendedExperiments: [
        { experiment: 'Interview 20 independent retailers about their last stockout and ordering process.', hypothesis: 'Owners can describe recurring, costly inventory decisions.', successCriteria: 'At least 12 report a recent, material stockout or overstock issue.' },
        { experiment: 'Run a concierge reorder pilot with 10 retailers using their own sales exports.', hypothesis: 'A lightweight recommendation can improve decisions before a full integration exists.', successCriteria: 'At least 6 retailers use the recommendation weekly for four weeks.' },
        { experiment: 'Offer a paid pilot at $149/month after the trial.', hypothesis: 'Recoverable inventory losses justify a recurring subscription.', successCriteria: 'At least 3 of 10 pilot retailers agree to pay.' },
      ],
    },
  },
};

export const DEMO_MESSAGES = [
  {
    id: 'demo-msg-1',
    project_id: 'demo',
    user_id: 'demo',
    role: 'user' as const,
    content: 'Why did you score this problem 7/10 and not higher?',
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-msg-2',
    project_id: 'demo',
    user_id: 'demo',
    role: 'assistant' as const,
    content: `The 7/10 viability score reflects a genuine problem with measurable impact, but three factors prevent a higher score:

**1. Data quality risk.** Your model's accuracy depends on clean historical POS data — which many small retailers don't have in a usable state. If the first 30% of onboarded retailers have poor data, your prediction accuracy suffers, and word-of-mouth turns negative.

**2. Platform dependency.** Your strongest GTM path runs through POS marketplaces (Square, Lightspeed). If Square adds basic demand forecasting to its core plan — something it's actively doing — you lose your distribution channel and become a direct competitor with a much larger player.

**3. Adoption inertia.** Spreadsheets are free and familiar. Your core competition isn't Cin7 — it's "good enough" manual processes. Overcoming that requires strong proof of ROI, which takes time to demonstrate.

A score of 8+ would require validated willingness-to-pay data and at least one POS marketplace partnership confirmed. Want me to outline what data would move the score?`,
    created_at: new Date(Date.now() - 29 * 60 * 1000).toISOString(),
  },
];

export function createDemoCopilotReply(question: string, activeStage: StageKey): string {
  const prompt = question.toLocaleLowerCase();
  const stageLabel = STAGE_LABELS[activeStage];
  let response: string;

  if (/market|tam|sam|som|size|opportunity/.test(prompt)) {
    response = `The sample model estimates a **$1.8B TAM**, **$144M SAM**, and **$4.3M three-year SOM**. It assumes 1,000,000 potential US retailers, an 8% initial segment, $1,800 annual revenue per customer, and 3% reach of the serviceable segment. These are illustrative assumptions—not verified market data.`;
  } else if (/compet|alternative|cin7|lightspeed|spreadsheet/.test(prompt)) {
    response = `The sample compares **Cin7 Omni** (broader inventory management), **Lightspeed Analytics** (POS-native reporting), and **spreadsheets** (free but manual). The proposed opening is simpler forecasting for smaller specialty retailers. Competitor pricing and capabilities should be checked directly before making a real decision.`;
  } else if (/customer|buyer|segment|who|retailer/.test(prompt)) {
    response = `The sample targets **independent specialty retailers with 1–3 locations**, such as grocery, pet supply, and hardware stores. The owner or store manager is usually both buyer and user. The next test is to interview 20 retailers and learn how they order today, what data they can share, and whether the problem has a budget.`;
  } else if (/different|strategy|position|advantage/.test(prompt)) {
    response = `The sample’s recommended position is **POS-native setup**: connect to Square, Lightspeed, or Clover with minimal setup, then provide practical reorder guidance. The trade-off is platform dependency, so the first validation should test one POS integration and confirm the platform permits the needed data access.`;
  } else if (/go.to.market|acqui|channel|first users|launch|sell/.test(prompt)) {
    response = `The sample go-to-market plan starts with direct interviews and a small concierge pilot, then tests a POS marketplace listing and targeted owner outreach. Proposed milestones include 20 discovery calls, 10 usable data connections, and 3 paid pilot commitments. These are goals to test, not achieved results.`;
  } else if (/price|pay|pricing|revenue/.test(prompt)) {
    response = `The sample pricing hypothesis is **$99–249/month**, with $149/month used in the market model. That is not validated willingness to pay. Ask target retailers for a paid pilot commitment after they have used a recommendation, rather than relying only on survey interest.`;
  } else if (/risk|viab|score|problem/.test(prompt)) {
    response = `The sample gives the problem **7/10 viability**: stockouts can cause immediate lost sales, but data quality, adoption friction, and POS-platform dependency remain material risks. A stronger case would require usable retailer data, measurable improvement, and paid pilot commitments.`;
  } else if (/report|verdict|recommend|next step/.test(prompt)) {
    response = `The sample report recommends **PIVOT**: test a focused POS-native offer before scaling. Start with retailer interviews, permissioned sales exports, and a concierge pilot. The fictional sample contains no live customer research, verified competitor checks, or measured results.`;
  } else {
    response = `For **${stageLabel}**, the sample focuses on SmartStock AI: inventory forecasting for independent retailers using historical sales data. The current hypothesis is that a simple, POS-connected reorder recommendation can reduce stockouts. Ask about the market, target customers, alternatives, pricing, risks, or launch plan for a more specific walkthrough.`;
  }

  return `**Demo Copilot · deterministic sample response**\n\n${response}\n\n*Context: ${stageLabel}. This response uses the demo’s sample findings; it was not generated by a live AI service.*`;
}
