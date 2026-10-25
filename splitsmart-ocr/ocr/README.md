# SplitSmart — OCR + parsing module

    npm i tesseract.js @huggingface/transformers
    npm i -D vitest

Public API (everything else is internal):

| Import | Purpose |
|---|---|
| `scanReceipt(file, {rotation?, onProgress?})` | image -> `{ok, ocr, parsed, validation}`; never throws |
| `scanBatch(files, ...)` | several receipts, sequential |
| `parseReceipt(ocrResult)` | pure parser (unit-testable, no DOM) |
| `validateTotals(...)` / `validateParsed(...)` | re-run after every edit in the review table |
| `categorizeItems(items, {onResult})` | keyword pass + lazy zero-shot model |
| `toExpenseTotals(parsed)` | tax/service/discount/total in the shared Expense shape |
| `mock/mockReceipts.ts` | fake OcrResults so the UI can be built before OCR works |

Money is integer paise everywhere. Confidences are 0..1.
