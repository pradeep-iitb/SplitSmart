import React, { useEffect, useState } from 'react';
import type { Member, SuggestedPayment } from '../../../types/domain';
import { formatPaise } from '../balances';
import { createUpiUri, generateQrCodeDataUrl, isValidUpiId } from '../upi';
import { MemberAvatar } from '../../groups/components/MemberAvatar';
import { X, QrCode, Check, Copy, ExternalLink, CreditCard, AlertCircle } from 'lucide-react';

interface UpiPaymentModalProps {
  payment: SuggestedPayment | null;
  payee: Member | undefined;
  payer: Member | undefined;
  onClose: () => void;
  onConfirmSettlement: (payment: SuggestedPayment, note?: string) => void;
  onUpdatePayeeUpiId?: (memberId: string, newUpiId: string) => void;
}

export const UpiPaymentModal: React.FC<UpiPaymentModalProps> = ({
  payment,
  payee,
  payer,
  onClose,
  onConfirmSettlement,
  onUpdatePayeeUpiId,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [customUpi, setCustomUpi] = useState<string | null>(null);
  const [isEditingUpi, setIsEditingUpi] = useState(false);

  const activeUpiId = customUpi !== null ? customUpi : payee?.upiId || '';
  const upiValid = isValidUpiId(activeUpiId);

  const note = `SplitSmart: ${payer?.name || 'Debtor'} to ${payee?.name || 'Creditor'}`;
  const upiUri =
    payment && activeUpiId ? createUpiUri(payment, activeUpiId, note, payee?.name) : '';

  useEffect(() => {
    let isMounted = true;
    if (upiUri) {
      generateQrCodeDataUrl(upiUri, { width: 260, margin: 2 })
        .then((url) => {
          if (isMounted) setQrDataUrl(url);
        })
        .catch((err) => {
          console.error('Failed to generate QR code', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [upiUri]);

  if (!payment || !payee) return null;

  const handleCopyLink = () => {
    if (!upiUri) return;
    navigator.clipboard.writeText(upiUri);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyUpiId = () => {
    if (!activeUpiId) return;
    navigator.clipboard.writeText(activeUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSaveUpiId = () => {
    if (upiValid && onUpdatePayeeUpiId && payee) {
      onUpdatePayeeUpiId(payee.id, activeUpiId);
      setIsEditingUpi(false);
    }
  };

  const handleStartEditing = () => {
    if (customUpi === null) {
      setCustomUpi(payee?.upiId || '');
    }
    setIsEditingUpi(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl relative">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-100 text-base">Pay via UPI</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-center">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">
              Amount to Pay
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-0.5">
              {formatPaise(payment.amountPaise)}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <MemberAvatar member={payee} size="sm" />
              <span className="text-xs text-slate-300">
                Paying to <strong className="font-semibold text-slate-100">{payee.name}</strong>
              </span>
            </div>
          </div>

          {/* Payee UPI ID or Input */}
          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60 text-left">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-slate-400 uppercase">
                Payee UPI VPA:
              </span>
              {!isEditingUpi && (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="text-[11px] text-blue-400 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditingUpi || !payee.upiId ? (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={activeUpiId}
                    onChange={(e) => setCustomUpi(e.target.value)}
                    placeholder="e.g. mobile@upi or name@okaxis"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveUpiId}
                    disabled={!upiValid}
                    className="px-3 py-1 bg-blue-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium hover:bg-blue-500"
                  >
                    Save
                  </button>
                </div>
                {!upiValid && (
                  <p className="text-[11px] text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Enter a valid UPI ID (e.g. name@bank)
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-slate-200 break-all">
                  {activeUpiId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUpiId}
                  title="Copy UPI ID"
                  className="text-slate-400 hover:text-slate-200 p-1 ml-2"
                >
                  {copiedUpi ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-inner border border-slate-300 mx-auto max-w-[240px]">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="UPI Payment QR Code" className="w-48 h-48 rounded-lg" />
            ) : (
              <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <QrCode className="w-8 h-8 text-slate-300 animate-pulse" />
                <span>Enter a valid UPI ID above to generate QR</span>
              </div>
            )}
            <span className="text-[11px] font-semibold text-slate-700 mt-1 flex items-center gap-1">
              <span>Scan with GPay / PhonePe / Paytm</span>
            </span>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {upiUri ? (
              <a
                href={upiUri}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors shadow-md shadow-emerald-950/40"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in UPI Payment App</span>
              </a>
            ) : (
              <button
                disabled
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-slate-500 font-medium text-sm"
              >
                Set UPI ID to enable App Link
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                disabled={!upiUri}
                className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700/60 text-xs font-medium transition-colors"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy UPI URI</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  onConfirmSettlement(payment, 'Paid via UPI');
                  onClose();
                }}
                className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mark Paid</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
