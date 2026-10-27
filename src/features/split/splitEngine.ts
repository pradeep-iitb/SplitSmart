import type { ID, MemberShare, Paise } from '../../types/domain';
import { distributeEvenly, reconcileRounding } from './rounding';
import type {
  ItemizedMemberBreakdown,
  ItemizedSplitResult,
  SplitInput,
} from './types';

/**
 * Calculates exact member shares for an expense across all split modes:
 * - 'equal': Even distribution with deterministic odd-paisa allocation
 * - 'exact': Validated user-specified exact paise amounts
 * - 'percentage': Basis-point or percentage allocation with Hamilton-Hare rounding
 * - 'shares': Ratio-based integer weights with Hamilton-Hare rounding
 * - 'itemized': Individual line items split among assignees, plus proportional
 *               distribution of taxes, service charges, and discounts.
 *
 * Guarantees Invariant: Sum of all member shares === input.totalPaise.
 */
export function calculateExpenseShares(input: SplitInput): MemberShare[] {
  const { totalPaise, splitMode, participantIds } = input;

  if (!participantIds || participantIds.length === 0) {
    return [];
  }

  // Handle zero total edge case
  if (totalPaise === 0) {
    return participantIds.map((id) => ({
      memberId: id,
      amountPaise: 0,
    }));
  }

  switch (splitMode) {
    case 'equal':
      return calculateEqualShares(totalPaise, participantIds);

    case 'exact':
      return calculateExactShares(
        totalPaise,
        participantIds,
        input.exactAmounts ?? {}
      );

    case 'percentage':
      return calculatePercentageShares(
        totalPaise,
        participantIds,
        input.percentagesBasisPoints ?? {}
      );

    case 'shares':
      return calculateRatioShares(
        totalPaise,
        participantIds,
        input.sharesWeights ?? {}
      );

    case 'itemized':
      return calculateItemizedShares(input);

    default:
      return calculateEqualShares(totalPaise, participantIds);
  }
}

/**
 * Equal Split: Splits total evenly, distributing odd paise by ascending stable ID.
 */
function calculateEqualShares(
  totalPaise: Paise,
  participantIds: ID[]
): MemberShare[] {
  const weights = new Array(participantIds.length).fill(1);
  const allocations = reconcileRounding(weights, totalPaise, participantIds);

  return participantIds.map((memberId, idx) => ({
    memberId,
    amountPaise: allocations[idx],
  }));
}

/**
 * Exact Split: Uses provided exact amounts.
 * If exact amounts sum does not match totalPaise, deterministically reconciles difference.
 */
function calculateExactShares(
  totalPaise: Paise,
  participantIds: ID[],
  exactAmounts: Record<ID, Paise>
): MemberShare[] {
  const rawAmounts = participantIds.map((id) =>
    Math.max(0, Math.round(exactAmounts[id] ?? 0))
  );
  const currentSum = rawAmounts.reduce((a, b) => a + b, 0);

  if (currentSum === totalPaise) {
    return participantIds.map((memberId, idx) => ({
      memberId,
      amountPaise: rawAmounts[idx],
    }));
  }

  // If there is a small discrepancy, use reconcileRounding with current amounts as weights
  const weights = rawAmounts.some((amt) => amt > 0)
    ? rawAmounts
    : new Array(participantIds.length).fill(1);

  const allocations = reconcileRounding(weights, totalPaise, participantIds);
  return participantIds.map((memberId, idx) => ({
    memberId,
    amountPaise: allocations[idx],
  }));
}

/**
 * Percentage Split: Based on basis points (10000 = 100.00%) or raw percentages.
 */
function calculatePercentageShares(
  totalPaise: Paise,
  participantIds: ID[],
  basisPointsMap: Record<ID, number>
): MemberShare[] {
  const weights = participantIds.map((id) =>
    Math.max(0, basisPointsMap[id] ?? 0)
  );
  const allocations = reconcileRounding(weights, totalPaise, participantIds);

  return participantIds.map((memberId, idx) => ({
    memberId,
    amountPaise: allocations[idx],
  }));
}

/**
 * Shares (Ratio) Split: Based on positive integer weights (e.g., 2:1:1).
 */
function calculateRatioShares(
  totalPaise: Paise,
  participantIds: ID[],
  weightsMap: Record<ID, number>
): MemberShare[] {
  const weights = participantIds.map((id) => Math.max(0, weightsMap[id] ?? 1));
  const allocations = reconcileRounding(weights, totalPaise, participantIds);

  return participantIds.map((memberId, idx) => ({
    memberId,
    amountPaise: allocations[idx],
  }));
}

/**
 * Itemized Split:
 * 1. Splits each line item among its assigned members (equal share + odd remainder by ascending ID).
 * 2. Sums each member's item subtotal.
 * 3. Distributes tax lines, service charges, and discounts proportionally to member subtotals.
 * 4. Ensures sum of member shares equals confirmed totalPaise.
 */
export function calculateItemizedShares(input: SplitInput): MemberShare[] {
  const detailed = calculateDetailedItemizedSplit(input);
  return detailed.memberShares;
}

/**
 * Detailed Itemized Split Calculator:
 * Returns full breakdown per member for item subtotals, taxes, service charges, and discounts.
 */
export function calculateDetailedItemizedSplit(
  input: SplitInput
): ItemizedSplitResult {
  const {
    participantIds,
    items = [],
    taxLines = [],
    serviceChargePaise = 0,
    discountPaise = 0,
    totalPaise,
  } = input;

  const memberItemSubtotalMap = new Map<ID, Paise>();
  const memberAssignedCountMap = new Map<ID, number>();

  for (const id of participantIds) {
    memberItemSubtotalMap.set(id, 0);
    memberAssignedCountMap.set(id, 0);
  }

  // 1. Process line items
  for (const item of items) {
    const assignees = item.assignedMemberIds.filter((id) =>
      participantIds.includes(id)
    );

    // If an item has no valid assignees among participants, treat it as shared by all participants
    const activeAssignees =
      assignees.length > 0 ? assignees : [...participantIds];

    const itemTotal = Math.round(item.lineTotalPaise);
    const itemSplit = distributeEvenly(itemTotal, activeAssignees);

    for (const [memberId, share] of Object.entries(itemSplit)) {
      const curSub = memberItemSubtotalMap.get(memberId) ?? 0;
      memberItemSubtotalMap.set(memberId, curSub + share);

      const curCount = memberAssignedCountMap.get(memberId) ?? 0;
      memberAssignedCountMap.set(memberId, curCount + 1);
    }
  }

  const rawSubtotals = participantIds.map(
    (id) => memberItemSubtotalMap.get(id) ?? 0
  );
  const sumSubtotals = rawSubtotals.reduce((a, b) => a + b, 0);

  // 2. Proportional Tax Lines
  const totalTaxPaise = taxLines.reduce(
    (acc, t) => acc + Math.round(t.amountPaise),
    0
  );

  // Weights for proportional distribution: member subtotals
  // If sumSubtotals === 0, distribute equally
  const proportionalWeights =
    sumSubtotals > 0 ? rawSubtotals : new Array(participantIds.length).fill(1);

  const taxAllocations =
    totalTaxPaise > 0
      ? reconcileRounding(proportionalWeights, totalTaxPaise, participantIds)
      : new Array(participantIds.length).fill(0);

  // 3. Proportional Service Charge
  const cleanServiceCharge = Math.max(0, Math.round(serviceChargePaise));
  const serviceChargeAllocations =
    cleanServiceCharge > 0
      ? reconcileRounding(
          proportionalWeights,
          cleanServiceCharge,
          participantIds
        )
      : new Array(participantIds.length).fill(0);

  // 4. Proportional Discount
  const cleanDiscount = Math.max(0, Math.round(discountPaise));
  const discountAllocations =
    cleanDiscount > 0
      ? reconcileRounding(proportionalWeights, cleanDiscount, participantIds)
      : new Array(participantIds.length).fill(0);

  // 5. Combine into individual member shares
  const computedShares: MemberShare[] = [];
  const memberBreakdowns: ItemizedMemberBreakdown[] = [];

  for (let i = 0; i < participantIds.length; i++) {
    const memberId = participantIds[i];
    const subtotal = rawSubtotals[i];
    const tax = taxAllocations[i];
    const sc = serviceChargeAllocations[i];
    const disc = discountAllocations[i];

    // Individual share: subtotal + tax + service charge - discount
    const memberTotal = subtotal + tax + sc - disc;

    computedShares.push({
      memberId,
      amountPaise: memberTotal,
    });

    memberBreakdowns.push({
      memberId,
      itemSubtotalPaise: subtotal,
      proportionalTaxPaise: tax,
      proportionalServiceChargePaise: sc,
      proportionalDiscountPaise: disc,
      finalSharePaise: memberTotal,
      assignedItemCount: memberAssignedCountMap.get(memberId) ?? 0,
    });
  }

  // 6. Verify and reconcile with authoritative totalPaise
  const calculatedGrandTotal =
    sumSubtotals + totalTaxPaise + cleanServiceCharge - cleanDiscount;
  const targetTotal =
    typeof totalPaise === 'number' && totalPaise > 0
      ? totalPaise
      : calculatedGrandTotal;

  let finalMemberShares = computedShares;

  // If totalPaise differs from calculatedGrandTotal (e.g. OCR rounding difference or bill override)
  if (calculatedGrandTotal !== targetTotal) {
    const weights = computedShares.map((s) => Math.max(0, s.amountPaise));
    const finalAllocations = reconcileRounding(
      weights.some((w) => w > 0)
        ? weights
        : new Array(participantIds.length).fill(1),
      targetTotal,
      participantIds
    );

    finalMemberShares = participantIds.map((id, idx) => ({
      memberId: id,
      amountPaise: finalAllocations[idx],
    }));

    // Update breakdowns with adjusted final shares
    for (let i = 0; i < memberBreakdowns.length; i++) {
      memberBreakdowns[i].finalSharePaise = finalAllocations[i];
    }
  }

  const finalSum = finalMemberShares.reduce((a, b) => a + b.amountPaise, 0);

  return {
    memberShares: finalMemberShares,
    memberBreakdowns,
    subtotalPaise: sumSubtotals,
    totalTaxPaise,
    serviceChargePaise: cleanServiceCharge,
    discountPaise: cleanDiscount,
    grandTotalPaise: targetTotal,
    reconciled: finalSum === targetTotal,
  };
}
