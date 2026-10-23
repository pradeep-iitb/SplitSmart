import { useState } from 'react';
import type {
  Expense,
  Group,
  Member,
  RecordedSettlement,
  SuggestedPayment,
} from './types/domain';
import {
  calculateDetailedBalances,
  calculateGroupBalances,
} from './features/settlement/balances';
import { suggestSettlements } from './features/settlement/simplify';
import { createRecordedSettlement } from './features/settlement/settlement';
import { BalancesDashboard } from './features/settlement/components/BalancesDashboard';
import { DebtSimplificationCard } from './features/settlement/components/DebtSimplificationCard';
import { UpiPaymentModal } from './features/settlement/components/UpiPaymentModal';
import { SettlementHistoryList } from './features/settlement/components/SettlementHistoryList';
import { AnalyticsDashboard } from './features/settlement/components/AnalyticsDashboard';
import { ExportPanel } from './features/settlement/components/ExportPanel';

// Import Fixtures
import group4Fixture from './test/fixtures/group-4.json';
import expense840Fixture from './test/fixtures/expense-840.json';
import mixedPayersFixture from './test/fixtures/expenses-mixed-payers.json';
import partialSettlementsFixture from './test/fixtures/settlements-partial.json';

import {
  Wallet,
  BarChart3,
  Share2,
  Cpu,
  RefreshCw,
  PlusCircle,
  Receipt,
  Layers,
} from 'lucide-react';

type TabType = 'settlement' | 'analytics' | 'export' | 'algorithm';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('settlement');
  const [selectedScenario, setSelectedScenario] = useState<string>('mixed-payers');

  // Active state
  const [group, setGroup] = useState<Group>(() => ({
    id: 'g-mixed',
    name: 'Goa Friends Vacation',
    createdAt: '2026-10-18T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
  }));

  const [members, setMembers] = useState<Member[]>(
    () => mixedPayersFixture.members as Member[]
  );

  const [expenses, setExpenses] = useState<Expense[]>(
    () => mixedPayersFixture.expenses as Expense[]
  );

  const [settlements, setSettlements] = useState<RecordedSettlement[]>(
    () => partialSettlementsFixture.settlements as RecordedSettlement[]
  );

  // Active modal state
  const [activeUpiPayment, setActiveUpiPayment] = useState<SuggestedPayment | null>(null);

  // Quick expense form state for interactive sandbox
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseRupees, setNewExpenseRupees] = useState('');
  const [newExpensePayerId, setNewExpensePayerId] = useState('');

  // Scenario switch handler
  const loadScenario = (scenarioKey: string) => {
    setSelectedScenario(scenarioKey);
    if (scenarioKey === 'group-4') {
      setGroup(group4Fixture.group);
      setMembers(group4Fixture.members as Member[]);
      setExpenses([expense840Fixture as Expense]);
      setSettlements([]);
    } else if (scenarioKey === 'mixed-payers') {
      setGroup({
        id: 'g-mixed',
        name: 'Goa Friends Vacation',
        createdAt: '2026-10-18T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      });
      setMembers(mixedPayersFixture.members as Member[]);
      setExpenses(mixedPayersFixture.expenses as Expense[]);
      setSettlements(partialSettlementsFixture.settlements as RecordedSettlement[]);
    } else if (scenarioKey === 'counterexample') {
      setGroup({
        id: 'g-counter',
        name: 'Algorithmic Benchmark Group',
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
      });
      const counterMembers: Member[] = [
        { id: 'm-A', groupId: 'g-counter', name: 'Alice (+₹400)', color: '#ec4899', upiId: 'alice@oksbi', active: true },
        { id: 'm-B', groupId: 'g-counter', name: 'Bob (+₹300)', color: '#3b82f6', upiId: 'bob@okhdfc', active: true },
        { id: 'm-C', groupId: 'g-counter', name: 'Charlie (-₹300)', color: '#10b981', upiId: 'charlie@icici', active: true },
        { id: 'm-D', groupId: 'g-counter', name: 'Dave (-₹200)', color: '#f59e0b', upiId: 'dave@paytm', active: true },
        { id: 'm-E', groupId: 'g-counter', name: 'Eve (-₹200)', color: '#8b5cf6', upiId: 'eve@axis', active: true },
      ];
      setMembers(counterMembers);
      // Synthetic expenses to produce exact net balances: A: +400, B: +300, C: -300, D: -200, E: -200
      const syntheticExpenses: Expense[] = [
        {
          id: 'exp-bench-1',
          groupId: 'g-counter',
          description: 'Benchmark Expense 1 (Alice paid)',
          date: '2026-10-23',
          payerId: 'm-A',
          amountPaise: 40000,
          splitMode: 'exact',
          memberShares: [
            { memberId: 'm-D', amountPaise: 20000 },
            { memberId: 'm-E', amountPaise: 20000 },
          ],
          items: [],
          taxLines: [],
          serviceChargePaise: 0,
          discountPaise: 0,
          createdAt: '2026-10-23T10:00:00Z',
        },
        {
          id: 'exp-bench-2',
          groupId: 'g-counter',
          description: 'Benchmark Expense 2 (Bob paid)',
          date: '2026-10-23',
          payerId: 'm-B',
          amountPaise: 30000,
          splitMode: 'exact',
          memberShares: [
            { memberId: 'm-C', amountPaise: 30000 },
          ],
          items: [],
          taxLines: [],
          serviceChargePaise: 0,
          discountPaise: 0,
          createdAt: '2026-10-23T11:00:00Z',
        },
      ];
      setExpenses(syntheticExpenses);
      setSettlements([]);
    }
  };

  // Balance & Suggestion calculations
  const memberIds = members.map((m) => m.id);
  const balances = calculateGroupBalances(memberIds, expenses, settlements);
  const detailedBalances = calculateDetailedBalances(members, expenses, settlements);
  const suggestions = suggestSettlements(balances);

  // Settlement recording actions
  const handleRecordSettlement = (payment: SuggestedPayment, note = 'Settled via SplitSmart') => {
    const recorded = createRecordedSettlement(payment, {
      groupId: group.id,
      note,
    });
    setSettlements((prev) => [...prev, recorded]);
  };

  const handleUndoSettlement = (settlementId: string) => {
    setSettlements((prev) => prev.filter((s) => s.id !== settlementId));
  };

  const handleUpdatePayeeUpiId = (memberId: string, newUpiId: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, upiId: newUpiId } : m))
    );
  };

  // Add custom manual expense
  const handleAddManualExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const rupees = parseFloat(newExpenseRupees);
    if (!newExpenseDesc || isNaN(rupees) || rupees <= 0 || !newExpensePayerId) return;

    const amountPaise = Math.round(rupees * 100);
    const count = members.length;
    const baseShare = Math.floor(amountPaise / count);
    const remainder = amountPaise % count;

    // Distribute remainder paise deterministically
    const memberShares = members.map((m, idx) => ({
      memberId: m.id,
      amountPaise: baseShare + (idx < remainder ? 1 : 0),
    }));

    const newExpense: Expense = {
      id: `exp-user-${Date.now()}`,
      groupId: group.id,
      description: newExpenseDesc,
      date: new Date().toISOString().substring(0, 10),
      payerId: newExpensePayerId,
      amountPaise,
      splitMode: 'equal',
      memberShares,
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: new Date().toISOString(),
    };

    setExpenses((prev) => [...prev, newExpense]);
    setNewExpenseDesc('');
    setNewExpenseRupees('');
    setShowAddExpense(false);
  };

  const payeeMember = activeUpiPayment
    ? members.find((m) => m.id === activeUpiPayment.toMemberId)
    : undefined;

  const payerMember = activeUpiPayment
    ? members.find((m) => m.id === activeUpiPayment.fromMemberId)
    : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center font-black text-white shadow-md shadow-blue-900/30">
              S²
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-slate-100 tracking-tight">
                  SplitSmart
                </h1>
                <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">
                  Member 4
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Balances, Optimal Debt Simplification & UPI Settle-up
              </p>
            </div>
          </div>

          {/* Test Scenario Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden md:inline flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Scenario:
            </span>
            <select
              value={selectedScenario}
              onChange={(e) => loadScenario(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="mixed-payers">5 Members · 10 Mixed Expenses</option>
              <option value="group-4">4 Members · Goa Trip (Riya ₹840)</option>
              <option value="counterexample">Exact NP-hard vs Greedy Counterexample</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex overflow-x-auto gap-2 border-t border-slate-800/60 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('settlement')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'settlement'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Balances & Settle-Up</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Spending Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'export'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Export & Share</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('algorithm')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'algorithm'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Algorithm Deep-Dive</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Scenario Header Card */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
              Active Group
            </div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>{group.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-normal">
                {members.length} members · {expenses.length} expenses
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddExpense(!showAddExpense)}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Custom Expense</span>
            </button>

            <button
              type="button"
              onClick={() => loadScenario(selectedScenario)}
              title="Reset current fixture"
              className="p-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Add Expense Form Drawer */}
        {showAddExpense && (
          <form
            onSubmit={handleAddManualExpense}
            className="bg-slate-900 border border-blue-500/30 p-4 rounded-2xl shadow-lg space-y-3 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5" />
                <span>Add Simulated Expense (Split Equally)</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddExpense(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Description (e.g. Goa Shack Lunch)"
                value={newExpenseDesc}
                onChange={(e) => setNewExpenseDesc(e.target.value)}
                required
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />

              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount in ₹ (e.g. 500.00)"
                value={newExpenseRupees}
                onChange={(e) => setNewExpenseRupees(e.target.value)}
                required
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />

              <select
                value={newExpensePayerId}
                onChange={(e) => setNewExpensePayerId(e.target.value)}
                required
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">Select Payer...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
              >
                Save & Recalculate Balances
              </button>
            </div>
          </form>
        )}

        {/* Tab 1: Balances & Settlement */}
        {activeTab === 'settlement' && (
          <div className="space-y-6">
            <BalancesDashboard
              members={members}
              detailedBalances={detailedBalances}
            />

            <DebtSimplificationCard
              balances={balances}
              members={members}
              onOpenUpiModal={(payment) => setActiveUpiPayment(payment)}
              onRecordSettlement={handleRecordSettlement}
            />

            <SettlementHistoryList
              settlements={settlements}
              members={members}
              onUndoSettlement={handleUndoSettlement}
            />
          </div>
        )}

        {/* Tab 2: Spending Analytics */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard expenses={expenses} members={members} />
        )}

        {/* Tab 3: Export & Share */}
        {activeTab === 'export' && (
          <ExportPanel
            group={group}
            members={members}
            expenses={expenses}
            balances={balances}
            suggestions={suggestions}
            settlements={settlements}
          />
        )}

        {/* Tab 4: Algorithm Deep-Dive */}
        {activeTab === 'algorithm' && (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-slate-100 text-lg">
                Debt Simplification Algorithm: Exact NP-Hard vs. Greedy
              </h3>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p>
                The problem of finding the <strong>global minimum number of transactions</strong> to settle debts among $N$ individuals with net balances summing to zero is mathematically equivalent to the <strong>Maximum Disjoint Zero-Sum Subsets Problem</strong>, which is known to be <strong>NP-hard</strong>.
              </p>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <div className="font-semibold text-emerald-400 text-sm">
                  Mathematical Theorem:
                </div>
                <p>
                  Any group of m participants whose net balances sum to zero can be settled among themselves in exactly m - 1 transactions.
                  If the set of N non-zero balance participants can be partitioned into k disjoint non-empty subsets S₁, S₂, ..., Sₖ such that each sum is 0, then the minimum number of transactions is:
                </p>
                <div className="font-mono text-center text-sm font-bold text-slate-100 py-1 bg-slate-950 rounded-lg">
                  T_min = N - k
                </div>
                <p>
                  Therefore, minimizing transactions is equivalent to <strong>maximizing k</strong> (the number of independent zero-sum groups).
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-200 text-sm">
                  Why Standard Greedy Heuristic is Suboptimal:
                </h4>
                <p>
                  Greedy cash flow pairing matches the largest creditor with the largest debtor first. While greedy runs in O(N log N) and takes at most N - 1 transactions, it frequently destroys zero-sum subsets!
                </p>
                <p className="font-mono bg-slate-900 p-3 rounded-lg text-slate-300">
                  Example Scenario (Scenario 3 in top selector):<br />
                  Creditors: Alice (+₹400), Bob (+₹300)<br />
                  Debtors: Charlie (-₹300), Dave (-₹200), Eve (-₹200)<br />
                  • <strong>Exact DP Algorithm</strong> recognizes that {'{'}Bob: +300, Charlie: -300{'}'} is a zero-sum subset (1 transfer), and {'{'}Alice: +400, Dave: -200, Eve: -200{'}'} is another zero-sum subset (2 transfers). Total = <strong>3 transfers</strong>.<br />
                  • <strong>Greedy Heuristic</strong> pairs largest Alice (+400) with largest Charlie (-300) first, taking <strong>4 transfers</strong>!
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-slate-200 text-sm">
                  Our Implementation Architecture:
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>
                    <strong className="text-slate-200">Exact Bitmask DP (N ≤ 16)</strong>: Solves the NP-hard partition problem in milliseconds with zero perceptible UI latency.
                  </li>
                  <li>
                    <strong className="text-slate-200">Greedy Fallback (N &gt; 16)</strong>: Automatically switches to the fast greedy matching if group size exceeds computational limits.
                  </li>
                  <li>
                    <strong className="text-slate-200">Integer Paise Conservation</strong>: All calculations run on integer paise to eliminate floating-point imprecision.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 px-6 text-center text-xs text-slate-500">
        SplitSmart · Web Brawl GC 2026 · Member 4: Balances & Debt Simplification · Client-Side Offline First
      </footer>

      {/* Live UPI Payment Modal */}
      {activeUpiPayment && (
        <UpiPaymentModal
          payment={activeUpiPayment}
          payee={payeeMember}
          payer={payerMember}
          onClose={() => setActiveUpiPayment(null)}
          onConfirmSettlement={handleRecordSettlement}
          onUpdatePayeeUpiId={handleUpdatePayeeUpiId}
        />
      )}
    </div>
  );
}
