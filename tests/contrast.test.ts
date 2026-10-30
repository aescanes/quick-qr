import { describe, expect, it } from "vitest";
import { contrastRatio, contrastWarning, mixHex } from "../src/contrast";

describe("contrast", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
  it("mixes colors", () => {
    expect(mixHex("#000000", "#ffffff")).toBe("#808080");
  });
  it("is silent for dark on light", () => {
    expect(contrastWarning(["#12141a"], "#ffffff", false)).toBeNull();
  });
  it("warns when an ink is lighter than the background", () => {
    expect(contrastWarning(["#ffffff"], "#12141a", false)).toMatch(/lighter than the background/);
  });
  it("warns on low contrast with the worst ratio", () => {
    expect(contrastWarning(["#12141a", "#888888"], "#ffffff", false)).toMatch(/^Low contrast \(3\.5:1\)/);
  });
  it("checks against white when transparent", () => {
    expect(contrastWarning(["#ffffff"], "#000000", true)).toMatch(/Checked against white/);
  });
});
