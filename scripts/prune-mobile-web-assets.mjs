#!/usr/bin/env node
import { readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = path.resolve(repoRoot, process.argv[2] ?? "packages/mobile/ios/App/App/public");

if (!existsSync(rootDir)) {
  console.warn(`Mobile web asset directory not found: ${rootDir}`);
  process.exit(0);
}

await rm(path.join(rootDir, "downloads"), { recursive: true, force: true });
await rm(path.join(rootDir, "altstore"), { recursive: true, force: true });
await rm(path.join(rootDir, "guide", "download.js"), { force: true });

const guidePages = ["guide/index.html", "guide/en/index.html", "guide/it/index.html"];

function pruneNativeGuideContent(html) {
  return html
    .replace(
      /\s*<div class=(["'])mini\1>\s*<strong>1\.\s*Install DarkMesh iOS<\/strong>[\s\S]*?<\/div>/gi,
      "",
    )
    .replace(
      /\s*<section class=(["'])panel\1 id=(["'])install-darkmesh-ios\2>[\s\S]*?(?=\s*<section class=(["'])panel\3 id=(["'])use-the-web-client-with-a-bridge\4>)/gi,
      "",
    )
    .replace(
      /\s*<section class=(["'])panel\1 id=(["'])installare-darkmesh-ios\2>[\s\S]*?(?=\s*<section class=(["'])panel\3 id=(["'])usare-web-client-bridge\4>)/gi,
      "",
    )
    .replace(/\s*<li>\s*<a href=(["'])#install-darkmesh-ios\1>[\s\S]*?<\/li>/gi, "")
    .replace(/\s*<li>\s*<a href=(["'])#installare-darkmesh-ios\1>[\s\S]*?<\/li>/gi, "")
    .replace(/\s*<a\b[^>]*href=(["'])#install-darkmesh-ios\1[^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/\s*<a\b[^>]*href=(["'])#installare-darkmesh-ios\1[^>]*>[\s\S]*?<\/a>/gi, "");
}

for (const page of guidePages) {
  const htmlPath = path.join(rootDir, page);
  if (!existsSync(htmlPath)) {
    continue;
  }

  const html = await readFile(htmlPath, "utf8");
  const pruned = pruneNativeGuideContent(html)
    .replace(
      /^[ \t]*<script\s+src=(["'])(?:\.\.?\/)?download\.js\1\s+defer><\/script>\r?\n?/gim,
      "",
    )
    .replace(/\s*<a\b(?=[^>]*\bbutton-download\b)[\s\S]*?<\/a>/gi, "")
    .replace(/\s*<a\b[^>]*href=(["'])\/downloads\/darkmesh\.ipa\1[^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/\s*<a\b[^>]*href=(["'])\/install\/ios\1[^>]*>[\s\S]*?<\/a>/gi, "");

  if (pruned !== html) {
    await writeFile(htmlPath, pruned);
  }
}

const guideStylesPath = path.join(rootDir, "guide", "styles.css");
if (existsSync(guideStylesPath)) {
  const styles = await readFile(guideStylesPath, "utf8");
  const prunedStyles = styles.replace(/\.button-download(?:\s+[^{]+)?\s*\{[^}]*\}\s*/g, "");

  if (prunedStyles !== styles) {
    await writeFile(guideStylesPath, prunedStyles);
  }
}

console.log(`Pruned mobile-only web assets in ${rootDir}`);
