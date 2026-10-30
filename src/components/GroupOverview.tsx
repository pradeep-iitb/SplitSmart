import { useState } from 'react';
import { ArrowRight, Download, Plus, Wallet } from 'lucide-react';
import type { Expense, Group, Member, MemberBalance } from '../types/domain';
import { calculatePairwiseBalancesForMember, formatPaise } from '../features/settlement/balances';
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
  const myMember = members.find((member) => member.isCurrentUser);
  const myBalance =
    balances.find((balance) => balance.memberId === myMember?.id)?.balancePaise ?? 0;
  const pairwiseBalances = myMember
    ? calculatePairwiseBalancesForMember(myMember.id, members, expenses)
    : [];
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
          <small>Your group net balance</small>
          <strong className={myBalance < 0 ? 'negative' : 'positive'}>
            {myBalance > 0 ? '+' : ''}
            {formatPaise(myBalance)}
          </strong>
          <span>
            {myBalance > 0
              ? 'Group owes you (Net credit)'
              : myBalance < 0
                ? 'You owe group (Net debt)'
                : 'All settled up with group'}
          </span>
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
                    ? 'Net positions & direct who-owes-whom'
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
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 text-xs text-slate-300">
              <strong className="text-slate-100 block mb-0.5">Understanding Group Balances:</strong>
              SplitSmart folds all shared expenses into one simplified net balance per person.
              Positive (green) means the group owes them; negative (red) means they owe the group.
            </div>

            {pairwiseBalances.length > 0 && (
              <div className="rounded-xl border border-slate-700/60 bg-slate-850 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span>Direct relationships with you (Before simplification):</span>
                  <span className="text-[11px] text-slate-400">
                    Net: {formatPaise(myBalance, { showSign: true })}
                  </span>
                </div>
                <div className="divide-y divide-slate-800 text-xs">
                  {pairwiseBalances.map((rel) => (
                    <div key={rel.otherMemberId} className="py-2 flex items-center justify-between">
                      <span className="text-slate-300 font-medium">{rel.otherMemberName}</span>
                      <span
                        className={
                          rel.amountPaise > 0
                            ? 'positive font-bold'
                            : rel.amountPaise < 0
                              ? 'negative font-bold'
                              : 'text-slate-400'
                        }
                      >
                        {rel.amountPaise > 0
                          ? `${rel.otherMemberName} owes you ${formatPaise(rel.amountPaise)}`
                          : rel.amountPaise < 0
                            ? `You owe ${rel.otherMemberName} ${formatPaise(-rel.amountPaise)}`
                            : 'All settled up'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="ss-group-balance-list">
              <span className="text-xs font-semibold text-slate-400 block px-1 mb-1">
                All Member Net Positions:
              </span>
              {balances.map((balance) => {
                const memberObj = members.find((member) => member.id === balance.memberId);
                const isMe = memberObj?.isCurrentUser;
                return (
                  <div key={balance.memberId}>
                    <div>
                      <strong>
                        {memberObj?.name ?? 'Member'}
                        {isMe ? ' (You)' : ''}
                      </strong>
                      <small
                        style={{
                          display: 'block',
                          fontSize: '10px',
                          color: '#a7ada5',
                          marginTop: '2px',
                        }}
                      >
                        {balance.balancePaise > 0
                          ? 'Gets back from group'
                          : balance.balancePaise < 0
                            ? 'Owes to group'
                            : 'Fully square'}
                      </small>
                    </div>
                    <span className={balance.balancePaise < 0 ? 'negative' : 'positive'}>
                      {balance.balancePaise > 0 ? '+' : ''}
                      {formatPaise(balance.balancePaise)}
                    </span>
                  </div>
                );
              })}
            </div>
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
