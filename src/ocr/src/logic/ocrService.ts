/**
 * Tesseract.js wrapper. Tesseract.js already runs the engine in its own Web Worker,
 * so recognition never blocks the UI thread. One lazily-created worker is reused for all scans.
 *
 * Offline / PWA (Member 5): self-host the three assets and pass workerPath, corePath, langPath below.
 */
import { createWorker, OEM, PSM } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import type { OcrLine, OcrResult } from '../types/receipt';
import type { CanvasLike, PreprocessMode, Rotation } from './imagePreprocess';

export interface RawProgress {
  status: string;
  progress: number;
}

let workerPromise: Promise<Worker> | null = null;
let listener: ((p: RawProgress) => void) | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const w = await createWorker('eng', OEM.LSTM_ONLY, {
        logger: (m: RawProgress) => listener?.({ status: m.status, progress: m.progress }),
        // workerPath: '/tesseract/worker.min.js',
        // corePath: '/tesseract/core',
        // langPath: '/tesseract/lang',   // folder containing eng.traineddata.gz
      });
      await w.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // receipts are one uniform block of text
        preserve_interword_spaces: '1', // keeps the gap between item name and price columns
        user_defined_dpi: '300',
      });
      return w;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    }); // allow retry after a failed (e.g. offline) first load
  }
  return workerPromise;
}

/** Call when the capture screen opens so the first scan doesn't pay the engine download. */
export function warmUpOcr(): void {
  void getWorker().catch(() => undefined);
}

export async function disposeOcr(): Promise<void> {
  const p = workerPromise;
  workerPromise = null;
  if (p) await (await p.catch(() => null))?.terminate();
}

export async function recognizeCanvas(
  canvas: CanvasLike,
  meta: { rotation: Rotation; preprocess: PreprocessMode },
  onProgress?: (p: RawProgress) => void
): Promise<OcrResult> {
  listener = onProgress ?? null;
  try {
    const worker = await getWorker();
    // Tesseract.js v6 only returns lines/words if `blocks` output is requested.
    const { data } = await worker.recognize(canvas as never, {}, { blocks: true });
    return toOcrResult(data, canvas.width, canvas.height, meta);
  } finally {
    listener = null;
  }
}

interface TesseractWord {
  text?: string;
  confidence?: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractLine {
  text?: string;
  confidence?: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  words?: TesseractWord[];
}

interface TesseractBlock {
  paragraphs?: Array<{ lines?: TesseractLine[] | null }> | null;
}

interface TesseractData {
  text?: string;
  confidence?: number;
  lines?: TesseractLine[] | null;
  blocks?: TesseractBlock[] | null;
}

function toOcrResult(
  data: TesseractData,
  width: number,
  height: number,
  meta: { rotation: Rotation; preprocess: PreprocessMode }
): OcrResult {
  // v5 exposes data.lines directly; v6 nests blocks -> paragraphs -> lines.
  const rawLines: TesseractLine[] =
    Array.isArray(data.lines) && data.lines.length ? data.lines : [];
  if (!rawLines.length) {
    for (const b of data.blocks ?? [])
      for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) rawLines.push(l);
  }
  const lines: OcrLine[] = rawLines
    .map((l: TesseractLine) => ({
      text: String(l.text ?? '').replace(/\s+$/, ''),
      confidence: (l.confidence ?? 0) / 100,
      bbox: l.bbox,
      words: (l.words ?? []).map((w: TesseractWord) => ({
        text: String(w.text ?? ''),
        confidence: (w.confidence ?? 0) / 100,
        bbox: w.bbox,
      })),
    }))
    .filter((l: OcrLine) => l.text.trim().length > 0);
  return {
    text: data.text ?? '',
    confidence: (data.confidence ?? 0) / 100,
    lines,
    width,
    height,
    ...meta,
  };
}
