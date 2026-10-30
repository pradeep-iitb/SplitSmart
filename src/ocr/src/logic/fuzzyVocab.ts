/**
 * Fuzzy vocabulary matcher with Damerau-Levenshtein distance and OCR-weighted costs.
 * Used for Stage 6 (Text Proof) of the SplitSmart OCR Pipeline v2.
 */
import type { OcrWord } from '../types/receipt';

// Comprehensive vocabulary covering Indian canteens, restaurants, and fast-food chains
export const FOOD_VOCABULARY = new Set([
  // Indian Canteen / Street Staples
  'franky',
  'frankie',
  'masala',
  'tikka',
  'paratha',
  'paneer',
  'pnr',
  'rice',
  'noodles',
  'sezwan',
  'schezwan',
  'chicken',
  'chi',
  'veg',
  'nonveg',
  'egg',
  'bhaji',
  'pav',
  'dosa',
  'idli',
  'vada',
  'sambar',
  'chutney',
  'chole',
  'bhature',
  'thali',
  'dal',
  'fry',
  'tadka',
  'roti',
  'naan',
  'kulcha',
  'biryani',
  'pulao',
  'curry',
  'makhani',
  'kadhai',
  'korma',
  'kofta',
  'chaat',
  'bhel',
  'puri',
  'sev',
  'pani',
  'lassi',
  'chaas',
  'maggi',
  'sandwich',
  'toast',
  'roll',
  'manchurian',
  'hakka',
  'chilli',
  'soup',
  'crispy',
  'momo',
  'momos',
  'papad',
  'raita',
  'pakoda',
  'samosa',
  'kachori',
  'poha',
  'upma',
  'uttapam',
  'jeera',
  'matar',
  'methi',
  'palak',
  'aloo',
  'gobi',
  'chana',
  'rajma',
  'kebab',
  'kabab',
  'tandoori',

  // Fast Food / Cafe / Continental
  'burger',
  'pizza',
  'margherita',
  'cheese',
  'onion',
  'capsicum',
  'tomato',
  'garlic',
  'bread',
  'fries',
  'wrap',
  'pasta',
  'sauce',
  'mayo',
  'mayonnaise',
  'dip',
  'coke',
  'pepsi',
  'sprite',
  'thums',
  'up',
  'fanta',
  'mirinda',
  'coffee',
  'tea',
  'chai',
  'latte',
  'cappuccino',
  'espresso',
  'water',
  'lime',
  'soda',
  'juice',
  'shake',
  'milkshake',
  'ice',
  'cream',
  'sundae',
  'brownie',
  'pastry',
  'cake',
  'combo',
  'meal',
  'snack',
  'box',
  'bucket',
  'nuggets',
  'strips',
  'wings',
  'peri',
  'whopper',
  'crisper',
  'patty',
  'flame',
  'grilled',
  'zinger',
  'twister',
  'krushers',

  // Modifiers & Sizing
  'double',
  'triple',
  'single',
  'mini',
  'regular',
  'large',
  'medium',
  'small',
  'extra',
  'spl',
  'special',
  'loaded',
  'spicy',
  'classic',
  'supreme',
  'deluxe',
  'fresh',
  'hot',
  'cold',
  'sweet',
  'salted',
  'fried',
  'baked',
  'roasted',
  'steamed',
  'butter',
  'plain',
]);

// Common OCR character substitution pairs with lower substitution penalty
const OCR_CONFUSIONS: Record<string, string[]> = {
  o: ['0', 'c', 'q'],
  '0': ['o', 'd'],
  i: ['1', 'l', '!', '|', 'j'],
  '1': ['i', 'l', '|', 't'],
  l: ['1', 'i', '|'],
  s: ['5', '$'],
  '5': ['s'],
  b: ['8', '6'],
  '8': ['b'],
  z: ['2'],
  '2': ['z'],
  rn: ['m'],
  m: ['rn', 'nn'],
  cl: ['d'],
  d: ['cl'],
  vv: ['w'],
  w: ['vv'],
  r: ['k', 'n'],
  k: ['r'],
};

/**
 * Calculates Damerau-Levenshtein distance with OCR substitution penalties.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // Distance matrix
  const d: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) d[i][0] = i;
  for (let j = 0; j <= len2; j++) d[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const char1 = s1[i - 1];
      const char2 = s2[j - 1];

      let cost = 0;
      if (char1 !== char2) {
        // Lower cost (0.6) for known OCR confusions
        const isConfusion =
          (OCR_CONFUSIONS[char1] && OCR_CONFUSIONS[char1].includes(char2)) ||
          (OCR_CONFUSIONS[char2] && OCR_CONFUSIONS[char2].includes(char1));
        cost = isConfusion ? 0.6 : 1.0;
      }

      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 0.8);
      }
    }
  }

  return d[len1][len2];
}

export interface WordProof {
  raw: string;
  repaired?: string;
  isVocabHit: boolean;
  distance: number;
  confidence: number;
  proven: boolean;
}

export interface NameProofResult {
  proven: boolean;
  repairedName: string;
  words: WordProof[];
  unprovenWords: string[];
  repairedCount: number;
}

/**
 * Evaluates whether an extracted item name passes Stage 6 (Text Proof).
 *
 * Rules:
 * - A word is proven if:
 *   1. It is an exact hit in the food vocabulary.
 *   2. Or it has a fuzzy match with distance <= max(1, floor(0.25 * word.length)).
 *   3. Or its raw OCR confidence is >= confidenceThreshold (default 0.80).
 * - A full item name is proven if all substantive words (len >= 3) are proven,
 *   or at least 65% of substantive words have proven vocab matches.
 */
export function checkNameProof(
  rawName: string,
  ocrWords: OcrWord[] = [],
  confidenceThreshold = 0.8
): NameProofResult {
  const tokens = rawName
    .replace(/[^\w\s.-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return {
      proven: false,
      repairedName: rawName,
      words: [],
      unprovenWords: [],
      repairedCount: 0,
    };
  }

  const wordProofs: WordProof[] = [];
  const repairedTokens: string[] = [];
  const unprovenWords: string[] = [];
  let repairedCount = 0;

  for (const token of tokens) {
    const clean = token.toLowerCase().replace(/[.,;:]/g, '');
    if (clean.length < 2) {
      // Very short connector tokens like "w/", "&" don't require proof
      repairedTokens.push(token);
      continue;
    }

    // Match corresponding OCR word for confidence
    const matchingWord = ocrWords.find(
      (w) => w.text.toLowerCase().includes(clean) || clean.includes(w.text.toLowerCase())
    );
    const conf = matchingWord ? matchingWord.confidence : 0.5;

    // 1. Exact vocab match
    if (FOOD_VOCABULARY.has(clean)) {
      wordProofs.push({
        raw: token,
        isVocabHit: true,
        distance: 0,
        confidence: conf,
        proven: true,
      });
      repairedTokens.push(token);
      continue;
    }

    // 2. Fuzzy vocab match
    let bestMatch: string | null = null;
    let minDistance = Infinity;
    const maxAllowedDist = Math.max(1, Math.floor(clean.length * 0.28));

    for (const vocabWord of FOOD_VOCABULARY) {
      // Only check if length difference is within allowable edit distance
      if (Math.abs(vocabWord.length - clean.length) > maxAllowedDist + 1) continue;
      const dist = damerauLevenshtein(clean, vocabWord);
      if (dist < minDistance && dist <= maxAllowedDist) {
        minDistance = dist;
        bestMatch = vocabWord;
      }
    }

    if (bestMatch && minDistance <= maxAllowedDist) {
      // Re-capitalize as original
      const isUpper = token === token.toUpperCase();
      const isTitle = /^[A-Z][a-z]/.test(token);
      let rep = bestMatch;
      if (isUpper) rep = rep.toUpperCase();
      else if (isTitle) rep = rep.charAt(0).toUpperCase() + rep.slice(1);

      wordProofs.push({
        raw: token,
        repaired: rep,
        isVocabHit: true,
        distance: minDistance,
        confidence: conf,
        proven: true,
      });
      repairedTokens.push(rep);
      repairedCount++;
      continue;
    }

    // 3. High OCR confidence fallback (word is unfamiliar, but OCR saw it clearly)
    const isHighConfidence = conf >= confidenceThreshold;
    const proven = isHighConfidence;

    wordProofs.push({
      raw: token,
      isVocabHit: false,
      distance: minDistance === Infinity ? clean.length : minDistance,
      confidence: conf,
      proven,
    });
    repairedTokens.push(token);

    if (!proven && clean.length >= 3) {
      unprovenWords.push(token);
    }
  }

  const substantiveWords = wordProofs.filter((w) => w.raw.length >= 3);
  const provenCount = substantiveWords.filter((w) => w.proven).length;
  const isOverallProven =
    substantiveWords.length === 0 ||
    unprovenWords.length === 0 ||
    (substantiveWords.length > 1 && provenCount / substantiveWords.length >= 0.67);

  return {
    proven: isOverallProven,
    repairedName: repairedTokens.join(' '),
    words: wordProofs,
    unprovenWords,
    repairedCount,
  };
}
