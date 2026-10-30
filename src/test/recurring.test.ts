import { describe, expect, it } from 'vitest';
import {
  calculateDueOccurrenceDates,
  formatRecurrenceLabel,
  getDeterministicOccurrenceId,
  materializeDueRecurringExpenses,
} from '../features/split/recurring';
import type { RecurringExpenseTemplate } from '../features/split/types';
import type { Expense } from '../types/domain';

describe('Recurring Expense Engine (recurring.ts)', () => {
  const sampleTemplate: RecurringExpenseTemplate = {
    id: 'tpl-wifi',
    groupId: 'g-apt',
    description: 'High-speed Fiber Wi-Fi Recharge',
    category: 'Utilities',
    amountPaise: 80000, // ₹800.00
    payerId: 'riya',
    splitMode: 'equal',
    participantIds: ['riya', 'arjun', 'meera', 'kabir'],
    frequency: 'monthly',
    startDate: '2026-08-01',
    dayOfMonth: 1,
    active: true,
    createdAt: '2026-08-01T00:00:00Z',
  };

  it('computes correct due occurrence dates for monthly recurrence', () => {
    // From 2026-08-01 to 2026-10-23, should produce 3 occurrences: Aug 1, Sep 1, Oct 1
    const dueDates = calculateDueOccurrenceDates(sampleTemplate, '2026-10-23');
    expect(dueDates).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
  });

  it('respects sinceDate / lastMaterializedDate to only generate subsequent dates', () => {
    // If Aug 1 was already materialized, only Sep 1 and Oct 1 should be due
    const dueDates = calculateDueOccurrenceDates(
      sampleTemplate,
      '2026-10-23',
      '2026-08-01'
    );
    expect(dueDates).toEqual(['2026-09-01', '2026-10-01']);
  });

  it('materializes due occurrences with deterministic IDs and calculated shares', () => {
    const existingExpenses: Expense[] = [];
    const result = materializeDueRecurringExpenses(
      [sampleTemplate],
      existingExpenses,
      '2026-10-23'
    );

    expect(result.newExpenses).toHaveLength(3);
    expect(result.newExpenses[0].id).toBe(
      getDeterministicOccurrenceId('tpl-wifi', '2026-08-01')
    );
    expect(result.newExpenses[1].id).toBe(
      getDeterministicOccurrenceId('tpl-wifi', '2026-09-01')
    );
    expect(result.newExpenses[2].id).toBe(
      getDeterministicOccurrenceId('tpl-wifi', '2026-10-01')
    );

    // Each occurrence must satisfy the paisa invariant
    for (const exp of result.newExpenses) {
      expect(exp.amountPaise).toBe(80000);
      expect(exp.memberShares).toHaveLength(4);
      expect(exp.memberShares.reduce((a, b) => a + b.amountPaise, 0)).toBe(80000);
    }

    expect(result.updatedTemplates[0].lastMaterializedDate).toBe('2026-10-01');
  });

  it('guarantees IDEMPOTENCY: second run on same date generates ZERO duplicates', () => {
    const firstRun = materializeDueRecurringExpenses(
      [sampleTemplate],
      [],
      '2026-10-23'
    );
    expect(firstRun.newExpenses).toHaveLength(3);

    // Second run with the previous expenses and updated template
    const secondRun = materializeDueRecurringExpenses(
      firstRun.updatedTemplates,
      firstRun.newExpenses,
      '2026-10-23'
    );

    expect(secondRun.newExpenses).toHaveLength(0); // ZERO duplicates!
  });

  it('formats recurrence labels accurately', () => {
    expect(formatRecurrenceLabel(sampleTemplate)).toBe('Monthly on the 1st');

    const weeklyTemplate: RecurringExpenseTemplate = {
      ...sampleTemplate,
      frequency: 'weekly',
      dayOfWeek: 5, // Friday
    };
    expect(formatRecurrenceLabel(weeklyTemplate)).toBe('Weekly on Friday');
  });

  it('catches up after more than one year offline', () => {
    const dueDates = calculateDueOccurrenceDates(sampleTemplate, '2028-10-23');
    expect(dueDates).toContain('2028-10-01');
    expect(dueDates).toHaveLength(27);
  });
});
