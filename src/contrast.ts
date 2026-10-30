/** WCAG contrast helpers and the scan-contrast warning. Pure functions, no DOM. */

export const MIN_CONTRAST = 4;

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Relative luminance of a `#RRGGBB` color. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Midpoint of two `#RRGGBB` colors, lowercase. */
export function mixHex(a: string, b: string): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const mid = (s: number) => Math.round((((x >> s) & 255) + ((y >> s) & 255)) / 2);
  return "#" + ((mid(16) << 16) | (mid(8) << 8) | mid(0)).toString(16).padStart(6, "0");
}

/** Warning text for the inks in use against the background, or null when the pairing is fine. */
export function contrastWarning(inks: string[], bg: string, transparent: boolean): string | null {
  const ground = transparent ? "#ffffff" : bg;
  const note = transparent ? " (Checked against white, since the background is transparent.)" : "";
  if (inks.some((ink) => luminance(ink) > luminance(ground))) {
    return "The dots are lighter than the background. Many scanner apps only read dark-on-light codes, so test it before printing." + note;
  }
  const worst = Math.min(...inks.map((ink) => contrastRatio(ink, ground)));
  if (worst < MIN_CONTRAST) {
    return `Low contrast (${worst.toFixed(1)}:1). Some phones may struggle to scan this; aim for at least ${MIN_CONTRAST}:1.` + note;
  }
  return null;
}
