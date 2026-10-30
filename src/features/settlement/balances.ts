import type {
  ID,
  Paise,
  Member,
  Expense,
  RecordedSettlement,
  MemberBalance,
  MemberBalanceBreakdown,
} from '../../types/domain';

/**
 * Calculates net balance for every member in the group.
 * Formula:
 * netBalance(member) = Σ paid expenses − Σ final shares + Σ actual payments sent − Σ actual payments received
 *
 * Invariant: Sum of all member balances must equal 0 paise.
 */
export function calculateGroupBalances(
  memberIds: ID[],
  expenses: Expense[],
  payments: RecordedSettlement[]
): MemberBalance[] {
  // Initialize balance map for all members
  const balanceMap = new Map<ID, Paise>();
  for (const id of memberIds) {
    balanceMap.set(id, 0);
  }

  // 1. Process Expenses
  for (const expense of expenses) {
    // Payer fronted the money: +expense.amountPaise
    const currentPayerBalance = balanceMap.get(expense.payerId) ?? 0;
    balanceMap.set(expense.payerId, currentPayerBalance + expense.amountPaise);

    // Each participant owes their share: -share.amountPaise
    for (const share of expense.memberShares) {
      const currentShareBalance = balanceMap.get(share.memberId) ?? 0;
      balanceMap.set(share.memberId, currentShareBalance - share.amountPaise);
    }
  }

  // 2. Process Recorded Settlements (real payments)
  for (const payment of payments) {
    // Payer sent real money: reduces debtor's negative balance, so +amountPaise
    const currentSenderBalance = balanceMap.get(payment.fromMemberId) ?? 0;
    balanceMap.set(payment.fromMemberId, currentSenderBalance + payment.amountPaise);

    // Payee received real money: reduces creditor's positive balance, so -amountPaise
    const currentReceiverBalance = balanceMap.get(payment.toMemberId) ?? 0;
    balanceMap.set(payment.toMemberId, currentReceiverBalance - payment.amountPaise);
  }

  // Convert map to MemberBalance array
  return memberIds.map((memberId) => ({
    memberId,
    balancePaise: balanceMap.get(memberId) ?? 0,
  }));
}

/**
 * Computes a comprehensive breakdown for each member:
 * - total paid in expenses
 * - total consumed/share in expenses
 * - settlements sent
 * - settlements received
 * - net balance
 */
export function calculateDetailedBalances(
  members: Member[],
  expenses: Expense[],
  payments: RecordedSettlement[]
): MemberBalanceBreakdown[] {
  const breakdownMap = new Map<
    ID,
    {
      totalPaid: Paise;
      totalShare: Paise;
      settlementsSent: Paise;
      settlementsReceived: Paise;
    }
  >();

  for (const m of members) {
    breakdownMap.set(m.id, {
      totalPaid: 0,
      totalShare: 0,
      settlementsSent: 0,
      settlementsReceived: 0,
    });
  }

  for (const exp of expenses) {
    const payerStats = breakdownMap.get(exp.payerId);
    if (payerStats) {
      payerStats.totalPaid += exp.amountPaise;
    }
    for (const share of exp.memberShares) {
      const shareStats = breakdownMap.get(share.memberId);
      if (shareStats) {
        shareStats.totalShare += share.amountPaise;
      }
    }
  }

  for (const pay of payments) {
    const sender = breakdownMap.get(pay.fromMemberId);
    if (sender) {
      sender.settlementsSent += pay.amountPaise;
    }
    const receiver = breakdownMap.get(pay.toMemberId);
    if (receiver) {
      receiver.settlementsReceived += pay.amountPaise;
    }
  }

  return members.map((m) => {
    const stats = breakdownMap.get(m.id) ?? {
      totalPaid: 0,
      totalShare: 0,
      settlementsSent: 0,
      settlementsReceived: 0,
    };
    const netBalancePaise =
      stats.totalPaid - stats.totalShare + stats.settlementsSent - stats.settlementsReceived;

    return {
      memberId: m.id,
      totalPaidPaise: stats.totalPaid,
      totalSharePaise: stats.totalShare,
      settlementsSentPaise: stats.settlementsSent,
      settlementsReceivedPaise: stats.settlementsReceived,
      netBalancePaise,
    };
  });
}

/**
 * Verifies the mathematical invariant that sum of all balances equals zero.
 */
export function verifyBalanceConservation(balances: MemberBalance[]): {
  valid: boolean;
  discrepancyPaise: Paise;
} {
  const total = balances.reduce((sum, b) => sum + b.balancePaise, 0);
  return {
    valid: total === 0,
    discrepancyPaise: total,
  };
}

/**
 * Safely converts integer paise to Indian Rupee formatted string.
 * Example:
 * 125000 -> "₹1,250.00"
 * -5000 -> "-₹50.00"
 * 0 -> "₹0.00"
 */
export function formatPaise(
  paise: Paise,
  options: {
    showSign?: boolean;
    currencySymbol?: string;
  } = {}
): string {
  const { showSign = false, currencySymbol = '₹' } = options;
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);

  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  // Indian number formatting for rupees
  const formattedRupees = formatIndianNumber(rupees);
  const formattedPaise = remainingPaise.toString().padStart(2, '0');

  const baseStr = `${currencySymbol}${formattedRupees}.${formattedPaise}`;

  if (isNegative) {
    return `-${baseStr}`;
  }
  if (showSign && paise > 0) {
    return `+${baseStr}`;
  }
  return baseStr;
}

/**
 * Indian numbering system formatter (e.g. 1,00,000 for 1 lakh)
 */
function formatIndianNumber(num: number): string {
  const s = num.toString();
  if (s.length <= 3) return s;

  const lastThree = s.substring(s.length - 3);
  const otherNumbers = s.substring(0, s.length - 3);
  const formattedOthers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return `${formattedOthers},${lastThree}`;
}

/**
 * Safe conversion from rupee string/number to integer paise.
 * Avoids floating-point rounding pitfalls (e.g., 33.29 * 100 = 3328.9999999999995).
 */
export function rupeesToPaise(rupees: number | string): Paise {
  if (typeof rupees === 'number') {
    return Math.round(rupees * 100);
  }

  const cleaned = rupees.trim().replace(/,/g, '');
  if (!cleaned) return 0;

  const parts = cleaned.split('.');
  const whole = parseInt(parts[0] || '0', 10);
  if (Number.isNaN(whole)) return 0;

  let fraction = 0;
  if (parts.length > 1) {
    const fracStr = (parts[1] + '00').substring(0, 2);
    fraction = parseInt(fracStr, 10);
  }

  const sign = cleaned.startsWith('-') ? -1 : 1;
  const absPaise = Math.abs(whole) * 100 + fraction;
  return sign * absPaise;
}

/**
 * Safe conversion from integer paise to floating rupee value (for UPI deep links).
 */
export function paiseToRupees(paise: Paise): number {
  return Number((paise / 100).toFixed(2));
}

/**
 * Represents the bilateral (pairwise) relationship between the current member and another group member.
 * Positive amountPaise: other member owes you directly.
 * Negative amountPaise: you owe the other member directly.
 * Zero amountPaise: you two are square.
 */
export interface PairwiseRelationship {
  otherMemberId: ID;
  otherMemberName: string;
  amountPaise: Paise;
}

/**
 * Calculates direct who-owes-whom bilateral debts between a specific member and each other member in the group.
 * The sum of all pairwise balances with group members mathematically equals the member's net group balance.
 */
export function calculatePairwiseBalancesForMember(
  myMemberId: ID,
  members: Member[],
  expenses: Expense[],
  settlements: RecordedSettlement[] = []
): PairwiseRelationship[] {
  const map = new Map<ID, Paise>();
  for (const m of members) {
    if (m.id !== myMemberId) {
      map.set(m.id, 0);
    }
  }

  // 1. Process all expenses
  for (const exp of expenses) {
    if (exp.payerId === myMemberId) {
      // You paid! Each other member owes you their share
      for (const share of exp.memberShares) {
        if (share.memberId !== myMemberId && map.has(share.memberId)) {
          map.set(share.memberId, (map.get(share.memberId) ?? 0) + share.amountPaise);
        }
      }
    } else if (map.has(exp.payerId)) {
      // Someone else paid! You owe the payer your share
      const myShare = exp.memberShares.find((s) => s.memberId === myMemberId)?.amountPaise ?? 0;
      if (myShare > 0) {
        map.set(exp.payerId, (map.get(exp.payerId) ?? 0) - myShare);
      }
    }
  }

  // 2. Process all direct settlements
  for (const pay of settlements) {
    if (pay.fromMemberId === myMemberId && map.has(pay.toMemberId)) {
      // You paid them: reduces what you owe or increases what they owe you
      map.set(pay.toMemberId, (map.get(pay.toMemberId) ?? 0) + pay.amountPaise);
    } else if (pay.toMemberId === myMemberId && map.has(pay.fromMemberId)) {
      // They paid you: reduces what they owe you or increases what you owe them
      map.set(pay.fromMemberId, (map.get(pay.fromMemberId) ?? 0) - pay.amountPaise);
    }
  }

  return members
    .filter((m) => m.id !== myMemberId)
    .map((m) => ({
      otherMemberId: m.id,
      otherMemberName: m.name,
      amountPaise: map.get(m.id) ?? 0,
    }));
}
