import type {
  Category,
  Expense,
  GroupAnalyticsSummary,
  Member,
  MemberSpendingAnalytics,
  Paise,
} from '../../types/domain';

const ALL_CATEGORIES: Category[] = [
  'Food',
  'Groceries',
  'Travel',
  'Utilities',
  'Entertainment',
  'Other',
];

/**
 * PS Point 16: Spending Analytics
 * Aggregates group expenses into category distributions, member payer vs consumer stats,
 * and spending timeline data.
 */
export function calculateSpendingAnalytics(
  expenses: Expense[],
  members: Member[]
): GroupAnalyticsSummary {
  const totalSpentPaise: Paise = expenses.reduce((sum, exp) => sum + exp.amountPaise, 0);

  const memberCount = Math.max(1, members.length);
  const averagePerMemberPaise = Math.round(totalSpentPaise / memberCount);

  // 1. Category Breakdown
  const categoryTotals = new Map<Category, { totalPaise: Paise; count: number }>();
  for (const cat of ALL_CATEGORIES) {
    categoryTotals.set(cat, { totalPaise: 0, count: 0 });
  }

  for (const exp of expenses) {
    // If expense has line items with categories, we could split by item,
    // or attribute the expense to its primary category.
    // If expense has items, calculate category sum from items; if items don't have total or empty,
    // infer or default to 'Other' or item category.
    if (exp.items && exp.items.length > 0) {
      for (const item of exp.items) {
        const cat = item.category || 'Other';
        const current = categoryTotals.get(cat) ?? { totalPaise: 0, count: 0 };
        current.totalPaise += item.lineTotalPaise;
        categoryTotals.set(cat, current);
      }
      // Also attribute any difference (like tax/service charge) to primary item category
      const itemsSum = exp.items.reduce((s, it) => s + it.lineTotalPaise, 0);
      const remainder = exp.amountPaise - itemsSum;
      if (remainder !== 0 && exp.items[0]?.category) {
        const primaryCat = exp.items[0].category;
        const current = categoryTotals.get(primaryCat)!;
        current.totalPaise += remainder;
      }
      const primaryCat = exp.items[0]?.category || 'Other';
      const current = categoryTotals.get(primaryCat)!;
      current.count += 1;
    } else {
      // Manual expense without items: attribute to 'Other' or description keyword
      const cat = inferCategoryFromDescription(exp.description);
      const current = categoryTotals.get(cat) ?? { totalPaise: 0, count: 0 };
      current.totalPaise += exp.amountPaise;
      current.count += 1;
      categoryTotals.set(cat, current);
    }
  }

  const categoryBreakdown = ALL_CATEGORIES.map((cat) => {
    const data = categoryTotals.get(cat) ?? { totalPaise: 0, count: 0 };
    const percentageBasisPoints =
      totalSpentPaise > 0 ? Math.round((data.totalPaise * 10000) / totalSpentPaise) : 0;

    return {
      category: cat,
      totalPaise: data.totalPaise,
      percentageBasisPoints,
      expenseCount: data.count,
    };
  }).filter((item) => item.totalPaise > 0 || item.expenseCount > 0);

  // Sort descending by total spend
  categoryBreakdown.sort((a, b) => b.totalPaise - a.totalPaise);

  const topCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0].category : null;

  // 2. Member Spending Analytics (Paid vs Consumed)
  const memberMap = new Map<string, { totalPaid: Paise; totalConsumed: Paise }>();
  for (const m of members) {
    memberMap.set(m.id, { totalPaid: 0, totalConsumed: 0 });
  }

  for (const exp of expenses) {
    const payerStats = memberMap.get(exp.payerId);
    if (payerStats) {
      payerStats.totalPaid += exp.amountPaise;
    }
    for (const share of exp.memberShares) {
      const shareStats = memberMap.get(share.memberId);
      if (shareStats) {
        shareStats.totalConsumed += share.amountPaise;
      }
    }
  }

  const memberAnalytics: MemberSpendingAnalytics[] = members.map((m) => {
    const stats = memberMap.get(m.id) ?? { totalPaid: 0, totalConsumed: 0 };
    return {
      memberId: m.id,
      memberName: m.name,
      totalPaidPaise: stats.totalPaid,
      totalConsumedPaise: stats.totalConsumed,
      netBalancePaise: stats.totalPaid - stats.totalConsumed,
    };
  });

  // 3. Spending by Date
  const dateMap = new Map<string, Paise>();
  for (const exp of expenses) {
    const dateKey = exp.date || exp.createdAt.substring(0, 10);
    dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + exp.amountPaise);
  }

  const spendingByDate = Array.from(dateMap.entries())
    .map(([date, totalPaise]) => ({ date, totalPaise }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalSpentPaise,
    averagePerMemberPaise,
    expenseCount: expenses.length,
    topCategory,
    categoryBreakdown,
    memberAnalytics,
    spendingByDate,
  };
}

/**
 * Keyword-based heuristic to assign category for manual expenses without line items
 */
export function inferCategoryFromDescription(desc: string): Category {
  const d = desc.toLowerCase();
  if (
    d.includes('food') ||
    d.includes('dinner') ||
    d.includes('lunch') ||
    d.includes('breakfast') ||
    d.includes('cafe') ||
    d.includes('restaurant') ||
    d.includes('pizza') ||
    d.includes('burger') ||
    d.includes('snack')
  ) {
    return 'Food';
  }
  if (
    d.includes('grocery') ||
    d.includes('supermarket') ||
    d.includes('mart') ||
    d.includes('vegetable') ||
    d.includes('milk') ||
    d.includes('kirana')
  ) {
    return 'Groceries';
  }
  if (
    d.includes('travel') ||
    d.includes('fuel') ||
    d.includes('petrol') ||
    d.includes('diesel') ||
    d.includes('cab') ||
    d.includes('taxi') ||
    d.includes('uber') ||
    d.includes('ola') ||
    d.includes('toll') ||
    d.includes('flight') ||
    d.includes('train')
  ) {
    return 'Travel';
  }
  if (
    d.includes('utility') ||
    d.includes('electricity') ||
    d.includes('water') ||
    d.includes('wifi') ||
    d.includes('internet') ||
    d.includes('gas') ||
    d.includes('recharge') ||
    d.includes('rent')
  ) {
    return 'Utilities';
  }
  if (
    d.includes('movie') ||
    d.includes('cinema') ||
    d.includes('club') ||
    d.includes('game') ||
    d.includes('concert') ||
    d.includes('show') ||
    d.includes('party')
  ) {
    return 'Entertainment';
  }
  return 'Other';
}
