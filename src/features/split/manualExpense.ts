import type { Expense, ID } from '../../types/domain';
import { calculateExpenseShares } from './splitEngine';
import type { ManualExpenseDraft } from './types';
import { validateManualExpense } from './validation';

/**
 * Creates a fully validated, immutable Expense entity from a manual expense draft (PS Point 6).
 *
 * Guarantees domain invariants:
 * 1. Single valid payer
 * 2. Sum of memberShares strictly equals amountPaise
 * 3. Rounding reconciled to 1 paisa
 * 4. Safe crypto ID and ISO 8601 timestamps
 */
export function createManualExpense(
  draft: ManualExpenseDraft,
  groupMemberIds: ID[]
): Expense {
  const issues = validateManualExpense(draft, groupMemberIds);
  const errors = issues.filter((i) => i.severity === 'error');

  if (errors.length > 0) {
    const errorDetails = errors.map((e) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Failed to create manual expense: ${errorDetails}`);
  }

  // Calculate authoritative member shares
  const memberShares = calculateExpenseShares({
    totalPaise: draft.amountPaise,
    splitMode: draft.splitMode,
    participantIds: draft.participantIds,
    exactAmounts: draft.exactAmounts,
    percentagesBasisPoints: draft.percentagesBasisPoints,
    sharesWeights: draft.sharesWeights,
  });

  // Verify invariant: sum(memberShares) === amountPaise
  const calculatedSum = memberShares.reduce((acc, s) => acc + s.amountPaise, 0);
  if (calculatedSum !== draft.amountPaise) {
    throw new Error(
      `Financial invariant violation: shares sum (${calculatedSum}) does not equal total amount (${draft.amountPaise})`
    );
  }

  const expenseId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `exp-manual-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return {
    id: expenseId,
    groupId: draft.groupId,
    description: draft.description.trim(),
    date: draft.date,
    payerId: draft.payerId,
    amountPaise: draft.amountPaise,
    splitMode: draft.splitMode,
    memberShares,
    items: [],
    taxLines: [],
    serviceChargePaise: 0,
    discountPaise: 0,
    createdAt: new Date().toISOString(),
  };
}
