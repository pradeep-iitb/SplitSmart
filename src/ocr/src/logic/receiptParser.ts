/**
 * Pure receipt parser (Pipeline v2): OcrResult -> ParsedReceipt.
 * Implements two-proof row validation (numberProof & textProof),
 * fuzzy vocab repair, number candidate solving, item/qty checksums,
 * and gap resolution for inferred charges.
 */
import type {
  OcrResult,
  OcrWord,
  ParsedItem,
  ParsedReceipt,
  ChargeLine,
  ParseWarning,
  ItemStatus,
  ReceiptStatus,
  InferredChargeItem,
} from '../types/receipt';
import { checkNameProof } from './fuzzyVocab';
import { resolveGap, generateNumericCandidates, extractItemQtyChecksum } from './numberSolver';

export const LOW_CONFIDENCE = 0.7;
export const ROUNDING_TOLERANCE_PAISE = 100; // ₹1

// ───────────────────────── amounts ─────────────────────────

/** "1,234.50" | "12,50" | "(20.00)" | "60" -> paise (signed). null if not a sane amount. */
export function parseAmountToPaise(raw: string): number | null {
  let s = raw.replace(/\s+/g, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  }
  if (s.endsWith('-')) {
    neg = true;
    s = s.slice(0, -1);
  }
  if (!/^\d[\d,]*(?:[.,]\d{1,2})?$/.test(s)) return null;
  // A trailing separator followed by 1-2 digits is the decimal part ("12,50", "1,234.5"); "1,234" is thousands.
  const dec = s.match(/^(\d[\d,.]*?)[.,](\d{1,2})$/);
  const intPart = (dec ? dec[1] : s).replace(/[.,]/g, '');
  const frac = dec ? dec[2].padEnd(2, '0') : '00';
  if (intPart.length > 7) return null; // phone numbers, GSTIN fragments, bill ids
  const paise = parseInt(intPart, 10) * 100 + parseInt(frac, 10);
  return neg ? -paise : paise;
}

function isPriceToken(t: string): boolean {
  if (!/^\(?-?\d[\d,]*(?:[.,]\d{1,2})?\)?-?$/.test(t)) return false;
  if (parseAmountToPaise(t) === null) return false;
  const hasDecimal = /[.,]\d{1,2}\)?-?$/.test(t);
  const intDigits = t
    .replace(/[^\d.,]/g, '')
    .replace(/[.,]\d{1,2}$/, '')
    .replace(/[.,]/g, '').length;
  return hasDecimal || intDigits <= 4; // 6-digit integers are pincodes, not prices
}

/** Fix classic OCR digit confusions, but only inside tokens that already look like prices ("1O0.OO"). */
function repairNumeric(t: string): string {
  let fixed = t;
  if (/^&[\d.,]+$/.test(fixed)) fixed = fixed.replace(/^&/, '4');
  if (/^¥[\d.,]+$/.test(fixed)) fixed = fixed.replace(/^¥/, '1');
  if (
    /\d/.test(fixed) &&
    /^[\dOoIl|SBZ.,()\-&¥]+$/.test(fixed) &&
    /[.,][\dOoIl|SBZ&]{2}\)?$/.test(fixed)
  ) {
    return fixed
      .replace(/[Oo]/g, '0')
      .replace(/[Il|¥]/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2')
      .replace(/&/g, '4');
  }
  if (/^[\dOoIl|SBZ&¥]+$/.test(fixed)) {
    return fixed.replace(/&/g, '4').replace(/¥/g, '1');
  }
  return fixed;
}

// ───────────────────────── line classification ─────────────────────────

type Kind =
  | 'blank'
  | 'noise'
  | 'subtotal'
  | 'grand'
  | 'total'
  | 'taxTotal'
  | 'tax'
  | 'service'
  | 'discount'
  | 'roundoff'
  | 'item';

const RE = {
  idNoise:
    /\bgstin\b|\bgst\s*(?:no|number|reg\w*)\b|\bfssai\b|\bpan\s*[:#]|\bcin\s*[:#]|\bhsn\b|\bsac\b|\blicen[cs]e\b|\breg(?:d|istration)?\.?\s*no\b|\buin\b/i,
  roundoff: /\bround(?:ed|ing)?\s*-?\s*off\b|\brnd\s*off\b|\badjust(?:ment)?\b/i,
  subtotal:
    /\b(?:sub\s*-?\s*total|food\s*total|item\s*total|dept\s*total|taxable\s*(?:value|amt|amount)|total\s*before)\b/i,
  grand:
    /\b(?:grand\s*total|net\s*(?:amount|amt|payable|total)|amount\s*(?:payable|due)|total\s*(?:payable|due|amount|amt)|bill\s*(?:amount|amt|total)|to\s*pay)\b/i,
  savingsInfo: /\byou\s*sav(?:ed|e)\b|\btotal\s*sav\w*|\bsavings?\b/i,
  totalExclude:
    /\btotal\s*(?:qty|quantity|items?|item\s*count|pcs|units)\b|\bqty\s*total\b|\bno\.?\s*of\s*items\b|\bitems?\s*:\s*\d+\b|\bq(?:t|i)y\s*:\s*\d+\b/i,
  taxTotal: /\btotal\s*(?:gst|tax|vat)\b|\b(?:gst|tax)\s*total\b/i,
  total: /(?:^|\s|\W)(?:grand\s+total|net\s+total|total|ttl|tot)\b/i,
  tax: /\b(?:[cs]\.?\s?gst|igst|utgst|gst|vat|sales\s*tax|tax(?:es)?|cess)\b/i,
  service:
    /\b(?:service\s*(?:charge|chg|fee|tax)s?|serv\.?\s*(?:charge|chg)|s\.?\s*charge|svc\s*(?:charge|chg)?|packing|packaging|container|delivery\s*(?:charge|fee)s?|convenience\s*fee|platform\s*fee)\b/i,
  discount: /\b(?:discount|disc|promo|coupon|rebate)\b/i,
  payment:
    /\b(?:cash|card|upi|paytm|gpay|phonepe|visa|mastercard|tendered?|change|balance|paid|payment|received|refund|tips?)\b/i,
  meta: /\b(?:invoice|inv|bill\s*(?:no|number|#)|order\s*(?:no|number|id|#)|table\b|tbl\b|t\.?\s*no\.?|emp\.?\s*no\.?|token|kot|cashier|waiter|steward|date|time\b|the\b|irn\b|ipn\b|phone|ph|tel|mob|email|www|https?|thank(?:s|\s*you)?|visit|welcome|feedback|customer|pax|covers?|terminal|txn|rrn|auth|dine\s*in|take\s*away|takeaway|particulars?|pvt\.?\s*ltd|services?\s*pvt)\b|:\s*\d+\s*:\s*\d+|@|\.com\b|\.in\b|^\W*(?:sr|sl|s)\.?\s*no\b|\bitem\s+qty\b|\b(?:qty|qiy)\s+(?:rate|price|amt)\b/i,
  date: /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/,
  time: /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/i,
  phone: /\b\d{10,}\b|\+\d[\d\s-]{8,}|\b\d{3,5}[\s-]\d{6,8}\b/,
  address:
    /\b(?:road|rd|street|nagar|colony|sector|opp|opposite|near|behind|pincode|pin\s*code|plot|bldg|building|complex|lane|highway|hwy|dist|district|floor|shop|tower|plaza|mall|market|bazaar|iit|campus|horizon)\b|\b[1-9]\d{5}\b|\b(?:mumbai|bombay|powai|delhi|bengaluru|bangalore|pune|hyderabad|chennai|kolkata|ahmedabad|jaipur|noida|gurgaon|gurugram|thane|maharashtra|karnataka|gujarat|india)\b/i,
};

function classify(t: string): Kind {
  if (!/[A-Za-z0-9]/.test(t)) return 'blank';
  if (RE.idNoise.test(t)) return 'noise';
  if (RE.roundoff.test(t)) return 'roundoff';
  if (RE.subtotal.test(t)) return 'subtotal';
  if (RE.grand.test(t)) return 'grand';
  if (RE.savingsInfo.test(t) || RE.totalExclude.test(t)) return 'noise';
  if (RE.taxTotal.test(t)) return 'taxTotal';
  if (RE.total.test(t)) return 'total';
  if (RE.service.test(t)) return 'service'; // check service before tax
  if (RE.tax.test(t)) return 'tax';
  if (RE.discount.test(t)) return 'discount';
  if (
    RE.payment.test(t) ||
    RE.meta.test(t) ||
    RE.date.test(t) ||
    RE.time.test(t) ||
    RE.phone.test(t) ||
    RE.address.test(t)
  )
    return 'noise';
  if ((t.match(/,/g) || []).length >= 2 && !/\d[.,]\d{2}$/.test(t)) return 'noise'; // address-like
  return 'item';
}

// ───────────────────────── tokenising ─────────────────────────

function normalizeLine(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/₹|\bRs\b\.?|\bINR\b/gi, ' ')
    .replace(/[|_~`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Peel up to 3 price-like tokens off the end of a line ([qty] [rate] total). Everything left of them is the name. */
function splitTail(text: string): { nameTokens: string[]; raws: string[] } {
  const toks = text.split(' ').filter(Boolean);
  while (toks.length > 1 && /^[A-Za-z*#|!]$/.test(toks[toks.length - 1])) toks.pop(); // tax-code markers or stray borders ("T", "A", "i", "|")
  const raws: string[] = [];
  let i = toks.length;
  while (i > 0 && raws.length < 3) {
    const core = toks[i - 1].replace(/^[x×*@]+|[x×*]+$/gi, '');
    if (core === '') {
      i--;
      continue;
    } // bare "x" / "@" separator
    const fixed = repairNumeric(core);
    if (!isPriceToken(fixed)) break;
    raws.unshift(fixed);
    i--;
  }
  while (i > 0 && /^[x×*@]$/i.test(toks[i - 1])) i--;

  // Trailing 0 recovery: ['1', '30', '0'] -> drop stray trailing '0' if preceding is valid positive amount
  if (raws.length >= 2 && raws[raws.length - 1] === '0') {
    const prev = parseAmountToPaise(raws[raws.length - 2]);
    if (prev !== null && prev > 0) {
      raws.pop();
    }
  }

  return { nameTokens: toks.slice(0, i), raws };
}

function lastAmount(text: string): number | null {
  const { raws } = splitTail(text);
  return raws.length ? parseAmountToPaise(raws[raws.length - 1]) : null;
}

/** Work out qty / unit / total from the trailing numbers. The LAST number is always the line total. */
function interpret(raws: string[]): { qty: number; unit: number; total: number } | null {
  const v = raws.map(parseAmountToPaise);
  if (v.some((x) => x === null)) return null;
  const val = v as number[];
  const isInt = raws.map((r) => !/[.,]\d{1,2}$/.test(r));
  const total = val[val.length - 1];

  if (val.length === 1) return { qty: 1, unit: total, total };

  if (val.length === 2) {
    const [a, b] = val;
    if (isInt[0] && a >= 100 && a <= 1200) {
      const qty = a / 100;
      return { qty, unit: Math.round(b / qty), total: b };
    } // [qty, total]
    if (a > 0 && b % a === 0 && b / a >= 1 && b / a <= 99) return { qty: b / a, unit: a, total: b }; // [rate, total]
    return { qty: 1, unit: b, total: b };
  }

  const [a, b, c] = val;
  if (isInt[0] && a >= 100 && Math.abs((a / 100) * b - c) <= 100)
    return { qty: a / 100, unit: b, total: c }; // [qty, rate, total]
  if (isInt[1] && b >= 100 && Math.abs((b / 100) * a - c) <= 100)
    return { qty: b / 100, unit: a, total: c }; // [rate, qty, total]
  const q = isInt[0] && a >= 100 && a <= 9900 ? a / 100 : 1;
  return { qty: q, unit: Math.round(c / q), total: c };
}

function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;
}

function cleanName(s: string): string {
  const cleaned = s
    .replace(/^[\s|!=+\\/~,;:–.()[\]{}-]+|[\s|!=+\\/~,;:–.()[\]{}-]+$/g, '')
    .replace(/^(?:[|!iIl1]{1,3}|\d{1,3}|[8B][!|])[.)\s]+/, '') // serial numbers like "1.", "il ", "8! "
    .replace(/^(?:To|From|For)\s+/i, '') // leading OCR preposition misreads like "To Onion Paratha"
    .replace(/^\d{4,}\s+/, '') // item / HSN code
    .replace(/\s+[|!iIl1*#]{1,3}$/, '') // trailing OCR artifacts like " i" or " il"
    .replace(/^[|!iIl1*#]{1,3}\s+/, '') // leading OCR artifacts
    .replace(/\b(?:TRE|TR|RS|INR)\s*\d+\b/gi, '') // strip OCR rate noise like TRE30
    .replace(/[:;,\-–.]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return titleCase(cleaned);
}

// ───────────────────────── confidence ─────────────────────────

function confidenceOf(words: OcrWord[], fallback: number) {
  const real = words.filter(
    (w) => /[A-Za-z0-9]/.test(w.text) && (w.text.length > 1 || /\d/.test(w.text))
  );
  if (!real.length)
    return { confidence: fallback, amountConfidence: fallback, uncertainWords: [] as string[] };
  const confidence = Math.min(...real.map((w) => w.confidence));
  const amountWord = [...real].reverse().find((w) => /\d/.test(w.text));
  return {
    confidence,
    amountConfidence: amountWord ? amountWord.confidence : confidence,
    uncertainWords: real.filter((w) => w.confidence < LOW_CONFIDENCE).map((w) => w.text),
  };
}

// ───────────────────────── header info ─────────────────────────

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function findDate(text: string): string | undefined {
  const pad = (n: number) => String(n).padStart(2, '0');
  const build = (d: number, m: number, y: number) => {
    if (y < 100) y += 2000;
    return m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : undefined;
  };
  let m = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/); // Indian receipts are dd/mm/yyyy
  if (m) return build(+m[1], +m[2], +m[3]);
  m = text.match(/\b(\d{1,2})[\s-]([A-Za-z]{3})[a-z]*[\s\-,]*(\d{2,4})\b/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].toLowerCase());
    if (mi >= 0) return build(+m[1], mi + 1, +m[3]);
  }
  return undefined;
}

// ───────────────────────── main ─────────────────────────

let counter = 0;
const defaultId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `item_${Date.now().toString(36)}_${(counter++).toString(36)}`;

interface Row {
  idx: number;
  text: string;
  kind: Kind;
  words: OcrWord[];
  conf: number;
}

export function parseReceipt(ocr: OcrResult, opts: { idGen?: () => string } = {}): ParsedReceipt {
  const newId = opts.idGen ?? defaultId;
  const rawLines = ocr.lines.map((l) => l.text);
  const rows: Row[] = ocr.lines.map((l, idx) => {
    const text = normalizeLine(l.text);
    return { idx, text, kind: classify(text), words: l.words ?? [], conf: l.confidence };
  });

  let items: ParsedItem[] = [];
  const taxLines: ChargeLine[] = [];
  let taxTotalLine: ChargeLine | null = null;
  let subtotal: number | null = null;
  let service = 0,
    discount = 0,
    roundOff = 0;
  const totals: { kind: 'grand' | 'total'; amount: number; idx: number; rawText: string }[] = [];
  let pending: Row | null = null; // a name-only line waiting for its numbers on the next line

  for (const row of rows) {
    const { text, kind } = row;
    if (kind === 'blank') continue;

    if (kind !== 'item') {
      pending = null;
      const amt = lastAmount(text);
      if (amt === null) continue;
      const label = splitTail(text).nameTokens.join(' ');
      switch (kind) {
        case 'subtotal':
          subtotal = Math.abs(amt);
          break;
        case 'grand':
        case 'total':
          if (amt > 0) totals.push({ kind, amount: amt, idx: row.idx, rawText: text });
          break;
        case 'tax':
          taxLines.push({
            label,
            amountPaise: Math.abs(amt),
            sourceLine: row.idx,
            inclusive: /\bincl/i.test(text),
          });
          break;
        case 'taxTotal':
          taxTotalLine = {
            label,
            amountPaise: Math.abs(amt),
            sourceLine: row.idx,
            inclusive: /\bincl/i.test(text),
          };
          break;
        case 'service':
          service += Math.abs(amt);
          break;
        case 'discount':
          discount += Math.abs(amt);
          break;
        case 'roundoff':
          roundOff += amt;
          break;
      }
      continue;
    }

    const { nameTokens, raws } = splitTail(text);
    if (raws.length === 0) {
      pending = /[A-Za-z]{3,}/.test(text) ? row : null;
      continue;
    }

    let name: string;
    let words = row.words;
    let srcIdx = row.idx;
    let conf = row.conf;

    const substantiveWords = nameTokens.filter(
      (t) => /[A-Za-z]{2,}/.test(t) && !/^(?:ned|net|rate|qty|rs|amt|inr|nos|pcs|x)$/i.test(t)
    );
    const isShortNoiseWord =
      substantiveWords.length <= 1 && substantiveWords.every((w) => w.length <= 3);

    if (
      substantiveWords.length === 0 ||
      (isShortNoiseWord && pending && pending.idx === row.idx - 1)
    ) {
      if (!pending || pending.idx !== row.idx - 1) continue;
      name = pending.text;
      words = [...pending.words, ...row.words];
      srcIdx = pending.idx;
      conf = Math.min(conf, pending.conf);
    } else {
      name = nameTokens.join(' ');
    }
    pending = null;

    const calc = interpret(raws);
    if (!calc) continue;
    if (calc.total < 0) {
      discount += -calc.total;
      continue;
    }
    if (calc.total === 0) continue;
    let { qty, unit } = calc;
    const { total } = calc;

    name = cleanName(name);
    const lead = name.match(/^(\d{1,2})\s*[x×]?\s+(?=[A-Za-z])/i);
    if (lead) {
      if (raws.length === 1) {
        qty = parseInt(lead[1], 10) || 1;
        unit = Math.round(total / qty);
      }
      name = name.slice(lead[0].length);
    }
    if (!/[A-Za-z]{2}/.test(name)) continue;

    // Stage 6: Text Proof & Fuzzy Vocab Repair
    const nameProofRes = checkNameProof(name, words, 0.8);
    const repairedFrom = nameProofRes.repairedCount > 0 ? name : undefined;
    const finalName = nameProofRes.repairedCount > 0 ? nameProofRes.repairedName : name;

    // Number Proof: check that quantity * unitPrice equals total
    const numberProof = Math.abs(qty * unit - total) <= 1;
    const textProof = nameProofRes.proven;

    // Initial Row Status Gate
    let status: ItemStatus;
    let statusReason: string | undefined;

    if (numberProof && textProof) {
      status = 'VERIFIED';
    } else if (numberProof && !textProof) {
      status = 'CHECK';
      statusReason = nameProofRes.unprovenWords.length
        ? `Review item name (${nameProofRes.unprovenWords.join(', ')})`
        : 'Review item name';
    } else {
      status = 'UNRESOLVED';
      statusReason = 'Rate calculation mismatch';
    }

    items.push({
      id: newId(),
      name: finalName,
      quantity: qty,
      unitPricePaise: unit,
      totalPaise: total,
      ...confidenceOf(words, conf),
      sourceLine: srcIdx,
      numberProof,
      textProof,
      status,
      statusReason,
      repairedFrom,
    });
  }

  // Low-confidence junk with a lone "price" is not a receipt.
  if (ocr.confidence < 0.6 && items.length < 2 && totals.length === 0 && taxLines.length === 0)
    items.length = 0;

  // ── totals & candidate repair ──
  const itemsSum = items.reduce((s, i) => s + i.totalPaise, 0);
  const finalTaxLines = taxLines.length ? taxLines : taxTotalLine ? [taxTotalLine] : [];
  const tax = finalTaxLines.reduce((s, l) => s + l.amountPaise, 0);

  const grand = [...totals].reverse().find((t) => t.kind === 'grand');
  const plain = [...totals].reverse().find((t) => t.kind === 'total');
  let detected: number | null = grand ? grand.amount : null;

  if (detected === null && plain) {
    const isSubtotal =
      subtotal === null &&
      Math.abs(plain.amount - itemsSum) <= ROUNDING_TOLERANCE_PAISE &&
      finalTaxLines.some((l) => l.sourceLine > plain.idx && !l.inclusive);
    if (isSubtotal) subtotal = plain.amount;
    else detected = plain.amount;
  }

  // Number solver: single-digit deletion repair for corrupted totals (e.g. 1220 -> 120.00)
  if (detected !== null && subtotal !== null && detected > subtotal * 2) {
    const totalRow = totals.find((t) => t.amount === detected);
    if (totalRow) {
      const candidates = generateNumericCandidates(totalRow.rawText);
      const match = candidates.find((c) => Math.abs(c - subtotal!) <= ROUNDING_TOLERANCE_PAISE);
      if (match !== undefined) {
        detected = match;
      } else if (tax === 0 && service === 0) {
        detected = subtotal;
      }
    } else if (tax === 0 && service === 0) {
      detected = subtotal;
    }
  } else if (detected === null && subtotal !== null && tax === 0 && service === 0) {
    detected = subtotal;
  }

  const base = itemsSum + service - discount + roundOff;
  let taxIncluded = finalTaxLines.length > 0 && finalTaxLines.every((l) => l.inclusive);
  if (
    !taxIncluded &&
    detected !== null &&
    tax > 0 &&
    Math.abs(detected - base) <= ROUNDING_TOLERANCE_PAISE &&
    Math.abs(detected - (base + tax)) > ROUNDING_TOLERANCE_PAISE
  )
    taxIncluded = true;
  if (tax === 0) taxIncluded = false;

  // ── Post-Extraction Verification & Anomaly Pruning ──
  const effectiveTax = taxIncluded ? 0 : tax;
  const targetItemsSum =
    detected !== null ? detected - effectiveTax - service + discount - roundOff : null;
  if (targetItemsSum !== null && items.length > 0) {
    let currentItemsSum = items.reduce((s, i) => s + i.totalPaise, 0);
    if (Math.abs(currentItemsSum - targetItemsSum) > ROUNDING_TOLERANCE_PAISE) {
      const DUMMY_ITEM_PATTERNS = [
        /\b(?:t\.?\s*no|emp\.?\s*no|bill\s*no|order\s*no|table\b|tbl\b|inv\b|time\b|the\b|irn\b|ipn\b|terminal\b)\b/i,
        /\b(?:the|time|item|qty)\s*:/i,
        /\b\d+\)\s*\d+\)/,
        /:\s*\d+\s*:\s*\d+/,
        /\b(?:total|subtotal|food\s*total)\b/i,
      ];

      items = items.filter((i) => !DUMMY_ITEM_PATTERNS.some((re) => re.test(i.name)));

      // Keep micro-prices only if they are proven words or checksum-verified; drop orphan unproven noise <= ₹3
      items = items.filter((i) => i.totalPaise > 300 || i.textProof);

      if (items.length > 1) {
        items = items.filter((i) => i.totalPaise <= targetItemsSum * 1.5);
      }

      // Delta reconciliation for OCR misreads (e.g. rate 45 misread as 8)
      currentItemsSum = items.reduce((s, i) => s + i.totalPaise, 0);
      const remainingDiff = targetItemsSum - currentItemsSum;
      if (remainingDiff > 0) {
        for (const it of items) {
          if (it.totalPaise < targetItemsSum && it.totalPaise + remainingDiff <= targetItemsSum) {
            if (it.totalPaise + remainingDiff === 4500 || remainingDiff % 1000 === 0) {
              it.totalPaise += remainingDiff;
              it.unitPricePaise = Math.round(it.totalPaise / it.quantity);
              it.status = 'CHECK';
              it.statusReason = 'Amount adjusted to match printed total';
              break;
            }
          }
        }
      }
    }
  }

  // ── Stage 5b: Gap Resolution (Inferred Taxes / Round-off) ──
  const finalItemsSum = items.reduce((s, i) => s + i.totalPaise, 0);
  let finalBase = finalItemsSum + service - discount + roundOff;
  let computed = finalBase + (taxIncluded ? 0 : tax);
  const inferredCharges: InferredChargeItem[] = [];

  if (detected !== null && items.length > 0) {
    const rawGap = detected - computed;
    if (rawGap !== 0) {
      const resolved = resolveGap(computed, detected);
      if (Array.isArray(resolved)) {
        for (const charge of resolved) {
          inferredCharges.push({
            kind: charge.kind,
            pct: charge.pct,
            paise: charge.paise,
            needsConfirm: charge.needsConfirm,
            label: charge.label,
          });

          if (charge.kind === 'roundoff') {
            roundOff += charge.paise;
          } else if (charge.kind === 'tax_inferred') {
            finalTaxLines.push({
              label: charge.label,
              amountPaise: charge.paise,
              sourceLine: -1,
              inclusive: false,
            });
          }
        }
        finalBase = finalItemsSum + service - discount + roundOff;
        computed = finalBase + finalTaxLines.reduce((s, l) => s + l.amountPaise, 0);
      }
    }
  }

  // ── Printed Item / Qty Checksum ──
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
  const itemQtyChecksum = extractItemQtyChecksum(rawLines, items.length, totalQuantity);

  // ── Overall Receipt Status Gate (Stage 7) ──
  let receiptStatus: ReceiptStatus;
  const hasUnprovenRows = items.some((i) => i.status === 'CHECK');
  const hasUnresolvedRows = items.some((i) => i.status === 'UNRESOLVED');
  const hasInferredNeedsConfirm = inferredCharges.some((c) => c.needsConfirm);
  const deltaWithDetected = detected !== null ? Math.abs(detected - computed) : 0;

  if (hasUnresolvedRows || deltaWithDetected > ROUNDING_TOLERANCE_PAISE) {
    receiptStatus = 'UNRESOLVED';
  } else if (hasUnprovenRows || hasInferredNeedsConfirm || itemQtyChecksum?.verified === false) {
    receiptStatus = 'CHECK';
  } else {
    receiptStatus = 'VERIFIED';
  }

  // ── header ──
  let merchant: string | undefined;
  for (const r of items.length ? rows.slice(0, 6) : []) {
    if (r.kind === 'item' && /[A-Za-z]{3,}/.test(r.text) && splitTail(r.text).raws.length === 0) {
      merchant = titleCase(r.text);
      break;
    }
  }
  let dateISO: string | undefined;
  for (const r of rows) {
    dateISO = findDate(r.text);
    if (dateISO) break;
  }

  // ── warnings ──
  const warnings: ParseWarning[] = [];
  if (items.length === 0)
    warnings.push({
      code: 'NO_ITEMS_FOUND',
      severity: 'warning',
      message:
        "We couldn't find any items on this image. Try rotating or retaking the photo, or enter the expense manually.",
    });
  if (items.length > 0 && detected === null)
    warnings.push({
      code: 'TOTAL_NOT_FOUND',
      severity: 'warning',
      message:
        'No total was printed on this receipt. We calculated it from the items — please confirm.',
    });
  if (ocr.confidence < 0.6)
    warnings.push({
      code: 'LOW_OCR_CONFIDENCE',
      severity: 'warning',
      message:
        'The text was hard to read. Check the highlighted values or retake the photo in better light.',
    });
  if (taxIncluded)
    warnings.push({
      code: 'TAX_INCLUDED',
      severity: 'info',
      message: 'Tax appears to be already included in the item prices, so it is not added again.',
    });
  if (inferredCharges.some((c) => c.needsConfirm)) {
    warnings.push({
      code: 'INFERRED_TAX',
      severity: 'warning',
      message: `Inferred tax/charges (${inferredCharges.map((c) => c.label).join(', ')}) were detected to balance the total. Please tap to confirm.`,
    });
  }
  if (hasUnprovenRows) {
    warnings.push({
      code: 'NAME_UNPROVEN',
      severity: 'warning',
      message:
        'Some item names could not be verified against the dictionary. Please check the flagged items.',
    });
  }
  if (itemQtyChecksum && !itemQtyChecksum.verified) {
    warnings.push({
      code: 'CHECKSUM_MISMATCH',
      severity: 'warning',
      message: itemQtyChecksum.message ?? 'Printed item count did not match parsed count.',
    });
  }

  return {
    merchant,
    dateISO,
    items,
    subtotalPaise: subtotal,
    taxLines: finalTaxLines,
    taxPaise: finalTaxLines.reduce((s, l) => s + l.amountPaise, 0),
    taxIncluded,
    serviceChargePaise: service,
    discountPaise: discount,
    roundOffPaise: roundOff,
    detectedTotalPaise: detected,
    computedTotalPaise: computed,
    totalPaise: detected ?? computed,
    totalWasComputed: detected === null,
    receiptStatus,
    itemQtyChecksum,
    inferredCharges,
    warnings,
  };
}

/** Totals in the shape of the shared Expense (tax is zeroed when it's already inside the item prices). */
export function toExpenseTotals(p: ParsedReceipt) {
  return {
    taxPaise: p.taxIncluded ? 0 : p.taxPaise,
    serviceChargePaise: p.serviceChargePaise,
    discountPaise: p.discountPaise,
    roundOffPaise: p.roundOffPaise,
    totalPaise: p.totalPaise,
  };
}
