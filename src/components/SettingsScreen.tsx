import { Download, Upload, Wallet } from 'lucide-react';
import './settingsScreen.css';

type Props = {
  compact: boolean;
  onCompactChange: (value: boolean) => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onRecurring: () => void;
  onSplitStudio: () => void;
  onShare: () => void;
};

export function SettingsScreen({
  compact,
  onCompactChange,
  onExportJson,
  onImportJson,
  onRecurring,
  onSplitStudio,
  onShare,
}: Props) {
  return (
    <div className="ss-settings-page">
      <span className="ss-eyebrow">PREFERENCES</span>
      <h1>Settings & local data</h1>
      <p>Manage how SplitSmart looks, stores, and backs up your data.</p>
      <div className="ss-settings-grid">
        <section>
          <div className="ss-settings-heading">
            <span>
              <Wallet size={20} />
            </span>
            <div>
              <h2>Your data stays here</h2>
              <p>
                SplitSmart stores groups and expenses in this browser. Nothing is uploaded to a
                server.
              </p>
            </div>
          </div>
          <div className="ss-settings-warning">
            <strong>Back up before clearing browser data.</strong>
            <p>Export a JSON copy so you can restore your groups later.</p>
          </div>
          <button className="primary" onClick={onExportJson}>
            <Download size={17} /> Export group JSON
          </button>
          <button onClick={onImportJson}>
            <Upload size={17} /> Import JSON
          </button>
        </section>
        <section>
          <h2>Appearance</h2>
          <div className="ss-setting-row">
            <div>
              <strong>Compact layout</strong>
              <small>Show more information on desktop.</small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={compact}
              className={`ss-switch ${compact ? 'on' : ''}`}
              onClick={() => onCompactChange(!compact)}
              aria-label="Compact layout"
            >
              <i />
            </button>
          </div>
          <div className="ss-setting-row">
            <div>
              <strong>Theme</strong>
              <small>Dark mode is tuned for SplitSmart.</small>
            </div>
            <span>Dark</span>
          </div>
        </section>
        <section>
          <h2>Group tools</h2>
          <p>Keep track of repeating bills, build a detailed split, or share this group.</p>
          <button onClick={onRecurring}>Recurring expenses →</button>
          <button onClick={onSplitStudio}>Split Studio →</button>
          <button onClick={onShare}>Share and reports →</button>
        </section>
        <section>
          <h2>Offline availability</h2>
          <p>
            Your saved local data remains available in this browser. Receipt scanning runs locally
            after its OCR and classification assets are available.
          </p>
          <span className="ss-offline-ready">✓ Local data ready</span>
        </section>
      </div>
    </div>
  );
}
