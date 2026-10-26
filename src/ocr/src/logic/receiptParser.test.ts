import { describe, expect, it } from 'vitest';
import { parseAmountToPaise, parseReceipt } from './receiptParser';
import { validateParsed, validateTotals } from './receiptValidation';
import { MOCK_RECEIPT_TEXT as T, fromPlainText } from '../mock/mockReceipts';

describe('parseAmountToPaise', () => {
  it.each([['1,234.50', 123450], ['12,50', 1250], ['1,234', 123400], ['(20.00)', -2000], ['60', 6000], ['5.5', 550]])('%s', (s, e) =>
    expect(parseAmountToPaise(s)).toBe(e));
  it('rejects phone-number-sized values', () => expect(parseAmountToPaise('9876543210')).toBeNull());
});

describe('parseReceipt', () => {
  it('case 1: clear restaurant bill with CGST/SGST', () => {
    const p = parseReceipt(fromPlainText(T.restaurant));
    expect(p.items.map(i => [i.name, i.quantity, i.totalPaise])).toEqual([['Large Pizza', 1, 40000], ['Maggi', 4, 24000], ['Cold Coffee', 1, 16000]]);
    expect(p.taxPaise).toBe(4000);
    expect(p.detectedTotalPaise).toBe(84000);
    expect(p.dateISO).toBe('2026-10-24');
    expect(validateParsed(p).status).toBe('ok');   // address, GSTIN, phone, cash/change are ignored
  });

  it('case 2: faded receipt exposes low-confidence words', () => {
    const p = parseReceipt(fromPlainText(T.restaurant, 0.95, { 7: 0.45 }));
    expect(p.items[0].uncertainWords).toContain('400.00');
    expect(p.items[0].amountConfidence).toBeLessThan(0.7);
  });

  it('case 4: non-receipt yields no items', () => {
    const p = parseReceipt(fromPlainText(T.notAReceipt, 0.4));
    expect(p.items).toHaveLength(0);
    expect(p.warnings.map(w => w.code)).toContain('NO_ITEMS_FOUND');
  });

  it('case 5: no printed total -> computed and flagged for confirmation', () => {
    const p = parseReceipt(fromPlainText(T.canteenNoTotal));
    expect(p.totalWasComputed).toBe(true);
    expect(p.totalPaise).toBe(15000);
    expect(validateParsed(p).status).toBe('unconfirmed');
  });

  it('service charge, discount and tax', () => {
    const p = parseReceipt(fromPlainText(T.serviceAndDiscount));
    expect([p.serviceChargePaise, p.discountPaise, p.taxPaise]).toEqual([4000, 2000, 2200]);
    expect(validateParsed(p).status).toBe('ok');
  });

  it('tax already included in item prices is not added twice', () => {
    const p = parseReceipt(fromPlainText(T.taxInclusive));
    expect(p.taxIncluded).toBe(true);
    expect(validateParsed(p).status).toBe('ok');
  });

  it('name on one line, qty/price on the next', () => {
    const p = parseReceipt(fromPlainText(T.wrapped));
    expect(p.items[0]).toMatchObject({ name: 'Paneer Tikka Roll', quantity: 2, totalPaise: 18000 });
  });
});

describe('validateTotals', () => {
  const base = { itemTotalsPaise: [40000, 40000], taxPaise: 4000, serviceChargePaise: 0, discountPaise: 0 };
  it('reports the difference when numbers do not add up', () => {
    const v = validateTotals({ ...base, statedTotalPaise: 90000 });
    expect(v.status).toBe('mismatch');
    expect(v.diffPaise).toBe(6000);
  });
  it('treats < ₹1 as rounding', () => expect(validateTotals({ ...base, statedTotalPaise: 84040 }).status).toBe('rounding'));
});
