import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { SplitSmartDatabase } from '../db/database';
import * as repo from '../db/repository';
import { buildBatchExpenses } from '../features/split/batchExpense';
import type { ReceiptItem } from '../types/domain';

const item = (id: string, amount: number, assignee: string): ReceiptItem => ({
  id,
  name: id,
  quantity: 1,
  unitPricePaise: amount,
  lineTotalPaise: amount,
  assignedMemberIds: [assignee],
  category: 'Food',
});

describe('batch receipt persistence', () => {
  it('saves different payers as separate itemized expenses with exact totals', async () => {
    const db = new SplitSmartDatabase(`batch-${Math.random()}`);
    await db.open();
    const group = await repo.createGroup('Trip', db);
    const alice = await repo.addMember(group.id, 'Alice', {}, db);
    const bob = await repo.addMember(group.id, 'Bob', {}, db);
    const expenses = buildBatchExpenses({
      bills: [
        { billId: 'bill-1', billIndex: 0, billName: 'Bill No. 1', payerId: alice.id, items: [item('lunch', 10001, alice.id)] },
        { billId: 'bill-2', billIndex: 1, billName: 'Bill No. 2', payerId: bob.id, items: [item('tea', 5001, bob.id)] },
      ],
      groupId: group.id,
      date: '2026-10-30',
      description: 'Trip receipts',
      memberIds: [alice.id, bob.id],
      taxLines: [{ label: 'GST (Bill No. 1)', amountPaise: 301 }],
      serviceChargePaise: 101,
      discountPaise: 20,
      confirmedTotalPaise: 15384,
      batchId: 'batch-test',
    });
    expect(expenses.map((expense) => expense.payerId)).toEqual([alice.id, bob.id]);
    expect(expenses.reduce((sum, expense) => sum + expense.amountPaise, 0)).toBe(15384);
    for (const expense of expenses) {
      expect(expense.memberShares.reduce((sum, share) => sum + share.amountPaise, 0)).toBe(expense.amountPaise);
    }
    await repo.saveExpensesBatch(expenses, db);
    expect(await repo.listExpenses(group.id, db)).toHaveLength(2);
    await db.delete();
  });

  it('rejects a bad batch without writing any of its bills', async () => {
    const db = new SplitSmartDatabase(`batch-invalid-${Math.random()}`);
    await db.open();
    const group = await repo.createGroup('Trip', db);
    const member = await repo.addMember(group.id, 'Alice', {}, db);
    const base = {
      id: 'bill-good', groupId: group.id, description: 'Tea', date: '2026-10-30',
      payerId: member.id, amountPaise: 100, splitMode: 'itemized' as const,
      memberShares: [{ memberId: member.id, amountPaise: 100 }], items: [], taxLines: [],
      serviceChargePaise: 0, discountPaise: 0, createdAt: new Date().toISOString(),
    };
    await expect(repo.saveExpensesBatch([base, { ...base, id: 'bill-bad', amountPaise: 200 }], db)).rejects.toThrow(/Shares do not match/);
    expect(await repo.listExpenses(group.id, db)).toHaveLength(0);
    await db.delete();
  });
});
