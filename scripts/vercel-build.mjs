#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDistDir = path.join(repoRoot, "packages/web/dist");
const rootDistDir = path.join(repoRoot, "dist");
const extraOutputDir = process.env.DMDASH_VERCEL_EXTRA_OUTPUT_DIR
  ? path.resolve(process.env.DMDASH_VERCEL_EXTRA_OUTPUT_DIR)
  : "";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(result.status || 1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function copyDist(targetDir) {
  rmSync(targetDir, { force: true, recursive: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(webDistDir, targetDir, { recursive: true });
}

run(process.execPath, ["scripts/generate-altstore-source.mjs"]);
run("pnpm", ["--filter", "meshtastic-web", "build"]);

const webIndexPath = path.join(webDistDir, "index.html");
if (!existsSync(webIndexPath)) {
  console.error(`Missing web build output: ${webIndexPath}`);
  process.exit(1);
}

copyDist(rootDistDir);

if (
  extraOutputDir &&
  extraOutputDir !== rootDistDir &&
  extraOutputDir !== webDistDir
) {
  copyDist(extraOutputDir);
}

console.log("Vercel web output ready:");
console.log(`- ${webDistDir}`);
console.log(`- ${rootDistDir}`);
if (extraOutputDir && extraOutputDir !== rootDistDir && extraOutputDir !== webDistDir) {
  console.log(`- ${extraOutputDir}`);
}
