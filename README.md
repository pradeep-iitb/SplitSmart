# SplitSmart

SplitSmart is a browser-based group expense app. It scans receipts, lets people correct and assign line items, calculates exact shares, and suggests payments to settle the group. Financial records are stored in the browser's IndexedDB; there is no server-side account or database.

## Run locally

Requires a recent Node.js installation and npm.

```bash
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). For the installable PWA and camera API, build and serve over **HTTPS** or use `localhost` on the same device. A phone visiting a laptop's plain `http://192.168…` address is not a secure browser context, so live camera access may be unavailable. The scan screen also offers the phone's native camera/file picker.

```bash
npm run build
npm run preview
npm test -- --run
npm run lint
npm run format:check
```

The app starts with sample data in a fresh browser database so the dashboard can be explored. Settings has an option to reset the demo data. Export a JSON backup before clearing browser storage.

## Features

- **Core:** multiple groups, members including a designated “Me”, manual expenses, receipt camera/file capture, OCR progress, editable line items and totals, confidence and mismatch warnings, local persistence, live balances.
- **Splitting:** itemized assignments, equal, exact, percentage and weighted shares; proportional tax/charges/discount; paisa reconciliation; suggested settlements and manually recorded payments.
- **Extras:** batch receipt scanning, per-bill payers with separate itemized records, unknown-member resolution, recurring schedules, category/member/time insights, UPI links and QR codes, CSV exports, JSON backup/import, share links, and an installable PWA.

The batch scan flow saves each receipt as a separate expense because each bill can have a different payer. The review screen shows one combined total and assignment flow. Every saved expense has shares that sum exactly to its total.

Recurring schedules are checked when the app opens, a group is selected, a schedule is saved, and the tab returns to the foreground. Due occurrences use deterministic IDs so a refresh does not add them twice. A browser app cannot run a scheduler while completely closed; missed occurrences are added on the next visit.

## OCR, categorization, and offline behavior

Tesseract.js performs OCR in a Web Worker in the browser. The first scan needs a connection to fetch its engine and English language data. The service worker caches requested OCR assets after use. Every scanned item is sent to the zero-shot `Xenova/mobilebert-uncased-mnli` classifier; keywords provide immediate suggestions while the model loads. Users can override categories. The model and ONNX runtime use browser Cache API storage after the first successful download. Availability offline depends on those assets remaining cached and sufficient device storage.

The production build generates a service worker precache list for the current JavaScript/CSS app bundles. It can reopen the installed app offline after a successful installation. Local groups and expenses remain in IndexedDB. Model and OCR assets are downloaded on first use, not bundled into the initial app install. The PWA is registered only for production builds.

## Financial rules

Amounts are integer paise. Itemized costs are divided among selected members, and tax, service charges, and discounts are distributed in proportion to their item subtotals. The largest-remainder method assigns odd paise deterministically by member ID; the saved shares always reconcile to the expense total. Suggested payments are calculated from net balances. Exact debt minimization is used for groups with up to 15 nonzero balances; larger groups use a greedy fallback.

## Data and sharing

Receipt images are processed locally and are not stored with expenses. Group records in IndexedDB are **not encrypted**. Exported JSON and `#share=` links contain financial records in readable/encoded form; anyone holding a share link can read its contents. Importing a backup whose IDs already exist creates a separate copy instead of overwriting the existing group. Clearing browser/site storage removes local data unless a backup has been exported.

## Project layout

- `src/ocr/` — capture, preprocessing, OCR, parsing, validation, and classification.
- `src/features/split/` — split engine, batch saving, recurring schedules, and receipt UI.
- `src/features/settlement/` — balances, suggested payments, analytics, UPI, and export.
- `src/features/sharing/` — JSON backup and URL sharing.
- `src/db/` and `src/store/` — IndexedDB repository and app state.
- `public/sw.js` — production service worker; `vite.config.ts` injects built asset paths.

## Deployment

Deploy the `dist/` output from `npm run build` to an HTTPS static host. Route unknown paths to `index.html` (the provided `vercel.json` does this for Vercel). Test installation, camera capture, a first online scan, a subsequent offline scan, and a reload on a real phone before presenting a live demo. The repository does not include a verified public deployment URL.
