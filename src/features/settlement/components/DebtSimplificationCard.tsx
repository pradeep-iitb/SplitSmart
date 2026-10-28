import React from 'react';
import type { Member, MemberBalance, SuggestedPayment } from '../../../types/domain';
import { formatPaise } from '../balances';
import { MemberAvatar } from '../../groups/components/MemberAvatar';
import { suggestSettlementsWithDetails } from '../simplify';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  QrCode,
  Wallet,
} from 'lucide-react';

interface DebtSimplificationCardProps {
  balances: MemberBalance[];
  members: Member[];
  onOpenUpiModal: (payment: SuggestedPayment) => void;
  onRecordSettlement: (payment: SuggestedPayment) => void;
}

export const DebtSimplificationCard: React.FC<DebtSimplificationCardProps> = ({
  balances,
  members,
  onOpenUpiModal,
  onRecordSettlement,
}) => {
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Uses exact minimum transfers algorithm automatically
  const result = suggestSettlementsWithDetails(balances, {
    algorithm: 'exact',
  });

  const suggestions = result.suggestions;
  const isAllSettled = suggestions.length === 0;

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Wallet className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-bold text-slate-100 text-lg">
              Suggested Settlements
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Optimized payments to clear all group debts with minimum transactions.
            </p>
          </div>
        </div>

        {!isAllSettled && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">
            {suggestions.length} {suggestions.length === 1 ? 'payment' : 'payments'} needed
          </span>
        )}
      </div>

      {/* Suggested Settlements List */}
      <div className="p-5">
        {isAllSettled ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-slate-200 text-base">
              All settled up!
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No one in this group currently owes any money. All expenses are fully balanced.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestions.map((suggestion, idx) => {
              const payer = memberMap.get(suggestion.fromMemberId);
              const payee = memberMap.get(suggestion.toMemberId);
              const payerName = payer?.name || suggestion.fromMemberId;
              const payeeName = payee?.name || suggestion.toMemberId;

              return (
                <div
                  key={`${suggestion.fromMemberId}-${suggestion.toMemberId}-${idx}`}
                  className="liquid-glass-card rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all shadow-sm hover:border-white/20"
                >
                  {/* Parties & Amount row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <MemberAvatar member={payer} name={payerName} size="sm" />
                        <span className="font-heading font-bold text-slate-100 text-sm truncate max-w-[80px] sm:max-w-[100px]">
                          {payerName}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <MemberAvatar member={payee} name={payeeName} size="sm" />
                        <span className="font-heading font-bold text-slate-100 text-sm truncate max-w-[80px] sm:max-w-[100px]">
                          {payeeName}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-base sm:text-lg font-black text-white font-mono-numbers">
                        {formatPaise(suggestion.amountPaise)}
                      </div>
                    </div>
                  </div>

                  {/* Compact Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => onOpenUpiModal(suggestion)}
                      className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors cursor-pointer"
                      title="Pay via UPI QR code"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>UPI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRecordSettlement(suggestion)}
                      className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors cursor-pointer"
                      title="Mark this payment as completed"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Mark Paid</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
