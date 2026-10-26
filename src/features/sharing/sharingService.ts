import { db, SplitSmartDatabase } from '../../db/database';
import type {
  Expense,
  Group,
  ID,
  Member,
  RecordedSettlement,
} from '../../types/domain';
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
  const recurringTemplates = await customDb.recurringTemplates.where('groupId').equals(groupId).toArray();

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

  if (!payload.group || !payload.group.id || !payload.group.name) {
    throw new Error('Invalid backup: Missing valid group data.');
  }

  const group = payload.group;
  const members = payload.members ?? [];
  const expenses = payload.expenses ?? [];
  const settlements = payload.settlements ?? [];
  const recurringTemplates = payload.recurringTemplates ?? [];

  // Invariant verification
  for (const m of members) {
    if (m.groupId !== group.id) {
      throw new Error(`Integrity violation: Member "${m.name}" does not belong to group "${group.id}".`);
    }
  }

  for (const exp of expenses) {
    if (exp.groupId !== group.id) {
      throw new Error(`Integrity violation: Expense "${exp.description}" does not belong to group "${group.id}".`);
    }
    const sharesSum = exp.memberShares.reduce((sum, s) => sum + s.amountPaise, 0);
    if (sharesSum !== exp.amountPaise) {
      throw new Error(
        `Financial invariant violation in expense "${exp.description}": shares sum (${sharesSum}) does not equal total amount (${exp.amountPaise}).`
      );
    }
  }

  for (const s of settlements) {
    if (s.groupId !== group.id) {
      throw new Error(`Integrity violation: Settlement does not belong to group "${group.id}".`);
    }
  }

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
      await customDb.groups.put(group);
      if (members.length > 0) await customDb.members.bulkPut(members);
      if (expenses.length > 0) await customDb.expenses.bulkPut(expenses);
      if (settlements.length > 0) await customDb.settlements.bulkPut(settlements);
      if (recurringTemplates.length > 0) await customDb.recurringTemplates.bulkPut(recurringTemplates);
    }
  );

  return group.id;
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
  const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
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
    const binary = typeof atob !== 'undefined' ? atob(rawBase64) : Buffer.from(rawBase64, 'base64').toString('binary');
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
