# AGENTS.md

## Purpose

This repository is developed primarily with AI-assisted coding tools. Before changing code, read this file and `docs/MVP.md`.

## Product constraints

1. Keep the MVP local-first. Selected spreadsheets and images must not be uploaded to an application backend.
2. Do not add a backend, database, auth, billing, cloud storage, marketplace API integration, AI image features, or a complex editor unless the MVP spec is explicitly changed first.
3. Matching must be deterministic. Never add fuzzy/AI matching to the MVP.
4. Ambiguous input must fail visibly instead of guessing.
5. Preserve Turkish and other Unicode characters in spreadsheet values and filenames whenever filesystem-safe.
6. CSV handling must account for comma, semicolon, and tab delimiters because semicolon-delimited exports are common in Turkish/European spreadsheet workflows.
7. Avoid unnecessary dependencies. Prefer browser APIs for image decoding/encoding and transformations.
8. Keep business logic independent from React components so matching, naming, reporting, and transforms can be unit-tested.

## Planned implementation direction

- Static SPA
- React + TypeScript + Vite
- Strict TypeScript
- SheetJS CE for CSV/XLSX parsing, installed from the official SheetJS distribution rather than the stale public npm package
- JSZip or an equivalent browser-side ZIP library
- Canvas / `createImageBitmap` / `Blob` browser APIs for image transforms
- No network request containing user-selected file contents

Do not pin library versions here; use current stable versions when the implementation issue is started and document any nonstandard installation source in the lockfile/README.

## Branch and issue workflow

- One GitHub issue per focused deliverable.
- Branch from `main` using `feat/mvp-XX-short-name` or `fix/...`.
- Keep pull requests small enough to review independently.
- Do not combine unrelated cleanup/refactors with an MVP feature.
- Every implementation PR must include tests for deterministic business logic and a short manual QA note for browser behavior.

## Definition of done

A task is not done just because the UI works once. It must:

- satisfy its issue acceptance criteria;
- handle malformed/empty input without crashing;
- surface actionable user-facing errors;
- avoid sending selected files off-device;
- have deterministic test fixtures for matching/renaming logic where applicable;
- pass lint, typecheck, unit tests, and production build;
- not expand the MVP scope.

## UX rules

- Primary flow should remain: Product file -> column mapping -> images -> review -> processing options -> export.
- Show counts before processing: products, images, matched, unmatched, ambiguous, duplicates/collisions.
- Never silently overwrite two output files with the same name.
- Destructive or irreversible browser actions are unnecessary for MVP and should not be introduced.
- Keep copy concise and operational; this is a utility tool, not a dashboard platform.
