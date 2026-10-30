import { Wallet } from 'lucide-react';
import type {
  Group,
  Member,
  MemberBalance,
  RecordedSettlement,
  SuggestedPayment,
} from '../types/domain';
import { formatPaise } from '../features/settlement/balances';
import { SettlementHistoryList } from '../features/settlement/components/SettlementHistoryList';
import './settlementScreen.css';

type Props = {
  group: Group;
  members: Member[];
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
  balances,
  suggestions,
  settlements,
  onBack,
  onOpenUpi,
  onSettle,
  onUndo,
}: Props) {
  const name = (id: string) => members.find((member) => member.id === id)?.name ?? 'Member';
  const myBalance =
    balances.find(
      (balance) => balance.memberId === members.find((member) => member.isCurrentUser)?.id
    )?.balancePaise ?? 0;
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
          <span className="ss-eyebrow">YOUR NET BALANCE</span>
          <strong className={myBalance < 0 ? 'negative' : 'positive'}>
            {myBalance > 0 ? '+' : ''}
            {formatPaise(myBalance)}
          </strong>
          <p>
            {myBalance > 0
              ? 'You are owed money.'
              : myBalance < 0
                ? 'You owe money.'
                : 'All settled up.'}
          </p>
        </div>
        <span>
          <Wallet size={25} />
        </span>
      </section>
      <section className="ss-settlement-card">
        <h2>Net balances</h2>
        <p>Positive means they should receive money.</p>
        <div className="ss-settlement-net">
          {balances.map((balance, index) => (
            <div key={balance.memberId}>
              <span className={`ss-settlement-avatar tone-${index % 4}`}>
                {name(balance.memberId).slice(0, 2).toUpperCase()}
              </span>
              <strong>{name(balance.memberId)}</strong>
              <b className={balance.balancePaise < 0 ? 'negative' : 'positive'}>
                {balance.balancePaise > 0 ? '+' : ''}
                {formatPaise(balance.balancePaise)}
              </b>
            </div>
          ))}
        </div>
      </section>
      <section className="ss-settlement-card">
        <div className="ss-settlement-card-title">
          <div>
            <h2>Suggested settlements</h2>
            <p>Fewer payments, same final balances.</p>
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
