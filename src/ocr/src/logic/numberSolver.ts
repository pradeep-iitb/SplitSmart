/**
 * Number Solver & Gap Resolver (Pipeline v2 - Stage 5 & 5b)
 *
 * Implements arithmetic candidate generation, printed item/qty checksums,
 * deletion candidate scoring, and basis-point tax/roundoff gap resolution.
 */
import type { Money } from '../types/receipt';

export interface InferredCharge {
  kind: 'tax_inferred' | 'roundoff';
  pct?: number; // e.g. 5, 12, 18, 2.5
  paise: Money; // signed or positive
  needsConfirm: boolean; // true -> UI flags with warning badge for user tap
  label: string;
}

export interface ItemQtyChecksum {
  printedItems?: number;
  actualItems: number;
  printedQty?: number;
  actualQty: number;
  verified: boolean;
  message?: string;
}

/**
 * Resolves mathematical discrepancies between computed item sum and printed total.
 * Checks for:
 * 1. Zero delta (exact balance)
 * 2. Standard round-off (<= 100 paise = ₹1.00)
 * 3. Standard Indian GST basis points: 250 (2.5%), 500 (5%), 1200 (12%), 1800 (18%)
 */
export function resolveGap(
  itemsSumPaise: Money,
  totalPaise: Money
): InferredCharge[] | 'unresolved' {
  const gap = totalPaise - itemsSumPaise;
  if (gap === 0) return [];

  // 1. Sub-rupee round-off
  if (Math.abs(gap) <= 100) {
    return [
      {
        kind: 'roundoff',
        paise: gap,
        needsConfirm: false,
        label: gap > 0 ? '+Round-off' : '-Round-off',
      },
    ];
  }

  // 2. Standard GST basis points
  // 250 = 2.5% (e.g. single CGST/SGST), 500 = 5% (canteen/restaurant composite GST), 1200 = 12%, 1800 = 18%
  const GST_BPS = [250, 500, 1200, 1800];
  for (const bps of GST_BPS) {
    const expectedTax = Math.round((itemsSumPaise * bps) / 10000);
    if (Math.abs(gap - expectedTax) <= 2) {
      // within 2 paise tolerance for fractional rounding
      return [
        {
          kind: 'tax_inferred',
          pct: bps / 100,
          paise: gap,
          needsConfirm: true,
          label: `Inferred GST (${bps / 100}%)`,
        },
      ];
    }
  }

  return 'unresolved';
}

/**
 * Generates deletion and confusion repair candidates for OCR numbers.
 * E.g., for Bill 2 "1220" -> ["1220", "120", "220", "122"].
 */
export function generateNumericCandidates(raw: string): number[] {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return [];

  const candidates = new Set<number>();

  // Direct parse
  const direct = parseCandidatePaise(cleaned);
  if (direct !== null) candidates.add(direct);

  // Single-digit deletions (handles duplicated digits like 1220 -> 120)
  const digitsOnly = cleaned.replace(/[.,]/g, '');
  if (digitsOnly.length >= 3 && digitsOnly.length <= 6) {
    for (let i = 0; i < digitsOnly.length; i++) {
      const deleted = digitsOnly.slice(0, i) + digitsOnly.slice(i + 1);
      const parsed = parseInt(deleted, 10) * 100;
      if (parsed > 0) candidates.add(parsed);
    }
  }

  return Array.from(candidates);
}

function parseCandidatePaise(str: string): number | null {
  const dec = str.match(/^(\d+)[.,](\d{1,2})$/);
  if (dec) {
    const intPart = parseInt(dec[1], 10);
    const fracPart = parseInt(dec[2].padEnd(2, '0'), 10);
    return intPart * 100 + fracPart;
  }
  const intVal = parseInt(str.replace(/[.,]/g, ''), 10);
  if (isNaN(intVal)) return null;
  // If no decimal separator was present and value is 2-4 digits, treat as rupees
  return intVal * 100;
}

/**
 * Extracts and verifies receipt printed item/qty checksum lines like:
 * "ITEM: 3 /QTY: 6" or "TOTAL ITEMS: 3"
 */
export function extractItemQtyChecksum(
  lines: string[],
  actualItemsCount: number,
  actualTotalQty: number
): ItemQtyChecksum | null {
  let printedItems: number | undefined;
  let printedQty: number | undefined;

  for (const line of lines) {
    // Matches "ITEM: 3 /QTY: 6" or "ITEM: 3 QTY: 6" or "ITEMS:3/QTY:6"
    const dualMatch = line.match(/\bITEMS?\s*:\s*(\d+)\s*(?:[/|,]|\s+)\s*Q(?:T|I)Y\s*:\s*(\d+)\b/i);
    if (dualMatch) {
      printedItems = parseInt(dualMatch[1], 10);
      printedQty = parseInt(dualMatch[2], 10);
      break;
    }

    // Matches individual "ITEM: 3" or "TOTAL ITEMS: 3"
    const itemMatch = line.match(/\b(?:TOTAL\s*)?ITEMS?\s*:\s*(\d+)\b/i);
    if (itemMatch && printedItems === undefined) {
      printedItems = parseInt(itemMatch[1], 10);
    }

    // Matches individual "QTY: 6" or "TOTAL QTY: 6"
    const qtyMatch = line.match(/\b(?:TOTAL\s*)?Q(?:T|I)Y\s*:\s*(\d+)\b/i);
    if (qtyMatch && printedQty === undefined) {
      printedQty = parseInt(qtyMatch[1], 10);
    }
  }

  if (printedItems === undefined && printedQty === undefined) {
    return null;
  }

  const itemsVerified = printedItems === undefined || printedItems === actualItemsCount;
  const qtyVerified = printedQty === undefined || printedQty === actualTotalQty;
  const verified = itemsVerified && qtyVerified;

  let message: string;
  if (verified) {
    const parts: string[] = [];
    if (printedItems !== undefined) parts.push(`${printedItems} Items`);
    if (printedQty !== undefined) parts.push(`${printedQty} Total Qty`);
    message = `${parts.join(', ')} Checksum Verified ✓`;
  } else {
    message = `Checksum Alert: Printed (${printedItems ?? '?'} items, ${printedQty ?? '?'} qty) != Parsed (${actualItemsCount} items, ${actualTotalQty} qty)`;
  }

  return {
    printedItems,
    actualItems: actualItemsCount,
    printedQty,
    actualQty: actualTotalQty,
    verified,
    message,
  };
}
