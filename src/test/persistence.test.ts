import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SplitSmartDatabase } from '../db/database';
import * as repo from '../db/repository';
import type { Expense, RecordedSettlement } from '../types/domain';

describe('Member 5: Local Persistence & Repository Engine (persistence.test.ts)', () => {
  let testDb: SplitSmartDatabase;

  beforeEach(async () => {
    // Unique in-memory database for each test
    testDb = new SplitSmartDatabase(`test-db-${Date.now()}-${Math.random()}`);
    await testDb.open();
  });

  it('creates, renames, and lists groups in IndexedDB (PS Point 1 & 14)', async () => {
    const group = await repo.createGroup('Weekend Camping', testDb);
    expect(group.id).toBeDefined();
    expect(group.name).toBe('Weekend Camping');

    // List groups
    const groups = await repo.listGroups(testDb);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Weekend Camping');

    // Rename group
    await repo.updateGroup(group.id, { name: 'Weekend Glamping' }, testDb);
    const updated = await repo.getGroup(group.id, testDb);
    expect(updated?.name).toBe('Weekend Glamping');
  });

  it('adds and lists members with colors and upiId (PS Point 1)', async () => {
    const group = await repo.createGroup('Goa Trip', testDb);
    const m1 = await repo.addMember(group.id, 'Alice', { upiId: 'alice@oksbi' }, testDb);
    const m2 = await repo.addMember(group.id, 'Bob', { color: '#ec4899' }, testDb);

    expect(m1.upiId).toBe('alice@oksbi');
    expect(m2.color).toBe('#ec4899');

    const members = await repo.listMembers(group.id, true, testDb);
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.name === 'Alice')?.upiId).toBe('alice@oksbi');
    expect(members.find((m) => m.name === 'Bob')?.color).toBe('#ec4899');
  });

  it('soft-deactivates member if referenced in historical expenses, or hard-deletes if unreferenced', async () => {
    const group = await repo.createGroup('Dinner Group', testDb);
    const m1 = await repo.addMember(group.id, 'Alice', {}, testDb);
    const m2 = await repo.addMember(group.id, 'Bob', {}, testDb);

    // Unreferenced member: Bob -> should be hard-deleted
    await repo.removeMember(m2.id, testDb);
    const afterBobRemove = await repo.listMembers(group.id, true, testDb);
    expect(afterBobRemove.find((m) => m.id === m2.id)).toBeUndefined();

    // Alice is referenced in an expense
    const expense: Expense = {
      id: 'exp-1',
      groupId: group.id,
      description: 'Dinner',
      date: '2026-10-23',
      payerId: m1.id,
      amountPaise: 50000,
      splitMode: 'equal',
      memberShares: [{ memberId: m1.id, amountPaise: 50000 }],
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: new Date().toISOString(),
    };
    await repo.saveExpense(expense, testDb);

    // Removing Alice: should soft-deactivate (active: false)
    await repo.removeMember(m1.id, testDb);
    const allMembers = await repo.listMembers(group.id, true, testDb);
    const alice = allMembers.find((m) => m.id === m1.id);
    expect(alice).toBeDefined();
    expect(alice?.active).toBe(false);

    // Query active members only
    const activeMembers = await repo.listMembers(group.id, false, testDb);
    expect(activeMembers).toHaveLength(0);
  });

  it('enforces financial invariant on saveExpense: sum(memberShares) === amountPaise', async () => {
    const group = await repo.createGroup('Roadtrip', testDb);
    const m1 = await repo.addMember(group.id, 'Alice', {}, testDb);

    const invalidExpense: Expense = {
      id: 'exp-bad',
      groupId: group.id,
      description: 'Petrol',
      date: '2026-10-23',
      payerId: m1.id,
      amountPaise: 10000, // ₹100
      splitMode: 'equal',
      memberShares: [{ memberId: m1.id, amountPaise: 9000 }], // Discrepancy! 9000 !== 10000
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: new Date().toISOString(),
    };

    await expect(repo.saveExpense(invalidExpense, testDb)).rejects.toThrowError(
      /Financial invariant violation/
    );
  });

  it('records and deletes settlements cleanly', async () => {
    const group = await repo.createGroup('Settlement Test', testDb);
    const m1 = await repo.addMember(group.id, 'Alice', {}, testDb);
    const m2 = await repo.addMember(group.id, 'Bob', {}, testDb);

    const settlement: RecordedSettlement = {
      id: 'settle-1',
      groupId: group.id,
      fromMemberId: m2.id,
      toMemberId: m1.id,
      amountPaise: 25000,
      settledAt: new Date().toISOString(),
      note: 'UPI Payment',
    };

    await repo.recordSettlement(settlement, testDb);
    const list = await repo.listSettlements(group.id, testDb);
    expect(list).toHaveLength(1);
    expect(list[0].amountPaise).toBe(25000);

    // Delete settlement (undo)
    await repo.deleteSettlement('settle-1', testDb);
    const afterDelete = await repo.listSettlements(group.id, testDb);
    expect(afterDelete).toHaveLength(0);
  });
});
