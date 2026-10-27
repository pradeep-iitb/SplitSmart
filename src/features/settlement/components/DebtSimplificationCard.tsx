import React, { useState } from 'react';
import type { Member, MemberBalance, SuggestedPayment } from '../../../types/domain';
import { formatPaise } from '../balances';
import { MemberAvatar } from '../../groups/components/MemberAvatar';
import {
  compareDebtAlgorithms,
  suggestSettlementsWithDetails,
} from '../simplify';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  CreditCard,
  QrCode,
  Sparkles,
  Zap,
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
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<'exact' | 'greedy'>('exact');

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const comparison = compareDebtAlgorithms(balances);
  const result = suggestSettlementsWithDetails(balances, {
    algorithm: selectedAlgorithm,
  });

  const suggestions = result.suggestions;
  const isAllSettled = suggestions.length === 0;

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
      {/* Header & Algorithm Switcher */}
      <div className="px-5 py-4 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-slate-100 text-lg">
              Debt Simplification Engine
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Minimizes required cash-flow transfers across the group.
          </p>
        </div>

        {/* Algorithm Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSelectedAlgorithm('exact')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedAlgorithm === 'exact'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Exact Minimum (NP-hard)</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedAlgorithm('greedy')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedAlgorithm === 'greedy'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Greedy Heuristic</span>
          </button>
        </div>
      </div>

      {/* Algorithm Performance Banner */}
      <div className="px-5 py-2.5 bg-slate-900/40 border-b border-slate-700/30 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Current solution:</span>
          <span className="font-semibold text-slate-100">
            {suggestions.length} {suggestions.length === 1 ? 'transaction' : 'transactions'}
          </span>
          {result.algorithmUsed === 'exact' && (
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
              Provably optimal
            </span>
          )}
        </div>

        {comparison.transactionsSaved > 0 && (
          <div className="text-amber-400 font-medium text-[11px] flex items-center gap-1">
            <span>✨ Exact algorithm saves {comparison.transactionsSaved} transfer vs Greedy!</span>
          </div>
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
              No one in this group currently owes any money. All shared expenses are fully reconciled.
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
                  className="bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors shadow-sm"
                >
                  {/* Top: Parties and Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MemberAvatar member={payer} name={payerName} size="md" />
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <MemberAvatar member={payee} name={payeeName} size="md" />
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold text-slate-100">
                        {formatPaise(suggestion.amountPaise)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {payee?.upiId ? (
                          <span className="text-emerald-400/90 font-mono">UPI Ready</span>
                        ) : (
                          <span>Cash / Transfer</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Description */}
                  <div className="text-xs text-slate-300">
                    <span className="font-semibold text-rose-300">{payerName}</span> pays{' '}
                    <span className="font-semibold text-emerald-300">{payeeName}</span>
                  </div>

                  {/* Bottom: Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/40">
                    <button
                      type="button"
                      onClick={() => onOpenUpiModal(suggestion)}
                      className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Pay via UPI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRecordSettlement(suggestion)}
                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Mark Settled</span>
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
