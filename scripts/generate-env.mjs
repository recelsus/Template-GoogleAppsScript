// Usage:
//   node scripts/generate-env.mjs [path/to/.env] [path/to/env.ts.in] [path/to/env.ts]
//
// - Builds env.ts by matching placeholders in env.ts.in with keys from a .env file
// - Defaults to ./.env, ./src/env.ts.in, and ./src/env.ts when arguments are omitted
// - Skips generation when templates or matching environment values are absent

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import os from "os";

const DEFAULT_ENV_PATH = ".env";
const DEFAULT_TEMPLATE_PATH = path.join("src", "env.ts.in");
const DEFAULT_OUTPUT_PATH = path.join("src", "env.ts");

const args = process.argv.slice(2);
const env_path = resolve_env_path(args[0] ?? DEFAULT_ENV_PATH, process.cwd());
const template_path = resolve_path(args[1] ?? DEFAULT_TEMPLATE_PATH);
const output_path = resolve_path(args[2] ?? DEFAULT_OUTPUT_PATH);

if (!fs.existsSync(template_path)) {
  console.log(`ℹ️  Template not found (${template_path}). Skipping env.ts generation.`);
  process.exit(0);
}

const template_source = fs.readFileSync(template_path, "utf8");
if (!template_source.trim()) {
  console.log("ℹ️  Template is empty. Skipping env.ts generation.");
  process.exit(0);
}

const placeholder_re = /\{\{([A-Z0-9_]+)\}\}/g;
const placeholder_keys = new Set();
let match;
while ((match = placeholder_re.exec(template_source)) !== null) {
  placeholder_keys.add(match[1]);
}

if (placeholder_keys.size === 0) {
  console.log("ℹ️  Template defines no placeholders. Skipping env.ts generation.");
  process.exit(0);
}

const env_contents = fs.existsSync(env_path) ? fs.readFileSync(env_path, "utf8") : "";
const env_values = env_contents ? dotenv.parse(env_contents) : {};
const resolved_keys = new Map();
const missing_keys = [];

for (const key of placeholder_keys) {
  if (has_own(env_values, key)) {
    resolved_keys.set(key, env_values[key]);
    continue;
  }
  if (has_own(process.env, key)) {
    resolved_keys.set(key, process.env[key]);
    continue;
  }
  missing_keys.push(key);
}

if (resolved_keys.size === 0) {
  console.log("ℹ️  No matching environment entries found. Skipping env.ts generation.");
  if (missing_keys.length) {
    console.log(`ℹ️  Missing keys: ${missing_keys.join(", ")}`);
  }
  process.exit(0);
}

if (missing_keys.length > 0) {
  console.warn(`⚠️  Missing values for: ${missing_keys.join(", ")}`);
  console.log("ℹ️  Skipping env.ts generation until all placeholders are provided.");
  process.exit(0);
}

const replaced = template_source.replace(
  placeholder_re,
  (_full, key) => {
    const raw_value = resolved_keys.has(key) ? resolved_keys.get(key) : "";
    return JSON.stringify(raw_value);
  }
);

fs.mkdirSync(path.dirname(output_path), { recursive: true });
fs.writeFileSync(output_path, replaced);

const relative_output = path.relative(process.cwd(), output_path);
console.log(`✅ Generated ${relative_output}`);

function resolve_env_path(raw_path, base_dir) {
  const candidate = normalise_path_token(raw_path ?? "");
  if (!candidate) return path.resolve(base_dir, DEFAULT_ENV_PATH);
  const expanded = expand_home(candidate);
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(base_dir, expanded);
}

function resolve_path(raw_path) {
  const candidate = normalise_path_token(raw_path ?? "");
  const expanded = expand_home(candidate);
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(process.cwd(), expanded);
}

function expand_home(candidate) {
  return candidate.replace(/^~(?=($|[\\/]))/, os.homedir());
}

function normalise_path_token(value) {
  return value && value.trim ? value.trim() : value;
}

function has_own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}
