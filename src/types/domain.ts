export type ID = string; // crypto.randomUUID() when created
export type Paise = number; // safe INTEGER paise, never rupee floats
export type ISODate = string; // YYYY-MM-DD for date-only values
export type ISODateTime = string; // ISO 8601 timestamp
export type Category = 'Food' | 'Groceries' | 'Travel' | 'Utilities' | 'Entertainment' | 'Other';
export type SplitMode = 'itemized' | 'equal' | 'exact' | 'percentage' | 'shares';

export interface Member {
  id: ID;
  groupId: ID;
  name: string;
  color?: string;
  avatarDataUrl?: string; // keep small; optional
  upiId?: string; // optional, for UPI payments
  active: boolean; // prefer deactivation if historical references exist
  isCurrentUser?: boolean; // the person using this local app in this group
}

export interface Group {
  id: ID;
  name: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ReceiptItem {
  id: ID;
  name: string;
  quantity: number; // positive; integer for v1
  unitPricePaise: Paise;
  lineTotalPaise: Paise;
  assignedMemberIds: ID[]; // needed for itemized mode
  category: Category;
  ocrConfidence?: number; // normalized 0..100
  needsReview?: boolean;
  billIndex?: number;
  billName?: string;
}

export interface ReceiptDraft {
  items: ReceiptItem[];
  subtotalPaise: Paise | null;
  taxLines: Array<{ label: string; amountPaise: Paise }>;
  serviceChargePaise: Paise;
  discountPaise: Paise; // positive number to SUBTRACT
  detectedGrandTotalPaise: Paise | null;
  originalImageObjectUrl?: string; // ephemeral UI only, NOT persisted
  rawOcrText?: string; // optional ephemeral debugging only
}

export interface MemberShare {
  memberId: ID;
  amountPaise: Paise; // FINAL amount, incl. allocations
}

export interface Expense {
  id: ID;
  groupId: ID;
  description: string;
  category?: Category | string;
  date: ISODate;
  payerId: ID; // v1: exactly ONE payer per expense
  amountPaise: Paise; // confirmed authoritative total
  splitMode: SplitMode;
  memberShares: MemberShare[]; // sum MUST equal amountPaise
  items: ReceiptItem[]; // [] for simple manual expense
  taxLines: Array<{ label: string; amountPaise: Paise }>;
  serviceChargePaise: Paise;
  discountPaise: Paise;
  createdAt: ISODateTime;
}

// A real payment event; NOT a pending algorithm suggestion.
export interface RecordedSettlement {
  id: ID;
  groupId: ID;
  fromMemberId: ID;
  toMemberId: ID;
  amountPaise: Paise;
  settledAt: ISODateTime;
  note?: string;
}

// Derived/read-only; recompute from saved expenses + completed payments.
export interface MemberBalance {
  memberId: ID;
  balancePaise: Paise;
}

export interface SuggestedPayment {
  fromMemberId: ID;
  toMemberId: ID;
  amountPaise: Paise;
}

// --- Extended Member 4 Types for Analytics & Detailed Balances ---

export interface MemberBalanceBreakdown {
  memberId: ID;
  totalPaidPaise: Paise; // amount paid as expense payer
  totalSharePaise: Paise; // amount owed as expense participant
  settlementsSentPaise: Paise; // real payments sent to settle debt
  settlementsReceivedPaise: Paise; // real payments received from debtors
  netBalancePaise: Paise; // net balance in paise (+ = owed money, - = owes money)
}

export interface CategorySpending {
  category: Category;
  totalPaise: Paise;
  percentageBasisPoints: number; // e.g. 2500 = 25.00%
  expenseCount: number;
}

export interface MemberSpendingAnalytics {
  memberId: ID;
  memberName: string;
  totalPaidPaise: Paise;
  totalConsumedPaise: Paise;
  netBalancePaise: Paise;
}

export interface GroupAnalyticsSummary {
  totalSpentPaise: Paise;
  averagePerMemberPaise: Paise;
  expenseCount: number;
  topCategory: Category | null;
  categoryBreakdown: CategorySpending[];
  memberAnalytics: MemberSpendingAnalytics[];
  spendingByDate: Array<{ date: ISODate; totalPaise: Paise }>;
}
