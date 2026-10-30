import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { parseReceipt } from './receiptParser';
import { validateParsed } from './receiptValidation';

describe('Pipeline v2 Dual-Proof Architecture Integration', () => {
  it('Bill 1: IIT Bombay Canteen ₹75 with Auto-Vocab Repair and Amount Check', () => {
    const raw = JSON.parse(fs.readFileSync('test/bill_1_canteen_75_output.json', 'utf8'));
    const ocr = raw.pipelineOutput.ocr;
    const parsed = parseReceipt(ocr);

    // Repaired words via fuzzy vocabulary
    expect(parsed.items[0].name).toBe('Veg Cheese Franky');
    expect(parsed.items[0].repairedFrom).toBe('Veg Cheese Frarky');
    expect(parsed.items[1].name).toBe('Veg Sezwan Rice');

    // Totals balance
    expect(parsed.detectedTotalPaise).toBe(7500);
    expect(parsed.computedTotalPaise).toBe(7500);
    expect(validateParsed(parsed).status).toBe('ok');

    // Item 2 amount was repaired (8 -> 45), so it requires confirmation glance
    expect(parsed.items[0].status).toBe('VERIFIED');
    expect(parsed.items[1].status).toBe('CHECK');
    expect(parsed.receiptStatus).toBe('CHECK');
  });

  it('Bill 2: IIT Bombay Canteen ₹120 with Deletion Candidate Repair (1220 -> 120)', () => {
    const raw = JSON.parse(fs.readFileSync('test/bill_2_canteen_120_output.json', 'utf8'));
    const ocr = raw.pipelineOutput.ocr;
    const parsed = parseReceipt(ocr);

    expect(parsed.items.map((i) => [i.name, i.quantity, i.totalPaise])).toEqual([
      ['Veg Cheese Franky', 1, 3000],
      ['Pnr Thagada Franky', 1, 4500],
      ['Veg Sezwan Noodles', 1, 4500],
    ]);

    expect(parsed.detectedTotalPaise).toBe(12000);
    expect(parsed.computedTotalPaise).toBe(12000);
    expect(parsed.items.every((i) => i.status === 'VERIFIED')).toBe(true);
    expect(parsed.receiptStatus).toBe('VERIFIED');
    expect(validateParsed(parsed).status).toBe('ok');
  });

  it('Bill 3: Restaurant ₹172 with Text Proof Flagging on Swrir and Item/Qty Checksum', () => {
    const raw = JSON.parse(fs.readFileSync('test/bill_3_masala_paratha_172_output.json', 'utf8'));
    const ocr = raw.pipelineOutput.ocr;
    const parsed = parseReceipt(ocr);

    expect(parsed.items.map((i) => [i.name, i.quantity, i.totalPaise])).toEqual([
      ['Swrir Chi. Masala', 1, 5000],
      ['Chi Tikka Masala', 1, 5000],
      ['Onion Paratha', 4, 7200],
    ]);

    expect(parsed.detectedTotalPaise).toBe(17200);
    expect(parsed.computedTotalPaise).toBe(17200);

    // Number Proof: arithmetic verified
    expect(parsed.items.every((i) => i.numberProof)).toBe(true);

    // Text Proof: "Swrir" is unproven with low confidence, so item 1 is CHECK
    expect(parsed.items[0].textProof).toBe(false);
    expect(parsed.items[0].status).toBe('CHECK');
    expect(parsed.items[0].statusReason).toContain('Swrir');

    // Items 2 and 3 are proven in vocabulary
    expect(parsed.items[1].status).toBe('VERIFIED');
    expect(parsed.items[2].status).toBe('VERIFIED');

    // Item/Qty Checksum matches printed "ITEM: 3 /QTY: 6"
    expect(parsed.itemQtyChecksum?.verified).toBe(true);
    expect(parsed.itemQtyChecksum?.printedItems).toBe(3);
    expect(parsed.itemQtyChecksum?.printedQty).toBe(6);

    // Overall Receipt Status is CHECK because of Swrir
    expect(parsed.receiptStatus).toBe('CHECK');
    expect(validateParsed(parsed).status).toBe('ok');
  });
});
