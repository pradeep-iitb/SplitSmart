import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Category, Expense, Member, ReceiptItem, SplitMode } from '../../../types/domain';
import type {
  ParsedItem,
  ParsedReceipt,
  ScanProgress,
  ItemQtyChecksumData,
  InferredChargeItem,
  ReceiptStatus,
} from '../../../ocr/src/types/receipt';
import { scanBatch, scanReceipt } from '../../../ocr/src/logic/scanPipeline';
import {
  detectReceiptPeople,
  isKnownGroupMember,
  type ReceiptPerson,
} from '../../../ocr/src/logic/receiptPeople';
import { calculateExpenseShares } from '../splitEngine';
import { buildBatchExpenses } from '../batchExpense';
import { recordBreadcrumb, startOperation, finishOperation } from '../../../utils/persistentLogger';
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
  ShieldCheck,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import './receiptWorkflow.css';

export interface ScannedBillEntry {
  billId: string;
  billIndex: number;
  billName: string; // "Bill No. 1", "Bill No. 2", etc.
  file: File;
  previewUrl: string;
  parsed: ParsedReceipt;
  people: ReceiptPerson[];
}

interface ReceiptScanModalProps {
  isOpen: boolean;
  initialFiles?: File[];
  onClose: () => void;
  onSwitchToManual?: () => void;
  members: Member[];
  groupId: string;
  onSaveExpense: (expense: Expense) => void | Promise<void>;
  onSaveExpenses: (expenses: Expense[]) => Promise<void>;
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
const formatBillName = (index: number) => `Bill No. ${index + 1}`;

export const ReceiptScanModal: React.FC<ReceiptScanModalProps> = ({
  isOpen,
  initialFiles,
  onClose,
  onSwitchToManual,
  members,
  groupId,
  onSaveExpense,
  onSaveExpenses,
  onAddMember,
  onOpenInSplitStudio,
}) => {
  const [step, setStep] = useState<'capture' | 'review' | 'assign' | 'summary'>('capture');
  const [previousStep, setPreviousStep] = useState<'capture' | 'review' | 'assign' | 'summary'>(
    'capture'
  );
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('itemized');
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});

  // Capture State
  const [file, setFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [reviewBatch, setReviewBatch] = useState<ScannedBillEntry[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [billRotations, setBillRotations] = useState<Record<number, 0 | 90 | 180 | 270>>({});
  const [billFilter, setBillFilter] = useState<number | 'all'>('all');
  const [batchScanIndex, setBatchScanIndex] = useState(0);
  const [batchFailures, setBatchFailures] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [previewZoomed, setPreviewZoomed] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const additionalBillInputRef = useRef<HTMLInputElement>(null);
  const initialScanStarted = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const createdUrlsRef = useRef<string[]>([]);

  // Parsed / Review State
  const [merchant, setMerchant] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [payerId, setPayerId] = useState(
    members.find((member) => member.isCurrentUser)?.id || members[0]?.id || ''
  );
  const [billPayerIds, setBillPayerIds] = useState<Record<string, string>>({});
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
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
  const [itemQtyChecksum, setItemQtyChecksum] = useState<ItemQtyChecksumData | null>(null);
  const [inferredCharges, setInferredCharges] = useState<InferredChargeItem[]>([]);
  const [receiptStatus, setReceiptStatus] = useState<ReceiptStatus | null>(null);

  // Clean up all generated blob URLs when modal unmounts
  useEffect(() => {
    const urlsToRevoke = createdUrlsRef.current;
    return () => {
      urlsToRevoke.forEach((url) => {
        try {
          if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
  }, []);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

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
    setCameraNotice(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraNotice(
        'Opening your phone camera or photo picker. A live preview needs HTTPS when using a Wi-Fi address.'
      );
      nativeCameraInputRef.current?.click();
      return;
    }
    try {
      recordBreadcrumb('CAMERA', 'Calling getUserMedia for live camera stream');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      recordBreadcrumb('CAMERA', 'Live camera stream active');
    } catch {
      recordBreadcrumb('CAMERA', 'Live camera access unavailable, opening native camera picker');
      setCameraNotice(
        'Live camera access is unavailable. You can still take a photo with your phone camera or choose an image.'
      );
      nativeCameraInputRef.current?.click();
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    startOperation('Capturing photo from live camera');
    recordBreadcrumb('CAMERA', `Capturing video frame: ${video.videoWidth}x${video.videoHeight}`);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth || 1280, video.videoHeight || 720));
    canvas.width = Math.round((video.videoWidth || 1280) * scale);
    canvas.height = Math.round((video.videoHeight || 720) * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    stopCamera();
    finishOperation('Capturing photo from live camera');
    recordBreadcrumb(
      'CAMERA',
      `Photo blob created: ${blob ? (blob.size / 1024 / 1024).toFixed(2) + ' MB' : 'null'}`
    );
    if (blob) {
      const photoFile = new File([blob], newReceiptFileName(), { type: 'image/jpeg' });
      selectFiles([...selectedFiles, photoFile], photoFile);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>, append = false) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) {
      recordBreadcrumb(
        'CAMERA',
        `User picked ${selected.length} file(s): ${selected.map((f) => f.name + ' (' + (f.size / 1024 / 1024).toFixed(2) + ' MB)').join(', ')}`
      );
      setCameraNotice(null);
      selectFiles(append ? [...selectedFiles, ...selected] : selected);
    }
    e.target.value = '';
  }

  function selectFiles(files: File[], previewFile = files[0]) {
    setSelectedFiles(files);
    setReviewBatch([]);
    setReviewIndex(0);
    setBillRotations({});
    setBillFilter('all');
    setBatchFailures([]);
    setRotation(0);
    processFile(previewFile);
  }

  function processFile(f: File) {
    setFile(f);
    const url = URL.createObjectURL(f);
    createdUrlsRef.current.push(url);
    setPreviewUrl(url);
    setScanError(null);
  }

  async function addBillsToReview(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const outcomes = await scanBatch(files, {
        onProgress: (index, progress) => {
          setBatchScanIndex(index);
          setScanProgress(progress);
        },
      });

      const currentCount = reviewBatch.length;
      const addedEntries: ScannedBillEntry[] = [];
      const failures: string[] = [];

      outcomes.forEach((outcome, index) => {
        const billIdx = currentCount + addedEntries.length;
        const bName = formatBillName(billIdx);
        if (!outcome.ok) {
          failures.push(`${files[index].name}: ${outcome.error.message}`);
        } else if (!outcome.parsed.items.length) {
          failures.push(`${files[index].name}: no items found.`);
        } else {
          const fileObj = files[index];
          const pUrl = URL.createObjectURL(fileObj);
          createdUrlsRef.current.push(pUrl);
          addedEntries.push({
            billId: `bill_${Date.now()}_${billIdx}`,
            billIndex: billIdx,
            billName: bName,
            file: fileObj,
            previewUrl: pUrl,
            parsed: outcome.parsed,
            people: detectReceiptPeople(outcome.ocr),
          });
        }
      });

      if (failures.length) {
        setBatchFailures((current) => [...current, ...failures]);
      }

      if (addedEntries.length > 0) {
        const nextBatch = [...reviewBatch, ...addedEntries];
        setReviewBatch(nextBatch);
        setSelectedFiles((current) => [...current, ...addedEntries.map((e) => e.file)]);

        // Extract and tag new line items with their billIndex and billName
        const newItems: ParsedItem[] = [];
        addedEntries.forEach((entry) => {
          entry.parsed.items.forEach((it, idx) => {
            newItems.push({
              ...it,
              id: it.id
                ? `${entry.billId}_${it.id}`
                : `bill_${entry.billIndex}_item_${idx}_${Date.now()}`,
              billIndex: entry.billIndex,
              billName: entry.billName,
            });
          });
        });

        // Add all items directly to the unified items list on screen
        setItems((current) => [...current, ...newItems]);

        // Assign newly added items to group members by default
        setItemAssignments((current) => ({
          ...current,
          ...Object.fromEntries(newItems.map((it) => [it.id, members.map((m) => m.id)])),
        }));

        // Append taxes
        const newTaxes: Array<{ label: string; amountPaise: number }> = [];
        addedEntries.forEach((b) => {
          b.parsed.taxLines.forEach((t) => {
            newTaxes.push({ label: `${t.label} (${b.billName})`, amountPaise: t.amountPaise });
          });
        });
        setTaxLines((current) => [...current, ...newTaxes]);

        // Aggregate additional charges
        const addedService = addedEntries.reduce(
          (s, b) => s + (b.parsed.serviceChargePaise || 0),
          0
        );
        const addedDiscount = addedEntries.reduce((s, b) => s + (b.parsed.discountPaise || 0), 0);
        const addedRoundOff = addedEntries.reduce((s, b) => s + (b.parsed.roundOffPaise || 0), 0);
        setServiceChargePaise((prev) => prev + addedService);
        setDiscountPaise((prev) => prev + addedDiscount);
        setRoundOffPaise((prev) => prev + addedRoundOff);

        if (detectedTotalPaise !== null) {
          const addedDetected = addedEntries.reduce(
            (s, b) => s + (b.parsed.detectedTotalPaise || 0),
            0
          );
          setDetectedTotalPaise((prev) => (prev ?? 0) + addedDetected);
        }

        // Keep clean numbered bill naming
        setMerchant(nextBatch.map((b) => b.billName).join(', '));

        // Switch photo viewer to the newly added receipt
        setReviewIndex(currentCount);

        // Auto-categorize new items
        const run = ++categorizationRun.current;
        const originalNames = new Map(newItems.map((it) => [it.id, it.name]));
        void categorizeItems(
          newItems.map((it) => ({ id: it.id, name: it.name })),
          {
            onResult: (id, category) => {
              if (run !== categorizationRun.current || manuallyCategorizedIds.current.has(id))
                return;
              setItems((prev) =>
                prev.map((item) =>
                  item.id === id && item.name === originalNames.get(id)
                    ? { ...item, category }
                    : item
                )
              );
            },
            useModel: true,
          }
        );
      }
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not scan the added bill.');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  }

  async function runScan(filesToScan = selectedFiles) {
    if (!filesToScan.length) return;
    setIsScanning(true);
    setScanError(null);
    setBatchFailures([]);

    try {
      const outcomes =
        filesToScan.length === 1
          ? [
              await scanReceipt(filesToScan[0], {
                rotation: rotation || undefined,
                onProgress: setScanProgress,
              }),
            ]
          : await scanBatch(filesToScan, {
              onProgress: (index, progress) => {
                setBatchScanIndex(index);
                setScanProgress(progress);
              },
            });
      const good: Array<{ file: File; parsed: ParsedReceipt; people: ReceiptPerson[] }> = [];
      const failures: string[] = [];
      outcomes.forEach((outcome, index) => {
        if (!outcome.ok) failures.push(`${filesToScan[index].name}: ${outcome.error.message}`);
        else if (outcome.parsed.items.length === 0)
          failures.push(
            `${filesToScan[index].name}: no receipt items were found. Retake or edit this receipt separately.`
          );
        else
          good.push({
            file: filesToScan[index],
            parsed: outcome.parsed,
            people: detectReceiptPeople(outcome.ocr),
          });
      });
      setBatchFailures(failures);
      if (!good.length) {
        setScanError(failures.join(' '));
        return;
      }

      const batchEntries: ScannedBillEntry[] = good.map((g, idx) => {
        const pUrl = URL.createObjectURL(g.file);
        createdUrlsRef.current.push(pUrl);
        return {
          billId: `bill_${Date.now()}_${idx}`,
          billIndex: idx,
          billName: formatBillName(idx),
          file: g.file,
          previewUrl: pUrl,
          parsed: g.parsed,
          people: g.people,
        };
      });

      setReviewBatch(batchEntries);
      setReviewIndex(0);
      setPreviewUrl(batchEntries[0].previewUrl);
      loadBatchData(batchEntries);
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
    setScanProgress({
      stage: 'parsing',
      overall: 0.8,
      message: 'Processing sample receipt text...',
    });

    setTimeout(() => {
      const rawText = MOCK_RECEIPT_TEXT[mockKey];
      const ocrResult = fromPlainText(rawText);
      const parsed = parseReceipt(ocrResult);
      const entry: ScannedBillEntry = {
        billId: `mock_${Date.now()}`,
        billIndex: 0,
        billName: 'Bill No. 1',
        file: new File([''], 'sample-receipt.jpg', { type: 'image/jpeg' }),
        previewUrl: '',
        parsed,
        people: detectReceiptPeople(ocrResult),
      };
      setReviewBatch([entry]);
      setReviewIndex(0);
      loadBatchData([entry]);
      setIsScanning(false);
      setScanProgress(null);
    }, 400);
  }

  function loadBatchData(batch: ScannedBillEntry[]) {
    if (!batch.length) return;
    const run = ++categorizationRun.current;
    manuallyCategorizedIds.current.clear();
    setCategoryStatus('loading-model');
    setCategoryProgress(null);

    // Clean, normal bill names - never use OCR garbage header text
    const defaultTitle =
      batch.length === 1 ? batch[0].billName : batch.map((b) => b.billName).join(', ');
    setMerchant(defaultTitle);

    const firstDate =
      batch.find((b) => b.parsed.dateISO)?.parsed.dateISO ||
      new Date().toISOString().substring(0, 10);
    setExpenseDate(firstDate);
    const defaultPayer = members.find((member) => member.isCurrentUser)?.id || members[0]?.id || '';
    setBillPayerIds(
      Object.fromEntries(
        batch.map((bill) => {
          const namedPayer = bill.people.find((person) => person.role === 'payer');
          const matchingMember = members.find(
            (member) => member.name.toLocaleLowerCase() === namedPayer?.name.toLocaleLowerCase()
          );
          return [bill.billId, matchingMember?.id ?? defaultPayer];
        })
      )
    );

    // Combine line items from all bills into one unified list
    const allItems: ParsedItem[] = [];
    batch.forEach((entry) => {
      entry.parsed.items.forEach((it, idx) => {
        allItems.push({
          ...it,
          id: it.id
            ? `${entry.billId}_${it.id}`
            : `bill_${entry.billIndex}_item_${idx}_${Date.now()}`,
          billIndex: entry.billIndex,
          billName: entry.billName,
        });
      });
    });

    setItems(allItems);
    setAmountDrafts({});

    // People from all bills
    const allPeople: ReceiptPerson[] = [];
    batch.forEach((b) => allPeople.push(...b.people));
    setPendingPeople(
      allPeople.filter(
        (person) =>
          !isKnownGroupMember(
            person.name,
            members.map((member) => member.name)
          )
      )
    );
    setNewMemberName('');
    setReplacementMemberId(
      members.find((member) => member.isCurrentUser)?.id ?? members[0]?.id ?? ''
    );

    // Default item assignments: all members in the group
    setItemAssignments(
      Object.fromEntries(allItems.map((item) => [item.id, members.map((member) => member.id)]))
    );
    setOpenAssignmentId(null);
    setSplitMode('itemized');
    setSplitInputs({});

    // Combined taxes across bills
    const combinedTaxes: Array<{ label: string; amountPaise: number }> = [];
    batch.forEach((b) => {
      b.parsed.taxLines.forEach((t) => {
        combinedTaxes.push({
          label: `${t.label}${batch.length > 1 ? ` (${b.billName})` : ''}`,
          amountPaise: t.amountPaise,
        });
      });
    });
    setTaxLines(combinedTaxes);

    // Sum service charges, discounts, and roundoffs
    setServiceChargePaise(batch.reduce((sum, b) => sum + (b.parsed.serviceChargePaise || 0), 0));
    setDiscountPaise(batch.reduce((sum, b) => sum + (b.parsed.discountPaise || 0), 0));
    setRoundOffPaise(batch.reduce((sum, b) => sum + (b.parsed.roundOffPaise || 0), 0));

    // Stated detected totals
    const hasAllTotals = batch.every(
      (b) => typeof b.parsed.detectedTotalPaise === 'number' && b.parsed.detectedTotalPaise > 0
    );
    setDetectedTotalPaise(
      hasAllTotals ? batch.reduce((sum, b) => sum + (b.parsed.detectedTotalPaise || 0), 0) : null
    );
    setTaxIncluded(batch.some((b) => b.parsed.taxIncluded));

    // Inferred charges across bills
    const combinedInferred: InferredChargeItem[] = [];
    batch.forEach((b) => {
      b.parsed.inferredCharges?.forEach((ic) => {
        combinedInferred.push({
          ...ic,
          label: `${ic.label}${batch.length > 1 ? ` (${b.billName})` : ''}`,
        });
      });
    });
    setInferredCharges(combinedInferred);

    // Combined status
    const statuses = batch.map((b) => b.parsed.receiptStatus).filter(Boolean);
    if (statuses.includes('UNRESOLVED')) setReceiptStatus('UNRESOLVED');
    else if (statuses.includes('CHECK')) setReceiptStatus('CHECK');
    else if (statuses.length > 0 && statuses.every((s) => s === 'VERIFIED'))
      setReceiptStatus('VERIFIED');
    else setReceiptStatus(null);

    setItemQtyChecksum(batch.length === 1 ? (batch[0].parsed.itemQtyChecksum ?? null) : null);

    // Auto-categorize all items
    const originalNames = new Map(allItems.map((it) => [it.id, it.name]));
    void categorizeItems(
      allItems.map((it) => ({ id: it.id, name: it.name })),
      {
        onResult: (id, category) => {
          if (run !== categorizationRun.current || manuallyCategorizedIds.current.has(id)) return;
          setItems((prev) =>
            prev.map((item) =>
              item.id === id && item.name === originalNames.get(id) ? { ...item, category } : item
            )
          );
        },
        onStatus: (status, progress) => {
          if (run !== categorizationRun.current) return;
          setCategoryStatus(status);
          setCategoryProgress(typeof progress === 'number' ? progress : null);
        },
        useModel: true,
      }
    );

    setPreviousStep('capture');
    setStep('review');
  }

  function addCustomItem(
    billIdx = reviewBatch[reviewIndex]?.billIndex ?? 0,
    bName = reviewBatch[reviewIndex]?.billName ?? 'Bill No. 1'
  ) {
    const newId = `item_custom_${Date.now()}`;
    const newItem: ParsedItem = {
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
      billIndex: billIdx,
      billName: bName,
    };
    setItems((prev) => [...prev, newItem]);
    setItemAssignments((prev) => ({
      ...prev,
      [newId]: members.map((m) => m.id),
    }));
  }

  function removeBillFromBatch(billIndexToRemove: number) {
    if (reviewBatch.length <= 1) return;
    const billToRemove = reviewBatch[billIndexToRemove];
    if (!billToRemove) return;

    if (billToRemove.previewUrl && billToRemove.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(billToRemove.previewUrl);
      } catch {
        // ignore
      }
    }

    const newBatch = reviewBatch.filter((_, idx) => idx !== billIndexToRemove);
    setPendingPeople((current) =>
      current.filter((person) =>
        newBatch.some((bill) => bill.people.some((entry) => entry.name === person.name))
      )
    );
    setTaxLines((current) =>
      current.filter((line) => !line.label.endsWith(`(${billToRemove.billName})`))
    );
    setServiceChargePaise((current) =>
      Math.max(0, current - (billToRemove.parsed.serviceChargePaise || 0))
    );
    setDiscountPaise((current) => Math.max(0, current - (billToRemove.parsed.discountPaise || 0)));
    setRoundOffPaise((current) => current - (billToRemove.parsed.roundOffPaise || 0));
    setDetectedTotalPaise((current) =>
      current === null ? null : Math.max(0, current - (billToRemove.parsed.detectedTotalPaise || 0))
    );
    setBillPayerIds((current) => {
      const next = { ...current };
      delete next[billToRemove.billId];
      return next;
    });
    const reindexedBatch = newBatch.map((entry, newIdx) => ({
      ...entry,
      billIndex: newIdx,
      billName: formatBillName(newIdx),
    }));
    setTaxLines((current) =>
      current.map((line) => {
        const newBill = reindexedBatch.find((bill) => {
          const oldBill = reviewBatch.find((entry) => entry.billId === bill.billId);
          return oldBill && line.label.endsWith(`(${oldBill.billName})`);
        });
        if (!newBill) return line;
        return {
          ...line,
          label: line.label.replace(/\(Bill No\. \d+\)$/, `(${newBill.billName})`),
        };
      })
    );

    setItems((current) =>
      current
        .filter((it) => it.billIndex !== billToRemove.billIndex)
        .map((it) => {
          const oldEntry = reviewBatch.find((oldB) => oldB.billIndex === it.billIndex);
          const found = oldEntry
            ? reindexedBatch.find((b) => b.billId === oldEntry.billId)
            : undefined;
          if (found) {
            return { ...it, billIndex: found.billIndex, billName: found.billName };
          }
          return it;
        })
    );

    setReviewBatch(reindexedBatch);
    setMerchant(
      reindexedBatch.length === 1
        ? reindexedBatch[0].billName
        : reindexedBatch.map((b) => b.billName).join(', ')
    );
    setReviewIndex((current) => Math.min(current, reindexedBatch.length - 1));
    if (typeof billFilter === 'number' && billFilter >= reindexedBatch.length) {
      setBillFilter('all');
    }
  }

  // Active receipt photo and rotation
  const activeBill = reviewBatch[reviewIndex] || reviewBatch[0];
  const activePhotoUrl = activeBill?.previewUrl || previewUrl;
  const activeRotation = billRotations[reviewIndex] ?? rotation;

  // Real-time calculation and validation
  const itemsSumPaise = useMemo(
    () => items.reduce((sum, item) => sum + item.totalPaise, 0),
    [items]
  );
  const effectiveTaxPaise = taxIncluded ? 0 : taxLines.reduce((sum, t) => sum + t.amountPaise, 0);
  const calculatedGrandTotalPaise =
    itemsSumPaise + effectiveTaxPaise + serviceChargePaise - discountPaise + roundOffPaise;
  const finalGrandTotalPaise = detectedTotalPaise ?? calculatedGrandTotalPaise;
  const isBatchReview = reviewBatch.length > 1;
  const unassignedItems = items.filter((item) => !itemAssignments[item.id]?.length);

  // Group line items by receipt for headers
  const billGroups = useMemo(() => {
    if (reviewBatch.length <= 1) {
      return [
        {
          billIndex: 0,
          billName: reviewBatch[0]?.billName || 'Bill No. 1',
          items,
          subtotalPaise: items.reduce((s, it) => s + it.totalPaise, 0),
        },
      ];
    }

    const groups: Array<{
      billIndex: number;
      billName: string;
      items: ParsedItem[];
      subtotalPaise: number;
    }> = [];

    reviewBatch.forEach((bill) => {
      const bItems = items.filter((it) => (it.billIndex ?? 0) === bill.billIndex);
      groups.push({
        billIndex: bill.billIndex,
        billName: bill.billName,
        items: bItems,
        subtotalPaise: bItems.reduce((s, it) => s + it.totalPaise, 0),
      });
    });

    const known = new Set(reviewBatch.map((b) => b.billIndex));
    const otherItems = items.filter((it) => it.billIndex !== undefined && !known.has(it.billIndex));
    if (otherItems.length) {
      groups.push({
        billIndex: 999,
        billName: 'Other Items',
        items: otherItems,
        subtotalPaise: otherItems.reduce((s, it) => s + it.totalPaise, 0),
      });
    }

    return groups;
  }, [reviewBatch, items]);

  const displayedGroups = useMemo(() => {
    if (billFilter === 'all') return billGroups;
    return billGroups.filter((g) => g.billIndex === billFilter);
  }, [billGroups, billFilter]);

  const batchExpenses = useMemo(() => {
    if (!isBatchReview || !members.length || unassignedItems.length || finalGrandTotalPaise <= 0) {
      return [];
    }
    try {
      const bills = billGroups.map((bill) => ({
        billId:
          reviewBatch.find((entry) => entry.billIndex === bill.billIndex)?.billId ?? bill.billName,
        billIndex: bill.billIndex,
        billName: bill.billName,
        payerId:
          billPayerIds[
            reviewBatch.find((entry) => entry.billIndex === bill.billIndex)?.billId ?? ''
          ] ?? payerId,
        items: bill.items.map((item): ReceiptItem => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          lineTotalPaise: item.totalPaise,
          assignedMemberIds: itemAssignments[item.id] ?? [],
          category: item.category ?? 'Other',
          billIndex: item.billIndex,
          billName: item.billName,
          ocrConfidence: Math.round(item.confidence * 100),
          needsReview: item.uncertainWords?.length > 0 || item.confidence < 0.7,
        })),
      }));
      return buildBatchExpenses({
        bills,
        groupId,
        date: expenseDate,
        description: merchant.trim() || 'Scanned Receipt',
        memberIds: members.map((member) => member.id),
        taxLines: taxIncluded ? [] : taxLines,
        serviceChargePaise,
        discountPaise,
        confirmedTotalPaise: finalGrandTotalPaise,
        batchId: 'preview-batch',
      });
    } catch {
      return [];
    }
  }, [
    isBatchReview,
    members,
    unassignedItems.length,
    finalGrandTotalPaise,
    billGroups,
    reviewBatch,
    billPayerIds,
    payerId,
    itemAssignments,
    groupId,
    expenseDate,
    merchant,
    taxIncluded,
    taxLines,
    serviceChargePaise,
    discountPaise,
  ]);

  const itemizedShares = useMemo(() => {
    if (!items.length || unassignedItems.length || !members.length || finalGrandTotalPaise <= 0)
      return [];
    const receiptItems: ReceiptItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      lineTotalPaise: item.totalPaise,
      assignedMemberIds: itemAssignments[item.id] ?? [],
      category: item.category ?? 'Other',
      billIndex: item.billIndex,
      billName: item.billName,
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
  }, [
    items,
    itemAssignments,
    members,
    unassignedItems.length,
    finalGrandTotalPaise,
    taxIncluded,
    taxLines,
    serviceChargePaise,
    discountPaise,
  ]);

  const splitInputTotal = members.reduce(
    (sum, member) => sum + (Number(splitInputs[member.id]) || 0),
    0
  );
  const splitInputValid =
    splitMode === 'exact'
      ? Math.abs(splitInputTotal * 100 - finalGrandTotalPaise) < 0.5
      : splitMode === 'percentage'
        ? Math.abs(splitInputTotal - 100) < 0.001
        : splitMode === 'shares'
          ? splitInputTotal > 0
          : true;
  const splitShares = useMemo(() => {
    if (isBatchReview) {
      return members.map((member) => ({
        memberId: member.id,
        amountPaise: batchExpenses.reduce(
          (sum, expense) =>
            sum +
            (expense.memberShares.find((share) => share.memberId === member.id)?.amountPaise ?? 0),
          0
        ),
      }));
    }
    if (splitMode === 'itemized') return itemizedShares;
    if (!members.length || finalGrandTotalPaise <= 0 || !splitInputValid) return [];
    return calculateExpenseShares({
      totalPaise: finalGrandTotalPaise,
      splitMode,
      participantIds: members.map((member) => member.id),
      exactAmounts: Object.fromEntries(
        members.map((member) => [
          member.id,
          Math.round((Number(splitInputs[member.id]) || 0) * 100),
        ])
      ),
      percentagesBasisPoints: Object.fromEntries(
        members.map((member) => [
          member.id,
          Math.round((Number(splitInputs[member.id]) || 0) * 100),
        ])
      ),
      sharesWeights: Object.fromEntries(
        members.map((member) => [member.id, Number(splitInputs[member.id]) || 0])
      ),
    });
  }, [
    isBatchReview,
    batchExpenses,
    splitMode,
    itemizedShares,
    members,
    finalGrandTotalPaise,
    splitInputValid,
    splitInputs,
  ]);

  function moveTo(next: 'capture' | 'review' | 'assign' | 'summary') {
    setPreviousStep(step);
    setStep(next);
  }

  const validationResult = useMemo(() => {
    return validateTotals({
      itemTotalsPaise: items.map((i) => i.totalPaise),
      taxPaise: effectiveTaxPaise,
      serviceChargePaise,
      discountPaise,
      roundOffPaise,
      statedTotalPaise: detectedTotalPaise,
    });
  }, [
    items,
    effectiveTaxPaise,
    serviceChargePaise,
    discountPaise,
    roundOffPaise,
    detectedTotalPaise,
  ]);

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
    if (splitMode === 'itemized' && unassignedItems.length) {
      setScanError(
        `Assign every item before saving. ${unassignedItems.length} item(s) still need members.`
      );
      return;
    }

    if (
      !splitInputValid ||
      !splitShares.length ||
      (isBatchReview && batchExpenses.length !== reviewBatch.length)
    ) {
      setScanError('Complete the split amounts before saving.');
      return;
    }

    const domainItems: ReceiptItem[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      lineTotalPaise: item.totalPaise,
      assignedMemberIds: itemAssignments[item.id] ?? [],
      category: (item.category as Category) || 'Food',
      ocrConfidence: Math.round(item.confidence * 100),
      needsReview: item.uncertainWords?.length > 0 || item.confidence < 0.7,
      billIndex: item.billIndex,
      billName: item.billName,
    }));

    const newExpense: Expense = {
      id: newExpenseId(),
      groupId,
      description: merchant.trim() || 'Scanned Receipt',
      date: expenseDate,
      payerId,
      amountPaise: finalGrandTotalPaise,
      splitMode,
      memberShares: splitShares,
      items: domainItems,
      taxLines,
      serviceChargePaise,
      discountPaise,
      createdAt: new Date().toISOString(),
    };

    try {
      setIsSaving(true);
      if (isBatchReview) {
        await onSaveExpenses(
          batchExpenses.map((expense, index) => ({
            ...expense,
            id: `${newExpense.id}-${index}`,
          }))
        );
      } else {
        await onSaveExpense(newExpense);
      }
      onClose();
    } catch (error) {
      setScanError(
        error instanceof Error ? error.message : 'Could not save this receipt. Please try again.'
      );
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
      if (role === 'payer') {
        setBillPayerIds((current) => ({
          ...current,
          ...Object.fromEntries(
            reviewBatch
              .filter((bill) =>
                bill.people.some(
                  (person) =>
                    person.role === 'payer' &&
                    person.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase()
                )
              )
              .map((bill) => [bill.billId, added.id])
          ),
        }));
      }
      setPendingPeople((current) =>
        current.filter(
          (person) => person.name.toLocaleLowerCase() !== name.trim().toLocaleLowerCase()
        )
      );
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
    if (person.role === 'payer') {
      setBillPayerIds((current) => ({
        ...current,
        ...Object.fromEntries(
          reviewBatch
            .filter((bill) =>
              bill.people.some(
                (entry) =>
                  entry.role === 'payer' &&
                  entry.name.toLocaleLowerCase() === person.name.toLocaleLowerCase()
              )
            )
            .map((bill) => [bill.billId, replacementMemberId])
        ),
      }));
    }
    if (person.role !== 'payer')
      setItemAssignments((current) => ({
        ...current,
        ...Object.fromEntries(items.map((item) => [item.id, [replacementMemberId]])),
      }));
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
      billIndex: item.billIndex,
      billName: item.billName,
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

  useEffect(() => {
    if (initialFiles?.length && !initialScanStarted.current) {
      initialScanStarted.current = true;
      queueMicrotask(() => {
        selectFiles(initialFiles);
        void runScan(initialFiles);
      });
    }
    // Consume the initial selection only once while this scanner is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  return (
    <div className="ss-scan-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="ss-scan-dialog bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="ss-scan-header p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                {step === 'capture'
                  ? 'How would you like to add it?'
                  : step === 'review'
                    ? `We found ${items.length} items${reviewBatch.length > 1 ? ` across ${reviewBatch.length} bills` : ''}.`
                    : step === 'assign'
                      ? 'Assign each item.'
                      : 'Everything adds up.'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {step === 'capture'
                  ? 'Take a photo or upload receipts to extract items.'
                  : step === 'review'
                    ? 'Review and correct the detected receipts on one screen.'
                    : step === 'assign'
                      ? 'Choose who shared each item.'
                      : 'Tax and charges follow each person’s items.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {step === 'capture' && onSwitchToManual && (
          <div className="ss-scan-route-tabs">
            <button type="button" className="active">
              ▤ Scan receipt
            </button>
            <button type="button" onClick={onSwitchToManual}>
              ＋ Manual expense
            </button>
          </div>
        )}

        {step !== 'capture' && (
          <div
            className="ss-workflow-progress"
            aria-label={`Step ${step === 'review' ? 1 : step === 'assign' ? 2 : 3} of 3`}
          >
            <button
              type="button"
              onClick={() =>
                moveTo(step === 'review' ? 'capture' : step === 'assign' ? 'review' : 'assign')
              }
            >
              ‹{' '}
              {step === 'review'
                ? 'Scan receipt'
                : step === 'assign'
                  ? 'Review receipt'
                  : 'Assign items'}
            </button>
            <div>
              <span>
                Step {step === 'review' ? 1 : step === 'assign' ? 2 : 3} of 3 ·{' '}
                {step === 'review' ? 'Review' : step === 'assign' ? 'Assign' : 'Split'}
              </span>
              <div className="ss-workflow-track">
                <i
                  className={`ss-workflow-fill step-${step === 'review' ? 1 : step === 'assign' ? 2 : 3} from-${previousStep === 'summary' ? 3 : previousStep === 'assign' ? 2 : 1}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="ss-scan-body flex-1 overflow-y-auto p-6 space-y-6">
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleFileInput(e, true)}
            className="hidden"
            aria-label="Take receipt photo with phone camera"
          />
          <input
            ref={additionalBillInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => void addBillsToReview(e)}
            className="hidden"
            aria-label="Add another receipt"
          />
          {scanError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Scan Notice</p>
                <p className="text-xs text-red-200">{scanError}</p>
              </div>
            </div>
          )}
          {cameraNotice && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-lime-500/30 bg-lime-500/10 p-3 text-xs text-lime-100"
            >
              <span>{cameraNotice}</span>
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="rounded-lg border border-lime-400/40 px-3 py-2 font-semibold text-lime-200 cursor-pointer"
              >
                Open phone camera
              </button>
            </div>
          )}

          {step === 'capture' && (
            <div className="space-y-6">
              {/* Camera Feed or Upload Box */}
              {cameraActive ? (
                <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 flex flex-col items-center justify-center min-h-[320px]">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full max-h-[380px] object-contain"
                  />
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
                  <div className="mt-3 flex flex-wrap justify-center items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Add camera photo
                    </button>
                    <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer">
                      Add files
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={(e) => handleFileInput(e, true)}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270)
                      }
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
                <div className="ss-capture-grid">
                  <div className="ss-capture-drop">
                    <span>
                      <Camera size={29} />
                    </span>
                    <h3>Drop a receipt here</h3>
                    <p>Upload clear JPG or PNG receipts, or use your phone camera.</p>
                    <div>
                      <button type="button" onClick={() => void startCamera()}>
                        <Camera size={16} /> Take photo
                      </button>
                      <label>
                        <Upload size={16} /> Choose file
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(event) => handleFileInput(event)}
                        />
                      </label>
                    </div>
                    <small>Good lighting and a flat receipt give the best result.</small>
                  </div>
                  <aside>
                    <Camera size={17} />
                    <div>
                      <strong>Camera not available?</strong>
                      <p>
                        You can upload multiple receipt images or switch to manual entry at any
                        time.
                      </p>
                    </div>
                  </aside>
                </div>
              )}

              {step === 'capture' && selectedFiles.length > 1 && (
                <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-200">
                  <strong>{selectedFiles.length} receipts selected</strong>
                  <p className="mt-1 text-slate-400">
                    All receipts will be processed and displayed together on a single screen.
                  </p>
                  <ul className="mt-2 max-h-20 overflow-y-auto list-disc pl-5">
                    {selectedFiles.map((selected, index) => (
                      <li key={`${selected.name}-${index}`}>
                        {formatBillName(index)}: {selected.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Live Scanning Progress */}
              {isScanning && (
                <div className="p-5 rounded-2xl bg-slate-900/95 border border-purple-500/40 shadow-[0_0_25px_rgba(147,51,234,0.15)] space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
                      <span>
                        {selectedFiles.length > 1
                          ? `Receipt ${batchScanIndex + 1} of ${selectedFiles.length}: `
                          : ''}
                        {scanProgress?.message || 'Processing receipt image...'}
                      </span>
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
                  onClick={() => void runScan()}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5" />
                  Analyze{' '}
                  {selectedFiles.length > 1 ? `${selectedFiles.length} Receipts` : 'Receipt'}
                </button>
              )}

              {/* Instant Demo Presets */}
              <details className="border-t border-slate-800 pt-5">
                <summary className="cursor-pointer text-xs text-slate-400">
                  Try sample receipts
                </summary>
                <div className="mt-4">
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
                      <div className="font-semibold text-slate-200 text-xs truncate">
                        🍕 Night Bites Cafe
                      </div>
                      <div className="text-[11px] text-slate-400">₹840 · CGST/SGST</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => loadMockReceipt('canteenNoTotal')}
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-left transition-colors cursor-pointer"
                    >
                      <div className="font-semibold text-slate-200 text-xs truncate">
                        🥪 IIT Canteen
                      </div>
                      <div className="text-[11px] text-slate-400">₹150 · No total printed</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => loadMockReceipt('serviceAndDiscount')}
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-left transition-colors cursor-pointer"
                    >
                      <div className="font-semibold text-slate-200 text-xs truncate">
                        🍸 Hostel Kitchen
                      </div>
                      <div className="text-[11px] text-slate-400">₹442 · Discount + Svc</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => loadMockReceipt('taxInclusive')}
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-left transition-colors cursor-pointer"
                    >
                      <div className="font-semibold text-slate-200 text-xs truncate">
                        🥛 Fresh Mart
                      </div>
                      <div className="text-[11px] text-slate-400">₹177 · MRP Tax Incl.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => loadMockReceipt('wrapped')}
                      className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-left transition-colors cursor-pointer"
                    >
                      <div className="font-semibold text-slate-200 text-xs truncate">
                        🌯 Snack Shack
                      </div>
                      <div className="text-[11px] text-slate-400">₹220 · Multi-line</div>
                    </button>
                  </div>
                </div>
              </details>
            </div>
          )}

          {step === 'review' && (
            <div className="ss-review-layout">
              {/* Photo Viewer with Carousel/Slider Toggle */}
              <div className="ss-review-photo">
                {/* Photo Slider / Carousel Toggle */}
                {reviewBatch.length > 1 && (
                  <div className="ss-photo-slider mb-2.5">
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-750 px-2 py-1.5 rounded-xl gap-1">
                      <button
                        type="button"
                        disabled={reviewIndex === 0}
                        onClick={() => setReviewIndex((prev) => Math.max(0, prev - 1))}
                        className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Previous receipt photo"
                        aria-label="Previous bill photo"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                        {reviewBatch.map((entry, idx) => (
                          <button
                            type="button"
                            key={entry.billId || idx}
                            onClick={() => setReviewIndex(idx)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                              reviewIndex === idx
                                ? 'bg-lime-400 text-slate-950 font-bold shadow-sm'
                                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                            }`}
                          >
                            {entry.billName}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={reviewIndex === reviewBatch.length - 1}
                        onClick={() =>
                          setReviewIndex((prev) => Math.min(reviewBatch.length - 1, prev + 1))
                        }
                        className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                        title="Next receipt photo"
                        aria-label="Next bill photo"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="ss-review-image">
                  {activePhotoUrl && (
                    <img
                      src={activePhotoUrl}
                      alt={activeBill?.billName || 'Scanned receipt'}
                      style={{ transform: `rotate(${activeRotation}deg)` }}
                    />
                  )}
                  {reviewBatch.length > 0 && (
                    <span>
                      {activeBill?.billName || 'Bill No. 1'} ({reviewIndex + 1} of{' '}
                      {reviewBatch.length})
                    </span>
                  )}
                </div>

                <div className="ss-review-photo-actions">
                  <button
                    type="button"
                    onClick={() => {
                      const curRot = billRotations[reviewIndex] ?? rotation;
                      const nextRot = ((curRot + 90) % 360) as 0 | 90 | 180 | 270;
                      setBillRotations((prev) => ({ ...prev, [reviewIndex]: nextRot }));
                      setRotation(nextRot);
                    }}
                  >
                    Rotate
                  </button>
                  <button type="button" onClick={() => setPreviewZoomed(true)}>
                    Zoom
                  </button>
                </div>

                {reviewBatch.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBillFromBatch(reviewIndex)}
                    className="w-full text-xs text-red-400 hover:text-red-300 py-1.5 font-medium transition-colors mb-2 cursor-pointer"
                  >
                    Remove {activeBill?.billName || 'this bill'}
                  </button>
                )}

                <button
                  type="button"
                  className="ss-add-bill"
                  disabled={isScanning}
                  onClick={() => additionalBillInputRef.current?.click()}
                >
                  {isScanning ? 'Scanning added bill…' : '＋ Add another bill'}
                </button>
              </div>

              {/* Review Editor - Unified Items for All Bills */}
              <div className="ss-review-editor space-y-6">
                {items.some((item) => item.confidence < 0.7 || item.uncertainWords?.length) && (
                  <div className="ss-confidence-note" role="status">
                    <strong>! &nbsp; One field needs a quick check</strong>
                    <p>Review the highlighted item names before continuing.</p>
                  </div>
                )}

                {reviewBatch.length > 1 && (
                  <div
                    className="rounded-xl border border-lime-500/30 bg-lime-500/10 px-4 py-3 text-sm text-slate-100 flex flex-wrap items-center justify-between gap-2"
                    role="status"
                  >
                    <div>
                      <strong>{reviewBatch.length} Receipts Combined</strong>
                      <p className="text-xs text-slate-300 mt-0.5">
                        All extracted items from your {reviewBatch.length} bills are visible on this
                        single screen.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-lime-400 text-slate-950 font-bold text-xs shrink-0">
                      {items.length} Total Items
                    </span>
                  </div>
                )}

                {batchFailures.length > 0 && (
                  <div
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200"
                    role="alert"
                  >
                    <strong>{batchFailures.length} receipt(s) could not be scanned:</strong>
                    <ul className="list-disc pl-5 mt-1">
                      {batchFailures.map((failure, index) => (
                        <li key={index}>{failure}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {pendingPeople.length > 0 && (
                  <div
                    className="rounded-xl border border-amber-400/60 bg-amber-500/10 p-4 text-sm text-slate-100"
                    role="alert"
                    aria-live="assertive"
                  >
                    <h3 className="font-bold text-amber-200">Unknown name on this receipt</h3>
                    <p className="mt-1">
                      The receipt says <strong>{pendingPeople[0].name}</strong> (
                      {pendingPeople[0].role}), but this person is not in the current group. Resolve
                      this before saving.{' '}
                      {pendingPeople.length > 1
                        ? `${pendingPeople.length - 1} more name(s) need review.`
                        : ''}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        disabled={isAddingMember}
                        onClick={() =>
                          void addPersonToGroup(pendingPeople[0].name, pendingPeople[0].role)
                        }
                        className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-bold text-slate-950 cursor-pointer"
                      >
                        Add to group, then assign items
                      </button>
                      <select
                        aria-label="Existing member to use instead"
                        value={replacementMemberId}
                        onChange={(event) => setReplacementMemberId(event.target.value)}
                        className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-2 text-xs"
                      >
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => assignExistingMemberForPerson(pendingPeople[0])}
                        className="rounded-lg border border-lime-400 px-3 py-2 text-xs font-bold text-lime-200 cursor-pointer"
                      >
                        {pendingPeople[0].role === 'payer'
                          ? 'Use selected member as payer'
                          : 'Assign this bill’s items to selected member'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingPeople((current) => current.slice(1))}
                        className="rounded-lg border border-slate-600 px-3 py-2 text-xs cursor-pointer"
                      >
                        Ignore printed name
                      </button>
                      {reviewBatch.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeBillFromBatch(reviewIndex)}
                          className="rounded-lg border border-red-400/60 px-3 py-2 text-xs text-red-200 cursor-pointer"
                        >
                          Discard {activeBill?.billName || 'this receipt'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => moveTo('capture')}
                          className="rounded-lg border border-red-400/60 px-3 py-2 text-xs text-red-200 cursor-pointer"
                        >
                          Discard this receipt
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {isBatchReview && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-200">
                    <label htmlFor="batch-new-member">Someone missing from the group?</label>
                    <input
                      id="batch-new-member"
                      value={newMemberName}
                      onChange={(event) => setNewMemberName(event.target.value)}
                      placeholder="Member name"
                      className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={!newMemberName.trim() || isAddingMember}
                      onClick={() => void addPersonToGroup(newMemberName)}
                      className="rounded-lg border border-lime-400 px-3 py-1.5 font-semibold text-lime-200 disabled:opacity-50 cursor-pointer"
                    >
                      Add member
                    </button>
                  </div>
                )}

                {categoryStatus && categoryStatus !== 'ready' && (
                  <div
                    className="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-slate-200"
                    role="status"
                    aria-live="polite"
                  >
                    {categoryStatus === 'failed'
                      ? 'Automatic categorization is unavailable. You can choose each category manually.'
                      : categoryStatus === 'downloading'
                        ? `Downloading the item categorization model${categoryProgress === null ? '…' : ` (${Math.round(categoryProgress)}%)`}`
                        : 'Categorizing receipt items in the background…'}
                  </div>
                )}

                {/* Validation Status Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    receiptStatus === 'VERIFIED' && validationResult.status === 'ok'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : validationResult.status === 'rounding'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                        : validationResult.status === 'unconfirmed'
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}
                >
                  {receiptStatus === 'VERIFIED' && validationResult.status === 'ok' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <div className="font-semibold text-sm">
                      {receiptStatus === 'VERIFIED' &&
                        validationResult.status === 'ok' &&
                        'Verified Match (Dual Proof Passed)'}
                      {receiptStatus === 'CHECK' && 'Review Flagged Items'}
                      {receiptStatus !== 'CHECK' &&
                        validationResult.status === 'rounding' &&
                        'Rounding Match'}
                      {receiptStatus !== 'CHECK' &&
                        validationResult.status === 'unconfirmed' &&
                        'Calculated Total'}
                      {validationResult.status === 'mismatch' && 'Discrepancy Detected'}
                    </div>
                    <div className="text-xs opacity-90">{validationResult.message}</div>
                  </div>
                </div>

                {/* Expense Metadata Form */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Expense Title / Merchant
                    </label>
                    <input
                      type="text"
                      value={merchant}
                      onChange={(e) => setMerchant(e.target.value)}
                      placeholder="e.g. Bill No. 1, Bill No. 2"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Expense Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={expenseDate}
                        onChange={(e) => setExpenseDate(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  {!isBatchReview && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Paid By
                      </label>
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
                  )}
                </div>

                {isBatchReview && (
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    role="group"
                    aria-label="Payer for each scanned bill"
                  >
                    {reviewBatch.map((bill) => (
                      <label
                        key={bill.billId}
                        className="block rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-xs font-semibold text-slate-200"
                      >
                        {bill.billName} · Paid by
                        <select
                          value={billPayerIds[bill.billId] ?? payerId}
                          onChange={(event) =>
                            setBillPayerIds((current) => ({
                              ...current,
                              [bill.billId]: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                        >
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}

                {/* Item/Qty Checksum Banner */}
                {itemQtyChecksum && (
                  <div
                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                      itemQtyChecksum.verified
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="font-medium">{itemQtyChecksum.message}</span>
                  </div>
                )}

                {/* Inferred Charges Bridge Card */}
                {inferredCharges.length > 0 && (
                  <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-200 text-xs space-y-1.5">
                    <div className="font-semibold flex items-center gap-1.5 text-blue-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      Inferred Tax / Charges Bridge
                    </div>
                    <div className="space-y-1">
                      {inferredCharges.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-slate-200">
                          <span>{c.label}:</span>
                          <span className="font-bold text-white">{formatRupees(c.paise)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unified Items Table with Section Headers per Bill */}
                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-850/60">
                  <div className="p-3.5 bg-slate-800/80 border-b border-slate-750 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-blue-400" />
                        Detected Line Items ({items.length})
                      </span>
                      {reviewBatch.length > 1 && (
                        <span className="text-xs text-slate-400">
                          across {reviewBatch.length} bills
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {reviewBatch.length > 1 && (
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setBillFilter('all')}
                            className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                              billFilter === 'all'
                                ? 'bg-lime-400 text-slate-950 font-bold'
                                : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            All Bills
                          </button>
                          {reviewBatch.map((b) => (
                            <button
                              type="button"
                              key={b.billIndex}
                              onClick={() => setBillFilter(b.billIndex)}
                              className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                                billFilter === b.billIndex
                                  ? 'bg-lime-400 text-slate-950 font-bold'
                                  : 'text-slate-300 hover:text-white'
                              }`}
                            >
                              {b.billName}
                            </button>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const targetIndex =
                            typeof billFilter === 'number'
                              ? billFilter
                              : (reviewBatch[reviewIndex]?.billIndex ?? 0);
                          const targetName =
                            reviewBatch.find((b) => b.billIndex === targetIndex)?.billName ||
                            formatBillName(targetIndex);
                          addCustomItem(targetIndex, targetName);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Item
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800 max-h-[380px] overflow-y-auto">
                    {displayedGroups.map((group) => (
                      <div key={group.billIndex} className="ss-bill-group">
                        {/* Section Header above each set of items */}
                        {reviewBatch.length > 1 && (
                          <div className="bg-slate-800/90 border-y border-slate-700/70 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 sticky top-0 z-10 backdrop-blur-md">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-lime-400/20 text-lime-300 border border-lime-400/30">
                                🧾 {group.billName}
                              </span>
                              <span className="text-xs text-slate-300 font-medium">
                                {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                              </span>
                              <span className="text-xs text-slate-400">·</span>
                              <span className="text-xs font-semibold text-slate-200">
                                {formatRupees(group.subtotalPaise)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setReviewIndex(group.billIndex)}
                                className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                                  reviewIndex === group.billIndex
                                    ? 'bg-lime-400/20 border-lime-400/40 text-lime-300'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                                }`}
                              >
                                👁 View Photo
                              </button>
                              <button
                                type="button"
                                onClick={() => addCustomItem(group.billIndex, group.billName)}
                                className="text-xs px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-medium flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Add Item
                              </button>
                            </div>
                          </div>
                        )}

                        {group.items.length === 0 ? (
                          <div className="p-4 text-xs text-slate-400 italic text-center">
                            No items found for {group.billName}.{' '}
                            <button
                              type="button"
                              onClick={() => addCustomItem(group.billIndex, group.billName)}
                              className="text-blue-400 hover:underline font-semibold cursor-pointer"
                            >
                              Add one manually
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-800/80">
                            {group.items.map((it) => (
                              <div
                                key={it.id}
                                className="ss-detected-item p-3 flex flex-wrap items-center justify-between gap-3 text-sm hover:bg-slate-800/40"
                              >
                                {/* Left: Name & Category */}
                                <div className="ss-detected-details flex-1 min-w-0">
                                  <input
                                    type="text"
                                    aria-label="Item name"
                                    value={it.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setItems((prev) =>
                                        prev.map((item) =>
                                          item.id === it.id ? { ...item, name: val } : item
                                        )
                                      );
                                    }}
                                    className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2.5 py-1 font-medium text-slate-100 focus:border-blue-500 focus:outline-none w-full text-sm"
                                    placeholder="Item name"
                                  />
                                  <div className="ss-detected-meta flex items-center gap-2 mt-1.5">
                                    {reviewBatch.length > 1 && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                                        {it.billName || group.billName}
                                      </span>
                                    )}
                                    <select
                                      aria-label={`Category for ${it.name}`}
                                      value={it.category || 'Food'}
                                      onChange={(e) => {
                                        const cat = e.target.value as Category;
                                        manuallyCategorizedIds.current.add(it.id);
                                        setItems((prev) =>
                                          prev.map((item) =>
                                            item.id === it.id ? { ...item, category: cat } : item
                                          )
                                        );
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
                                    {it.status === 'VERIFIED' && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 font-medium">
                                        <Check className="w-3 h-3 text-emerald-400" />
                                        Verified
                                      </span>
                                    )}
                                    {it.status === 'CHECK' && (
                                      <span
                                        className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1 font-medium"
                                        title={it.statusReason}
                                      >
                                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                                        {it.statusReason || 'Needs Review'}
                                      </span>
                                    )}
                                    {it.status === 'UNRESOLVED' && (
                                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1 font-medium">
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                        Rate Mismatch
                                      </span>
                                    )}
                                    {it.repairedFrom && (
                                      <span className="text-[10px] text-slate-400 italic">
                                        (Fixed: {it.repairedFrom})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Quantity, Price, Delete */}
                                <div className="ss-detected-controls flex items-center gap-3 shrink-0">
                                  <label className="ss-detected-field flex items-center gap-1.5">
                                    <span className="text-xs text-slate-400">Qty</span>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min="1"
                                      value={it.quantity}
                                      onChange={(e) => {
                                        const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                                        setItems((prev) =>
                                          prev.map((item) =>
                                            item.id === it.id
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
                                  </label>

                                  <label className="ss-detected-field flex items-center gap-1.5">
                                    <span className="text-xs text-slate-400">Total (₹)</span>
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      step="0.01"
                                      min="0"
                                      value={
                                        amountDrafts[it.id] ?? (it.totalPaise / 100).toFixed(2)
                                      }
                                      onChange={(e) => {
                                        setAmountDrafts((current) => ({
                                          ...current,
                                          [it.id]: e.target.value,
                                        }));
                                        const rupees = parseFloat(e.target.value) || 0;
                                        const paise = Math.round(rupees * 100);
                                        setItems((prev) =>
                                          prev.map((item) =>
                                            item.id === it.id
                                              ? {
                                                  ...item,
                                                  totalPaise: paise,
                                                  unitPricePaise:
                                                    item.quantity > 0
                                                      ? Math.round(paise / item.quantity)
                                                      : paise,
                                                }
                                              : item
                                          )
                                        );
                                      }}
                                      onBlur={() =>
                                        setAmountDrafts((current) => {
                                          const next = { ...current };
                                          delete next[it.id];
                                          return next;
                                        })
                                      }
                                      className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-100 text-right focus:border-blue-500 focus:outline-none"
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setItems((prev) => prev.filter((item) => item.id !== it.id))
                                    }
                                    title="Delete item"
                                    aria-label={`Delete ${it.name}`}
                                    className="ss-detected-delete text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Charges & Breakdown Card */}
                <div className="bg-slate-850 border border-slate-800 rounded-2xl p-4 space-y-3 text-sm">
                  <div className="flex justify-between items-center text-slate-400 text-xs">
                    <span>Items Subtotal:</span>
                    <span className="font-semibold text-slate-200">
                      {formatRupees(itemsSumPaise)}
                    </span>
                  </div>

                  {/* Editable Tax Lines */}
                  <div className="space-y-2 border-t border-slate-800/80 pt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        Taxes (GST / VAT)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setTaxLines((prev) => [...prev, { label: 'GST', amountPaise: 0 }])
                        }
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
                            setTaxLines((prev) =>
                              prev.map((item, idx) => (idx === i ? { ...item, label: val } : item))
                            );
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
                                prev.map((item, idx) =>
                                  idx === i ? { ...item, amountPaise: Math.round(val * 100) } : item
                                )
                              );
                            }}
                            className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-100 font-medium w-22 text-right focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setTaxLines((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="text-slate-500 hover:text-red-400 p-1 cursor-pointer"
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
                      {detectedTotalPaise !== null &&
                        detectedTotalPaise !== calculatedGrandTotalPaise && (
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
            </div>
          )}

          {step === 'assign' && (
            <div className="ss-assignment-stage">
              <p className="ss-stage-eyebrow">WHO HAD WHAT?</p>
              <h3>Assign each item.</h3>
              <p className="ss-stage-description">
                Open an item’s member list to add or remove people.
              </p>
              <div className="ss-assignment-list">
                {items.map((item) => {
                  const assigned = itemAssignments[item.id] ?? [];
                  const expanded = openAssignmentId === item.id;
                  return (
                    <article
                      key={item.id}
                      className={`ss-assignment-card ${assigned.length ? '' : 'unassigned'}`}
                    >
                      <div className="ss-assignment-row">
                        <div>
                          <div className="flex items-center gap-2">
                            <strong>{item.name}</strong>
                            {reviewBatch.length > 1 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-lime-400/20 text-lime-300 font-semibold border border-lime-400/30">
                                {item.billName || 'Bill No. 1'}
                              </span>
                            )}
                          </div>
                          <small>
                            {item.quantity} × {formatRupees(item.unitPricePaise)} ·{' '}
                            {formatRupees(item.totalPaise)}
                          </small>
                        </div>
                        <div className="ss-assignment-summary">
                          {assigned.length === members.length
                            ? 'Everyone'
                            : assigned.length
                              ? members
                                  .filter((member) => assigned.includes(member.id))
                                  .map((member) => member.name)
                                  .join(', ')
                              : 'No one assigned'}
                        </div>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpenAssignmentId(expanded ? null : item.id)}
                        >
                          ♧ Add / Remove Members {expanded ? '⌄' : '›'}
                        </button>
                      </div>

                      {expanded && (
                        <div className="ss-member-picker">
                          <div>
                            <strong>Choose members</strong>
                            <button
                              type="button"
                              onClick={() =>
                                setItemAssignments((current) => ({
                                  ...current,
                                  [item.id]:
                                    assigned.length === members.length
                                      ? []
                                      : members.map((member) => member.id),
                                }))
                              }
                            >
                              {assigned.length === members.length
                                ? '− Remove everyone'
                                : '＋ Add everyone'}
                            </button>
                          </div>
                          <small>
                            {assigned.length} of {members.length} selected
                          </small>
                          <div className="ss-member-grid">
                            {members.map((member, index) => {
                              const selected = assigned.includes(member.id);
                              const isMe = member.isCurrentUser;
                              return (
                                <button
                                  type="button"
                                  key={member.id}
                                  aria-pressed={selected}
                                  className={`${selected ? 'selected' : ''} ${isMe ? 'is-me' : ''}`}
                                  onClick={() =>
                                    setItemAssignments((current) => ({
                                      ...current,
                                      [item.id]: selected
                                        ? assigned.filter((id) => id !== member.id)
                                        : [...assigned, member.id],
                                    }))
                                  }
                                >
                                  <span className={`ss-member-avatar tone-${index % 4}`}>
                                    {member.name.slice(0, 2).toUpperCase()}
                                  </span>
                                  <span>
                                    <span className="flex items-center gap-1.5 flex-wrap">
                                      <strong>{member.name}</strong>
                                      {isMe && (
                                        <span className="ss-member-me-pill">This is me</span>
                                      )}
                                    </span>
                                    <small>
                                      {selected ? 'Included in this item' : 'Not included'}
                                    </small>
                                  </span>
                                  <b>{selected ? '−' : '+'}</b>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {!assigned.length && (
                        <p className="ss-unassigned-note">Assign at least one person.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'summary' && (
            <div className="ss-summary-stage">
              <p className="ss-stage-eyebrow">SPLIT SUMMARY</p>
              <h3>Everything adds up.</h3>
              <p className="ss-stage-description">
                Tax and charges are distributed in proportion to each person’s items.
              </p>

              <section className="ss-split-method">
                <label>Split method</label>
                <div>
                  {(
                    [
                      ['itemized', 'Itemized'],
                      ['equal', 'Equal'],
                      ['exact', 'Exact'],
                      ['percentage', 'Percent'],
                      ['shares', 'Shares'],
                    ] as const
                  )
                    .filter(([mode]) => !isBatchReview || mode === 'itemized')
                    .map(([mode, label]) => (
                      <button
                        type="button"
                        key={mode}
                        className={splitMode === mode ? 'active' : ''}
                        onClick={() => setSplitMode(mode)}
                      >
                        {label}
                      </button>
                    ))}
                </div>
                {splitMode !== 'itemized' && (
                  <p>
                    This overrides item assignments for the final total. Switch back to Itemized to
                    use consumption based shares.
                  </p>
                )}
                {isBatchReview && (
                  <p>Each bill is saved separately with its own payer and item assignments.</p>
                )}
                {['exact', 'percentage', 'shares'].includes(splitMode) && (
                  <div className="ss-split-inputs">
                    {members.map((member) => (
                      <label key={member.id}>
                        {member.name}
                        <input
                          type="number"
                          min="0"
                          step={splitMode === 'exact' ? '0.01' : '0.1'}
                          value={splitInputs[member.id] ?? ''}
                          onChange={(event) =>
                            setSplitInputs((current) => ({
                              ...current,
                              [member.id]: event.target.value,
                            }))
                          }
                          placeholder={
                            splitMode === 'percentage'
                              ? '%'
                              : splitMode === 'exact'
                                ? '₹'
                                : 'Weight'
                          }
                        />
                      </label>
                    ))}
                    {!splitInputValid && (
                      <p>
                        Enter{' '}
                        {splitMode === 'exact'
                          ? `amounts totalling ${formatRupees(finalGrandTotalPaise)}`
                          : splitMode === 'percentage'
                            ? 'percentages totalling 100%'
                            : 'at least one positive share'}
                        .
                      </p>
                    )}
                  </div>
                )}
              </section>

              <div className="ss-summary-grid">
                <section>
                  <h4>Member breakdown</h4>
                  <p>Each share reconciles to the bill total.</p>
                  {splitShares.map((share, index) => (
                    <div className="ss-breakdown-row" key={share.memberId}>
                      <span className={`ss-member-avatar tone-${index % 4}`}>
                        {members
                          .find((member) => member.id === share.memberId)
                          ?.name.slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <strong>
                        {members.find((member) => member.id === share.memberId)?.name}
                      </strong>
                      <b>{formatRupees(share.amountPaise)}</b>
                    </div>
                  ))}
                </section>

                <section className="ss-bill-summary">
                  <h4>Bill summary</h4>
                  {reviewBatch.length > 1 && (
                    <div className="mb-3 pb-3 border-b border-slate-700/80 space-y-1">
                      <span className="text-[11px] font-semibold text-lime-300 block uppercase tracking-wider">
                        {reviewBatch.length} Receipts Combined
                      </span>
                      {billGroups.map((bg) => (
                        <div
                          key={bg.billIndex}
                          className="flex justify-between text-xs text-slate-300"
                        >
                          <span>
                            {bg.billName} ({bg.items.length} items)
                          </span>
                          <span className="font-medium text-slate-200">
                            {formatRupees(bg.subtotalPaise)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p>
                    <span>Items subtotal</span>
                    <strong>{formatRupees(itemsSumPaise)}</strong>
                  </p>
                  <p>
                    <span>Tax</span>
                    <strong>{formatRupees(effectiveTaxPaise)}</strong>
                  </p>
                  <p>
                    <span>Service charge</span>
                    <strong>{formatRupees(serviceChargePaise)}</strong>
                  </p>
                  <p>
                    <span>Discount</span>
                    <strong>−{formatRupees(discountPaise)}</strong>
                  </p>
                  <div>
                    <span>Grand total</span>
                    <strong>{formatRupees(finalGrandTotalPaise)}</strong>
                  </div>
                  <small>✓ Reconciled to the paisa</small>
                </section>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="ss-scan-footer p-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3">
          {step === 'review' ? (
            <>
              <button
                type="button"
                onClick={() => moveTo('capture')}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors cursor-pointer"
              >
                Back to scan
              </button>
              <div className="ss-footer-primary">
                <span>
                  <strong>{formatRupees(finalGrandTotalPaise)}</strong>
                  <small>
                    {items.length} items ·{' '}
                    {validationResult.status === 'ok' ? 'totals match' : 'review totals'}
                  </small>
                </span>
                <button
                  type="button"
                  disabled={!!pendingPeople.length || !items.length || finalGrandTotalPaise <= 0}
                  onClick={() => moveTo('assign')}
                >
                  Continue to assignment <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : step === 'assign' ? (
            <>
              <button type="button" onClick={() => moveTo('review')}>
                Back to review
              </button>
              <div className="ss-footer-primary">
                <span>
                  <strong>
                    {items.length - unassignedItems.length} of {items.length} assigned
                  </strong>
                  <small>
                    {unassignedItems.length ? 'Every item needs someone' : 'Ready to calculate'}
                  </small>
                </span>
                <button
                  type="button"
                  disabled={!!unassignedItems.length}
                  onClick={() => moveTo('summary')}
                >
                  Calculate split <ArrowRight size={16} />
                </button>
              </div>
            </>
          ) : step === 'summary' ? (
            <>
              <button type="button" onClick={() => moveTo('assign')}>
                Back to assignment
              </button>
              <div className="ss-footer-primary">
                <span>
                  <strong>{formatRupees(finalGrandTotalPaise)}</strong>
                  <small>Split across {members.length} people</small>
                </span>
                {onOpenInSplitStudio && !isBatchReview && (
                  <button
                    type="button"
                    className="ss-studio-link"
                    onClick={handleTransferToSplitStudio}
                  >
                    Open in Studio
                  </button>
                )}
                <button
                  type="button"
                  disabled={
                    isSaving ||
                    !splitInputValid ||
                    !splitShares.length ||
                    (isBatchReview && batchExpenses.length !== reviewBatch.length)
                  }
                  onClick={() => void handleSaveAsExpense()}
                >
                  {isSaving
                    ? 'Saving…'
                    : reviewBatch.length > 1
                      ? 'Save all bills'
                      : 'Save expense'}{' '}
                  <CheckCircle2 size={16} />
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
      {previewZoomed && activePhotoUrl && (
        <div
          className="ss-receipt-zoom"
          role="dialog"
          aria-modal="true"
          aria-label="Receipt image zoom"
          onClick={() => setPreviewZoomed(false)}
        >
          <button type="button" onClick={() => setPreviewZoomed(false)}>
            Close ✕
          </button>
          <img
            src={activePhotoUrl}
            alt="Scanned receipt enlarged"
            style={{ transform: `rotate(${activeRotation}deg)` }}
          />
        </div>
      )}
    </div>
  );
};
