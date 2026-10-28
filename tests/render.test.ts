import { describe, expect, it } from "vitest";
import { DOMParser } from "@xmldom/xmldom";
import icons from "../src/generated/icons.json";
import { EYE_STYLES, GRADIENTS, MODULE_STYLES, MAX_LOGO_SCALE, QRError, normalize, renderSvg, type Options } from "../src/render";

const iconMap = icons as Record<string, string>;

function svgFor(opts: Partial<Options> = {}) {
  const logo = opts.logo ?? null;
  const r = renderSvg({ data: "https://example.com", logoSvg: logo ? iconMap[logo] : null, ...opts });
  const errors: string[] = [];
  new DOMParser({ onError: (_l, m) => errors.push(m) }).parseFromString(r.svg, "image/svg+xml");
  expect(errors).toEqual([]); // must be well-formed XML
  return r;
}

describe("renderSvg", () => {
  for (const moduleStyle of MODULE_STYLES) {
    for (const eyeStyle of EYE_STYLES) {
      it(`renders ${moduleStyle} dots with ${eyeStyle} eyes`, () => {
        const { svg, info } = svgFor({ moduleStyle, eyeStyle });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(info.modules).toBeGreaterThanOrEqual(21);
      });
    }
  }

  for (const gradient of GRADIENTS) {
    it(`gradient ${gradient}`, () => {
      expect(svgFor({ gradient }).svg.includes("url(#qrg)")).toBe(gradient !== "none");
    });
  }

  it("forces high error correction with a logo and embeds the icon", () => {
    const { svg, info } = svgFor({ logo: "heart", error: "L" });
    expect(info.error).toBe("H");
    expect(svg).toContain("stroke-linecap");
    expect(svg).toContain('d="M2 9.5a5.5');
  });

  it("removes modules under the logo", () => {
    const plain = svgFor({ error: "H" }).svg;
    const withLogo = svgFor({ logo: "heart" }).svg;
    expect(withLogo.length).not.toBe(plain.length);
  });

  it("omits the background rect when transparent", () => {
    expect(svgFor({ transparent: true }).svg).not.toContain("<rect");
    expect(svgFor().svg).toContain("<rect");
  });

  it("renders a sample of every bundled icon", () => {
    const names = Object.keys(iconMap);
    expect(names.length).toBeGreaterThan(1000);
    for (const name of names.filter((_, i) => i % 25 === 0)) svgFor({ logo: name });
  });

  it("is deterministic", () => {
    expect(svgFor({ moduleStyle: "dots" }).svg).toBe(svgFor({ moduleStyle: "dots" }).svg);
  });
});

describe("validation", () => {
  const bad: [string, Partial<Options>][] = [
    ["empty data", { data: "" }],
    ["bad color", { data: "x", fg: "red" }],
    ["bad module style", { data: "x", moduleStyle: "nope" as never }],
    ["unknown icon", { data: "x", logo: "does-not-exist", logoSvg: null }],
    ["too long", { data: "x".repeat(5000) }],
    ["bad error level", { data: "x", error: "Z" as never }],
    ["NaN border", { data: "x", border: NaN }],
  ];
  for (const [name, opts] of bad) {
    it(`rejects ${name}`, () => {
      expect(() => renderSvg(opts)).toThrow(QRError);
    });
  }

  it("clamps the logo scale", () => {
    expect(normalize({ data: "x", logoScale: 5 }).logoScale).toBe(MAX_LOGO_SCALE);
  });
  it("escapes the icon color attribute", () => {
    expect(() => renderSvg({ data: "x", logo: "heart", logoSvg: "<path/>", logoColor: '"><script>' })).toThrow(QRError);
  });
});
