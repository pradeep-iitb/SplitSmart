import { describe, expect, it } from 'vitest';
import { createManualExpense } from '../features/split/manualExpense';
import { validateManualExpense } from '../features/split/validation';
import type { ManualExpenseDraft } from '../features/split/types';

describe('Manual Expense Creation (manualExpense.ts)', () => {
  const groupMembers = ['riya', 'arjun', 'meera', 'kabir'];

  it('creates a valid manual expense with equal split and satisfies all invariants', () => {
    const draft: ManualExpenseDraft = {
      groupId: 'g-test',
      description: 'Groceries at Supermarket',
      category: 'Groceries',
      date: '2026-10-23',
      payerId: 'riya',
      amountPaise: 120000, // ₹1,200.00
      splitMode: 'equal',
      participantIds: ['riya', 'arjun', 'meera', 'kabir'],
    };

    const expense = createManualExpense(draft, groupMembers);

    expect(expense.description).toBe('Groceries at Supermarket');
    expect(expense.payerId).toBe('riya');
    expect(expense.amountPaise).toBe(120000);
    expect(expense.splitMode).toBe('equal');
    expect(expense.memberShares).toHaveLength(4);

    // Invariant: sum of shares === amountPaise
    const shareSum = expense.memberShares.reduce((a, b) => a + b.amountPaise, 0);
    expect(shareSum).toBe(120000);
    expect(expense.memberShares.every((s) => s.amountPaise === 30000)).toBe(true);
  });

  it('creates a manual expense with custom shares split (e.g. 3:1)', () => {
    const draft: ManualExpenseDraft = {
      groupId: 'g-test',
      description: 'Shared Taxi Cab',
      category: 'Travel',
      date: '2026-10-24',
      payerId: 'arjun',
      amountPaise: 40000, // ₹400.00
      splitMode: 'shares',
      participantIds: ['arjun', 'meera'],
      sharesWeights: {
        arjun: 3,
        meera: 1,
      },
    };

    const expense = createManualExpense(draft, groupMembers);
    const arjunShare = expense.memberShares.find((s) => s.memberId === 'arjun')?.amountPaise;
    const meeraShare = expense.memberShares.find((s) => s.memberId === 'meera')?.amountPaise;

    expect(arjunShare).toBe(30000);
    expect(meeraShare).toBe(10000);
    expect(arjunShare! + meeraShare!).toBe(40000);
  });

  it('rejects invalid drafts with descriptive validation errors', () => {
    const invalidDraft: ManualExpenseDraft = {
      groupId: 'g-test',
      description: '', // empty description
      category: 'Other',
      date: 'invalid-date',
      payerId: 'unknown-person',
      amountPaise: -500, // negative amount
      splitMode: 'equal',
      participantIds: [],
    };

    const issues = validateManualExpense(invalidDraft, groupMembers);
    expect(issues.some((i) => i.code === 'EMPTY_DESCRIPTION')).toBe(true);
    expect(issues.some((i) => i.code === 'INVALID_AMOUNT')).toBe(true);
    expect(issues.some((i) => i.code === 'INVALID_PAYER')).toBe(true);
    expect(issues.some((i) => i.code === 'INVALID_DATE')).toBe(true);
    expect(issues.some((i) => i.code === 'NO_PARTICIPANTS')).toBe(true);

    // Attempting to create should throw
    expect(() => createManualExpense(invalidDraft, groupMembers)).toThrowError();
  });
});
