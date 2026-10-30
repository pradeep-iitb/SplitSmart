import { db, SplitSmartDatabase } from '../../db/database';
import type { Expense, Group, ID, Member, RecordedSettlement } from '../../types/domain';
import type { RecurringExpenseTemplate } from '../split/types';

export interface GroupBackupPayload {
  schemaVersion: 1;
  appName: 'SplitSmart';
  exportedAt: string;
  group: Group;
  members: Member[];
  expenses: Expense[];
  settlements: RecordedSettlement[];
  recurringTemplates?: RecurringExpenseTemplate[];
}

/**
 * Exports a full group's financial records to a structured JSON string (PS Point 17).
 */
export async function exportGroupJson(
  groupId: ID,
  customDb: SplitSmartDatabase = db
): Promise<string> {
  const group = await customDb.groups.get(groupId);
  if (!group) {
    throw new Error(`Group with ID "${groupId}" does not exist.`);
  }

  const members = await customDb.members.where('groupId').equals(groupId).toArray();
  const expenses = await customDb.expenses.where('groupId').equals(groupId).toArray();
  const settlements = await customDb.settlements.where('groupId').equals(groupId).toArray();
  const recurringTemplates = await customDb.recurringTemplates
    .where('groupId')
    .equals(groupId)
    .toArray();

  const payload: GroupBackupPayload = {
    schemaVersion: 1,
    appName: 'SplitSmart',
    exportedAt: new Date().toISOString(),
    group,
    members,
    expenses,
    settlements,
    recurringTemplates,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Validates and imports a group JSON backup into IndexedDB (PS Point 17).
 * Returns the imported groupId.
 */
export async function importGroupJson(
  jsonString: string,
  customDb: SplitSmartDatabase = db
): Promise<ID> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON format: Could not parse input string.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file: Root must be a JSON object.');
  }

  const payload = parsed as Partial<GroupBackupPayload>;

  if (payload.schemaVersion !== undefined && payload.schemaVersion !== 1) {
    throw new Error('Unsupported backup version.');
  }

  if (
    !payload.group ||
    typeof payload.group.id !== 'string' ||
    !payload.group.id.trim() ||
    typeof payload.group.name !== 'string' ||
    !payload.group.name.trim()
  ) {
    throw new Error('Invalid backup: Missing valid group data.');
  }

  const group = payload.group;
  const members = payload.members ?? [];
  const expenses = payload.expenses ?? [];
  const settlements = payload.settlements ?? [];
  const recurringTemplates = payload.recurringTemplates ?? [];
  if (![members, expenses, settlements, recurringTemplates].every(Array.isArray)) {
    throw new Error('Invalid backup: Records must be arrays.');
  }
  if (
    [...members, ...expenses, ...settlements, ...recurringTemplates].some(
      (record) => !record || typeof record !== 'object'
    )
  ) {
    throw new Error('Invalid backup: Records must be objects.');
  }
  const memberIds = new Set(members.map((member) => member.id));
  if (memberIds.size !== members.length || members.some((member) => !member.id || !member.name)) {
    throw new Error('Invalid backup: Members need unique IDs and names.');
  }

  // Invariant verification
  for (const m of members) {
    if (m.groupId !== group.id) {
      throw new Error(
        `Integrity violation: Member "${m.name}" does not belong to group "${group.id}".`
      );
    }
  }

  for (const exp of expenses) {
    if (exp.groupId !== group.id) {
      throw new Error(
        `Integrity violation: Expense "${exp.description}" does not belong to group "${group.id}".`
      );
    }
    if (
      typeof exp.id !== 'string' ||
      !exp.id ||
      !Array.isArray(exp.memberShares) ||
      !Array.isArray(exp.items) ||
      !Number.isSafeInteger(exp.amountPaise) ||
      exp.amountPaise < 0
    ) {
      throw new Error('Invalid backup: Expense has invalid shares or amount.');
    }
    if (
      exp.items.some(
        (item) =>
          !item ||
          !Array.isArray(item.assignedMemberIds) ||
          item.assignedMemberIds.some((id) => !memberIds.has(id))
      )
    ) {
      throw new Error('Invalid backup: Item assignments reference unknown members.');
    }
    const sharesSum = exp.memberShares.reduce((sum, s) => sum + s.amountPaise, 0);
    if (sharesSum !== exp.amountPaise) {
      throw new Error(
        `Financial invariant violation in expense "${exp.description}": shares sum (${sharesSum}) does not equal total amount (${exp.amountPaise}).`
      );
    }
    if (
      !memberIds.has(exp.payerId) ||
      exp.memberShares.some(
        (share) =>
          !memberIds.has(share.memberId) ||
          !Number.isSafeInteger(share.amountPaise) ||
          share.amountPaise < 0
      )
    ) {
      throw new Error(
        `Invalid backup: Expense "${exp.description}" references an invalid member or share.`
      );
    }
  }

  for (const s of settlements) {
    if (s.groupId !== group.id) {
      throw new Error(`Integrity violation: Settlement does not belong to group "${group.id}".`);
    }
    if (
      typeof s.id !== 'string' ||
      !s.id ||
      !memberIds.has(s.fromMemberId) ||
      !memberIds.has(s.toMemberId) ||
      !Number.isSafeInteger(s.amountPaise) ||
      s.amountPaise <= 0
    ) {
      throw new Error('Invalid backup: Settlement references an invalid member or amount.');
    }
  }

  for (const template of recurringTemplates) {
    if (
      typeof template.id !== 'string' ||
      !template.id ||
      template.groupId !== group.id ||
      !memberIds.has(template.payerId) ||
      !Array.isArray(template.participantIds) ||
      template.participantIds.some((id) => !memberIds.has(id))
    ) {
      throw new Error('Invalid backup: Recurring schedule references an invalid member or group.');
    }
  }
  const hasDuplicateIds = (records: Array<{ id: string }>) =>
    new Set(records.map((record) => record.id)).size !== records.length;
  if (
    hasDuplicateIds(expenses) ||
    hasDuplicateIds(settlements) ||
    hasDuplicateIds(recurringTemplates)
  ) {
    throw new Error('Invalid backup: Duplicate record IDs.');
  }

  // Importing a backup already present on this device creates a copy. Never overwrite
  // the existing group's records or accidentally merge old and new expenses.
  const collision =
    Boolean(await customDb.groups.get(group.id)) ||
    (
      await Promise.all([
        ...members.map((member) => customDb.members.get(member.id)),
        ...expenses.map((expense) => customDb.expenses.get(expense.id)),
        ...settlements.map((settlement) => customDb.settlements.get(settlement.id)),
        ...recurringTemplates.map((template) => customDb.recurringTemplates.get(template.id)),
      ])
    ).some(Boolean);
  const importId = (prefix: string) =>
    `${prefix}-import-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const groupId = collision ? importId('group') : group.id;
  const memberMap = new Map(
    members.map((member) => [member.id, collision ? importId('member') : member.id])
  );
  const templateMap = new Map(
    recurringTemplates.map((template) => [
      template.id,
      collision ? importId('template') : template.id,
    ])
  );
  const importedGroup = collision
    ? { ...group, id: groupId, name: `${group.name} (imported)` }
    : group;
  const importedMembers = members.map((member) => ({
    ...member,
    id: memberMap.get(member.id)!,
    groupId,
  }));
  const importedExpenses = expenses.map((expense) => ({
    ...expense,
    id: collision ? importId('expense') : expense.id,
    groupId,
    payerId: memberMap.get(expense.payerId)!,
    memberShares: expense.memberShares.map((share) => ({
      ...share,
      memberId: memberMap.get(share.memberId)!,
    })),
    items: (expense.items ?? []).map((item) => ({
      ...item,
      assignedMemberIds: item.assignedMemberIds.map((id) => memberMap.get(id)!),
    })),
  }));
  const importedSettlements = settlements.map((settlement) => ({
    ...settlement,
    id: collision ? importId('settlement') : settlement.id,
    groupId,
    fromMemberId: memberMap.get(settlement.fromMemberId)!,
    toMemberId: memberMap.get(settlement.toMemberId)!,
  }));
  const importedTemplates = recurringTemplates.map((template) => ({
    ...template,
    id: templateMap.get(template.id)!,
    groupId,
    payerId: memberMap.get(template.payerId)!,
    participantIds: template.participantIds.map((id) => memberMap.get(id)!),
    splitDetails: template.splitDetails && {
      exactAmounts:
        template.splitDetails.exactAmounts &&
        Object.fromEntries(
          Object.entries(template.splitDetails.exactAmounts).map(([id, amount]) => [
            memberMap.get(id)!,
            amount,
          ])
        ),
      percentagesBasisPoints:
        template.splitDetails.percentagesBasisPoints &&
        Object.fromEntries(
          Object.entries(template.splitDetails.percentagesBasisPoints).map(([id, value]) => [
            memberMap.get(id)!,
            value,
          ])
        ),
      sharesWeights:
        template.splitDetails.sharesWeights &&
        Object.fromEntries(
          Object.entries(template.splitDetails.sharesWeights).map(([id, value]) => [
            memberMap.get(id)!,
            value,
          ])
        ),
    },
  }));

  // Atomically write into IndexedDB
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
      await customDb.groups.add(importedGroup);
      if (importedMembers.length > 0) await customDb.members.bulkAdd(importedMembers);
      if (importedExpenses.length > 0) await customDb.expenses.bulkAdd(importedExpenses);
      if (importedSettlements.length > 0) await customDb.settlements.bulkAdd(importedSettlements);
      if (importedTemplates.length > 0)
        await customDb.recurringTemplates.bulkAdd(importedTemplates);
    }
  );

  return groupId;
}

/**
 * Encodes a complete group state into a URL-safe hash string for serverless sharing (PS Point 17).
 */
export async function encodeGroupToUrlHash(
  groupId: ID,
  customDb: SplitSmartDatabase = db
): Promise<string> {
  const json = await exportGroupJson(groupId, customDb);
  // Base64 encode in browser or Node environment
  const utf8Bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64 =
    typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return `share=${encodeURIComponent(base64)}`;
}

/**
 * Decodes a shared URL hash string and restores the group into IndexedDB.
 */
export async function decodeGroupFromUrlHash(
  hashString: string,
  customDb: SplitSmartDatabase = db
): Promise<ID | null> {
  const match = hashString.match(/share=([^&]+)/);
  if (!match) return null;

  try {
    const rawBase64 = decodeURIComponent(match[1]);
    const binary =
      typeof atob !== 'undefined'
        ? atob(rawBase64)
        : Buffer.from(rawBase64, 'base64').toString('binary');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonString = new TextDecoder().decode(bytes);
    return await importGroupJson(jsonString, customDb);
  } catch (err) {
    console.error('Failed to decode group from URL hash:', err);
    return null;
  }
}
