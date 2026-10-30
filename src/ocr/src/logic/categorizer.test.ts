import { afterEach, describe, expect, it, vi } from 'vitest';
import { categorizeItems } from './categorizer';

describe('receipt item categorization', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows keyword suggestions then sends every item to the model worker', async () => {
    const requests: string[][] = [];
    class FakeWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage(message: { id: number; texts: string[] }) {
        requests.push(message.texts);
        queueMicrotask(() =>
          this.onmessage?.({
            data: {
              type: 'result',
              id: message.id,
              results: [
                { category: 'Food', score: 0.96 },
                { category: 'Groceries', score: 0.92 },
              ],
            },
          } as MessageEvent)
        );
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
    const results: Array<[string, string, string]> = [];
    await categorizeItems(
      [
        { id: 'pizza', name: 'Pizza' },
        { id: 'mystery', name: 'Amaranth' },
      ],
      { onResult: (id, category, source) => results.push([id, category, source]) }
    );
    expect(requests).toEqual([['Pizza', 'Amaranth']]);
    expect(results).toEqual([
      ['pizza', 'Food', 'keyword'],
      ['pizza', 'Food', 'model'],
      ['mystery', 'Groceries', 'model'],
    ]);
  });
});
