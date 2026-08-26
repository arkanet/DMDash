#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ipaPath = path.join(repoRoot, "packages/web/public/downloads/darkmesh.ipa");
const outputPath = path.join(repoRoot, "packages/web/public/altstore/source.json");
const projectPath = path.join(repoRoot, "packages/mobile/ios/App/App.xcodeproj/project.pbxproj");

function normalizeOrigin(origin) {
  const value = origin?.trim().replace(/\/+$/g, "");
  if (!value) {
    return undefined;
  }
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function firstOrigin(...names) {
  for (const name of names) {
    const origin = normalizeOrigin(process.env[name]);
    if (origin) {
      return origin;
    }
  }
  return "https://dmdash.vercel.app";
}

const publicOrigin = firstOrigin(
  "DARKMESH_PUBLIC_ORIGIN",
  "DARKMESH_PUBLIC_BASE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_URL",
);

function readBuildSetting(projectText, key, fallback) {
  const match = projectText.match(new RegExp(`${key}\\s*=\\s*([^;]+);`));
  return match?.[1]?.trim() ?? fallback;
}

function publicUrl(pathname) {
  return new URL(pathname, publicOrigin).href;
}

function firstUrl(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function getLocalDateString(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

const [ipaBuffer, projectText] = await Promise.all([
  readFile(ipaPath),
  readFile(projectPath, "utf8").catch(() => ""),
]);
const ipaStats = await stat(ipaPath);
const sha256 = createHash("sha256").update(ipaBuffer).digest("hex");
const bundleIdentifier = readBuildSetting(
  projectText,
  "PRODUCT_BUNDLE_IDENTIFIER",
  "org.darkmesh.dmdash",
);
const version = readBuildSetting(projectText, "MARKETING_VERSION", "1.0");
const buildVersion = readBuildSetting(projectText, "CURRENT_PROJECT_VERSION", "1");
const today = getLocalDateString();
const ipaDownloadUrl =
  firstUrl("DARKMESH_IPA_DOWNLOAD_URL", "DARKMESH_IOS_IPA_DOWNLOAD_URL") ??
  publicUrl("/downloads/darkmesh.ipa");

const source = {
  name: "DarkMesh",
  subtitle: "DarkMesh app for iOS builds from DMDash",
  description:
    "DarkMesh packages the DMDash dashboard in an iPhone shell with native Bluetooth LE support.",
  website: publicUrl("/"),
  iconURL: publicUrl("/darkmesh-logo.png"),
  tintColor: "#0f5a42",
  featuredApps: [bundleIdentifier],
  apps: [
    {
      name: "DarkMesh",
      bundleIdentifier,
      developerName: "arkanet",
      subtitle: "DMDash with native iOS BLE",
      localizedDescription:
        "DMDash dashboard packaged as an iOS app with native Bluetooth LE support.",
      iconURL: publicUrl("/darkmesh-logo.png"),
      tintColor: "#0f5a42",
      category: "utilities",
      versions: [
        {
          version,
          buildVersion,
          date: today,
          localizedDescription: "Current DarkMesh app for iOS build.",
          downloadURL: ipaDownloadUrl,
          size: ipaStats.size,
          sha256,
        },
      ],
    },
  ],
  news: [],
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(source, null, 2)}\n`);
JSON.parse(await readFile(outputPath, "utf8"));

console.log(`Generated ${outputPath}`);
console.log(`IPA size: ${ipaStats.size}`);
console.log(`IPA sha256: ${sha256}`);
