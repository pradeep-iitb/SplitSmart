import { useState } from 'react';
import { Download } from 'lucide-react';
import type { Expense, Member } from '../types/domain';
import {
  calculateSpendingAnalytics,
  inferCategoryFromDescription,
} from '../features/settlement/analytics';
import { formatPaise } from '../features/settlement/balances';
import './insightsScreen.css';

const colors = ['#d9ff66', '#bba5ff', '#54f58c', '#ffc198', '#65e7ff', '#ff8f82'];
type Props = {
  expenses: Expense[];
  members: Member[];
  onExport: () => void;
  onOpenExpense: () => void;
};
export function InsightsScreen({ expenses, members, onExport, onOpenExpense }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [period, setPeriod] = useState('all');
  const analytics = calculateSpendingAnalytics(expenses, members);
  const month = new Date().toISOString().slice(0, 7);
  const currentMonth = expenses.filter((expense) => expense.date.startsWith(month));
  const monthlyTotal = currentMonth.reduce((sum, expense) => sum + expense.amountPaise, 0);
  const top = analytics.categoryBreakdown[0];
  const average = expenses.length ? Math.round(analytics.totalSpentPaise / expenses.length) : 0;
  const weeks = Array.from({ length: 7 }, (_, index) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (6 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return expenses
      .filter((expense) => {
        const date = new Date(`${expense.date}T12:00:00`);
        return date >= start && date < end;
      })
      .reduce((sum, expense) => sum + expense.amountPaise, 0);
  });
  const maxWeek = Math.max(1, ...weeks);
  const gradient = analytics.categoryBreakdown
    .reduce<{ stop: number; segments: string[] }>(
      (current, entry, index) => {
        const nextStop = current.stop + entry.percentageBasisPoints / 100;
        return {
          stop: nextStop,
          segments: [
            ...current.segments,
            `${colors[index % colors.length]} ${current.stop}% ${nextStop}%`,
          ],
        };
      },
      { stop: 0, segments: [] }
    )
    .segments.join(', ');
  const filtered = expenses
    .filter((expense) => {
      const expCategory =
        expense.items?.[0]?.category ?? inferCategoryFromDescription(expense.description);
      return (
        expense.description.toLowerCase().includes(search.toLowerCase()) &&
        (category === 'all' || expCategory === category) &&
        (period !== 'month' || expense.date.startsWith(month))
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="ss-insights-page">
      <div className="ss-insights-head">
        <div>
          <span className="ss-eyebrow">INSIGHTS</span>
          <h1>Your spending, made clear.</h1>
          <p>A simple view of where the group’s money went.</p>
        </div>
        <button onClick={onExport}>
          <Download size={16} /> Export report
        </button>
      </div>
      <div className="ss-insights-stats">
        <div className="featured">
          <small>This month</small>
          <strong>{formatPaise(monthlyTotal)}</strong>
          <span>{currentMonth.length} expenses</span>
        </div>
        <div>
          <small>Top category</small>
          <strong>{top?.category ?? 'None yet'}</strong>
          <span>
            {top
              ? `${Math.round(top.percentageBasisPoints / 100)}% of group spend`
              : 'Add an expense to begin'}
          </span>
        </div>
        <div>
          <small>Average expense</small>
          <strong>{formatPaise(average)}</strong>
          <span>Across {expenses.length} expenses</span>
        </div>
      </div>
      <div className="ss-insights-charts">
        <section>
          <h2>Spending over time</h2>
          <p>Last 7 weeks</p>
          <div className="ss-insights-bars">
            {weeks.map((value, index) => (
              <div key={index}>
                <i
                  style={{ height: `${Math.max(value ? 8 : 0, (value / maxWeek) * 100)}%` }}
                  title={formatPaise(value)}
                />
                <span>W{index + 1}</span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2>By category</h2>
          <p>{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
          <div className="ss-insights-donut-wrap">
            <div
              className="ss-insights-donut"
              style={{ background: gradient ? `conic-gradient(${gradient})` : '#3a4139' }}
            >
              <span>
                {formatPaise(analytics.totalSpentPaise)}
                <small>Total</small>
              </span>
            </div>
            <div className="ss-insights-legend">
              {analytics.categoryBreakdown.map((entry, index) => (
                <div key={entry.category}>
                  <i style={{ background: colors[index % colors.length] }} />
                  {entry.category}
                  <strong>{Math.round(entry.percentageBasisPoints / 100)}%</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <section className="ss-insights-history ss-insights-members">
        <h2>By member</h2>
        <p>What each person paid and their share of group expenses.</p>
        <div className="ss-insights-member-list">
          {analytics.memberAnalytics.map((member) => (
            <div className="ss-insights-member" key={member.memberId}>
              <strong>{member.memberName}</strong>
              <span>Paid {formatPaise(member.totalPaidPaise)}</span>
              <span>Share {formatPaise(member.totalConsumedPaise)}</span>
              <span className={member.netBalancePaise >= 0 ? 'positive' : 'negative'}>
                {member.netBalancePaise >= 0 ? '+' : '−'}
                {formatPaise(Math.abs(member.netBalancePaise))}
              </span>
            </div>
          ))}
          {!analytics.memberAnalytics.length && <p>No members yet.</p>}
        </div>
      </section>
      <section className="ss-insights-history">
        <div className="ss-insights-history-head">
          <div>
            <h2>Expense history</h2>
            <p>Search and filter all group expenses.</p>
          </div>
          <button onClick={onExport}>
            <Download size={15} /> CSV / report
          </button>
        </div>
        <div className="ss-insights-filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search expenses…"
            aria-label="Search expenses"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter category"
          >
            <option value="all">All categories</option>
            {['Food', 'Groceries', 'Travel', 'Utilities', 'Entertainment', 'Other'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            aria-label="Filter date"
          >
            <option value="all">All dates</option>
            <option value="month">This month</option>
          </select>
        </div>
        {filtered.slice(0, 8).map((expense) => (
          <button className="ss-insights-expense" onClick={onOpenExpense} key={expense.id}>
            <span>
              {expense.description}
              <small>{expense.date}</small>
            </span>
            <strong>{formatPaise(expense.amountPaise)}</strong>
          </button>
        ))}
        {!filtered.length && <p className="ss-insights-empty">No expenses match these filters.</p>}
      </section>
    </div>
  );
}
