/**
 * Receipt / OCR types (Member 2 owns these; Member 5 can merge them into the shared types/ folder).
 *
 * Rules:
 *  - Money is ALWAYS integer paise.
 *  - Every confidence value in this module is 0..1 (Tesseract's 0..100 is normalised in ocrService).
 */
export type Money = number;

export type Category = 'Food' | 'Groceries' | 'Travel' | 'Utilities' | 'Entertainment' | 'Other';
export const CATEGORIES: Category[] = [
  'Food',
  'Groceries',
  'Travel',
  'Utilities',
  'Entertainment',
  'Other',
];

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// ---------- OCR output contract ----------
export interface OcrWord {
  text: string;
  confidence: number;
  bbox: BBox;
}
export interface OcrLine {
  text: string;
  confidence: number;
  bbox: BBox;
  words: OcrWord[];
}
export interface OcrResult {
  text: string;
  confidence: number; // mean confidence of the page
  lines: OcrLine[];
  width: number; // size of the (preprocessed, rotated) image the bboxes refer to
  height: number;
  rotation: 0 | 90 | 180 | 270; // rotation that was applied before OCR
  preprocess: 'raw' | 'gray' | 'binarized';
}

export type ItemStatus = 'VERIFIED' | 'CHECK' | 'UNRESOLVED';
export type ReceiptStatus = 'VERIFIED' | 'CHECK' | 'UNRESOLVED';

// ---------- Parser output contract ----------
/** Maps 1:1 onto the shared ReceiptItem; add `assignedMemberIds: []` when creating an Expense. */
export interface ParsedItem {
  id: string;
  name: string;
  quantity: number;
  unitPricePaise: Money;
  totalPaise: Money;
  confidence: number; // weakest word on the line (0..1)
  amountConfidence: number; // confidence of the price token specifically
  uncertainWords: string[]; // words below the low-confidence threshold -> highlight in the UI
  sourceLine: number; // index into OcrResult.lines (for side-by-side highlighting)
  category?: Category;
  numberProof?: boolean; // arithmetic proof (qty * rate === amount and verified against totals)
  textProof?: boolean; // vocab hit or high OCR word confidence
  status?: ItemStatus; // VERIFIED (both proofs) | CHECK (unproven name or repair) | UNRESOLVED
  statusReason?: string;
  repairedFrom?: string;
  billIndex?: number; // 0-indexed bill in multi-batch scan
  billName?: string; // e.g. "Bill No. 1", "Bill No. 2"
}

export interface ChargeLine {
  label: string;
  amountPaise: Money;
  sourceLine: number;
  inclusive?: boolean;
}

export interface InferredChargeItem {
  kind: 'tax_inferred' | 'roundoff';
  pct?: number; // basis points / 100 (e.g. 5, 2.5, 12, 18)
  paise: Money;
  needsConfirm: boolean;
  label: string;
}

export interface ItemQtyChecksumData {
  printedItems?: number;
  actualItems: number;
  printedQty?: number;
  actualQty: number;
  verified: boolean;
  message?: string;
}

export type WarningCode =
  | 'NO_ITEMS_FOUND'
  | 'TOTAL_NOT_FOUND'
  | 'LOW_OCR_CONFIDENCE'
  | 'TAX_INCLUDED'
  | 'INFERRED_TAX'
  | 'CHECKSUM_MISMATCH'
  | 'NAME_UNPROVEN';

export interface ParseWarning {
  code: WarningCode;
  severity: 'info' | 'warning';
  message: string;
}

export interface ParsedReceipt {
  merchant?: string;
  dateISO?: string; // yyyy-mm-dd
  items: ParsedItem[];
  subtotalPaise: Money | null; // as printed, if any
  taxLines: ChargeLine[]; // CGST / SGST / IGST / GST / VAT ...
  taxPaise: Money;
  taxIncluded: boolean; // tax is already inside the item prices -> do NOT add it again
  serviceChargePaise: Money;
  discountPaise: Money; // positive number = amount taken off
  roundOffPaise: Money; // signed
  detectedTotalPaise: Money | null;
  computedTotalPaise: Money;
  totalPaise: Money; // detected ?? computed
  totalWasComputed: boolean; // true -> ask the user to confirm (test case 5)
  receiptStatus?: ReceiptStatus;
  itemQtyChecksum?: ItemQtyChecksumData | null;
  inferredCharges?: InferredChargeItem[];
  warnings: ParseWarning[];
}

// ---------- Pipeline contract ----------
export type ScanErrorCode =
  'UNSUPPORTED_FILE' | 'IMAGE_DECODE_FAILED' | 'OCR_ENGINE_FAILED' | 'UNKNOWN';
export interface ScanError {
  code: ScanErrorCode;
  message: string;
  recoverable: true;
}

export interface ScanProgress {
  stage: 'preparing' | 'loading-engine' | 'recognizing' | 'retrying' | 'parsing' | 'done';
  overall: number; // 0..1, drop straight into <progress>
  message: string;
}
