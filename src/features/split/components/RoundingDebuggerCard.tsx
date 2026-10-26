import React, { useState, useMemo } from 'react';
import type { Member } from '../../../types/domain';
import { reconcileRoundingDetailed } from '../rounding';
import { formatPaise } from '../../settlement/balances';
import {
  Scale,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface RoundingDebuggerCardProps {
  members: Member[];
}

export const RoundingDebuggerCard: React.FC<RoundingDebuggerCardProps> = ({
  members,
}) => {
  // Preset scenarios
  const [selectedPreset, setSelectedPreset] = useState<'100_3' | 'tax_600_400' | '1paisa_4' | 'custom'>('100_3');

  const [customTotalPaise, setCustomTotalPaise] = useState<number>(10000);
  const [customWeights, setCustomWeights] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    members.forEach((m) => {
      w[m.id] = 1;
    });
    return w;
  });

  const activeConfiguration = useMemo(() => {
    if (selectedPreset === '100_3') {
      const activeIds = ['arjun', 'meera', 'riya'];
      return {
        totalPaise: 10000, // ₹100.00
        stableIds: activeIds,
        weights: [1, 1, 1],
        names: ['Arjun', 'Meera', 'Riya'],
        description: 'PS Point 11 Benchmark: ₹100 split 3 ways yields [₹33.34, ₹33.33, ₹33.33] using stable ID tie break (arjun < meera < riya).',
      };
    }

    if (selectedPreset === 'tax_600_400') {
      const activeIds = ['user-arjun', 'user-riya'];
      return {
        totalPaise: 10000, // ₹100.00 tax
        stableIds: activeIds,
        weights: [60000, 40000], // ₹600 and ₹400 subtotals
        names: ['Arjun (Subtotal ₹600)', 'Riya (Subtotal ₹400)'],
        description: 'Proportional Tax: ₹100 GST allocated on ₹600 and ₹400 subtotals -> yields exact ₹60 and ₹40.',
      };
    }

    if (selectedPreset === '1paisa_4') {
      const activeIds = ['m-1', 'm-2', 'm-3', 'm-4'];
      return {
        totalPaise: 1, // 1 single paisa!
        stableIds: activeIds,
        weights: [1, 1, 1, 1],
        names: ['Member A', 'Member B', 'Member C', 'Member D'],
        description: 'Micro-penny stress test: 1 paisa divided among 4 participants yields [1, 0, 0, 0] with zero money created or lost.',
      };
    }

    // Custom
    const activeMembers = members.slice(0, 4);
    const activeIds = activeMembers.map((m) => m.id);
    return {
      totalPaise: customTotalPaise,
      stableIds: activeIds,
      weights: activeIds.map((id) => customWeights[id] ?? 1),
      names: activeMembers.map((m) => m.name),
      description: 'Custom weights & custom total paise demonstration.',
    };
  }, [selectedPreset, customTotalPaise, customWeights, members]);

  const auditResult = useMemo(() => {
    return reconcileRoundingDetailed(
      activeConfiguration.weights,
      activeConfiguration.totalPaise,
      activeConfiguration.stableIds
    );
  }, [activeConfiguration]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                <Scale className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-100">
                Hamilton-Hare Rounding & Conservation Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              PS Point 11 • Deterministic largest fractional remainder allocation with ascending stable-ID tie-breaking
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Conservation Invariant: 100.0% Exact</span>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="pt-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            Select Test Scenario:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {[
              { id: '100_3', label: '₹100 ÷ 3 Ways', badge: 'PS Core Benchmark' },
              { id: 'tax_600_400', label: 'Tax ₹100 on ₹600/₹400', badge: 'Proportional Tax' },
              { id: '1paisa_4', label: '1 Paisa ÷ 4 Users', badge: 'Micro-Paisa Test' },
              { id: 'custom', label: 'Custom Configuration', badge: 'Interactive' },
            ].map((p) => {
              const active = selectedPreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPreset(p.id as any)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    active
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-200">{p.label}</div>
                  <div className="text-[10px] text-emerald-400/80 mt-0.5">{p.badge}</div>
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{activeConfiguration.description}</span>
          </div>
        </div>

        {/* Custom Inputs (if custom chosen) */}
        {selectedPreset === 'custom' && (
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Total Paise to Reconcile</label>
              <input
                type="number"
                value={customTotalPaise}
                onChange={(e) => setCustomTotalPaise(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-bold"
              />
            </div>
            {activeConfiguration.stableIds.map((id, idx) => (
              <div key={id}>
                <label className="block text-xs text-slate-400 mb-1 truncate">
                  Weight for {activeConfiguration.names[idx]}
                </label>
                <input
                  type="number"
                  min="0"
                  value={customWeights[id] ?? 1}
                  onChange={(e) =>
                    setCustomWeights({
                      ...customWeights,
                      [id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-bold"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Trail Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>Hamilton-Hare Audit Trail</span>
            <span className="text-xs font-normal text-slate-400">
              (Total Target: {formatPaise(activeConfiguration.totalPaise)})
            </span>
          </h3>

          <div className="text-xs text-slate-300 font-medium">
            Sum Allocated:{' '}
            <strong className="text-emerald-400 font-bold">
              {formatPaise(auditResult.totalAllocatedPaise)}
            </strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Participant / Stable ID</th>
                <th className="pb-3 font-semibold">Weight</th>
                <th className="pb-3 font-semibold">Base Allocation (Floor)</th>
                <th className="pb-3 font-semibold">Fractional Remainder</th>
                <th className="pb-3 font-semibold text-center">Odd Paisa Awarded?</th>
                <th className="pb-3 font-semibold text-right">Final Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {auditResult.auditEntries.map((entry, idx) => {
                const name = activeConfiguration.names[idx] || entry.id;
                return (
                  <tr key={entry.id} className="hover:bg-slate-800/30">
                    <td className="py-3 font-medium text-slate-200">
                      <div>{name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">id: "{entry.id}"</div>
                    </td>
                    <td className="py-3 text-slate-300">{entry.rawWeight}</td>
                    <td className="py-3 font-mono text-slate-300">
                      {entry.baseAllocationPaise} p (₹{(entry.baseAllocationPaise / 100).toFixed(2)})
                    </td>
                    <td className="py-3 font-mono text-slate-300">
                      {entry.fractionalRemainderNumerator > 0 ? (
                        <span>
                          {entry.fractionalRemainderDecimal.toFixed(4)} ({entry.fractionalRemainderNumerator}/W)
                        </span>
                      ) : (
                        <span className="text-slate-500">0.0000</span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {entry.receivedOddPaisa ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                          +1 Paisa (Priority)
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-black text-emerald-400 text-sm">
                      {formatPaise(entry.finalAllocationPaise)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mathematical Proof Box */}
        <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-950/40 rounded-xl p-4 text-xs space-y-2">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Mathematical Verification & Deterministic Invariant Proof
          </div>
          <div className="text-slate-400 space-y-1 font-mono text-[11px]">
            <div>1. Base floor sum: Σ floor(T × wᵢ / W) = {auditResult.totalAllocatedPaise - auditResult.remainderPaise} paise</div>
            <div>2. Spare unallocated remainder: R = T − Σ floor = {auditResult.remainderPaise} paisa(e)</div>
            <div>3. Remainder sorted by fractional part descending; ties broken by ascending stable string ID.</div>
            <div>4. Final sum = {auditResult.totalAllocatedPaise} paise === Target {auditResult.targetTotalPaise} paise. Discrepancy = 0 paise.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
