import React, { useState } from 'react';
import type { Group } from '../../../types/domain';
import {
  exportGroupJson,
  encodeGroupToUrlHash,
  importGroupJson,
} from '../../sharing/sharingService';
import {
  X,
  Share2,
  Download,
  Upload,
  Copy,
  CheckCircle2,
  Link,
  FileJson,
  AlertCircle,
} from 'lucide-react';

interface BackupShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
  onImportSuccess: (importedGroupId: string) => void;
}

export const BackupShareModal: React.FC<BackupShareModalProps> = ({
  isOpen,
  onClose,
  group,
  onImportSuccess,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'export' | 'import' | 'url'>('url');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [shareableUrl, setShareableUrl] = useState<string>('');
  const [jsonText, setJsonText] = useState<string>('');
  const [importInput, setImportInput] = useState<string>('');
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Load URL & JSON on modal open
  React.useEffect(() => {
    if (!isOpen) return;

    (async () => {
      try {
        const hash = await encodeGroupToUrlHash(group.id);
        const origin = window.location.origin + window.location.pathname;
        setShareableUrl(`${origin}#${hash}`);

        const json = await exportGroupJson(group.id);
        setJsonText(json);
      } catch (err) {
        console.error('Failed to prepare backup/sharing:', err);
      }
    })();
  }, [isOpen, group.id]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(shareableUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(jsonText);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `splitsmart-${group.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().substring(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportInput(content);
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    setImportStatus(null);
    try {
      const importedId = await importGroupJson(importInput);
      setImportStatus({
        success: true,
        message: 'Group imported successfully into your local IndexedDB!',
      });
      setTimeout(() => {
        onImportSuccess(importedId);
        onClose();
      }, 1200);
    } catch (err) {
      setImportStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to import backup.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Share2 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Serverless Sharing & Backup</h2>
              <p className="text-xs text-slate-400">Export, import, or share without a server backend</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tab selection */}
        <div className="flex overflow-x-auto no-scrollbar border-b border-slate-800 px-4 sm:px-6 bg-slate-950/40">
          {[
            { id: 'url', label: '1-Click Share Link', icon: Link },
            { id: 'export', label: 'Export Backup JSON', icon: Download },
            { id: 'import', label: 'Import Group Backup', icon: Upload },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`py-3.5 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  active
                    ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* SubTab 1: 1-Click Serverless URL Sharing */}
          {activeSubTab === 'url' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 space-y-2">
                <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                  <Link className="w-4 h-4 text-blue-400" />
                  Instant Serverless Link Sharing
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The entire group state (members, expenses, split shares, settlements) is compressed directly into the URL hash. Anyone with this link can open and import the group into their local browser with zero backend or server upload!
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">
                  Shareable URL Hash:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareableUrl}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-300 font-mono text-[11px] truncate focus:outline-none"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {copiedUrl ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SubTab 2: Export JSON */}
          {activeSubTab === 'export' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-xs">
                Download a clean, structured JSON file of group <strong>"{group.name}"</strong> to keep a local backup or restore on another device.
              </p>

              <div className="relative">
                <textarea
                  readOnly
                  rows={8}
                  value={jsonText}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl p-4 font-mono text-[11px] text-slate-300 focus:outline-none no-scrollbar"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCopyJson}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1.5 border border-slate-700"
                >
                  {copiedJson ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Copied JSON!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/30"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .json File</span>
                </button>
              </div>
            </div>
          )}

          {/* SubTab 3: Import JSON */}
          {activeSubTab === 'import' && (
            <div className="space-y-4">
              <p className="text-slate-400 text-xs">
                Paste JSON text or upload a saved <code>.json</code> file to restore a group into your local IndexedDB.
              </p>

              {importStatus && (
                <div
                  className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
                    importStatus.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {importStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{importStatus.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">Upload file:</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              <textarea
                rows={6}
                placeholder="Or paste SplitSmart JSON backup content here..."
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 font-mono text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />

              <div className="flex justify-end">
                <button
                  onClick={handleImportSubmit}
                  disabled={!importInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
                >
                  <FileJson className="w-4 h-4" />
                  <span>Validate & Restore Group</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
