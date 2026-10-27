import type { ID, Paise } from '../../types/domain';
import type {
  RoundingAuditEntry,
  RoundingReconciliationResult,
} from './types';

/**
 * Reconciles rounding using the Largest Remainder (Hamilton-Hare) Method
 * with deterministic tie-breaking by ascending stable ID.
 *
 * Implements the contract defined in SplitSmart_Implementation_Plan_v1.md:
 * "For a total T paise and nonnegative weights wᵢ, take floor(T × wᵢ / Σw);
 * distribute the remaining paise to the largest fractional remainders,
 * ties by stable memberId ascending."
 *
 * @param rawWeights Array of non-negative weights (or percentages, or item subtotals)
 * @param totalPaise The authoritative integer total paise to distribute
 * @param stableIds Stable string identifiers matching rawWeights for deterministic tie-breaking
 * @returns Array of integer paise allocations in the same order as input
 */
export function reconcileRounding(
  rawWeights: number[],
  totalPaise: Paise,
  stableIds: ID[]
): Paise[] {
  const result = reconcileRoundingDetailed(rawWeights, totalPaise, stableIds);
  return result.allocations;
}

/**
 * Detailed version of reconcileRounding that provides an audit trail
 * of weights, fractional remainders, tie-breakers, and paisa allocations.
 */
export function reconcileRoundingDetailed(
  rawWeights: number[],
  totalPaise: Paise,
  stableIds: ID[]
): RoundingReconciliationResult {
  const n = rawWeights.length;
  if (n === 0) {
    return {
      allocations: [],
      auditEntries: [],
      totalAllocatedPaise: 0,
      targetTotalPaise: totalPaise,
      remainderPaise: 0,
      conservationVerified: totalPaise === 0,
    };
  }

  if (stableIds.length !== n) {
    throw new Error(
      `stableIds length (${stableIds.length}) must match rawWeights length (${n})`
    );
  }

  // Ensure totalPaise is an integer
  const targetPaise = Math.round(totalPaise);

  if (targetPaise === 0) {
    const allocations = new Array(n).fill(0);
    const auditEntries: RoundingAuditEntry[] = rawWeights.map((w, idx) => ({
      id: stableIds[idx],
      rawWeight: w,
      weightProportion: 0,
      baseAllocationPaise: 0,
      fractionalRemainderNumerator: 0,
      fractionalRemainderDecimal: 0,
      receivedOddPaisa: false,
      finalAllocationPaise: 0,
    }));
    return {
      allocations,
      auditEntries,
      totalAllocatedPaise: 0,
      targetTotalPaise: 0,
      remainderPaise: 0,
      conservationVerified: true,
    };
  }

  const sumWeights = rawWeights.reduce((acc, w) => acc + Math.max(0, w), 0);

  // Fallback if sum of weights is zero: distribute equally by stable ID ascending
  if (sumWeights === 0) {
    const baseEqual = Math.floor(targetPaise / n);
    const oddPaise = targetPaise - baseEqual * n;

    // Sort indices by stable ID ascending
    const sortedIndices = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
      stableIds[a].localeCompare(stableIds[b])
    );

    const oddSet = new Set<number>(sortedIndices.slice(0, oddPaise));
    const allocations = new Array<Paise>(n);

    const auditEntries: RoundingAuditEntry[] = rawWeights.map((w, i) => {
      const gotOdd = oddSet.has(i);
      const alloc = baseEqual + (gotOdd ? 1 : 0);
      allocations[i] = alloc;
      return {
        id: stableIds[i],
        rawWeight: w,
        weightProportion: 1 / n,
        baseAllocationPaise: baseEqual,
        fractionalRemainderNumerator: 0,
        fractionalRemainderDecimal: 0,
        receivedOddPaisa: gotOdd,
        finalAllocationPaise: alloc,
      };
    });

    return {
      allocations,
      auditEntries,
      totalAllocatedPaise: targetPaise,
      targetTotalPaise: targetPaise,
      remainderPaise: oddPaise,
      conservationVerified: true,
    };
  }

  // 1. Calculate floor base allocations and exact fractional remainders
  const baseAllocations = new Array<number>(n);
  const remainders = new Array<{
    index: number;
    id: string;
    numerator: number;
    fraction: number;
  }>(n);

  let allocatedSum = 0;

  for (let i = 0; i < n; i++) {
    const weight = Math.max(0, rawWeights[i]);
    const numerator = targetPaise * weight;
    const base = Math.floor(numerator / sumWeights);
    const remNum = numerator % sumWeights;

    baseAllocations[i] = base;
    allocatedSum += base;

    remainders[i] = {
      index: i,
      id: stableIds[i],
      numerator: remNum,
      fraction: remNum / sumWeights,
    };
  }

  // 2. Determine number of odd paise to distribute
  const sparePaise = targetPaise - allocatedSum;

  // 3. Sort by:
  //    Primary: fractional remainder DESCENDING
  //    Secondary: stable ID ASCENDING (lexicographical)
  remainders.sort((a, b) => {
    if (b.fraction !== a.fraction) {
      return b.fraction - a.fraction;
    }
    return a.id.localeCompare(b.id);
  });

  const oddRecipients = new Set<number>();
  for (let k = 0; k < sparePaise; k++) {
    oddRecipients.add(remainders[k].index);
  }

  // 4. Construct final allocations and audit records
  const allocations = new Array<Paise>(n);
  const auditEntries: RoundingAuditEntry[] = new Array(n);

  let finalSum = 0;
  for (let i = 0; i < n; i++) {
    const receivedOdd = oddRecipients.has(i);
    const finalAlloc = baseAllocations[i] + (receivedOdd ? 1 : 0);
    allocations[i] = finalAlloc;
    finalSum += finalAlloc;

    const weight = Math.max(0, rawWeights[i]);
    const num = targetPaise * weight;
    const remNum = num % sumWeights;

    auditEntries[i] = {
      id: stableIds[i],
      rawWeight: weight,
      weightProportion: weight / sumWeights,
      baseAllocationPaise: baseAllocations[i],
      fractionalRemainderNumerator: remNum,
      fractionalRemainderDecimal: remNum / sumWeights,
      receivedOddPaisa: receivedOdd,
      finalAllocationPaise: finalAlloc,
    };
  }

  return {
    allocations,
    auditEntries,
    totalAllocatedPaise: finalSum,
    targetTotalPaise: targetPaise,
    remainderPaise: sparePaise,
    conservationVerified: finalSum === targetPaise,
  };
}

/**
 * Distribute an amount equally among participants, with odd paise allocated
 * deterministically by ascending stable member ID.
 */
export function distributeEvenly(
  totalPaise: Paise,
  participantIds: ID[]
): Record<ID, Paise> {
  const weights = new Array(participantIds.length).fill(1);
  const allocations = reconcileRounding(weights, totalPaise, participantIds);

  const result: Record<ID, Paise> = {};
  participantIds.forEach((id, idx) => {
    result[id] = allocations[idx];
  });
  return result;
}
