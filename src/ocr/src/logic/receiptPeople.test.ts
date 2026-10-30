import { describe, expect, it } from 'vitest';
import { detectReceiptPeople, isKnownGroupMember } from './receiptPeople';

describe('explicit receipt names', () => {
  it('finds labelled payer and customer names without treating items as people', () => {
    const people = detectReceiptPeople({
      lines: [
        { text: 'Paid by: Meera Shah', confidence: 0.94 },
        { text: 'Customer: Dev', confidence: 0.88 },
        { text: 'Paneer Pizza 320.00', confidence: 0.99 },
        { text: 'Payer: Card', confidence: 0.99 },
        { text: 'Bill to: Blurry Name', confidence: 0.2 },
      ] as never,
    });
    expect(people).toEqual([
      { name: 'Meera Shah', role: 'payer' },
      { name: 'Dev', role: 'customer' },
    ]);
    expect(isKnownGroupMember('Meera Shah', ['Meera Shah', 'Arjun'])).toBe(true);
    expect(isKnownGroupMember('Dev', ['Meera Shah', 'Arjun'])).toBe(false);
  });
});
