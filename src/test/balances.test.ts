import { describe, expect, it } from 'vitest';
import {
  calculateDetailedBalances,
  calculateGroupBalances,
  calculatePairwiseBalancesForMember,
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

    it('accurately calculates direct pairwise who-owes-whom balances', () => {
      // Scenario:
      // Members: Me, Riya, Arjun
      // 1. Riya pays ₹900 for lunch (Me's share is ₹300, Arjun's share is ₹300, Riya's share is ₹300)
      //    -> Me owes Riya ₹300
      // 2. Me pays ₹1,000 for dinner (Arjun's share is ₹500, Me's share is ₹500)
      //    -> Arjun owes Me ₹500
      // Expected direct bilateral relations:
      // - Me with Riya: -₹300 (Me owes Riya ₹300)
      // - Me with Arjun: +₹500 (Arjun owes Me ₹500)
      // Expected group net balance: -300 + 500 = +₹200 (group owes Me ₹200)
      const members: Member[] = [
        { id: 'me', groupId: 'g1', name: 'Me', active: true, isCurrentUser: true },
        { id: 'riya', groupId: 'g1', name: 'Riya', active: true, isCurrentUser: false },
        { id: 'arjun', groupId: 'g1', name: 'Arjun', active: true, isCurrentUser: false },
      ];

      const expenses: Expense[] = [
        {
          id: 'exp-lunch',
          groupId: 'g1',
          description: 'Lunch',
          date: '2026-10-30',
          payerId: 'riya',
          amountPaise: 90000,
          splitMode: 'equal',
          memberShares: [
            { memberId: 'riya', amountPaise: 30000 },
            { memberId: 'me', amountPaise: 30000 },
            { memberId: 'arjun', amountPaise: 30000 },
          ],
          items: [],
          taxLines: [],
          serviceChargePaise: 0,
          discountPaise: 0,
          createdAt: '',
        },
        {
          id: 'exp-dinner',
          groupId: 'g1',
          description: 'Dinner',
          date: '2026-10-30',
          payerId: 'me',
          amountPaise: 100000,
          splitMode: 'exact',
          memberShares: [
            { memberId: 'me', amountPaise: 50000 },
            { memberId: 'arjun', amountPaise: 50000 },
          ],
          items: [],
          taxLines: [],
          serviceChargePaise: 0,
          discountPaise: 0,
          createdAt: '',
        },
      ];

      const pairwise = calculatePairwiseBalancesForMember('me', members, expenses);
      const riyaRel = pairwise.find((p) => p.otherMemberId === 'riya')!;
      const arjunRel = pairwise.find((p) => p.otherMemberId === 'arjun')!;

      // Me owes Riya ₹300 (-30000 paise)
      expect(riyaRel.amountPaise).toBe(-30000);

      // Arjun owes Me ₹500 (+50000 paise)
      expect(arjunRel.amountPaise).toBe(50000);

      // Sum of bilateral relationships matches group net balance exactly
      const sumPairwise = pairwise.reduce((acc, p) => acc + p.amountPaise, 0);
      const groupBalances = calculateGroupBalances(['me', 'riya', 'arjun'], expenses, []);
      const myNet = groupBalances.find((b) => b.memberId === 'me')!.balancePaise;

      expect(sumPairwise).toBe(20000); // +₹200
      expect(myNet).toBe(20000); // +₹200
      expect(sumPairwise).toBe(myNet);
    });
  });
});
