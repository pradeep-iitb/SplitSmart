import { describe, expect, it, vi } from 'vitest';

vi.mock('./imagePreprocess', () => ({
  loadBitmap: vi.fn(async (blob: Blob) => {
    if (blob.size === 1) throw new Error('bad image');
    return { close: vi.fn() };
  }),
  preprocessToCanvas: vi.fn(() => ({ width: 100, height: 100 })),
}));
vi.mock('./ocrService', () => ({
  recognizeCanvas: vi.fn(async () => ({ confidence: 0.95, rotation: 0 })),
}));
vi.mock('./receiptParser', () => ({ parseReceipt: vi.fn(() => ({ items: [{ name: 'Coffee' }] })) }));
vi.mock('./receiptValidation', () => ({ validateParsed: vi.fn(() => ({ status: 'ok' })) }));

import { scanBatch } from './scanPipeline';

describe('multi-receipt scan', () => {
  it('keeps scanning after one receipt fails and reports progress per file', async () => {
    const progress: number[] = [];
    const results = await scanBatch(
      [new Blob(['x'], { type: 'image/png' }), new Blob(['valid'], { type: 'image/png' })],
      { onProgress: (index) => progress.push(index) },
    );
    expect(results[0].ok).toBe(false);
    expect(results[1].ok).toBe(true);
    expect(progress).toContain(0);
    expect(progress).toContain(1);
  });
});
