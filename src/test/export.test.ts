import { describe, expect, it } from 'vitest';
import {
  exportExpensesToCsv,
  exportGroupSummaryText,
  exportSettlementsToCsv,
} from '../features/settlement/export';
import type { Expense, Group, Member, MemberBalance, RecordedSettlement, SuggestedPayment } from '../types/domain';
import group4Fixture from './fixtures/group-4.json';

describe('Export Engine (export.ts)', () => {
  const group: Group = group4Fixture.group;
  const members: Member[] = group4Fixture.members;

  const expenses: Expense[] = [
    {
      id: 'exp-1',
      groupId: group.id,
      description: 'Shack Dinner, Drinks & Desserts', // contains comma
      date: '2026-10-21',
      payerId: 'member-riya',
      amountPaise: 84000,
      splitMode: 'equal',
      memberShares: [
        { memberId: 'member-riya', amountPaise: 21000 },
        { memberId: 'member-arjun', amountPaise: 21000 },
        { memberId: 'member-meera', amountPaise: 21000 },
        { memberId: 'member-kabir', amountPaise: 21000 },
      ],
      items: [],
      taxLines: [],
      serviceChargePaise: 0,
      discountPaise: 0,
      createdAt: '2026-10-21T20:00:00Z',
    },
  ];

  const balances: MemberBalance[] = [
    { memberId: 'member-riya', balancePaise: 63000 },
    { memberId: 'member-arjun', balancePaise: -21000 },
    { memberId: 'member-meera', balancePaise: -21000 },
    { memberId: 'member-kabir', balancePaise: -21000 },
  ];

  const suggestions: SuggestedPayment[] = [
    { fromMemberId: 'member-arjun', toMemberId: 'member-riya', amountPaise: 21000 },
    { fromMemberId: 'member-meera', toMemberId: 'member-riya', amountPaise: 21000 },
    { fromMemberId: 'member-kabir', toMemberId: 'member-riya', amountPaise: 21000 },
  ];

  const recorded: RecordedSettlement[] = [
    {
      id: 'rec-1',
      groupId: group.id,
      fromMemberId: 'member-arjun',
      toMemberId: 'member-riya',
      amountPaise: 21000,
      settledAt: '2026-10-22T10:00:00Z',
      note: 'UPI transfer',
    },
  ];

  it('exports expenses to valid CSV with UTF-8 BOM and escaped cells', () => {
    const csv = exportExpensesToCsv(expenses, members);
    expect(csv.startsWith('\uFEFF')).toBe(true); // UTF-8 BOM
    expect(csv.includes('Expense ID,Date,Description,Paid By')).toBe(true);
    expect(csv.includes('"Shack Dinner, Drinks & Desserts"')).toBe(true); // properly escaped comma
    expect(csv.includes('840.00')).toBe(true); // formatted rupees
    expect(csv.includes('Riya')).toBe(true); // payer resolved
  });

  it('exports settlements and balances to structured CSV', () => {
    const csv = exportSettlementsToCsv(balances, suggestions, recorded, members);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.includes('--- MEMBER NET BALANCES ---')).toBe(true);
    expect(csv.includes('--- SIMPLIFIED SETTLEMENT INSTRUCTIONS ---')).toBe(true);
    expect(csv.includes('--- COMPLETED SETTLEMENTS HISTORY ---')).toBe(true);
    expect(csv.includes('Arjun,Riya,210.00,riya@okhdfcbank')).toBe(true);
  });

  it('generates WhatsApp/email summary text with accurate values', () => {
    const summary = exportGroupSummaryText(group, members, expenses, balances, suggestions);
    expect(summary.includes('SplitSmart Settlement Summary: Goa Trip')).toBe(true);
    expect(summary.includes('Riya: gets back ₹630.00')).toBe(true);
    expect(summary.includes('Arjun ➡️ Riya: ₹210.00 (UPI: riya@okhdfcbank)')).toBe(true);
  });
});
