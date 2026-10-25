import { describe, expect, it } from 'vitest';
import { calculateSpendingAnalytics } from '../features/settlement/analytics';
import type { Expense, Member } from '../types/domain';
import mixedPayersFixture from './fixtures/expenses-mixed-payers.json';

describe('Spending Analytics Engine (analytics.ts)', () => {
  it('computes accurate totals and category breakdown from expenses', () => {
    const members = mixedPayersFixture.members as Member[];
    const expenses = mixedPayersFixture.expenses as Expense[];

    const analytics = calculateSpendingAnalytics(expenses, members);

    // Sum of all 10 expenses in the fixture:
    // 150000 + 400000 + 250000 + 1000000 + 600000 + 320000 + 75000 + 500000 + 180000 + 240000 = 3715000 paise (₹37,150.00)
    expect(analytics.totalSpentPaise).toBe(3715000);
    expect(analytics.expenseCount).toBe(10);
    expect(analytics.averagePerMemberPaise).toBe(Math.round(3715000 / 5));

    // Category breakdown check
    expect(analytics.categoryBreakdown.length).toBeGreaterThan(0);
    const sumCategoryPaise = analytics.categoryBreakdown.reduce(
      (sum, c) => sum + c.totalPaise,
      0
    );
    expect(sumCategoryPaise).toBe(3715000);

    // Member analytics check
    expect(analytics.memberAnalytics).toHaveLength(5);
    for (const ma of analytics.memberAnalytics) {
      expect(ma.netBalancePaise).toBe(ma.totalPaidPaise - ma.totalConsumedPaise);
    }

    // Spending by date check (chronologically sorted)
    expect(analytics.spendingByDate.length).toBeGreaterThan(0);
    for (let i = 1; i < analytics.spendingByDate.length; i++) {
      expect(analytics.spendingByDate[i].date >= analytics.spendingByDate[i - 1].date).toBe(true);
    }
  });
});
