/**
 * Persist the user's settings in localStorage. DOM-free: everything read from storage is
 * validated field by field, so a corrupted or outdated entry never breaks the page.
 */
import { ERROR_LEVELS, EYE_STYLES, GRADIENTS, MAX_DATA_LENGTH, MAX_LOGO_SCALE, MODULE_STYLES } from "./render";
import { MAX_PNG_PX } from "./print";

/** Bump the suffix when the shape changes incompatibly; old entries are then ignored. */
export const STORAGE_KEY = "quickqr:settings:v1";
export const DPI_CHOICES = [72, 150, 300, 600] as const;

export interface Settings {
  data: string;
  error: (typeof ERROR_LEVELS)[number];
  fg: string;
  fg2: string;
  gradient: (typeof GRADIENTS)[number];
  bg: string;
  transparent: boolean;
  eyeCustom: boolean;
  eyeColor: string;
  moduleStyle: (typeof MODULE_STYLES)[number];
  eyeStyle: (typeof EYE_STYLES)[number];
  border: number;
  /** Lucide icon name, or null for no logo. */
  icon: string | null;
  logoColor: string;
  logoBg: string;
  /** True once the user picked the logo backing color themselves (stops it following the background). */
  logoBgTouched: boolean;
  logoScale: number;
  logoStroke: number;
  printCm: number;
  printDpi: (typeof DPI_CHOICES)[number];
  pngSize: number;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const ICON_RE = /^[a-z0-9][a-z0-9-]*$/;

const oneOf = <T extends readonly unknown[]>(list: T, v: unknown): v is T[number] => list.includes(v);
const num = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;

/** Parse a stored JSON string into the valid subset of Settings. Never throws. */
export function parseSettings(raw: string | null): Partial<Settings> {
  let obj: Record<string, unknown>;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    obj = parsed;
  } catch {
    return {};
  }

  const out: Partial<Settings> = {};
  const color = (k: "fg" | "fg2" | "bg" | "eyeColor" | "logoColor" | "logoBg") => {
    if (typeof obj[k] === "string" && COLOR_RE.test(obj[k] as string)) out[k] = obj[k] as string;
  };
  const bool = (k: "transparent" | "eyeCustom" | "logoBgTouched") => {
    if (typeof obj[k] === "boolean") out[k] = obj[k] as boolean;
  };
  const range = (k: "border" | "logoScale" | "logoStroke" | "printCm", lo: number, hi: number) => {
    const n = num(obj[k], lo, hi);
    if (n !== undefined) out[k] = n;
  };

  if (typeof obj.data === "string" && obj.data.length <= MAX_DATA_LENGTH) out.data = obj.data;
  if (oneOf(ERROR_LEVELS, obj.error)) out.error = obj.error;
  if (oneOf(GRADIENTS, obj.gradient)) out.gradient = obj.gradient;
  if (oneOf(MODULE_STYLES, obj.moduleStyle)) out.moduleStyle = obj.moduleStyle;
  if (oneOf(EYE_STYLES, obj.eyeStyle)) out.eyeStyle = obj.eyeStyle;
  if (oneOf(DPI_CHOICES, obj.printDpi)) out.printDpi = obj.printDpi;
  if (obj.icon === null || (typeof obj.icon === "string" && ICON_RE.test(obj.icon))) out.icon = obj.icon as string | null;
  for (const k of ["fg", "fg2", "bg", "eyeColor", "logoColor", "logoBg"] as const) color(k);
  for (const k of ["transparent", "eyeCustom", "logoBgTouched"] as const) bool(k);
  range("border", 0, 10);
  range("logoScale", 0.05, MAX_LOGO_SCALE);
  range("logoStroke", 0.5, 4);
  range("printCm", 0.5, 500);
  const png = num(obj.pngSize, 64, MAX_PNG_PX);
  if (png !== undefined) out.pngSize = Math.round(png);
  return out;
}

/** The browser's localStorage, or null when unavailable (private mode, blocked, non-browser). */
export function getStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // accessing localStorage can throw when site data is blocked
  }
}

export function loadSettings(storage: StorageLike | null = getStorage()): Partial<Settings> {
  try {
    return parseSettings(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return {};
  }
}

export function saveSettings(settings: Settings, storage: StorageLike | null = getStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded or storage disabled: settings just won't persist.
  }
}

export function clearSettings(storage: StorageLike | null = getStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
