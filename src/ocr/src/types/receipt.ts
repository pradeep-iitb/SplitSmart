/**
 * Receipt / OCR types (Member 2 owns these; Member 5 can merge them into the shared types/ folder).
 *
 * Rules:
 *  - Money is ALWAYS integer paise.
 *  - Every confidence value in this module is 0..1 (Tesseract's 0..100 is normalised in ocrService).
 */
export type Money = number;

export type Category = 'Food' | 'Groceries' | 'Travel' | 'Utilities' | 'Entertainment' | 'Other';
export const CATEGORIES: Category[] = ['Food', 'Groceries', 'Travel', 'Utilities', 'Entertainment', 'Other'];

export interface BBox { x0: number; y0: number; x1: number; y1: number }

// ---------- OCR output contract ----------
export interface OcrWord { text: string; confidence: number; bbox: BBox }
export interface OcrLine { text: string; confidence: number; bbox: BBox; words: OcrWord[] }
export interface OcrResult {
  text: string;
  confidence: number;            // mean confidence of the page
  lines: OcrLine[];
  width: number;                 // size of the (preprocessed, rotated) image the bboxes refer to
  height: number;
  rotation: 0 | 90 | 180 | 270;  // rotation that was applied before OCR
  preprocess: 'gray' | 'binarized';
}

// ---------- Parser output contract ----------
/** Maps 1:1 onto the shared ReceiptItem; add `assignedMemberIds: []` when creating an Expense. */
export interface ParsedItem {
  id: string;
  name: string;
  quantity: number;
  unitPricePaise: Money;
  totalPaise: Money;
  confidence: number;            // weakest word on the line (0..1)
  amountConfidence: number;      // confidence of the price token specifically
  uncertainWords: string[];      // words below the low-confidence threshold -> highlight in the UI
  sourceLine: number;            // index into OcrResult.lines (for side-by-side highlighting)
  category?: Category;
}

export interface ChargeLine { label: string; amountPaise: Money; sourceLine: number; inclusive?: boolean }

export type WarningCode =
  | 'NO_ITEMS_FOUND' | 'TOTAL_NOT_FOUND' | 'LOW_OCR_CONFIDENCE' | 'TAX_INCLUDED';
export interface ParseWarning { code: WarningCode; severity: 'info' | 'warning'; message: string }

export interface ParsedReceipt {
  merchant?: string;
  dateISO?: string;              // yyyy-mm-dd
  items: ParsedItem[];
  subtotalPaise: Money | null;   // as printed, if any
  taxLines: ChargeLine[];        // CGST / SGST / IGST / GST / VAT ...
  taxPaise: Money;
  taxIncluded: boolean;          // tax is already inside the item prices -> do NOT add it again
  serviceChargePaise: Money;
  discountPaise: Money;          // positive number = amount taken off
  roundOffPaise: Money;          // signed
  detectedTotalPaise: Money | null;
  computedTotalPaise: Money;
  totalPaise: Money;             // detected ?? computed
  totalWasComputed: boolean;     // true -> ask the user to confirm (test case 5)
  warnings: ParseWarning[];
}

// ---------- Pipeline contract ----------
export type ScanErrorCode = 'UNSUPPORTED_FILE' | 'IMAGE_DECODE_FAILED' | 'OCR_ENGINE_FAILED' | 'UNKNOWN';
export interface ScanError { code: ScanErrorCode; message: string; recoverable: true }

export interface ScanProgress {
  stage: 'preparing' | 'loading-engine' | 'recognizing' | 'retrying' | 'parsing' | 'done';
  overall: number;               // 0..1, drop straight into <progress>
  message: string;
}
