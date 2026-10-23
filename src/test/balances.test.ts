import { describe, expect, it } from 'vitest';
import {
  calculateDetailedBalances,
  calculateGroupBalances,
  formatPaise,
  paiseToRupees,
  rupeesToPaise,
  verifyBalanceConservation,
} from '../features/settlement/balances';
import type { Expense, Member, RecordedSettlement } from '../types/domain';
import mixedPayersFixture from './fixtures/expenses-mixed-payers.json';
import partialSettlementsFixture from './fixtures/settlements-partial.json';

describe('Balance Calculation Engine (balances.ts)', () => {
  it('correctly calculates balances for a single expense with equal split', () => {
    const memberIds = ['riya', 'arjun', 'meera', 'kabir'];
    const expenses: Expense[] = [
      {
        id: 'exp-1',
        groupId: 'g-1',
        description: 'Dinner',
        date: '2026-10-23',
        payerId: 'riya',
        amountPaise: 80000, // ₹800.00
        splitMode: 'equal',
        memberShares: [
          { memberId: 'riya', amountPaise: 20000 },
          { memberId: 'arjun', amountPaise: 20000 },
          { memberId: 'meera', amountPaise: 20000 },
          { memberId: 'kabir', amountPaise: 20000 },
        ],
        items: [],
        taxLines: [],
        serviceChargePaise: 0,
        discountPaise: 0,
        createdAt: '2026-10-23T12:00:00Z',
      },
    ];

    const balances = calculateGroupBalances(memberIds, expenses, []);

    // Riya paid 80000, share 20000 -> net +60000 (creditor)
    // Arjun, Meera, Kabir paid 0, share 20000 -> net -20000 each (debtors)
    const riyaBal = balances.find((b) => b.memberId === 'riya')!.balancePaise;
    const arjunBal = balances.find((b) => b.memberId === 'arjun')!.balancePaise;
    const meeraBal = balances.find((b) => b.memberId === 'meera')!.balancePaise;
    const kabirBal = balances.find((b) => b.memberId === 'kabir')!.balancePaise;

    expect(riyaBal).toBe(60000);
    expect(arjunBal).toBe(-20000);
    expect(meeraBal).toBe(-20000);
    expect(kabirBal).toBe(-20000);

    // Sum of net balances must be zero
    const conservation = verifyBalanceConservation(balances);
    expect(conservation.valid).toBe(true);
    expect(conservation.discrepancyPaise).toBe(0);
  });

  it('updates balances properly when payments are recorded', () => {
    const memberIds = ['riya', 'arjun'];
    const expenses: Expense[] = [
      {
        id: 'exp-1',
        groupId: 'g-1',
        description: 'Coffee',
        date: '2026-10-23',
        payerId: 'riya',
        amountPaise: 40000, // ₹400
        splitMode: 'equal',
        memberShares: [
          { memberId: 'riya', amountPaise: 20000 },
          { memberId: 'arjun', amountPaise: 20000 },
        ],
        items: [],
        taxLines: [],
        serviceChargePaise: 0,
        discountPaise: 0,
        createdAt: '2026-10-23T12:00:00Z',
      },
    ];

    // Arjun pays Riya ₹200 (20000 paise)
    const payments: RecordedSettlement[] = [
      {
        id: 'pay-1',
        groupId: 'g-1',
        fromMemberId: 'arjun',
        toMemberId: 'riya',
        amountPaise: 20000,
        settledAt: '2026-10-23T13:00:00Z',
      },
    ];

    const balances = calculateGroupBalances(memberIds, expenses, payments);
    expect(balances.find((b) => b.memberId === 'riya')!.balancePaise).toBe(0);
    expect(balances.find((b) => b.memberId === 'arjun')!.balancePaise).toBe(0);
    expect(verifyBalanceConservation(balances).valid).toBe(true);
  });

  it('satisfies conservation of money on the 5-member 10-expense mixed payers fixture', () => {
    const members = mixedPayersFixture.members as Member[];
    const expenses = mixedPayersFixture.expenses as Expense[];
    const settlements = partialSettlementsFixture.settlements as RecordedSettlement[];

    const memberIds = members.map((m) => m.id);

    // 1. Without settlements
    const balancesBeforeSettlements = calculateGroupBalances(memberIds, expenses, []);
    const conservation1 = verifyBalanceConservation(balancesBeforeSettlements);
    expect(conservation1.valid).toBe(true);
    expect(conservation1.discrepancyPaise).toBe(0);

    // 2. With partial settlements applied
    const balancesAfterSettlements = calculateGroupBalances(memberIds, expenses, settlements);
    const conservation2 = verifyBalanceConservation(balancesAfterSettlements);
    expect(conservation2.valid).toBe(true);
    expect(conservation2.discrepancyPaise).toBe(0);

    // 3. Detailed breakdown
    const detailed = calculateDetailedBalances(members, expenses, settlements);
    expect(detailed.length).toBe(members.length);
    for (const d of detailed) {
      const expectedNet =
        d.totalPaidPaise -
        d.totalSharePaise +
        d.settlementsSentPaise -
        d.settlementsReceivedPaise;
      expect(d.netBalancePaise).toBe(expectedNet);
    }
  });

  describe('Paise and Currency Formatters', () => {
    it('formats positive, negative, and zero paise accurately in INR format', () => {
      expect(formatPaise(125000)).toBe('₹1,250.00');
      expect(formatPaise(-125000)).toBe('-₹1,250.00');
      expect(formatPaise(0)).toBe('₹0.00');
      expect(formatPaise(50, { showSign: true })).toBe('+₹0.50');
      expect(formatPaise(10000000)).toBe('₹1,00,000.00'); // 1 Lakh
    });

    it('safely converts rupees to paise avoiding floating point issues', () => {
      expect(rupeesToPaise('33.50')).toBe(3350);
      expect(rupeesToPaise(33.50)).toBe(3350);
      expect(rupeesToPaise('1,234.56')).toBe(123456);
      expect(rupeesToPaise('-50.25')).toBe(-5025);
      expect(paiseToRupees(3350)).toBe(33.5);
    });
  });
});
