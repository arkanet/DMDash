#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicOrigin = process.env.DARKMESH_PUBLIC_ORIGIN ?? "https://dmdash.arkantiko.com";
const ipaPath = path.join(repoRoot, "packages/web/public/downloads/darkmesh.ipa");
const outputPath = path.join(repoRoot, "packages/web/public/altstore/source.json");
const projectPath = path.join(repoRoot, "packages/mobile/ios/App/App.xcodeproj/project.pbxproj");

function readBuildSetting(projectText, key, fallback) {
  const match = projectText.match(new RegExp(`${key}\\s*=\\s*([^;]+);`));
  return match?.[1]?.trim() ?? fallback;
}

function publicUrl(pathname) {
  return new URL(pathname, publicOrigin).href;
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

const source = {
  name: "DarkMesh",
  subtitle: "DarkMesh app for iOS builds from DMDash",
  description: "DarkMesh packages the DMDash dashboard in an iPhone shell with native Bluetooth LE support.",
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
          downloadURL: publicUrl("/downloads/darkmesh.ipa"),
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
