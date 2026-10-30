/** Mock OCR data so the UI (Member 1) and split engine (Member 3) can progress before real OCR is wired in. */
import type { OcrResult } from '../types/receipt';

export function fromPlainText(
  text: string,
  confidence = 0.95,
  lineConfidence: Record<number, number> = {}
): OcrResult {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const conf = lineConfidence[i] ?? confidence;
      let x = 0;
      const words = l.split(/\s+/).map((w) => {
        const bbox = { x0: x, y0: i * 30, x1: x + w.length * 10, y1: i * 30 + 24 };
        x += w.length * 10 + 10;
        return { text: w, confidence: conf, bbox };
      });
      return {
        text: l,
        confidence: conf,
        bbox: { x0: 0, y0: i * 30, x1: x, y1: i * 30 + 24 },
        words,
      };
    });
  return {
    text,
    confidence,
    lines,
    width: 600,
    height: lines.length * 30 + 20,
    rotation: 0,
    preprocess: 'gray',
  };
}

export const MOCK_RECEIPT_TEXT = {
  // Test case 1: clear restaurant bill with CGST/SGST (the PS's ₹840 example)
  restaurant: `NIGHT BITES CAFE
Shop 12, Hostel Road, Powai, Mumbai 400076
GSTIN: 27ABCDE1234F1Z5
Ph: 9876543210
Bill No: 1042   Date: 24/10/2026
Table 4
Item   Qty   Rate   Amount
Large Pizza   1   400.00   400.00
Maggi   4   60.00   240.00
Cold Coffee   1   160.00   160.00
Sub Total   800.00
CGST @2.5%   20.00
SGST @2.5%   20.00
Grand Total   840.00
Cash   1000.00
Change   160.00
Thank you! Visit again`,

  // Test case 5: canteen slip, integer prices, no printed total
  canteenNoTotal: `IIT CANTEEN
Samosa 2 x 15 30
Tea 3 x 10 30
Veg Roll 1 x 50 50
Cold Coffee 40`,

  // Service charge + discount + GST
  serviceAndDiscount: `The Hostel Kitchen
Pasta 250.00
Mocktail 150.00
Sub Total 400.00
Service Charge 10% 40.00
Discount (20.00)
CGST 2.5% 11.00
SGST 2.5% 11.00
Net Amount 442.00`,

  // Tax already inside the prices (MRP-inclusive)
  taxInclusive: `FRESH MART
Milk 1L 2 x 30.00 60.00
Bread 45.00
Eggs (6) 72.00
Total Items: 3
Total 177.00
GST included 8.43`,

  // Name on one line, numbers on the next
  wrapped: `SNACK SHACK
Paneer Tikka Roll
2 x 90.00 180.00
Lime Soda 40.00
Total 220.00`,

  // Test case 4: non-receipt (e.g. a selfie)
  notAReceipt: `IMG 2045
a smiling face
xx`,
};
