import { describe, expect, it } from 'vitest';
import { getConversationTitle } from '../routes/chat';

describe('Copilot conversation titles', () => {
  it('normalizes whitespace in the first message', () => {
    expect(getConversationTitle('  Why is\n\t the viability score low?  '))
      .toBe('Why is the viability score low?');
  });

  it('uses a default title for an empty message', () => {
    expect(getConversationTitle(' \n\t ')).toBe('New conversation');
  });

  it('truncates titles to 120 characters with an ellipsis', () => {
    expect(getConversationTitle('x'.repeat(121))).toBe(`${'x'.repeat(117)}…`);
  });
});
