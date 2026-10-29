import { useState, useEffect } from 'react';
import type {
  Expense,
  Group,
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

// Split Engine & Expenses Components
import { SplitStudio, type SplitStudioDraft } from './features/split/components/SplitStudio';
import { ManualExpenseModal } from './features/split/components/ManualExpenseModal';
import { ReceiptScanModal } from './features/split/components/ReceiptScanModal';
import { ExpenseHistoryList } from './features/split/components/ExpenseHistoryList';
import { RecurringExpenseManager } from './features/split/components/RecurringExpenseManager';

// State, Persistence & Sharing Components & Store
import { GroupManagerModal } from './features/groups/components/GroupManagerModal';
import { MemberManagementModal } from './features/groups/components/MemberManagementModal';
import { MemberAvatar } from './features/groups/components/MemberAvatar';
import { BackupShareModal } from './features/groups/components/BackupShareModal';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { useGroupStore } from './store/groupStore';
import { decodeGroupFromUrlHash } from './features/sharing/sharingService';

// Modern Visual Components
import { type NavItem } from './components/FloatingNav';
import { AppNavigation } from './components/AppNavigation';
import { LandingScreen, DashboardScreen } from './components/HomeScreens';
import './components/appTheme.css';

import {
  FolderOpen,
  Users,
  WifiOff,
  CheckCircle2,
  X,
  Share2,
  Sparkles,
  Receipt,
  Scale,
  Clock,
  BarChart3,
} from 'lucide-react';

type TabType =
  | 'dashboard'
  | 'split-studio'
  | 'expenses'
  | 'settlement'
  | 'recurring'
  | 'analytics'
  | 'export';

export default function App() {
  // Navigation & View state
  const [view, setView] = useState<'landing' | 'app'>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#/app')) {
      return 'app';
    }
    return 'landing';
  });

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [splitStudioDraft, setSplitStudioDraft] = useState<SplitStudioDraft | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Active modal state
  const [activeUpiPayment, setActiveUpiPayment] = useState<SuggestedPayment | null>(null);

  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Handle URL hash changes
  useEffect(() => {
    const handleHash = () => {
      if (typeof window === 'undefined') return;
      if (window.location.hash.startsWith('#/app')) {
        setView('app');
        const match = window.location.hash.match(/tab=([a-z-]+)/);
        if (match && match[1]) {
          setActiveTab(match[1] as TabType);
        }
      } else if (!window.location.hash.includes('share=')) {
        if (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#/landing') {
          setView('landing');
        }
      }
    };

    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigateToApp = (tab: TabType = 'dashboard') => {
    setActiveTab(tab);
    setView('app');
    window.location.hash = `#/app?tab=${tab}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToLanding = () => {
    setView('landing');
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // IndexedDB Zustand Store & Offline status
  const {
    groups,
    activeGroupId,
    activeGroup,
    members,
    expenses,
    settlements,
    recurringTemplates,
    init: initStore,
    switchGroup,
    createGroup,
    renameGroup,
    deleteGroup,
    addMember,
    updateMember,
    removeMember,
    saveExpense: storeSaveExpense,
    deleteExpense: storeDeleteExpense,
    recordSettlement: storeRecordSettlement,
    undoSettlement: storeUndoSettlement,
    saveRecurringTemplate: storeSaveRecurringTemplate,
    deleteRecurringTemplate: storeDeleteRecurringTemplate,
    materializeRecurringExpenses: storeMaterializeRecurringExpenses,
    resetCleanDemoData,

  } = useGroupStore();

  const { isOffline } = useOfflineStatus();

  // Initialize IndexedDB and check URL hash on mount
  useEffect(() => {
    (async () => {
      if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('share=')) {
        const importedId = await decodeGroupFromUrlHash(window.location.hash);
        if (importedId) {
          window.location.hash = '';
          await initStore();
          await switchGroup(importedId);
          navigateToApp('expenses');
          return;
        }
      }
      await initStore();
    })();
  }, []);

  // Safe active group fallback
  const group: Group = activeGroup || {
    id: activeGroupId || 'default-group',
    name: 'My Group',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Balance & Suggestion calculations reactively derived from live DB state
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
    await storeRecordSettlement(recorded);
    setSuccessToast(`Settlement of ₹${(payment.amountPaise / 100).toFixed(2)} recorded!`);
  };

  const handleUndoSettlement = async (settlementId: string) => {
    await storeUndoSettlement(settlementId);
    setSuccessToast('Settlement undone.');
  };

  const handleUpdatePayeeUpiId = async (memberId: string, newUpiId: string) => {
    await updateMember(memberId, { upiId: newUpiId });
  };

  const handleSaveExpense = async (newExp: Expense) => {
    try {
      await storeSaveExpense(newExp);
      setSuccessToast(`Expense "${newExp.description}" recorded!`);
      navigateToApp('expenses');
    } catch (err) {
      console.error('Could not persist expense to IndexedDB:', err);
      throw err;
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await storeDeleteExpense(expenseId);
      setSuccessToast('Expense deleted and balances updated.');
    } catch (err) {
      console.error('Could not delete expense from IndexedDB:', err);
    }
  };

  const payeeMember = activeUpiPayment
    ? members.find((m) => m.id === activeUpiPayment.toMemberId)
    : undefined;

  const payerMember = activeUpiPayment
    ? members.find((m) => m.id === activeUpiPayment.fromMemberId)
    : undefined;

  const appNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <FolderOpen className="w-3.5 h-3.5" /> },
    { id: 'split-studio', label: 'Studio', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'expenses', label: 'Expenses', badge: expenses.length, icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'settlement', label: 'Settlement', badge: suggestions.length > 0 ? suggestions.length : undefined, icon: <Scale className="w-3.5 h-3.5" /> },
    { id: 'recurring', label: 'Recurring', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'export', label: 'Share', icon: <Share2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="figma-engine min-h-screen bg-[#07090e] text-slate-100 flex flex-col antialiased relative selection:bg-purple-500/30 w-full max-w-full overflow-x-clip">
      {/* IMPROVED FLOATING NAVBAR: Matching Landing Page 75vw Liquid Glass with Responsive Mobile Menu */}
      {view === 'app' && (
        <AppNavigation
          items={appNavItems}
          activeId={activeTab}
          onChange={(id) => {
            setActiveTab(id as TabType);
            window.location.hash = `#/app?tab=${id}`;
          }}
          onReturnHome={navigateToLanding}
          onOpenScan={() => setIsScanModalOpen(true)}
          onOpenManual={() => setIsManualModalOpen(true)}
          onOpenGroups={() => setIsGroupModalOpen(true)}
        />
      )}

      {/* Main View Container */}
      <main className="flex-1 w-full relative z-10 flex flex-col">
        {view === 'landing' ? (
          <LandingScreen
            onOpenApp={() => navigateToApp('dashboard')}
            onScanReceipt={() => { navigateToApp('dashboard'); setIsScanModalOpen(true); }}
          />
        ) : (
          <div className="ss-app-content flex-1 max-w-[1500px] w-full max-w-full mx-auto px-3.5 sm:px-8 pt-24 pb-12 space-y-6 overflow-x-clip">
            {/* Active Group Context Bar (Engine view with Liquid Glass & Distinct Typography) */}
            <div className="liquid-glass-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-heading font-black text-white flex items-center gap-2.5">
                  <span>{group.name}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 font-display font-medium border border-white/10 flex items-center gap-1.5">
                    <span className="flex -space-x-1.5 overflow-hidden">
                      {members.slice(0, 5).map((m) => (
                        <MemberAvatar key={m.id} member={m} size="xs" showRing className="ring-slate-900" />
                      ))}
                    </span>
                    <span className="font-mono-numbers">{members.length} members · {expenses.length} expenses</span>
                  </span>
                </h2>

                {isOffline && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(true)}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span>Groups</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(true)}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Members</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBackupModalOpen(true)}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                  title="Share or backup group"
                >
                  <Share2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Split Studio */}
            {activeTab === 'dashboard' && <DashboardScreen
              groups={groups}
              activeGroupId={activeGroupId}
              members={members}
              expenses={expenses}
              settlements={settlements}
              balances={balances}
              onOpenApp={() => navigateToApp('dashboard')}
              onOpenGroup={async (id) => { await switchGroup(id); navigateToApp('expenses'); }}
              onCreateGroup={() => setIsGroupModalOpen(true)}
              onAddExpense={() => setIsManualModalOpen(true)}
              onScanReceipt={() => setIsScanModalOpen(true)}
              onOpenExpenses={() => navigateToApp('expenses')}
              onOpenBalances={() => navigateToApp('settlement')}
              onOpenAnalytics={() => navigateToApp('analytics')}
            />}
            {activeTab === 'split-studio' && (
              <SplitStudio
                members={members}
                onSaveExpense={handleSaveExpense}
                initialDraft={splitStudioDraft}
                onClearDraft={() => setSplitStudioDraft(null)}
              />
            )}

            {/* Tab 2: Group Expenses List */}
            {activeTab === 'expenses' && (
              <ExpenseHistoryList
                expenses={expenses}
                members={members}
                onDeleteExpense={handleDeleteExpense}
                onOpenScanModal={() => setIsScanModalOpen(true)}
                onOpenManualModal={() => setIsManualModalOpen(true)}
              />
            )}

            {/* Tab 3: Balances & Settlement */}
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

            {/* Tab 4: Recurring Expenses & Schedules */}
            {activeTab === 'recurring' && (
              <RecurringExpenseManager
                members={members}
                groupId={group.id}
                existingExpenses={expenses}
                templates={recurringTemplates}
                onSaveTemplate={storeSaveRecurringTemplate}
                onDeleteTemplate={storeDeleteRecurringTemplate}
                onMaterializeExpenses={storeMaterializeRecurringExpenses}
              />
            )}

            {/* Tab 5: Spending Analytics */}
            {activeTab === 'analytics' && (
              <AnalyticsDashboard expenses={expenses} members={members} />
            )}

            {/* Tab 6: Export & Share */}
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

            {/* Engine view footer */}
            <footer className="border-t border-slate-800/80 pt-8 pb-4 text-center text-xs text-slate-500">
              SplitSmart · Client-Side Group Expense Splitting, Debt Simplification & Instant UPI Settlement
            </footer>
          </div>
        )}
      </main>

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
          onAddMember={addMember}
          onOpenInSplitStudio={(draft) => {
            setSplitStudioDraft(draft);
            navigateToApp('split-studio');
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

      {/* Group Manager Modal */}
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
        onResetDemoData={async () => {
          await resetCleanDemoData();
          setSuccessToast("Pristine 5-expense vacation data loaded!");
        }}
      />

      {/* Member Management Modal */}
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

      {/* Backup & Share Modal */}
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
