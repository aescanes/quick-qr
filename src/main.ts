import "./style.css";
import { QRError, renderSvg, type Options } from "./render";
import { saveFile, svgToPng } from "./save";

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
const MAX_SHOWN = 120;

const state = { icon: null as string | null, svg: "", names: [] as string[], icons: {} as Record<string, string> };

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
  try {
    const { svg, info } = renderSvg(options());
    state.svg = svg;
    $("frame").innerHTML = svg;
    $("error-msg").hidden = true;
    $("meta").textContent = `Version ${info.version} · ${info.modules}×${info.modules} modules · error correction ${info.error}`;
    $<HTMLButtonElement>("dl-svg").disabled = $<HTMLButtonElement>("dl-png").disabled = false;
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
  $("icon-grid").replaceChildren(
    ...matches.slice(0, MAX_SHOWN).map((name) => {
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
    await saveFile(`QuickQR-${size}.png`, await svgToPng(state.svg, size));
  }),
);

// --- wiring ----------------------------------------------------------------
// Keep the logo backing in sync with the background until the user picks one.
let logoBgTouched = false;
$("logoBg").addEventListener("input", () => (logoBgTouched = true));
$("bg").addEventListener("input", () => {
  if (!logoBgTouched) $("logoBg").value = $("bg").value;
});

document.querySelectorAll<HTMLElement>("#form input, #form select, #form textarea").forEach((el) => {
  if (el.id !== "icon-search") el.addEventListener("input", schedule);
});
$("form").addEventListener("submit", (e) => e.preventDefault());

render();
// The icon set (~700 KB) loads lazily so the first paint isn't blocked.
import("./generated/icons.json").then((m) => {
  state.icons = m.default as Record<string, string>;
  state.names = Object.keys(state.icons);
  renderIcons();
});
