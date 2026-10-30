import type { Expense, Group, Member, RecordedSettlement } from '../types/domain';
import { formatPaise } from '../features/settlement/balances';
import {
  summarizePersonalTotals,
  type PersonalGroupSummary,
} from '../features/settlement/personalSummary';
import './dashboardScreen.css';

type Props = {
  groups: Group[];
  activeGroupId: string | null;
  members: Member[];
  expenses: Expense[];
  settlements: RecordedSettlement[];
  groupSummaries: PersonalGroupSummary[];
  onOpenGroup: (id: string) => void;
  onCreateGroup: () => void;
  onAddExpense: () => void;
  onOpenExpenses: () => void;
  onOpenBalances: (groupId?: string) => void;
};

export function DashboardScreen({
  groups,
  activeGroupId,
  members,
  expenses,
  settlements,
  groupSummaries,
  onOpenGroup,
  onCreateGroup,
  onAddExpense,
  onOpenExpenses,
  onOpenBalances,
}: Props) {
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const currentUser = members.find((member) => member.isCurrentUser);
  const userName =
    currentUser?.name && !/^(me|you)$/i.test(currentUser.name) ? `, ${currentUser.name}` : '';
  const totals = summarizePersonalTotals(groupSummaries);
  const oweGroup = groupSummaries.find((summary) => summary.balancePaise < 0)?.group.id;
  const owedGroup = groupSummaries.find((summary) => summary.balancePaise > 0)?.group.id;
  const activity = [
    ...expenses.map((expense) => ({
      id: expense.id,
      at: expense.createdAt,
      title: expense.description,
      meta: `${groups.find((group) => group.id === activeGroupId)?.name ?? 'Group'} · paid by ${members.find((member) => member.id === expense.payerId)?.name ?? 'Member'}`,
      amount: expense.amountPaise,
      settlement: false,
    })),
    ...settlements.map((payment) => ({
      id: payment.id,
      at: payment.settledAt,
      title: `${members.find((member) => member.id === payment.fromMemberId)?.name ?? 'Member'} paid ${members.find((member) => member.id === payment.toMemberId)?.name ?? 'Member'}`,
      meta: 'Settlement',
      amount: payment.amountPaise,
      settlement: true,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);
  return (
    <div className="ss-dashboard-screen">
      <div className="ss-dashboard-head">
        <div>
          <span className="ss-eyebrow">
            {now
              .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
              .toUpperCase()}
          </span>
          <h1>
            {greeting}
            {userName}.
          </h1>
          <p>Here’s where your shared money stands.</p>
        </div>
        <div className="ss-dashboard-actions">
          <button onClick={onAddExpense}>＋ Quick expense</button>
          <button onClick={onCreateGroup}>♧ Create group</button>
        </div>
      </div>
      <div className="ss-dashboard-stats">
        <div className="featured">
          <small>Your total expenses</small>
          <strong>{formatPaise(totals.spentPaise)}</strong>
          <span>Your share across all groups</span>
        </div>
        <button onClick={() => onOpenBalances(oweGroup)} className="owed">
          <small>You owe</small>
          <strong>{formatPaise(totals.owePaise)}</strong>
          <span>View who you owe →</span>
        </button>
        <button onClick={() => onOpenBalances(owedGroup)} className="owing">
          <small>You are owed</small>
          <strong>{formatPaise(totals.owedPaise)}</strong>
          <span>View who owes you →</span>
        </button>
      </div>
      <div className="ss-dashboard-row">
        <div>
          <h2>Your groups</h2>
          <p>Shared spaces, sorted.</p>
        </div>
        <button onClick={onCreateGroup}>New group ＋</button>
      </div>
      <div className="ss-dashboard-groups">
        {groups.map((group, index) => {
          const summary = groupSummaries.find((entry) => entry.group.id === group.id);
          const groupMembers = summary?.members ?? (group.id === activeGroupId ? members : []);
          return (
            <button key={group.id} onClick={() => onOpenGroup(group.id)}>
              <div className="ss-dashboard-group-head">
                <span className={`tone-${index % 4}`}>{group.name.slice(0, 2).toUpperCase()}</span>
                <strong>{group.name}</strong>
                <b>›</b>
              </div>
              <div className="ss-dashboard-avatars">
                {groupMembers.slice(0, 4).map((member, memberIndex) => (
                  <span className={`tone-${memberIndex % 4}`} key={member.id}>
                    {member.name.slice(0, 2).toUpperCase()}
                  </span>
                ))}
                <small>{groupMembers.length} members</small>
              </div>
              <div className="ss-dashboard-group-foot">
                <span>Your expense share</span>
                <strong>{formatPaise(summary?.myExpenseSharePaise ?? 0)}</strong>
              </div>
              <small className="ss-dashboard-group-status">
                {summary?.balancePaise
                  ? summary.balancePaise > 0
                    ? `You are owed ${formatPaise(summary.balancePaise)}`
                    : `You owe ${formatPaise(-summary.balancePaise)}`
                  : 'All settled up'}
              </small>
            </button>
          );
        })}
      </div>
      <section className="ss-dashboard-activity">
        <div className="ss-dashboard-row">
          <div>
            <h2>Recent activity</h2>
            <p>The latest in your active group.</p>
          </div>
          <button onClick={onOpenExpenses}>View all →</button>
        </div>
        {activity.length ? (
          activity.map((entry) => (
            <button
              key={entry.id}
              className="ss-dashboard-activity-row"
              onClick={() =>
                entry.settlement ? onOpenBalances(activeGroupId ?? undefined) : onOpenExpenses()
              }
            >
              <span className="icon">{entry.settlement ? '✓' : '▤'}</span>
              <span className="description">
                <strong>{entry.title}</strong>
                <small>{entry.meta}</small>
              </span>
              <span className="amount">
                <strong>{formatPaise(entry.amount)}</strong>
                <small>{new Date(entry.at).toLocaleDateString('en-IN')}</small>
              </span>
            </button>
          ))
        ) : (
          <p className="empty">No activity yet. Add an expense to get started.</p>
        )}
      </section>
    </div>
  );
}
