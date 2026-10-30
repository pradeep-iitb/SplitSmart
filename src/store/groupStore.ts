import { create } from 'zustand';
import type { Expense, Group, Member, RecordedSettlement } from '../types/domain';
import type { RecurringExpenseTemplate } from '../features/split/types';
import * as repo from '../db/repository';
import { todayLocalISO } from '../features/split/recurring';
import { exportGroupJson, importGroupJson } from '../features/sharing/sharingService';

interface GroupStoreState {
  groups: Group[];
  activeGroupId: string | null;
  activeGroup: Group | null;
  members: Member[];
  expenses: Expense[];
  settlements: RecordedSettlement[];
  recurringTemplates: RecurringExpenseTemplate[];
  isLoading: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  switchGroup: (groupId: string) => Promise<void>;
  createGroup: (name: string) => Promise<Group>;
  renameGroup: (groupId: string, name: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  addMember: (
    name: string,
    options?: { color?: string; avatarDataUrl?: string; upiId?: string }
  ) => Promise<Member>;
  updateMember: (memberId: string, patch: Partial<Member>) => Promise<void>;
  setCurrentUserMember: (memberId: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  saveExpense: (expense: Expense) => Promise<void>;
  saveExpensesBatch: (expenses: Expense[]) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  recordSettlement: (payment: RecordedSettlement) => Promise<void>;
  undoSettlement: (settlementId: string) => Promise<void>;
  saveRecurringTemplate: (template: RecurringExpenseTemplate) => Promise<void>;
  deleteRecurringTemplate: (templateId: string) => Promise<void>;
  materializeRecurringExpenses: (
    newExpenses: Expense[],
    updatedTemplates: RecurringExpenseTemplate[]
  ) => Promise<void>;
  refreshDueRecurringExpenses: () => Promise<void>;
  exportJson: () => Promise<string>;
  importJson: (jsonString: string) => Promise<string>;
  resetCleanDemoData: () => Promise<void>;
}

export const useGroupStore = create<GroupStoreState>((set, get) => ({
  groups: [],
  activeGroupId: null,
  activeGroup: null,
  members: [],
  expenses: [],
  settlements: [],
  recurringTemplates: [],
  isLoading: true,
  error: null,

  init: async () => {
    try {
      set({ isLoading: true, error: null });
      await repo.seedInitialDataIfEmpty();

      const allGroups = await repo.listGroups();
      if (allGroups.length === 0) {
        set({ groups: [], activeGroupId: null, activeGroup: null, isLoading: false });
        return;
      }

      const active = allGroups[0];
      for (const group of allGroups) {
        await repo.ensureCurrentUserMember(group.id);
        await repo.materializeDueRecurringForGroup(group.id, todayLocalISO());
      }
      const members = await repo.listMembers(active.id);
      const expenses = await repo.listExpenses(active.id);
      const settlements = await repo.listSettlements(active.id);
      const recurringTemplates = await repo.listRecurringTemplates(active.id);

      set({
        groups: allGroups,
        activeGroupId: active.id,
        activeGroup: active,
        members,
        expenses,
        settlements,
        recurringTemplates,
        isLoading: false,
      });
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Failed to initialize database.',
        isLoading: false,
      });
    }
  },

  switchGroup: async (groupId: string) => {
    try {
      set({ isLoading: true, error: null });
      const group = await repo.getGroup(groupId);
      if (!group) throw new Error(`Group ${groupId} not found`);

      await repo.ensureCurrentUserMember(groupId);
      await repo.materializeDueRecurringForGroup(groupId, todayLocalISO());
      const members = await repo.listMembers(groupId);
      const expenses = await repo.listExpenses(groupId);
      const settlements = await repo.listSettlements(groupId);
      const recurringTemplates = await repo.listRecurringTemplates(groupId);

      set({
        activeGroupId: groupId,
        activeGroup: group,
        members,
        expenses,
        settlements,
        recurringTemplates,
        isLoading: false,
      });
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Failed to switch group.',
        isLoading: false,
      });
    }
  },

  createGroup: async (name: string) => {
    const newGroup = await repo.createGroup(name);
    await repo.ensureCurrentUserMember(newGroup.id);
    const members = await repo.listMembers(newGroup.id);
    const allGroups = await repo.listGroups();

    // Set new group as active
    set({
      groups: allGroups,
      activeGroupId: newGroup.id,
      activeGroup: newGroup,
      members,
      expenses: [],
      settlements: [],
    });

    return newGroup;
  },

  renameGroup: async (groupId: string, name: string) => {
    await repo.updateGroup(groupId, { name });
    const allGroups = await repo.listGroups();
    const curActive = get().activeGroup;

    set({
      groups: allGroups,
      activeGroup: curActive?.id === groupId ? { ...curActive, name } : curActive,
    });
  },

  deleteGroup: async (groupId: string) => {
    await repo.deleteGroup(groupId);
    const allGroups = await repo.listGroups();

    if (allGroups.length > 0) {
      await get().switchGroup(allGroups[0].id);
      set({ groups: allGroups });
    } else {
      set({
        groups: [],
        activeGroupId: null,
        activeGroup: null,
        members: [],
        expenses: [],
        settlements: [],
      });
    }
  },

  addMember: async (name: string, options) => {
    const activeId = get().activeGroupId;
    if (!activeId) throw new Error('No active group selected.');

    const newMember = await repo.addMember(activeId, name, options);
    const updatedMembers = await repo.listMembers(activeId);

    set({ members: updatedMembers });
    return newMember;
  },

  updateMember: async (memberId: string, patch) => {
    await repo.updateMember(memberId, patch);
    const activeId = get().activeGroupId;
    if (activeId) {
      const updatedMembers = await repo.listMembers(activeId);
      set({ members: updatedMembers });
    }
  },

  setCurrentUserMember: async (memberId: string) => {
    const activeId = get().activeGroupId;
    if (!activeId) throw new Error('No active group selected.');
    await repo.setCurrentUserMember(activeId, memberId);
    set({ members: await repo.listMembers(activeId) });
  },

  removeMember: async (memberId: string) => {
    await repo.removeMember(memberId);
    const activeId = get().activeGroupId;
    if (activeId) {
      const updatedMembers = await repo.listMembers(activeId);
      set({ members: updatedMembers });
    }
  },

  saveExpense: async (expense: Expense) => {
    await repo.saveExpense(expense);
    const activeId = get().activeGroupId;
    if (activeId) {
      const updatedExpenses = await repo.listExpenses(activeId);
      set({ expenses: updatedExpenses });
    }
  },

  saveExpensesBatch: async (expenses: Expense[]) => {
    await repo.saveExpensesBatch(expenses);
    const activeId = get().activeGroupId;
    if (activeId) set({ expenses: await repo.listExpenses(activeId) });
  },

  deleteExpense: async (expenseId: string) => {
    await repo.deleteExpense(expenseId);
    const activeId = get().activeGroupId;
    if (activeId) {
      const updatedExpenses = await repo.listExpenses(activeId);
      set({ expenses: updatedExpenses });
    }
  },

  recordSettlement: async (payment: RecordedSettlement) => {
    await repo.recordSettlement(payment);
    const activeId = get().activeGroupId;
    if (activeId) {
      const updatedSettlements = await repo.listSettlements(activeId);
      set({ settlements: updatedSettlements });
    }
  },

  undoSettlement: async (settlementId: string) => {
    await repo.deleteSettlement(settlementId);
    const activeId = get().activeGroupId;
    if (activeId) {
      const updatedSettlements = await repo.listSettlements(activeId);
      set({ settlements: updatedSettlements });
    }
  },

  saveRecurringTemplate: async (template: RecurringExpenseTemplate) => {
    await repo.saveRecurringTemplate(template);
    if (template.active) {
      await repo.materializeDueRecurringForGroup(template.groupId, todayLocalISO());
    }
    const activeId = get().activeGroupId;
    if (activeId) {
      const templates = await repo.listRecurringTemplates(activeId);
      const expenses = await repo.listExpenses(activeId);
      set({ recurringTemplates: templates, expenses });
    }
  },

  deleteRecurringTemplate: async (templateId: string) => {
    await repo.deleteRecurringTemplate(templateId);
    const activeId = get().activeGroupId;
    if (activeId) {
      const templates = await repo.listRecurringTemplates(activeId);
      set({ recurringTemplates: templates });
    }
  },

  materializeRecurringExpenses: async (
    newExpenses: Expense[],
    updatedTemplates: RecurringExpenseTemplate[]
  ) => {
    for (const exp of newExpenses) {
      await repo.saveExpense(exp);
    }
    for (const tpl of updatedTemplates) {
      await repo.saveRecurringTemplate(tpl);
    }
    const activeId = get().activeGroupId;
    if (activeId) {
      const expenses = await repo.listExpenses(activeId);
      const recurringTemplates = await repo.listRecurringTemplates(activeId);
      set({ expenses, recurringTemplates });
    }
  },

  refreshDueRecurringExpenses: async () => {
    const activeId = get().activeGroupId;
    if (!activeId) return;
    await repo.materializeDueRecurringForGroup(activeId, todayLocalISO());
    const [expenses, recurringTemplates] = await Promise.all([
      repo.listExpenses(activeId),
      repo.listRecurringTemplates(activeId),
    ]);
    if (get().activeGroupId === activeId) set({ expenses, recurringTemplates });
  },

  exportJson: async () => {
    const activeId = get().activeGroupId;
    if (!activeId) throw new Error('No active group to export.');
    return await exportGroupJson(activeId);
  },

  resetCleanDemoData: async () => {
    try {
      set({ isLoading: true, error: null });
      await repo.resetToCleanTripData();
      await get().init();
    } catch (err: unknown) {
      set({
        error: err instanceof Error ? err.message : 'Failed to reset clean demo data.',
        isLoading: false,
      });
    }
  },

  importJson: async (jsonString: string) => {
    const importedId = await importGroupJson(jsonString);
    const allGroups = await repo.listGroups();
    set({ groups: allGroups });
    await get().switchGroup(importedId);
    return importedId;
  },
}));
