import { useState, useEffect } from 'react';
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

// Member 3 (Split Engine & Expenses) Components
import { SplitStudio, type SplitStudioDraft } from './features/split/components/SplitStudio';
import { ManualExpenseModal } from './features/split/components/ManualExpenseModal';
import { ReceiptScanModal } from './features/split/components/ReceiptScanModal';
import { ExpenseHistoryList } from './features/split/components/ExpenseHistoryList';
import { RecurringExpenseManager } from './features/split/components/RecurringExpenseManager';
import { RoundingDebuggerCard } from './features/split/components/RoundingDebuggerCard';

// Member 5 (State, Persistence & Sharing) Components & Store
import { GroupManagerModal } from './features/groups/components/GroupManagerModal';
import { MemberManagementModal } from './features/groups/components/MemberManagementModal';
import { MemberAvatar } from './features/groups/components/MemberAvatar';
import { BackupShareModal } from './features/groups/components/BackupShareModal';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { useGroupStore } from './store/groupStore';
import { decodeGroupFromUrlHash } from './features/sharing/sharingService';

// Import Fixtures
import group4Fixture from './test/fixtures/group-4.json';
import expense840Fixture from './test/fixtures/expense-840.json';
import mixedPayersFixture from './test/fixtures/expenses-mixed-payers.json';
import partialSettlementsFixture from './test/fixtures/settlements-partial.json';

import {
  Wallet,
  BarChart3,
  Share2,
  RefreshCw,
  PlusCircle,
  Receipt,
  Layers,
  Calculator,
  Scale,
  Repeat,
  FolderOpen,
  Users,
  WifiOff,
  Camera,
  CheckCircle2,
  X,
} from 'lucide-react';

type TabType =
  | 'split-studio'
  | 'expenses'
  | 'settlement'
  | 'rounding'
  | 'recurring'
  | 'analytics'
  | 'export';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('split-studio');
  const [selectedScenario, setSelectedScenario] = useState<string>('mixed-payers');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [splitStudioDraft, setSplitStudioDraft] = useState<SplitStudioDraft | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Member 5: IndexedDB Zustand Store & Offline hook
  const {
    groups,
    activeGroupId,
    activeGroup: storeGroup,
    members: storeMembers,
    expenses: storeExpenses,
    settlements: storeSettlements,
    init: initStore,
    switchGroup,
    createGroup,
    renameGroup,
    deleteGroup,
    addMember,
    updateMember,
    removeMember,
    saveExpense: storeSaveExpense,
    recordSettlement: storeRecordSettlement,
    undoSettlement: storeUndoSettlement,
  } = useGroupStore();

  const { isOffline } = useOfflineStatus();

  // Active state fallback
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

  // Initialize IndexedDB and check URL hash on mount (PS Point 14 & 17)
  useEffect(() => {
    (async () => {
      if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('share=')) {
        const importedId = await decodeGroupFromUrlHash(window.location.hash);
        if (importedId) {
          window.location.hash = '';
          await initStore();
          await switchGroup(importedId);
          return;
        }
      }
      await initStore();
    })();
  }, []);

  // Synchronize from IndexedDB store whenever active group or records update
  useEffect(() => {
    if (storeGroup) {
      setGroup(storeGroup);
      setMembers(storeMembers);
      setExpenses(storeExpenses);
      setSettlements(storeSettlements);
    }
  }, [storeGroup, storeMembers, storeExpenses, storeSettlements]);

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

  // Settlement recording actions with IndexedDB persistence
  const handleRecordSettlement = async (payment: SuggestedPayment, note = 'Settled via SplitSmart') => {
    const recorded = createRecordedSettlement(payment, {
      groupId: group.id,
      note,
    });
    setSettlements((prev) => [...prev, recorded]);
    if (storeGroup && storeGroup.id === group.id) {
      await storeRecordSettlement(recorded);
    }
  };

  const handleUndoSettlement = async (settlementId: string) => {
    setSettlements((prev) => prev.filter((s) => s.id !== settlementId));
    if (storeGroup && storeGroup.id === group.id) {
      await storeUndoSettlement(settlementId);
    }
  };

  const handleUpdatePayeeUpiId = async (memberId: string, newUpiId: string) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, upiId: newUpiId } : m))
    );
    if (storeGroup && storeGroup.id === group.id) {
      await updateMember(memberId, { upiId: newUpiId });
    }
  };

  const handleSaveExpense = async (newExp: Expense) => {
    setExpenses((prev) => [...prev, newExp]);
    try {
      if (storeGroup && storeGroup.id === group.id) {
        await storeSaveExpense(newExp);
      }
    } catch (err) {
      console.warn('Could not persist expense to IndexedDB:', err);
    }
    setSuccessToast(`Expense "${newExp.description}" recorded successfully!`);
    setActiveTab('expenses');
  };

  const handleDeleteExpense = async (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    try {
      if (storeGroup && storeGroup.id === group.id) {
        await useGroupStore.getState().deleteExpense(expenseId);
      }
    } catch (err) {
      console.warn('Could not delete expense from IndexedDB:', err);
    }
    setSuccessToast('Expense deleted and balances recalculated.');
  };

  // Add custom manual expense
  const handleAddManualExpense = async (e: React.FormEvent) => {
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

    await handleSaveExpense(newExpense);
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
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
        <div className="max-w-[1500px] w-full mx-auto px-4 sm:px-8 min-h-[4.5rem] py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <img
              src="/Images/SplitSmart Neon Receipt Logo.png"
              alt="SplitSmart Logo"
              className="w-12 h-12 object-contain rounded-xl drop-shadow-[0_0_15px_rgba(59,130,246,0.5)] shrink-0"
            />
            <div>
              <h1 className="font-extrabold text-2xl text-slate-100 tracking-tight">
                SplitSmart
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 hidden sm:block">
                Intelligent Group Expense Splitting, Fair Allocations & Instant Settlement
              </p>
            </div>
          </div>

          {/* Test Scenario Selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-400 md:inline flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-400" />
              Scenario:
            </span>
            <select
              value={selectedScenario}
              onChange={(e) => loadScenario(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-sm font-medium rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
            >
              <option value="mixed-payers">5 Members · 10 Mixed Expenses</option>
              <option value="group-4">4 Members · Goa Trip (Riya ₹840)</option>
              <option value="counterexample">Exact NP-hard vs Greedy Counterexample</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-[1500px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-start sm:justify-center overflow-x-auto gap-1 sm:gap-2 border-t border-slate-800/80 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('split-studio')}
            className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'split-studio'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Calculator className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>Split Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'expenses'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Receipt className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>Expenses</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 font-semibold">
              {expenses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settlement')}
            className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'settlement'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Wallet className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>Balances & Settlement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rounding')}
            className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'rounding'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Scale className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>Rounding Engine</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recurring')}
            className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'recurring'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Repeat className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>Recurring Schedules</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>Spending Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'export'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Share2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            <span>Export & Share</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1500px] w-full mx-auto px-3.5 sm:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {/* Scenario Header Card */}
        <div className="bg-linear-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-4 sm:p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">
              Active Group
            </div>
            <h2 className="text-2xl font-black text-slate-100 flex items-center gap-3">
              <span>{group.name}</span>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700/50 flex items-center gap-1.5">
                <span className="flex -space-x-1.5 overflow-hidden">
                  {members.slice(0, 5).map((m) => (
                    <MemberAvatar key={m.id} member={m} size="xs" showRing className="ring-slate-900" />
                  ))}
                </span>
                <span>{members.length} members · {expenses.length} expenses</span>
              </span>
              {isOffline && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  <WifiOff className="w-3.5 h-3.5" />
                  Offline Mode
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(true)}
              className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition-all cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-blue-400" />
              <span>Switch Group</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMemberModalOpen(true)}
              className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition-all cursor-pointer"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Members</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBackupModalOpen(true)}
              className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-purple-400" />
              <span>Backup & Share</span>
            </button>

            <button
              type="button"
              onClick={() => setIsManualModalOpen(true)}
              className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-900/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Expense</span>
            </button>

            <button
              type="button"
              onClick={() => setIsScanModalOpen(true)}
              className="inline-flex items-center gap-2 py-2 px-4 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold shadow-md shadow-emerald-900/20 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Scan Receipt</span>
            </button>

            <button
              type="button"
              onClick={() => loadScenario(selectedScenario)}
              title="Reset current fixture"
              className="p-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
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

        {/* Split Studio */}
        {activeTab === 'split-studio' && (
          <SplitStudio
            members={members}
            onSaveExpense={handleSaveExpense}
            initialDraft={splitStudioDraft}
            onClearDraft={() => setSplitStudioDraft(null)}
          />
        )}

        {/* Group Expenses List */}
        {activeTab === 'expenses' && (
          <ExpenseHistoryList
            expenses={expenses}
            members={members}
            onDeleteExpense={handleDeleteExpense}
            onOpenScanModal={() => setIsScanModalOpen(true)}
            onOpenManualModal={() => setIsManualModalOpen(true)}
          />
        )}

        {/* Tab M3: Hamilton-Hare Rounding & Conservation (PS Point 11) */}
        {activeTab === 'rounding' && (
          <RoundingDebuggerCard members={members} />
        )}

        {/* Tab M3: Recurring Expenses & Automation (PS Point 19) */}
        {activeTab === 'recurring' && (
          <RecurringExpenseManager
            members={members}
            groupId={group.id}
            existingExpenses={expenses}
            onExpensesMaterialized={(newExps) =>
              setExpenses((prev) => [...prev, ...newExps])
            }
          />
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-6 px-8 text-center text-sm text-slate-500">
        SplitSmart · Client-Side Group Expense Splitting, Debt Simplification & Instant UPI Settlement
      </footer>

      {/* Live UPI Payment Modal (M4) */}
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

      {/* Manual Expense Modal */}
      <ManualExpenseModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        members={members}
        groupId={group.id}
        onSaveExpense={handleSaveExpense}
      />

      {/* Smart OCR Receipt Scanner Modal */}
      {isScanModalOpen && (
        <ReceiptScanModal
          isOpen={isScanModalOpen}
          onClose={() => setIsScanModalOpen(false)}
          members={members}
          groupId={group.id}
          onSaveExpense={handleSaveExpense}
          onOpenInSplitStudio={(draft) => {
            setSplitStudioDraft(draft);
            setActiveTab('split-studio');
            setIsScanModalOpen(false);
          }}
        />
      )}

      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs sm:text-sm font-semibold animate-in slide-in-from-bottom-5 duration-200 border border-emerald-400/40">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="ml-2 text-emerald-200 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Group Manager Modal (PS Point 1 & 14) */}
      <GroupManagerModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        groups={groups}
        activeGroupId={activeGroupId}
        onSelectGroup={async (id) => {
          await switchGroup(id);
          setIsGroupModalOpen(false);
        }}
        onCreateGroup={async (name) => {
          return await createGroup(name);
        }}
        onRenameGroup={async (id, name) => {
          await renameGroup(id, name);
        }}
        onDeleteGroup={async (id) => {
          await deleteGroup(id);
        }}
      />

      {/* Member Management Modal (PS Point 1) */}
      <MemberManagementModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        groupName={group.name}
        members={members}
        onAddMember={async (name, options) => {
          return await addMember(name, options);
        }}
        onUpdateMember={async (id, patch) => {
          await updateMember(id, patch);
        }}
        onRemoveMember={async (id) => {
          await removeMember(id);
        }}
      />

      {/* Backup & Share Modal (PS Point 14, 17, 18) */}
      <BackupShareModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        group={group}
        onImportSuccess={async (importedId) => {
          await initStore();
          await switchGroup(importedId);
        }}
      />
    </div>
  );
}
