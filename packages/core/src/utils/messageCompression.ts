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

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function compressBytes(input: Uint8Array): Uint8Array<ArrayBuffer> | undefined {
  if (input.length === 0 || input.length > MAX_TEXT_BYTES) {
    return undefined;
  }

  const out: Uint8Array<ArrayBuffer> = new Uint8Array(Math.max(input.length * 2 + 32, 64));
  const written = byteLengthFromUnishoxResult(
    runWithoutUnishoxLogs(() => unishox2.unishox2_compress_simple(input, input.length, out)),
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

  const decompressed = out.slice(0, written);
  const roundTrip = compressBytes(decompressed);

  if (!roundTrip || !equalBytes(input, roundTrip)) {
    return undefined;
  }

  return decompressed;
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
  const decompressed = decompressBytes(payload);

  if (!decompressed) {
    return undefined;
  }

  try {
    return textDecoder.decode(decompressed);
  } catch {
    return undefined;
  }
}
