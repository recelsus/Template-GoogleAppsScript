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
2. Create an `.env` file at the repository root with `GAS_SCRIPT_ID="your-script-id"`.
3. Generate clasp configuration and TypeScript environment bindings:
   ```bash
   npm run prebuild
   npm run env
   ```
4. Build the script bundle:
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
- `scripts/generate-env.mjs` only replaces placeholders defined in the template file and leaves other `.env` keys untouched.
- Both `npm run prebuild` and `npm run env` default to `.env` in the repository root. Override the location with `--env /custom/path/.env` when needed (relative paths and `~` expansion are supported).
