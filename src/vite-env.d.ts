/// <reference types="vite/client" />

// upng-js ships no types. Minimal declarations for what we use.
declare module 'upng-js' {
  export interface UPNGImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: unknown[];
    tabs: Record<string, unknown>;
    data: Uint8Array;
  }
  /**
   * Encode RGBA frames to PNG bytes.
   * @param imgs array of RGBA pixel buffers (one per frame)
   * @param w width
   * @param h height
   * @param cnum number of colours for lossy quantisation; 0 = lossless
   */
  export function encode(
    imgs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
  ): ArrayBuffer;
  export function decode(buffer: ArrayBuffer): UPNGImage;
  export function toRGBA8(img: UPNGImage): ArrayBuffer[];
  const _default: {
    encode: typeof encode;
    decode: typeof decode;
    toRGBA8: typeof toRGBA8;
  };
  export default _default;
}
