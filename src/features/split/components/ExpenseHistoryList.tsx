import React, { useState, useMemo } from 'react';
import type { Expense, Member } from '../../../types/domain';
import { formatPaise } from '../../settlement/balances';
import { MemberAvatar } from '../../groups/components/MemberAvatar';
import {
  Receipt,
  Search,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronUp,
  Tag,
  PlusCircle,
  Camera,
  Layers,
  Utensils,
  ShoppingCart,
  Plane,
  Zap,
  Film,
  CheckCircle2,
} from 'lucide-react';

interface ExpenseHistoryListProps {
  expenses: Expense[];
  members: Member[];
  onDeleteExpense: (expenseId: string) => void;
  onOpenScanModal: () => void;
  onOpenManualModal: () => void;
}

export const ExpenseHistoryList: React.FC<ExpenseHistoryListProps> = ({
  expenses,
  members,
  onDeleteExpense,
  onOpenScanModal,
  onOpenManualModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const filteredExpenses = useMemo(() => {
    return [...expenses].reverse().filter((exp) => {
      const descMatch = exp.description.toLowerCase().includes(searchTerm.toLowerCase());
      const payerName = memberMap.get(exp.payerId)?.name.toLowerCase() || '';
      const payerMatch = payerName.includes(searchTerm.toLowerCase());
      const itemMatch = exp.items?.some((i) => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
      return descMatch || payerMatch || itemMatch;
    });
  }, [expenses, searchTerm, memberMap]);

  const totalGroupSpendPaise = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  }, [expenses]);

  const toggleExpand = (id: string) => {
    setExpandedExpenseId((prev) => (prev === id ? null : id));
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'Food': return Utensils;
      case 'Groceries': return ShoppingCart;
      case 'Travel': return Plane;
      case 'Utilities': return Zap;
      case 'Entertainment': return Film;
      default: return Tag;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Stats Banner */}
      <div className="liquid-glass-card rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Receipt className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-heading font-black text-white">
              Group Expenses & Receipts
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-mono-numbers font-semibold border border-blue-500/20">
              {expenses.length} Records
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 font-body">
            Total recorded spend across all group members:{' '}
            <span className="font-black text-white font-mono-numbers text-base">{formatPaise(totalGroupSpendPaise)}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onOpenScanModal}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-900/20 transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Scan Receipt</span>
          </button>

          <button
            type="button"
            onClick={onOpenManualModal}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-900/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Manual</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      {expenses.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search expenses by title, member, or line item name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Expenses List */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="font-bold text-slate-300 text-base">
            {expenses.length === 0 ? 'No expenses recorded yet' : 'No matching expenses found'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            {expenses.length === 0
              ? 'Scan a receipt or add a manual expense to start tracking group balances.'
              : 'Try searching with a different term or clear the search input.'}
          </p>
          {expenses.length === 0 && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={onOpenScanModal}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Scan First Receipt
              </button>
              <button
                type="button"
                onClick={onOpenManualModal}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Manual Expense
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((exp) => {
            const payer = memberMap.get(exp.payerId);
            const isExpanded = expandedExpenseId === exp.id;
            const CategoryIcon = getCategoryIcon(exp.items?.[0]?.category);

            return (
              <div
                key={exp.id}
                className="liquid-glass-card rounded-2xl overflow-hidden shadow-sm transition-all hover:border-white/20"
              >
                {/* Expense Card Header */}
                <div
                  onClick={() => toggleExpand(exp.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-850/40"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="p-2.5 rounded-xl bg-slate-800 text-blue-400 border border-slate-700 shrink-0">
                      <CategoryIcon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-100 text-sm sm:text-base truncate">
                          {exp.description}
                        </h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700/60 font-medium capitalize">
                          {exp.splitMode} split
                        </span>
                        {exp.items && exp.items.length > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                            {exp.items.length} items
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {exp.date}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5">
                          <MemberAvatar member={payer} size="xs" />
                          <span>Paid by</span>
                          <span className="font-medium text-slate-200">
                            {payer ? payer.name : 'Unknown member'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    <div className="text-left sm:text-right">
                      <div className="font-extrabold text-base sm:text-lg text-slate-100">
                        {formatPaise(exp.amountPaise)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {exp.memberShares.length} participants
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete expense "${exp.description}"? Balances will be recalculated.`)) {
                            onDeleteExpense(exp.id);
                          }
                        }}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                        title="Delete expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <span className="p-1 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Items & Member Shares */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 bg-slate-950/60 p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
                    {/* Line Items Table (if any) */}
                    {exp.items && exp.items.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-400" />
                          <span>Receipt Line Items</span>
                        </div>
                        <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80 bg-slate-900/60">
                          {exp.items.map((it) => (
                            <div key={it.id} className="p-2.5 sm:px-3.5 flex items-center justify-between text-xs sm:text-sm">
                              <div className="flex-1 min-w-0 pr-3">
                                <div className="font-medium text-slate-200 truncate">{it.name}</div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>Qty: {it.quantity}</span>
                                  <span>•</span>
                                  <span>@ {formatPaise(it.unitPricePaise)}</span>
                                  {it.category && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-300">{it.category}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="font-bold text-slate-100 whitespace-nowrap">
                                {formatPaise(it.lineTotalPaise)}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Charges breakdown if any */}
                        {((exp.taxLines && exp.taxLines.length > 0) || exp.serviceChargePaise > 0 || exp.discountPaise > 0) && (
                          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs text-slate-400">
                            {exp.taxLines?.map((t, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span>{t.label}:</span>
                                <span className="text-slate-200 font-medium">+{formatPaise(t.amountPaise)}</span>
                              </div>
                            ))}
                            {exp.serviceChargePaise > 0 && (
                              <div className="flex justify-between">
                                <span>Service Charge:</span>
                                <span className="text-slate-200 font-medium">+{formatPaise(exp.serviceChargePaise)}</span>
                              </div>
                            )}
                            {exp.discountPaise > 0 && (
                              <div className="flex justify-between text-emerald-400">
                                <span>Discount:</span>
                                <span className="font-medium">-{formatPaise(exp.discountPaise)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Member Shares Distribution */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Member Shares Allocation</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {exp.memberShares.map((share) => {
                          const m = memberMap.get(share.memberId);
                          return (
                            <div
                              key={share.memberId}
                              className="bg-slate-900 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <MemberAvatar member={m} size="xs" />
                                <span className="font-medium text-slate-200 truncate">
                                  {m ? m.name : share.memberId}
                                </span>
                              </div>
                              <span className="font-bold text-slate-100 whitespace-nowrap">
                                {formatPaise(share.amountPaise)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
