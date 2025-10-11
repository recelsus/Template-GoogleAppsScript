# Google Apps Script Template

This template scaffolds a TypeScript-based Google Apps Script project that bundles code with esbuild and keeps auxiliary files in sync with clasp.

## Prerequisites

- Node.js 18+
- Google Apps Script CLI (`npm install -g @google/clasp`)
- A deployed Google Apps Script project ID

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create an `.env` file at the repository root with at least `CLASP_SCRIPT_ID="your-script-id"`. Optional fields include `CLASP_ROOT_DIR` and `CLASP_PROJECT_ID`.
3. Generate `.clasp.json` and (when applicable) TypeScript environment bindings:
   ```bash
   npm run prebuild
   npm run env
   ```
4. Build the script bundle (automatically syncs the latest manifest):
   ```bash
   npm run build
   ```
5. Deploy to Apps Script:
   ```bash
   npm run push
   ```

## Project Structure

- `scripts/` — helper utilities for building, configuration generation, and clasp setup
- `src/` — TypeScript source code (bundle entry is `src/main.ts` by default)
- `dist/` — compiled output that clasp pushes to Google Apps Script

## Notes

- The build process copies `src/appsscript.json` and `src/html/` (if present) into `dist/` after bundling.
- `scripts/prebuild.mjs` reads `CLASP_SCRIPT_ID`, `CLASP_ROOT_DIR`, and `CLASP_PROJECT_ID` from the selected `.env` file and rewrites `.clasp.json`. Use `--force` to overwrite an existing file.
- `scripts/sync-manifest.mjs` runs `clasp pull` (when `.clasp.json` exists) and copies the manifest from the configured `rootDir` into `src/appsscript.json`. The build script calls this automatically, or run `npm run manifest` manually when needed.
- `scripts/generate-env.mjs` skips generation when `src/env.ts.in` is missing, empty, or references placeholders that are not defined in the chosen `.env` file.
- `scripts/esbuild.mjs` respects `CLASP_ROOT_DIR`; when provided, the bundle is emitted to that directory. Missing values fall back to `dist`.
- All scripts that read environment variables (`npm run prebuild`, `npm run env`, `npm run build`) default to `.env` in the repository root. Provide an alternative path (for example `npm run env -- ../.env` or `npm run build -- --env ~/apps/.env`) when needed; relative paths and `~` expansion are supported.
