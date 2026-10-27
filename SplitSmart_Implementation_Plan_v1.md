# SplitSmart — Implementation Plan v1

**Project:** Web Brawl GC 2026 · SplitSmart  
**Status:** Team baseline / proposed implementation contract (approve at kickoff)  
**Goal:** Five members build independently against common interfaces; integrate continuously; deploy only after the full application passes testing.  
**Primary source:** *SplitSmart — Web Brawl GC 2026 Problem Statement*, pp. 1–6.  
**Last prepared:** 23 October 2026

> **Important distinction:** The **requirements** below come from the competition PS. The **architecture, types, schema, function signatures, rounding rule, and work conventions** are our proposed **v1 team decisions**, not rules prescribed by the organizers. Agree to them before parallel coding. Once approved, changes require an explicit contract PR.

---

## 1. Product objective and scope

Build a mobile-first **receipt-to-settlement** application:

`Create group → add members → upload/capture receipt → in-browser OCR → parse items → review/fix → assign people → calculate exact shares → save expense → aggregate balances → suggest settlements → mark paid.`

Also support manual expenses, four split modes, persisted groups/expenses/settlements, lazy item categorization, and selected Tier 3 utilities. **The core app runs as a static web site**: no login, backend, paid OCR service, or image upload to a server.

### Non-negotiable PS constraints

- **Tesseract.js English** for receipt OCR; **Xenova/mobilebert-uncased-mnli** zero-shot classifier through Transformers.js for Tier 2 categorization. The PS allows a documented alternative pretrained model, but no training/fine-tuning; **choose the specified models for v1**.
- All model inference **client-side**. Receipt images and personal data remain on the user's device. No paid APIs or committed API keys.
- First screen should load in **under 3 seconds** on a mid-range 4G phone. Lazy-load heavy inference packages/weights; keep UI responsive.
- Responsive **360 px to 1440 px**; latest Chrome/Firefox desktop and Android; iOS Safari bonus.
- Money shares reconcile exactly to **one paisa**. Bad OCR must be recoverable with editable values/manual entry.
- Judge walkthrough targets **under two minutes**: group → scan → correct → validate → assign → split → settle → refresh.
- Required public GitHub repo, README with models, debt approach and rounding rule. **Live deployment = separate final task (PS point 23).**

### Scope priority

1. **P0 — All Tier 1 (1–7)**: group/member CRUD, receipt capture, OCR, parsing, review/edit, total validation, manual expenses, balances.
2. **P1 — All Tier 2 (8–14)**: item assignment, flexible split modes, proportional tax/charges/discount, rounding, debt simplification, auto-categorization, persistence.
3. **P2 — Tier 3 (15–22)**: UPI, analytics, offline/PWA, JSON sharing, recurring expenses, export, batch scanning, accessibility. These are **owned** but implement in order of impact/time available. Accessibility basics belong in initial UI, not only P2.
4. **FINAL — Tier 3 (23)**: live deployment after integrated build passes release checks; **any member** may execute it.

---

## 2. Locked v1 stack proposal

| Concern | Choice | Reason / owner |
|---|---|---|
| Language | **TypeScript (strict)** | Compiler-enforced shared contracts; all 5 |
| UI / build | **React + Vite** | Static SPA, componentized UI; M1 |
| Styling | **Tailwind CSS**; optionally shadcn/ui components | Fast mobile-first UX; M1 |
| Client routing | **React Router** | Explicit dashboard, group, review and settlement routes; M1/M5 |
| Global in-memory state | **Zustand** | Small global stores, draft flows; M5 |
| Local database | **IndexedDB via Dexie.js** | Structured persistence; M5 |
| Runtime schema validation | **Zod** | Validate imports, persisted records and OCR normalization; M5 with M2/M3 |
| OCR | **Tesseract.js**, English pack | Specified by PS; M2 |
| Classification | **Transformers.js** + specified Xenova MobileBERT MNLI model | Tier 2; M2 |
| Background inference | **Web Workers** | No long OCR/ML work on UI thread; M2 |
| Forms | **React Hook Form**, as needed | Editable line items/manual expenses; M1/M3 |
| Analytics | **Recharts** or **Chart.js** (pick exactly one) | Tier 3 charts; M4 |
| UPI QR | **qrcode** package | Local QR rendering; M4 |
| Tests | **Vitest** + React Testing Library | Unit tests and flow coverage; all |
| Offline | **vite-plugin-pwa** | Tier 3 offline/PWA; M5 |
| Final hosting | **Vercel / Netlify / GitHub Pages** | Static hosting; **shared final task only** |

**Avoid for v1:** Next.js server features, Node/Express/Django backend, cloud DB, hosted OCR APIs, auth/SSO, and extra model training. A static asset host may deliver JS/model files, but **receipts and member data must never be sent to it**.

---

## 3. System map and data ownership

```text
Browser (single device / origin)
  React screens/components                        [M1]
        │
  Zustand stores / orchestration                  [M5]
        │
        ├── image → OCR Worker → OCRResult         [M2]
        ├── OCRResult → parseReceipt()             [M2]
        ├── ParsedReceipt → corrected draft UI     [M1]
        ├── item assignment + split functions      [M3]
        ├── saved Expense[] → balances             [M4]
        ├── balances → settlement suggestions      [M4]
        ├── analytics / UPI / PDF-CSV              [M4]
        └── Dexie repositories ↔ IndexedDB         [M5]

  Lazy classifier worker: item description → category [M2]
```

**Critical distinction:** **OCR output is untrusted draft data**. Only a **validated, user-confirmed `Expense` with calculated shares** goes into persistent records. UI components **never** directly edit IndexedDB; they call store/actions. Calculation functions have no dependency on React, Zustand, OCR or Dexie.

---

## 4. Canonical shared models (proposed v1 contracts)

Create `src/types/domain.ts` owned by **M5** and reviewed by M2/M3/M4 **before coding**. TypeScript interfaces define shapes; use Zod at untrusted boundaries.

```ts
export type ID = string;                   // crypto.randomUUID() when created
export type Paise = number;                // safe INTEGER paise, never rupee floats
export type ISODate = string;              // YYYY-MM-DD for date-only values
export type ISODateTime = string;          // ISO 8601 timestamp
export type Category =
  | 'Food' | 'Groceries' | 'Travel'
  | 'Utilities' | 'Entertainment' | 'Other';
export type SplitMode = 'itemized' | 'equal' | 'exact' | 'percentage' | 'shares';

export interface Member {
  id: ID;
  groupId: ID;
  name: string;
  color?: string;
  avatarDataUrl?: string;             // keep small; optional
  upiId?: string;                     // optional, for UPI payments
  active: boolean;                    // prefer deactivation if historical references exist
}

export interface Group {
  id: ID;
  name: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ReceiptItem {
  id: ID;
  name: string;
  quantity: number;                   // positive; consider integer for v1
  unitPricePaise: Paise;
  lineTotalPaise: Paise;
  assignedMemberIds: ID[];            // needed for itemized mode
  category: Category;
  ocrConfidence?: number;             // normalized 0..100
  needsReview?: boolean;
}

export interface ReceiptDraft {
  items: ReceiptItem[];
  subtotalPaise: Paise | null;
  taxLines: Array<{ label: string; amountPaise: Paise }>;
  serviceChargePaise: Paise;
  discountPaise: Paise;               // positive number to SUBTRACT
  detectedGrandTotalPaise: Paise | null;
  originalImageObjectUrl?: string;    // ephemeral UI only, NOT persisted
  rawOcrText?: string;                // optional ephemeral debugging only
}

export interface MemberShare {
  memberId: ID;
  amountPaise: Paise;                 // FINAL amount, incl. allocations
}

export interface Expense {
  id: ID;
  groupId: ID;
  description: string;
  date: ISODate;
  payerId: ID;                        // v1: exactly ONE payer per expense
  amountPaise: Paise;                 // confirmed authoritative total
  splitMode: SplitMode;
  memberShares: MemberShare[];        // sum MUST equal amountPaise
  items: ReceiptItem[];              // [] for simple manual expense
  taxLines: Array<{ label: string; amountPaise: Paise }>;
  serviceChargePaise: Paise;
  discountPaise: Paise;
  createdAt: ISODateTime;
}

// A real payment event; NOT a pending algorithm suggestion.
export interface RecordedSettlement {
  id: ID;
  groupId: ID;
  fromMemberId: ID;
  toMemberId: ID;
  amountPaise: Paise;
  settledAt: ISODateTime;
  note?: string;
}

// Derived/read-only; recompute from saved expenses + completed payments.
export interface MemberBalance { memberId: ID; balancePaise: Paise }
export interface SuggestedPayment {
  fromMemberId: ID;
  toMemberId: ID;
  amountPaise: Paise;
}
```

### Invariants — all members must honor

- All `*Paise` values are **safe integers**. Convert user rupee strings at input boundary (`"33.50"` → `3350`). Format paise for display only; **never** calculate money with formatted strings.
- IDs, not array indices or names, are references between entities.
- A group must own all referenced members/expenses/settlements; prohibit cross-group IDs.
- Single payer per expense in v1. Mixed payers **across** multiple expenses are supported. If one receipt is jointly paid, record separate expenses or explicitly extend the contract **before** implementation.
- An expense is saved only after: every applicable item is assigned, inputs validate, `sum(memberShares.amountPaise) === expense.amountPaise`, and the bill total has been confirmed by the user.
- If OCR does not detect a total, compute it and **ask confirmation**. If OCR total disagrees, show difference and require correction/explicit resolution.
- `ReceiptDraft` is mutable draft UI data; `Expense` is a persisted **snapshot**. Re-run split calculation when inputs change **before saving**; no automatic reinterpretation of old expenses when names/categories change.
- Pending settlement **suggestions are computed, not stored as completed transactions**. Clicking “settled” writes one `RecordedSettlement` and recomputes balances; repeated clicks must not double-pay.
- Category choices are user-overridable and must not be overwritten by delayed ML results.
- Do not persist full receipt image or object URL in v1; revoke object URLs when finished. This keeps local storage small and respects privacy.

---

## 5. Canonical module APIs and integration boundaries

**M2 — Receipt service** (`src/features/receipt/`):

```ts
recognizeReceipt(file: File, onProgress?: (percent: number) => void)
  : Promise<OCRResult>;
parseReceipt(result: OCRResult): ReceiptDraft;
validateReceiptTotal(draft: ReceiptDraft): {
  computedTotalPaise: Paise;
  detectedTotalPaise: Paise | null;
  differencePaise: Paise | null;
  reconciled: boolean;
};
categorizeItems(items: ReceiptItem[]): Promise<Array<{itemId: ID; category: Category}>>;
```

`OCRResult` is a **separate typed contract** containing raw text, words/lines with confidence and (when available) bounding boxes. **M2 defines it first and supplies a fixture**. The UI must receive actionable progress/failure states; user correction remains possible when parsing fails.

**M3 — Split service** (`src/features/split/`):

```ts
calculateExpenseShares(input: SplitInput): MemberShare[];
validateSplitInput(input: SplitInput): ValidationIssue[];
reconcileRounding(rawWeights: number[], totalPaise: Paise, stableIds: ID[]): Paise[];
```

`SplitInput` MUST be finalized with M1/M5: expense total, participants, mode-specific values, item assignments, item prices and tax/charge/discount lines. Outputs always satisfy `sum(shares) === totalPaise`. The expense UI passes this output to M5 for persistence.

**M4 — Balance and settlement service** (`src/features/settlement/`):

```ts
calculateGroupBalances(
  memberIds: ID[],
  expenses: Expense[],
  payments: RecordedSettlement[]
): MemberBalance[];

suggestSettlements(balances: MemberBalance[]): SuggestedPayment[];

createRecordedSettlement(suggestion: SuggestedPayment): RecordedSettlement;

createUpiUri(payment: SuggestedPayment, payeeUpiId: string, note: string): string;
```

Rule: `netBalance(member) = Σ paid expenses − Σ final shares + Σ actual payments sent − Σ actual payments received` (**payments SENT reduce a debtor's negative balance, hence +sent; payments RECEIVED reduce a creditor's positive balance, hence −received**). Check `sum(all balances) === 0` for every valid group.

**Algorithm caution:** A **greedy debtor/creditor matching** routine is simple and often yields few transactions, but **does not guarantee the global mathematical minimum** in every case. The PS explicitly asks for a minimum number; if you claim exact optimality, implement and test an exact solution for expected small groups (e.g. memoized subset/backtracking with pruning), with a documented greedy fallback if computational limits arise. Never label greedy output “provably minimum.” Test five-member / ten-expense fixtures.

**M5 — State and persistence API** (`src/db/`, `src/store/`):

```ts
createGroup(name: string): Promise<Group>;
updateGroup(groupId: ID, patch: Partial<Pick<Group, 'name'>>): Promise<void>;
addMember(groupId: ID, name: string): Promise<Member>;
listExpenses(groupId: ID): Promise<Expense[]>;
saveExpense(expense: Expense): Promise<void>;
recordSettlement(payment: RecordedSettlement): Promise<void>;
exportGroupJson(groupId: ID): Promise<string>;
importGroupJson(json: string): Promise<ID>;
```

Write operations must validate IDs, group consistency and monetary invariants. Use a single Dexie schema and version it. M5 publishes mock stores/actions early; **M1 should not await OCR or IndexedDB to build screens**.

---

## 6. Rounding, taxes and settlement rules (proposed v1)

### Itemized / tax allocation

1. Determine each participant's **item subtotal** from line items and selected assignees (equal shares of each shared item unless contract is extended). Allocate any odd paise deterministically by ascending stable member ID.
2. Add each tax line and service charge **proportionally to those subtotals**. Allocate discounts using the same proportional basis, with discounts *subtracted*.
3. Use integer-weight allocation. For a total `T` paise and nonnegative weights `wᵢ`, take `floor(T × wᵢ / Σw)` (with safe integer arithmetic); distribute the remaining paise to the **largest fractional remainders**, ties by stable `memberId` ascending. Document this rule in README.
4. Validate `subtotal + taxes + service charge − discount == confirmed bill total` (or explicitly resolve a discrepancy). Handle zero subtotal separately; **do not divide by zero**.
5. Apply equivalent exact reconciliation for equal/percentage/shares splits. For percentages, prefer integer basis points (`10000 = 100%`), not decimal floats.

### Balances and real payments

Example: Riya pays ₹800 and 4 users each owe ₹200. Net: Riya `+₹600`, other three `−₹200`; suggested payments are each ₹200 to Riya. If Arjun pays Riya ₹200 and marks settled, record the real payment, then Arjun's net becomes zero and Riya's net becomes `+₹400`.

**Do not** mark an expense “paid” just because its payer covered the merchant; that expense still creates intra-group debts.

### Recurring expenses

V1 proposal: scheduled templates materialize when the app is next opened/used (no background server or guaranteed background execution). Use a deterministic recurrence occurrence ID or uniqueness key to avoid creating duplicates after refresh.

### PWA/offline

Offline after first visit requires caching **the app shell and the relevant OCR/model assets**. Do not assume inference works offline merely because IndexedDB persists groups. Test it in airplane mode after one successful model download.

---

## 7. Five parallel workstreams + separate final deployment

All **PS points 1–22** have exactly one primary owner; this does **not** prevent collaboration. **PS point 23** is the shared final release task.

| Owner | Role | Official PS points | Deliverable contract |
|---|---|---|---|
| **M1** | UI/UX + frontend experience | **4** Review and correction; **8** Itemized assignment; **22** Accessibility | Mobile screens, editable fields, confidence highlighting, member toggles, reusable components, mock-data flow |
| **M2** | OCR + receipt parsing | **2** Receipt capture; **3** Line-item parsing; **5** Total validation; **13** Auto-categorization; **21** Multi-receipt batch scan | Worker-based OCR, raw OCR fixture, parser, classification, receipt validation |
| **M3** | Expense + split engine | **6** Manual expenses; **9** Flexible split modes; **10** Proportional tax, charges and discounts; **11** Rounding reconciliation; **19** Recurring expenses | `SplitInput → MemberShare[]`, validation, pure calculation functions, unit tests |
| **M4** | Balances + settlement | **7** Balances view; **12** Debt simplification; **15** UPI settle-up; **16** Spending analytics; **20** Export | `Expense[] + RecordedSettlement[] → balances → suggestions`, payment recording logic, charts, UPI, export |
| **M5** | Shared state + persistence + integration | **1** Groups and members; **14** Persistence; **17** Sharing without a backend; **18** PWA and offline mode | Shared models, Zustand actions, Dexie schema, CRUD, JSON import/export, app integration |
| **Shared FINAL** | **Live deployment (any member)** | **23** Live deployment | After final integration and smoke tests: public static URL and final production verification |

### Work is parallel, not sequential

- **M1:** use the shared sample fixtures and stub action callbacks on day one.
- **M2:** build parsing/worker functions and fixtures; no need for the final React screen.
- **M3:** build pure functions and tests against typed mock `SplitInput`.
- **M4:** build from mocked, finalized `Expense.memberShares`; no dependency on OCR or split-engine implementation details.
- **M5:** commit type definitions, DB schema and mock store/action interfaces **first**; then integrate completed modules continuously.
- **Everyone:** review contract changes quickly, write tests and resolve integration issues throughout; deployment is still held until the end.

### Handoffs to agree explicitly

| From → To | Shared artifact | Do not pass |
|---|---|---|
| M2 → M1 | `OCRResult`, `ReceiptDraft`, OCR status/progress | Raw unstructured text *alone* |
| M1 → M3 | Corrected `ReceiptDraft`, `assignedMemberIds`, mode/input values | Display-only strings like `₹123.45` |
| M3 → M5 | Validated `Expense` with finalized `memberShares` | Partially calculated draft shares |
| M5 → M4 | Group members, immutable saved `Expense[]`, recorded payments | Zustand internals / IndexedDB tables |
| M4 → M5 | `RecordedSettlement` event to save | Persisted copies of suggested unpaid transactions |
| M4 → M1 | Derived balances, suggestions, analytics datasets | Calculation embedded in JSX |

---

## 8. Required initial fixtures and unit tests

Create `src/test/fixtures/` with fixed IDs and deterministic outcomes so all five branches can test independently.

**Fixtures:**

- `group-4.json` — Riya, Arjun, Meera, Kabir.
- `receipt-clear.txt` and `receipt-faded.txt` — representative OCR outputs with per-word confidence metadata fixture.
- `receipt-no-total.txt`, `nonreceipt.txt`, and rotated-receipt image.
- `expense-840.json` — valid itemized receipt, GST and manually corrected values; shares sum **84000 paise**.
- `expenses-mixed-payers.json` — five members, ten expenses with fully specified shares and expected net balances.
- `settlements-partial.json` — one recorded partial payment; correct residual balances.

**Minimum automated tests:**

- `10000` paise divided among 3 → `[3334, 3333, 3333]` (deterministic tie-break).
- Tax ₹100 on item subtotals ₹600 / ₹400 → tax shares ₹60 / ₹40.
- All four split modes reject invalid percentages, exact totals, zero/negative input where prohibited, empty assignment.
- For every valid expense, `sum(memberShares) == amountPaise`.
- For group balances, sum of net balances is **zero**.
- A pays B ₹200; B owes C ₹200 → suggestion A → C ₹200 if represented by the resulting net balances.
- Settlement applied once changes both sides correctly; duplicate record action blocked.
- Verify global-minimum transaction logic with a case where greedy is suboptimal (if exact minimum promised).
- Malformed JSON/import, permission denial, no receipt items, missing total, angled receipt and refresh after save.
- Lazy model fetch, no UI freeze, and offline after cached first use if implementing PWA.

**Judge robustness checklist (from PS):** clear GST bill; faded paper; rotated/angled bill; selfie/non-receipt; missing total; ₹100/3; camera denied; offline revisit; five members with ten mixed-payer expenses.

---

## 9. Git workflow and definition of done

**Branches:** `feature/ui-flow`, `feature/ocr-parser`, `feature/split-engine`, `feature/settlement`, `feature/state-integration`.

**Merge contract:**

1. M5 creates/merges `types/domain.ts`, fixture names, initial shell, stores and module API stubs.
2. Each module supplies typed inputs/outputs, tests, loading/error cases and short README notes. No module may quietly change canonical field names.
3. Changes to `src/types/domain.ts`, Dexie schema or API signatures require review by affected owners. Add migrations for persistence changes.
4. Keep pull requests small, run `tsc --noEmit`, lint and Vitest before merge.
5. Use a shared integration branch or merge into main via reviewed PRs often; don't leave all integration to the last day.
6. Every feature must work with sample fixture data **before** waiting on upstream modules.

**Definition of done for a PS point:** feature works on phone/desktop, handles normal and bad inputs, matches shared contracts, persists correctly if relevant, has tests for any calculation logic, and is exercised in the integrated walkthrough.

---

## 10. Final integrated release gates & verification status

**Point 23 — Live deployment readiness checklist:**

- [x] **All five module workstreams integrated and TypeScript / tests passing** (12 test suites, 65 unit & property tests passing; zero build errors).
- [x] **Full judge flow verified end-to-end**: Group CRUD → scan receipt / manual expense → interactive review table → validate totals → itemized member assignment → split calculation → persist to IndexedDB → live balances → debt simplification → UPI QR / deep link → settlement recording → auto-refresh.
- [x] **OCR worker & MobileBERT categorizer**: Lazy-loaded in background Web Workers with zero UI thread freezing.
- [x] **Exact 1-paisa rounding conservation invariant**: Verified with Hamilton-Hare largest-remainder method across all 5 split modes.
- [x] **Data persistence & offline resiliency**: IndexedDB via Dexie.js survives full page reload; PWA service worker registered for offline operation.
- [x] **Responsive across breakpoints (360px to 1440px)**: All dialogs, tables, action headers, and analytics adapt to mobile and tablet viewports without overflow.
- [x] **Number input stepper arrows removed**: Clean custom styling across Chrome, Safari, Firefox, and Edge.

---

## 11. Decisions agreed & locked across all 5 members

- [x] **Canonical data models**: `MemberShare[]` is the strict financial contract between calculation and balance aggregation.
- [x] **Integer paise invariant**: All monetary calculations operate strictly in integer paise (`100 paise = ₹1.00`), eliminating floating-point rounding errors.
- [x] **Percentage mode**: Basis points convention (`10000 bps = 100.00%`).
- [x] **Line total policy**: `quantity × unitPricePaise` synchronized with line total; manual overrides allowed with validation warning.
- [x] **Proportional tax & charge distribution**: Tax lines, service charge, and discounts allocated proportionally to item subtotals.
- [x] **Rounding tie-breaking**: Deterministic tie-breaking by ascending stable `memberId`.
- [x] **Debt simplification**: Exact exponential NP-hard branch-and-bound subset-sum solver for $N \le 15$ members, with greedy heuristic fallback for larger groups.
- [x] **Settlement accounting**: Append-only settlement records with undo capability and automatic balance reversal.
- [x] **Local privacy**: Receipts processed 100% in-browser; original images not stored in database.
- [x] **Serverless sharing**: 1-click URL state compression via base64 hash and JSON export/import.

---

## 12. Assembled implementation matrix (All 22 Official PS Points)

| PS Point | Description | Primary Owner | Module & Component Location | Status |
|---|---|---|---|---|
| **1** | Groups & Members CRUD | **M5** | `src/features/groups/components/GroupManagerModal.tsx`, `MemberManagementModal.tsx` | **Complete** |
| **2** | Receipt Capture & Camera | **M2** | `src/features/split/components/ReceiptScanModal.tsx` | **Complete** |
| **3** | Line-Item Parsing & OCR Noise Filter | **M2** | `src/ocr/src/logic/receiptParser.ts` (filters PIN codes, city names, serial artifacts) | **Complete** |
| **4** | Review & Live Correction | **M1** | `ReceiptScanModal.tsx` (fully editable qty, unit price, total, tax, service charge, discount) | **Complete** |
| **5** | Total Validation & Difference Diff | **M2** | `src/features/split/validation.ts`, `ReceiptScanModal.tsx` | **Complete** |
| **6** | Manual Expenses | **M3** | `src/features/split/components/ManualExpenseModal.tsx`, `src/features/split/manualExpense.ts` | **Complete** |
| **7** | Balances View | **M4** | `src/features/settlement/components/BalancesDashboard.tsx`, `src/features/settlement/balances.ts` | **Complete** |
| **8** | Itemized Member Assignment | **M1** | `ReceiptScanModal.tsx`, `src/features/split/components/SplitStudio.tsx` | **Complete** |
| **9** | Flexible Split Modes (5 Modes) | **M3** | `src/features/split/splitEngine.ts` (Equal, Exact, Percentage, Shares, Itemized) | **Complete** |
| **10** | Proportional Tax, Charges & Discounts | **M3** | `src/features/split/splitEngine.ts` (`calculateDetailedItemizedSplit`) | **Complete** |
| **11** | Rounding Reconciliation (1 Paisa) | **M3** | `src/features/split/rounding.ts` (Hamilton-Hare largest-remainder) | **Complete** |
| **12** | Debt Simplification | **M4** | `src/features/settlement/simplify.ts` (Exact NP-hard B&B + greedy fallback) | **Complete** |
| **13** | Auto-Categorization | **M2** | `src/workers/categorizer.worker.ts` (MobileBERT MNLI + keyword fallback) | **Complete** |
| **14** | Persistence (IndexedDB) | **M5** | `src/db/indexedDb.ts`, `src/store/groupStore.ts` | **Complete** |
| **15** | UPI Settle-Up (QR & Links) | **M4** | `src/features/settlement/upi.ts`, `src/features/settlement/components/UpiPaymentModal.tsx` | **Complete** |
| **16** | Spending Analytics | **M4** | `src/features/settlement/analytics.ts`, `src/features/settlement/components/AnalyticsDashboard.tsx` | **Complete** |
| **17** | Sharing Without Backend | **M5** | `src/features/sharing/sharingService.ts`, `src/features/groups/components/BackupShareModal.tsx` | **Complete** |
| **18** | PWA & Offline Mode | **M5** | `src/serviceWorkerRegistration.ts`, offline detector badge in `App.tsx` | **Complete** |
| **19** | Recurring Expenses | **M3** | `src/features/split/recurring.ts`, Recurring Schedules tab in `App.tsx` | **Complete** |
| **20** | Export (PDF & CSV) | **M4** | `src/features/settlement/export.ts`, Export & Share tab in `App.tsx` | **Complete** |
| **21** | Multi-Receipt Batch Scanning | **M2** | Batch scanning tab in `ReceiptScanModal.tsx` | **Complete** |
| **22** | Accessibility & Responsiveness | **M1** | Mobile responsive layouts (360px-1440px), WCAG contrast, ARIA labels | **Complete** |
| **23** | Live Deployment | **Shared** | Static SPA ready for Vercel/Netlify/GitHub Pages | **Ready for Deploy** |

---

*Source boundaries: Problem requirements, test cases, tier numbering, model constraints and judging information are from the six-page Web Brawl GC 2026 problem statement. All proposed code interfaces, implementation conventions, and module integrations are unified for v1.*

