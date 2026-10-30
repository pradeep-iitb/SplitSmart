/// <reference lib="webworker" />
/**
 * Zero-shot item categorisation with Xenova/mobilebert-uncased-mnli (Transformers.js).
 * Lives in its own worker and loads lazily on first use, so it never blocks the first screen.
 * npm i @huggingface/transformers   (@xenova/transformers v2 works too: change the import)
 */
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false; // fetch weights from the HF hub; the browser cache keeps them for next time
env.useBrowserCache = true;
env.useWasmCache = true;
env.cacheKey = 'splitsmart-transformers-v1';

// Descriptive hypotheses work much better than bare words with an MNLI model.
const LABELS: Record<string, string> = {
  'food or drink from a restaurant or canteen': 'Food',
  'groceries or household supplies': 'Groceries',
  'travel or transport': 'Travel',
  'utility bill, internet or recharge': 'Utilities',
  'entertainment or leisure': 'Entertainment',
  'something else': 'Other',
};

const ctx = self as unknown as DedicatedWorkerGlobalScope;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let classifier: any = null;

async function load() {
  if (classifier) return classifier;
  ctx.postMessage({ type: 'status', status: 'loading' });
  classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    progress_callback: (p: any) => {
      if (p?.status === 'progress')
        ctx.postMessage({ type: 'status', status: 'downloading', progress: p.progress });
    },
  });
  ctx.postMessage({ type: 'status', status: 'ready' });
  return classifier;
}

ctx.onmessage = async (e: MessageEvent<{ id: number; texts: string[] }>) => {
  const { id, texts } = e.data;
  try {
    const clf = await load();
    const results = [];
    for (const t of texts) {
      const r = await clf(t, Object.keys(LABELS));
      results.push({ category: LABELS[r.labels[0]], score: r.scores[0] as number });
    }
    ctx.postMessage({ type: 'result', id, results });
  } catch (err) {
    ctx.postMessage({ type: 'error', id, message: String(err) });
  }
};
