import Dexie, { type EntityTable } from 'dexie';
import type {
  Expense,
  Group,
  Member,
  RecordedSettlement,
} from '../types/domain';
import type { RecurringExpenseTemplate } from '../features/split/types';

/**
 * SplitSmart IndexedDB Schema definition using Dexie.js (PS Point 14).
 * Single authoritative local database on the user's device.
 */
export class SplitSmartDatabase extends Dexie {
  groups!: EntityTable<Group, 'id'>;
  members!: EntityTable<Member, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  settlements!: EntityTable<RecordedSettlement, 'id'>;
  recurringTemplates!: EntityTable<RecurringExpenseTemplate, 'id'>;

  constructor(dbName = 'SplitSmartDB') {
    super(dbName);

    this.version(1).stores({
      groups: 'id, name, createdAt, updatedAt',
      members: 'id, groupId, name, active',
      expenses: 'id, groupId, payerId, date, createdAt',
      settlements: 'id, groupId, fromMemberId, toMemberId, settledAt',
      recurringTemplates: 'id, groupId, active',
    });
  }
}

// Singleton database instance for client-side runtime
export const db = new SplitSmartDatabase();
