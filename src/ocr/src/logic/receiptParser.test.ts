import { describe, expect, it } from 'vitest';
import { parseAmountToPaise, parseReceipt } from './receiptParser';
import { validateParsed, validateTotals } from './receiptValidation';
import { MOCK_RECEIPT_TEXT as T, fromPlainText } from '../mock/mockReceipts';

describe('parseAmountToPaise', () => {
  it.each([
    ['1,234.50', 123450],
    ['12,50', 1250],
    ['1,234', 123400],
    ['(20.00)', -2000],
    ['60', 6000],
    ['5.5', 550],
  ])('%s', (s, e) => expect(parseAmountToPaise(s)).toBe(e));
  it('rejects phone-number-sized values', () =>
    expect(parseAmountToPaise('9876543210')).toBeNull());
});

describe('parseReceipt', () => {
  it('case 1: clear restaurant bill with CGST/SGST', () => {
    const p = parseReceipt(fromPlainText(T.restaurant));
    expect(p.items.map((i) => [i.name, i.quantity, i.totalPaise])).toEqual([
      ['Large Pizza', 1, 40000],
      ['Maggi', 4, 24000],
      ['Cold Coffee', 1, 16000],
    ]);
    expect(p.taxPaise).toBe(4000);
    expect(p.detectedTotalPaise).toBe(84000);
    expect(p.dateISO).toBe('2026-10-24');
    expect(validateParsed(p).status).toBe('ok'); // address, GSTIN, phone, cash/change are ignored
  });

  it('case 2: faded receipt exposes low-confidence words', () => {
    const p = parseReceipt(fromPlainText(T.restaurant, 0.95, { 7: 0.45 }));
    expect(p.items[0].uncertainWords).toContain('400.00');
    expect(p.items[0].amountConfidence).toBeLessThan(0.7);
  });

  it('case 4: non-receipt yields no items', () => {
    const p = parseReceipt(fromPlainText(T.notAReceipt, 0.4));
    expect(p.items).toHaveLength(0);
    expect(p.warnings.map((w) => w.code)).toContain('NO_ITEMS_FOUND');
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

  it('handles Food Avenue real receipt with address noise and OCR artifacts', () => {
    const text = `THE FOOD AVENUE
Multi Cuisine Restaurant
Shop No. 12, Horizon Complex, IIT Bombay,
Powai, Mumbai - 400076
Tel: 022-2576 1234
Bill No : 8421
Date : 26-Oct-2026
il Margherita Pizza (L) il 380.00 380.00
2 Double Masala Maggi 2 180.00 360.00
8! Cold Coffee 3 120.00 360.00
4 Cheese Garlic Bread 1 160.00 160.00
Subtotal 1,260.00
Service Charge (5%) 63.00
CGST (2.5%) 33.08
SGST (2.5%) 33.08
Total (₹) 1,389.00`;
    // Line 8 has low OCR confidence on "SFRIR", triggering CHECK status
    const p = parseReceipt(fromPlainText(text, 0.9, { 8: 0.2 }));
    expect(p.items.map((i) => i.name)).toEqual([
      'Margherita Pizza (L)',
      'Double Masala Maggi',
      'Cold Coffee',
      'Cheese Garlic Bread',
    ]);
    expect(p.serviceChargePaise).toBe(6300);
    expect(p.taxPaise).toBe(6616); // 33.08 + 33.08
    expect(p.detectedTotalPaise).toBe(138900);
  });

  it('handles Bill 1 IIT Bombay Canteen ₹75 receipt with zero-amount trailing token and subtotal', () => {
    const text = `IS CATERING pon PT LI
gear d —anteen, IIT Boney
F— Matai 400076
Date : 28/07/26 Bill Wo. : BO]
T.No.: 1        Emp. No. = 1
Particulars       Qiy Rate Amount
VEG CHEESE FRARKY       1 30     0
VEG SEZHAN RICE    1 &5   8
Food Total :    75.00
a
-      Total :         75`;
    // Line 8 has low OCR confidence on "SFRIR", triggering CHECK status
    const p = parseReceipt(fromPlainText(text, 0.9, { 8: 0.2 }));
    expect(p.items.map((i) => [i.name, i.quantity, i.totalPaise])).toEqual([
      ['Veg Cheese Franky', 1, 3000],
      ['Veg Sezwan Rice', 1, 4500],
    ]);
    expect(p.items[0].repairedFrom).toBe('Veg Cheese Frarky');
    expect(p.items[1].repairedFrom).toBe('Veg Sezhan Rice');
    expect(p.detectedTotalPaise).toBe(7500);
    expect(p.computedTotalPaise).toBe(7500);
    // Bill 1 had amount repair on item 2 (8 -> 45), so receiptStatus correctly triggers CHECK for user confirmation
    expect(p.receiptStatus).toBe('CHECK');
    expect(p.items[1].status).toBe('CHECK');
    expect(validateParsed(p).status).toBe('ok');
  });

  it('handles Bill 2 IIT Bombay Canteen ₹120 receipt with Food Total and 3/3 Total prefix', () => {
    const text = `ri                             mie
&          GROTIS CATERING SERVICES Pyl—oqy—
Hostel 2 Canteen, IIT Bombay
o>               Powai, Mumbai 400076
“e==----= Tax Invoice ------=======
       09
Date : 30/04/26   Bill No. : LM
T.No.: 1        Emp. No. : 1
Particulars       Qty Rate Amount
VEG CHEESE FRANKY      TRE30     30
PNR THAGADA FRANKY     1 45     45
VEG SEZWAN NOODLES     1 45     45
Food Total :   120.00
3/3         Total :        1220
GSTIN.27AAOCAG957F 128     (12:54 4M)
E.80.E.    Thank You     Visit Again`;
    // Line 8 has low OCR confidence on "SFRIR", triggering CHECK status
    const p = parseReceipt(fromPlainText(text, 0.9, { 8: 0.2 }));
    expect(p.items.map((i) => [i.name, i.quantity, i.totalPaise])).toEqual([
      ['Veg Cheese Franky', 1, 3000],
      ['Pnr Thagada Franky', 1, 4500],
      ['Veg Sezwan Noodles', 1, 4500],
    ]);
    expect(p.detectedTotalPaise).toBe(12000);
    expect(p.computedTotalPaise).toBe(12000);
    expect(validateParsed(p).status).toBe('ok');
  });

  it('handles Bill 3 Restaurant ₹172 receipt with multi-line items and header noise pruning', () => {
    const text = `Cy
Fd     v
Wo py  g
SRRHLAPT 1) 1) 1031.1
J             SERVICE PUT. LTD
              DATE: 25/04/26
IPN): 138   THE: 100: 32: 26
tM QlY   PRICE  HHOUN |
=      SFRIR CHI. MASALA
|     50.00 50.00
CHI TIKKA MASALA
1     50.00 50.00
ONION PARATHA
\\                4     18.00 72.00
5             ITEM: 3 /QTY: 6
GRAND TOTAL + ¥    172.00
THANK YOU ENJOY YOUR FOOD`;
    // Line 8 has low OCR confidence on "SFRIR", triggering CHECK status
    const p = parseReceipt(fromPlainText(text, 0.9, { 8: 0.2 }));
    expect(p.items.map((i) => [i.name, i.quantity, i.totalPaise])).toEqual([
      ['Sfrir Chi. Masala', 1, 5000],
      ['Chi Tikka Masala', 1, 5000],
      ['Onion Paratha', 4, 7200],
    ]);
    expect(p.detectedTotalPaise).toBe(17200);
    expect(p.computedTotalPaise).toBe(17200);
    expect(p.items[0].status).toBe('CHECK');
    expect(p.items[1].status).toBe('VERIFIED');
    expect(p.items[2].status).toBe('VERIFIED');
    expect(p.itemQtyChecksum?.verified).toBe(true);
    expect(p.itemQtyChecksum?.printedItems).toBe(3);
    expect(p.itemQtyChecksum?.printedQty).toBe(6);
    expect(p.receiptStatus).toBe('CHECK');
    expect(validateParsed(p).status).toBe('ok');
  });
});

describe('validateTotals', () => {
  const base = {
    itemTotalsPaise: [40000, 40000],
    taxPaise: 4000,
    serviceChargePaise: 0,
    discountPaise: 0,
  };
  it('reports the difference when numbers do not add up', () => {
    const v = validateTotals({ ...base, statedTotalPaise: 90000 });
    expect(v.status).toBe('mismatch');
    expect(v.diffPaise).toBe(6000);
  });
  it('treats < ₹1 as rounding', () =>
    expect(validateTotals({ ...base, statedTotalPaise: 84040 }).status).toBe('rounding'));
});
