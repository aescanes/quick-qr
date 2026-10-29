/** Embed print resolution in a PNG so other apps open it at the right physical size. */

const SIGNATURE_LENGTH = 8;
const IHDR_CHUNK_LENGTH = 25; // 4 length + 4 type + 13 data + 4 crc

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Return a copy of `png` with a `pHYs` chunk set to `dpi`, inserted right after IHDR.
 * Expects a PNG without an existing pHYs chunk (what canvas.toBlob produces).
 */
export function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.length < SIGNATURE_LENGTH + IHDR_CHUNK_LENGTH || sig.some((b, i) => png[i] !== b)) {
    throw new Error("Not a PNG file");
  }
  const ppm = Math.round(dpi / 0.0254); // pixels per metre

  const chunk = new Uint8Array(21); // 4 length + 4 type + 9 data + 4 crc
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  const at = SIGNATURE_LENGTH + IHDR_CHUNK_LENGTH;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, at), 0);
  out.set(chunk, at);
  out.set(png.subarray(at), at + chunk.length);
  return out;
}
