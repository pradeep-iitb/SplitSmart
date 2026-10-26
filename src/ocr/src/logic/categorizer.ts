/**
 * Auto-categorisation (PS point 13).
 *  1. Instant keyword pass (no download, covers most canteen/grocery items).
 *  2. Lazy zero-shot model (worker) for whatever the keywords can't place.
 * If the model can't load (offline, blocked), items simply stay "Other" — the user can always override.
 */
import type { Category } from '../types/receipt';

const KEYWORDS: [Category, RegExp][] = [
  ['Utilities', /\b(wi-?fi|internet|broadband|recharge|electricity|water\s*bill|cylinder|dth|postpaid|prepaid|subscription)\b/i],
  ['Travel', /\b(cab|taxi|uber|ola|rapido|auto|bus|train|metro|flight|fuel|petrol|diesel|toll|parking|fare|ride)\b/i],
  ['Entertainment', /\b(movie|cinema|netflix|spotify|game|gaming|bowling|concert|club|arcade|karaoke|pub)\b/i],
  ['Food', /\b(pizza|burger|maggi|coffee|tea|chai|roll|biryani|thali|paneer|dosa|idli|samosa|sandwich|fries|juice|shake|cola|coke|pepsi|sprite|fanta|pasta|momos?|noodles|curry|naan|roti|paratha|ice\s*cream|cake|brownie|cookie|mocktail|lassi|soup|salad|wrap|nuggets|chicken|veg|manchurian|fried|combo|meal|snack|chips|chocolate|beer|wine|whisky|vodka|soda|lime)\b/i],
  ['Groceries', /\b(milk|bread|eggs?|rice|atta|flour|dal|oil|sugar|salt|soap|shampoo|detergent|vegetables?|fruits?|onion|potato|tomato|butter|cheese|curd|toothpaste|tissue|sanitizer|biscuits?|packet)\b/i],
];

export function keywordCategory(name: string): Category | null {
  for (const [cat, re] of KEYWORDS) if (re.test(name)) return cat;
  return null;
}

export type CategorizerStatus = 'loading-model' | 'downloading' | 'ready' | 'failed';
export interface CategorizeOptions {
  /** Called as soon as each item is categorised (keyword hits arrive synchronously-fast, model hits later). */
  onResult: (id: string, category: Category, source: 'keyword' | 'model') => void;
  onStatus?: (s: CategorizerStatus, progress?: number) => void;
  useModel?: boolean;
  minScore?: number;
}

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, { resolve: (r: { category: Category; score: number }[]) => void; reject: (e: Error) => void }>();
let statusCb: CategorizeOptions['onStatus'];

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/categorizer.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'status') statusCb?.(m.status === 'loading' ? 'loading-model' : m.status, m.progress);
      else if (m.type === 'result') { waiting.get(m.id)?.resolve(m.results); waiting.delete(m.id); }
      else if (m.type === 'error') { waiting.get(m.id)?.reject(new Error(m.message)); waiting.delete(m.id); }
    };
    worker.onerror = () => {
      waiting.forEach(w => w.reject(new Error('categorizer worker crashed')));
      waiting.clear(); worker?.terminate(); worker = null; // next call can retry
    };
  }
  return worker;
}

/** Only pass items the user has NOT already categorised/overridden. */
export async function categorizeItems(items: { id: string; name: string }[], opts: CategorizeOptions): Promise<void> {
  const unknown: { id: string; name: string }[] = [];
  for (const it of items) {
    const k = keywordCategory(it.name);
    if (k) opts.onResult(it.id, k, 'keyword'); else unknown.push(it);
  }
  if (!unknown.length || opts.useModel === false) { unknown.forEach(u => opts.onResult(u.id, 'Other', 'keyword')); return; }

  statusCb = opts.onStatus;
  try {
    const id = ++seq;
    const results = await new Promise<{ category: Category; score: number }[]>((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      getWorker().postMessage({ id, texts: unknown.map(u => u.name) });
    });
    results.forEach((r, i) => opts.onResult(unknown[i].id, r.score >= (opts.minScore ?? 0.35) ? r.category : 'Other', 'model'));
    opts.onStatus?.('ready');
  } catch {
    opts.onStatus?.('failed');
    unknown.forEach(u => opts.onResult(u.id, 'Other', 'keyword'));
  }
}

/** Optional: call on idle after the review screen mounts to pre-download the model. */
export function warmUpCategorizer(): void {
  try { getWorker().postMessage({ id: ++seq, texts: ['pizza'] }); } catch { /* ignore */ }
}
