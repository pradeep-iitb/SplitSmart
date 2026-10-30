import React, { useState } from 'react';
import { Download, Upload, Wallet, User, Check, RefreshCw, Trash2, Smartphone } from 'lucide-react';
import { getUserProfile, saveUserProfile, type UserProfile } from '../utils/userProfile';
import './settingsScreen.css';

type Props = {
  compact: boolean;
  onCompactChange: (value: boolean) => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onRecurring: () => void;
  onSplitStudio: () => void;
  onShare: () => void;
  onSaveProfile?: (profile: UserProfile) => Promise<void>;
  onClearAllData?: () => Promise<void>;
  onLoadDemoData?: () => Promise<void>;
};

export function SettingsScreen({
  compact,
  onCompactChange,
  onExportJson,
  onImportJson,
  onRecurring,
  onSplitStudio,
  onShare,
  onSaveProfile,
  onClearAllData,
  onLoadDemoData,
}: Props) {
  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile());
  const [profileSaved, setProfileSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.name.trim()) return;

    setIsSaving(true);
    saveUserProfile(profile);
    if (onSaveProfile) {
      await onSaveProfile(profile);
    }
    setIsSaving(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleClearData = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete all local data? This will remove all your groups, expenses, and settlements.'
      )
    ) {
      if (onClearAllData) {
        await onClearAllData();
      }
    }
  };

  const handleLoadDemo = async () => {
    if (
      window.confirm(
        'Load the sample Goa Friends Vacation trip? This is useful for exploring SplitSmart features.'
      )
    ) {
      if (onLoadDemoData) {
        await onLoadDemoData();
      }
    }
  };

  return (
    <div className="ss-settings-page">
      <span className="ss-eyebrow">PREFERENCES</span>
      <h1>Settings & Profile</h1>
      <p>Configure your personal identity, manage local data, and control privacy.</p>

      <div className="ss-settings-grid">
        {/* User Identity & Profile Section */}
        <section className="ss-profile-card">
          <div className="ss-settings-heading">
            <span className="ss-icon-badge">
              <User size={20} />
            </span>
            <div>
              <h2>Your Profile Name</h2>
              <p>
                Set your name so all expenses, balances, CSV exports, and WhatsApp settlement copy
                messages refer to you by your real name instead of generic &quot;Me&quot;.
              </p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="ss-profile-form">
            <div className="ss-profile-field">
              <label htmlFor="user-name-input">Your Display Name</label>
              <input
                id="user-name-input"
                type="text"
                placeholder="e.g. Atharva, Rahul, Priya"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
              />
              <small>
                This name replaces &quot;Me&quot; across all shared reports and calculations.
              </small>
            </div>

            <div className="ss-profile-field">
              <label htmlFor="user-upi-input">Default UPI ID (Optional)</label>
              <input
                id="user-upi-input"
                type="text"
                placeholder="e.g. yourname@okhdfcbank"
                value={profile.upiId}
                onChange={(e) => setProfile({ ...profile, upiId: e.target.value })}
              />
              <small>
                Included in WhatsApp settlement summaries so friends can pay you easily.
              </small>
            </div>

            <button type="submit" className="primary" disabled={isSaving || !profile.name.trim()}>
              {profileSaved ? (
                <>
                  <Check size={16} /> Name Saved &amp; Updated in Records!
                </>
              ) : (
                'Save Profile Name'
              )}
            </button>
          </form>
        </section>

        {/* Local Storage & Backup Section */}
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

        {/* Appearance Section */}
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

        {/* Group Tools */}
        <section>
          <h2>Group tools</h2>
          <p>Keep track of repeating bills, build a detailed split, or share this group.</p>
          <button onClick={onRecurring}>Recurring expenses →</button>
          <button onClick={onSplitStudio}>Split Studio →</button>
          <button onClick={onShare}>Share and reports →</button>
        </section>

        {/* Fresh Start & Demo Management */}
        <section className="ss-danger-card">
          <h2>Data Management</h2>
          <p>
            SplitSmart starts 100% clean with zero mock data. You can clear your data or optionally
            load a sample demo trip anytime.
          </p>

          <button
            type="button"
            onClick={handleClearData}
            style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
          >
            <Trash2 size={16} /> Reset App &amp; Clear All Data
          </button>

          <button type="button" onClick={handleLoadDemo} style={{ color: '#cbd5e1' }}>
            <RefreshCw size={16} /> Load Sample Trip (Demo)
          </button>
        </section>

        {/* Offline availability */}
        <section>
          <h2>Offline availability</h2>
          <p>
            Your saved local data remains available in this browser. Receipt scanning runs locally
            after its OCR and classification assets are available.
          </p>
          <span className="ss-offline-ready">
            <Smartphone size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Local data ready
          </span>
        </section>
      </div>
    </div>
  );
}
