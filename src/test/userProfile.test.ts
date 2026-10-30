import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SplitSmartDatabase } from '../db/database';
import * as repo from '../db/repository';
import {
  getUserProfileName,
  getUserProfileUpi,
  saveUserProfile,
  syncUserProfileAcrossGroups,
  USER_NAME_STORAGE_KEY,
  USER_UPI_STORAGE_KEY,
} from '../utils/userProfile';
import {
  exportExpensesToCsv,
  exportSettlementsToCsv,
  exportGroupSummaryText,
} from '../features/settlement/export';
import type { Expense, Group, Member, MemberBalance, SuggestedPayment } from '../types/domain';

// Mock localStorage for Node test runner
const memoryStorage = new Map<string, string>();
const mockStorage: Storage = {
  length: 0,
  clear: () => memoryStorage.clear(),
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  key: (index: number) => Array.from(memoryStorage.keys())[index] ?? null,
  removeItem: (key: string) => memoryStorage.delete(key),
  setItem: (key: string, value: string) => memoryStorage.set(key, String(value)),
};
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
});

describe('User Profile & Clean Start System', () => {
  let testDb: SplitSmartDatabase;

  beforeEach(async () => {
    localStorage.clear();
    testDb = new SplitSmartDatabase(`test-profile-${Date.now()}-${Math.random()}`);
    await testDb.open();
  });

  describe('User Profile Storage', () => {
    it('saves and retrieves profile name and UPI ID in localStorage', () => {
      expect(getUserProfileName()).toBe('');
      expect(getUserProfileUpi()).toBe('');

      saveUserProfile({ name: 'Atharva', upiId: 'atharva@oksbi' });

      expect(getUserProfileName()).toBe('Atharva');
      expect(getUserProfileUpi()).toBe('atharva@oksbi');
      expect(localStorage.getItem(USER_NAME_STORAGE_KEY)).toBe('Atharva');
      expect(localStorage.getItem(USER_UPI_STORAGE_KEY)).toBe('atharva@oksbi');
    });

    it('clears profile name when empty string is passed', () => {
      saveUserProfile({ name: 'Atharva' });
      expect(getUserProfileName()).toBe('Atharva');

      saveUserProfile({ name: '' });
      expect(getUserProfileName()).toBe('');
      expect(localStorage.getItem(USER_NAME_STORAGE_KEY)).toBeNull();
    });
  });

  describe('ensureCurrentUserMember with Profile Name', () => {
    it('creates current user member with real name when profile is configured', async () => {
      saveUserProfile({ name: 'Atharva', upiId: 'atharva@okhdfc' });

      const group = await repo.createGroup('Manali Trip', testDb);
      const currentMember = await repo.ensureCurrentUserMember(group.id, testDb);

      expect(currentMember.name).toBe('Atharva');
      expect(currentMember.upiId).toBe('atharva@okhdfc');
      expect(currentMember.isCurrentUser).toBe(true);
    });

    it('updates existing "Me" member to user profile name on subsequent ensureCurrentUserMember call', async () => {
      // 1. Group created before profile was set
      const group = await repo.createGroup('Dinner Group', testDb);
      const initialMember = await repo.ensureCurrentUserMember(group.id, testDb);
      expect(initialMember.name).toBe('Me');

      // 2. User sets their name
      saveUserProfile({ name: 'Rahul', upiId: 'rahul@paytm' });

      // 3. ensureCurrentUserMember automatically updates the legacy 'Me' to 'Rahul'
      const updatedMember = await repo.ensureCurrentUserMember(group.id, testDb);
      expect(updatedMember.name).toBe('Rahul');
      expect(updatedMember.upiId).toBe('rahul@paytm');
    });

    it('syncs user profile name across all existing groups', async () => {
      const g1 = await repo.createGroup('Trip 1', testDb);
      const g2 = await repo.createGroup('Trip 2', testDb);

      await repo.ensureCurrentUserMember(g1.id, testDb);
      await repo.ensureCurrentUserMember(g2.id, testDb);

      await syncUserProfileAcrossGroups('Vikram', 'vikram@axis', testDb);

      const m1 = (await repo.listMembers(g1.id, true, testDb)).find((m) => m.isCurrentUser);
      const m2 = (await repo.listMembers(g2.id, true, testDb)).find((m) => m.isCurrentUser);

      expect(m1?.name).toBe('Vikram');
      expect(m1?.upiId).toBe('vikram@axis');
      expect(m2?.name).toBe('Vikram');
      expect(m2?.upiId).toBe('vikram@axis');
    });
  });

  describe('Records, CSV Exports, and WhatsApp Copy Clarity', () => {
    const group: Group = {
      id: 'g-trip',
      name: 'Weekend Getaway',
      createdAt: '2026-10-20T00:00:00Z',
      updatedAt: '2026-10-20T00:00:00Z',
    };

    const membersWithRealName: Member[] = [
      { id: 'm-user', groupId: 'g-trip', name: 'Atharva', isCurrentUser: true, upiId: 'atharva@oksbi', active: true },
      { id: 'm-riya', groupId: 'g-trip', name: 'Riya', upiId: 'riya@okhdfc', active: true },
      { id: 'm-arjun', groupId: 'g-trip', name: 'Arjun', upiId: 'arjun@icici', active: true },
    ];

    const expenses: Expense[] = [
      {
        id: 'exp-1',
        groupId: 'g-trip',
        description: 'Beach Shack Dinner',
        date: '2026-10-20',
        payerId: 'm-user', // Atharva paid
        amountPaise: 150000, // ₹1,500.00
        splitMode: 'equal',
        memberShares: [
          { memberId: 'm-user', amountPaise: 50000 },
          { memberId: 'm-riya', amountPaise: 50000 },
          { memberId: 'm-arjun', amountPaise: 50000 },
        ],
        items: [],
        taxLines: [],
        serviceChargePaise: 0,
        discountPaise: 0,
        createdAt: '2026-10-20T20:00:00Z',
      },
    ];

    const balances: MemberBalance[] = [
      { memberId: 'm-user', balancePaise: 100000 }, // Atharva gets back ₹1000
      { memberId: 'm-riya', balancePaise: -50000 },  // Riya owes ₹500
      { memberId: 'm-arjun', balancePaise: -50000 }, // Arjun owes ₹500
    ];

    const suggestions: SuggestedPayment[] = [
      { fromMemberId: 'm-riya', toMemberId: 'm-user', amountPaise: 50000 },
      { fromMemberId: 'm-arjun', toMemberId: 'm-user', amountPaise: 50000 },
    ];

    it('exports expenses to CSV using real name instead of "Me"', () => {
      const csv = exportExpensesToCsv(expenses, membersWithRealName);

      expect(csv).toContain('Atharva');
      expect(csv).not.toContain('Me:');
      expect(csv).toContain('Atharva: 500.00; Riya: 500.00; Arjun: 500.00');
    });

    it('exports settlements to CSV using real name instead of "Me"', () => {
      const csv = exportSettlementsToCsv(balances, suggestions, [], membersWithRealName);

      expect(csv).toContain('Atharva,1000.00');
      expect(csv).toContain('Riya,Atharva,500.00,atharva@oksbi');
      expect(csv).toContain('Arjun,Atharva,500.00,atharva@oksbi');
    });

    it('generates WhatsApp copy text referring to real name instead of "Me"', () => {
      const text = exportGroupSummaryText(group, membersWithRealName, expenses, balances, suggestions);

      expect(text).toContain('• Atharva: gets back ₹1,000.00');
      expect(text).toContain('1. Riya ➡️ Atharva: ₹500.00 (UPI: atharva@oksbi)');
      expect(text).toContain('2. Arjun ➡️ Atharva: ₹500.00 (UPI: atharva@oksbi)');
      expect(text).not.toContain('• Me:');
      expect(text).not.toContain('➡️ Me:');
    });

    it('resolves legacy "Me" member to profile name in WhatsApp and CSV exports', () => {
      // Legacy members list where the current user is still stored as 'Me'
      const legacyMembers: Member[] = [
        { id: 'm-user', groupId: 'g-trip', name: 'Me', isCurrentUser: true, upiId: 'atharva@oksbi', active: true },
        { id: 'm-riya', groupId: 'g-trip', name: 'Riya', upiId: 'riya@okhdfc', active: true },
      ];

      // Set user profile in localStorage
      saveUserProfile({ name: 'Atharva' });

      const text = exportGroupSummaryText(
        group,
        legacyMembers,
        expenses,
        [{ memberId: 'm-user', balancePaise: 50000 }, { memberId: 'm-riya', balancePaise: -50000 }],
        [{ fromMemberId: 'm-riya', toMemberId: 'm-user', amountPaise: 50000 }]
      );

      // Even with legacy 'Me' member record, the export resolves to Atharva!
      expect(text).toContain('• Atharva: gets back');
      expect(text).toContain('Riya ➡️ Atharva:');
    });
  });
});
