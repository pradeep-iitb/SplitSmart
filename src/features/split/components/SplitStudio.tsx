import React, { useState, useMemo, useEffect } from 'react';
import type { Expense, Member, ReceiptItem, SplitMode } from '../../../types/domain';
import {
  calculateDetailedItemizedSplit,
  calculateExpenseShares,
} from '../splitEngine';
import { validateSplitInput } from '../validation';
import { formatPaise } from '../../settlement/balances';
import { MemberAvatar } from '../../groups/components/MemberAvatar';
import {
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Users,
  Percent,
  Divide,
  Scale,
  ListOrdered,
  Plus,
  Trash2,
  Coins,
} from 'lucide-react';

export interface SplitStudioDraft {
  description: string;
  items: ReceiptItem[];
  taxLines: Array<{ label: string; amountPaise: number }>;
  serviceChargeRupees: string;
  discountRupees: string;
  totalRupees: string;
  payerId: string;
}

interface SplitStudioProps {
  members: Member[];
  onSaveExpense?: (expense: Expense) => void;
  initialTotalRupees?: number;
  initialDraft?: SplitStudioDraft | null;
  onClearDraft?: () => void;
}

export const SplitStudio: React.FC<SplitStudioProps> = ({
  members,
  onSaveExpense,
  initialTotalRupees = 840,
  initialDraft,
  onClearDraft,
}) => {
  const [description, setDescription] = useState(initialDraft?.description || '');
  const [totalRupees, setTotalRupees] = useState<string>(initialTotalRupees.toString());
  const [payerId, setPayerId] = useState<string>(members[0]?.id || '');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    members.map((m) => m.id)
  );

  // Load draft from receipt scanner if present
  useEffect(() => {
    if (initialDraft) {
      if (initialDraft.description) setDescription(initialDraft.description);
      if (initialDraft.totalRupees) setTotalRupees(initialDraft.totalRupees);
      if (initialDraft.payerId) setPayerId(initialDraft.payerId);
      if (initialDraft.items && initialDraft.items.length > 0) {
        setItems(initialDraft.items);
        setSplitMode('itemized');
      }
      if (initialDraft.taxLines) setTaxLines(initialDraft.taxLines);
      if (initialDraft.serviceChargeRupees) setServiceChargeRupees(initialDraft.serviceChargeRupees);
      if (initialDraft.discountRupees) setDiscountRupees(initialDraft.discountRupees);
    }
  }, [initialDraft]);

  // Exact mode state
  const [exactAmountsRupees, setExactAmountsRupees] = useState<Record<string, string>>({});

  // Percentage mode state (basis points: 2500 = 25.00%)
  const [basisPointsMap, setBasisPointsMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const count = members.length;
    const baseBps = Math.floor(10000 / count);
    const remainder = 10000 - baseBps * count;
    members.forEach((m, idx) => {
      initial[m.id] = baseBps + (idx < remainder ? 1 : 0);
    });
    return initial;
  });

  // Shares mode state (ratios like 2, 1, 1, 1)
  const [sharesWeights, setSharesWeights] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    members.forEach((m) => {
      initial[m.id] = 1;
    });
    return initial;
  });

  // Itemized mode state
  const [items, setItems] = useState<ReceiptItem[]>([
    {
      id: 'item-1',
      name: 'Paneer Butter Masala',
      quantity: 2,
      unitPricePaise: 28000,
      lineTotalPaise: 56000,
      assignedMemberIds: members.map((m) => m.id),
      category: 'Food',
    },
    {
      id: 'item-2',
      name: 'Garlic Naan & Roti',
      quantity: 4,
      unitPricePaise: 6000,
      lineTotalPaise: 24000,
      assignedMemberIds: members.map((m) => m.id),
      category: 'Food',
    },
  ]);

  const [taxLines, setTaxLines] = useState<Array<{ label: string; amountPaise: number }>>([
    { label: 'CGST 2.5%', amountPaise: 2000 },
    { label: 'SGST 2.5%', amountPaise: 2000 },
  ]);
  const [serviceChargeRupees, setServiceChargeRupees] = useState<string>('0');
  const [discountRupees, setDiscountRupees] = useState<string>('0');

  const parsedRupees = parseFloat(totalRupees) || 0;
  const totalPaise = Math.round(parsedRupees * 100);

  // Exact amounts converted to paise
  const exactAmountsPaise = useMemo(() => {
    const res: Record<string, number> = {};
    for (const [id, valStr] of Object.entries(exactAmountsRupees)) {
      const val = parseFloat(valStr) || 0;
      res[id] = Math.round(val * 100);
    }
    return res;
  }, [exactAmountsRupees]);

  // Total itemized bill calculation
  const itemizedCalculation = useMemo(() => {
    const scPaise = Math.round((parseFloat(serviceChargeRupees) || 0) * 100);
    const discPaise = Math.round((parseFloat(discountRupees) || 0) * 100);

    return calculateDetailedItemizedSplit({
      totalPaise,
      splitMode: 'itemized',
      participantIds: selectedMemberIds,
      items,
      taxLines,
      serviceChargePaise: scPaise,
      discountPaise: discPaise,
    });
  }, [totalPaise, selectedMemberIds, items, taxLines, serviceChargeRupees, discountRupees]);

  // Computed Shares across active split mode
  const currentShares = useMemo(() => {
    if (splitMode === 'itemized') {
      return itemizedCalculation.memberShares;
    }

    return calculateExpenseShares({
      totalPaise,
      splitMode,
      participantIds: selectedMemberIds,
      exactAmounts: exactAmountsPaise,
      percentagesBasisPoints: basisPointsMap,
      sharesWeights,
      items,
      taxLines,
    });
  }, [
    totalPaise,
    splitMode,
    selectedMemberIds,
    exactAmountsPaise,
    basisPointsMap,
    sharesWeights,
    items,
    taxLines,
    itemizedCalculation,
  ]);

  // Validation issues
  const validationIssues = useMemo(() => {
    return validateSplitInput({
      totalPaise,
      splitMode,
      participantIds: selectedMemberIds,
      exactAmounts: exactAmountsPaise,
      percentagesBasisPoints: basisPointsMap,
      sharesWeights,
      items: splitMode === 'itemized' ? items : undefined,
      taxLines: splitMode === 'itemized' ? taxLines : undefined,
      serviceChargePaise: Math.round((parseFloat(serviceChargeRupees) || 0) * 100),
      discountPaise: Math.round((parseFloat(discountRupees) || 0) * 100),
    });
  }, [
    totalPaise,
    splitMode,
    selectedMemberIds,
    exactAmountsPaise,
    basisPointsMap,
    sharesWeights,
    items,
    taxLines,
    serviceChargeRupees,
    discountRupees,
  ]);

  const hasErrors = validationIssues.some((i) => i.severity === 'error');
  const sumSharesPaise = currentShares.reduce((a, b) => a + b.amountPaise, 0);
  const invariantSatisfied = sumSharesPaise === totalPaise;

  const toggleParticipant = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleCreateExpense = () => {
    if (hasErrors || !payerId || !onSaveExpense) return;

    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      groupId: members[0]?.groupId || 'g-current',
      description,
      date: new Date().toISOString().substring(0, 10),
      payerId,
      amountPaise: totalPaise,
      splitMode,
      memberShares: currentShares,
      items: splitMode === 'itemized' ? items : [],
      taxLines: splitMode === 'itemized' ? taxLines : [],
      serviceChargePaise: Math.round((parseFloat(serviceChargeRupees) || 0) * 100),
      discountPaise: Math.round((parseFloat(discountRupees) || 0) * 100),
      createdAt: new Date().toISOString(),
    };

    onSaveExpense(newExp);
    onClearDraft?.();
  };

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="liquid-glass-card rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Calculator className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-heading font-black text-white">
                Split Calculation Studio
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 font-body">
              Customize how expenses are divided with accurate shares and tax handling
            </p>
          </div>

          {/* Alert only if discrepancy */}
          {!invariantSatisfied && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-rose-500/10 text-rose-400 border-rose-500/30">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Discrepancy: {formatPaise(Math.abs(totalPaise - sumSharesPaise))}
              </span>
            </div>
          )}
        </div>

        {/* Basic Input Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Expense Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              placeholder="e.g. Seafood Dinner"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Total Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={totalRupees}
              onChange={(e) => setTotalRupees(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-semibold focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Paid By (Single Payer)
            </label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-2.5">
            Select Split Mode
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { id: 'equal', label: 'Equal', icon: Divide, desc: 'Even split with odd-paisa tie break' },
              { id: 'exact', label: 'Exact Amounts', icon: Coins, desc: 'Custom ₹ amounts per person' },
              { id: 'percentage', label: 'Percentages', icon: Percent, desc: 'Basis-point exact allocations' },
              { id: 'shares', label: 'Shares / Ratio', icon: Scale, desc: 'Ratios like 2:1:1 or 3:2' },
              { id: 'itemized', label: 'Itemized Receipt', icon: ListOrdered, desc: 'Line items + proportional tax' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = splitMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSplitMode(tab.id as SplitMode)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    isActive
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-md shadow-blue-900/20'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1.5" />
                  <span className="text-xs font-semibold">{tab.label}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{tab.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Participant Selectors */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              Participants Included in Split ({selectedMemberIds.length}/{members.length}):
            </span>
            <button
              onClick={() => setSelectedMemberIds(members.map((m) => m.id))}
              className="text-[11px] text-blue-400 hover:underline"
            >
              Select All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const isSelected = selectedMemberIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleParticipant(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-blue-500/60 text-blue-300'
                      : 'bg-slate-900/40 border-slate-800 text-slate-500 line-through'
                  }`}
                >
                  <MemberAvatar member={m} size="xs" />
                  <span>{m.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mode Specific Customizers */}
      {splitMode === 'exact' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-400" />
            Enter Exact Amounts per Participant
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {selectedMemberIds.map((id) => {
              const m = members.find((x) => x.id === id);
              return (
                <div key={id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {m?.name || id}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-slate-500">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={exactAmountsRupees[id] ?? ''}
                      onChange={(e) =>
                        setExactAmountsRupees({
                          ...exactAmountsRupees,
                          [id]: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-100 font-medium"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {splitMode === 'percentage' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Percent className="w-4 h-4 text-blue-400" />
              Adjust Participant Percentages (Total must be 100%)
            </h3>
            <span className="text-xs text-slate-400">
              Total:{' '}
              <strong className="text-slate-200">
                {(
                  selectedMemberIds.reduce((sum, id) => sum + (basisPointsMap[id] ?? 0), 0) / 100
                ).toFixed(2)}
                %
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedMemberIds.map((id) => {
              const m = members.find((x) => x.id === id);
              const bps = basisPointsMap[id] ?? 0;
              return (
                <div key={id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-300">{m?.name || id}</span>
                    <span className="font-bold text-blue-400">{(bps / 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10000"
                    step="100"
                    value={bps}
                    onChange={(e) =>
                      setBasisPointsMap({
                        ...basisPointsMap,
                        [id]: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {splitMode === 'shares' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Scale className="w-4 h-4 text-purple-400" />
            Set Relative Ratio Weights (e.g. 2 for 2x share)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {selectedMemberIds.map((id) => {
              const m = members.find((x) => x.id === id);
              const weight = sharesWeights[id] ?? 1;
              return (
                <div key={id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
                  <div className="text-xs font-medium text-slate-300 mb-2 truncate">
                    {m?.name || id}
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() =>
                        setSharesWeights({
                          ...sharesWeights,
                          [id]: Math.max(1, weight - 1),
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold"
                    >
                      -
                    </button>
                    <span className="text-base font-bold text-purple-400 w-6">
                      {weight}x
                    </span>
                    <button
                      onClick={() =>
                        setSharesWeights({
                          ...sharesWeights,
                          [id]: weight + 1,
                        })
                      }
                      className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {splitMode === 'itemized' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-emerald-400" />
              Receipt Line Items & Member Assignment
            </h3>
            <button
              onClick={() => {
                const newItem: ReceiptItem = {
                  id: `item-${Date.now()}`,
                  name: 'New Custom Dish',
                  quantity: 1,
                  unitPricePaise: 15000,
                  lineTotalPaise: 15000,
                  assignedMemberIds: [...selectedMemberIds],
                  category: 'Food',
                };
                setItems([...items, newItem]);
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 hover:bg-emerald-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item
            </button>
          </div>

          {/* Items table */}
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setItems(items.map((it) => (it.id === item.id ? { ...it, name: newName } : it)));
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 flex-1"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span>Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const qty = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setItems(
                            items.map((it) =>
                              it.id === item.id
                                ? { ...it, quantity: qty, lineTotalPaise: qty * it.unitPricePaise }
                                : it
                            )
                          );
                        }}
                        className="w-12 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center text-xs text-slate-100"
                      />
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span>₹ Total:</span>
                      <input
                        type="number"
                        step="0.01"
                        value={(item.lineTotalPaise / 100).toFixed(2)}
                        onChange={(e) => {
                          const totalP = Math.round((parseFloat(e.target.value) || 0) * 100);
                          setItems(
                            items.map((it) =>
                              it.id === item.id ? { ...it, lineTotalPaise: totalP } : it
                            )
                          );
                        }}
                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs text-slate-100 font-semibold"
                      />
                    </div>

                    <button
                      onClick={() => setItems(items.filter((it) => it.id !== item.id))}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Assigned Member Pills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-700/40">
                  <span className="text-[11px] text-slate-400">Shared by:</span>
                  {selectedMemberIds.map((mId) => {
                    const m = members.find((x) => x.id === mId);
                    const isAssigned = item.assignedMemberIds.includes(mId);
                    return (
                      <button
                        key={mId}
                        onClick={() => {
                          const newAssigned = isAssigned
                            ? item.assignedMemberIds.filter((id) => id !== mId)
                            : [...item.assignedMemberIds, mId];
                          setItems(
                            items.map((it) =>
                              it.id === item.id ? { ...it, assignedMemberIds: newAssigned } : it
                            )
                          );
                        }}
                        className={`text-[10px] pl-1 pr-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                          isAssigned
                            ? 'bg-blue-600/20 border-blue-500/60 text-blue-300 font-semibold'
                            : 'bg-slate-900/60 border-slate-700 text-slate-500'
                        }`}
                      >
                        <MemberAvatar member={m} size="xs" />
                        <span>{m?.name || mId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Tax, Service Charge & Discount Allocators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
              <span className="text-xs font-semibold text-slate-300 block mb-1">
                Taxes (CGST/SGST)
              </span>
              <div className="text-xs text-slate-400 space-y-1">
                {taxLines.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-1">
                    <span className="truncate">{t.label}:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={(t.amountPaise / 100).toFixed(2)}
                        onChange={(e) => {
                          const newPaise = Math.round((parseFloat(e.target.value) || 0) * 100);
                          setTaxLines(
                            taxLines.map((item, i) =>
                              i === idx ? { ...item, amountPaise: newPaise } : item
                            )
                          );
                        }}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right text-xs font-medium text-slate-200"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Service Charge (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={serviceChargeRupees}
                onChange={(e) => setServiceChargeRupees(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100"
                placeholder="0.00"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Proportionally added</span>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Discount (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={discountRupees}
                onChange={(e) => setDiscountRupees(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100"
                placeholder="0.00"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Proportionally deducted</span>
            </div>
          </div>
        </div>
      )}

      {/* Validation Warnings / Errors Banner */}
      {validationIssues.length > 0 && (
        <div className="space-y-2">
          {validationIssues.map((issue, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
                issue.severity === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calculated Result Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">
            Final Calculated Member Shares (Reconciled to 1 Paisa)
          </h3>
          <span className="text-xs text-slate-400">
            Total:{' '}
            <strong className="text-slate-100 font-bold">
              {formatPaise(sumSharesPaise)}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {selectedMemberIds.map((memberId) => {
            const m = members.find((x) => x.id === memberId);
            const share = currentShares.find((s) => s.memberId === memberId);
            const amt = share?.amountPaise ?? 0;
            const percentage = totalPaise > 0 ? (amt / totalPaise) * 100 : 0;

            const itemizedBreakdown =
              splitMode === 'itemized'
                ? itemizedCalculation.memberBreakdowns.find((b) => b.memberId === memberId)
                : undefined;

            return (
              <div
                key={memberId}
                className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 space-y-2 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MemberAvatar member={m} size="sm" />
                    <span className="text-xs font-bold text-slate-200">
                      {m?.name || memberId}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {percentage.toFixed(1)}%
                  </span>
                </div>

                <div className="text-lg font-black text-emerald-400">
                  {formatPaise(amt)}
                </div>

                {itemizedBreakdown && (
                  <div className="text-[10px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-700/50">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatPaise(itemizedBreakdown.itemSubtotalPaise)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax Share:</span>
                      <span>+{formatPaise(itemizedBreakdown.proportionalTaxPaise)}</span>
                    </div>
                    {itemizedBreakdown.proportionalDiscountPaise > 0 && (
                      <div className="flex justify-between text-emerald-400">
                        <span>Discount:</span>
                        <span>-{formatPaise(itemizedBreakdown.proportionalDiscountPaise)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action to persist / save expense */}
        {onSaveExpense && (
          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleCreateExpense}
              disabled={hasErrors || !payerId}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-md shadow-blue-900/30 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add as Confirmed Expense into Active Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
