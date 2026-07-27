import * as unishox2 from "unishox2.siara.cc";

const MAX_TEXT_BYTES = 256;
const MAX_DECOMPRESSED_BYTES = 512;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

export interface MeshTextCompressionResult {
  payload: Uint8Array<ArrayBuffer>;
  originalBytes: number;
  compressedBytes: number;
  savedBytes: number;
}

function runWithoutUnishoxLogs<T>(callback: () => T): T {
  const originalLog = console.log;
  console.log = () => undefined;

  try {
    return callback();
  } finally {
    console.log = originalLog;
  }
}

function byteLengthFromUnishoxResult(written: number) {
  return Math.ceil(written);
}

function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    return textDecoder.decode(bytes);
  } catch {
    return undefined;
  }
}

function hasUnsupportedControlChars(text: string) {
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      codePoint < 0x20 &&
      codePoint !== 0x09 &&
      codePoint !== 0x0a &&
      codePoint !== 0x0d
    ) {
      return true;
    }
  }

  return false;
}

function isLikelyPlainTextPayload(payload: Uint8Array) {
  const text = decodeUtf8(payload);

  return text !== undefined && !hasUnsupportedControlChars(text);
}

function compressBytes(input: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  if (input.length === 0 || input.length > MAX_TEXT_BYTES) {
    return undefined;
  }

  const out: Uint8Array<ArrayBuffer> = new Uint8Array(Math.max(input.length * 2 + 32, 64));
  const written = byteLengthFromUnishoxResult(
    runWithoutUnishoxLogs(() =>
      unishox2.unishox2_compress(
        input,
        input.length,
        out,
        unishox2.USX_HCODES_DFLT,
        unishox2.USX_HCODE_LENS_DFLT,
        unishox2.USX_FREQ_SEQ_DFLT,
        unishox2.USX_TEMPLATES,
      ),
    ),
  );

  if (written <= 0 || written > out.length) {
    return undefined;
  }

  return out.slice(0, written);
}

function decompressBytes(input: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  if (input.length === 0 || input.length > MAX_TEXT_BYTES) {
    return undefined;
  }

  const out: Uint8Array<ArrayBuffer> = new Uint8Array(MAX_DECOMPRESSED_BYTES);
  const written = unishox2.unishox2_decompress(
    input,
    input.length,
    out,
    unishox2.USX_HCODES_DFLT,
    unishox2.USX_HCODE_LENS_DFLT,
    unishox2.USX_FREQ_SEQ_DFLT,
    unishox2.USX_TEMPLATES,
  );

  if (written <= 0 || written > out.length) {
    return undefined;
  }

  return out.slice(0, written);
}

export function compressTextForMesh(text: string): MeshTextCompressionResult | undefined {
  const original = textEncoder.encode(text);
  const compressed = compressBytes(original);

  if (!compressed || compressed.length >= original.length) {
    return undefined;
  }

  return {
    payload: compressed,
    originalBytes: original.length,
    compressedBytes: compressed.length,
    savedBytes: original.length - compressed.length,
  };
}

export function decompressTextFromMesh(payload: Uint8Array): string | undefined {
  if (isLikelyPlainTextPayload(payload)) {
    return undefined;
  }

  const decompressed = decompressBytes(payload);

  if (!decompressed) {
    return undefined;
  }

  const text = decodeUtf8(decompressed);

  if (text === undefined || hasUnsupportedControlChars(text)) {
    return undefined;
  }

  const roundTrip = compressBytes(decompressed);
  if (!roundTrip || decompressBytes(roundTrip) === undefined) {
    return undefined;
  }

  return text;
}
