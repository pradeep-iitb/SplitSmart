import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SplitSmartDatabase } from '../db/database';
import * as repo from '../db/repository';
import {
  decodeGroupFromUrlHash,
  encodeGroupToUrlHash,
  exportGroupJson,
  importGroupJson,
} from '../features/sharing/sharingService';
import type { Expense } from '../types/domain';

describe('Member 5: Serverless Sharing & JSON Import/Export Engine (sharing.test.ts)', () => {
  let sourceDb: SplitSmartDatabase;
  let targetDb: SplitSmartDatabase;

  beforeEach(async () => {
    sourceDb = new SplitSmartDatabase(`source-db-${Date.now()}-${Math.random()}`);
    targetDb = new SplitSmartDatabase(`target-db-${Date.now()}-${Math.random()}`);
    await sourceDb.open();
    await targetDb.open();
  });

  it('exports and imports a group faithfully via JSON (PS Point 17)', async () => {
    // 1. Setup group with members and expense in sourceDb
    const group = await repo.createGroup('Trek to Kasol', sourceDb);
    const m1 = await repo.addMember(group.id, 'Aarav', { upiId: 'aarav@okicici' }, sourceDb);
    const m2 = await repo.addMember(group.id, 'Diya', { upiId: 'diya@oksbi' }, sourceDb);

    const expense: Expense = {
      id: 'exp-trek-1',
      groupId: group.id,
      description: 'Tent Rental & Wood',
      date: '2026-10-22',
      payerId: m1.id,
      amountPaise: 40000,
      splitMode: 'equal',
      memberShares: [
        { memberId: m1.id, amountPaise: 20000 },
        { memberId: m2.id, amountPaise: 20000 },
      ],
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: new Date().toISOString(),
    };
    await repo.saveExpense(expense, sourceDb);

    // 2. Export JSON
    const exportedJson = await exportGroupJson(group.id, sourceDb);
    expect(exportedJson).toContain('Trek to Kasol');
    expect(exportedJson).toContain('Aarav');
    expect(exportedJson).toContain('Diya');

    // 3. Import JSON into targetDb
    const importedGroupId = await importGroupJson(exportedJson, targetDb);
    expect(importedGroupId).toBe(group.id);

    // 4. Verify targetDb contains identical entities
    const importedGroup = await repo.getGroup(importedGroupId, targetDb);
    expect(importedGroup?.name).toBe('Trek to Kasol');

    const importedMembers = await repo.listMembers(importedGroupId, true, targetDb);
    expect(importedMembers).toHaveLength(2);

    const importedExpenses = await repo.listExpenses(importedGroupId, targetDb);
    expect(importedExpenses).toHaveLength(1);
    expect(importedExpenses[0].amountPaise).toBe(40000);
  });

  it('encodes and decodes group state via URL hash for serverless sharing (PS Point 17)', async () => {
    const group = await repo.createGroup('Kerala Trip', sourceDb);
    await repo.addMember(group.id, 'Kavya', {}, sourceDb);

    // Encode to URL hash
    const hash = await encodeGroupToUrlHash(group.id, sourceDb);
    expect(hash.startsWith('share=')).toBe(true);

    // Decode in targetDb
    const decodedId = await decodeGroupFromUrlHash(hash, targetDb);
    expect(decodedId).toBe(group.id);

    const restoredGroup = await repo.getGroup(group.id, targetDb);
    expect(restoredGroup?.name).toBe('Kerala Trip');
  });

  it('rejects malformed or corrupt JSON payloads', async () => {
    // Malformed JSON string
    await expect(importGroupJson('not valid json {', targetDb)).rejects.toThrowError(
      /Invalid JSON format/
    );

    // Missing group info
    await expect(importGroupJson('{"random": 123}', targetDb)).rejects.toThrowError(
      /Missing valid group data/
    );

    // Mismatched financial invariant in JSON
    const corruptPayload = {
      schemaVersion: 1,
      group: { id: 'g-bad', name: 'Corrupt Group' },
      members: [{ id: 'm1', groupId: 'g-bad', name: 'Bob', active: true }],
      expenses: [
        {
          id: 'exp-bad',
          groupId: 'g-bad',
          description: 'Fake',
          payerId: 'm1',
          amountPaise: 10000,
          items: [],
          memberShares: [{ memberId: 'm1', amountPaise: 5000 }], // 5000 !== 10000!
        },
      ],
      settlements: [],
    };

    await expect(importGroupJson(JSON.stringify(corruptPayload), targetDb)).rejects.toThrowError(
      /Financial invariant violation/
    );
  });

  it('imports an existing backup as a separate copy without overwriting records', async () => {
    const group = await repo.createGroup('Room', sourceDb);
    const member = await repo.addMember(group.id, 'Me', {}, sourceDb);
    const backup = await exportGroupJson(group.id, sourceDb);
    const copyId = await importGroupJson(backup, sourceDb);
    expect(copyId).not.toBe(group.id);
    expect((await repo.getGroup(group.id, sourceDb))?.name).toBe('Room');
    const copiedMembers = await repo.listMembers(copyId, true, sourceDb);
    expect(copiedMembers).toHaveLength(1);
    expect(copiedMembers[0].id).not.toBe(member.id);
  });
});
