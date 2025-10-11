// Usage:
//   node scripts/prebuild.mjs
//   node scripts/prebuild.mjs --force   # or -f
//   node scripts/prebuild.mjs --env path/to/.env

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root_dir = path.resolve(__dirname, "..");  // repo root sits directly above scripts
const gas_dir = root_dir;                           // clasp metadata lives at the repository root

// argument parsing
const argv_list = process.argv.slice(2);
let force_flag = false;
let env_arg;

for (let index = 0; index < argv_list.length; index += 1) {
  const token = argv_list[index];
  if (token === "--force" || token === "-f") {
    force_flag = true;
    continue;
  }
  if (token.startsWith("--env=")) {
    env_arg = token.slice("--env=".length);
    continue;
  }
  if (token === "--env" || token === "-e") {
    env_arg = argv_list[index + 1];
    index += 1;
    continue;
  }
}

function resolve_env_path(raw_path, base_dir) {
  const candidate = raw_path?.trim() ? raw_path.trim() : ".env";
  const expanded = candidate.replace(/^~(?=($|[\\/]))/, os.homedir());
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(base_dir, expanded);
}

const env_path = resolve_env_path(env_arg, root_dir);

// env
dotenv.config({ path: env_path });
if (!process.env.GAS_SCRIPT_ID) {
  console.error("❌ Missing env: GAS_SCRIPT_ID");
  process.exit(1);
}

// generate .clasp.json from template
const template_path = path.join(gas_dir, ".clasp.json.in");
const output_path = path.join(gas_dir, ".clasp.json");
if (!fs.existsSync(template_path)) {
  console.error("❌ .clasp.json.in not found:", template_path);
  process.exit(1);
}

const raw_template = fs.readFileSync(template_path, "utf8");
const replaced_text = raw_template.replace(/\$\{GAS_SCRIPT_ID\}/g, process.env.GAS_SCRIPT_ID);

// JSON validity check
try { JSON.parse(replaced_text); }
catch (error) {
  console.error("❌ Invalid .clasp.json:", error.message);
  process.exit(1);
}

if (fs.existsSync(output_path) && !force_flag) {
  console.log("ℹ️  .clasp.json exists (skip). Use --force to overwrite.");
} else {
  fs.writeFileSync(output_path, replaced_text);
  console.log(force_flag ? "✅ Regenerated .clasp.json (force)" : "✅ Generated .clasp.json");
}
