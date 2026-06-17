#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ts = await import("typescript").then((module) => module.default ?? module);

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEVICE_IMAGE_COMPONENT = join(
  ROOT_DIR,
  "packages/web/src/components/generic/DeviceImage.tsx",
);
const DEVICE_ASSET_DIR = join(ROOT_DIR, "packages/web/public/devices");
const LOCAL_PROTO = join(ROOT_DIR, "packages/protobufs/meshtastic/mesh.proto");
const UPSTREAM_PROTO = join(
  ROOT_DIR,
  "external-sources/meshtastic-protobufs/meshtastic/mesh.proto",
);
const OUTPUT_FILE = join(ROOT_DIR, "docs/device-image-coverage.md");

const FALLBACK_OK_MODELS = new Set([
  "UNSET",
  "UNKNOWN",
  "PRIVATE_HW",
  "ANDROID_SIM",
  "PORTDUINO",
  "NRF52_UNKNOWN",
]);

const PRODUCER_HINTS = [
  [/^(HELTEC|HT62)/, "heltec.org"],
  [/^(TBEAM|T_DECK|T_ECHO|T_WATCH|TLORA|LILYGO|T_LORA)/, "lilygo.cc"],
  [/^(RAK|WISMESH)/, "rakwireless.com"],
  [/^(SEEED|WIO|TRACKER_T1000|SENSECAP|XIAO)/, "seeedstudio.com"],
  [/^M5STACK/, "m5stack.com"],
  [/^BETAFPV/, "betafpv.com"],
  [/^RADIOMASTER/, "radiomasterrc.com"],
  [/^(RP2040_LORA|ESP32_S3_PICO)/, "waveshare.com"],
  [/^(THINKNODE|CROWPANEL)/, "elecrow.com"],
  [/^SENSELORA/, "makerfabs.com"],
  [/^(NANO|STATION)/, "uniteng.com"],
  [/^CANARYONE/, "canaryradio.io"],
  [/^MESHLINK/, "loraitalia.it"],
  [/^NOMADSTAR/, "nomadstar.ch"],
  [/^UNPHONE/, "unphone.net"],
  [/^WIPHONE/, "wiphone.io"],
  [/^RP2040_FEATHER/, "adafruit.com"],
  [/^MS24SF1/, "minewsemi.com"],
  [/^ME25LS01/, "minewsemi.com"],
];

const FIRMWARE_SOURCES = [
  {
    id: "darkmesh-firmware-2.7.15-ghost",
    repoDir: "external-sources/darkmesh-firmware",
    refCandidates: ["origin/2.7.15-ghost", "2.7.15-ghost", "HEAD"],
    firmware: "DarkMesh",
  },
  {
    id: "darkmesh-firmware-2.7.21-ghost",
    repoDir: "external-sources/darkmesh-firmware",
    refCandidates: ["origin/2.7.21-ghost", "2.7.21-ghost"],
    firmware: "DarkMesh",
  },
  {
    id: "meshtastic-firmware-master",
    repoDir: "external-sources/meshtastic-firmware",
    refCandidates: ["origin/master", "master", "HEAD"],
    firmware: "Meshtastic",
  },
];

function parseArgs(argv) {
  const args = {
    format: "markdown",
    strict: false,
    write: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--strict") {
      args.strict = true;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "--json") {
      args.format = "json";
    } else if (arg === "--markdown") {
      args.format = "markdown";
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function usage() {
  return `Usage: node scripts/check-device-images.mjs [--strict] [--write] [--markdown|--json]

Compares the DeviceImage hardwareModel map against firmware HW_VENDOR declarations
from DarkMesh 2.7.15-ghost, DarkMesh 2.7.21-ghost, and Meshtastic firmware.

Options:
  --strict    exit non-zero when required mappings, assets, or sources are missing
  --write     write markdown report to docs/device-image-coverage.md
  --json      print machine-readable JSON
`;
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}

function toRepoPath(filePath) {
  return relative(ROOT_DIR, filePath).replaceAll("\\", "/");
}

function runGit(repoPath, args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 32,
  });

  if (result.status !== 0) {
    if (options.allowFailure) {
      return null;
    }

    const stderr = result.stderr.trim();
    throw new Error(`git ${args.join(" ")} failed in ${repoPath}: ${stderr}`);
  }

  return result.stdout;
}

function resolveGitRef(repoPath, candidates) {
  for (const ref of candidates) {
    const stdout = runGit(repoPath, ["rev-parse", "--verify", `${ref}^{commit}`], {
      allowFailure: true,
    });
    if (stdout) {
      return {
        ref,
        commit: stdout.trim(),
        shortCommit: runGit(repoPath, ["rev-parse", "--short", ref]).trim(),
      };
    }
  }

  return null;
}

function listFilesAtRef(repoPath, ref) {
  const stdout = runGit(repoPath, ["ls-tree", "-r", "--name-only", ref]);
  return stdout.split("\n").filter(Boolean);
}

function showFileAtRef(repoPath, ref, path) {
  return runGit(repoPath, ["show", `${ref}:${path}`], { allowFailure: true });
}

function extractDeviceImageMap(filePath) {
  const source = readText(filePath);
  const ast = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const entries = new Map();

  function propertyNameText(name) {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      return name.text;
    }

    return undefined;
  }

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "hardwareModelToFilename" &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }

        const key = propertyNameText(property.name);
        if (!key || !ts.isStringLiteralLike(property.initializer)) {
          continue;
        }

        const line = ast.getLineAndCharacterOfPosition(property.getStart(ast)).line + 1;
        entries.set(key, {
          model: key,
          filename: property.initializer.text,
          line,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(ast);

  if (entries.size === 0) {
    throw new Error(`No hardwareModelToFilename entries found in ${filePath}`);
  }

  return entries;
}

function extractUrls(text) {
  return [...text.matchAll(/https?:\/\/[^\s)]+/g)].map((match) => match[0].replace(/[.,;]+$/, ""));
}

function cleanCommentLine(line) {
  return line
    .replace(/^\s*\/\*\*?/, "")
    .replace(/\*\/\s*$/, "")
    .replace(/^\s*\*\s?/, "")
    .replace(/^\s*\/\/\s?/, "")
    .trim();
}

function parseProtoHardwareModels(protoText) {
  const models = new Map();
  const lines = protoText.split(/\r?\n/);
  let inEnum = false;
  let inBlockComment = false;
  let commentBuffer = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!inEnum) {
      if (/^enum\s+HardwareModel\s*\{/.test(trimmed)) {
        inEnum = true;
      }
      continue;
    }

    if (trimmed.startsWith("}")) {
      break;
    }

    if (inBlockComment) {
      commentBuffer.push(cleanCommentLine(line));
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    if (trimmed.startsWith("/*")) {
      commentBuffer.push(cleanCommentLine(line));
      if (!trimmed.includes("*/")) {
        inBlockComment = true;
      }
      continue;
    }

    if (trimmed.startsWith("//")) {
      commentBuffer.push(cleanCommentLine(line));
      continue;
    }

    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(\d+)\s*;/);
    if (match) {
      const comment = commentBuffer.filter(Boolean).join(" ").trim();
      models.set(match[1], {
        model: match[1],
        number: Number(match[2]),
        comment,
        urls: extractUrls(comment),
        line: index + 1,
      });
      commentBuffer = [];
      continue;
    }

    if (trimmed !== "") {
      commentBuffer = [];
    }
  }

  return models;
}

function parseGeneratedHardwareModels(headerText) {
  const models = new Map();
  const lines = headerText.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*meshtastic_HardwareModel_([A-Z0-9_]+)\s*=\s*(\d+),?/);
    if (match) {
      models.set(match[1], {
        model: match[1],
        number: Number(match[2]),
        line: index + 1,
      });
    }
  }

  return models;
}

function mergeModelMetadata(target, source) {
  for (const [model, metadata] of source) {
    const existing = target.get(model) ?? {};
    target.set(model, {
      ...metadata,
      ...existing,
      model,
      number: existing.number ?? metadata.number,
      comment: existing.comment ?? metadata.comment,
      urls: existing.urls ?? metadata.urls ?? [],
    });
  }
}

function collectFirmwareSource(source) {
  const repoPath = join(ROOT_DIR, source.repoDir);

  if (!existsSync(join(repoPath, ".git"))) {
    return {
      ...source,
      status: "missing",
      repoPath,
      models: new Map(),
      enumModels: new Map(),
      warnings: [`Missing repo: ${source.repoDir}. Run pnpm sync:upstreams.`],
    };
  }

  const resolved = resolveGitRef(repoPath, source.refCandidates);
  if (!resolved) {
    return {
      ...source,
      status: "missing-ref",
      repoPath,
      models: new Map(),
      enumModels: new Map(),
      warnings: [
        `Missing ref for ${source.id}: ${source.refCandidates.join(", ")}. Run pnpm sync:upstreams.`,
      ],
    };
  }

  const files = listFilesAtRef(repoPath, resolved.ref);
  const sourceFiles = files.filter(
    (path) => /^(src\/platform|variants)\//.test(path) && /\.(c|cc|cpp|h|hpp)$/.test(path),
  );
  const models = new Map();

  for (const file of sourceFiles) {
    const text = showFileAtRef(repoPath, resolved.ref, file);
    if (!text) {
      continue;
    }

    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index].match(
        /^\s*#\s*define\s+HW_VENDOR\s+meshtastic_HardwareModel_([A-Z0-9_]+)/,
      );
      if (!match) {
        continue;
      }

      const model = match[1];
      const existing = models.get(model) ?? {
        model,
        references: [],
      };
      existing.references.push({
        path: file,
        line: index + 1,
      });
      models.set(model, existing);
    }
  }

  const enumModels = new Map();
  const generatedHeader = showFileAtRef(
    repoPath,
    resolved.ref,
    "src/mesh/generated/meshtastic/mesh.pb.h",
  );
  if (generatedHeader) {
    mergeModelMetadata(enumModels, parseGeneratedHardwareModels(generatedHeader));
  }

  const firmwareProto = showFileAtRef(repoPath, resolved.ref, "protobufs/meshtastic/mesh.proto");
  if (firmwareProto) {
    mergeModelMetadata(enumModels, parseProtoHardwareModels(firmwareProto));
  }

  return {
    ...source,
    status: "ok",
    repoPath,
    ref: resolved.ref,
    commit: resolved.commit,
    shortCommit: resolved.shortCommit,
    models,
    enumModels,
    warnings: [],
  };
}

function collectLocalProtoModels() {
  if (!existsSync(LOCAL_PROTO)) {
    return new Map();
  }

  return parseProtoHardwareModels(readText(LOCAL_PROTO));
}

function collectUpstreamProtoModels() {
  if (!existsSync(UPSTREAM_PROTO)) {
    return new Map();
  }

  return parseProtoHardwareModels(readText(UPSTREAM_PROTO));
}

function collectAssetFiles() {
  if (!existsSync(DEVICE_ASSET_DIR)) {
    return new Set();
  }

  return new Set(
    readdirSync(DEVICE_ASSET_DIR)
      .filter((name) => statSync(join(DEVICE_ASSET_DIR, name)).isFile())
      .sort(),
  );
}

function producerHintFor(model, metadata) {
  if (metadata?.urls?.length) {
    return metadata.urls.join(", ");
  }

  for (const [pattern, domain] of PRODUCER_HINTS) {
    if (pattern.test(model)) {
      return domain;
    }
  }

  return "";
}

function firmwareSourceLabels(model, firmwareSources) {
  const labels = [];
  for (const source of firmwareSources) {
    if (source.models.has(model)) {
      labels.push(source.id);
    }
  }
  return labels;
}

function firstReferences(model, firmwareSources, limit = 2) {
  const refs = [];
  for (const source of firmwareSources) {
    const entry = source.models.get(model);
    if (!entry) {
      continue;
    }

    for (const ref of entry.references) {
      refs.push(`${source.id}:${ref.path}:${ref.line}`);
      if (refs.length >= limit) {
        return refs;
      }
    }
  }

  return refs;
}

function firmwareNumberDetails(model, firmwareSources) {
  const details = [];
  for (const source of firmwareSources) {
    if (!source.models.has(model)) {
      continue;
    }

    details.push({
      source: source.id,
      number: source.enumModels.get(model)?.number,
    });
  }
  return details;
}

function formatNumberDetails(details) {
  return details.map((detail) => `${detail.source}:${detail.number ?? "missing"}`).join(", ");
}

function buildReport() {
  const deviceMap = extractDeviceImageMap(DEVICE_IMAGE_COMPONENT);
  const assetFiles = collectAssetFiles();
  const localProtoModels = collectLocalProtoModels();
  const upstreamProtoModels = collectUpstreamProtoModels();
  const firmwareSources = FIRMWARE_SOURCES.map(collectFirmwareSource);
  const metadataByModel = new Map();

  mergeModelMetadata(metadataByModel, upstreamProtoModels);
  mergeModelMetadata(metadataByModel, localProtoModels);
  for (const source of firmwareSources) {
    mergeModelMetadata(metadataByModel, source.enumModels);
  }

  const firmwareModels = new Set();
  for (const source of firmwareSources) {
    for (const model of source.models.keys()) {
      firmwareModels.add(model);
    }
  }

  const localProtoModelsByNumber = new Map();
  for (const [model, metadata] of localProtoModels) {
    if (metadata.number === undefined) {
      continue;
    }

    const models = localProtoModelsByNumber.get(metadata.number) ?? [];
    models.push(model);
    localProtoModelsByNumber.set(metadata.number, models);
  }

  const requiredFirmwareModels = [...firmwareModels]
    .filter((model) => !FALLBACK_OK_MODELS.has(model))
    .sort();
  const missingMappings = requiredFirmwareModels
    .filter((model) => !deviceMap.has(model))
    .map((model) => ({
      model,
      number: metadataByModel.get(model)?.number,
      sources: firmwareSourceLabels(model, firmwareSources),
      references: firstReferences(model, firmwareSources),
      producerHint: producerHintFor(model, metadataByModel.get(model)),
    }));

  const fallbackOnlyModels = [...firmwareModels]
    .filter((model) => FALLBACK_OK_MODELS.has(model) && !deviceMap.has(model))
    .sort();

  const missingAssets = [...deviceMap.values()]
    .filter((entry) => !assetFiles.has(entry.filename))
    .map((entry) => ({
      model: entry.model,
      filename: entry.filename,
      line: entry.line,
    }));

  const firmwareModelsMissingFromSourceEnum = [];
  const firmwareNumberConflicts = [];
  const localProtoNumberMismatches = [];

  for (const model of requiredFirmwareModels) {
    const details = firmwareNumberDetails(model, firmwareSources);
    const missingSourceEnums = details
      .filter((detail) => detail.number === undefined)
      .map((detail) => detail.source);

    if (missingSourceEnums.length > 0) {
      firmwareModelsMissingFromSourceEnum.push({
        model,
        sources: missingSourceEnums,
        allSources: firmwareSourceLabels(model, firmwareSources),
      });
    }

    const definedNumbers = [
      ...new Set(details.map((detail) => detail.number).filter((number) => number !== undefined)),
    ].sort((a, b) => a - b);

    if (definedNumbers.length > 1) {
      firmwareNumberConflicts.push({
        model,
        numbers: definedNumbers,
        details,
      });
    }

    for (const number of definedNumbers) {
      const localModels = localProtoModelsByNumber.get(number) ?? [];
      if (localModels.includes(model)) {
        continue;
      }

      localProtoNumberMismatches.push({
        model,
        number,
        localModels,
        sources: details
          .filter((detail) => detail.number === number)
          .map((detail) => detail.source),
      });
    }
  }

  const localProtoMissingMappings = [...localProtoModels.keys()]
    .filter((model) => !FALLBACK_OK_MODELS.has(model) && !deviceMap.has(model))
    .sort((a, b) => {
      const aNum = localProtoModels.get(a)?.number ?? Number.MAX_SAFE_INTEGER;
      const bNum = localProtoModels.get(b)?.number ?? Number.MAX_SAFE_INTEGER;
      return aNum - bNum || a.localeCompare(b);
    })
    .map((model) => ({
      model,
      number: localProtoModels.get(model)?.number,
      firmwareSources: firmwareSourceLabels(model, firmwareSources),
      producerHint: producerHintFor(model, metadataByModel.get(model)),
    }));

  const mappedModelsNotDeclaredByFirmware = [...deviceMap.keys()]
    .filter((model) => !firmwareModels.has(model) && model !== "UNKNOWN")
    .sort()
    .map((model) => ({
      model,
      filename: deviceMap.get(model).filename,
      line: deviceMap.get(model).line,
    }));

  const mappedAssetFiles = new Set([...deviceMap.values()].map((entry) => entry.filename));
  const unusedAssetFiles = [...assetFiles].filter((file) => !mappedAssetFiles.has(file)).sort();

  const sourceWarnings = firmwareSources.flatMap((source) => source.warnings);
  const failures = [
    ...sourceWarnings,
    ...missingMappings.map((entry) => `Missing DeviceImage mapping: ${entry.model}`),
    ...missingAssets.map((entry) => `Missing device asset: ${entry.filename}`),
    ...firmwareModelsMissingFromSourceEnum.map(
      (entry) => `Firmware HW_VENDOR missing from firmware enum: ${entry.model}`,
    ),
    ...firmwareNumberConflicts.map(
      (entry) => `Firmware HW_VENDOR has conflicting enum numbers: ${entry.model}`,
    ),
    ...localProtoNumberMismatches.map(
      (entry) => `Firmware/local protobuf HardwareModel mismatch: ${entry.model}=${entry.number}`,
    ),
  ];

  return {
    generatedAt: new Date().toISOString(),
    paths: {
      deviceImageComponent: toRepoPath(DEVICE_IMAGE_COMPONENT),
      deviceAssetDir: toRepoPath(DEVICE_ASSET_DIR),
      localProto: toRepoPath(LOCAL_PROTO),
      upstreamProto: existsSync(UPSTREAM_PROTO) ? toRepoPath(UPSTREAM_PROTO) : null,
    },
    summary: {
      mappedModels: deviceMap.size,
      deviceAssets: assetFiles.size,
      firmwareDeclaredModels: firmwareModels.size,
      requiredFirmwareModels: requiredFirmwareModels.length,
      missingMappings: missingMappings.length,
      missingAssets: missingAssets.length,
      firmwareModelsMissingFromSourceEnum: firmwareModelsMissingFromSourceEnum.length,
      firmwareNumberConflicts: firmwareNumberConflicts.length,
      localProtoNumberMismatches: localProtoNumberMismatches.length,
      localProtoMissingMappings: localProtoMissingMappings.length,
      mappedModelsNotDeclaredByFirmware: mappedModelsNotDeclaredByFirmware.length,
      unusedAssetFiles: unusedAssetFiles.length,
    },
    sources: firmwareSources.map((source) => ({
      id: source.id,
      firmware: source.firmware,
      status: source.status,
      ref: source.ref,
      shortCommit: source.shortCommit,
      declaredModels: source.models.size,
      enumModels: source.enumModels.size,
      warnings: source.warnings,
    })),
    missingMappings,
    fallbackOnlyModels,
    missingAssets,
    firmwareModelsMissingFromSourceEnum,
    firmwareNumberConflicts,
    localProtoNumberMismatches,
    localProtoMissingMappings,
    mappedModelsNotDeclaredByFirmware,
    unusedAssetFiles,
    failures,
  };
}

function table(headers, rows) {
  const escapeCell = (value) => {
    const text = value === undefined || value === null || value === "" ? "-" : String(value);
    return text.replaceAll("\n", " ").replaceAll("|", "\\|");
  };

  return [
    `| ${headers.map(escapeCell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ].join("\n");
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# Device Image Coverage Report");
  lines.push("");
  lines.push(`Generated at ${report.generatedAt} from the local DMDash workspace.`);
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`- DeviceImage map: \`${report.paths.deviceImageComponent}\``);
  lines.push(`- Device assets: \`${report.paths.deviceAssetDir}\``);
  lines.push(`- Local protobuf enum: \`${report.paths.localProto}\``);
  if (report.paths.upstreamProto) {
    lines.push(`- Upstream protobuf enum: \`${report.paths.upstreamProto}\``);
  }
  lines.push("");
  lines.push("## Source Snapshot");
  lines.push("");
  lines.push(
    table(
      ["Source", "Firmware", "Status", "Ref", "Commit", "Declared HW_VENDOR", "Enum values"],
      report.sources.map((source) => [
        source.id,
        source.firmware,
        source.status,
        source.ref ?? "-",
        source.shortCommit ?? "-",
        source.declaredModels,
        source.enumModels,
      ]),
    ),
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(
    table(
      ["Metric", "Count"],
      [
        ["DeviceImage mappings", report.summary.mappedModels],
        ["Device asset files", report.summary.deviceAssets],
        ["Firmware-declared hardware models", report.summary.firmwareDeclaredModels],
        ["Required firmware models", report.summary.requiredFirmwareModels],
        ["Missing DeviceImage mappings", report.summary.missingMappings],
        ["Mappings pointing to missing files", report.summary.missingAssets],
        [
          "Firmware HW_VENDOR missing from firmware enum",
          report.summary.firmwareModelsMissingFromSourceEnum,
        ],
        ["Firmware enum number conflicts", report.summary.firmwareNumberConflicts],
        [
          "Firmware/local protobuf number-name mismatches",
          report.summary.localProtoNumberMismatches,
        ],
        [
          "Local protobuf models without DeviceImage mapping",
          report.summary.localProtoMissingMappings,
        ],
        [
          "Mapped models not declared by inspected firmware",
          report.summary.mappedModelsNotDeclaredByFirmware,
        ],
        ["Unused asset files", report.summary.unusedAssetFiles],
      ],
    ),
  );
  lines.push("");

  if (report.sources.some((source) => source.warnings.length > 0)) {
    lines.push("## Source Warnings");
    lines.push("");
    for (const source of report.sources) {
      for (const warning of source.warnings) {
        lines.push(`- ${source.id}: ${warning}`);
      }
    }
    lines.push("");
  }

  lines.push("## Missing Firmware DeviceImage Mappings");
  lines.push("");
  if (report.missingMappings.length === 0) {
    lines.push("No required firmware-declared hardware models are missing from DeviceImage.");
  } else {
    lines.push(
      table(
        ["HardwareModel", "Number", "Firmware sources", "Source reference", "Producer/source hint"],
        report.missingMappings.map((entry) => [
          entry.model,
          entry.number,
          entry.sources.join(", "),
          entry.references.join(", "),
          entry.producerHint,
        ]),
      ),
    );
  }
  lines.push("");

  lines.push("## Firmware/Local Protobuf Wire Compatibility");
  lines.push("");

  if (
    report.firmwareModelsMissingFromSourceEnum.length === 0 &&
    report.firmwareNumberConflicts.length === 0 &&
    report.localProtoNumberMismatches.length === 0
  ) {
    lines.push(
      "All required firmware-declared hardware models have matching local protobuf names and numbers.",
    );
  }

  if (report.firmwareModelsMissingFromSourceEnum.length > 0) {
    lines.push("Firmware HW_VENDOR names missing from that source's generated HardwareModel enum:");
    lines.push("");
    lines.push(
      table(
        ["HardwareModel", "Missing in source enum", "Declared by sources"],
        report.firmwareModelsMissingFromSourceEnum.map((entry) => [
          entry.model,
          entry.sources.join(", "),
          entry.allSources.join(", "),
        ]),
      ),
    );
    lines.push("");
  }

  if (report.firmwareNumberConflicts.length > 0) {
    lines.push("Firmware sources disagree on HardwareModel wire numbers:");
    lines.push("");
    lines.push(
      table(
        ["HardwareModel", "Numbers", "Source details"],
        report.firmwareNumberConflicts.map((entry) => [
          entry.model,
          entry.numbers.join(", "),
          formatNumberDetails(entry.details),
        ]),
      ),
    );
    lines.push("");
  }

  if (report.localProtoNumberMismatches.length > 0) {
    lines.push("Firmware wire numbers resolve to different names in the local protobuf enum:");
    lines.push("");
    lines.push(
      table(
        ["Firmware HardwareModel", "Number", "Local protobuf name", "Firmware sources"],
        report.localProtoNumberMismatches.map((entry) => [
          entry.model,
          entry.number,
          entry.localModels.join(", "),
          entry.sources.join(", "),
        ]),
      ),
    );
    lines.push("");
  }

  lines.push("## Mappings With Missing Asset Files");
  lines.push("");
  if (report.missingAssets.length === 0) {
    lines.push("Every DeviceImage mapping points to an existing file.");
  } else {
    lines.push(
      table(
        ["HardwareModel", "Filename", "DeviceImage line"],
        report.missingAssets.map((entry) => [entry.model, entry.filename, entry.line]),
      ),
    );
  }
  lines.push("");

  lines.push("## Research Queue");
  lines.push("");
  if (report.missingMappings.length === 0) {
    lines.push("No missing firmware image mappings need producer-site research.");
  } else {
    lines.push(
      "For each missing model, prefer an official producer image with a front/top board view. Use SVG when available; otherwise choose a suitable official raster image for later conversion.",
    );
    lines.push("");
    lines.push(
      table(
        ["HardwareModel", "Producer/source hint", "Target asset note"],
        report.missingMappings.map((entry) => [
          entry.model,
          entry.producerHint,
          `${entry.model.toLowerCase().replaceAll("_", "-")}.svg candidate`,
        ]),
      ),
    );
  }
  lines.push("");

  lines.push("## Local Protobuf Models Without DeviceImage Mapping");
  lines.push("");
  if (report.localProtoMissingMappings.length === 0) {
    lines.push(
      "Every local protobuf HardwareModel has a DeviceImage mapping or approved fallback.",
    );
  } else {
    lines.push(
      table(
        ["HardwareModel", "Number", "Firmware sources", "Producer/source hint"],
        report.localProtoMissingMappings.map((entry) => [
          entry.model,
          entry.number,
          entry.firmwareSources.join(", "),
          entry.producerHint,
        ]),
      ),
    );
  }
  lines.push("");

  lines.push("## Approved Generic Fallbacks");
  lines.push("");
  if (report.fallbackOnlyModels.length === 0) {
    lines.push("No inspected firmware models rely only on approved generic fallback handling.");
  } else {
    lines.push(report.fallbackOnlyModels.map((model) => `- \`${model}\``).join("\n"));
  }
  lines.push("");

  lines.push("## Mapped Models Not Declared By Inspected Firmware");
  lines.push("");
  if (report.mappedModelsNotDeclaredByFirmware.length === 0) {
    lines.push("All mapped models are declared by at least one inspected firmware source.");
  } else {
    lines.push(
      table(
        ["HardwareModel", "Filename", "DeviceImage line"],
        report.mappedModelsNotDeclaredByFirmware.map((entry) => [
          entry.model,
          entry.filename,
          entry.line,
        ]),
      ),
    );
  }
  lines.push("");

  lines.push("## Unused Device Asset Files");
  lines.push("");
  if (report.unusedAssetFiles.length === 0) {
    lines.push("No extra device asset files are currently unused by DeviceImage.");
  } else {
    lines.push(report.unusedAssetFiles.map((file) => `- \`${file}\``).join("\n"));
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(usage());
  process.exit(0);
}

const report = buildReport();

if (args.write) {
  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, renderMarkdown(report));
  console.log(`Device image coverage report written to ${toRepoPath(OUTPUT_FILE)}`);
} else if (args.format === "json") {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderMarkdown(report));
}

if (args.strict && report.failures.length > 0) {
  process.exitCode = 1;
}
