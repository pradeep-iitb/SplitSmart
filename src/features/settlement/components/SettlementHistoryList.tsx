import React from 'react';
import type { Member, RecordedSettlement } from '../../../types/domain';
import { formatPaise } from '../balances';
import { History, RotateCcw, ArrowRight } from 'lucide-react';

interface SettlementHistoryListProps {
  settlements: RecordedSettlement[];
  members: Member[];
  onUndoSettlement: (settlementId: string) => void;
}

export const SettlementHistoryList: React.FC<SettlementHistoryListProps> = ({
  settlements,
  members,
  onUndoSettlement,
}) => {
  const memberMap = new Map(members.map((m) => [m.id, m]));

  if (settlements.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 text-center text-xs text-slate-400">
        <History className="w-6 h-6 text-slate-500 mx-auto mb-1.5 opacity-60" />
        <span>No recorded settlements yet. When someone pays, click "Mark Settled" to record it.</span>
      </div>
    );
  }

  // Most recent first
  const sorted = [...settlements].reverse();

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-700/50 flex items-center justify-between">
        <h4 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          <span>Recorded Settlements History</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-normal">
            {settlements.length}
          </span>
        </h4>
        <span className="text-[11px] text-slate-400">Real payments confirmed</span>
      </div>

      <div className="divide-y divide-slate-700/40">
        {sorted.map((item) => {
          const fromMember = memberMap.get(item.fromMemberId);
          const toMember = memberMap.get(item.toMemberId);
          const fromName = fromMember?.name || item.fromMemberId;
          const toName = toMember?.name || item.toMemberId;

          const dateDisplay = new Date(item.settledAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={item.id}
              className="px-5 py-3 flex items-center justify-between text-xs hover:bg-slate-700/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="space-y-0.5">
                  <div className="font-medium text-slate-200 flex items-center gap-1.5">
                    <span className="text-slate-300">{fromName}</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className="text-emerald-400 font-semibold">{toName}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>{dateDisplay}</span>
                    {item.note && (
                      <>
                        <span>•</span>
                        <span className="italic">{item.note}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-100 text-sm">
                  {formatPaise(item.amountPaise)}
                </span>
                <button
                  type="button"
                  onClick={() => onUndoSettlement(item.id)}
                  title="Undo this settlement"
                  className="inline-flex items-center gap-1 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Undo</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
