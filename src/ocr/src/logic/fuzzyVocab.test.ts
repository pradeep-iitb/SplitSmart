import { describe, expect, it } from 'vitest';
import { damerauLevenshtein, checkNameProof } from './fuzzyVocab';

describe('damerauLevenshtein', () => {
  it('handles exact matches', () => {
    expect(damerauLevenshtein('franky', 'franky')).toBe(0);
    expect(damerauLevenshtein('masala', 'masala')).toBe(0);
  });

  it('detects single substitution with OCR confusion discount', () => {
    // 'r' -> 'n' in frarky -> franky
    const d = damerauLevenshtein('frarky', 'franky');
    expect(d).toBeLessThanOrEqual(1.0);
  });

  it('detects transpositions', () => {
    expect(damerauLevenshtein('chesee', 'cheese')).toBeLessThan(1.0);
  });
});

describe('checkNameProof', () => {
  it('proves exact vocab items', () => {
    const res = checkNameProof('Veg Cheese Pizza', [
      { text: 'Veg', confidence: 0.9, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      { text: 'Cheese', confidence: 0.9, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      { text: 'Pizza', confidence: 0.9, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
    ]);
    expect(res.proven).toBe(true);
    expect(res.unprovenWords).toHaveLength(0);
  });

  it('fuzzy repairs FRARKY to FRANKY and proves it', () => {
    const res = checkNameProof('Veg Cheese Frarky', [
      { text: 'Veg', confidence: 0.9, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      { text: 'Cheese', confidence: 0.9, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      { text: 'Frarky', confidence: 0.6, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
    ]);
    expect(res.proven).toBe(true);
    expect(res.repairedName).toBe('Veg Cheese Franky');
  });

  it('flags unproven low-confidence word like SWRIR in Swrir Chi. Masala', () => {
    const res = checkNameProof('Swrir Chi. Masala', [
      { text: 'SWRIR', confidence: 0.1, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      { text: 'CHI.', confidence: 0.5, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      { text: 'MASALA', confidence: 0.5, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
    ]);
    expect(res.unprovenWords).toContain('Swrir');
    // Swrir has conf 0.1 and no vocab match, so it is recorded as unproven
    expect(res.words.find((w) => w.raw === 'Swrir')?.proven).toBe(false);
  });

  it('accepts unfamiliar word if OCR confidence is high (>= 0.80)', () => {
    const res = checkNameProof('Special Gourmet Delicacy', [
      { text: 'Special', confidence: 0.9, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      { text: 'Gourmet', confidence: 0.88, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      { text: 'Delicacy', confidence: 0.85, bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
    ]);
    expect(res.proven).toBe(true);
    expect(res.unprovenWords).toHaveLength(0);
  });
});
