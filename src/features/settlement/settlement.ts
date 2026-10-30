import type {
  ID,
  SuggestedPayment,
  RecordedSettlement,
  MemberBalance,
  ISODateTime,
} from '../../types/domain';

/**
 * Validates a settlement suggestion before recording it.
 */
export function validateSettlement(payment: SuggestedPayment): {
  valid: boolean;
  error?: string;
} {
  if (!payment.fromMemberId || !payment.toMemberId) {
    return { valid: false, error: 'Both sender and receiver member IDs are required.' };
  }
  if (payment.fromMemberId === payment.toMemberId) {
    return { valid: false, error: 'Self-settlement is not allowed.' };
  }
  if (payment.amountPaise <= 0) {
    return { valid: false, error: 'Settlement amount must be greater than 0 paise.' };
  }
  if (!Number.isInteger(payment.amountPaise)) {
    return { valid: false, error: 'Settlement amount must be a safe integer in paise.' };
  }
  return { valid: true };
}

/**
 * Creates an immutable RecordedSettlement transaction object from a SuggestedPayment.
 */
export function createRecordedSettlement(
  suggestion: SuggestedPayment,
  options: {
    groupId?: ID;
    note?: string;
    settledAt?: ISODateTime;
    id?: ID;
  } = {}
): RecordedSettlement {
  const validation = validateSettlement(suggestion);
  if (!validation.valid) {
    throw new Error(`Cannot record settlement: ${validation.error}`);
  }

  const {
    groupId = 'default-group',
    note = 'Settled via SplitSmart',
    settledAt = new Date().toISOString(),
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : `settle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  } = options;

  return {
    id,
    groupId,
    fromMemberId: suggestion.fromMemberId,
    toMemberId: suggestion.toMemberId,
    amountPaise: suggestion.amountPaise,
    settledAt,
    note,
  };
}

/**
 * Pure state reducer: Updates member balances immediately after a settlement is recorded.
 */
export function applySettlementToBalances(
  currentBalances: MemberBalance[],
  settlement: RecordedSettlement
): MemberBalance[] {
  return currentBalances.map((b) => {
    if (b.memberId === settlement.fromMemberId) {
      // Sender paid: reduces debt, so balance increases (less negative)
      return { ...b, balancePaise: b.balancePaise + settlement.amountPaise };
    }
    if (b.memberId === settlement.toMemberId) {
      // Receiver received money: reduces credit, so balance decreases (less positive)
      return { ...b, balancePaise: b.balancePaise - settlement.amountPaise };
    }
    return b;
  });
}

/**
 * Checks if a settlement matches a suggestion (for optimistic button states / badge tracking).
 */
export function matchesSettlement(
  suggestion: SuggestedPayment,
  settlement: RecordedSettlement
): boolean {
  return (
    suggestion.fromMemberId === settlement.fromMemberId &&
    suggestion.toMemberId === settlement.toMemberId &&
    suggestion.amountPaise === settlement.amountPaise
  );
}
