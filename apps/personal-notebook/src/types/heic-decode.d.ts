declare module 'heic-decode' {
  interface DecodedImage {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  }
  /** Decodes the primary image of a HEIC/HEIF file to RGBA pixels. */
  export default function decode(input: {
    buffer: Uint8Array;
  }): Promise<DecodedImage>;
}
