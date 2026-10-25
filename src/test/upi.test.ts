import { describe, expect, it } from 'vitest';
import {
  createUpiUri,
  generateQrCodeDataUrl,
  generateQrCodeSvg,
  isValidUpiId,
} from '../features/settlement/upi';
import type { SuggestedPayment } from '../types/domain';

describe('UPI Settle-Up Engine (upi.ts)', () => {
  it('validates UPI ID format properly', () => {
    expect(isValidUpiId('riya@okhdfcbank')).toBe(true);
    expect(isValidUpiId('arjun.99@sbi')).toBe(true);
    expect(isValidUpiId('merchant-pay@icici')).toBe(true);

    expect(isValidUpiId('invalid-upi')).toBe(false);
    expect(isValidUpiId('@okhdfcbank')).toBe(false);
    expect(isValidUpiId('riya@')).toBe(false);
    expect(isValidUpiId('')).toBe(false);
  });

  it('generates compliant UPI URI with rupee formatting and URL encoding', () => {
    const payment: SuggestedPayment = {
      fromMemberId: 'arjun',
      toMemberId: 'riya',
      amountPaise: 25050, // ₹250.50
    };

    const uri = createUpiUri(
      payment,
      'riya@okhdfcbank',
      'Dinner split & taxi',
      'Riya Sharma'
    );

    expect(uri.startsWith('upi://pay?')).toBe(true);

    const parsed = new URL(uri);
    expect(parsed.searchParams.get('pa')).toBe('riya@okhdfcbank');
    expect(parsed.searchParams.get('pn')).toBe('Riya Sharma');
    expect(parsed.searchParams.get('am')).toBe('250.50');
    expect(parsed.searchParams.get('cu')).toBe('INR');
    expect(parsed.searchParams.get('tn')).toBe('Dinner split & taxi');
  });

  it('generates offline QR code Data URL and SVG', async () => {
    const uri = 'upi://pay?pa=riya@okhdfcbank&pn=Riya&am=100.00&cu=INR&tn=Test';

    const dataUrl = await generateQrCodeDataUrl(uri);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const svg = await generateQrCodeSvg(uri);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.includes('</svg>')).toBe(true);
  });
});
