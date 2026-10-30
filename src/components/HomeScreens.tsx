import type { Expense, Group, Member, MemberBalance, RecordedSettlement } from '../types/domain';
import './homeScreens.css';

type Props = {
  groups: Group[];
  activeGroupId: string | null;
  members: Member[];
  expenses: Expense[];
  settlements: RecordedSettlement[];
  balances: MemberBalance[];
  onOpenApp: () => void;
  onOpenGroup: (id: string) => void;
  onCreateGroup: () => void;
  onAddExpense: () => void;
  onScanReceipt: () => void;
  onOpenExpenses: () => void;
  onOpenBalances: () => void;
  onOpenAnalytics: () => void;
};

const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: paise % 100 ? 2 : 0 })}`;

export function LandingScreen({
  onOpenApp,
  onScanReceipt,
}: Pick<Props, 'onOpenApp' | 'onScanReceipt'>) {
  return (
    <div className="ss-ui ss-landing">
      <header className="ss-header">
        <button className="ss-logo" onClick={onOpenApp}>
          <span>✦</span> Split<span>Smart</span>
        </button>
        <nav>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <button className="ss-button" onClick={onOpenApp}>
            Open app →
          </button>
        </nav>
      </header>
      <section className="ss-hero">
        <div className="ss-hero-copy">
          <div className="ss-eyebrow">✦ Fair splits. Fewer awkward chats.</div>
          <h1>
            Split without the awkward <em>“my money?”</em>
          </h1>
          <p>
            Scan receipts, assign what everyone had, and settle shared expenses without the
            spreadsheet drama.
          </p>
          <div className="ss-actions">
            <button className="ss-button" onClick={onOpenApp}>
              Start splitting →
            </button>
            <a className="ss-button secondary" href="#features">
              Explore features
            </a>
          </div>
          <small>Built for roommates, trips, and late-night orders.</small>
        </div>
        <div className="ss-hero-art">
          <div className="ss-orbit" />
          <div className="ss-float main">
            <small>Your balance</small>
            <strong>Split fairly</strong>
            <span>Know exactly who owes whom</span>
            <div className="ss-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="ss-float receipt">
            <span>▤</span>
            <div>
              <small>Receipt scanned</small>
              <strong>Ready to split</strong>
            </div>
            <b>✓</b>
          </div>
          <div className="ss-float people">
            <span>● ● ●</span>
            <div>
              <small>Split complete</small>
              <strong>Everyone knows their share</strong>
            </div>
          </div>
        </div>
      </section>
      <section className="ss-section" id="features">
        <div className="ss-section-title">
          <div className="ss-eyebrow">✦ Everything adds up</div>
          <h2>A fair split, from receipt to repayment.</h2>
          <p>Designed around how groups actually spend.</p>
        </div>
        <div className="ss-features">
          <article>
            <span>▤</span>
            <h3>Receipt scanning</h3>
            <p>Turn a photo into editable line items.</p>
            <button onClick={onScanReceipt}>Scan a receipt →</button>
          </article>
          <article>
            <span>◎</span>
            <h3>Itemized splitting</h3>
            <p>Assign each item to the people who enjoyed it.</p>
            <button onClick={onOpenApp}>Start splitting →</button>
          </article>
          <article>
            <span>↗</span>
            <h3>Smarter settlements</h3>
            <p>Reduce back-and-forth with fewer payments.</p>
            <button onClick={onOpenApp}>Open app →</button>
          </article>
        </div>
      </section>
      <section className="ss-section ss-how" id="how">
        <div className="ss-eyebrow">✦ Four simple steps</div>
        <h2>From “who had what?” to all settled.</h2>
        <div className="ss-steps">
          {[
            'Create your group',
            'Scan or add an expense',
            'Assign every item',
            'Settle in fewer payments',
          ].map((step, i) => (
            <div key={step}>
              <span>{i + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
        <button className="ss-button" onClick={onOpenApp}>
          Try SplitSmart now →
        </button>
      </section>
    </div>
  );
}

export function DashboardScreen({
  groups,
  activeGroupId,
  members,
  expenses,
  balances,
  onOpenGroup,
  onCreateGroup,
  onAddExpense,
  onOpenExpenses,
  onOpenBalances,
  onOpenAnalytics,
}: Props) {
  const total = expenses.reduce((sum, expense) => sum + expense.amountPaise, 0);
  const owe = balances
    .filter((b) => b.balancePaise < 0)
    .reduce((sum, b) => sum - b.balancePaise, 0);
  const owed = balances
    .filter((b) => b.balancePaise > 0)
    .reduce((sum, b) => sum + b.balancePaise, 0);
  const recent = [...expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  return (
    <div className="ss-ui ss-dashboard">
      <div className="ss-dash-head">
        <div>
          <div className="ss-eyebrow">✦ YOUR SHARED MONEY</div>
          <h1>Good to see you.</h1>
          <p>Here’s where your group stands.</p>
        </div>
        <div className="ss-actions">
          <button className="ss-button secondary" onClick={onAddExpense}>
            ＋ Quick expense
          </button>
          <button className="ss-button" onClick={onCreateGroup}>
            ◎ Create group
          </button>
        </div>
      </div>
      <div className="ss-stats">
        <div className="featured">
          <small>Group expenses</small>
          <strong>{money(total)}</strong>
          <span>{expenses.length} expenses in the active group</span>
        </div>
        <button onClick={onOpenBalances}>
          <small>Total owed by members</small>
          <strong className="negative">{money(owe)}</strong>
          <span>View balances →</span>
        </button>
        <button onClick={onOpenBalances}>
          <small>Total owed to members</small>
          <strong className="positive">{money(owed)}</strong>
          <span>View balances →</span>
        </button>
      </div>
      <div className="ss-section-row">
        <div>
          <h2>Your groups</h2>
          <p>Shared spaces, sorted.</p>
        </div>
        <button onClick={onCreateGroup}>New group ＋</button>
      </div>
      <div className="ss-groups">
        {groups.map((group, i) => (
          <button className="ss-group" key={group.id} onClick={() => onOpenGroup(group.id)}>
            <div className="ss-group-head">
              <span className={`ss-group-icon tone-${i % 4}`}>
                {group.name.slice(0, 2).toUpperCase()}
              </span>
              <strong>{group.name}</strong>
              <span>›</span>
            </div>
            <p>
              {group.id === activeGroupId
                ? `${members.length} members · ${expenses.length} expenses`
                : 'Open group to view details'}
            </p>
            <div className="ss-group-foot">
              {group.id === activeGroupId ? money(total) : 'View group'}{' '}
              <span>{group.id === activeGroupId ? 'Active group' : 'Open →'}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="ss-activity">
        <div className="ss-section-row">
          <div>
            <h2>Recent activity</h2>
            <p>The latest in {groups.find((g) => g.id === activeGroupId)?.name ?? 'your group'}.</p>
          </div>
          <button onClick={onOpenExpenses}>View all →</button>
        </div>
        {recent.length ? (
          recent.map((expense) => (
            <button className="ss-activity-row" key={expense.id} onClick={onOpenExpenses}>
              <span className="ss-activity-icon">▤</span>
              <span>
                <strong>{expense.description}</strong>
                <small>
                  {expense.date} · {members.find((m) => m.id === expense.payerId)?.name ?? 'Member'}{' '}
                  paid
                </small>
              </span>
              <b>{money(expense.amountPaise)}</b>
            </button>
          ))
        ) : (
          <p className="ss-empty">No expenses yet. Add one to start splitting.</p>
        )}
      </div>
      <div className="ss-links">
        <button onClick={onOpenAnalytics}>View spending insights →</button>
        <button onClick={onOpenBalances}>Settle balances →</button>
      </div>
    </div>
  );
}
