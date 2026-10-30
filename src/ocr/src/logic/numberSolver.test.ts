import { describe, expect, it } from 'vitest';
import { resolveGap, generateNumericCandidates, extractItemQtyChecksum } from './numberSolver';

describe('numberSolver - resolveGap', () => {
  it('returns empty array when items sum perfectly matches total', () => {
    expect(resolveGap(17200, 17200)).toEqual([]);
  });

  it('detects sub-rupee round-off', () => {
    const res = resolveGap(17140, 17200);
    expect(res).toEqual([
      {
        kind: 'roundoff',
        paise: 60,
        needsConfirm: false,
        label: '+Round-off',
      },
    ]);
  });

  it('detects 5% GST on Burger King / fast food gap', () => {
    // 38000 paise (₹380.00) * 5% = 1900 paise (₹19.00) -> Total = 39900 paise (₹399.00)
    const res = resolveGap(38000, 39900);
    expect(res).toEqual([
      {
        kind: 'tax_inferred',
        pct: 5,
        paise: 1900,
        needsConfirm: true,
        label: 'Inferred GST (5%)',
      },
    ]);
  });

  it('detects 2.5% single-tax gap', () => {
    // 10000 paise * 2.5% = 250 paise -> Total = 10250 paise
    const res = resolveGap(10000, 10250);
    expect(res).toEqual([
      {
        kind: 'tax_inferred',
        pct: 2.5,
        paise: 250,
        needsConfirm: true,
        label: 'Inferred GST (2.5%)',
      },
    ]);
  });

  it('returns unresolved when gap does not match known tax or roundoff', () => {
    expect(resolveGap(10000, 15000)).toBe('unresolved');
  });
});

describe('numberSolver - generateNumericCandidates', () => {
  it('generates single-digit deletion candidates for 1220 to find 120', () => {
    const candidates = generateNumericCandidates('1220');
    expect(candidates).toContain(12000); // 120 * 100 paise
  });
});

describe('numberSolver - extractItemQtyChecksum', () => {
  it('verifies ITEM: 3 /QTY: 6 from Bill 3', () => {
    const lines = ['ONION PARATHA', '4 18.00 72.00', 'ITEM: 3 /QTY: 6', 'GRAND TOTAL 172.00'];
    const checksum = extractItemQtyChecksum(lines, 3, 6);
    expect(checksum).not.toBeNull();
    expect(checksum?.verified).toBe(true);
    expect(checksum?.printedItems).toBe(3);
    expect(checksum?.printedQty).toBe(6);
    expect(checksum?.message).toContain('Verified ✓');
  });

  it('flags mismatch when printed count differs from actual count', () => {
    const lines = ['ITEM: 3 /QTY: 6'];
    const checksum = extractItemQtyChecksum(lines, 2, 4);
    expect(checksum?.verified).toBe(false);
  });
});
