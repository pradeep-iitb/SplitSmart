import type { OcrResult } from '../types/receipt';

export interface ReceiptPerson {
  name: string;
  role: 'payer' | 'customer';
}

const NAME_LINE =
  /^\s*(paid\s+by|payer|customer(?:\s+name)?|bill\s+to)\s*[:-]\s*([A-Za-z][A-Za-z .'-]{1,60})\s*$/i;
const NON_NAMES = /^(?:cash|card|upi|online|guest|walk\s*in|self|counter|swiggy|zomato)$/i;

export function detectReceiptPeople(ocr: Pick<OcrResult, 'lines'>): ReceiptPerson[] {
  const found = new Map<string, ReceiptPerson>();
  for (const line of ocr.lines) {
    if (line.confidence < 0.55) continue;
    const match = line.text.match(NAME_LINE);
    if (!match) continue;
    const name = match[2].trim().replace(/\s+/g, ' ');
    if (name.length < 2 || NON_NAMES.test(name)) continue;
    const role = /^(?:paid\s+by|payer)$/i.test(match[1]) ? 'payer' : 'customer';
    found.set(name.toLocaleLowerCase(), { name, role });
  }
  return [...found.values()];
}

export function isKnownGroupMember(name: string, memberNames: string[]): boolean {
  const normalized = name.toLocaleLowerCase().replace(/[^a-z]/g, '');
  return memberNames.some(
    (member) => member.toLocaleLowerCase().replace(/[^a-z]/g, '') === normalized
  );
}
