/**
 * Turn text into a styled SVG QR code.
 *
 * The QR matrix comes from `uqr`; everything visual (module shapes, finder
 * "eyes", gradients, logo) is drawn here so the output is a single scalable SVG.
 */
import { encode } from "uqr";

export const MODULE_STYLES = ["square", "rounded", "dots", "diamond", "vertical", "horizontal"] as const;
export const EYE_STYLES = ["square", "rounded", "circle"] as const;
export const GRADIENTS = ["none", "horizontal", "vertical", "diagonal", "radial"] as const;
export const ERROR_LEVELS = ["L", "M", "Q", "H"] as const;

export type ModuleStyle = (typeof MODULE_STYLES)[number];
export type EyeStyle = (typeof EYE_STYLES)[number];
export type Gradient = (typeof GRADIENTS)[number];
export type ErrorLevel = (typeof ERROR_LEVELS)[number];

export const MAX_LOGO_SCALE = 0.28; // fraction of QR width; beyond this scanning gets unreliable
export const MAX_DATA_LENGTH = 2000;

export interface Options {
  data: string;
  error: ErrorLevel;
  fg: string;
  fg2: string;
  gradient: Gradient;
  bg: string;
  transparent: boolean;
  eyeColor: string | null;
  moduleStyle: ModuleStyle;
  eyeStyle: EyeStyle;
  border: number;
  /** Lucide icon name, e.g. "heart". */
  logo: string | null;
  /** Inner SVG markup of the logo icon (24x24 viewBox); required when `logo` is set. */
  logoSvg: string | null;
  logoColor: string | null;
  logoScale: number;
  logoBg: string | null; // null -> same as background
  logoStroke: number;
  size: number;
}

export const DEFAULTS: Options = {
  data: "",
  error: "M",
  fg: "#000000",
  fg2: "#6d28d9",
  gradient: "none",
  bg: "#ffffff",
  transparent: false,
  eyeColor: null,
  moduleStyle: "square",
  eyeStyle: "square",
  border: 4,
  logo: null,
  logoSvg: null,
  logoColor: null,
  logoScale: 0.22,
  logoBg: null,
  logoStroke: 2,
  size: 512,
};

export interface RenderInfo {
  version: number;
  modules: number;
  error: ErrorLevel;
}

export class QRError extends Error {}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Validate and normalise user options (clamps numbers, rejects bad enums/colors). */
export function normalize(partial: Partial<Options>): Options {
  const o: Options = { ...DEFAULTS, ...partial };
  if (typeof o.data !== "string" || !o.data.trim()) throw new QRError("Enter some text or a URL.");
  if (o.data.length > MAX_DATA_LENGTH) throw new QRError(`Content is too long (max ${MAX_DATA_LENGTH} characters).`);
  const enums: [string, readonly string[], string][] = [
    ["error", ERROR_LEVELS, o.error],
    ["moduleStyle", MODULE_STYLES, o.moduleStyle],
    ["eyeStyle", EYE_STYLES, o.eyeStyle],
    ["gradient", GRADIENTS, o.gradient],
  ];
  for (const [name, allowed, value] of enums) {
    if (!allowed.includes(value)) throw new QRError(`${name} must be one of ${allowed.join(", ")}`);
  }
  for (const [name, value] of [["fg", o.fg], ["fg2", o.fg2], ["bg", o.bg], ["eyeColor", o.eyeColor],
    ["logoColor", o.logoColor], ["logoBg", o.logoBg]] as const) {
    if (value != null && !COLOR_RE.test(value)) throw new QRError(`${name} must be a #rrggbb color`);
  }
  if (o.logo && !o.logoSvg) throw new QRError(`Unknown icon: ${o.logo}`);
  o.border = clamp(Math.round(Number(o.border)), 0, 10);
  o.size = clamp(Math.round(Number(o.size)), 64, 4096);
  o.logoScale = clamp(Number(o.logoScale), 0.05, MAX_LOGO_SCALE);
  o.logoStroke = clamp(Number(o.logoStroke), 0.5, 4);
  if ([o.border, o.size, o.logoScale, o.logoStroke].some(Number.isNaN)) {
    throw new QRError("border, size, logoScale and logoStroke must be numbers");
  }
  return o;
}

const f = (x: number) => String(+x.toFixed(3));

function modulePath(style: ModuleStyle, x: number, y: number): string {
  switch (style) {
    case "square":
      return `M${x} ${y}h1v1h-1z`;
    case "rounded": {
      const r = 0.32, s = f(1 - 2 * r);
      return `M${f(x + r)} ${y}h${s}a${r} ${r} 0 0 1 ${r} ${r}v${s}a${r} ${r} 0 0 1 -${r} ${r}h-${s}` +
        `a${r} ${r} 0 0 1 -${r} -${r}v-${s}a${r} ${r} 0 0 1 ${r} -${r}z`;
    }
    case "dots": {
      const r = 0.46;
      return `M${f(x + 0.5 - r)} ${f(y + 0.5)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 -${f(2 * r)} 0z`;
    }
    case "diamond":
      return `M${f(x + 0.5)} ${y}l.5 .5l-.5 .5l-.5 -.5z`;
    default:
      throw new Error(style);
  }
}

function barPath(x: number, y: number, w: number, h: number): string {
  const r = (w < h ? w : h) / 2;
  if (w < h) { // vertical pill
    return `M${f(x)} ${f(y + r)}a${f(r)} ${f(r)} 0 0 1 ${f(w)} 0v${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 1 -${f(w)} 0z`;
  }
  return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 0 ${f(h)}h-${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 0 -${f(h)}z`;
}

/** Closed rounded-rect subpath (clockwise). */
function rrect(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h-${f(w)}z`;
  return `M${f(x + r)} ${f(y)}h${f(w - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}` +
    `v${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 1 -${f(r)} ${f(r)}h-${f(w - 2 * r)}` +
    `a${f(r)} ${f(r)} 0 0 1 -${f(r)} -${f(r)}v-${f(h - 2 * r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} -${f(r)}z`;
}

const EYE_RADII: Record<EyeStyle, [number, number, number]> = {
  square: [0, 0, 0],
  rounded: [2, 1.2, 0.9],
  circle: [3.5, 2.5, 1.5],
};

/** Finder pattern at (x, y): 7x7 ring (evenodd hole 5x5) plus 3x3 center. */
function eyePath(style: EyeStyle, x: number, y: number): string {
  const [out, inn, dot] = EYE_RADII[style];
  return rrect(x, y, 7, 7, out) + rrect(x + 1, y + 1, 5, 5, inn) + rrect(x + 2, y + 2, 3, 3, dot);
}

/** Runs of dark modules along rows ("h") or columns ("v"). */
function* runs(matrix: boolean[][], skip: (x: number, y: number) => boolean, axis: "h" | "v") {
  const n = matrix.length;
  for (let a = 0; a < n; a++) {
    let start = -1;
    for (let b = 0; b <= n; b++) {
      const [x, y] = axis === "h" ? [b, a] : [a, b];
      const on = b < n && matrix[y][x] && !skip(x, y);
      if (on && start < 0) start = b;
      else if (!on && start >= 0) {
        yield (axis === "h" ? [start, a, b - start] : [a, start, b - start]) as [number, number, number];
        start = -1;
      }
    }
  }
}

const escapeAttr = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderSvg(input: Partial<Options>): { svg: string; info: RenderInfo } {
  const opts = normalize(input);
  const error: ErrorLevel = opts.logo ? "H" : opts.error;

  let result;
  try {
    result = encode(opts.data, { ecc: error, border: 0, boostEcc: false });
  } catch {
    throw new QRError("Content is too long for a QR code at this error-correction level.");
  }
  const matrix = result.data;
  const n = matrix.length;
  const b = opts.border;
  const total = n + 2 * b;
  const eyes: [number, number][] = [[0, 0], [n - 7, 0], [0, n - 7]];

  const inEye = (x: number, y: number) => eyes.some(([ex, ey]) => x >= ex && x < ex + 7 && y >= ey && y < ey + 7);

  // Logo geometry (module units, relative to matrix origin).
  const logoBox = opts.logo ? opts.logoScale * n : 0;
  const logoBgSize = logoBox * 1.3;
  const cx = n / 2, cy = n / 2, half = logoBgSize / 2;
  const inLogo = (x: number, y: number) =>
    !!opts.logo && x + 1 > cx - half && x < cx + half && y + 1 > cy - half && y < cy + half;
  const skip = (x: number, y: number) => inEye(x, y) || inLogo(x, y);

  // Data modules
  const parts: string[] = [];
  if (opts.moduleStyle === "vertical" || opts.moduleStyle === "horizontal") {
    const axis = opts.moduleStyle === "vertical" ? "v" : "h";
    for (const [x, y, len] of runs(matrix, skip, axis)) {
      parts.push(axis === "v" ? barPath(x + 0.1, y + 0.02, 0.8, len - 0.04) : barPath(x + 0.02, y + 0.1, len - 0.04, 0.8));
    }
  } else {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (matrix[y][x] && !skip(x, y)) parts.push(modulePath(opts.moduleStyle, x, y));
      }
    }
  }
  const eyesD = eyes.map(([x, y]) => eyePath(opts.eyeStyle, x, y)).join("");

  // Fills
  let defs = "";
  let fill = opts.fg;
  if (opts.gradient !== "none") {
    const coords = {
      horizontal: 'x1="0" y1="0" x2="1" y2="0"',
      vertical: 'x1="0" y1="0" x2="0" y2="1"',
      diagonal: 'x1="0" y1="0" x2="1" y2="1"',
    } as const;
    const stops = `<stop offset="0" stop-color="${opts.fg}"/><stop offset="1" stop-color="${opts.fg2}"/>`;
    defs = opts.gradient === "radial"
      ? `<radialGradient id="qrg" cx="0.5" cy="0.5" r="0.7">${stops}</radialGradient>`
      : `<linearGradient id="qrg" ${coords[opts.gradient]}>${stops}</linearGradient>`;
    fill = "url(#qrg)";
  }
  const eyeFill = opts.eyeColor ?? fill;

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${opts.size}" height="${opts.size}" shape-rendering="geometricPrecision">`,
  ];
  if (defs) out.push(`<defs>${defs}</defs>`);
  if (!opts.transparent) out.push(`<rect width="${total}" height="${total}" fill="${opts.bg}"/>`);
  out.push(`<g transform="translate(${b} ${b})">`);
  if (parts.length) out.push(`<path d="${parts.join("")}" fill="${fill}"/>`);
  out.push(`<path d="${eyesD}" fill="${eyeFill}" fill-rule="evenodd"/>`);

  if (opts.logo && opts.logoSvg) {
    const pad = opts.logoBg ?? (opts.transparent ? "#ffffff" : opts.bg);
    out.push(`<path d="${rrect(cx - half, cy - half, logoBgSize, logoBgSize, logoBgSize * 0.22)}" fill="${pad}"/>`);
    const color = opts.logoColor ?? opts.fg;
    out.push(
      `<g transform="translate(${f(cx - logoBox / 2)} ${f(cy - logoBox / 2)}) scale(${f(logoBox / 24)})" ` +
      `fill="none" stroke="${escapeAttr(color)}" stroke-width="${f(opts.logoStroke)}" ` +
      `stroke-linecap="round" stroke-linejoin="round">${opts.logoSvg}</g>`,
    );
  }
  out.push("</g></svg>");

  return { svg: out.join(""), info: { version: result.version, modules: n, error } };
}
