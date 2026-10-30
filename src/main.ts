import "./style.css";
import { QRError, renderSvg, type Options } from "./render";
import { withPngDpi } from "./png";
import { MAX_PNG_PX, MIN_DOT_MM, cmToPx, dotMm, pxToCm } from "./print";
import { saveFile, svgToPng } from "./save";
import { clearSettings, loadSettings, saveSettings, type Settings } from "./settings";
import { contrastWarning, mixHex } from "./contrast";

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;

// --- state -----------------------------------------------------------------
/** Every control's value lives here; the DOM is only a view of it (see syncUi). */
const s: Settings = {
  data: "https://aescanes.github.io/quick-qr/", error: "M",
  fg: "#12141a", fg2: "#3355ff", gradient: "none",
  bg: "#ffffff", transparent: false,
  eyeCustom: false, eyeColor: "#3355ff",
  moduleStyle: "square", eyeStyle: "square", border: 4,
  icon: null, logoColor: "#12141a", logoBg: "#ffffff", logoColorMatch: true, logoBgMatch: true,
  logoScale: 0.22, logoStroke: 2,
  printCm: 5, printDpi: 300, pngSize: 1024,
};
const view = { printActive: false, svg: "", totalModules: 0, names: [] as string[], icons: {} as Record<string, string>, tags: {} as Record<string, string> };

const ERROR_NAMES = { L: "Low", M: "Medium", Q: "Quartile", H: "High" } as const;
const DOT_PRESETS: [string, string][] = [["Ink", "#12141A"], ["Signal blue", "#3355FF"], ["Forest", "#0F6B4F"], ["Plum", "#6B2D8C"], ["Ember", "#C2410C"]];
const BG_PRESETS: [string, string][] = [["White", "#FFFFFF"], ["Light grey", "#F4F5F7"], ["Cream", "#FFF8EC"], ["Mint", "#EAF6F0"], ["Ice blue", "#EEF1FF"]];
const STARTER_ICONS = ["link", "globe", "wifi", "mail", "phone", "smartphone", "message-circle", "send", "map-pin", "house", "user", "heart", "star", "smile", "calendar", "clock", "bell", "camera", "video", "play", "music", "shopping-cart", "shopping-bag", "credit-card", "ticket", "gift", "coffee", "utensils", "briefcase", "file-text", "book-open", "download", "lock", "key", "info", "circle-check", "zap", "leaf", "lightbulb", "rocket"];
const PAGE = 120;
const HEX_RE = /^#[0-9a-f]{6}$/i;

// --- derived colors ----------------------------------------------------------
const dotsMid = () => (s.gradient === "none" ? s.fg : mixHex(s.fg, s.fg2));
const logoInk = () => (s.logoColorMatch ? dotsMid() : s.logoColor);
const logoBadge = () => (s.logoBgMatch ? (s.transparent ? "#ffffff" : s.bg) : s.logoBg);
const eyeInk = () => (s.eyeCustom ? s.eyeColor : s.fg);

function options(): Partial<Options> {
  const svg = s.icon ? view.icons[s.icon] : undefined;
  return {
    data: s.data, error: s.error,
    fg: s.fg, fg2: s.fg2, gradient: s.gradient, bg: s.bg, transparent: s.transparent,
    eyeColor: s.eyeCustom ? s.eyeColor : null,
    moduleStyle: s.moduleStyle, eyeStyle: s.eyeStyle, border: s.border,
    logo: svg ? s.icon : null, logoSvg: svg ?? null,
    logoColor: logoInk(), logoBg: logoBadge(), logoScale: s.logoScale, logoStroke: s.logoStroke,
    size: 1024,
  };
}

// --- rendering -----------------------------------------------------------------
function render() {
  persist();
  try {
    const { svg, info } = renderSvg(options());
    view.svg = svg;
    $("frame").innerHTML = svg;
    $("error-msg").hidden = true;
    view.totalModules = info.modules + 2 * s.border;
    $("meta").textContent = `${info.modules} × ${info.modules} modules · ${ERROR_NAMES[info.error]} error correction`;
    $<HTMLButtonElement>("dl-svg").disabled = $<HTMLButtonElement>("dl-png").disabled = false;
  } catch (e) {
    if (!(e instanceof QRError)) throw e;
    view.svg = "";
    $("frame").innerHTML = "";
    $("error-msg").textContent = e.message;
    $("error-msg").hidden = false;
    $("meta").textContent = "";
    $<HTMLButtonElement>("dl-svg").disabled = $<HTMLButtonElement>("dl-png").disabled = true;
  }
  updatePrint();
}

let timer: number;
/** A control changed: refresh the view now, redraw the QR code shortly. */
function update() {
  syncUi();
  clearTimeout(timer);
  timer = window.setTimeout(render, 60);
}

// --- persistence (localStorage) ----------------------------------------------
let resetting = false; // set while "Reset settings" reloads the page, so pagehide doesn't re-save
const persist = () => {
  if (!resetting) saveSettings(s);
};

function applySettings(saved: Partial<Settings>) {
  Object.assign(s, saved);
  // The sliders are narrower than what older versions stored.
  s.border = Math.min(s.border, 8);
  s.logoScale = Math.max(s.logoScale, 0.1);
  s.logoStroke = Math.max(s.logoStroke, 1);
}

// --- pill groups -----------------------------------------------------------------
function bindPills(id: string, get: () => string, set: (v: string) => void, disabled?: (v: string) => boolean) {
  const group = $(id);
  group.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-value]");
    if (b && !b.disabled) {
      set(b.dataset.value!);
      update();
    }
  });
  return () =>
    group.querySelectorAll<HTMLButtonElement>("button[data-value]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.value === get()));
      if (disabled) b.disabled = disabled(b.dataset.value!);
    });
}

// --- color rows --------------------------------------------------------------------
type ColorKey = "fg" | "fg2" | "bg" | "eyeColor" | "logoColor" | "logoBg";
interface RowDef {
  label: () => string;
  key: ColorKey;
  presets: [string, string][];
  /** The color the row shows; differs from s[key] while a "match" toggle is on. */
  shown?: () => string;
  /** `locks`: while on, the row is dimmed and disabled (Transparent). Otherwise it is a "match" toggle:
   *  the row stays editable, picking a color switches matching off, and clicking the toggle matches again. */
  toggle?: { label: string; on: () => boolean; set: (on: boolean) => void; locks?: boolean };
}

function colorRow(def: RowDef) {
  const el = document.createElement("div");
  el.className = "crow";
  const name = def.label().replace(/ \(start\)$/, "");
  el.innerHTML = `
    <div class="lbl"></div>
    <div class="ctl">
      <input type="color" aria-label="${name} color">
      <input type="text" class="hex" aria-label="${name} hex code" maxlength="7" spellcheck="false">
    </div>
    <div class="swatches" role="group" aria-label="${name} presets">
      ${def.presets.map(([n, hex]) => `<button type="button" class="sw" aria-label="${n}" title="${n}" aria-pressed="false" data-hex="${hex}"><span style="background:${hex}"></span></button>`).join("")}
    </div>
    ${def.toggle ? `<button type="button" class="pill toggle" aria-pressed="false">${def.toggle.label}</button>` : ""}`;
  const picker = el.querySelector<HTMLInputElement>("input[type=color]")!;
  const hex = el.querySelector<HTMLInputElement>(".hex")!;
  const toggle = el.querySelector<HTMLButtonElement>(".toggle");

  const apply = (v: string) => {
    if (def.toggle && !def.toggle.locks && def.toggle.on()) def.toggle.set(false);
    s[def.key] = v.toLowerCase();
    hex.removeAttribute("aria-invalid");
    update();
  };
  picker.addEventListener("input", () => apply(picker.value));
  hex.addEventListener("input", () => {
    const v = hex.value.trim().startsWith("#") ? hex.value.trim() : "#" + hex.value.trim();
    if (HEX_RE.test(v)) apply(v);
    else hex.setAttribute("aria-invalid", "true"); // keep the draft; nothing is applied until it is valid
  });
  hex.addEventListener("blur", () => {
    hex.removeAttribute("aria-invalid");
    sync();
  });
  el.querySelectorAll<HTMLButtonElement>(".sw").forEach((b) => b.addEventListener("click", () => apply(b.dataset.hex!)));
  toggle?.addEventListener("click", () => {
    const t = def.toggle!;
    // Switching off keeps the color currently shown, so nothing jumps.
    if (t.on()) s[def.key] = (def.shown ?? (() => s[def.key]))();
    t.set(!t.on());
    update();
  });

  function sync() {
    el.querySelector(".lbl")!.textContent = def.label();
    const color = (def.shown ? def.shown() : s[def.key]).toLowerCase();
    const dim = !!def.toggle?.locks && def.toggle.on();
    picker.value = color;
    if (hex.getAttribute("aria-invalid") !== "true") hex.value = color.toUpperCase();
    for (const input of [picker, hex]) input.disabled = dim;
    el.classList.toggle("dim", dim);
    el.querySelectorAll<HTMLButtonElement>(".sw").forEach((b) => {
      b.disabled = dim;
      b.setAttribute("aria-pressed", String(b.dataset.hex!.toLowerCase() === color));
    });
    toggle?.setAttribute("aria-pressed", String(!!def.toggle?.on()));
  }
  return { el, sync };
}

const rows = {
  main: [
    colorRow({ label: () => (s.gradient === "none" ? "Dots" : "Dots (start)"), key: "fg", presets: DOT_PRESETS }),
    colorRow({ label: () => "Background", key: "bg", presets: BG_PRESETS, toggle: { label: "Transparent", on: () => s.transparent, set: (on) => (s.transparent = on), locks: true } }),
    colorRow({
      label: () => "Corner eyes", key: "eyeColor", presets: DOT_PRESETS, shown: eyeInk,
      toggle: { label: "Match dots", on: () => !s.eyeCustom, set: (on) => (s.eyeCustom = !on) },
    }),
  ],
  grad: colorRow({ label: () => "End color", key: "fg2", presets: DOT_PRESETS }),
  logo: [
    colorRow({
      label: () => "Icon color", key: "logoColor", presets: DOT_PRESETS, shown: logoInk,
      toggle: { label: "Match dots", on: () => s.logoColorMatch, set: (on) => (s.logoColorMatch = on) },
    }),
    colorRow({
      label: () => "Badge", key: "logoBg", presets: BG_PRESETS, shown: logoBadge,
      toggle: { label: "Match background", on: () => s.logoBgMatch, set: (on) => (s.logoBgMatch = on) },
    }),
  ],
};
$("color-rows").append(...rows.main.map((r) => r.el));
$("grad-row").append(rows.grad.el);
$("logo-rows").append(...rows.logo.map((r) => r.el));

const syncPills = [
  bindPills("dots", () => s.moduleStyle, (v) => (s.moduleStyle = v as Settings["moduleStyle"])),
  bindPills("eyes", () => s.eyeStyle, (v) => (s.eyeStyle = v as Settings["eyeStyle"])),
  bindPills("gradient", () => s.gradient, (v) => (s.gradient = v as Settings["gradient"])),
  bindPills("ec", () => (s.icon ? "H" : s.error), (v) => (s.error = v as Settings["error"]), (v) => !!s.icon && v !== "H"),
  bindPills("png-sizes", () => String(s.pngSize), (v) => { s.pngSize = +v; view.printActive = false; }),
];

// --- sliders and text -------------------------------------------------------------
function bindRange(id: string, get: () => number, set: (v: number) => void) {
  $(id).addEventListener("input", () => {
    set(+$(id).value);
    update();
  });
  return () => {
    $(id).value = String(get());
  };
}
const syncRanges = [
  bindRange("border", () => s.border, (v) => (s.border = v)),
  bindRange("logoScale", () => Math.round(s.logoScale * 100), (v) => (s.logoScale = v / 100)),
  bindRange("logoStroke", () => s.logoStroke, (v) => (s.logoStroke = v)),
];
$("data").addEventListener("input", () => {
  s.data = $("data").value;
  update();
});

// --- syncing the view ---------------------------------------------------------------
function syncUi() {
  for (const r of [...rows.main, rows.grad, ...rows.logo]) r.sync();
  syncPills.forEach((f) => f());
  syncRanges.forEach((f) => f());
  if (document.activeElement !== $("data")) $("data").value = s.data;

  $("border-out").textContent = `${s.border} dots`;
  $("logoScale-out").textContent = `${Math.round(s.logoScale * 100)}%`;
  $("logoStroke-out").textContent = String(s.logoStroke);
  $("grad-row").hidden = s.gradient === "none";
  $("logo-opts").hidden = !s.icon;
  $("logo-name").textContent = s.icon ?? "";
  $("ec-hint").hidden = !s.icon;
  $("size-warn").hidden = s.logoScale <= 0.25;
  $("icon-clear").setAttribute("aria-pressed", String(!s.icon));
  $("icon-grid").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.name === s.icon)));

  const inks = [s.fg, ...(s.gradient === "none" ? [] : [s.fg2]), ...(s.eyeCustom ? [s.eyeColor] : [])];
  const warning = contrastWarning(inks, s.bg, s.transparent);
  $("contrast-warn").hidden = !warning;
  $("contrast-warn").querySelector("span")!.textContent = warning ?? "";

  $("dl-png-label").textContent = `Download PNG · ${s.pngSize} px`;
}

// --- icon picker ---------------------------------------------------------------------
let matches: string[] = [];
let shownCount = 0;

function iconButton(name: string) {
  const b = document.createElement("button");
  b.type = "button";
  b.title = name;
  b.dataset.name = name;
  b.setAttribute("aria-label", `${name} icon`);
  b.setAttribute("aria-pressed", String(name === s.icon));
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${view.icons[name]}</svg>`;
  return b;
}

function renderIcons() {
  const query = $("icon-search").value.trim().toLowerCase();
  const total = view.names.length;
  if (!query) {
    matches = STARTER_ICONS.filter((n) => view.icons[n]);
    $("icon-count").textContent = `Showing ${matches.length} of ${total} icons. Type to find the rest.`;
  } else {
    const slug = query.replace(/\s+/g, "-");
    const byName = view.names.filter((n) => n.includes(slug));
    const named = new Set(byName);
    const byTag = view.names.filter((n) => !named.has(n) && view.tags[n]?.includes(query));
    matches = [...byName, ...byTag];
    const n = matches.length;
    $("icon-count").textContent = `${n} icon${n === 1 ? "" : "s"} match${n === 1 ? "es" : ""} “${$("icon-search").value.trim()}”.`;
  }
  $("icon-empty").hidden = matches.length > 0 || !total;
  $("icon-empty").textContent = `No icons match “${$("icon-search").value.trim()}”. Try a simpler word, like heart or phone.`;
  $("icon-scroll").hidden = matches.length === 0;
  $("icon-grid").replaceChildren();
  $("icon-scroll").scrollTop = 0;
  shownCount = 0;
  appendIcons();
}

/** Render matches in pages so a broad search stays fast. */
function appendIcons() {
  const next = matches.slice(shownCount, shownCount + PAGE);
  $("icon-grid").append(...next.map(iconButton));
  shownCount += next.length;
}

$("icon-scroll").addEventListener("scroll", () => {
  const el = $("icon-scroll");
  if (shownCount < matches.length && el.scrollTop + el.clientHeight > el.scrollHeight - 200) appendIcons();
});
$("icon-grid").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-name]");
  if (!b) return;
  s.icon = b.dataset.name!;
  update();
});
$("icon-clear").addEventListener("click", () => {
  s.icon = null;
  update();
});
$("icon-search").addEventListener("input", renderIcons);

// --- print size ----------------------------------------------------------------------------
const fmtCm = (cm: number) => String(+cm.toFixed(1));

function updatePrint() {
  persist();
  const { printCm: cm, printDpi: dpi, pngSize: png } = s;
  // Width and resolution show "-" while the PNG size was picked from the pills instead.
  if (document.activeElement !== $("print-cm")) $("print-cm").value = view.printActive ? String(cm) : ""; // don't fight typing
  $("print-dpi").value = view.printActive ? String(dpi) : "";
  const need = cmToPx(cm, dpi);
  if (view.printActive && !(cm > 0)) {
    $("print-note").textContent = "Enter a width in cm.";
    return;
  }
  if (view.printActive && need > MAX_PNG_PX) {
    $("print-note").textContent = `${fmtCm(cm)} cm at ${dpi} DPI needs ${need} px, above the ${MAX_PNG_PX} px limit. Use SVG or a lower DPI.`;
    return;
  }
  let note = `The selected PNG (${png} px) prints ${fmtCm(pxToCm(png, dpi))} cm wide at ${dpi} DPI.`;
  if (view.printActive && view.totalModules) {
    const dot = dotMm(cm, view.totalModules);
    note += ` At ${fmtCm(cm)} cm each dot is about ${dot.toFixed(2)} mm.`;
    if (dot < MIN_DOT_MM) note += " Too small to scan reliably: print larger or shorten the content.";
  }
  $("print-note").textContent = note;
}

/** Width or resolution changed: the PNG size follows, as long as it fits the export limit. */
function printChanged() {
  view.printActive = true;
  if (s.printCm > 0 && cmToPx(s.printCm, s.printDpi) <= MAX_PNG_PX) s.pngSize = cmToPx(s.printCm, s.printDpi);
  update();
}
$("print-cm").addEventListener("input", () => {
  s.printCm = +$("print-cm").value;
  printChanged();
});
$("print-dpi").addEventListener("input", () => {
  if (!$("print-dpi").value) return;
  s.printDpi = +$("print-dpi").value as Settings["printDpi"];
  printChanged();
});

// --- saving ------------------------------------------------------------------------------------
async function guard(task: () => Promise<void>) {
  try {
    await task();
  } catch (e) {
    $("error-msg").textContent = e instanceof Error ? e.message : String(e);
    $("error-msg").hidden = false;
  }
}
$("dl-svg").addEventListener("click", () =>
  guard(() => saveFile("QuickQR.svg", new Blob([view.svg], { type: "image/svg+xml" }))),
);
$("dl-png").addEventListener("click", () =>
  guard(async () => {
    const size = s.pngSize;
    const png = new Uint8Array(await (await svgToPng(view.svg, size)).arrayBuffer());
    // Embed the chosen DPI so Word, Canva, etc. open the file at its real print size.
    const bytes = withPngDpi(png, s.printDpi);
    await saveFile(`QuickQR-${size}.png`, new Blob([bytes as BlobPart], { type: "image/png" }));
  }),
);

// --- theme -----------------------------------------------------------------------------------------
const THEME_KEY = "quickqr-theme";
const ICON_MOON = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
const ICON_SUN = '<svg class="ic" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-15.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : darkQuery.matches;
};
function syncTheme() {
  const dark = isDark();
  $("theme-icon").innerHTML = dark ? ICON_SUN : ICON_MOON;
  $("theme-label").textContent = dark ? "Light mode" : "Dark mode";
  $("theme-toggle").title = dark ? "Switch to light mode" : "Switch to dark mode";
}
$("theme-toggle").addEventListener("click", () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // storage blocked: the choice just won't persist
  }
  syncTheme();
});
darkQuery.addEventListener("change", syncTheme);

// --- wiring ------------------------------------------------------------------------------------------
// Nothing to download inside the desktop app.
if ("__TAURI_INTERNALS__" in window || "__TAURI__" in window) $("desktop-link").hidden = true;

// Flush pending changes if the page is closed or refreshed before the debounced render ran.
window.addEventListener("pagehide", persist);

$("reset").addEventListener("click", () => {
  resetting = true;
  clearSettings();
  location.reload();
});

applySettings(loadSettings());
// Print mode is on when the saved PNG size is exactly what the saved width and resolution need.
view.printActive = s.printCm > 0 && s.pngSize === cmToPx(s.printCm, s.printDpi);
syncTheme();
syncUi();
render();
// The icon set (~700 KB) loads lazily so the first paint isn't blocked.
Promise.all([import("./generated/icons.json"), import("./generated/icon-tags.json")]).then(([icons, tags]) => {
  view.icons = icons.default as Record<string, string>;
  view.tags = tags.default as Record<string, string>;
  view.names = Object.keys(view.icons);
  if (s.icon && !view.icons[s.icon]) s.icon = null; // the saved icon no longer exists
  renderIcons();
  update();
});
