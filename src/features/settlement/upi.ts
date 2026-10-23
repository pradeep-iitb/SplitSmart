import QRCode from 'qrcode';
import type { SuggestedPayment } from '../../types/domain';
import { paiseToRupees } from './balances';

/**
 * Validates a UPI ID format (e.g., user@bank, phone@upi, etc.).
 */
export function isValidUpiId(upiId: string): boolean {
  if (!upiId || typeof upiId !== 'string') return false;
  const trimmed = upiId.trim();
  // Standard UPI ID regex: characters@bank
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return upiRegex.test(trimmed);
}

/**
 * Generates an NPCI-compliant UPI URI for deep-linking into UPI payment apps
 * (Google Pay, PhonePe, Paytm, BHIM, etc.).
 *
 * PS Point 15: UPI settle-up
 *
 * Spec:
 * upi://pay?pa=<payeeAddress>&pn=<payeeName>&am=<amountInRupees>&cu=INR&tn=<transactionNote>
 */
export function createUpiUri(
  payment: SuggestedPayment,
  payeeUpiId: string,
  note = 'SplitSmart settlement',
  payeeName?: string
): string {
  const cleanUpi = payeeUpiId.trim();
  const amountRupees = paiseToRupees(payment.amountPaise).toFixed(2);
  const name = payeeName ? payeeName.trim() : 'SplitSmart Member';

  const params = new URLSearchParams();
  params.set('pa', cleanUpi);
  params.set('pn', name);
  params.set('am', amountRupees);
  params.set('cu', 'INR');
  params.set('tn', note);

  return `upi://pay?${params.toString()}`;
}

/**
 * Generates a data URL for a QR code representing the UPI URI.
 * Works 100% offline, fully client-side.
 */
export async function generateQrCodeDataUrl(
  text: string,
  options: {
    width?: number;
    margin?: number;
    color?: { dark: string; light: string };
  } = {}
): Promise<string> {
  const { width = 280, margin = 2, color = { dark: '#0f172a', light: '#ffffff' } } = options;
  return QRCode.toDataURL(text, {
    width,
    margin,
    color,
    errorCorrectionLevel: 'M',
  });
}

/**
 * Generates an SVG string for a QR code (ideal for sharp scaling and printing).
 */
export async function generateQrCodeSvg(
  text: string,
  options: {
    margin?: number;
    color?: { dark: string; light: string };
  } = {}
): Promise<string> {
  const { margin = 2, color = { dark: '#0f172a', light: '#ffffff' } } = options;
  return QRCode.toString(text, {
    type: 'svg',
    margin,
    color,
    errorCorrectionLevel: 'M',
  });
}
