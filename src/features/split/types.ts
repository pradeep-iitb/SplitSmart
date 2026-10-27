import type {
  Category,
  ID,
  ISODate,
  ISODateTime,
  MemberShare,
  Paise,
  ReceiptItem,
  SplitMode,
} from '../../types/domain';

export type { ReceiptItem };

/**
 * Input contract for calculating expense shares across any split mode.
 * Satisfies the M3 specification in SplitSmart_Implementation_Plan_v1.md.
 */
export interface SplitInput {
  totalPaise: Paise;
  splitMode: SplitMode;
  participantIds: ID[]; // All member IDs participating in the split

  // Mode: 'exact' -> explicit paise amount specified per member
  exactAmounts?: Record<ID, Paise>;

  // Mode: 'percentage' -> basis points (10000 = 100.00%, e.g., 2500 for 25.00%)
  percentagesBasisPoints?: Record<ID, number>;

  // Mode: 'shares' -> positive integer ratio weights (e.g., { m1: 2, m2: 1, m3: 1 })
  sharesWeights?: Record<ID, number>;

  // Mode: 'itemized' -> receipt items with member assignments and extra charges
  items?: ReceiptItem[];
  taxLines?: Array<{ label: string; amountPaise: Paise }>;
  serviceChargePaise?: Paise;
  discountPaise?: Paise;
}

/**
 * Structured validation issue returned by validateSplitInput.
 */
export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

/**
 * Detailed step-by-step breakdown for an itemized split calculation.
 * Useful for transparent UI display and auditability.
 */
export interface ItemizedMemberBreakdown {
  memberId: ID;
  itemSubtotalPaise: Paise;
  proportionalTaxPaise: Paise;
  proportionalServiceChargePaise: Paise;
  proportionalDiscountPaise: Paise;
  finalSharePaise: Paise;
  assignedItemCount: number;
}

export interface ItemizedSplitResult {
  memberShares: MemberShare[];
  memberBreakdowns: ItemizedMemberBreakdown[];
  subtotalPaise: Paise;
  totalTaxPaise: Paise;
  serviceChargePaise: Paise;
  discountPaise: Paise;
  grandTotalPaise: Paise;
  reconciled: boolean;
}

/**
 * Rounding reconciliation audit entry for the Hamilton-Hare algorithm.
 */
export interface RoundingAuditEntry {
  id: ID;
  rawWeight: number;
  weightProportion: number;
  baseAllocationPaise: Paise;
  fractionalRemainderNumerator: number;
  fractionalRemainderDecimal: number;
  receivedOddPaisa: boolean;
  finalAllocationPaise: Paise;
}

export interface RoundingReconciliationResult {
  allocations: Paise[];
  auditEntries: RoundingAuditEntry[];
  totalAllocatedPaise: Paise;
  targetTotalPaise: Paise;
  remainderPaise: Paise;
  conservationVerified: boolean;
}

/**
 * Contract for creating a manual expense without a receipt (PS Point 6).
 */
export interface ManualExpenseDraft {
  groupId: ID;
  description: string;
  category: Category;
  date: ISODate;
  payerId: ID;
  amountPaise: Paise;
  splitMode: SplitMode;
  participantIds: ID[];
  exactAmounts?: Record<ID, Paise>;
  percentagesBasisPoints?: Record<ID, number>;
  sharesWeights?: Record<ID, number>;
}

/**
 * Recurrence frequencies supported for scheduled recurring expenses (PS Point 19).
 */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Recurring expense template (PS Point 19).
 * Materializes when the app is next opened, using deterministic occurrence IDs.
 */
export interface RecurringExpenseTemplate {
  id: ID;
  groupId: ID;
  description: string;
  category: Category;
  amountPaise: Paise;
  payerId: ID;
  splitMode: SplitMode;
  participantIds: ID[];
  splitDetails?: {
    exactAmounts?: Record<ID, Paise>;
    percentagesBasisPoints?: Record<ID, number>;
    sharesWeights?: Record<ID, number>;
  };
  frequency: RecurrenceFrequency;
  startDate: ISODate; // YYYY-MM-DD
  endDate?: ISODate;   // optional end date
  dayOfMonth?: number; // 1-31 for monthly
  dayOfWeek?: number;  // 0-6 for weekly (0 = Sunday)
  active: boolean;
  lastMaterializedDate?: ISODate;
  createdAt: ISODateTime;
}
