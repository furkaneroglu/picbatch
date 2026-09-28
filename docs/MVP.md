# PicBatch MVP Specification

Status: **Frozen for MVP implementation**

This document defines what PicBatch v1 must do and, equally importantly, what it must not do. Changes that expand this scope should be deferred unless they fix a blocker for the core workflow.

## 1. Product definition

PicBatch is a browser-based, local-first batch utility for e-commerce sellers and catalog operators. The user provides a product spreadsheet and a set of product images. PicBatch matches images to products using explicit deterministic rules, renames the images using a product identifier, optionally resizes/re-encodes them, then exports the processed images and a machine-readable report.

The job to be done is:

> “I have a supplier/catalog spreadsheet and a messy folder of product photos. Turn them into consistently named, marketplace-ready image files without me renaming hundreds of files by hand.”

## 2. Target users

Primary:

- small/medium e-commerce sellers;
- marketplace operators and catalog teams;
- agencies or freelancers preparing product catalogs;
- Turkish sellers receiving Excel/CSV files and image folders from suppliers.

The MVP is global-first, but must work well with Turkish/European spreadsheet habits, Unicode product identifiers, semicolon-delimited CSV files, and Excel-generated XLSX files.

## 3. Core principles

1. **Local-first:** user-selected spreadsheet and image contents stay in the browser. No application backend is required.
2. **Deterministic:** the same inputs and settings must produce the same match decisions, filenames, report rows, and sequence ordering.
3. **No guessing:** ambiguous matches are reported and excluded from automatic output unless the user changes the mapping/input.
4. **Small MVP:** optimize the core batch workflow before adding integrations or editing features.
5. **Recoverable:** the user sees what will happen before processing and can fix source data instead of discovering silent mistakes after export.

## 4. Supported inputs

### 4.1 Product data

Supported:

- `.csv`
- `.xlsx`

CSV requirements:

- UTF-8 and UTF-8 BOM are supported.
- Delimiter auto-detection must support comma, semicolon, and tab.
- Rows are treated as data; formulas do not need evaluation.

XLSX requirements:

- Read workbook locally in the browser.
- If multiple sheets exist, allow the user to select a sheet.
- Use the first non-empty row as the default header row for MVP.

Not required in MVP:

- legacy `.xls`;
- Google Sheets connection;
- remote spreadsheet URLs;
- arbitrary encoding conversion such as Windows-1254.

### 4.2 Images

Supported input methods:

- choose/drop a folder where browser support permits;
- upload a `.zip` containing images.

Supported source image formats for MVP:

- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- WebP (`.webp`)

Ignored/non-image files inside folders/ZIPs are counted and reported as unsupported/ignored; they must not crash the import.

Nested folders are allowed. Matching uses the file basename by default while the original relative path is retained in the report to disambiguate source files.

## 5. Column mapping

After spreadsheet import, show detected columns and a short data preview.

The user maps:

- **Primary product identifier**: either SKU or barcode; required.
- **SKU column**: optional if barcode is the primary identifier, but recommended.
- **Barcode column**: optional if SKU is the primary identifier.
- **Current image filename column**: optional; contains one source filename per product row for explicit matching.

Output filename base defaults to the selected primary product identifier. If SKU is present and the user selects SKU as primary, filenames are SKU-based as expected (`SKU-1.jpg`, `SKU-2.jpg`, ...).

A row with a blank primary identifier cannot be auto-matched and is reported as an invalid/unmatched product row.

MVP does not support multiple image filenames stored in a single spreadsheet cell.

## 6. Normalization rules

Normalization exists only to make deterministic comparison safer; it must not mutate displayed source data.

For identifier comparison:

1. Convert the cell to a string without numeric reformatting.
2. Trim surrounding whitespace.
3. Normalize Unicode using NFKC.
4. Compare case-insensitively using a locale-independent normalization strategy.
5. Preserve internal punctuation and characters; do not remove hyphens, underscores, Turkish letters, or leading zeroes.

For filename comparison:

1. Use basename only for matching unless otherwise stated.
2. Strip the final extension before inferred identifier matching.
3. Normalize Unicode using NFKC.
4. Trim surrounding whitespace.
5. Compare case-insensitively.

Barcode/SKU values must never be converted through floating-point numeric formatting. `001234567890` must remain distinct from `1234567890`.

## 7. Deterministic matching algorithm

Matching is intentionally conservative.

### 7.1 Build product indexes

For the selected sheet:

- index rows by normalized primary identifier;
- if mapped, index rows by normalized SKU and barcode;
- if mapped, index rows by normalized current image filename basename.

Any normalized primary identifier that belongs to more than one product row is a **duplicate product key**. Images must not be auto-assigned to one of those rows.

### 7.2 Explicit filename match

If `current image filename` is mapped, try this first.

An image explicitly matches a product when its normalized basename, including extension-insensitive comparison where safe, corresponds to exactly one product row's mapped current filename.

If the same mapped filename points to multiple product rows, or multiple source files create an indistinguishable explicit match, classify the case as ambiguous/duplicate rather than guessing.

Explicit filename matches take precedence over inferred identifier matches.

### 7.3 Identifier-based match

If no unique explicit filename match exists, infer from the image filename stem.

An image matches an identifier only when the normalized stem is either:

- exactly the normalized identifier; or
- starts with the exact normalized identifier followed immediately by a supported separator/sequence boundary such as `-`, `_`, space, or `(`.

Examples for identifier `ABC-123`:

- `ABC-123.jpg` -> match
- `ABC-123-1.jpg` -> match
- `ABC-123_02.png` -> match
- `ABC-123 (front).webp` -> match
- `ABC-1234.jpg` -> **no match**
- `XABC-123.jpg` -> **no match**

The algorithm must not use general substring matching.

If both SKU and barcode are mapped, a filename may be tested against both indexes. If those tests point to different product rows, the image is **ambiguous** and is not auto-matched.

### 7.4 Multiple images for one product

Multiple images may match the same product.

Their sequence number is derived from a stable natural sort of the original relative path + basename. Numeric chunks sort numerically (`2` before `10`). Sorting must not depend on the user's OS locale.

The resulting names are:

- `IDENTIFIER-1.ext`
- `IDENTIFIER-2.ext`
- `IDENTIFIER-3.ext`

Sequence numbering always starts at 1. The MVP does not attempt to infer “main”, “front”, “detail”, or marketplace image priority from visual content.

### 7.5 Match statuses

The review/report model must be able to represent at least:

- `matched`
- `unmatched_image`
- `unmatched_product`
- `invalid_product_key`
- `duplicate_product_key`
- `ambiguous_match`
- `output_collision`
- `unsupported_file`

The UI may group statuses for readability, but the exported report should preserve a specific status per row/event.

## 8. Output filename rules

Filename base is the original selected output identifier value after trimming, not the hidden normalized comparison key.

For filesystem safety:

- replace `/`, `\\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` and ASCII control characters with `-`;
- collapse repeated replacement separators;
- remove trailing spaces and periods;
- reject an identifier if sanitization leaves an empty filename base.

Unicode is preserved. Do not transliterate Turkish or other non-ASCII characters.

Never silently overwrite an output file. Any two files resolving to the same final output path are an `output_collision` and must block export for those files until resolved by deterministic sequencing or changed source data/settings.

Extensions are lowercase in generated names.

When output format is `Keep original`, retain each source file's image type. When converting, use `.jpg` or `.webp` accordingly.

## 9. Image processing options

All processing is optional. Renaming/report export must work without image recompression.

### 9.1 Resize

Controls:

- max width (optional);
- max height (optional);
- preserve aspect ratio (always on in MVP);
- do not upscale by default.

If both max dimensions are set, fit within the bounding box.

No crop, pad, rotate, watermark, or manual editor in MVP.

### 9.2 Output format

Choices:

- Keep original
- JPEG
- WebP

When converting an image containing transparency to JPEG, composite transparent pixels onto white.

### 9.3 Quality

For JPEG/WebP re-encoding:

- expose a quality control from 1–100;
- default to 85;
- show the value clearly;
- do not imply that this is a guaranteed percentage reduction in file size.

PNG-specific compression tuning is not required for MVP.

### 9.4 Metadata behavior

If an image is only renamed with `Keep original` and no resize/re-encode is required, preserve original bytes.

If an image is decoded and re-encoded for resizing or format conversion, metadata such as EXIF may be lost. This is acceptable for MVP and should be noted in the UI/help text.

## 10. Review screen

Before processing, show a review summary with at least:

- product rows loaded;
- valid product keys;
- source images loaded;
- matched images;
- products with no matched image;
- unmatched images;
- duplicate product keys;
- ambiguous matches;
- output collisions;
- unsupported/ignored files.

Provide a table that can be filtered by status and includes:

- source relative path / filename;
- matched product identifier where applicable;
- proposed output filename where applicable;
- match method (`explicit_filename`, `sku`, `barcode`, etc.);
- status/reason.

MVP does not require inline manual reassignment of individual images. Users correct the source data, filenames, or mapping and rerun/review. This keeps the matching engine deterministic and the UI small.

## 11. Export

Primary export:

- one ZIP containing successfully processed images;
- include the report CSV inside the ZIP as `picbatch-report.csv`.

Also provide a separate `Download report CSV` action so a user can inspect issues without generating the image ZIP.

Suggested ZIP layout:

```text
picbatch-output.zip
├── images/
│   ├── ABC-123-1.jpg
│   ├── ABC-123-2.jpg
│   └── 8690000000001-1.webp
└── picbatch-report.csv
```

The report CSV should contain enough information to trace every decision, including:

- source path;
- source filename;
- source type;
- source size where available;
- matched row number/index;
- SKU;
- barcode;
- selected primary identifier;
- match method;
- proposed/final filename;
- output format;
- output dimensions where processed;
- status;
- reason/detail.

CSV export must be UTF-8 with BOM so Turkish characters open cleanly in common Excel workflows.

## 12. Privacy and networking

The production app may be statically hosted, but after its own application assets are loaded:

- selected spreadsheet contents must not be sent to a server;
- selected images must not be sent to a server;
- processing must happen in the browser;
- no analytics/session-replay payload may contain filenames, identifiers, spreadsheet values, or image contents.

For the MVP, prefer no product analytics at all. Privacy should be a visible product benefit, not merely an implementation detail.

## 13. Browser support

Target current modern desktop browsers supported by the chosen Vite release. The primary QA browsers are current Chrome and Edge. Safari/Firefox should support ZIP upload and the core processing flow; folder-picking UX may vary by browser, so ZIP remains the universal fallback.

Mobile is not an MVP target.

## 14. Performance expectations

The MVP should process images sequentially or with bounded concurrency rather than decoding an entire library at once.

Do not promise a hard catalog-size limit in marketing during MVP. The UI should display selected file count and total size and may warn for very large jobs (initial warning guideline: more than 1,000 images or more than 1 GB selected) because browser memory varies by device.

A large job should fail with an actionable error rather than freezing indefinitely where practical.

## 15. UX flow

The product should feel like a short wizard/utility, not a dashboard.

1. **Upload product file** — CSV/XLSX and sheet selection if necessary.
2. **Map columns** — choose primary identifier, optional SKU/barcode/current filename.
3. **Add images** — folder or ZIP.
4. **Review matches** — inspect counts and problem rows.
5. **Choose processing** — rename base, resize, format, quality.
6. **Export** — download report and/or output ZIP.

The user must be able to go back to an earlier step without reloading the whole page where practical.

## 16. Error handling

At minimum, handle these without an application crash:

- empty spreadsheet;
- spreadsheet with no header/data rows;
- unsupported spreadsheet type;
- malformed ZIP;
- ZIP with no supported images;
- blank mapped identifier column;
- duplicate identifiers;
- duplicate/ambiguous image matches;
- unsupported/corrupted image;
- browser failing to decode an image;
- output filename collision;
- ZIP generation failure / browser memory failure.

Errors should identify what the user can change.

## 17. Technical direction

The implementation should remain a static SPA.

Recommended baseline:

- React + TypeScript + Vite;
- strict TypeScript;
- SheetJS CE for local CSV/XLSX parsing;
- browser ZIP library such as JSZip;
- Canvas / `createImageBitmap` / Blob APIs for decode, resize, and encode;
- pure TypeScript modules for normalization, matching, naming, report generation, and sorting;
- unit tests around all pure business logic;
- minimal application state solution (React state/reducer is sufficient initially; no global state library unless complexity proves it necessary).

Avoid a Web Worker requirement in the first correctness milestone. Introduce bounded background/worker processing only if profiling shows the UI is unusable without it.

## 18. Required deterministic test fixtures

Create a small fixture set covering at least:

- normal SKU matches;
- barcode matches with leading zeroes;
- SKU containing hyphens;
- `SKU-1` vs `SKU-10` natural ordering;
- Turkish/Unicode identifiers;
- semicolon CSV;
- duplicate product identifier;
- two identifiers where one is a prefix of another (`ABC-1`, `ABC-10`);
- explicit current filename match overriding inference;
- ambiguous SKU vs barcode result;
- unmatched image;
- product with no image;
- two images producing a potential output collision;
- transparent PNG converted to JPEG;
- resize without upscaling.

Fixtures must use synthetic/non-sensitive product data.

## 19. MVP acceptance criteria

The MVP is ready for initial external testing when all of the following are true:

1. A user can load a valid CSV or XLSX file and map the required identifier.
2. A user can add supported images from a folder or ZIP.
3. The same fixture input produces identical match/report results across repeated runs.
4. Prefix false positives are prevented (`ABC-1` does not steal `ABC-10`).
5. Duplicate and ambiguous cases are shown before export and never silently guessed.
6. Multiple product images receive stable `-1`, `-2`, ... sequencing.
7. A user can export renamed images without re-encoding them.
8. Resize and JPEG/WebP conversion work with the specified rules.
9. Report CSV opens with Turkish/Unicode text intact in Excel-compatible workflows.
10. No selected file contents are sent to an application backend.
11. The app passes lint, typecheck, unit tests, production build, and a documented manual QA pass in Chrome/Edge.
12. No explicitly excluded v1 feature has been added as a hidden dependency of the workflow.

## 20. Explicitly out of scope for v1

- backend/API server;
- database;
- authentication/accounts;
- billing/subscriptions;
- cloud storage;
- Shopify API;
- Trendyol API;
- Amazon/eBay/marketplace integrations;
- AI image generation;
- AI/background removal;
- fuzzy/visual product matching;
- OCR/barcode reading from the pixels of an image;
- manual image editor;
- crop/pad/watermark;
- DAM/PIM functionality;
- collaboration/team features;
- mobile-first UX;
- saved projects/history across devices.

Any of these may be considered after real MVP usage validates the core batch-renaming problem.
