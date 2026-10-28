import React, { useState } from 'react';
import type { Member, MemberBalanceBreakdown } from '../../../types/domain';
import { formatPaise } from '../balances';
import { MemberAvatar } from '../../groups/components/MemberAvatar';
import { ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react';

interface BalancesDashboardProps {
  members: Member[];
  detailedBalances: MemberBalanceBreakdown[];
}

export const BalancesDashboard: React.FC<BalancesDashboardProps> = ({
  members,
  detailedBalances,
}) => {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Invariant verification: sum of all net balances
  const totalNetDiscrepancy = detailedBalances.reduce(
    (sum, b) => sum + b.netBalancePaise,
    0
  );

  const creditors = detailedBalances.filter((b) => b.netBalancePaise > 0);
  const debtors = detailedBalances.filter((b) => b.netBalancePaise < 0);

  const toggleExpand = (memberId: string) => {
    setExpandedMemberId((prev) => (prev === memberId ? null : memberId));
  };

  return (
    <div className="space-y-6">
      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            <span>Creditors (Gets Back)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {creditors.length} <span className="text-sm font-normal text-slate-400">people</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Total owed to them:{' '}
            <span className="font-semibold text-slate-200">
              {formatPaise(creditors.reduce((s, c) => s + c.netBalancePaise, 0))}
            </span>
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            <span>Debtors (Owes Money)</span>
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {debtors.length} <span className="text-sm font-normal text-slate-400">people</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Total to pay:{' '}
            <span className="font-semibold text-slate-200">
              {formatPaise(Math.abs(debtors.reduce((s, d) => s + d.netBalancePaise, 0)))}
            </span>
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            <span>Ledger Status</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 flex items-center gap-1.5">
            <span>{totalNetDiscrepancy === 0 ? 'Fully Balanced' : 'Unbalanced'}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalNetDiscrepancy === 0 ? (
              <span className="text-emerald-400 flex items-center gap-1">
                ✓ Zero discrepancy across all members
              </span>
            ) : (
              <span className="text-rose-400">
                Discrepancy: {formatPaise(totalNetDiscrepancy)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Member Balances List */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
            <span>Group Member Balances</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-normal">
              {detailedBalances.length} members
            </span>
          </h3>
          <span className="text-xs text-slate-400">Click a member for full breakdown</span>
        </div>

        <div className="divide-y divide-slate-700/40">
          {detailedBalances.map((item) => {
            const member = memberMap.get(item.memberId);
            const name = member?.name ?? item.memberId;
            const isCreditor = item.netBalancePaise > 0;
            const isDebtor = item.netBalancePaise < 0;
            const isSettled = item.netBalancePaise === 0;
            const isExpanded = expandedMemberId === item.memberId;

            return (
              <div key={item.memberId} className="transition-colors hover:bg-slate-700/20">
                <div
                  onClick={() => toggleExpand(item.memberId)}
                  className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      member={member}
                      name={name}
                      size="lg"
                      className="border-2 border-slate-700/80 shadow-sm"
                    />
                    <div>
                      <div className="font-medium text-slate-100 text-sm flex items-center gap-2">
                        <span>{name}</span>
                        {member?.upiId && (
                          <span className="text-[11px] font-normal text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">
                            {member.upiId}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {isCreditor && 'Gets back money'}
                        {isDebtor && 'Owes money to group'}
                        {isSettled && 'All settled up'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`text-base font-bold ${
                          isCreditor
                            ? 'text-emerald-400'
                            : isDebtor
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {formatPaise(item.netBalancePaise, { showSign: true })}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isCreditor && 'Net credit'}
                        {isDebtor && 'Net debt'}
                        {isSettled && '₹0.00 balance'}
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label="Expand details"
                      className="text-slate-400 hover:text-slate-200 p-1"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expandable Breakdown Drawer */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-1 bg-slate-900/40 border-t border-slate-700/30 text-xs space-y-2">
                    <div className="text-slate-300 font-medium mb-1">
                      Detailed Financial Reconciliation for {name}:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 flex items-center gap-1 mb-0.5">
                          <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />
                          <span>Total Paid:</span>
                        </div>
                        <div className="font-semibold text-slate-100 text-sm">
                          {formatPaise(item.totalPaidPaise)}
                        </div>
                      </div>

                      <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 flex items-center gap-1 mb-0.5">
                          <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" />
                          <span>Expense Shares:</span>
                        </div>
                        <div className="font-semibold text-slate-100 text-sm">
                          {formatPaise(item.totalSharePaise)}
                        </div>
                      </div>

                      <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 flex items-center gap-1 mb-0.5">
                          <span>Settlements Sent:</span>
                        </div>
                        <div className="font-semibold text-emerald-400 text-sm">
                          {formatPaise(item.settlementsSentPaise)}
                        </div>
                      </div>

                      <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/50">
                        <div className="text-slate-400 flex items-center gap-1 mb-0.5">
                          <span>Settlements Received:</span>
                        </div>
                        <div className="font-semibold text-slate-200 text-sm">
                          {formatPaise(item.settlementsReceivedPaise)}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 pt-1 font-mono">
                      Formula: ({formatPaise(item.totalPaidPaise)} paid −{' '}
                      {formatPaise(item.totalSharePaise)} share) + (
                      {formatPaise(item.settlementsSentPaise)} sent −{' '}
                      {formatPaise(item.settlementsReceivedPaise)} received) ={' '}
                      <span className="font-bold text-slate-200">
                        {formatPaise(item.netBalancePaise, { showSign: true })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
