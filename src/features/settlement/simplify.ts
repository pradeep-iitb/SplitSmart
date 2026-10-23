import type {
  ID,
  Paise,
  MemberBalance,
  SuggestedPayment,
} from '../../types/domain';

interface Participant {
  memberId: ID;
  balancePaise: Paise;
}

export interface SimplificationResult {
  suggestions: SuggestedPayment[];
  algorithmUsed: 'exact' | 'greedy_fallback';
  transactionCount: number;
}

export interface AlgorithmComparison {
  exact: SuggestedPayment[];
  greedy: SuggestedPayment[];
  transactionsSaved: number;
}

/**
 * Debt Simplification Entry Point:
 *
 * PS Point 12: Simplifies debt network to minimize transaction count.
 * Uses exact bitmask DP subset-partition (NP-hard minimum cash flow)
 * for small groups (N <= 15 participants with non-zero balances),
 * with graceful greedy heuristic fallback for larger groups.
 */
export function suggestSettlements(
  balances: MemberBalance[],
  options: {
    algorithm?: 'exact' | 'greedy';
    maxExactGroupSize?: number;
  } = {}
): SuggestedPayment[] {
  const result = suggestSettlementsWithDetails(balances, options);
  return result.suggestions;
}

/**
 * Detailed suggestion output including algorithm metadata.
 */
export function suggestSettlementsWithDetails(
  balances: MemberBalance[],
  options: {
    algorithm?: 'exact' | 'greedy';
    maxExactGroupSize?: number;
  } = {}
): SimplificationResult {
  const { algorithm, maxExactGroupSize = 15 } = options;

  // Filter out members who are already settled (balance === 0)
  const activeParticipants: Participant[] = balances
    .filter((b) => b.balancePaise !== 0)
    .map((b) => ({
      memberId: b.memberId,
      balancePaise: b.balancePaise,
    }));

  if (activeParticipants.length <= 1) {
    return {
      suggestions: [],
      algorithmUsed: 'exact',
      transactionCount: 0,
    };
  }

  const n = activeParticipants.length;

  if (algorithm === 'greedy' || (algorithm !== 'exact' && n > maxExactGroupSize)) {
    const suggestions = simplifyGreedy(activeParticipants);
    return {
      suggestions,
      algorithmUsed: 'greedy_fallback',
      transactionCount: suggestions.length,
    };
  }

  // Exact optimal algorithm for N <= maxExactGroupSize
  const suggestions = simplifyExactOptimal(activeParticipants);
  return {
    suggestions,
    algorithmUsed: 'exact',
    transactionCount: suggestions.length,
  };
}

/**
 * Compares exact minimum vs. greedy simplification.
 * Useful for inspection, tests, and judge demonstrations.
 */
export function compareDebtAlgorithms(
  balances: MemberBalance[]
): AlgorithmComparison {
  const active = balances
    .filter((b) => b.balancePaise !== 0)
    .map((b) => ({ ...b }));

  if (active.length <= 1) {
    return { exact: [], greedy: [], transactionsSaved: 0 };
  }

  const greedy = simplifyGreedy(active);
  const exact = active.length <= 16 ? simplifyExactOptimal(active) : [...greedy];

  return {
    exact,
    greedy,
    transactionsSaved: Math.max(0, greedy.length - exact.length),
  };
}

/**
 * Exact NP-hard optimal debt simplification using bitmask DP.
 *
 * Theory:
 * Minimum number of transactions to resolve a set of N non-zero balances summing to 0
 * equals N - k, where k is the maximum number of disjoint non-empty subsets
 * whose member balances sum to zero.
 */
export function simplifyExactOptimal(
  participants: Participant[]
): SuggestedPayment[] {
  const n = participants.length;
  if (n <= 1) return [];

  const totalStates = 1 << n;

  // 1. Precalculate subset sums
  const subsetSums = new Int32Array(totalStates);
  for (let mask = 1; mask < totalStates; mask++) {
    const lowestBit = mask & -mask;
    const bitIndex = 31 - Math.clz32(lowestBit);
    subsetSums[mask] = subsetSums[mask ^ lowestBit] + participants[bitIndex].balancePaise;
  }

  // Verify that the full set sums to 0
  const fullMask = totalStates - 1;
  if (subsetSums[fullMask] !== 0) {
    // If not zero-sum, fallback to greedy to handle discrepancies
    return simplifyGreedy(participants);
  }

  // 2. DP to find maximum number of disjoint zero-sum subsets
  // dp[mask] = max number of disjoint zero-sum subsets within 'mask'
  // parent[mask] = submask that was chosen to achieve dp[mask]
  const dp = new Int16Array(totalStates);
  const parent = new Int32Array(totalStates);

  for (let mask = 1; mask < totalStates; mask++) {
    // Pick the lowest set bit in mask to ensure each partition is visited without duplication
    const lowestBit = mask & -mask;
    const rest = mask ^ lowestBit;

    // By default, inherit from mask without lowestBit
    dp[mask] = dp[rest];
    parent[mask] = 0; // 0 indicates no zero-sum component containing lowestBit was selected yet

    // Submask enumeration: iterate all submasks of 'rest', and add 'lowestBit'
    // Every submask checked will contain 'lowestBit'.
    let sub = rest;
    while (true) {
      const candidateSubmask = sub | lowestBit;
      if (subsetSums[candidateSubmask] === 0) {
        const candidateValue = 1 + dp[mask ^ candidateSubmask];
        if (candidateValue > dp[mask]) {
          dp[mask] = candidateValue;
          parent[mask] = candidateSubmask;
        }
      }
      if (sub === 0) break;
      sub = (sub - 1) & rest;
    }
  }

  // 3. Reconstruct disjoint zero-sum subsets
  const subsets: Participant[][] = [];
  let remainingMask = fullMask;

  while (remainingMask > 0) {
    const submask = parent[remainingMask];
    if (submask > 0) {
      const group: Participant[] = [];
      for (let i = 0; i < n; i++) {
        if ((submask & (1 << i)) !== 0) {
          group.push(participants[i]);
        }
      }
      subsets.push(group);
      remainingMask ^= submask;
    } else {
      // If no valid zero-sum parent found (should only happen if remaining bits together sum to 0
      // but couldn't be split further), take all remaining bits as one group
      const group: Participant[] = [];
      for (let i = 0; i < n; i++) {
        if ((remainingMask & (1 << i)) !== 0) {
          group.push(participants[i]);
        }
      }
      if (group.length > 0) {
        subsets.push(group);
      }
      break;
    }
  }

  // 4. Resolve each zero-sum subset independently using standard matching (m - 1 transactions)
  const allSuggestions: SuggestedPayment[] = [];
  for (const subset of subsets) {
    const groupSuggestions = simplifyGreedy(subset);
    allSuggestions.push(...groupSuggestions);
  }

  return allSuggestions;
}

/**
 * Standard Greedy debt simplification:
 * Iteratively pairs the largest debtor with the largest creditor.
 * Complexity: O(N log N)
 * Guarantee: At most N - 1 transactions.
 */
export function simplifyGreedy(
  participants: Participant[]
): SuggestedPayment[] {
  // Separate into debtors (< 0) and creditors (> 0)
  const debtors: { memberId: ID; debtPaise: Paise }[] = [];
  const creditors: { memberId: ID; creditPaise: Paise }[] = [];

  for (const p of participants) {
    if (p.balancePaise < 0) {
      debtors.push({ memberId: p.memberId, debtPaise: -p.balancePaise });
    } else if (p.balancePaise > 0) {
      creditors.push({ memberId: p.memberId, creditPaise: p.balancePaise });
    }
  }

  // Sort descending by amount for greedy pairing
  debtors.sort((a, b) => b.debtPaise - a.debtPaise);
  creditors.sort((a, b) => b.creditPaise - a.creditPaise);

  const suggestions: SuggestedPayment[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.debtPaise, creditor.creditPaise);

    if (settleAmount > 0) {
      suggestions.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountPaise: settleAmount,
      });

      debtor.debtPaise -= settleAmount;
      creditor.creditPaise -= settleAmount;
    }

    if (debtor.debtPaise === 0) dIdx++;
    if (creditor.creditPaise === 0) cIdx++;
  }

  return suggestions;
}
