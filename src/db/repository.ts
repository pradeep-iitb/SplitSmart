import { db, SplitSmartDatabase } from './database';
import type {
  Expense,
  Group,
  ID,
  Member,
  RecordedSettlement,
} from '../types/domain';
import mixedPayersFixture from '../test/fixtures/expenses-mixed-payers.json';
import partialSettlementsFixture from '../test/fixtures/settlements-partial.json';

const MEMBER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
];

/**
 * Creates a new Group (PS Point 1).
 */
export async function createGroup(name: string, customDb: SplitSmartDatabase = db): Promise<Group> {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Group name cannot be empty.');
  }

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `g-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const now = new Date().toISOString();
  const group: Group = {
    id,
    name: cleanName,
    createdAt: now,
    updatedAt: now,
  };

  await customDb.groups.add(group);
  return group;
}

/**
 * Updates a group's name.
 */
export async function updateGroup(
  groupId: ID,
  patch: Partial<Pick<Group, 'name'>>,
  customDb: SplitSmartDatabase = db
): Promise<void> {
  const existing = await customDb.groups.get(groupId);
  if (!existing) {
    throw new Error(`Group ${groupId} not found.`);
  }

  await customDb.groups.update(groupId, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Deletes a group and all of its associated records (cascade delete).
 */
export async function deleteGroup(groupId: ID, customDb: SplitSmartDatabase = db): Promise<void> {
  await customDb.transaction(
    'rw',
    [
      customDb.groups,
      customDb.members,
      customDb.expenses,
      customDb.settlements,
      customDb.recurringTemplates,
    ],
    async () => {
      await customDb.groups.delete(groupId);
      await customDb.members.where('groupId').equals(groupId).delete();
      await customDb.expenses.where('groupId').equals(groupId).delete();
      await customDb.settlements.where('groupId').equals(groupId).delete();
      await customDb.recurringTemplates.where('groupId').equals(groupId).delete();
    }
  );
}

/**
 * Lists all persisted groups.
 */
export async function listGroups(customDb: SplitSmartDatabase = db): Promise<Group[]> {
  return await customDb.groups.toArray();
}

/**
 * Retrieves a single group by ID.
 */
export async function getGroup(groupId: ID, customDb: SplitSmartDatabase = db): Promise<Group | undefined> {
  return await customDb.groups.get(groupId);
}

/**
 * Adds a new member to a group (PS Point 1).
 */
export async function addMember(
  groupId: ID,
  name: string,
  options?: { color?: string; avatarDataUrl?: string; upiId?: string },
  customDb: SplitSmartDatabase = db
): Promise<Member> {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('Member name cannot be empty.');
  }

  const group = await customDb.groups.get(groupId);
  if (!group) {
    throw new Error(`Cannot add member: Group ${groupId} does not exist.`);
  }

  const existingMembers = await customDb.members.where('groupId').equals(groupId).toArray();
  const color =
    options?.color ||
    MEMBER_COLORS[existingMembers.length % MEMBER_COLORS.length];

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const member: Member = {
    id,
    groupId,
    name: cleanName,
    color,
    avatarDataUrl: options?.avatarDataUrl,
    upiId: options?.upiId?.trim() || undefined,
    active: true,
  };

  await customDb.members.add(member);
  return member;
}

/**
 * Updates a member's details.
 */
export async function updateMember(
  memberId: ID,
  patch: Partial<Omit<Member, 'id' | 'groupId'>>,
  customDb: SplitSmartDatabase = db
): Promise<void> {
  const existing = await customDb.members.get(memberId);
  if (!existing) {
    throw new Error(`Member ${memberId} not found.`);
  }

  await customDb.members.update(memberId, patch);
}

/**
 * Removes or deactivates a member (PS Point 1 & Implementation Plan).
 * If the member has historical expenses or settlements, deactivates them to preserve integrity.
 */
export async function removeMember(memberId: ID, customDb: SplitSmartDatabase = db): Promise<void> {
  const member = await customDb.members.get(memberId);
  if (!member) return;

  // Check if member is referenced in any expense (as payer or share participant)
  const allExpenses = await customDb.expenses.where('groupId').equals(member.groupId).toArray();
  const isReferencedInExpenses = allExpenses.some(
    (e) =>
      e.payerId === memberId ||
      e.memberShares.some((s) => s.memberId === memberId)
  );

  // Check if member is referenced in any settlement
  const allSettlements = await customDb.settlements.where('groupId').equals(member.groupId).toArray();
  const isReferencedInSettlements = allSettlements.some(
    (s) => s.fromMemberId === memberId || s.toMemberId === memberId
  );

  if (isReferencedInExpenses || isReferencedInSettlements) {
    // Preserve history: soft deactivate
    await customDb.members.update(memberId, { active: false });
  } else {
    // No history: safe hard delete
    await customDb.members.delete(memberId);
  }
}

/**
 * Lists all members for a group.
 */
export async function listMembers(
  groupId: ID,
  includeInactive = true,
  customDb: SplitSmartDatabase = db
): Promise<Member[]> {
  let query = customDb.members.where('groupId').equals(groupId);
  const list = await query.toArray();
  return includeInactive ? list : list.filter((m) => m.active);
}

/**
 * Lists all expenses for a group (PS Point 14).
 */
export async function listExpenses(groupId: ID, customDb: SplitSmartDatabase = db): Promise<Expense[]> {
  return await customDb.expenses.where('groupId').equals(groupId).toArray();
}

/**
 * Saves or updates an expense with strict financial invariant verification.
 */
export async function saveExpense(expense: Expense, customDb: SplitSmartDatabase = db): Promise<void> {
  // Validate total sum invariant
  const shareSum = expense.memberShares.reduce((a, b) => a + b.amountPaise, 0);
  if (shareSum !== expense.amountPaise) {
    throw new Error(
      `Financial invariant violation: sum of memberShares (${shareSum}) does not equal total amountPaise (${expense.amountPaise}).`
    );
  }

  // Validate group exists
  const group = await customDb.groups.get(expense.groupId);
  if (!group) {
    throw new Error(`Cannot save expense: Group ${expense.groupId} does not exist.`);
  }

  await customDb.expenses.put(expense);
}

/**
 * Deletes an expense by ID.
 */
export async function deleteExpense(expenseId: ID, customDb: SplitSmartDatabase = db): Promise<void> {
  await customDb.expenses.delete(expenseId);
}

/**
 * Records a real settlement payment (PS Point 12 & 14).
 */
export async function recordSettlement(
  payment: RecordedSettlement,
  customDb: SplitSmartDatabase = db
): Promise<void> {
  if (payment.amountPaise <= 0) {
    throw new Error('Settlement amount must be positive.');
  }
  if (payment.fromMemberId === payment.toMemberId) {
    throw new Error('Debtor and creditor cannot be the same member.');
  }

  await customDb.settlements.put(payment);
}

/**
 * Deletes / reverses a recorded settlement.
 */
export async function deleteSettlement(settlementId: ID, customDb: SplitSmartDatabase = db): Promise<void> {
  await customDb.settlements.delete(settlementId);
}

/**
 * Lists all recorded settlements for a group.
 */
export async function listSettlements(
  groupId: ID,
  customDb: SplitSmartDatabase = db
): Promise<RecordedSettlement[]> {
  return await customDb.settlements.where('groupId').equals(groupId).toArray();
}

/**
 * Seeds initial group and expenses into IndexedDB if database is currently empty.
 */
export async function seedInitialDataIfEmpty(customDb: SplitSmartDatabase = db): Promise<void> {
  const count = await customDb.groups.count();
  if (count > 0) return;

  const defaultGroupId = 'g-mixed';
  const defaultGroup: Group = {
    id: defaultGroupId,
    name: 'Goa Friends Vacation',
    createdAt: '2026-10-18T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
  };

  await customDb.transaction(
    'rw',
    [customDb.groups, customDb.members, customDb.expenses, customDb.settlements],
    async () => {
      await customDb.groups.add(defaultGroup);
      await customDb.members.bulkAdd(mixedPayersFixture.members as Member[]);
      await customDb.expenses.bulkAdd(mixedPayersFixture.expenses as Expense[]);
      await customDb.settlements.bulkAdd(partialSettlementsFixture.settlements as RecordedSettlement[]);
    }
  );
}
