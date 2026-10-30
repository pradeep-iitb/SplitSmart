import { useEffect } from 'react';
import { Camera, Download, PenLine, X } from 'lucide-react';
import './quickExpenseChooser.css';

type Props = {
  onClose: () => void;
  onManual: () => void;
  onScan: () => void;
  onScanFiles: (files: File[]) => void;
};

export function QuickExpenseChooser({ onClose, onManual, onScan, onScanFiles }: Props) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="ss-quick-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="ss-quick-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ss-quick-title"
      >
        <div className="ss-quick-heading">
          <div>
            <span className="ss-quick-eyebrow">NEW EXPENSE</span>
            <h2 id="ss-quick-title">How would you like to add it?</h2>
            <p>Scan for speed, or enter the details yourself.</p>
          </div>
          <button
            type="button"
            className="ss-quick-close"
            onClick={onClose}
            aria-label="Close quick expense"
          >
            <X size={20} />
          </button>
        </div>
        <div className="ss-quick-options">
          <button type="button" className="active" onClick={onScan}>
            <Camera size={17} /> Scan receipt
          </button>
          <button type="button" onClick={onManual}>
            <PenLine size={17} /> Manual expense
          </button>
        </div>
        <div className="ss-quick-scan">
          <div className="ss-quick-upload">
            <span className="ss-quick-icon">
              <Camera size={27} />
            </span>
            <h3>Drop a receipt here</h3>
            <p>Upload a clear JPG or PNG, or use your phone camera.</p>
            <div>
              <label>
                <Camera size={16} /> Take photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length) onScanFiles(files);
                  }}
                />
              </label>
              <label>
                <Download size={16} /> Choose file
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length) onScanFiles(files);
                  }}
                />
              </label>
            </div>
            <small>Good lighting and a flat receipt give the best result.</small>
            <button className="ss-quick-live-camera" type="button" onClick={onScan}>
              Use live scanner →
            </button>
          </div>
          <aside>
            <Camera size={16} />
            <span>
              <strong>Camera not available?</strong>
              <p>You can upload an image or switch to manual entry at any time.</p>
            </span>
          </aside>
        </div>
      </section>
    </div>
  );
}
