// package.json: { "type": "module" }
import esbuild from "esbuild";
import { GasPlugin } from "esbuild-gas-plugin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// scripts directory sits beneath the project root, so ascend once to reach it
const root_dir = path.resolve(__dirname, "..");
const src_dir = path.join(root_dir, "src");
const dist_dir = path.join(root_dir, "dist");
const src_manifest_path = path.join(src_dir, "appsscript.json");
const dist_manifest_path = path.join(dist_dir, "appsscript.json");
const clasp_rc_path = path.join(root_dir, ".clasp.json");

// Copy the HTML directory when it exists so template partials deploy with the bundle
const src_html_dir = path.join(src_dir, "html");
const dist_html_dir = path.join(dist_dir, "html");

const ensure_dir = (target_dir) => (fs.existsSync(target_dir) || fs.mkdirSync(target_dir, { recursive: true }));

function pull_into_dist() {
  // Assumes .clasp.json sets rootDir to "dist", which prebuild ensures beforehand
  execFileSync("npx", ["clasp", "pull"], { cwd: root_dir, stdio: "inherit" });
  return fs.existsSync(dist_manifest_path);
}

function write_minimal_manifest(dest_path) {
  const minimal_manifest = {
    timeZone: "Asia/Tokyo",
    runtimeVersion: "V8",
    exceptionLogging: "STACKDRIVER",
    dependencies: []
  };
  fs.writeFileSync(dest_path, JSON.stringify(minimal_manifest, null, 2) + "\n");
  console.log(`📝 Wrote minimal manifest -> ${path.relative(root_dir, dest_path)}`);
}

// Phase one: ensure src/appsscript.json exists by pulling dist/appsscript.json when needed
function ensure_src_manifest_by_pulling_dist() {
  ensure_dir(src_dir);
  ensure_dir(dist_dir);

  if (fs.existsSync(src_manifest_path)) return; // Already present, so leave it as-is

  // Assumes clasp pull populates dist/appsscript.json before copying back to src
  try {
    console.log("↪️  src/appsscript.json not found. Running: npx clasp pull");
    const dist_has_manifest = pull_into_dist();
    if (dist_has_manifest) {
      fs.copyFileSync(dist_manifest_path, src_manifest_path);
      console.log("📥 Copied dist/appsscript.json -> src/appsscript.json");
      return;
    }
    console.warn("⚠️  Pull succeeded but dist/appsscript.json not found.");
  } catch (error) {
    console.warn("⚠️  clasp pull failed:", error?.message ?? error);
  }

  // Fallback stub manifest used only when no manifest is available upstream
  write_minimal_manifest(src_manifest_path);
}

// Copy the manifest from src to dist after each build to keep clasp push enabled
const copy_manifest_plugin = {
  name: "copy-manifest",
  setup(build) {
    build.onEnd(() => {
      ensure_dir(dist_dir);
      fs.copyFileSync(src_manifest_path, dist_manifest_path);
      console.log("📦 Copied src/appsscript.json -> dist/appsscript.json");
    });
  },
};

// Simple breadth-first copy to keep nested HTML structure intact
function recursive_copy_dir(source_dir, dest_dir) {
  if (!fs.existsSync(source_dir)) return false;
  ensure_dir(dest_dir);
  const queue = [{ source: source_dir, dest: dest_dir }];
  while (queue.length) {
    const { source, dest } = queue.pop();
    for (const entry_name of fs.readdirSync(source)) {
      const source_path = path.join(source, entry_name);
      const dest_path = path.join(dest, entry_name);
      const entry_stat = fs.statSync(source_path);
      if (entry_stat.isDirectory()) {
        ensure_dir(dest_path);
        queue.push({ source: source_path, dest: dest_path });
      } else {
        fs.copyFileSync(source_path, dest_path);
      }
    }
  }
  return true;
}

// Plugin to mirror src/html into dist/html whenever the bundle finishes
const copy_html_dir_plugin = {
  name: "copy-html-dir",
  setup(build) {
    build.onEnd(() => {
      const copy_ok = recursive_copy_dir(src_html_dir, dist_html_dir);
      if (copy_ok) {
        console.log("🧩 Copied src/html -> dist/html (structure preserved)");
      } else {
        console.log("ℹ️  No src/html directory. Skipped copying HTML.");
      }
    });
  },
};

// Execution sequence
ensure_src_manifest_by_pulling_dist();

await esbuild.build({
  entryPoints: [path.join(src_dir, "main.ts")],
  outfile: path.join(dist_dir, "main.js"),
  bundle: true,
  minify: false,
  platform: "browser",
  format: "iife",
  // copy_html_dir_plugin extends the default plugin chain by mirroring HTML assets
  plugins: [GasPlugin, copy_manifest_plugin, copy_html_dir_plugin],
});

console.log("✅ Build complete");
