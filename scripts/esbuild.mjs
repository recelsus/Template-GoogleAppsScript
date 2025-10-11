// package.json: { "type": "module" }
import esbuild from "esbuild";
import { GasPlugin } from "esbuild-gas-plugin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// scripts directory sits beneath the project root, so ascend once to reach it
const root_dir = path.resolve(__dirname, "..");
const src_dir = path.join(root_dir, "src");

const argv_list = process.argv.slice(2);
let env_arg;
for (let index = 0; index < argv_list.length; index += 1) {
  const token = argv_list[index];
  if (token.startsWith("--env=")) {
    env_arg = token.slice("--env=".length);
    continue;
  }
  if (token === "--env" || token === "-e") {
    env_arg = argv_list[index + 1];
    index += 1;
  }
}

const env_path = resolve_env_path(env_arg, root_dir);
const env_result = dotenv.config({ path: env_path });
const env_values = env_result.parsed ?? {};

if (env_result.error && env_result.error.code !== "ENOENT") {
  console.warn(`⚠️  Unable to load ${env_path}: ${env_result.error.message}`);
}

const dist_dir = resolve_dist_dir(read_env_value("CLASP_ROOT_DIR", env_values), root_dir);
const src_manifest_path = path.join(src_dir, "appsscript.json");
const dist_manifest_path = path.join(dist_dir, "appsscript.json");

const ensure_dir = (target_dir) => (fs.existsSync(target_dir) || fs.mkdirSync(target_dir, { recursive: true }));

// Copy the manifest from src to dist after each build to keep clasp push enabled
const copy_manifest_plugin = {
  name: "copy-manifest",
  setup(build) {
    build.onEnd(() => {
      ensure_dir(dist_dir);
      if (!fs.existsSync(src_manifest_path)) {
        console.warn("⚠️  Skipped copying manifest because src/appsscript.json is missing.");
        return;
      }
      fs.copyFileSync(src_manifest_path, dist_manifest_path);
      console.log("📦 Copied src/appsscript.json -> dist/appsscript.json");
    });
  },
};

// Plugin to mirror every HTML asset under src/ into the dist directory
const copy_html_files_plugin = {
  name: "copy-html-files",
  setup(build) {
    build.onEnd(() => {
      const html_files = collect_html_files(src_dir);
      if (html_files.length === 0) {
        console.log("ℹ️  No HTML assets under src/. Skipped copying HTML.");
        return;
      }
      for (const absolute_path of html_files) {
        const relative_path = path.relative(src_dir, absolute_path);
        const destination_path = path.join(dist_dir, relative_path);
        ensure_dir(path.dirname(destination_path));
        fs.copyFileSync(absolute_path, destination_path);
      }
      console.log(`🧩 Copied ${html_files.length} HTML file(s) into ${path.relative(root_dir, dist_dir) || "."}`);
    });
  },
};

ensure_dir(src_dir);
ensure_dir(dist_dir);

await esbuild.build({
  entryPoints: [path.join(src_dir, "main.ts")],
  outfile: path.join(dist_dir, "main.js"),
  bundle: true,
  minify: false,
  platform: "browser",
  format: "iife",
  // copy_html_files_plugin extends the default plugin chain by mirroring HTML assets
  plugins: [GasPlugin, copy_manifest_plugin, copy_html_files_plugin],
});

console.log("✅ Build complete");

function resolve_env_path(raw_path, base_dir) {
  const candidate = normalise_path_token(raw_path ?? "");
  if (!candidate) return path.resolve(base_dir, ".env");
  const expanded = expand_home(candidate);
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(base_dir, expanded);
}

function resolve_dist_dir(raw_value, base_dir) {
  const candidate = normalise_path_token(raw_value ?? "");
  if (!candidate) return path.join(base_dir, "dist");
  const expanded = expand_home(candidate);
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(base_dir, expanded);
}

function collect_html_files(base_dir) {
  if (!fs.existsSync(base_dir)) return [];
  const results = [];
  const queue = [base_dir];
  while (queue.length) {
    const current_dir = queue.pop();
    for (const entry_name of fs.readdirSync(current_dir)) {
      const absolute_path = path.join(current_dir, entry_name);
      const stat = fs.statSync(absolute_path);
      if (stat.isDirectory()) {
        queue.push(absolute_path);
        continue;
      }
      if (stat.isFile() && absolute_path.toLowerCase().endsWith(".html")) {
        results.push(absolute_path);
      }
    }
  }
  return results;
}

function read_env_value(key, env_store) {
  if (has_own(env_store, key)) return env_store[key];
  if (has_own(process.env, key)) return process.env[key];
  return undefined;
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
