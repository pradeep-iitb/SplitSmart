/**
 * Total validation (PS point 5). Pure: call it again after every user edit in the review table.
 */
import type { Money, ParsedReceipt } from '../types/receipt';

export interface TotalsInput {
  itemTotalsPaise: Money[];
  taxPaise: Money; // pass 0 if tax is already included in item prices
  serviceChargePaise: Money;
  discountPaise: Money;
  roundOffPaise?: Money;
  statedTotalPaise: Money | null; // the total printed on the receipt (or the user-edited one); null if none
}

export type ValidationStatus = 'ok' | 'rounding' | 'mismatch' | 'unconfirmed';

export interface ValidationResult {
  status: ValidationStatus;
  itemsSumPaise: Money;
  expectedPaise: Money; // items + tax + service - discount + roundOff
  statedTotalPaise: Money | null;
  diffPaise: Money; // stated - expected  (+ => receipt says more than we parsed; - => we parsed too much)
  message: string;
}

export const formatRupees = (paise: Money) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

export function validateTotals(i: TotalsInput, tolerancePaise = 100): ValidationResult {
  const itemsSum = i.itemTotalsPaise.reduce((s, x) => s + x, 0);
  const expected =
    itemsSum + i.taxPaise + i.serviceChargePaise - i.discountPaise + (i.roundOffPaise ?? 0);

  if (i.statedTotalPaise === null) {
    return {
      status: 'unconfirmed',
      itemsSumPaise: itemsSum,
      expectedPaise: expected,
      statedTotalPaise: null,
      diffPaise: 0,
      message: `No total was printed. We calculated ${formatRupees(expected)} from the items — please confirm.`,
    };
  }
  const diff = i.statedTotalPaise - expected;
  const abs = Math.abs(diff);
  const base = {
    itemsSumPaise: itemsSum,
    expectedPaise: expected,
    statedTotalPaise: i.statedTotalPaise,
    diffPaise: diff,
  };

  if (diff === 0)
    return {
      ...base,
      status: 'ok',
      message: `Items and charges add up to the receipt total (${formatRupees(expected)}).`,
    };
  if (abs < tolerancePaise)
    return {
      ...base,
      status: 'rounding',
      message: `Off by ${formatRupees(abs)} — looks like rounding.`,
    };
  return {
    ...base,
    status: 'mismatch',
    message:
      `Items + tax + charges come to ${formatRupees(expected)} but the receipt total is ${formatRupees(i.statedTotalPaise)} ` +
      `(${formatRupees(abs)} ${diff > 0 ? 'missing' : 'extra'}). Check the highlighted prices.`,
  };
}

export function validateParsed(p: ParsedReceipt, tolerancePaise = 100): ValidationResult {
  return validateTotals(
    {
      itemTotalsPaise: p.items.map((i) => i.totalPaise),
      taxPaise: p.taxIncluded ? 0 : p.taxPaise,
      serviceChargePaise: p.serviceChargePaise,
      discountPaise: p.discountPaise,
      roundOffPaise: p.roundOffPaise,
      statedTotalPaise: p.detectedTotalPaise,
    },
    tolerancePaise
  );
}
