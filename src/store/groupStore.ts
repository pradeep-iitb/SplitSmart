import { create } from 'zustand';
import type {
  Expense,
  Group,
  Member,
  RecordedSettlement,
} from '../types/domain';
import type { RecurringExpenseTemplate } from '../features/split/types';
import * as repo from '../db/repository';
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
  addMember: (name: string, options?: { color?: string; avatarDataUrl?: string; upiId?: string }) => Promise<Member>;
  updateMember: (memberId: string, patch: Partial<Member>) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  saveExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  recordSettlement: (payment: RecordedSettlement) => Promise<void>;
  undoSettlement: (settlementId: string) => Promise<void>;
  exportJson: () => Promise<string>;
  importJson: (jsonString: string) => Promise<string>;
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
      const members = await repo.listMembers(active.id);
      const expenses = await repo.listExpenses(active.id);
      const settlements = await repo.listSettlements(active.id);

      set({
        groups: allGroups,
        activeGroupId: active.id,
        activeGroup: active,
        members,
        expenses,
        settlements,
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

      const members = await repo.listMembers(groupId);
      const expenses = await repo.listExpenses(groupId);
      const settlements = await repo.listSettlements(groupId);

      set({
        activeGroupId: groupId,
        activeGroup: group,
        members,
        expenses,
        settlements,
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
    const allGroups = await repo.listGroups();

    // Set new group as active
    set({
      groups: allGroups,
      activeGroupId: newGroup.id,
      activeGroup: newGroup,
      members: [],
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

  exportJson: async () => {
    const activeId = get().activeGroupId;
    if (!activeId) throw new Error('No active group to export.');
    return await exportGroupJson(activeId);
  },

  importJson: async (jsonString: string) => {
    const importedId = await importGroupJson(jsonString);
    const allGroups = await repo.listGroups();
    set({ groups: allGroups });
    await get().switchGroup(importedId);
    return importedId;
  },
}));
