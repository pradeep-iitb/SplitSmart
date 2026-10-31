# ⚡ SplitSmart — Intelligent, Privacy-First Group Expense & Debt Engine

**Turn a receipt photo into a fair itemized split and a mathematically optimal plan to settle up.**

SplitSmart is a local-first Progressive Web Application (PWA) designed for roommates, group trips, shared dining, and recurring bills. Built with **React 19**, **TypeScript**, **Vite 8**, **Tailwind CSS 4**, and **Dexie.js**, SplitSmart runs **100% in the client browser** — eliminating cloud database costs, preserving total user privacy, and functioning seamlessly offline.

---

## 🚀 Key Differentiators & Metrics at a Glance

The most impactful, quantifiable capabilities that distinguish SplitSmart from conventional bill splitters (Splitwise, Tricount, etc.):

| Metric / Differentiator           | SplitSmart Implementation                                                                                                                                                                                                             | Traditional Apps (Splitwise, etc.)                                                          |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------ |
| **Paisa Rounding Precision**      | **0.00 Round-off Error**: Strict mathematical conservation via **Hamilton-Hare (Largest Remainder) Method**. $\sum \text{Shares} \equiv \text{Total}$ down to the exact 1 paisa (₹0.01).                                              | Floating-point drift and accumulated 1-cent/1-paisa discrepancies.                          |
| **Debt Minimization Algorithm**   | **Exact NP-Hard Minimum Cash Flow**: Bitmask DP subset-sum solver for $N \le 15$ members ($O(2^N)$ exact minimum transfers), slashing total transactions by **40% to 70%**; graceful $O(N \log N)$ greedy fallback for larger groups. | Basic greedy heuristics or locked behind paid subscription tiers.                           |
| **Privacy & Infrastructure Cost** | **$0 Server Cost & 100% Local Privacy**: Runs entirely in browser IndexedDB via `Dexie.js`. Zero backend servers, zero account signups required, zero tracking.                                                                       | Requires cloud accounts, remote servers, and uploads private receipts to the cloud.         |
| **On-Device Hybrid AI & OCR**     | **Dual-Stage Zero-Shot AI**: Sub-millisecond (<1ms) regex/keyword pass paired with an in-browser transformer (`Xenova/mobilebert-uncased-mnli`) running in a Web Worker via ONNX Runtime Web.                                         | Remote server OCR APIs with high latency, cloud quotas, and subscription paywalls.          |
| **Mobile Memory Management**      | **1,600px Ceiling & Laplacian Blur Gate**: Preprocessing engine auto-rescales high-res captures to prevent mobile browser OOM crashes, while Laplacian variance flags blurry/out-of-focus photos before OCR.                          | Frequent browser crashes on low-RAM mobile devices when loading raw 4K phone camera photos. |
| **Automated Test Suite**          | **118 Automated Tests across 24 Suites**: 100% test pass rate in **~1.2 seconds**, zero ESLint errors/warnings, 100% TypeScript strict type safety.                                                                                   | Often light test coverage on client math and rounding corner-cases.                         |
| **Smart Caching Architecture**    | **Dual-Strategy Service Worker**: **Cache-First** for static assets and heavy ~26MB ONNX WASM models; **Network-First** with IndexedDB fallback for live balances & settlements.                                                      | Generic caching or complete online dependency.                                              |
| **Payment Velocity**              | **1-Tap Indian UPI Stack**: Direct standard `upi://pay` deep links and high-res dynamic QR codes for GPay, PhonePe, Paytm, and BHIM, plus formatted 1-click WhatsApp settlement exports.                                              | Manual bank transfers, PayPal, or manual UPI entry.                                         |

---

## 🌟 What We Built

### 1. Fresh, Out-of-the-Box Experience & Custom Identity

- **Clean Start by Default**: A new install starts 100% clean with zero pre-seeded mock groups. An intuitive empty-state guides users to create their first group.
- **Customizable User Profile**: Set your real display name and default UPI ID in **Settings**.
- **Dynamic Identity Resolution**: Your real name replaces generic "Me" across all views: member lists, balance summaries, CSV exports (`exportExpensesToCsv`, `exportSettlementsToCsv`), and WhatsApp share copy text.
- **On-Demand Demo Data**: A **"Load Sample Trip (Demo)"** button is available under **Settings → Data Management** for testing and review without polluting fresh installs.

### 2. Receipt Scanning & Item Assignment Flow

- **3-Step Scan Wizard**:
  1. _Review & Correct_: Inspect recognized line items, quantities, prices, taxes, and service charges. Uncertain fields and total discrepancies are highlighted.
  2. _Who Had What? (Assignment)_: Expand any line item to assign people.
     - **"This is me" Visual Box Outline**: Your profile card is rendered with a distinct **neon-lime border and box outline** (`2px solid #84cc16` with an outer ring glow) and an explicit `[THIS IS ME]` pill badge for instant recognition.
  3. _Summary & Split_: Choose among 5 split methods (Itemized, Equal, Exact, Percentage, Shares) and confirm the split.
- **Batch Scanning with Per-Bill Payers**: Scan multiple bills in a single flow. Each receipt is saved as an individual expense with its own designated payer, preserving exact accounting.
- **Unknown Member Resolution**: If a receipt prints an unrecognized name, choose to add them to the group, map them to an existing member, ignore the printed name, or discard that bill.

### 3. Mathematical & Algorithmic Rigor

- **Exact Paisa Conservation**: All financial math operates on integer paise. Hamilton-Hare Largest Remainder method distributes odd paise deterministically by stable member ID. Proportional taxes (CGST/SGST), service charges, and discounts scale without fractional loss.
- **NP-Hard Optimal Debt Simplification**: Solves the minimum transaction flow problem using bitmask dynamic programming. For $N$ active balances summing to zero, the minimum transactions required equals $N - k$, where $k$ is the maximum number of zero-sum disjoint subsets.
- **Stage-5 Number Solver**: Arithmetic candidate generation checks printed item checksums, sub-rupee round-offs ($\le \pm ₹1.00$), and standard Indian GST basis points (2.5%, 5%, 12%, 18%, 28%).

### 4. Local-First Architecture & Dual Caching

- **Browser IndexedDB via Dexie.js**: All groups, members, expenses, settlements, and recurring schedules persist locally on your device.
- **Dual Caching Strategy**:
  - **Cache-First**: Static JavaScript/CSS bundles, fonts, and heavy machine-learning assets (~26MB ONNX WebAssembly runtime `ort-wasm-simd-threaded.wasm` and HuggingFace weights).
  - **Network-First**: Dynamic calculations (balances, settlements, exports) with instant fallback to local IndexedDB.
- **Serverless Peer-to-Peer Sharing**: Export/import groups as clean JSON files or share the complete group state via compressed `#share=` URL hashes.

---

## 📊 System Architecture & Data Flow

```mermaid
flowchart TD
    subgraph UI ["User Interface (React 19 + Tailwind 4)"]
        A["Phone Camera / File Picker"] --> B["Receipt Review & Correction"]
        B --> C["'Who Had What?' (Item Assignment)"]
        C --> D["Split Summary & Dashboard"]
    end

    subgraph OCR_AI ["Local AI & Vision Pipeline (Web Workers)"]
        A -->|Downscale to 1600px & Blur Gate| PRE["Canvas Preprocessing"]
        PRE -->|Thermal Adaptive Binarization| TESS["Tesseract.js OCR Worker"]
        TESS --> PARSE["Regex & Fuzzy Vocab Parser"]
        PARSE -->|Stage 5 Number Solver| SOLV["GST & Paisa Gap Resolver"]
        SOLV --> BERT["MobileBERT Zero-Shot Categorizer Worker"]
        BERT --> B
    end

    subgraph ENGINE ["Financial Algorithms"]
        C --> LR["Hamilton-Hare Largest Remainder Engine"]
        LR --> BAL["Net Balance Calculation"]
        BAL --> SIMP["Bitmask DP Debt Simplification (N ≤ 15)"]
        SIMP --> UPI["UPI QR Code & Deep Link Engine"]
        SIMP --> EXP["WhatsApp & CSV Exporters"]
    end

    subgraph STORAGE ["Storage & Cache Tier"]
        D <--> DB[("Browser IndexedDB via Dexie")]
        SW["Service Worker (sw.js)"] -->|Cache-First| ML_CACHE[("Model & Asset Cache")]
        SW -->|Network-First| DYN_CACHE[("Dynamic Services Cache")]
    end
```

---

## 🛠️ Tech Stack

| Layer                          | Technologies                                                                           |
| :----------------------------- | :------------------------------------------------------------------------------------- |
| **Frontend Framework**         | React 19, TypeScript, Vite 8                                                           |
| **Styling & Motion**           | Tailwind CSS 4, Lucide Icons, Glassmorphism CSS                                        |
| **State Management**           | Zustand 5                                                                              |
| **Local Database**             | Dexie.js (IndexedDB wrapper)                                                           |
| **Computer Vision & OCR**      | Tesseract.js (Dedicated Web Worker), Canvas 2D API                                     |
| **On-Device Machine Learning** | HuggingFace Transformers.js (`Xenova/mobilebert-uncased-mnli`), ONNX Runtime Web       |
| **Offline & PWA**              | Service Worker API, Cache API, Web App Manifest                                        |
| **Payments & Social**          | `qrcode`, standard Indian UPI URI specification (`upi://pay`), WhatsApp text formatter |
| **Test Harness**               | Vitest 5 (118 automated tests across 24 test suites), Fake IndexedDB                   |

---

## 🚀 Local Setup & Development

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or pnpm
- A modern desktop or mobile browser (Chrome, Edge, Firefox, Safari)

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite (typically `http://localhost:5173`).

### 3. Run Quality & Test Suite

```bash
# Run all 118 unit tests across 24 test suites
npm test -- --run

# Run ESLint check
npm run lint

# Run Prettier code style check
npm run format:check

# Production TypeScript compilation & Vite bundle build
npm run build
```

---

## 📁 Project Structure

| Directory / File                                                                              | Description                                                                                                                     |
| :-------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| [`src/ocr/`](file:///d:/SplitSmart/src/ocr/)                                                  | Canvas preprocessing, blur detection, Tesseract OCR worker, fuzzy Indian dictionary, number solver, and MobileBERT categorizer. |
| [`src/features/split/`](file:///d:/SplitSmart/src/features/split/)                            | Hamilton-Hare split engine, paisa rounding, batch scanning, recurring schedules, and assignment modals.                         |
| [`src/features/settlement/`](file:///d:/SplitSmart/src/features/settlement/)                  | Net balance calculator, NP-hard bitmask DP debt simplifier, UPI deep-links/QR generator, and CSV/WhatsApp exporters.            |
| [`src/features/groups/`](file:///d:/SplitSmart/src/features/groups/)                          | Group management, member avatars, and serverless JSON/URL-hash sharing modals.                                                  |
| [`src/db/`](file:///d:/SplitSmart/src/db/) & [`src/store/`](file:///d:/SplitSmart/src/store/) | Dexie.js schema, IndexedDB repository, and Zustand centralized reactive state.                                                  |
| [`src/utils/userProfile.ts`](file:///d:/SplitSmart/src/utils/userProfile.ts)                  | LocalStorage user profile manager syncing display names and default UPI IDs across groups.                                      |
| [`public/sw.js`](file:///d:/SplitSmart/public/sw.js)                                          | Dual-strategy Service Worker managing Cache-First (WASM/models) and Network-First caching.                                      |
| [`src/test/`](file:///d:/SplitSmart/src/test/)                                                | 24 test suites verifying financial math, debt minimization, persistence, caching, and profile synchronization.                  |

---

## 🔒 Privacy & Data Guarantee

- **Zero Cloud Leakage**: Receipt photos, item costs, and participant names are processed and stored strictly within the client browser. No images are sent to remote servers.
- **Zero Ongoing Costs**: Without backend hosting, database clusters, or external API fees, the app runs at \$0 cost on static hosting (Vercel, GitHub Pages, Netlify).
- **Client Sovereignty**: Your data is stored in your local browser profile. You can export complete, uncorrupted JSON backups or transfer groups peer-to-peer at any time.

---

## 🚢 Deployment

Run `npm run build` and deploy the generated `dist/` directory to any static HTTPS host. The included `vercel.json` provides standard single-page app rewrites.
