import { describe, expect, it } from "vitest";
import { STORAGE_KEY, clearSettings, loadSettings, parseSettings, saveSettings, type Settings, type StorageLike } from "../src/settings";

const full: Settings = {
  data: "https://example.com", error: "Q", fg: "#112233", fg2: "#445566", gradient: "radial", bg: "#ffffff",
  transparent: true, eyeCustom: true, eyeColor: "#aa0000", moduleStyle: "dots", eyeStyle: "circle", border: 2,
  icon: "heart", logoColor: "#000000", logoBg: "#eeeeee", logoBgTouched: true, logoScale: 0.2, logoStroke: 1.5,
  printCm: 5, printDpi: 300, pngSize: 591,
};

function fakeStorage(initial?: string): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("parseSettings", () => {
  it("round-trips a full, valid settings object", () => {
    expect(parseSettings(JSON.stringify(full))).toEqual(full);
  });
  it("returns {} for missing, malformed or non-object input", () => {
    for (const raw of [null, "", "{nope", "42", "null", "[]", '"x"']) expect(parseSettings(raw)).toEqual({});
  });
  it("keeps valid fields and drops invalid ones", () => {
    const out = parseSettings(JSON.stringify({
      fg: "red", bg: "#abcdef", gradient: "spiral", moduleStyle: "dots", border: "4", icon: "../etc", transparent: "yes", data: 5,
    }));
    expect(out).toEqual({ bg: "#abcdef", moduleStyle: "dots" });
  });
  it("clamps numbers into range", () => {
    const out = parseSettings(JSON.stringify({ border: 99, logoScale: 5, logoStroke: 0, printCm: 9999, pngSize: 100000 }));
    expect(out).toEqual({ border: 10, logoScale: 0.28, logoStroke: 0.5, printCm: 500, pngSize: 4096 });
  });
  it("rejects non-finite numbers and unknown DPI", () => {
    expect(parseSettings('{"border":null,"printDpi":96,"pngSize":"1024"}')).toEqual({});
  });
  it("accepts a null icon (no logo) but not a malformed name", () => {
    expect(parseSettings('{"icon":null}')).toEqual({ icon: null });
    expect(parseSettings('{"icon":"Heart!"}')).toEqual({});
  });
  it("rejects over-long content", () => {
    expect(parseSettings(JSON.stringify({ data: "x".repeat(2001) }))).toEqual({});
  });
});

describe("storage helpers", () => {
  it("saves, loads and clears", () => {
    const s = fakeStorage();
    saveSettings(full, s);
    expect(loadSettings(s)).toEqual(full);
    clearSettings(s);
    expect(loadSettings(s)).toEqual({});
  });
  it("survives storage that throws or is missing", () => {
    const broken: StorageLike = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(loadSettings(broken)).toEqual({});
    expect(() => saveSettings(full, broken)).not.toThrow();
    expect(() => clearSettings(broken)).not.toThrow();
    expect(loadSettings(null)).toEqual({});
  });
});
