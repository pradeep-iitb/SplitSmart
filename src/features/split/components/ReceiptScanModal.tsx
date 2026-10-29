import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Category, Expense, Member, ReceiptItem } from '../../../types/domain';
import type { ParsedItem, ParsedReceipt, ScanProgress } from '../../../ocr/src/types/receipt';
import { scanBatch, scanReceipt } from '../../../ocr/src/logic/scanPipeline';
import { detectReceiptPeople, isKnownGroupMember, type ReceiptPerson } from '../../../ocr/src/logic/receiptPeople';
import { calculateExpenseShares } from '../splitEngine';
import { parseReceipt } from '../../../ocr/src/logic/receiptParser';
import { validateTotals, formatRupees } from '../../../ocr/src/logic/receiptValidation';
import { categorizeItems, type CategorizerStatus } from '../../../ocr/src/logic/categorizer';
import { fromPlainText, MOCK_RECEIPT_TEXT } from '../../../ocr/src/mock/mockReceipts';
import {
  Camera,
  Upload,
  RotateCw,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';

interface ReceiptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  groupId: string;
  onSaveExpense: (expense: Expense) => void | Promise<void>;
  onAddMember: (name: string) => Promise<Member>;
  onOpenInSplitStudio?: (draft: {
    description: string;
    items: ReceiptItem[];
    taxLines: Array<{ label: string; amountPaise: number }>;
    serviceChargeRupees: string;
    discountRupees: string;
    totalRupees: string;
    payerId: string;
  }) => void;
}

const newReceiptFileName = () => `receipt-${Date.now()}.jpg`;
const newExpenseId = () => `exp-ocr-${Date.now()}`;

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({
  isOpen,
  onClose,
  members,
  groupId,
  onSaveExpense,
  onAddMember,
  onOpenInSplitStudio,
}) => {
  // Step: 'capture' | 'review'
  const [step, setStep] = useState<'capture' | 'review'>('capture');

  // Capture State
  const [file, setFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [reviewBatch, setReviewBatch] = useState<Array<{ file: File; parsed: ParsedReceipt; people: ReceiptPerson[] }>>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [batchScanIndex, setBatchScanIndex] = useState(0);
  const [batchFailures, setBatchFailures] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Parsed / Review State
  const [merchant, setMerchant] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [payerId, setPayerId] = useState(members[0]?.id || '');
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [itemAssignments, setItemAssignments] = useState<Record<string, string[]>>({});
  const [pendingPeople, setPendingPeople] = useState<ReceiptPerson[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [replacementMemberId, setReplacementMemberId] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [categoryStatus, setCategoryStatus] = useState<CategorizerStatus | null>(null);
  const [categoryProgress, setCategoryProgress] = useState<number | null>(null);
  const categorizationRun = useRef(0);
  const manuallyCategorizedIds = useRef(new Set<string>());
  useEffect(() => {
    if (!isOpen) categorizationRun.current += 1;
  }, [isOpen]);
  const [taxLines, setTaxLines] = useState<Array<{ label: string; amountPaise: number }>>([]);
  const [serviceChargePaise, setServiceChargePaise] = useState(0);
  const [discountPaise, setDiscountPaise] = useState(0);
  const [roundOffPaise, setRoundOffPaise] = useState(0);
  const [detectedTotalPaise, setDetectedTotalPaise] = useState<number | null>(null);
  const [taxIncluded, setTaxIncluded] = useState(false);

  // Revoke each image URL when its preview is replaced or the modal unmounts.
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [cameraActive]);


  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  async function startCamera() {
    setScanError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setScanError('Camera API is not supported in this browser. Please upload a photo instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setScanError('Camera access was denied or unavailable. Please upload a photo instead.');
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    stopCamera();
    if (blob) {
      const photoFile = new File([blob], newReceiptFileName(), { type: 'image/jpeg' });
      selectFiles([...selectedFiles, photoFile], photoFile);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>, append = false) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) selectFiles(append ? [...selectedFiles, ...selected] : selected);
    e.target.value = '';
  }

  function selectFiles(files: File[], previewFile = files[0]) {
    setSelectedFiles(files);
    setReviewBatch([]);
    setReviewIndex(0);
    setBatchFailures([]);
    setRotation(0);
    processFile(previewFile);
  }

  function processFile(f: File) {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setScanError(null);
  }

  async function runScan() {
    if (!selectedFiles.length) return;
    setIsScanning(true);
    setScanError(null);
    setBatchFailures([]);

    try {
      const outcomes = selectedFiles.length === 1
        ? [await scanReceipt(selectedFiles[0], { rotation: rotation || undefined, onProgress: setScanProgress })]
        : await scanBatch(selectedFiles, { onProgress: (index, progress) => { setBatchScanIndex(index); setScanProgress(progress); } });
      const good: Array<{ file: File; parsed: ParsedReceipt; people: ReceiptPerson[] }> = [];
      const failures: string[] = [];
      outcomes.forEach((outcome, index) => {
        if (!outcome.ok) failures.push(`${selectedFiles[index].name}: ${outcome.error.message}`);
        else if (outcome.parsed.items.length === 0) failures.push(`${selectedFiles[index].name}: no receipt items were found. Retake or edit this receipt separately.`);
        else good.push({ file: selectedFiles[index], parsed: outcome.parsed, people: detectReceiptPeople(outcome.ocr) });
      });
      setBatchFailures(failures);
      if (!good.length) {
        setScanError(failures.join(' '));
        return;
      }
      setReviewBatch(good);
      setReviewIndex(0);
      processFile(good[0].file);
      loadParsedData(good[0].parsed, good[0].people);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to scan receipt image.');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  }

  // Quick Mock loader for desktop demonstration
  function loadMockReceipt(mockKey: keyof typeof MOCK_RECEIPT_TEXT) {
    setSelectedFiles([]);
    setReviewBatch([]);
    setBatchFailures([]);
    setScanError(null);
    setIsScanning(true);
    setScanProgress({ stage: 'parsing', overall: 0.8, message: 'Processing sample receipt text...' });

    setTimeout(() => {
      const rawText = MOCK_RECEIPT_TEXT[mockKey];
      const ocrResult = fromPlainText(rawText);
      const parsed = parseReceipt(ocrResult);
      loadParsedData(parsed);
      setIsScanning(false);
      setScanProgress(null);
    }, 400);
  }

  function loadParsedData(parsed: ParsedReceipt, people: ReceiptPerson[] = []) {
    const run = ++categorizationRun.current;
    const originalNames = new Map(parsed.items.map((item) => [item.id, item.name]));
    manuallyCategorizedIds.current.clear();
    setCategoryStatus('loading-model');
    setCategoryProgress(null);
    setMerchant(parsed.merchant || 'Scanned Receipt Expense');
    setExpenseDate(parsed.dateISO || new Date().toISOString().substring(0, 10));
    setItems(parsed.items);
    setPendingPeople(selectedFiles.length > 1 ? people.filter((person) => !isKnownGroupMember(person.name, members.map((member) => member.name))) : []);
    setNewMemberName('');
    setReplacementMemberId(members[0]?.id ?? '');
    setItemAssignments(Object.fromEntries(parsed.items.map((item) => [item.id, selectedFiles.length > 1 ? [] : members.map((member) => member.id)])));
    setTaxLines(parsed.taxLines.map((t) => ({ label: t.label, amountPaise: t.amountPaise })));
    setServiceChargePaise(parsed.serviceChargePaise);
    setDiscountPaise(parsed.discountPaise);
    setRoundOffPaise(parsed.roundOffPaise);
    setDetectedTotalPaise(parsed.detectedTotalPaise);
    setTaxIncluded(parsed.taxIncluded);

    // Auto-categorize items
    void categorizeItems(
      parsed.items.map((it) => ({ id: it.id, name: it.name })),
      {
        onResult: (id, category) => {
          if (run !== categorizationRun.current || manuallyCategorizedIds.current.has(id)) return;
          setItems((prev) => prev.map((item) => (item.id === id && item.name === originalNames.get(id) ? { ...item, category } : item)));
        },
        onStatus: (status, progress) => {
          if (run !== categorizationRun.current) return;
          setCategoryStatus(status);
          setCategoryProgress(typeof progress === 'number' ? progress : null);
        },
        useModel: true,
      }
    );

    setStep('review');
  }

  // Real-time calculation and validation
  const itemsSumPaise = useMemo(() => items.reduce((sum, item) => sum + item.totalPaise, 0), [items]);
  const effectiveTaxPaise = taxIncluded ? 0 : taxLines.reduce((sum, t) => sum + t.amountPaise, 0);
  const calculatedGrandTotalPaise = itemsSumPaise + effectiveTaxPaise + serviceChargePaise - discountPaise + roundOffPaise;
  const finalGrandTotalPaise = detectedTotalPaise ?? calculatedGrandTotalPaise;
  const isBatchReview = selectedFiles.length > 1 && reviewBatch.length > 0;
  const unassignedItems = isBatchReview ? items.filter((item) => !itemAssignments[item.id]?.length) : [];
  const itemizedShares = useMemo(() => {
    if (!isBatchReview || !items.length || unassignedItems.length || !members.length || finalGrandTotalPaise <= 0) return [];
    const receiptItems: ReceiptItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      lineTotalPaise: item.totalPaise,
      assignedMemberIds: itemAssignments[item.id] ?? [],
      category: item.category ?? 'Other',
    }));
    return calculateExpenseShares({
      totalPaise: finalGrandTotalPaise,
      splitMode: 'itemized',
      participantIds: members.map((member) => member.id),
      items: receiptItems,
      taxLines: taxIncluded ? [] : taxLines,
      serviceChargePaise,
      discountPaise,
    });
  }, [isBatchReview, items, itemAssignments, members, unassignedItems.length, finalGrandTotalPaise, taxIncluded, taxLines, serviceChargePaise, discountPaise]);

  const validationResult = useMemo(() => {
    return validateTotals({
      itemTotalsPaise: items.map((i) => i.totalPaise),
      taxPaise: effectiveTaxPaise,
      serviceChargePaise,
      discountPaise,
      roundOffPaise,
      statedTotalPaise: detectedTotalPaise,
    });
  }, [items, effectiveTaxPaise, serviceChargePaise, discountPaise, roundOffPaise, detectedTotalPaise]);

  function advanceBatch() {
    const nextIndex = reviewIndex + 1;
    if (nextIndex < reviewBatch.length) {
      const next = reviewBatch[nextIndex];
      setReviewIndex(nextIndex);
      processFile(next.file);
      loadParsedData(next.parsed, next.people);
    } else {
      onClose();
    }
  }

  async function handleSaveAsExpense() {
    if (isSaving) return;
    if (pendingPeople.length) {
      setScanError('Resolve the unfamiliar name on this receipt before saving.');
      return;
    }
    if (items.length === 0 || finalGrandTotalPaise <= 0 || !members.length || !payerId) {
      setScanError('Please ensure there is an item, a positive total, a payer, and group members.');
      return;
    }
    if (unassignedItems.length) {
      setScanError(`Assign every item before saving. ${unassignedItems.length} item(s) still need members.`);
      return;
    }

    const count = members.length;
    const baseShare = Math.floor(finalGrandTotalPaise / count);
    const remainder = finalGrandTotalPaise % count;

    // Distribute remainder paise deterministically
    const memberShares = members.map((m, idx) => ({
      memberId: m.id,
      amountPaise: baseShare + (idx < remainder ? 1 : 0),
    }));

    const domainItems: ReceiptItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      lineTotalPaise: item.totalPaise,
      assignedMemberIds: isBatchReview ? itemAssignments[item.id] ?? [] : members.map((m) => m.id),
      category: (item.category as Category) || 'Food',
      ocrConfidence: Math.round(item.confidence * 100),
      needsReview: item.uncertainWords?.length > 0 || item.confidence < 0.7,
    }));

    const newExpense: Expense = {
      id: newExpenseId(),
      groupId,
      description: merchant.trim() || 'Scanned Receipt',
      date: expenseDate,
      payerId,
      amountPaise: finalGrandTotalPaise,
      splitMode: isBatchReview ? 'itemized' : 'equal',
      memberShares: isBatchReview ? itemizedShares : memberShares,
      items: domainItems,
      taxLines,
      serviceChargePaise,
      discountPaise,
      createdAt: new Date().toISOString(),
    };

    try {
      setIsSaving(true);
      await onSaveExpense(newExpense);
      advanceBatch();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not save this receipt. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function addPersonToGroup(name: string, role: ReceiptPerson['role'] = 'customer') {
    if (!name.trim() || isAddingMember) return;
    try {
      setIsAddingMember(true);
      const added = await onAddMember(name.trim());
      if (role === 'payer') setPayerId(added.id);
      setPendingPeople((current) => current.filter((person) => person.name.toLocaleLowerCase() !== name.trim().toLocaleLowerCase()));
      setNewMemberName('');
      setScanError(null);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not add the member.');
    } finally {
      setIsAddingMember(false);
    }
  }

  function assignExistingMemberForPerson(person: ReceiptPerson) {
    if (!replacementMemberId) return;
    if (person.role === 'payer') setPayerId(replacementMemberId);
    setItemAssignments((current) => Object.fromEntries(items.map((item) => [item.id, current[item.id]?.length ? current[item.id] : [replacementMemberId]])));
    setPendingPeople((current) => current.filter((candidate) => candidate !== person));
    setScanError(null);
  }

  function handleTransferToSplitStudio() {
    if (!onOpenInSplitStudio) return;
    const domainItems: ReceiptItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      lineTotalPaise: item.totalPaise,
      assignedMemberIds: members.map((m) => m.id),
      category: (item.category as Category) || 'Food',
      ocrConfidence: Math.round(item.confidence * 100),
      needsReview: item.uncertainWords?.length > 0 || item.confidence < 0.7,
    }));

    onOpenInSplitStudio({
      description: merchant.trim() || 'Scanned Receipt',
      items: domainItems,
      taxLines,
      serviceChargeRupees: (serviceChargePaise / 100).toString(),
      discountRupees: (discountPaise / 100).toString(),
      totalRupees: (finalGrandTotalPaise / 100).toString(),
      payerId,
    });
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <span>Smart Receipt Scanner</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">
                  OCR Engine
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {step === 'capture'
                  ? 'Take a photo or upload a receipt to auto-extract items and charges'
                  : 'Review extracted items, charges, and verify calculated totals'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {scanError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Scan Notice</p>
                <p className="text-xs text-red-200">{scanError}</p>
              </div>
            </div>
          )}

          {step === 'capture' && (
            <div className="space-y-6">
              {/* Camera Feed or Upload Box */}
              {cameraActive ? (
                <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 flex flex-col items-center justify-center min-h-[320px]">
                  <video ref={videoRef} playsInline muted className="w-full max-h-[380px] object-contain" />
                  <div className="absolute bottom-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      Take Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 p-4 flex flex-col items-center">
                  <div className="max-h-[300px] overflow-hidden rounded-xl flex items-center justify-center bg-slate-900 w-full">
                    <img
                      src={previewUrl}
                      alt="Receipt preview"
                      style={{ transform: `rotate(${rotation}deg)` }}
                      className="max-h-[280px] object-contain transition-transform duration-200"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button type="button" onClick={startCamera} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer">
                      Add camera photo
                    </button>
                    <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer">
                      Add files
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => handleFileInput(e, true)} className="hidden" />
                    </label>
                    <button
                      type="button"
                      onClick={() => setRotation((prev) => (((prev + 90) % 360) as 0 | 90 | 180 | 270))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                      Rotate ({rotation}°)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setPreviewUrl(null);
                        setSelectedFiles([]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Camera Card */}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="group border border-dashed border-slate-700 hover:border-blue-500 bg-slate-850/50 hover:bg-blue-600/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer"
                  >
                    <span className="p-4 rounded-2xl bg-blue-600/10 text-blue-400 group-hover:scale-110 transition-transform mb-3">
                      <Camera className="w-8 h-8" />
                    </span>
                    <h3 className="font-bold text-slate-100 text-base">Use Device Camera</h3>
                    <p className="text-xs text-slate-400 mt-1">Snap a clear photo of your receipt directly</p>
                  </button>

                  {/* File Upload Card */}
                  <label className="group border border-dashed border-slate-700 hover:border-emerald-500 bg-slate-850/50 hover:bg-emerald-600/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => handleFileInput(e)}
                      className="hidden"
                    />
                    <span className="p-4 rounded-2xl bg-emerald-600/10 text-emerald-400 group-hover:scale-110 transition-transform mb-3">
                      <Upload className="w-8 h-8" />
                    </span>
                    <h3 className="font-bold text-slate-100 text-base">Upload Receipts</h3>
                    <p className="text-xs text-slate-400 mt-1">Select one or several JPG, PNG, or WebP images</p>
                  </label>
                </div>
              )}

              {step === 'capture' && selectedFiles.length > 1 && <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-200">
                <strong>{selectedFiles.length} receipts selected</strong><p className="mt-1 text-slate-400">They will be scanned one at a time, then reviewed and saved separately.</p>
                <ul className="mt-2 max-h-20 overflow-y-auto list-disc pl-5">{selectedFiles.map((selected, index) => <li key={`${selected.name}-${index}`}>{selected.name}</li>)}</ul>
              </div>}

              {/* Live Scanning Progress - Steady, non-dimming card */}
              {isScanning && (
                <div className="p-5 rounded-2xl bg-slate-900/95 border border-purple-500/40 shadow-[0_0_25px_rgba(147,51,234,0.15)] space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
                      <span>{selectedFiles.length > 1 ? `Receipt ${batchScanIndex + 1} of ${selectedFiles.length}: ` : ''}{scanProgress?.message || 'Processing receipt image...'}</span>
                    </span>
                    <span className="text-purple-400 font-bold font-mono">
                      {Math.round((scanProgress?.overall ?? 0.5) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.round((scanProgress?.overall ?? 0.5) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    Runs locally in your browser via OCR Web Worker.
                  </p>
                </div>
              )}

              {/* Start Scan Button */}
              {file && !isScanning && (
                <button
                  type="button"
                  onClick={runScan}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5" />
                  Analyze {selectedFiles.length > 1 ? `${selectedFiles.length} Receipts` : 'Receipt'}
                </button>
              )}

              {/* Instant Demo Presets (Useful for Desktop Demo) */}
              <div className="border-t border-slate-800 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    Quick Demo Receipts (No photo needed)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => loadMockReceipt('restaurant')}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-slate-200 text-xs truncate">🍕 Night Bites Cafe</div>
                    <div className="text-[11px] text-slate-400">₹840 · CGST/SGST</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMockReceipt('canteenNoTotal')}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-slate-200 text-xs truncate">🥪 IIT Canteen</div>
                    <div className="text-[11px] text-slate-400">₹150 · No total printed</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMockReceipt('serviceAndDiscount')}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-slate-200 text-xs truncate">🍸 Hostel Kitchen</div>
                    <div className="text-[11px] text-slate-400">₹442 · Discount + Svc</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMockReceipt('taxInclusive')}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-slate-200 text-xs truncate">🥛 Fresh Mart</div>
                    <div className="text-[11px] text-slate-400">₹177 · MRP Tax Incl.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadMockReceipt('wrapped')}
                    className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-slate-200 text-xs truncate">🌯 Snack Shack</div>
                    <div className="text-[11px] text-slate-400">₹220 · Multi-line</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6">
              {reviewBatch.length > 1 && <div className="rounded-xl border border-lime-500/30 bg-lime-500/10 px-4 py-3 text-sm text-slate-100" role="status">
                <strong>Receipt {reviewIndex + 1} of {reviewBatch.length}</strong> · {reviewBatch[reviewIndex]?.file.name}<p className="text-xs text-slate-400 mt-1">Review and save this bill before moving to the next. Each bill becomes its own expense.</p>
              </div>}
              {batchFailures.length > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200" role="alert">
                <strong>{batchFailures.length} receipt(s) could not be scanned:</strong><ul className="list-disc pl-5 mt-1">{batchFailures.map((failure, index) => <li key={index}>{failure}</li>)}</ul>
              </div>}
              {isBatchReview && pendingPeople.length > 0 && <div className="rounded-xl border border-amber-400/60 bg-amber-500/10 p-4 text-sm text-slate-100" role="alert" aria-live="assertive">
                <h3 className="font-bold text-amber-200">Unknown name on this receipt</h3>
                <p className="mt-1">The receipt says <strong>{pendingPeople[0].name}</strong> ({pendingPeople[0].role}), but this person is not in the current group. Resolve this before saving. {pendingPeople.length > 1 ? `${pendingPeople.length - 1} more name(s) need review.` : ''}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button type="button" disabled={isAddingMember} onClick={() => void addPersonToGroup(pendingPeople[0].name, pendingPeople[0].role)} className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-bold text-slate-950">Add to group, then assign items</button>
                  <select aria-label="Existing member to use instead" value={replacementMemberId} onChange={(event) => setReplacementMemberId(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs">{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
                  <button type="button" onClick={() => assignExistingMemberForPerson(pendingPeople[0])} className="rounded-lg border border-lime-400 px-3 py-2 text-xs font-bold text-lime-200">Use selected member for unassigned items</button>
                  <button type="button" onClick={() => setPendingPeople((current) => current.slice(1))} className="rounded-lg border border-slate-600 px-3 py-2 text-xs">Ignore printed name</button>
                  <button type="button" onClick={advanceBatch} className="rounded-lg border border-red-400/60 px-3 py-2 text-xs text-red-200">Discard this receipt</button>
                </div>
              </div>}
              {isBatchReview && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-200">
                <label htmlFor="batch-new-member">Someone missing from the group?</label>
                <input id="batch-new-member" value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="Member name" className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5" />
                <button type="button" disabled={!newMemberName.trim() || isAddingMember} onClick={() => void addPersonToGroup(newMemberName)} className="rounded-lg border border-lime-400 px-3 py-1.5 font-semibold text-lime-200 disabled:opacity-50">Add member</button>
              </div>}
              {categoryStatus && categoryStatus !== 'ready' && <div className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-slate-200" role="status" aria-live="polite">
                {categoryStatus === 'failed'
                  ? 'Automatic categorization is unavailable. You can choose each category manually.'
                  : categoryStatus === 'downloading'
                    ? `Downloading the item categorization model${categoryProgress === null ? '…' : ` (${Math.round(categoryProgress)}%)`}`
                    : 'Categorizing receipt items in the background…'}
              </div>}
              {/* Validation Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  validationResult.status === 'ok'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : validationResult.status === 'rounding'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                    : validationResult.status === 'unconfirmed'
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {validationResult.status === 'ok' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-semibold text-sm">
                    {validationResult.status === 'ok' && 'Verified Match'}
                    {validationResult.status === 'rounding' && 'Rounding Match'}
                    {validationResult.status === 'unconfirmed' && 'Calculated Total'}
                    {validationResult.status === 'mismatch' && 'Discrepancy Detected'}
                  </div>
                  <div className="text-xs opacity-90">{validationResult.message}</div>
                </div>
              </div>

              {/* Expense Metadata Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Merchant / Title</label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="Merchant or Description"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Expense Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Paid By</label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-850/60">
                <div className="p-3.5 bg-slate-800/80 border-b border-slate-750 flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-400" />
                    Detected Line Items ({items.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = `item_custom_${Date.now()}`;
                      setItems((prev) => [
                        ...prev,
                        {
                          id: newId,
                          name: 'New Item',
                          quantity: 1,
                          unitPricePaise: 0,
                          totalPaise: 0,
                          confidence: 1.0,
                          amountConfidence: 1.0,
                          uncertainWords: [],
                          sourceLine: -1,
                          category: 'Food',
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>

                <div className="divide-y divide-slate-800 max-h-[260px] overflow-y-auto">
                  {items.map((it, idx) => (
                    <div key={it.id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-sm hover:bg-slate-800/40">
                      {/* Left: Name & Category */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={it.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, name: val } : item)));
                          }}
                          className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1 font-medium text-slate-100 focus:border-blue-500 focus:outline-none w-full text-sm"
                          placeholder="Item name"
                        />
                        <div className="flex items-center gap-2 mt-1.5">
                          <select
                            value={it.category || 'Food'}
                            onChange={(e) => {
                              const cat = e.target.value as Category;
                              manuallyCategorizedIds.current.add(it.id);
                              setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, category: cat } : item)));
                            }}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 focus:outline-none cursor-pointer"
                          >
                            <option value="Food">Food</option>
                            <option value="Groceries">Groceries</option>
                            <option value="Travel">Travel</option>
                            <option value="Utilities">Utilities</option>
                            <option value="Entertainment">Entertainment</option>
                            <option value="Other">Other</option>
                          </select>
                          {it.uncertainWords?.length > 0 && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" />
                              Low OCR confidence
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Quantity, Price, Delete */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">Qty:</span>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => {
                              const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setItems((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        quantity: q,
                                        totalPaise: Math.round(q * item.unitPricePaise),
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-14 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 text-center focus:border-blue-500 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-400">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={(it.totalPaise / 100).toFixed(2)}
                            onChange={(e) => {
                              const rupees = parseFloat(e.target.value) || 0;
                              const paise = Math.round(rupees * 100);
                              setItems((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        totalPaise: paise,
                                        unitPricePaise: item.quantity > 0 ? Math.round(paise / item.quantity) : paise,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-100 text-right focus:border-blue-500 focus:outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {isBatchReview && <div className="w-full border-t border-slate-700/60 pt-2" aria-label={`Assign ${it.name} to members`}>
                        <div className="flex items-center justify-between gap-2 mb-2"><span className="text-xs font-semibold text-slate-300">Who shared this item?</span><button type="button" className="text-xs text-lime-300" onClick={() => setItemAssignments((prev) => ({ ...prev, [it.id]: members.map((member) => member.id) }))}>Everyone</button></div>
                        <div className="flex flex-wrap gap-2">{members.map((member) => {
                          const selected = itemAssignments[it.id]?.includes(member.id) ?? false;
                          return <button key={member.id} type="button" aria-pressed={selected} onClick={() => setItemAssignments((prev) => {
                            const current = prev[it.id] ?? [];
                            return { ...prev, [it.id]: selected ? current.filter((id) => id !== member.id) : [...current, member.id] };
                          })} className={`rounded-full border px-3 py-1 text-xs font-semibold ${selected ? 'border-lime-400 bg-lime-400/20 text-lime-200' : 'border-slate-600 text-slate-300'}`}>{member.name}</button>;
                        })}</div>
                        {!itemAssignments[it.id]?.length && <p className="text-xs text-amber-300 mt-2">Assign at least one member before saving.</p>}
                      </div>}
                    </div>
                  ))}
                </div>
              </div>

              {isBatchReview && <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-sm">
                <h3 className="font-semibold text-slate-100 mb-2">Itemized split preview</h3>
                {unassignedItems.length ? <p className="text-amber-300 text-xs">Assign {unassignedItems.length} remaining item(s) to see each member’s share.</p> : itemizedShares.map((share) => <div key={share.memberId} className="flex justify-between py-1 text-slate-200"><span>{members.find((member) => member.id === share.memberId)?.name}</span><strong>{formatRupees(share.amountPaise)}</strong></div>)}
                <p className="text-xs text-slate-400 mt-2">Tax, service charge, and discount follow each member’s item subtotal.</p>
              </div>}

              {/* Charges & Breakdown Card */}
              <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 space-y-3 text-sm">
                <div className="flex justify-between items-center text-slate-400 text-xs">
                  <span>Items Subtotal:</span>
                  <span className="font-semibold text-slate-200">{formatRupees(itemsSumPaise)}</span>
                </div>

                {/* Editable Tax Lines */}
                <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Taxes (GST / VAT)</span>
                    <button
                      type="button"
                      onClick={() => setTaxLines((prev) => [...prev, { label: 'GST', amountPaise: 0 }])}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Tax
                    </button>
                  </div>
                  {taxLines.map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs">
                      <input
                        type="text"
                        value={t.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTaxLines((prev) => prev.map((item, idx) => (idx === i ? { ...item, label: val } : item)));
                        }}
                        className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-300 w-36 focus:outline-none focus:border-blue-500"
                        placeholder="Tax label (e.g. CGST)"
                      />
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={(t.amountPaise / 100).toFixed(2)}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setTaxLines((prev) =>
                              prev.map((item, idx) => (idx === i ? { ...item, amountPaise: Math.round(val * 100) } : item))
                            );
                          }}
                          className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-100 font-medium w-22 text-right focus:outline-none focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setTaxLines((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Service Charge, Discount, Round Off */}
                <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
                  {/* Service Charge */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Service Charge:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">+₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={(serviceChargePaise / 100).toFixed(2)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setServiceChargePaise(Math.round(val * 100));
                        }}
                        className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-100 font-medium w-22 text-right focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Discount */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400">Discount:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-400">-₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={(discountPaise / 100).toFixed(2)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setDiscountPaise(Math.round(val * 100));
                        }}
                        className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-emerald-300 font-medium w-22 text-right focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Round Off */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Round Off:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={(roundOffPaise / 100).toFixed(2)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setRoundOffPaise(Math.round(val * 100));
                        }}
                        className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-100 font-medium w-22 text-right focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Grand Total */}
                <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-base font-bold text-slate-100">
                  <div>
                    <span>Grand Total:</span>
                    {detectedTotalPaise !== null && detectedTotalPaise !== calculatedGrandTotalPaise && (
                      <button
                        type="button"
                        onClick={() => setDetectedTotalPaise(calculatedGrandTotalPaise)}
                        className="block text-[11px] font-normal text-blue-400 hover:underline cursor-pointer"
                      >
                        Sync with calculated ({formatRupees(calculatedGrandTotalPaise)})
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl text-blue-400">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(finalGrandTotalPaise / 100).toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setDetectedTotalPaise(Math.round(val * 100));
                      }}
                      className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 text-lg font-bold text-blue-400 w-28 text-right focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3">
          {step === 'review' ? (
            <>
              <button
                type="button"
                onClick={reviewBatch.length > 1 ? advanceBatch : () => setStep('capture')}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
              >
                {reviewBatch.length > 1 ? 'Skip Receipt' : 'Back to Scan'}
              </button>
              <div className="flex items-center gap-3">
                {onOpenInSplitStudio && !isBatchReview && (
                  <button
                    type="button"
                    onClick={handleTransferToSplitStudio}
                    className="px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-semibold text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Itemized in Studio</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveAsExpense}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'Saving…' : isBatchReview ? reviewIndex + 1 < reviewBatch.length ? 'Save Itemized & Next' : 'Save Itemized & Finish' : 'Save as Group Expense'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
