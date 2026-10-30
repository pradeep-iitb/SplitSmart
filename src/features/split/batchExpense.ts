import type { Expense, ReceiptItem } from '../../types/domain';
import { reconcileRounding } from './rounding';
import { calculateExpenseShares } from './splitEngine';

interface BillDraft {
  billId: string;
  billIndex: number;
  billName: string;
  payerId: string;
  items: ReceiptItem[];
}

interface BatchInput {
  bills: BillDraft[];
  groupId: string;
  date: string;
  description: string;
  memberIds: string[];
  taxLines: Array<{ label: string; amountPaise: number }>;
  serviceChargePaise: number;
  discountPaise: number;
  confirmedTotalPaise: number;
  batchId: string;
}

/** Save each receipt as its own expense so each payer gets the correct balance. */
export function buildBatchExpenses(input: BatchInput): Expense[] {
  const { bills } = input;
  if (!bills.length || !input.memberIds.length) throw new Error('Add a bill and group members.');
  if (bills.some((bill) => !bill.items.length || !input.memberIds.includes(bill.payerId))) {
    throw new Error('Each bill needs items and a payer from this group.');
  }
  if (bills.some((bill) => bill.items.some((item) => !item.assignedMemberIds.length))) {
    throw new Error('Assign every item before saving.');
  }

  const ids = bills.map((bill) => bill.billId);
  const subtotals = bills.map((bill) =>
    bill.items.reduce((sum, item) => sum + item.lineTotalPaise, 0)
  );
  const distributedTaxLines = bills.map(() => [] as BatchInput['taxLines']);
  for (const taxLine of input.taxLines) {
    const sourceIndex = bills.findIndex((bill) => taxLine.label.endsWith(`(${bill.billName})`));
    const allocations =
      sourceIndex >= 0
        ? bills.map((_, index) => (index === sourceIndex ? taxLine.amountPaise : 0))
        : reconcileRounding(subtotals, taxLine.amountPaise, ids);
    allocations.forEach((amountPaise, index) => {
      if (amountPaise) distributedTaxLines[index].push({ ...taxLine, amountPaise });
    });
  }
  const service = reconcileRounding(subtotals, input.serviceChargePaise, ids);
  const discount = reconcileRounding(subtotals, input.discountPaise, ids);
  const calculatedTotal =
    subtotals.reduce((sum, value) => sum + value, 0) +
    input.taxLines.reduce((sum, line) => sum + line.amountPaise, 0) +
    input.serviceChargePaise -
    input.discountPaise;
  const difference = input.confirmedTotalPaise - calculatedTotal;
  const adjustment = reconcileRounding(subtotals, Math.abs(difference), ids).map((value) =>
    difference < 0 ? -value : value
  );

  return bills.map((bill, index) => {
    const tax = distributedTaxLines[index].reduce((sum, line) => sum + line.amountPaise, 0);
    const amountPaise =
      subtotals[index] + tax + service[index] - discount[index] + adjustment[index];
    if (amountPaise <= 0) throw new Error(`${bill.billName} must have a positive total.`);
    const memberShares = calculateExpenseShares({
      totalPaise: amountPaise,
      splitMode: 'itemized',
      participantIds: input.memberIds,
      items: bill.items,
      taxLines: distributedTaxLines[index],
      serviceChargePaise: service[index],
      discountPaise: discount[index],
    });
    return {
      id: `${input.batchId}-${index}`,
      groupId: input.groupId,
      description: `${input.description} · ${bill.billName}`,
      date: input.date,
      payerId: bill.payerId,
      amountPaise,
      splitMode: 'itemized',
      memberShares,
      items: bill.items,
      taxLines: distributedTaxLines[index],
      serviceChargePaise: service[index],
      discountPaise: discount[index],
      createdAt: new Date().toISOString(),
    };
  });
}
