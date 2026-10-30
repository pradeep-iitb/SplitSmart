import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { SplitSmartDatabase } from '../db/database';
import * as repo from '../db/repository';
import { summarizePersonalGroup, summarizePersonalTotals } from '../features/settlement/personalSummary';
import type { Expense } from '../types/domain';

describe('current user in groups', () => {
  it('adds Me to a new group and keeps that member from being removed', async () => {
    const db = new SplitSmartDatabase(`me-new-${Math.random()}`);
    const group = await repo.createGroup('Trip', db);
    const me = await repo.ensureCurrentUserMember(group.id, db);
    expect(me.name).toBe('Me');
    expect((await repo.listMembers(group.id, true, db)).filter((member) => member.isCurrentUser)).toHaveLength(1);
    await expect(repo.removeMember(me.id, db)).rejects.toThrow('This member is you');
    await db.delete();
  });

  it('assigns an existing member as Me without changing expense ownership', async () => {
    const db = new SplitSmartDatabase(`me-existing-${Math.random()}`);
    const group = await repo.createGroup('Dinner', db);
    const alice = await repo.addMember(group.id, 'Alice', undefined, db);
    const bob = await repo.addMember(group.id, 'Bob', undefined, db);
    const expense: Expense = {
      id: 'dinner', groupId: group.id, description: 'Dinner', date: '2026-10-29', payerId: alice.id,
      amountPaise: 10000, splitMode: 'equal', memberShares: [{ memberId: alice.id, amountPaise: 5000 }, { memberId: bob.id, amountPaise: 5000 }],
      items: [], taxLines: [], serviceChargePaise: 0, discountPaise: 0, createdAt: '2026-10-29T10:00:00Z',
    };
    await repo.saveExpense(expense, db);
    const legacyFirstMember = (await repo.listMembers(group.id, true, db))[0];
    expect((await repo.ensureCurrentUserMember(group.id, db)).id).toBe(legacyFirstMember.id);
    await repo.setCurrentUserMember(group.id, bob.id, db);
    const members = await repo.listMembers(group.id, true, db);
    const summary = summarizePersonalGroup(group, members, await repo.listExpenses(group.id, db), []);
    expect(members.filter((member) => member.isCurrentUser).map((member) => member.id)).toEqual([bob.id]);
    expect(summary.myExpenseSharePaise).toBe(5000);
    expect(summary.balancePaise).toBe(-5000);
    expect((await repo.listExpenses(group.id, db))[0].payerId).toBe(alice.id);
    await repo.recordSettlement({ id: 'payment', groupId: group.id, fromMemberId: bob.id, toMemberId: alice.id, amountPaise: 2000, settledAt: '2026-10-29T11:00:00Z' }, db);
    const afterPayment = summarizePersonalGroup(group, members, await repo.listExpenses(group.id, db), await repo.listSettlements(group.id, db));
    expect(afterPayment.balancePaise).toBe(-3000);
    await db.delete();
  });

  it('shows money owed and owing separately across groups', () => {
    const group = { id: 'g1', name: 'One', createdAt: '', updatedAt: '' };
    const group2 = { ...group, id: 'g2', name: 'Two' };
    const summaries = [
      { group, members: [], expenseCount: 1, myExpenseSharePaise: 1000, balancePaise: -600 },
      { group: group2, members: [], expenseCount: 1, myExpenseSharePaise: 2000, balancePaise: 1500 },
    ];
    expect(summarizePersonalTotals(summaries)).toEqual({ spentPaise: 3000, owePaise: 600, owedPaise: 1500 });
  });
});
