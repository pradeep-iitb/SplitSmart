import type { ID } from '../../types/domain';
import type { ManualExpenseDraft, SplitInput, ValidationIssue } from './types';

/**
 * Validates a SplitInput configuration according to domain invariants.
 * Returns an array of ValidationIssue objects with code, severity, and message.
 */
export function validateSplitInput(input: SplitInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. Validate totalPaise
  if (typeof input.totalPaise !== 'number' || isNaN(input.totalPaise)) {
    issues.push({
      field: 'totalPaise',
      code: 'INVALID_TOTAL',
      severity: 'error',
      message: 'Total amount must be a valid number.',
    });
  } else if (input.totalPaise < 0) {
    issues.push({
      field: 'totalPaise',
      code: 'NEGATIVE_TOTAL',
      severity: 'error',
      message: 'Total amount cannot be negative.',
    });
  } else if (!Number.isInteger(input.totalPaise)) {
    issues.push({
      field: 'totalPaise',
      code: 'NON_INTEGER_PAISE',
      severity: 'error',
      message: 'Total amount must be an integer number of paise.',
    });
  }

  // 2. Validate participants
  if (!input.participantIds || input.participantIds.length === 0) {
    issues.push({
      field: 'participantIds',
      code: 'EMPTY_PARTICIPANTS',
      severity: 'error',
      message: 'At least one participant must be selected for the expense.',
    });
    return issues; // Cannot perform mode-specific checks without participants
  }

  const uniqueParticipants = new Set(input.participantIds);
  if (uniqueParticipants.size !== input.participantIds.length) {
    issues.push({
      field: 'participantIds',
      code: 'DUPLICATE_PARTICIPANTS',
      severity: 'warning',
      message: 'Duplicate participant IDs detected in split input.',
    });
  }

  // 3. Mode-specific validations
  switch (input.splitMode) {
    case 'exact': {
      const exacts = input.exactAmounts ?? {};
      let sumExact = 0;

      for (const id of input.participantIds) {
        const val = exacts[id];
        if (typeof val !== 'number' || isNaN(val) || val < 0) {
          issues.push({
            field: `exactAmounts.${id}`,
            code: 'INVALID_EXACT_AMOUNT',
            severity: 'error',
            message: `Exact amount for participant ${id} must be a non-negative integer.`,
          });
        } else {
          sumExact += Math.round(val);
        }
      }

      if (sumExact !== input.totalPaise) {
        const diff = input.totalPaise - sumExact;
        issues.push({
          field: 'exactAmounts',
          code: 'EXACT_SUM_MISMATCH',
          severity: 'error',
          message: `Exact shares sum to ₹${(sumExact / 100).toFixed(2)}, which does not match total ₹${(input.totalPaise / 100).toFixed(2)} (difference: ${diff > 0 ? '+' : ''}₹${(diff / 100).toFixed(2)}).`,
        });
      }
      break;
    }

    case 'percentage': {
      const bps = input.percentagesBasisPoints ?? {};
      let sumBps = 0;

      for (const id of input.participantIds) {
        const val = bps[id] ?? 0;
        if (typeof val !== 'number' || isNaN(val) || val < 0) {
          issues.push({
            field: `percentagesBasisPoints.${id}`,
            code: 'INVALID_PERCENTAGE',
            severity: 'error',
            message: `Percentage for participant ${id} must be non-negative.`,
          });
        } else {
          sumBps += Math.round(val);
        }
      }

      // Check whether percentages are in basis points (10000 = 100%) or standard percentages (100)
      const isBasisPoints = sumBps > 150 || Object.values(bps).some((v) => v > 100);
      const targetSum = isBasisPoints ? 10000 : 100;

      if (sumBps !== targetSum) {
        const currentPct = isBasisPoints ? sumBps / 100 : sumBps;
        issues.push({
          field: 'percentagesBasisPoints',
          code: 'PERCENTAGE_SUM_MISMATCH',
          severity: 'error',
          message: `Percentages sum to ${currentPct.toFixed(2)}%, but must equal 100.00%.`,
        });
      }
      break;
    }

    case 'shares': {
      const weights = input.sharesWeights ?? {};
      let totalWeight = 0;

      for (const id of input.participantIds) {
        const w = weights[id] ?? 0;
        if (typeof w !== 'number' || isNaN(w) || w < 0) {
          issues.push({
            field: `sharesWeights.${id}`,
            code: 'INVALID_WEIGHT',
            severity: 'error',
            message: `Weight for participant ${id} must be a non-negative integer.`,
          });
        } else {
          totalWeight += Math.floor(w);
        }
      }

      if (totalWeight <= 0) {
        issues.push({
          field: 'sharesWeights',
          code: 'ZERO_TOTAL_WEIGHT',
          severity: 'error',
          message: 'At least one participant must have a positive weight ratio.',
        });
      }
      break;
    }

    case 'itemized': {
      const items = input.items ?? [];
      if (items.length === 0) {
        issues.push({
          field: 'items',
          code: 'NO_ITEMS_IN_ITEMIZED',
          severity: 'warning',
          message:
            'Itemized mode selected but no items are defined. Split will fall back to equal.',
        });
      } else {
        // Check for unassigned items
        for (const item of items) {
          const validAssignees = item.assignedMemberIds.filter((id) =>
            input.participantIds.includes(id)
          );
          if (validAssignees.length === 0) {
            issues.push({
              field: `items.${item.id}.assignedMemberIds`,
              code: 'UNASSIGNED_ITEM',
              severity: 'warning',
              message: `Item "${item.name}" has no assigned participants.`,
            });
          }
        }

        // Check if items total + taxes + serviceCharge - discount matches totalPaise
        const itemsTotal = items.reduce((sum, it) => sum + Math.round(it.lineTotalPaise), 0);
        const taxTotal = (input.taxLines ?? []).reduce(
          (sum, t) => sum + Math.round(t.amountPaise),
          0
        );
        const scTotal = Math.max(0, Math.round(input.serviceChargePaise ?? 0));
        const discTotal = Math.max(0, Math.round(input.discountPaise ?? 0));

        const computedBillTotal = itemsTotal + taxTotal + scTotal - discTotal;

        if (input.totalPaise > 0 && computedBillTotal !== input.totalPaise) {
          const diff = input.totalPaise - computedBillTotal;
          issues.push({
            field: 'items',
            code: 'ITEMIZED_TOTAL_MISMATCH',
            severity: 'warning',
            message: `Sum of items + taxes - discount (₹${(computedBillTotal / 100).toFixed(2)}) differs from total (₹${(input.totalPaise / 100).toFixed(2)}) by ₹${(diff / 100).toFixed(2)}.`,
          });
        }
      }
      break;
    }

    case 'equal':
    default:
      // Equal split is inherently valid as long as participants and totalPaise are valid
      break;
  }

  return issues;
}

/**
 * Validates a manual expense draft before creation (PS Point 6).
 */
export function validateManualExpense(
  draft: ManualExpenseDraft,
  groupMemberIds: ID[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Description
  if (!draft.description || draft.description.trim().length === 0) {
    issues.push({
      field: 'description',
      code: 'EMPTY_DESCRIPTION',
      severity: 'error',
      message: 'Description cannot be empty.',
    });
  }

  // Amount
  if (typeof draft.amountPaise !== 'number' || isNaN(draft.amountPaise) || draft.amountPaise <= 0) {
    issues.push({
      field: 'amountPaise',
      code: 'INVALID_AMOUNT',
      severity: 'error',
      message: 'Amount must be greater than ₹0.00.',
    });
  }

  // Payer
  if (!draft.payerId || !groupMemberIds.includes(draft.payerId)) {
    issues.push({
      field: 'payerId',
      code: 'INVALID_PAYER',
      severity: 'error',
      message: 'Selected payer is not a valid member of this group.',
    });
  }

  // Date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!draft.date || !dateRegex.test(draft.date)) {
    issues.push({
      field: 'date',
      code: 'INVALID_DATE',
      severity: 'error',
      message: 'Date must be in YYYY-MM-DD format.',
    });
  }

  // Participants
  if (!draft.participantIds || draft.participantIds.length === 0) {
    issues.push({
      field: 'participantIds',
      code: 'NO_PARTICIPANTS',
      severity: 'error',
      message: 'Select at least one participant for the expense.',
    });
  } else {
    for (const pid of draft.participantIds) {
      if (!groupMemberIds.includes(pid)) {
        issues.push({
          field: 'participantIds',
          code: 'UNKNOWN_PARTICIPANT',
          severity: 'error',
          message: `Participant ${pid} is not a member of this group.`,
        });
      }
    }
  }

  // Split-specific input validation
  const splitIssues = validateSplitInput({
    totalPaise: draft.amountPaise,
    splitMode: draft.splitMode,
    participantIds: draft.participantIds,
    exactAmounts: draft.exactAmounts,
    percentagesBasisPoints: draft.percentagesBasisPoints,
    sharesWeights: draft.sharesWeights,
  });

  return [...issues, ...splitIssues];
}
