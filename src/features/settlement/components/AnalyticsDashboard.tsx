import React from 'react';
import type { Expense, Member } from '../../../types/domain';
import { formatPaise } from '../balances';
import { calculateSpendingAnalytics } from '../analytics';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  Wallet,
  Tag,
  Calendar,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  expenses: Expense[];
  members: Member[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#f97316', // Orange
  Groceries: '#10b981', // Emerald
  Travel: '#3b82f6', // Blue
  Utilities: '#8b5cf6', // Violet
  Entertainment: '#ec4899', // Pink
  Other: '#64748b', // Slate
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  expenses,
  members,
}) => {
  const analytics = calculateSpendingAnalytics(expenses, members);

  if (expenses.length === 0) {
    return (
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-8 text-center space-y-2">
        <BarChart3 className="w-10 h-10 text-slate-500 mx-auto opacity-50" />
        <h4 className="font-semibold text-slate-200">No expense data available</h4>
        <p className="text-xs text-slate-400">
          Add expenses or select a scenario fixture above to view spending trends and category analytics.
        </p>
      </div>
    );
  }

  // Calculate highest member spender for bar scaling
  const maxMemberSpend = Math.max(
    ...analytics.memberAnalytics.map((m) => Math.max(m.totalPaidPaise, m.totalConsumedPaise)),
    1
  );

  return (
    <div className="space-y-6">
      {/* 4 Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Group Spend</span>
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            {formatPaise(analytics.totalSpentPaise)}
          </div>
          <div className="text-sm text-slate-400 mt-1.5">
            Across <span className="font-semibold text-slate-200">{analytics.expenseCount}</span> expenses
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Average / Member</span>
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            {formatPaise(analytics.averagePerMemberPaise)}
          </div>
          <div className="text-sm text-slate-400 mt-1.5">
            For {members.length} participants
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Top Category</span>
            <Tag className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight">
            {analytics.topCategory || 'N/A'}
          </div>
          <div className="text-sm text-slate-400 mt-1.5">
            {analytics.categoryBreakdown[0]
              ? `${(analytics.categoryBreakdown[0].percentageBasisPoints / 100).toFixed(1)}% of total`
              : 'No categories'}
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Timeline Span</span>
            <Calendar className="w-5 h-5 text-violet-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            {analytics.spendingByDate.length} <span className="text-base font-normal text-slate-400">days</span>
          </div>
          <div className="text-sm text-slate-400 mt-1.5">
            Active spending records
          </div>
        </div>
      </div>

      {/* Category Spending Breakdown */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-slate-100 text-lg">
              Spending by Category
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {analytics.categoryBreakdown.length} active categories
          </span>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="w-full h-3 rounded-full bg-slate-700 overflow-hidden flex shadow-inner">
          {analytics.categoryBreakdown.map((cat) => {
            const widthPercent = cat.percentageBasisPoints / 100;
            if (widthPercent <= 0) return null;
            return (
              <div
                key={cat.category}
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: CATEGORY_COLORS[cat.category] || '#64748b',
                }}
                title={`${cat.category}: ${formatPaise(cat.totalPaise)} (${widthPercent.toFixed(1)}%)`}
                className="h-full transition-all hover:opacity-85"
              />
            );
          })}
        </div>

        {/* Category Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {analytics.categoryBreakdown.map((cat) => {
            const percentStr = (cat.percentageBasisPoints / 100).toFixed(1);
            const color = CATEGORY_COLORS[cat.category] || '#64748b';

            return (
              <div
                key={cat.category}
                className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <div>
                    <div className="font-medium text-slate-200 text-xs">
                      {cat.category}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {cat.expenseCount} {cat.expenseCount === 1 ? 'expense' : 'expenses'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-slate-100 text-xs">
                    {formatPaise(cat.totalPaise)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {percentStr}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member Spending vs Consumption (Who Paid vs Who Consumed) */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="font-semibold text-slate-100 text-base">
              Member Paid vs. Consumed Distribution
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"></span>
              Paid
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
              Consumed
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {analytics.memberAnalytics.map((m) => {
            const paidPercent = (m.totalPaidPaise / maxMemberSpend) * 100;
            const consumedPercent = (m.totalConsumedPaise / maxMemberSpend) * 100;
            const isCreditor = m.netBalancePaise > 0;

            return (
              <div
                key={m.memberId}
                className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/40 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200">{m.memberName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">
                      Paid: <strong className="text-slate-200">{formatPaise(m.totalPaidPaise)}</strong>
                    </span>
                    <span>•</span>
                    <span className="text-slate-400">
                      Consumed: <strong className="text-slate-200">{formatPaise(m.totalConsumedPaise)}</strong>
                    </span>
                    <span>•</span>
                    <span
                      className={`font-bold ${
                        isCreditor ? 'text-emerald-400' : m.netBalancePaise < 0 ? 'text-rose-400' : 'text-slate-400'
                      }`}
                    >
                      {formatPaise(m.netBalancePaise, { showSign: true })}
                    </span>
                  </div>
                </div>

                {/* Comparative double bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-900/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${paidPercent}%` }}
                    />
                  </div>
                  <div className="w-full bg-slate-900/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${consumedPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spending Timeline */}
      {analytics.spendingByDate.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <h3 className="font-semibold text-slate-100 text-base">
              Daily Spending Timeline
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {analytics.spendingByDate.map((item) => (
              <div
                key={item.date}
                className="bg-slate-800/80 border border-slate-700/40 rounded-xl p-3 text-center"
              >
                <div className="text-[11px] text-slate-400 font-medium">
                  {item.date}
                </div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {formatPaise(item.totalPaise)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
