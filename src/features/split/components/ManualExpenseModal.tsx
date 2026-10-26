import React, { useState } from 'react';
import type { Category, Expense, Member, SplitMode } from '../../../types/domain';
import { createManualExpense } from '../manualExpense';
import { formatPaise } from '../../settlement/balances';
import {
  X,
  PlusCircle,
  Receipt,
  Utensils,
  ShoppingCart,
  Plane,
  Zap,
  Film,
  FolderMinus,
  AlertCircle,
  Coins,
  Percent,
  Scale,
  Divide,
} from 'lucide-react';

interface ManualExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  groupId: string;
  onSaveExpense: (expense: Expense) => void;
}

const CATEGORIES: Array<{ key: Category; label: string; icon: React.ElementType }> = [
  { key: 'Food', label: 'Food & Dining', icon: Utensils },
  { key: 'Groceries', label: 'Groceries', icon: ShoppingCart },
  { key: 'Travel', label: 'Travel & Taxi', icon: Plane },
  { key: 'Utilities', label: 'Utilities / Wi-Fi', icon: Zap },
  { key: 'Entertainment', label: 'Entertainment', icon: Film },
  { key: 'Other', label: 'Other', icon: FolderMinus },
];

export const ManualExpenseModal: React.FC<ManualExpenseModalProps> = ({
  isOpen,
  onClose,
  members,
  groupId,
  onSaveExpense,
}) => {
  const [description, setDescription] = useState('');
  const [rupees, setRupees] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [payerId, setPayerId] = useState(members[0]?.id || '');
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    members.map((m) => m.id)
  );

  // Exact / Percentage / Shares inputs
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, number>>(() => {
    const res: Record<string, number> = {};
    const count = members.length;
    const base = Math.floor(10000 / count);
    members.forEach((m) => {
      res[m.id] = base;
    });
    return res;
  });
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const res: Record<string, number> = {};
    members.forEach((m) => {
      res[m.id] = 1;
    });
    return res;
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const parsedAmountRupees = parseFloat(rupees) || 0;
  const amountPaise = Math.round(parsedAmountRupees * 100);

  const toggleParticipant = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const exactPaiseMap: Record<string, number> = {};
      for (const [id, valStr] of Object.entries(exactAmounts)) {
        exactPaiseMap[id] = Math.round((parseFloat(valStr) || 0) * 100);
      }

      const expense = createManualExpense(
        {
          groupId,
          description,
          category,
          date,
          payerId,
          amountPaise,
          splitMode,
          participantIds: selectedMemberIds,
          exactAmounts: exactPaiseMap,
          percentagesBasisPoints: percentages,
          sharesWeights: weights,
        },
        members.map((m) => m.id)
      );

      onSaveExpense(expense);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create manual expense.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Receipt className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Add Manual Expense</h2>
              <p className="text-xs sm:text-sm text-slate-400">Record a non-receipt expense with flexible group split</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Description & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Description *
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Wi-Fi bill, Uber cab, Dinner"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">₹</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={rupees}
                  onChange={(e) => setRupees(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-slate-100 font-semibold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1" />
                    <span className="text-[10px] truncate max-w-full font-medium">
                      {cat.key}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payer and Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Paid By *
              </label>
              <select
                value={payerId}
                onChange={(e) => setPayerId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Split Mode Selector */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Split Mode
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'equal', label: 'Equal', icon: Divide },
                { id: 'exact', label: 'Exact', icon: Coins },
                { id: 'percentage', label: 'Percent', icon: Percent },
                { id: 'shares', label: 'Shares', icon: Scale },
              ].map((m) => {
                const Icon = m.icon;
                const active = splitMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSplitMode(m.id as SplitMode)}
                    className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                      active
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 font-semibold'
                        : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Participants Checklist */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Split Among ({selectedMemberIds.length} members)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const isSelected = selectedMemberIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleParticipant(m.id)}
                    className={`px-2.5 py-1 rounded-lg border text-xs transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-800/40 border-slate-700 text-slate-500 line-through'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Specific Inputs in Modal */}
          {splitMode === 'exact' && (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 space-y-2">
              <span className="font-semibold text-slate-300">Exact Amounts per Member:</span>
              <div className="grid grid-cols-2 gap-2">
                {selectedMemberIds.map((id) => {
                  const m = members.find((x) => x.id === id);
                  return (
                    <div key={id} className="flex items-center gap-1.5">
                      <span className="w-16 truncate text-slate-400">{m?.name || id}:</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={exactAmounts[id] ?? ''}
                        onChange={(e) =>
                          setExactAmounts({ ...exactAmounts, [id]: e.target.value })
                        }
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {splitMode === 'percentage' && (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 space-y-2">
              <span className="font-semibold text-slate-300">Percentages (basis points: 2500 = 25%):</span>
              <div className="grid grid-cols-2 gap-2">
                {selectedMemberIds.map((id) => {
                  const m = members.find((x) => x.id === id);
                  return (
                    <div key={id} className="flex items-center gap-1.5">
                      <span className="w-16 truncate text-slate-400">{m?.name || id}:</span>
                      <input
                        type="number"
                        step="100"
                        value={percentages[id] ?? 0}
                        onChange={(e) =>
                          setPercentages({
                            ...percentages,
                            [id]: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                      />
                      <span className="text-slate-500 text-[10px]">bps</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {splitMode === 'shares' && (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 space-y-2">
              <span className="font-semibold text-slate-300">Relative Ratio Weights (e.g. 1, 2):</span>
              <div className="grid grid-cols-2 gap-2">
                {selectedMemberIds.map((id) => {
                  const m = members.find((x) => x.id === id);
                  return (
                    <div key={id} className="flex items-center gap-1.5">
                      <span className="w-16 truncate text-slate-400">{m?.name || id}:</span>
                      <input
                        type="number"
                        min="1"
                        value={weights[id] ?? 1}
                        onChange={(e) =>
                          setWeights({
                            ...weights,
                            [id]: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                      />
                      <span className="text-slate-500 text-[10px]">x</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Preview */}
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
            <span className="text-slate-400">Total paise to split:</span>
            <span className="font-bold text-emerald-400 text-sm">
              {formatPaise(amountPaise)}
            </span>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/30"
            >
              <PlusCircle className="w-4 h-4" />
              Save Manual Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
