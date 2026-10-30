import { db, SplitSmartDatabase } from './database';
import type { Expense, Group, ID, Member, RecordedSettlement } from '../types/domain';
import type { RecurringExpenseTemplate } from '../features/split/types';
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
export async function getGroup(
  groupId: ID,
  customDb: SplitSmartDatabase = db
): Promise<Group | undefined> {
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
  const color = options?.color || MEMBER_COLORS[existingMembers.length % MEMBER_COLORS.length];

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const avatarDataUrl =
    options?.avatarDataUrl || `/Images/Avatar${(existingMembers.length % 8) + 1}.png`;

  const member: Member = {
    id,
    groupId,
    name: cleanName,
    color,
    avatarDataUrl,
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
  if (member.isCurrentUser)
    throw new Error('This member is you. Choose another person as Me before removing them.');

  // Check if member is referenced in any expense (as payer or share participant)
  const allExpenses = await customDb.expenses.where('groupId').equals(member.groupId).toArray();
  const isReferencedInExpenses = allExpenses.some(
    (e) => e.payerId === memberId || e.memberShares.some((s) => s.memberId === memberId)
  );

  // Check if member is referenced in any settlement
  const allSettlements = await customDb.settlements
    .where('groupId')
    .equals(member.groupId)
    .toArray();
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
  const query = customDb.members.where('groupId').equals(groupId);
  const list = await query.toArray();
  return includeInactive ? list : list.filter((m) => m.active);
}

/** Preserve the existing member's financial history when assigning the local user. */
export async function ensureCurrentUserMember(
  groupId: ID,
  customDb: SplitSmartDatabase = db
): Promise<Member> {
  const members = await listMembers(groupId, true, customDb);
  const current =
    members.find((member) => member.isCurrentUser) ??
    members.find((member) => /^(me|you)$/i.test(member.name.trim())) ??
    members.find((member) => member.active) ??
    members[0];

  if (!current) {
    const created = await addMember(groupId, 'Me', undefined, customDb);
    await customDb.members.update(created.id, { isCurrentUser: true });
    return { ...created, isCurrentUser: true };
  }

  await customDb.transaction('rw', customDb.members, async () => {
    for (const member of members) {
      if (member.id === current.id && (!member.isCurrentUser || !member.active)) {
        await customDb.members.update(member.id, { isCurrentUser: true, active: true });
      } else if (member.id !== current.id && member.isCurrentUser) {
        await customDb.members.update(member.id, { isCurrentUser: false });
      }
    }
  });
  return { ...current, isCurrentUser: true, active: true };
}

export async function setCurrentUserMember(
  groupId: ID,
  memberId: ID,
  customDb: SplitSmartDatabase = db
): Promise<void> {
  const members = await listMembers(groupId, true, customDb);
  if (!members.some((member) => member.id === memberId))
    throw new Error('Member is not in this group.');
  await customDb.transaction('rw', customDb.members, async () => {
    for (const member of members) {
      if (member.id === memberId)
        await customDb.members.update(member.id, { isCurrentUser: true, active: true });
      else if (member.isCurrentUser)
        await customDb.members.update(member.id, { isCurrentUser: false });
    }
  });
}

/**
 * Lists all expenses for a group (PS Point 14).
 */
export async function listExpenses(
  groupId: ID,
  customDb: SplitSmartDatabase = db
): Promise<Expense[]> {
  return await customDb.expenses.where('groupId').equals(groupId).toArray();
}

/**
 * Saves or updates an expense with strict financial invariant verification.
 */
export async function saveExpense(
  expense: Expense,
  customDb: SplitSmartDatabase = db
): Promise<void> {
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
export async function deleteExpense(
  expenseId: ID,
  customDb: SplitSmartDatabase = db
): Promise<void> {
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
export async function deleteSettlement(
  settlementId: ID,
  customDb: SplitSmartDatabase = db
): Promise<void> {
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

export async function cleanupDuplicateExpenses(customDb: SplitSmartDatabase = db): Promise<void> {
  const allExpenses = await customDb.expenses.toArray();
  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const exp of allExpenses) {
    // Deduplicate by normalized description and amount in paise
    const key = `${exp.description.trim().toLowerCase()}-${exp.amountPaise}`;
    if (seen.has(key)) {
      toDelete.push(exp.id);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length > 0) {
    await customDb.expenses.bulkDelete(toDelete);
  }
}

export async function resetToCleanTripData(customDb: SplitSmartDatabase = db): Promise<void> {
  const defaultGroupId = 'g-mixed';
  const cleanMembers: Member[] = [
    { id: 'm1', groupId: defaultGroupId, name: 'Riya', upiId: 'riya@okhdfc', active: true },
    { id: 'm2', groupId: defaultGroupId, name: 'Arjun', upiId: 'arjun@oksbi', active: true },
    { id: 'm3', groupId: defaultGroupId, name: 'Meera', upiId: 'meera@icici', active: true },
    { id: 'm4', groupId: defaultGroupId, name: 'Kabir', upiId: 'kabir@paytm', active: true },
    { id: 'm5', groupId: defaultGroupId, name: 'Vikram', upiId: 'vikram@axisbank', active: true },
  ];

  const cleanExpenses: Expense[] = [
    {
      id: 'exp-breakfast',
      groupId: defaultGroupId,
      description: 'Highway Breakfast & Chai',
      category: 'Food & Dining',
      date: '2026-10-18',
      payerId: 'm1',
      amountPaise: 150000,
      splitMode: 'equal',
      memberShares: [
        { memberId: 'm1', amountPaise: 30000 },
        { memberId: 'm2', amountPaise: 30000 },
        { memberId: 'm3', amountPaise: 30000 },
        { memberId: 'm4', amountPaise: 30000 },
        { memberId: 'm5', amountPaise: 30000 },
      ],
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: '2026-10-18T08:30:00Z',
    },
    {
      id: 'exp-fuel',
      groupId: defaultGroupId,
      description: 'Fuel Refill 1',
      category: 'Transportation',
      date: '2026-10-18',
      payerId: 'm2',
      amountPaise: 400000,
      splitMode: 'equal',
      memberShares: [
        { memberId: 'm1', amountPaise: 80000 },
        { memberId: 'm2', amountPaise: 80000 },
        { memberId: 'm3', amountPaise: 80000 },
        { memberId: 'm4', amountPaise: 80000 },
        { memberId: 'm5', amountPaise: 80000 },
      ],
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: '2026-10-18T11:00:00Z',
    },
    {
      id: 'exp-groceries',
      groupId: defaultGroupId,
      description: 'Supermarket Groceries & Snacks',
      category: 'Supplies',
      date: '2026-10-18',
      payerId: 'm3',
      amountPaise: 250000,
      splitMode: 'equal',
      memberShares: [
        { memberId: 'm1', amountPaise: 50000 },
        { memberId: 'm2', amountPaise: 50000 },
        { memberId: 'm3', amountPaise: 50000 },
        { memberId: 'm4', amountPaise: 50000 },
        { memberId: 'm5', amountPaise: 50000 },
      ],
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: '2026-10-18T16:00:00Z',
    },
    {
      id: 'exp-villa',
      groupId: defaultGroupId,
      description: 'Villa Booking Advance',
      category: 'Lodging',
      date: '2026-10-19',
      payerId: 'm4',
      amountPaise: 1000000,
      splitMode: 'equal',
      memberShares: [
        { memberId: 'm1', amountPaise: 200000 },
        { memberId: 'm2', amountPaise: 200000 },
        { memberId: 'm3', amountPaise: 200000 },
        { memberId: 'm4', amountPaise: 200000 },
        { memberId: 'm5', amountPaise: 200000 },
      ],
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: '2026-10-19T10:00:00Z',
    },
    {
      id: 'exp-scuba',
      groupId: defaultGroupId,
      description: 'Scuba Diving & Watersports',
      category: 'Activities',
      date: '2026-10-19',
      payerId: 'm5',
      amountPaise: 600000,
      splitMode: 'equal',
      memberShares: [
        { memberId: 'm1', amountPaise: 120000 },
        { memberId: 'm2', amountPaise: 120000 },
        { memberId: 'm3', amountPaise: 120000 },
        { memberId: 'm4', amountPaise: 120000 },
        { memberId: 'm5', amountPaise: 120000 },
      ],
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: '2026-10-19T14:30:00Z',
    },
  ];

  await customDb.transaction(
    'rw',
    [customDb.groups, customDb.members, customDb.expenses, customDb.settlements],
    async () => {
      const existingGroup = await customDb.groups.get(defaultGroupId);
      if (!existingGroup) {
        await customDb.groups.add({
          id: defaultGroupId,
          name: 'Goa Friends Vacation',
          createdAt: '2026-10-18T00:00:00Z',
          updatedAt: '2026-10-23T00:00:00Z',
        });
      }
      await customDb.members.where('groupId').equals(defaultGroupId).delete();
      await customDb.members.bulkAdd(cleanMembers);
      await customDb.expenses.where('groupId').equals(defaultGroupId).delete();
      await customDb.expenses.bulkAdd(cleanExpenses);
      await customDb.settlements.where('groupId').equals(defaultGroupId).delete();
    }
  );
}

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
    [
      customDb.groups,
      customDb.members,
      customDb.expenses,
      customDb.settlements,
      customDb.recurringTemplates,
    ],
    async () => {
      await customDb.groups.add(defaultGroup);
      await customDb.members.bulkAdd(mixedPayersFixture.members as Member[]);
      await customDb.expenses.bulkAdd(mixedPayersFixture.expenses as Expense[]);
      await customDb.settlements.bulkAdd(
        partialSettlementsFixture.settlements as RecordedSettlement[]
      );
      await customDb.recurringTemplates.bulkAdd([
        {
          id: 'tpl-wifi-fiber',
          groupId: defaultGroupId,
          description: 'High-speed Fiber Wi-Fi Recharge',
          category: 'Utilities',
          amountPaise: 80000,
          payerId: (mixedPayersFixture.members[0] as Member).id,
          splitMode: 'equal',
          participantIds: (mixedPayersFixture.members as Member[]).map((m) => m.id),
          frequency: 'monthly',
          startDate: '2026-09-01',
          dayOfMonth: 1,
          active: true,
          lastMaterializedDate: '2026-09-01',
          createdAt: '2026-09-01T00:00:00Z',
        },
        {
          id: 'tpl-apartment-maint',
          groupId: defaultGroupId,
          description: 'Society Maintenance & Water',
          category: 'Utilities',
          amountPaise: 240000,
          payerId: (mixedPayersFixture.members[1] as Member).id,
          splitMode: 'equal',
          participantIds: (mixedPayersFixture.members as Member[]).map((m) => m.id),
          frequency: 'monthly',
          startDate: '2026-10-01',
          dayOfMonth: 5,
          active: true,
          lastMaterializedDate: '2026-10-05',
          createdAt: '2026-10-01T00:00:00Z',
        },
      ]);
    }
  );
}

export async function listRecurringTemplates(
  groupId: ID,
  customDb: SplitSmartDatabase = db
): Promise<RecurringExpenseTemplate[]> {
  return await customDb.recurringTemplates.where('groupId').equals(groupId).toArray();
}

export async function saveRecurringTemplate(
  template: RecurringExpenseTemplate,
  customDb: SplitSmartDatabase = db
): Promise<void> {
  await customDb.recurringTemplates.put(template);
}

export async function deleteRecurringTemplate(
  templateId: ID,
  customDb: SplitSmartDatabase = db
): Promise<void> {
  await customDb.recurringTemplates.delete(templateId);
}
