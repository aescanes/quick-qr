/** Pixel <-> centimeter maths for printing. Pure functions, no DOM. */

export const CM_PER_INCH = 2.54;
/** Largest PNG the app exports (canvas limit we are comfortable with). */
export const MAX_PNG_PX = 4096;
/** Dots smaller than this (mm) get unreliable to scan with a phone. */
export const MIN_DOT_MM = 0.3;

export const pxToCm = (px: number, dpi: number) => (px / dpi) * CM_PER_INCH;
/** Pixels needed to print `cm` wide at `dpi` (rounded up so it never prints smaller). */
export const cmToPx = (cm: number, dpi: number) => Math.ceil((cm / CM_PER_INCH) * dpi);
/** Size in mm of one QR module when the whole image (margin included) is `cm` wide. */
export const dotMm = (cm: number, totalModules: number) => (cm * 10) / totalModules;
