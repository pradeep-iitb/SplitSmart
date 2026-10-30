import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { SplitSmartDatabase } from '../db/database';
import * as repo from '../db/repository';

describe('automatic recurring persistence', () => {
  it('materializes once and keeps legitimate same-name same-amount expenses', async () => {
    const db = new SplitSmartDatabase(`recurring-persistence-${Math.random()}`);
    await db.open();
    const group = await repo.createGroup('Flat', db);
    const me = await repo.addMember(group.id, 'Me', {}, db);
    await repo.saveRecurringTemplate({
      id: 'rent', groupId: group.id, description: 'Rent', category: 'Utilities',
      amountPaise: 100000, payerId: me.id, splitMode: 'equal', participantIds: [me.id],
      frequency: 'monthly', startDate: '2026-08-01', dayOfMonth: 1, active: true,
      createdAt: '2026-08-01T00:00:00Z',
    }, db);
    expect(await repo.materializeDueRecurringForGroup(group.id, '2026-10-30', db)).toBe(3);
    expect(await repo.materializeDueRecurringForGroup(group.id, '2026-10-30', db)).toBe(0);
    expect(await repo.listExpenses(group.id, db)).toHaveLength(3);
    const template = (await repo.listRecurringTemplates(group.id, db))[0];
    expect(template.lastMaterializedDate).toBe('2026-10-01');
    await db.delete();
  });
});
