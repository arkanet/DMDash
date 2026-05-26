import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");
const localesRoot = path.join(packageRoot, "public/i18n/locales");
const englishLocaleRoot = path.join(localesRoot, "en");
const i18nConfigPath = path.join(packageRoot, "src/i18n-config.ts");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function flattenLeafPaths(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenLeafPaths(item, `${prefix}[${index}]`));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, nestedValue]) =>
      flattenLeafPaths(nestedValue, prefix ? `${prefix}.${key}` : key),
    );
  }

  return prefix ? [prefix] : [];
}

export function readDeclaredLocaleCodes() {
  const content = fs.readFileSync(i18nConfigPath, "utf8");
  const match = content.match(/export const supportedLocaleCodes = \[([\s\S]*?)\] as const;/);

  if (!match?.[1]) {
    throw new Error("Unable to read supportedLocaleCodes from src/i18n-config.ts");
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g), ([, localeCode]) => localeCode);
}

function mergeLocaleValues(source, target, prefix = "") {
  if (!isPlainObject(source) || !isPlainObject(target)) {
    return {
      value: target,
      changed: false,
      missingPaths: [],
    };
  }

  const merged = {};
  let changed = false;
  const missingPaths = [];

  for (const [key, sourceValue] of Object.entries(source)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    if (!(key in target)) {
      merged[key] = cloneValue(sourceValue);
      changed = true;
      missingPaths.push(...flattenLeafPaths(sourceValue, nextPrefix));
      continue;
    }

    const targetValue = target[key];
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      const nested = mergeLocaleValues(sourceValue, targetValue, nextPrefix);
      merged[key] = nested.value;
      changed ||= nested.changed;
      missingPaths.push(...nested.missingPaths);
      continue;
    }

    merged[key] = targetValue;
  }

  for (const [key, targetValue] of Object.entries(target)) {
    if (!(key in source)) {
      merged[key] = targetValue;
    }
  }

  return {
    value: merged,
    changed,
    missingPaths,
  };
}

export function buildTranslationReport() {
  const localeCodes = readDeclaredLocaleCodes();
  const englishFiles = fs
    .readdirSync(englishLocaleRoot)
    .filter((file) => file.endsWith(".json"))
    .sort();
  const missingTranslations = [];
  const fileChanges = [];

  for (const localeCode of localeCodes) {
    if (localeCode === "en") {
      continue;
    }

    const localeRoot = path.join(localesRoot, localeCode);
    if (!fs.existsSync(localeRoot)) {
      missingTranslations.push(`${localeCode}: missing locale directory`);
      continue;
    }

    for (const fileName of englishFiles) {
      const englishFilePath = path.join(englishLocaleRoot, fileName);
      const localeFilePath = path.join(localeRoot, fileName);
      const englishJson = JSON.parse(fs.readFileSync(englishFilePath, "utf8"));

      if (!fs.existsSync(localeFilePath)) {
        const missingPaths = flattenLeafPaths(englishJson);
        missingTranslations.push(
          `${localeCode}/${fileName}: missing file (${missingPaths.length} keys)`,
        );
        fileChanges.push({
          localeCode,
          fileName,
          filePath: localeFilePath,
          nextValue: cloneValue(englishJson),
          missingPaths,
        });
        continue;
      }

      const localeJson = JSON.parse(fs.readFileSync(localeFilePath, "utf8"));
      const merged = mergeLocaleValues(englishJson, localeJson);
      if (merged.missingPaths.length === 0) {
        continue;
      }

      missingTranslations.push(
        `${localeCode}/${fileName}: missing ${merged.missingPaths.length} keys`,
      );
      fileChanges.push({
        localeCode,
        fileName,
        filePath: localeFilePath,
        nextValue: merged.value,
        missingPaths: merged.missingPaths,
      });
    }
  }

  return {
    localeCodes,
    missingTranslations,
    fileChanges,
  };
}

export function fixMissingTranslations() {
  const report = buildTranslationReport();

  for (const change of report.fileChanges) {
    fs.writeFileSync(change.filePath, `${JSON.stringify(change.nextValue, null, 2)}\n`);
  }

  return report;
}

function runCli() {
  const fixMode = process.argv.includes("--fix");
  const report = fixMode ? fixMissingTranslations() : buildTranslationReport();

  if (report.missingTranslations.length === 0) {
    console.log("All declared locale bundles are aligned with en.");
    return;
  }

  if (fixMode) {
    console.log(`Filled missing translations in ${report.fileChanges.length} locale files.`);
    return;
  }

  console.error("Missing translations detected:");
  report.missingTranslations.forEach((line) => console.error(`- ${line}`));
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli();
}
