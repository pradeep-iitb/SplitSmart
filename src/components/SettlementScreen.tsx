import { Wallet } from 'lucide-react';
import type {
  Expense,
  Group,
  Member,
  MemberBalance,
  RecordedSettlement,
  SuggestedPayment,
} from '../types/domain';
import { calculatePairwiseBalancesForMember, formatPaise } from '../features/settlement/balances';
import { SettlementHistoryList } from '../features/settlement/components/SettlementHistoryList';
import './settlementScreen.css';

type Props = {
  group: Group;
  members: Member[];
  expenses?: Expense[];
  balances: MemberBalance[];
  suggestions: SuggestedPayment[];
  settlements: RecordedSettlement[];
  onBack: () => void;
  onOpenUpi: (payment: SuggestedPayment) => void;
  onSettle: (payment: SuggestedPayment) => void;
  onUndo: (id: string) => void;
};

export function SettlementScreen({
  group,
  members,
  expenses = [],
  balances,
  suggestions,
  settlements,
  onBack,
  onOpenUpi,
  onSettle,
  onUndo,
}: Props) {
  const name = (id: string) => members.find((member) => member.id === id)?.name ?? 'Member';
  const myMember = members.find((member) => member.isCurrentUser);
  const myBalance =
    balances.find((balance) => balance.memberId === myMember?.id)?.balancePaise ?? 0;
  const pairwiseBalances = myMember
    ? calculatePairwiseBalancesForMember(myMember.id, members, expenses, settlements)
    : [];
  return (
    <div className="ss-settlement-page">
      <div className="ss-settlement-header">
        <div>
          <span className="ss-eyebrow">{group.name.toUpperCase()}</span>
          <h1>Balances & settlements</h1>
          <p>
            {suggestions.length
              ? `${suggestions.length} payment${suggestions.length === 1 ? '' : 's'} can settle everyone up.`
              : 'Everyone is settled up.'}
          </p>
        </div>
        <button onClick={onBack}>Back to group</button>
      </div>
      <section className="ss-settlement-banner">
        <div>
          <span className="ss-eyebrow">YOUR GROUP NET BALANCE</span>
          <strong className={myBalance < 0 ? 'negative' : 'positive'}>
            {myBalance > 0 ? '+' : ''}
            {formatPaise(myBalance)}
          </strong>
          <p>
            {myBalance > 0
              ? 'Group owes you (Total net claim on the group)'
              : myBalance < 0
                ? 'You owe the group (Total net amount to pay)'
                : 'All settled up with this group'}
          </p>
          <small style={{ color: '#a7ada5', fontSize: '11px', marginTop: '4px', display: 'block' }}>
            Combines all your paid bills and consumed shares into one single number for settlement.
          </small>
        </div>
        <span>
          <Wallet size={25} />
        </span>
      </section>

      {pairwiseBalances.length > 0 && (
        <section className="ss-settlement-card">
          <h2>Direct Who-Owes-Whom (Pairwise Breakdown)</h2>
          <p>
            Individual balances between you and each member before group debt simplification is
            applied:
          </p>
          <div style={{ marginTop: '14px', display: 'grid', gap: '8px' }}>
            {pairwiseBalances.map((rel) => (
              <div
                key={rel.otherMemberId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#222722',
                  borderRadius: '10px',
                  fontSize: '13px',
                }}
              >
                <strong style={{ color: '#f5f5f0' }}>{rel.otherMemberName}</strong>
                <span
                  className={
                    rel.amountPaise > 0 ? 'positive' : rel.amountPaise < 0 ? 'negative' : ''
                  }
                  style={{ fontWeight: 700 }}
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
          <small
            style={{ color: '#a7ada5', fontSize: '11px', marginTop: '10px', display: 'block' }}
          >
            Sum of direct debts: <strong>{formatPaise(myBalance, { showSign: true })}</strong>{' '}
            (matches your group net balance).
          </small>
        </section>
      )}

      <section className="ss-settlement-card">
        <h2>Group Net Balances</h2>
        <p>
          Positive (+ green) means they receive money back from the group; negative (- red) means
          they pay into the group.
        </p>
        <div className="ss-settlement-net">
          {balances.map((balance, index) => {
            const memberName = name(balance.memberId);
            const isMe = balance.memberId === myMember?.id;
            return (
              <div key={balance.memberId}>
                <span className={`ss-settlement-avatar tone-${index % 4}`}>
                  {memberName.slice(0, 2).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '12px' }}>
                    {memberName}
                    {isMe ? ' (You)' : ''}
                  </strong>
                  <small style={{ display: 'block', fontSize: '10px', color: '#a7ada5' }}>
                    {balance.balancePaise > 0
                      ? 'Gets back from group'
                      : balance.balancePaise < 0
                        ? 'Owes to group'
                        : 'Settled'}
                  </small>
                </div>
                <b className={balance.balancePaise < 0 ? 'negative' : 'positive'}>
                  {balance.balancePaise > 0 ? '+' : ''}
                  {formatPaise(balance.balancePaise)}
                </b>
              </div>
            );
          })}
        </div>
      </section>
      <section className="ss-settlement-card">
        <div className="ss-settlement-card-title">
          <div>
            <h2>Suggested settlements</h2>
            <p>
              Debt simplification routes payments through the fewest people to settle everyone in
              minimum transfers.
            </p>
          </div>
          <span>{suggestions.length} payments</span>
        </div>
        {suggestions.length ? (
          suggestions.map((payment) => (
            <div
              className="ss-settlement-row"
              key={`${payment.fromMemberId}-${payment.toMemberId}`}
            >
              <div>
                <strong>
                  {name(payment.fromMemberId)} pays {name(payment.toMemberId)}
                </strong>
                <small>Pending confirmation</small>
              </div>
              <b>{formatPaise(payment.amountPaise)}</b>
              <div className="ss-settlement-actions">
                <button onClick={() => onOpenUpi(payment)}>Pay via UPI</button>
                <button onClick={() => onSettle(payment)}>Mark settled</button>
              </div>
            </div>
          ))
        ) : (
          <p className="ss-settlement-empty">There are no pending payments.</p>
        )}
        <div className="ss-settlement-trust">
          <strong>Payments aren’t verified automatically.</strong> After paying by UPI, return here
          and confirm the settlement yourself.
        </div>
      </section>
      {settlements.length > 0 && (
        <SettlementHistoryList
          settlements={settlements}
          members={members}
          onUndoSettlement={onUndo}
        />
      )}
    </div>
  );
}
