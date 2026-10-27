import { describe, expect, it } from 'vitest';
import { TargetCustomerSchema } from '../services/stages.service';

describe('Target Customer AI result schema', () => {
  it('rejects empty or incomplete generated results', () => {
    expect(TargetCustomerSchema.safeParse({}).success).toBe(false);
  });

  it('accepts the complete target customer finding shape', () => {
    const result = TargetCustomerSchema.safeParse({
      primarySegment: 'Independent specialty retailers',
      buyerVsUser: 'The owner is usually both buyer and user.',
      characteristics: ['One to three locations'],
      painPoints: ['Manual inventory ordering'],
      existingAlternatives: ['Spreadsheets'],
      onlineCommunities: ['Independent Retail Forum'],
      acquisitionChannels: ['POS app marketplaces'],
      willingnessToPay: {
        estimate: '$99-149/month',
        reasoning: 'Requires validation with customer interviews.',
        confidence: 'low',
        disclaimer: 'Illustrative estimate.',
      },
      assumptions: ['Retailers can provide sales history.'],
    });

    expect(result.success).toBe(true);
  });
});
