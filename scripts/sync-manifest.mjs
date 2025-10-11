// Usage:
//   node scripts/sync-manifest.mjs
//
// - Mirrors the manifest from the Apps Script project into src/appsscript.json
// - Runs `npx clasp pull` when .clasp.json exists; otherwise exits quietly

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repo_root = path.resolve(__dirname, "..");
const clasp_path = path.join(repo_root, ".clasp.json");
const src_dir = path.join(repo_root, "src");
const src_manifest_path = path.join(src_dir, "appsscript.json");

if (!fs.existsSync(clasp_path)) {
  console.log("ℹ️  .clasp.json not found. Skipping manifest sync.");
  process.exit(0);
}

let clasp_config;
try {
  const raw = fs.readFileSync(clasp_path, "utf8");
  clasp_config = JSON.parse(raw);
} catch (error) {
  console.error("❌ Failed to parse .clasp.json:", error.message ?? error);
  process.exit(1);
}

const clasp_root_dir = typeof clasp_config.rootDir === "string" && clasp_config.rootDir.trim()
  ? clasp_config.rootDir.trim()
  : ".";
const resolved_clasp_root = path.resolve(repo_root, clasp_root_dir);

try {
  execFileSync("npx", ["clasp", "pull"], { cwd: repo_root, stdio: "inherit" });
} catch (error) {
  console.error("❌ Failed to pull manifest via clasp:", error.message ?? error);
  process.exit(error.status ?? 1);
}

const pulled_manifest_path = path.join(resolved_clasp_root, "appsscript.json");
if (!fs.existsSync(pulled_manifest_path)) {
  console.warn("⚠️  clasp pull completed but manifest was not found in rootDir.");
  process.exit(0);
}

fs.mkdirSync(src_dir, { recursive: true });
fs.copyFileSync(pulled_manifest_path, src_manifest_path);

console.log("📥 Copied Apps Script manifest into src/appsscript.json");
