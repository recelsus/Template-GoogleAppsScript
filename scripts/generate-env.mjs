// Usage:
//   node gas/scripts/generate-env.mjs path/to/.env path/to/env.ts.in [outputPath]
//
// - Reads the requested {{VAR_NAME}} entries from the .env file to build env.ts
// - Ignores environment keys that the template does not reference
// - Falls back to an empty string when no value is available

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node scripts/generate-env.mjs path/to/.env path/to/env.ts.in [outputPath]");
  process.exit(1);
}

const env_path = resolve_env_path(args[0]);
const template_path = path.resolve(process.cwd(), args[1]);
const output_path = path.resolve(
  process.cwd(),
  args[2] ?? template_path.replace(/\.in$/, "")
);

if (!fs.existsSync(template_path)) {
  console.error(`❌ Template not found: ${template_path}`);
  process.exit(1);
}

const env_contents = fs.existsSync(env_path)
  ? fs.readFileSync(env_path, "utf8")
  : "";
const env_values = dotenv.parse(env_contents);

const template = fs.readFileSync(template_path, "utf8");
const placeholder_re = /\{\{([A-Z0-9_]+)\}\}/g;
const placeholder_keys = new Set();

let match;
while ((match = placeholder_re.exec(template)) !== null) {
  placeholder_keys.add(match[1]);
}

const replaced = template.replace(
  placeholder_re,
  (_full, key) => {
    const raw_value = env_values[key] ?? process.env[key] ?? "";
    return JSON.stringify(raw_value);
  }
);

const missing_keys = [];
for (const key of placeholder_keys) {
  if (env_values[key] === undefined && process.env[key] === undefined) {
    missing_keys.push(key);
  }
}

fs.mkdirSync(path.dirname(output_path), { recursive: true });
fs.writeFileSync(output_path, replaced);

const relative_output = path.relative(process.cwd(), output_path);
console.log(`✅ Generated ${relative_output}`);

if (missing_keys.length) {
  console.warn(`⚠️  Missing values for: ${missing_keys.join(", ")}`);
}

function resolve_env_path(raw_path) {
  const candidate = raw_path?.trim() ? raw_path.trim() : ".env";
  const expanded = candidate.replace(/^~(?=($|[\\/]))/, os.homedir());
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(process.cwd(), expanded);
}
