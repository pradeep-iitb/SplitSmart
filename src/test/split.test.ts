import { describe, expect, it } from 'vitest';
import {
  calculateDetailedItemizedSplit,
  calculateExpenseShares,
} from '../features/split/splitEngine';
import { validateSplitInput } from '../features/split/validation';
import type { ReceiptItem, SplitInput } from '../features/split/types';
import expense840Fixture from './fixtures/expense-840.json';

describe('Split Calculation Engine (splitEngine.ts)', () => {
  const sampleParticipants = ['member-riya', 'member-arjun', 'member-meera', 'member-kabir'];

  it('calculates Equal split correctly and satisfies the sum invariant', () => {
    const input: SplitInput = {
      totalPaise: 84000, // ₹840.00
      splitMode: 'equal',
      participantIds: sampleParticipants,
    };

    const shares = calculateExpenseShares(input);

    expect(shares).toHaveLength(4);
    // 84000 / 4 = 21000 each
    for (const share of shares) {
      expect(share.amountPaise).toBe(21000);
    }

    const totalSum = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(totalSum).toBe(84000);
  });

  it('calculates Exact split correctly and verifies shares', () => {
    const input: SplitInput = {
      totalPaise: 50000, // ₹500.00
      splitMode: 'exact',
      participantIds: ['m1', 'm2', 'm3'],
      exactAmounts: {
        m1: 25000,
        m2: 15000,
        m3: 10000,
      },
    };

    const shares = calculateExpenseShares(input);
    expect(shares.find((s) => s.memberId === 'm1')?.amountPaise).toBe(25000);
    expect(shares.find((s) => s.memberId === 'm2')?.amountPaise).toBe(15000);
    expect(shares.find((s) => s.memberId === 'm3')?.amountPaise).toBe(10000);

    const totalSum = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(totalSum).toBe(50000);
  });

  it('calculates Percentage split using basis points (10000 = 100%)', () => {
    const input: SplitInput = {
      totalPaise: 10000, // ₹100.00
      splitMode: 'percentage',
      participantIds: ['m1', 'm2', 'm3'],
      percentagesBasisPoints: {
        m1: 5000, // 50% -> 5000 paise
        m2: 3000, // 30% -> 3000 paise
        m3: 2000, // 20% -> 2000 paise
      },
    };

    const shares = calculateExpenseShares(input);
    expect(shares.find((s) => s.memberId === 'm1')?.amountPaise).toBe(5000);
    expect(shares.find((s) => s.memberId === 'm2')?.amountPaise).toBe(3000);
    expect(shares.find((s) => s.memberId === 'm3')?.amountPaise).toBe(2000);

    const totalSum = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(totalSum).toBe(10000);
  });

  it('calculates Shares/Ratio split (e.g. 2:1:1 on ₹1000)', () => {
    const input: SplitInput = {
      totalPaise: 100000, // ₹1000.00
      splitMode: 'shares',
      participantIds: ['alice', 'bob', 'charlie'],
      sharesWeights: {
        alice: 2,
        bob: 1,
        charlie: 1,
      },
    };

    const shares = calculateExpenseShares(input);
    // Total weight = 4. Alice = 50000, Bob = 25000, Charlie = 25000
    expect(shares.find((s) => s.memberId === 'alice')?.amountPaise).toBe(50000);
    expect(shares.find((s) => s.memberId === 'bob')?.amountPaise).toBe(25000);
    expect(shares.find((s) => s.memberId === 'charlie')?.amountPaise).toBe(25000);

    const totalSum = shares.reduce((acc, s) => acc + s.amountPaise, 0);
    expect(totalSum).toBe(100000);
  });

  it('calculates Itemized split with proportional tax, service charge, and discount', () => {
    // Scenario:
    // Alice eats Pasta: ₹300 (30000 paise)
    // Bob eats Pizza: ₹500 (50000 paise)
    // Subtotal: ₹800 (80000 paise). Proportions: Alice = 3/8, Bob = 5/8
    // Tax (GST): ₹40 (4000 paise) -> Alice pays 3/8*40 = ₹15, Bob pays 5/8*40 = ₹25
    // Service Charge: ₹16 (1600 paise) -> Alice pays 3/8*16 = ₹6, Bob pays 5/8*16 = ₹10
    // Discount: ₹80 (8000 paise) -> Alice gets 3/8*80 = ₹30 off, Bob gets 5/8*80 = ₹50 off
    // Expected Alice: 300 + 15 + 6 - 30 = ₹291 (29100 paise)
    // Expected Bob: 500 + 25 + 10 - 50 = ₹485 (48500 paise)
    // Grand total: 800 + 40 + 16 - 80 = ₹776 (77600 paise)
    const items: ReceiptItem[] = [
      {
        id: 'item-pasta',
        name: 'Pasta',
        quantity: 1,
        unitPricePaise: 30000,
        lineTotalPaise: 30000,
        assignedMemberIds: ['alice'],
        category: 'Food',
      },
      {
        id: 'item-pizza',
        name: 'Pizza',
        quantity: 1,
        unitPricePaise: 50000,
        lineTotalPaise: 50000,
        assignedMemberIds: ['bob'],
        category: 'Food',
      },
    ];

    const input: SplitInput = {
      totalPaise: 77600,
      splitMode: 'itemized',
      participantIds: ['alice', 'bob'],
      items,
      taxLines: [{ label: 'GST 5%', amountPaise: 4000 }],
      serviceChargePaise: 1600,
      discountPaise: 8000,
    };

    const detailed = calculateDetailedItemizedSplit(input);

    expect(detailed.reconciled).toBe(true);
    expect(detailed.subtotalPaise).toBe(80000);
    expect(detailed.totalTaxPaise).toBe(4000);
    expect(detailed.serviceChargePaise).toBe(1600);
    expect(detailed.discountPaise).toBe(8000);
    expect(detailed.grandTotalPaise).toBe(77600);

    const aliceBreakdown = detailed.memberBreakdowns.find((b) => b.memberId === 'alice')!;
    const bobBreakdown = detailed.memberBreakdowns.find((b) => b.memberId === 'bob')!;

    expect(aliceBreakdown.itemSubtotalPaise).toBe(30000);
    expect(aliceBreakdown.proportionalTaxPaise).toBe(1500);
    expect(aliceBreakdown.proportionalServiceChargePaise).toBe(600);
    expect(aliceBreakdown.proportionalDiscountPaise).toBe(3000);
    expect(aliceBreakdown.finalSharePaise).toBe(29100);

    expect(bobBreakdown.itemSubtotalPaise).toBe(50000);
    expect(bobBreakdown.proportionalTaxPaise).toBe(2500);
    expect(bobBreakdown.proportionalServiceChargePaise).toBe(1000);
    expect(bobBreakdown.proportionalDiscountPaise).toBe(5000);
    expect(bobBreakdown.finalSharePaise).toBe(48500);

    const shares = calculateExpenseShares(input);
    expect(shares.find((s) => s.memberId === 'alice')?.amountPaise).toBe(29100);
    expect(shares.find((s) => s.memberId === 'bob')?.amountPaise).toBe(48500);
    expect(shares.reduce((a, b) => a + b.amountPaise, 0)).toBe(77600);
  });

  it('matches the canonical expense-840.json fixture itemized calculation', () => {
    // In expense-840: 2 items (56000 + 24000 = 80000), taxes (2000 + 2000 = 4000), total 84000
    // All 4 members assigned to both items
    const input: SplitInput = {
      totalPaise: expense840Fixture.amountPaise,
      splitMode: 'itemized',
      participantIds: ['member-riya', 'member-arjun', 'member-meera', 'member-kabir'],
      items: expense840Fixture.items as ReceiptItem[],
      taxLines: expense840Fixture.taxLines,
      serviceChargePaise: expense840Fixture.serviceChargePaise,
      discountPaise: expense840Fixture.discountPaise,
    };

    const shares = calculateExpenseShares(input);
    expect(shares).toHaveLength(4);

    // Each member should have 21000 paise exactly matching fixture
    for (const expectedShare of expense840Fixture.memberShares) {
      const computed = shares.find((s) => s.memberId === expectedShare.memberId);
      expect(computed?.amountPaise).toBe(expectedShare.amountPaise);
    }

    expect(shares.reduce((a, b) => a + b.amountPaise, 0)).toBe(84000);
  });

  it('validates split input and flags invalid configurations', () => {
    // Empty participants
    const noParticipants = validateSplitInput({
      totalPaise: 1000,
      splitMode: 'equal',
      participantIds: [],
    });
    expect(noParticipants.some((i) => i.code === 'EMPTY_PARTICIPANTS')).toBe(true);

    // Mismatched exact amounts
    const mismatchExact = validateSplitInput({
      totalPaise: 10000,
      splitMode: 'exact',
      participantIds: ['m1', 'm2'],
      exactAmounts: { m1: 5000, m2: 4000 }, // sum 9000 !== 10000
    });
    expect(mismatchExact.some((i) => i.code === 'EXACT_SUM_MISMATCH')).toBe(true);

    // Percentages do not sum to 100%
    const badPercent = validateSplitInput({
      totalPaise: 10000,
      splitMode: 'percentage',
      participantIds: ['m1', 'm2'],
      percentagesBasisPoints: { m1: 6000, m2: 3000 }, // 90% !== 100%
    });
    expect(badPercent.some((i) => i.code === 'PERCENTAGE_SUM_MISMATCH')).toBe(true);
  });
});
