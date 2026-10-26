/**
 * Receipt capture (PS point 2): upload, live camera, preview, rotate, progress, graceful failures.
 * Functional but deliberately unstyled — Member 1 can restyle freely; keep the props and the aria attributes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { scanBatch, scanReceipt } from '../logic/scanPipeline';
import type { ScanOutcome } from '../logic/scanPipeline';
import { warmUpOcr } from '../logic/ocrService';
import type { ScanProgress } from '../types/receipt';

export interface ScannedReceipt { file: File; previewUrl: string; outcome: Extract<ScanOutcome, { ok: true }> }
interface Props {
  onScanned: (receipts: ScannedReceipt[]) => void;  // length > 1 when the user scanned several receipts at once
  onManualEntry: () => void;                         // test case 4: offer manual entry when nothing is found
  multiple?: boolean;                                // Tier 3: batch scan
}

export function ReceiptCapture({ onScanned, onManualEntry, multiple = false }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [progress, setProgress] = useState<(ScanProgress & { index: number }) | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const urls = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach(URL.revokeObjectURL), [urls]);
  useEffect(() => { warmUpOcr(); return stopCamera; }, []);
  const busy = progress !== null;

  function addFiles(list: File[]) {
    setNotice(null); setRotation(0);
    setFiles(prev => (multiple ? [...prev, ...list] : list.slice(0, 1)));
  }

  async function openCamera() {
    setNotice(null);
    if (!navigator.mediaDevices?.getUserMedia) { setNotice('Camera is not available here. Please upload a photo of the receipt instead.'); return; }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
      });
      setCameraOn(true);
    } catch { // test case 7: permission denied
      setNotice('We couldn’t access the camera (permission denied or no camera). You can still upload a photo of the receipt.');
    }
  }
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) { videoRef.current.srcObject = streamRef.current; void videoRef.current.play(); }
  }, [cameraOn]);
  function stopCamera() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setCameraOn(false); }
  async function snap() {
    const v = videoRef.current; if (!v) return;
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.92));
    stopCamera();
    if (blob) addFiles([new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
  }

  async function run() {
    setNotice(null);
    const onProgress = (index: number, p: ScanProgress) => setProgress({ ...p, index });
    const userRotation = rotation || undefined; // undefined => allow auto-rotation
    const outcomes = files.length === 1
      ? [await scanReceipt(files[0], { rotation: userRotation, onProgress: p => onProgress(0, p) })]
      : await scanBatch(files, { onProgress });
    setProgress(null);

    const good: ScannedReceipt[] = [];
    const problems: string[] = [];
    outcomes.forEach((o, i) => {
      if (!o.ok) problems.push(`${files[i].name}: ${o.error.message}`);
      else if (o.parsed.items.length === 0) problems.push(`${files[i].name}: no items found.`);
      else good.push({ file: files[i], previewUrl: urls[i], outcome: o });
    });
    if (good.length) onScanned(good);
    if (problems.length) setNotice(problems.join(' ') + ' Try rotating or retaking the photo, or enter the expense manually.');
  }

  return (
    <section aria-label="Scan a receipt">
      {cameraOn ? (
        <div>
          <video ref={videoRef} playsInline muted style={{ maxWidth: '100%' }} aria-label="Camera preview" />
          <button type="button" onClick={snap}>Take photo</button>
          <button type="button" onClick={stopCamera}>Cancel</button>
        </div>
      ) : (
        <div>
          <button type="button" onClick={openCamera} disabled={busy}>Use camera</button>
          <label>
            Upload receipt
            <input type="file" accept="image/jpeg,image/png" multiple={multiple} disabled={busy}
                   onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
          </label>
        </div>
      )}

      {files.length > 0 && !cameraOn && (
        <div>
          {files.map((f, i) => (
            <img key={urls[i]} src={urls[i]} alt={`Receipt preview ${i + 1}`}
                 style={{ maxWidth: files.length === 1 ? '100%' : 120, maxHeight: files.length === 1 ? 360 : 120,
                          transform: files.length === 1 ? `rotate(${rotation}deg)` : undefined }} />
          ))}
          <div>
            {files.length === 1 && <button type="button" onClick={() => setRotation(r => ((r + 90) % 360) as 0 | 90 | 180 | 270)} disabled={busy}>Rotate</button>}
            <button type="button" onClick={() => { setFiles([]); setNotice(null); }} disabled={busy}>Retake</button>
            <button type="button" onClick={run} disabled={busy}>{files.length > 1 ? `Scan ${files.length} receipts` : 'Scan receipt'}</button>
          </div>
        </div>
      )}

      {progress && (
        <div role="status" aria-live="polite">
          <progress max={1} value={progress.overall} />
          <span> {files.length > 1 ? `Receipt ${progress.index + 1} of ${files.length} — ` : ''}{progress.message}</span>
        </div>
      )}

      {notice && (
        <div role="alert">
          <p>{notice}</p>
          <button type="button" onClick={onManualEntry}>Enter manually</button>
        </div>
      )}
    </section>
  );
}
