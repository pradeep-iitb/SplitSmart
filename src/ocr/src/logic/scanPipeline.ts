/**
 * Public entry points for the rest of the app:
 *   scanReceipt(file, opts)  -> ScanOutcome   (never throws; errors are recoverable values)
 *   scanBatch(files, opts)   -> ScanOutcome[] (one bad image never kills the batch)
 */
import type {
  OcrResult,
  ParsedReceipt,
  ScanError,
  ScanErrorCode,
  ScanProgress,
} from '../types/receipt';
import { loadBitmap, preprocessToCanvas } from './imagePreprocess';
import type { PreprocessMode, Rotation } from './imagePreprocess';
import { recognizeCanvas } from './ocrService';
import type { RawProgress } from './ocrService';
import { parseReceipt } from './receiptParser';
import { validateParsed } from './receiptValidation';
import type { ValidationResult } from './receiptValidation';

export type ScanOutcome =
  | { ok: true; ocr: OcrResult; parsed: ParsedReceipt; validation: ValidationResult }
  | { ok: false; error: ScanError };

export interface ScanOptions {
  /** Explicit rotation from the user's "rotate" button. When set, auto-rotation is skipped. */
  rotation?: Rotation;
  /** Single pass only (no orientation / binarisation retries). */
  fast?: boolean;
  onProgress?: (p: ScanProgress) => void;
}

const GOOD_ENOUGH = 0.6;
const fail = (code: ScanErrorCode, message: string): ScanOutcome => ({
  ok: false,
  error: { code, message, recoverable: true },
});

function mapProgress(p: RawProgress, stage: ScanProgress['stage'], label: string): ScanProgress {
  const s = p.status;
  if (s === 'recognizing text') return { stage, overall: 0.2 + 0.75 * p.progress, message: label };
  if (s.includes('traineddata'))
    return {
      stage: 'loading-engine',
      overall: 0.08 + 0.12 * p.progress,
      message: 'Downloading language data (first time only)…',
    };
  return {
    stage: 'loading-engine',
    overall: s.includes('core') ? 0.05 : 0.1,
    message: 'Starting OCR engine…',
  };
}

export async function scanReceipt(file: Blob, opts: ScanOptions = {}): Promise<ScanOutcome> {
  const emit = opts.onProgress ?? (() => undefined);
  if (file.type && !/^image\/(jpeg|png|webp)$/.test(file.type))
    return fail('UNSUPPORTED_FILE', 'Please choose a JPG or PNG photo of the receipt.');

  emit({ stage: 'preparing', overall: 0.02, message: 'Preparing image…' });
  let bitmap: ImageBitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    return fail('IMAGE_DECODE_FAILED', "We couldn't read that image. Try another photo.");
  }

  const pass = (
    rotation: Rotation,
    mode: PreprocessMode,
    label: string,
    stage: ScanProgress['stage']
  ) =>
    recognizeCanvas(
      preprocessToCanvas(bitmap, { rotation, mode }),
      { rotation, preprocess: mode },
      (p) => emit(mapProgress(p, stage, label))
    );

  try {
    let best = await pass(opts.rotation ?? 0, 'raw', 'Reading receipt…', 'recognizing');

    if (!opts.fast) {
      // Sideways photo? Garbage text => low confidence. Try the other orientations and keep the best.
      if (opts.rotation === undefined && best.confidence < GOOD_ENOUGH) {
        for (const r of [90, 270] as const) {
          const alt = await pass(
            r,
            'raw',
            'Low confidence — trying another orientation…',
            'retrying'
          );
          if (alt.confidence > best.confidence + 0.1) best = alt;
        }
      }
      // Faded thermal paper? A local-contrast pass often rescues it.
      if (best.confidence < 0.6) {
        const altGray = await pass(
          best.rotation,
          'gray',
          'Enhancing contrast and retrying…',
          'retrying'
        );
        if (altGray.confidence > best.confidence + 0.05) best = altGray;
      }
      if (best.confidence < 0.6) {
        const alt = await pass(
          best.rotation,
          'binarized',
          'Enhancing contrast and retrying…',
          'retrying'
        );
        if (alt.confidence > best.confidence) best = alt;
      }
    }

    emit({ stage: 'parsing', overall: 0.97, message: 'Finding items and prices…' });
    const parsed = parseReceipt(best);
    emit({ stage: 'done', overall: 1, message: 'Done' });
    return { ok: true, ocr: best, parsed, validation: validateParsed(parsed) };
  } catch (e) {
    console.error('[scanReceipt]', e);
    return fail(
      'OCR_ENGINE_FAILED',
      "The OCR engine couldn't start. On first use it needs an internet connection to download its data — check your connection and try again, or enter the expense manually."
    );
  } finally {
    bitmap.close();
  }
}

export async function scanBatch(
  files: Blob[],
  opts: {
    rotation?: Rotation;
    fast?: boolean;
    onProgress?: (fileIndex: number, p: ScanProgress) => void;
  } = {}
): Promise<ScanOutcome[]> {
  const out: ScanOutcome[] = [];
  for (let i = 0; i < files.length; i++) {
    // sequential on purpose: one engine, bounded memory on phones
    out.push(
      await scanReceipt(files[i], {
        rotation: opts.rotation,
        fast: opts.fast,
        onProgress: (p) => opts.onProgress?.(i, p),
      })
    );
  }
  return out;
}
