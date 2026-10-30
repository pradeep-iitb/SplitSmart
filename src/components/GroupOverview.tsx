import { useState } from 'react';
import { ArrowRight, Download, Plus, Wallet } from 'lucide-react';
import type { Expense, Group, Member, MemberBalance } from '../types/domain';
import { formatPaise } from '../features/settlement/balances';
import './groupOverview.css';

type Props = {
  group: Group;
  members: Member[];
  expenses: Expense[];
  balances: MemberBalance[];
  pendingCount: number;
  onAddExpense: () => void;
  onSettle: () => void;
  onSwitchGroup: () => void;
  onManageMembers: () => void;
  onInsights: () => void;
  onExport: () => void;
  onOpenExpense: () => void;
};

export function GroupOverview({
  group,
  members,
  expenses,
  balances,
  pendingCount,
  onAddExpense,
  onSettle,
  onSwitchGroup,
  onManageMembers,
  onInsights,
  onExport,
  onOpenExpense,
}: Props) {
  const [tab, setTab] = useState<'Expenses' | 'Balances' | 'Members' | 'Insights'>('Expenses');
  const total = expenses.reduce((sum, expense) => sum + expense.amountPaise, 0);
  const myBalance =
    balances.find(
      (balance) => balance.memberId === members.find((member) => member.isCurrentUser)?.id
    )?.balancePaise ?? 0;
  return (
    <div className="ss-group-page">
      <div className="ss-group-hero">
        <div className="ss-group-title">
          <span className="ss-group-badge">{group.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <span className="ss-eyebrow">
              {members.length} MEMBERS · CREATED{' '}
              {new Date(group.createdAt)
                .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                .toUpperCase()}
            </span>
            <h1>{group.name}</h1>
            <div className="ss-group-members">
              {members.slice(0, 4).map((member, index) => (
                <span key={member.id} className={`tone-${index}`}>
                  {member.name.slice(0, 2).toUpperCase()}
                </span>
              ))}
              <small>{members.map((member) => member.name).join(', ')}</small>
            </div>
          </div>
        </div>
        <div className="ss-group-actions">
          <button onClick={onSettle}>
            <Wallet size={16} /> Settle up
          </button>
          <button onClick={onAddExpense}>
            <Plus size={17} /> Add expense
          </button>
        </div>
      </div>
      <div className="ss-group-stats">
        <div className="featured">
          <small>Total group spending</small>
          <strong>{formatPaise(total)}</strong>
          <span>{expenses.length} expenses</span>
        </div>
        <button onClick={onSettle}>
          <small>Your net balance</small>
          <strong className={myBalance < 0 ? 'negative' : 'positive'}>
            {myBalance > 0 ? '+' : ''}
            {formatPaise(myBalance)}
          </strong>
          <span>{myBalance >= 0 ? 'You are owed' : 'You owe'}</span>
        </button>
        <button onClick={onSettle}>
          <small>Pending settlements</small>
          <strong>{pendingCount}</strong>
          <span className="link">View suggestions →</span>
        </button>
      </div>
      <div className="ss-group-tabs">
        {(['Expenses', 'Balances', 'Members', 'Insights'] as const).map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      <section className="ss-group-panel">
        <div className="ss-group-panel-header">
          <div>
            <h2>{tab}</h2>
            <p>
              {tab === 'Expenses'
                ? `${expenses.length} expenses · ${formatPaise(total)} total`
                : tab === 'Members'
                  ? `${members.length} people in this group`
                  : tab === 'Balances'
                    ? 'Who owes whom in this group'
                    : 'Spending across this group'}
            </p>
          </div>
          <button
            onClick={
              tab === 'Expenses'
                ? onExport
                : tab === 'Members'
                  ? onManageMembers
                  : tab === 'Insights'
                    ? onInsights
                    : onSettle
            }
          >
            {tab === 'Expenses' ? <Download size={16} /> : null}
            {tab === 'Expenses' ? 'Export' : tab === 'Members' ? 'Manage' : 'View details'}
          </button>
        </div>
        {tab === 'Expenses' ? (
          <div>
            {[...expenses]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 8)
              .map((expense) => (
                <button key={expense.id} className="ss-group-expense" onClick={onOpenExpense}>
                  <span className="ss-group-expense-icon">▤</span>
                  <span>
                    <strong>{expense.description}</strong>
                    <small>
                      {expense.date} · Paid by{' '}
                      {members.find((member) => member.id === expense.payerId)?.name ?? 'Member'}
                    </small>
                  </span>
                  <em>{expense.items?.[0]?.category ?? 'Other'}</em>
                  <b>{formatPaise(expense.amountPaise)}</b>
                  <ArrowRight size={16} />
                </button>
              ))}
            {!expenses.length && (
              <p className="ss-group-empty">No expenses yet. Add one to start splitting.</p>
            )}
          </div>
        ) : tab === 'Balances' ? (
          <div className="ss-group-balance-list">
            {balances.map((balance) => (
              <div key={balance.memberId}>
                <strong>{members.find((member) => member.id === balance.memberId)?.name}</strong>
                <span className={balance.balancePaise < 0 ? 'negative' : 'positive'}>
                  {balance.balancePaise > 0 ? '+' : ''}
                  {formatPaise(balance.balancePaise)}
                </span>
              </div>
            ))}
          </div>
        ) : tab === 'Members' ? (
          <div className="ss-group-member-list">
            {members.map((member, index) => (
              <div key={member.id}>
                <span className={`tone-${index % 4}`}>{member.name.slice(0, 2).toUpperCase()}</span>
                <strong>{member.name}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="ss-group-empty">
            Open insights to see category and timeline analysis for this group.
          </p>
        )}
      </section>
      <button className="ss-group-switch" onClick={onSwitchGroup}>
        Switch group →
      </button>
    </div>
  );
}
