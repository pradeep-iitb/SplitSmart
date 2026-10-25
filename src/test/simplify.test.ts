import { describe, expect, it } from 'vitest';
import {
  compareDebtAlgorithms,
  simplifyExactOptimal,
  simplifyGreedy,
  suggestSettlements,
} from '../features/settlement/simplify';
import type { MemberBalance, SuggestedPayment } from '../types/domain';

/**
 * Helper to verify that a list of suggestions completely resolves all balances to zero
 */
function verifySettlementCompleteness(
  initialBalances: MemberBalance[],
  suggestions: SuggestedPayment[]
) {
  const finalMap = new Map<string, number>();
  for (const b of initialBalances) {
    finalMap.set(b.memberId, b.balancePaise);
  }

  for (const s of suggestions) {
    const fromBal = finalMap.get(s.fromMemberId) ?? 0;
    const toBal = finalMap.get(s.toMemberId) ?? 0;
    // Sender pays: reduces debt, so balance increases (less negative)
    finalMap.set(s.fromMemberId, fromBal + s.amountPaise);
    // Receiver receives: reduces credit, so balance decreases (less positive)
    finalMap.set(s.toMemberId, toBal - s.amountPaise);
  }

  for (const [id, balance] of finalMap.entries()) {
    expect(balance, `Balance for member ${id} must settle to 0`).toBe(0);
  }
}

describe('Debt Simplification Engine (simplify.ts)', () => {
  it('returns empty suggestions when all members are already settled', () => {
    const balances: MemberBalance[] = [
      { memberId: 'm1', balancePaise: 0 },
      { memberId: 'm2', balancePaise: 0 },
    ];
    const suggestions = suggestSettlements(balances);
    expect(suggestions).toEqual([]);
  });

  it('settles a simple two-party debt in 1 transaction', () => {
    const balances: MemberBalance[] = [
      { memberId: 'riya', balancePaise: 50000 },   // +₹500 (creditor)
      { memberId: 'arjun', balancePaise: -50000 }, // -₹500 (debtor)
    ];

    const suggestions = suggestSettlements(balances);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toEqual({
      fromMemberId: 'arjun',
      toMemberId: 'riya',
      amountPaise: 50000,
    });
    verifySettlementCompleteness(balances, suggestions);
  });

  it('simplifies linear debt chain A -> B -> C to a single direct transaction A -> C', () => {
    // If Arjun owes Meera ₹200 and Meera owes Riya ₹200:
    // Net: Arjun = -200, Meera = 0, Riya = +200
    const balances: MemberBalance[] = [
      { memberId: 'arjun', balancePaise: -20000 },
      { memberId: 'meera', balancePaise: 0 },
      { memberId: 'riya', balancePaise: 20000 },
    ];

    const suggestions = suggestSettlements(balances);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toEqual({
      fromMemberId: 'arjun',
      toMemberId: 'riya',
      amountPaise: 20000,
    });
    verifySettlementCompleteness(balances, suggestions);
  });

  it('simplifies circular debt (A owes B, B owes C, C owes A) to 0 transactions', () => {
    // In circular debt of identical amounts, net balances cancel out to 0
    const balances: MemberBalance[] = [
      { memberId: 'A', balancePaise: 0 },
      { memberId: 'B', balancePaise: 0 },
      { memberId: 'C', balancePaise: 0 },
    ];

    const suggestions = suggestSettlements(balances);
    expect(suggestions).toHaveLength(0);
  });

  it('exact algorithm achieves provable minimum transactions where greedy produces suboptimal count', () => {
    // Classic counterexample where Greedy requires 4 transactions but Exact requires only 3:
    // Creditors: A (+400), B (+300)
    // Debtors: C (-300), D (-200), E (-200)
    //
    // Optimal partition into 2 zero-sum subsets:
    // Subset 1: {B: +300, C: -300} -> 1 transaction
    // Subset 2: {A: +400, D: -200, E: -200} -> 2 transactions
    // Total = 3 transactions!
    //
    // Greedy matches largest creditor A (+400) with largest debtor C (-300) first,
    // which breaks the exact zero-sum match and results in 4 transactions.
    const balances: MemberBalance[] = [
      { memberId: 'A', balancePaise: 40000 },
      { memberId: 'B', balancePaise: 30000 },
      { memberId: 'C', balancePaise: -30000 },
      { memberId: 'D', balancePaise: -20000 },
      { memberId: 'E', balancePaise: -20000 },
    ];

    const exactSuggestions = simplifyExactOptimal(balances);
    const greedySuggestions = simplifyGreedy(balances);

    expect(exactSuggestions).toHaveLength(3);
    expect(greedySuggestions).toHaveLength(4);

    // Both must settle all balances to zero
    verifySettlementCompleteness(balances, exactSuggestions);
    verifySettlementCompleteness(balances, greedySuggestions);

    // Test comparison utility
    const comparison = compareDebtAlgorithms(balances);
    expect(comparison.transactionsSaved).toBe(1);
    expect(comparison.exact).toHaveLength(3);
    expect(comparison.greedy).toHaveLength(4);
  });

  it('handles 10 mixed payers group correctly with exact optimal solution', () => {
    const balances: MemberBalance[] = [
      { memberId: 'm1', balancePaise: 120000 },
      { memberId: 'm2', balancePaise: -50000 },
      { memberId: 'm3', balancePaise: -70000 },
      { memberId: 'm4', balancePaise: 30000 },
      { memberId: 'm5', balancePaise: -30000 },
    ];

    const suggestions = suggestSettlements(balances);
    // m4 and m5 can settle directly (30000); m2 and m3 pay m1. Total 3 transactions.
    expect(suggestions.length).toBeLessThanOrEqual(3);
    verifySettlementCompleteness(balances, suggestions);
  });
});
