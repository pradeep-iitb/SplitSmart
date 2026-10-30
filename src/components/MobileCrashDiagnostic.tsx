import { useState } from 'react';
import { AlertTriangle, Bug, X, Copy, Check } from 'lucide-react';
import {
  getLastCrashReport,
  clearLastCrashReport,
  getRecentBreadcrumbs,
  type CrashReport,
  type Breadcrumb,
} from '../utils/persistentLogger';

export function MobileCrashDiagnostic() {
  const [report, setReport] = useState<CrashReport | null>(() => getLastCrashReport());
  const [isOpen, setIsOpen] = useState(() => Boolean(getLastCrashReport()));
  const [copied, setCopied] = useState(false);
  const [showLiveCrumbs, setShowLiveCrumbs] = useState(false);
  const [liveCrumbs, setLiveCrumbs] = useState<Breadcrumb[]>([]);

  function handleDismiss() {
    clearLastCrashReport();
    setReport(null);
    setIsOpen(false);
  }

  function handleOpenLiveDiagnostics() {
    setLiveCrumbs(getRecentBreadcrumbs());
    setShowLiveCrumbs(true);
  }

  async function handleCopy() {
    const dataToCopy = report
      ? JSON.stringify(report, null, 2)
      : JSON.stringify({ breadcrumbs: getRecentBreadcrumbs() }, null, 2);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(dataToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = dataToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  }

  return (
    <>
      {/* Floating Diagnostics Button on Mobile */}
      <button
        type="button"
        onClick={handleOpenLiveDiagnostics}
        title="Open Diagnostic Console"
        aria-label="Open Mobile Diagnostic Console"
        style={{
          position: 'fixed',
          bottom: '84px',
          right: '16px',
          zIndex: 9998,
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: report ? '#ef4444' : 'rgba(30, 41, 59, 0.85)',
          color: report ? '#ffffff' : '#94a3b8',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
        }}
      >
        {report ? <AlertTriangle size={18} /> : <Bug size={18} />}
      </button>

      {/* Top Banner Alert when Crash is Detected after Refresh */}
      {report && !isOpen && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: '12px',
            left: '12px',
            right: '12px',
            zIndex: 9999,
            backgroundColor: '#1c1917',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            padding: '12px 14px',
            color: '#fecaca',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
            <div style={{ overflow: 'hidden' }}>
              <strong style={{ display: 'block', fontSize: '13px', color: '#f87171' }}>
                Screen refreshed mid-process!
              </strong>
              <small
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#e2e8f0',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {report.message}
              </small>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              Inspect
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '4px',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Diagnostic Details Modal */}
      {(isOpen || showLiveCrumbs) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '85vh',
              backgroundColor: '#0f172a',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              border: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bug size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: 700 }}>
                  {report ? 'Crash Diagnostic Report' : 'Live Mobile Diagnostics'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowLiveCrumbs(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div
              style={{
                padding: '18px 20px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: 1.5,
                color: '#cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {report && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#f87171',
                      fontWeight: 700,
                      marginBottom: '6px',
                    }}
                  >
                    <AlertTriangle size={16} />
                    <span>Type: {report.type}</span>
                  </div>
                  <p style={{ margin: 0, color: '#fecaca', fontSize: '13px' }}>{report.message}</p>
                  {report.lastActiveOperation && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#fed7aa' }}>
                      <strong>Active Operation when wiped: </strong>
                      {report.lastActiveOperation.name}
                    </div>
                  )}
                </div>
              )}

              {/* Stack Trace if available */}
              {report?.stack && (
                <div>
                  <strong style={{ display: 'block', color: '#94a3b8', marginBottom: '6px' }}>
                    Error Stack Trace:
                  </strong>
                  <pre
                    style={{
                      margin: 0,
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: '#020617',
                      color: '#f43f5e',
                      fontSize: '11px',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {report.stack}
                  </pre>
                </div>
              )}

              {/* Breadcrumbs Timeline */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <strong style={{ color: '#94a3b8' }}>Activity Breadcrumbs:</strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {(report ? report.breadcrumbs : liveCrumbs).length} events
                  </span>
                </div>
                <div
                  style={{
                    backgroundColor: '#020617',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                >
                  {(report ? report.breadcrumbs : liveCrumbs).map((crumb, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        color:
                          crumb.category === 'ERROR'
                            ? '#f87171'
                            : crumb.category === 'CAMERA'
                              ? '#38bdf8'
                              : crumb.category === 'OCR'
                                ? '#fbbf24'
                                : '#94a3b8',
                      }}
                    >
                      <span style={{ color: '#64748b', flexShrink: 0 }}>[{crumb.timestamp}]</span>
                      <span style={{ fontWeight: 700, flexShrink: 0 }}>[{crumb.category}]</span>
                      <span style={{ color: '#e2e8f0', wordBreak: 'break-word' }}>
                        {crumb.message}
                      </span>
                    </div>
                  ))}
                  {(report ? report.breadcrumbs : liveCrumbs).length === 0 && (
                    <div style={{ color: '#64748b' }}>No breadcrumbs recorded yet.</div>
                  )}
                </div>
              </div>

              {/* Device Details */}
              {report?.deviceInfo && (
                <details style={{ fontSize: '11px', color: '#64748b' }}>
                  <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Device Metadata</summary>
                  <pre
                    style={{
                      margin: '6px 0 0 0',
                      padding: '8px',
                      borderRadius: '6px',
                      backgroundColor: '#020617',
                      color: '#cbd5e1',
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(report.deviceInfo, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #1e293b',
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                backgroundColor: '#0f172a',
              }}
            >
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
                {copied ? 'Copied to Clipboard!' : 'Copy Diagnostic Log'}
              </button>

              {report && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    cursor: 'pointer',
                  }}
                >
                  Dismiss Report
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
