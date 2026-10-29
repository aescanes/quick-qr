import "./style.css";
import { QRError, renderSvg, type Options } from "./render";
import { withPngDpi } from "./png";
import { MAX_PNG_PX, MIN_DOT_MM, cmToPx, dotMm, pxToCm } from "./print";
import { saveFile, svgToPng } from "./save";
import { clearSettings, loadSettings, saveSettings, type Settings } from "./settings";

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
const MAX_SHOWN = 120;

const state = { icon: null as string | null, svg: "", totalModules: 0, errorChoice: "M" as Settings["error"], pendingIcon: null as string | null, names: [] as string[], icons: {} as Record<string, string> };

const segValue = (id: string) => $(id).querySelector<HTMLElement>(".on")!.dataset.value!;

function options(): Partial<Options> {
  return {
    data: $("data").value,
    error: $("error").value as Options["error"],
    fg: $("fg").value,
    fg2: $("fg2").value,
    gradient: $("gradient").value as Options["gradient"],
    bg: $("bg").value,
    transparent: $("transparent").checked,
    eyeColor: $("eye-custom").checked ? $("eyeColor").value : null,
    moduleStyle: segValue("moduleStyle") as Options["moduleStyle"],
    eyeStyle: segValue("eyeStyle") as Options["eyeStyle"],
    border: +$("border").value,
    logo: state.icon,
    logoSvg: state.icon ? state.icons[state.icon] : null,
    logoColor: $("logoColor").value,
    logoBg: $("logoBg").value,
    logoScale: +$("logoScale").value,
    logoStroke: +$("logoStroke").value,
    size: 1024,
  };
}

function render() {
  syncUi();
  persist();
  try {
    const { svg, info } = renderSvg(options());
    state.svg = svg;
    $("frame").innerHTML = svg;
    $("error-msg").hidden = true;
    state.totalModules = info.modules + 2 * +$("border").value;
    $("meta").textContent = `Version ${info.version} · ${info.modules}×${info.modules} modules · error correction ${info.error}`;
    $<HTMLButtonElement>("dl-svg").disabled = $<HTMLButtonElement>("dl-png").disabled = false;
    updatePrint();
  } catch (e) {
    if (!(e instanceof QRError)) throw e;
    state.svg = "";
    $("frame").innerHTML = "";
    $("error-msg").textContent = e.message;
    $("error-msg").hidden = false;
    $("meta").textContent = "";
    $<HTMLButtonElement>("dl-svg").disabled = $<HTMLButtonElement>("dl-png").disabled = true;
  }
}

// --- persistence (localStorage) ----------------------------------------------
/** Read every control into a Settings object. */
function collect(): Settings {
  return {
    data: $("data").value,
    error: state.errorChoice, // the user's own pick, not the High forced by a logo
    fg: $("fg").value,
    fg2: $("fg2").value,
    gradient: $("gradient").value as Settings["gradient"],
    bg: $("bg").value,
    transparent: $("transparent").checked,
    eyeCustom: $("eye-custom").checked,
    eyeColor: $("eyeColor").value,
    moduleStyle: segValue("moduleStyle") as Settings["moduleStyle"],
    eyeStyle: segValue("eyeStyle") as Settings["eyeStyle"],
    border: +$("border").value,
    // Until the lazy icon set has loaded, keep the saved icon instead of overwriting it with null.
    icon: state.names.length ? state.icon : state.pendingIcon,
    logoColor: $("logoColor").value,
    logoBg: $("logoBg").value,
    logoScale: +$("logoScale").value,
    logoStroke: +$("logoStroke").value,
    printCm: +$("print-cm").value,
    printDpi: +$("print-dpi").value as Settings["printDpi"],
    pngSize: +$("png-size").value,
  };
}

let resetting = false; // set while "Reset settings" reloads the page, so pagehide doesn't re-save
const persist = () => {
  if (!resetting) saveSettings(collect());
};

/** Write saved settings back into the controls (only the fields that were valid). */
function applySettings(s: Partial<Settings>) {
  const set = (id: string, v: string | number | undefined) => {
    if (v !== undefined) $(id).value = String(v);
  };
  const check = (id: string, v: boolean | undefined) => {
    if (v !== undefined) $(id).checked = v;
  };
  set("data", s.data);
  if (s.error) state.errorChoice = s.error;
  set("fg", s.fg);
  set("fg2", s.fg2);
  set("gradient", s.gradient);
  set("bg", s.bg);
  check("transparent", s.transparent);
  check("eye-custom", s.eyeCustom);
  set("eyeColor", s.eyeColor);
  for (const [id, value] of [["moduleStyle", s.moduleStyle], ["eyeStyle", s.eyeStyle]] as const) {
    if (value) $(id).querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.value === value));
  }
  set("border", s.border);
  set("logoColor", s.logoColor);
  set("logoBg", s.logoBg);
  set("logoScale", s.logoScale);
  set("logoStroke", s.logoStroke);
  set("print-cm", s.printCm);
  set("print-dpi", s.printDpi);
  state.pendingIcon = s.icon ?? null;
  if (s.pngSize) setPngSize(s.pngSize);
}

let timer: number;
const schedule = () => {
  clearTimeout(timer);
  timer = window.setTimeout(render, 60);
};

/** Show/hide dependent controls and range read-outs. */
function syncUi() {
  $("fg2-wrap").hidden = $("gradient").value === "none";
  $("eyeColor").disabled = !$("eye-custom").checked;
  $("logo-opts").hidden = !state.icon;
  $("ec-hint").hidden = !state.icon;
  // A logo forces High: show it, but remember the user's own choice for when the logo is removed.
  $("error").value = state.icon ? "H" : state.errorChoice;
  $("error").disabled = !!state.icon;
  for (const id of ["border", "logoScale", "logoStroke"]) {
    $(id).parentElement!.querySelector("output")!.textContent =
      id === "logoScale" ? `${Math.round(+$(id).value * 100)}%` : $(id).value;
  }
}

// --- segmented buttons -------------------------------------------------
document.querySelectorAll<HTMLElement>(".seg").forEach((seg) =>
  seg.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;
    seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
    schedule();
  }),
);

// --- icon picker ---------------------------------------------------------
function renderIcons() {
  const q = $("icon-search").value.trim().toLowerCase().replace(/\s+/g, "-");
  const matches = q ? state.names.filter((n) => n.includes(q)) : state.names;
  const shown = matches.slice(0, MAX_SHOWN);
  if (state.icon && !shown.includes(state.icon)) shown.unshift(state.icon); // keep the selection visible
  $("icon-grid").replaceChildren(
    ...shown.map((name) => {
      const b = document.createElement("button");
      b.type = "button";
      b.title = name;
      b.dataset.name = name;
      b.setAttribute("role", "option");
      b.classList.toggle("on", name === state.icon);
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-label="${name}">${state.icons[name]}</svg>`;
      return b;
    }),
  );
  $("icon-count").textContent = matches.length > MAX_SHOWN
    ? `Showing ${MAX_SHOWN} of ${matches.length}. Type to narrow down.`
    : `${matches.length} icon${matches.length === 1 ? "" : "s"}`;
}

$("icon-grid").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  state.icon = b.dataset.name!;
  renderIcons();
  render();
});
$("icon-clear").addEventListener("click", () => {
  state.icon = null;
  renderIcons();
  render();
});
$("icon-search").addEventListener("input", renderIcons);

// --- print size ----------------------------------------------------------
const fmtCm = (cm: number) => String(+cm.toFixed(1));

function updatePrint() {
  persist();
  const dpi = +$("print-dpi").value;
  const cm = +$("print-cm").value;
  const png = +$("png-size").value;
  const apply = $<HTMLButtonElement>("print-apply");

  $("print-selected").textContent = `The selected PNG (${png} px) prints ${fmtCm(pxToCm(png, dpi))} cm wide at ${dpi} DPI.`;

  if (!(cm > 0)) {
    $("print-result").textContent = "Enter a width in cm.";
    apply.disabled = true;
    $("print-dot").textContent = "";
    return;
  }
  const need = cmToPx(cm, dpi);
  if (need > MAX_PNG_PX) {
    $("print-result").textContent = `${fmtCm(cm)} cm at ${dpi} DPI needs ${need} px, above the ${MAX_PNG_PX} px limit. Use SVG or a lower DPI.`;
    apply.disabled = true;
  } else {
    $("print-result").textContent = `${fmtCm(cm)} cm at ${dpi} DPI needs ${need} px.`;
    apply.textContent = `Set PNG to ${need} px`;
    apply.disabled = false;
  }
  if (state.totalModules) {
    const dot = dotMm(cm, state.totalModules);
    $("print-dot").textContent = `Each dot is about ${dot.toFixed(2)} mm.` +
      (dot < MIN_DOT_MM ? " Too small to scan reliably: print larger or shorten the content." : "");
  }
}

/** Select `px` in the PNG size list, adding a "custom" entry if it is not a preset. */
function setPngSize(px: number) {
  const select = $<HTMLSelectElement>("png-size");
  if (![...select.options].some((o) => +o.value === px)) {
    select.querySelector("[data-custom]")?.remove();
    const opt = new Option(`${px} px (custom)`, String(px));
    opt.dataset.custom = "1";
    select.add(opt, [...select.options].find((o) => +o.value > px) ?? null);
  }
  select.value = String(px);
  updatePrint();
}

$("print-apply").addEventListener("click", () => setPngSize(cmToPx(+$("print-cm").value, +$("print-dpi").value)));
for (const id of ["print-cm", "print-dpi", "png-size"]) $(id).addEventListener("input", updatePrint);

// --- saving --------------------------------------------------------------
async function guard(task: () => Promise<void>) {
  try {
    await task();
  } catch (e) {
    $("error-msg").textContent = e instanceof Error ? e.message : String(e);
    $("error-msg").hidden = false;
  }
}
$("dl-svg").addEventListener("click", () =>
  guard(() => saveFile("QuickQR.svg", new Blob([state.svg], { type: "image/svg+xml" }))),
);
$("dl-png").addEventListener("click", () =>
  guard(async () => {
    const size = +$("png-size").value;
    const png = new Uint8Array(await (await svgToPng(state.svg, size)).arrayBuffer());
    // Embed the chosen DPI so Word, Canva, etc. open the file at its real print size.
    const bytes = withPngDpi(png, +$("print-dpi").value);
    await saveFile(`QuickQR-${size}.png`, new Blob([bytes as BlobPart], { type: "image/png" }));
  }),
);

// --- wiring ----------------------------------------------------------------
$("error").addEventListener("input", () => (state.errorChoice = $("error").value as Settings["error"]));

// The logo colors follow the code colors, one way only: changing Foreground/Background also
// sets the logo's Foreground/Background, while changing the logo colors never touches the code.
$("fg").addEventListener("input", () => ($("logoColor").value = $("fg").value));
$("bg").addEventListener("input", () => ($("logoBg").value = $("bg").value));

document.querySelectorAll<HTMLElement>("#form input, #form select, #form textarea").forEach((el) => {
  if (el.id !== "icon-search") el.addEventListener("input", schedule);
});
$("form").addEventListener("submit", (e) => e.preventDefault());

// Flush pending changes if the page is closed or refreshed before the debounced render ran.
window.addEventListener("pagehide", persist);

$("reset").addEventListener("click", () => {
  resetting = true;
  clearSettings();
  location.reload();
});

applySettings(loadSettings());
render();
// The icon set (~700 KB) loads lazily so the first paint isn't blocked.
import("./generated/icons.json").then((m) => {
  state.icons = m.default as Record<string, string>;
  state.names = Object.keys(state.icons);
  // Re-apply the saved logo now that its markup is available (ignored if the icon no longer exists).
  if (state.pendingIcon && state.icons[state.pendingIcon]) state.icon = state.pendingIcon;
  state.pendingIcon = null;
  renderIcons();
  render();
});
