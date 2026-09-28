# PicBatch

PicBatch is a local-first browser tool for matching product images to a CSV/XLSX product list, renaming them by SKU or barcode, optionally optimizing them, and exporting the result as a ZIP.

## MVP goals

- Import CSV/XLSX product data
- Import product images from a folder or ZIP
- Map SKU, barcode, and optional current image filename columns
- Deterministically match images to products
- Report matched, unmatched, ambiguous, duplicate, and output-collision cases
- Rename images as `SKU-1.jpg`, `SKU-2.jpg`, ...
- Optional resize, JPEG/WebP conversion, and quality controls
- Export processed images as ZIP
- Export a mapping/report CSV
- Keep selected product data and images inside the browser

## Non-goals for v1

No backend, authentication, billing, cloud storage, Shopify/Trendyol APIs, AI image generation, background removal, or complex image editing.

## Product principle

Solve one painful e-commerce operations task quickly and predictably. The MVP favors deterministic behavior, privacy, and clear error reporting over feature breadth.

See [`docs/MVP.md`](docs/MVP.md) for the frozen MVP specification and [`AGENTS.md`](AGENTS.md) for development rules.

## Local development

### Prerequisites

- Node.js (v20+ recommended)
- npm

### Setup

```bash
npm install
```

### Development commands

- **Start dev server:** `npm run dev`
- **Run typecheck:** `npm run typecheck`
- **Run linter:** `npm run lint`
- **Run unit tests:** `npm run test`
- **Production build:** `npm run build`
- **Preview production build:** `npm run preview`
