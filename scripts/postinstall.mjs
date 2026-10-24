import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// node-pty is the only native dependency. It is an N-API module, so where it
// ships a prebuild (Windows, macOS) that binary already works in Electron;
// rebuilding from source there needs extra toolchain parts (on Windows the
// Spectre-mitigated MSVC libraries) and fails without them.
function hasNodePtyPrebuild() {
  try {
    const pkg = createRequire(import.meta.url).resolve("node-pty/package.json");
    const dir = path.join(path.dirname(pkg), "prebuilds", `${process.platform}-${process.arch}`);
    return existsSync(path.join(dir, "pty.node"));
  } catch {
    return false;
  }
}

function isProductionOnlyInstall() {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.npm_config_production === "true") return true;
  if (process.env.npm_config_only === "prod") return true;

  const omit = process.env.npm_config_omit ?? "";
  return omit
    .split(",")
    .map((entry) => entry.trim())
    .includes("dev");
}

function run(bin, args) {
  const result = spawnSync(bin, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

if (isProductionOnlyInstall()) {
  console.log("[postinstall] Skipping desktop dependency setup for production-only install");
  process.exit(0);
}

if (hasNodePtyPrebuild()) {
  console.log(`[postinstall] Using node-pty's prebuilt binary for ${process.platform}-${process.arch}`);
} else {
  run("electron-builder", ["install-app-deps"]);
}
run("playwright", ["install", "chromium"]);
