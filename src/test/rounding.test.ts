import { describe, expect, it } from 'vitest';
import {
  distributeEvenly,
  reconcileRounding,
  reconcileRoundingDetailed,
} from '../features/split/rounding';

describe('Rounding Reconciliation Engine (rounding.ts)', () => {
  it('PS Mandatory Case: ₹100 split 3 ways yields [3334, 3333, 3333] by stable ID tie-breaker', () => {
    // 10000 paise split 3 ways
    // Base floor = floor(10000 / 3) = 3333 paise each.
    // 1 odd paisa remainder.
    // Ties broken by stable member ID ascending: 'arjun' < 'meera' < 'riya'
    const stableIds = ['arjun', 'meera', 'riya'];
    const weights = [1, 1, 1];
    const totalPaise = 10000;

    const result = reconcileRounding(weights, totalPaise, stableIds);

    expect(result).toEqual([3334, 3333, 3333]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('PS Case: Tax ₹100 on item subtotals ₹600 / ₹400 -> tax shares ₹60 / ₹40', () => {
    // Subtotals: ₹600 (60000 paise) and ₹400 (40000 paise)
    // Tax: ₹100 (10000 paise)
    const stableIds = ['user-1', 'user-2'];
    const subtotals = [60000, 40000];
    const taxPaise = 10000;

    const result = reconcileRounding(subtotals, taxPaise, stableIds);

    expect(result).toEqual([6000, 4000]); // 6000 paise = ₹60, 4000 paise = ₹40
    expect(result.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('correctly allocates spare paise to largest fractional remainders', () => {
    // Total 100 paise divided by weights [1, 2, 3] (sum 6)
    // 100 * 1 / 6 = 16.666... (rem 4/6)
    // 100 * 2 / 6 = 33.333... (rem 2/6)
    // 100 * 3 / 6 = 50.000... (rem 0/6)
    // Base: 16 + 33 + 50 = 99 -> 1 spare paisa goes to index 0 (rem 4/6 is largest!)
    const stableIds = ['id-a', 'id-b', 'id-c'];
    const weights = [1, 2, 3];
    const total = 100;

    const result = reconcileRounding(weights, total, stableIds);
    expect(result).toEqual([17, 33, 50]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('provides a transparent audit trail with reconcileRoundingDetailed', () => {
    const stableIds = ['alex', 'beth'];
    const weights = [1, 1];
    const total = 3; // 3 paise split 2 ways -> 1.5 each -> 2 and 1

    const detailed = reconcileRoundingDetailed(weights, total, stableIds);
    expect(detailed.conservationVerified).toBe(true);
    expect(detailed.totalAllocatedPaise).toBe(3);
    expect(detailed.remainderPaise).toBe(1);
    expect(detailed.allocations).toEqual([2, 1]); // alex comes before beth alphabetically
    expect(detailed.auditEntries[0].receivedOddPaisa).toBe(true);
    expect(detailed.auditEntries[1].receivedOddPaisa).toBe(false);
  });

  it('handles edge case: zero total paise', () => {
    const stableIds = ['m1', 'm2', 'm3'];
    const weights = [10, 20, 30];
    const result = reconcileRounding(weights, 0, stableIds);

    expect(result).toEqual([0, 0, 0]);
  });

  it('handles edge case: all zero weights with positive total paise', () => {
    const stableIds = ['m1', 'm2', 'm3'];
    const weights = [0, 0, 0];
    const total = 100; // should fall back to equal division

    const result = reconcileRounding(weights, total, stableIds);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    expect(result).toEqual([34, 33, 33]);
  });

  it('distributeEvenly correctly assigns odd paise by stable ID', () => {
    const ids = ['riya', 'arjun', 'meera', 'kabir'];
    // Sorted IDs: 'arjun', 'kabir', 'meera', 'riya'
    // 5 paise among 4 people: base 1 each, 1 remainder to 'arjun'
    const distribution = distributeEvenly(5, ids);

    expect(distribution['arjun']).toBe(2);
    expect(distribution['kabir']).toBe(1);
    expect(distribution['meera']).toBe(1);
    expect(distribution['riya']).toBe(1);
  });
});
