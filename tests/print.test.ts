import { crc32 as nodeCrc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32, withPngDpi } from "../src/png";
import { cmToPx, dotMm, pxToCm } from "../src/print";

// 1x1 transparent PNG
const PNG_1X1 = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

describe("print maths", () => {
  it("converts pixels to centimeters", () => {
    expect(pxToCm(1024, 300)).toBeCloseTo(8.67, 2);
    expect(pxToCm(256, 300)).toBeCloseTo(2.17, 2);
    expect(pxToCm(4096, 72)).toBeCloseTo(144.5, 1);
  });
  it("converts centimeters to pixels, rounding up", () => {
    expect(cmToPx(5, 300)).toBe(591);
    expect(cmToPx(2.54, 300)).toBe(300);
    expect(pxToCm(cmToPx(5, 300), 300)).toBeGreaterThanOrEqual(5);
  });
  it("computes dot size from the full image width", () => {
    expect(dotMm(5, 37)).toBeCloseTo(1.35, 2);
  });
});

describe("withPngDpi", () => {
  const out = withPngDpi(PNG_1X1, 300);
  const view = new DataView(out.buffer);

  it("inserts a valid pHYs chunk right after IHDR", () => {
    expect(out.length).toBe(PNG_1X1.length + 21);
    expect(view.getUint32(33)).toBe(9);
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe("pHYs");
    expect(view.getUint32(41)).toBe(11811); // 300 DPI in pixels per metre
    expect(view.getUint32(45)).toBe(11811);
    expect(out[49]).toBe(1);
    expect(view.getUint32(50)).toBe(nodeCrc32(out.subarray(37, 50)));
  });
  it("leaves the rest of the file untouched", () => {
    expect(out.subarray(0, 33)).toEqual(PNG_1X1.subarray(0, 33));
    expect(out.subarray(54)).toEqual(PNG_1X1.subarray(33));
  });
  it("crc32 matches node's", () => {
    expect(crc32(PNG_1X1)).toBe(nodeCrc32(PNG_1X1));
  });
  it("rejects non-PNG input", () => {
    expect(() => withPngDpi(new Uint8Array(100), 300)).toThrow("Not a PNG");
  });
});
