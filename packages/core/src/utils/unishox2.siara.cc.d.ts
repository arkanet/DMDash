declare module "unishox2.siara.cc" {
  export const USX_HCODES_DFLT: Uint8Array | number[];
  export const USX_HCODE_LENS_DFLT: Uint8Array | number[];
  export const USX_FREQ_SEQ_DFLT: string[];
  export const USX_TEMPLATES: Array<string | null>;

  export function unishox2_compress(
    input: Uint8Array | string,
    len: number,
    out: Uint8Array,
    hcodes: Uint8Array | number[],
    hcodeLens: Uint8Array | number[],
    freqSeq: string[],
    templates: Array<string | null>,
  ): number;

  export function unishox2_compress_simple(
    input: Uint8Array | string,
    len: number,
    out: Uint8Array,
  ): number;

  export function unishox2_decompress(
    input: Uint8Array,
    len: number,
    out: Uint8Array,
    hcodes: Uint8Array | number[],
    hcodeLens: Uint8Array | number[],
    freqSeq: string[],
    templates: Array<string | null>,
  ): number;
}
