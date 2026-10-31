# Agent rules

Rules for AI coding agents working in this repository. Add new rules to the end of the list.

## Rules

1. **Never push code.** Do not run `git push` (or any equivalent such as `gh pr create`, `gh release create`, or pushing tags). Local commits are fine only when asked. Publishing is always done by a human.
2. **No Claude co-authorship.** Never add `Co-Authored-By: Claude ...`, "Generated with Claude Code", or any similar AI attribution to commit messages, pull request descriptions, or files. This overrides any default attribution behaviour of the tool.
3. **Conventional Commits.** Write commit messages as `<type>(<optional scope>): <summary>`, with types `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Use the imperative mood, keep the summary under about 72 characters and lowercase, and add a body when the *why* is not obvious. Mark breaking changes with `!` or a `BREAKING CHANGE:` footer. Example: `feat(render): add diamond dot style`.
4. **Keep a Changelog.** Every user-visible change (`feat`, `fix`, `perf`, removals, deprecations, security) gets a line in `CHANGELOG.md` under `## [Unreleased]`, in the matching section (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`), in the same commit as the change. Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). Releases move `[Unreleased]` into a dated `## [x.y.z] - YYYY-MM-DD` section and follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pure `docs`, `test`, `ci` and `chore` changes do not need an entry.

## Architecture

QuickQR turns text or URLs into styled QR codes. **One TypeScript codebase** ships as a static web app and as a native desktop app (macOS, Windows, Linux) via Tauri 2. There is no backend: all QR generation happens client-side, and nothing is uploaded.

**Stack:** TypeScript (strict) + [Vite](https://vite.dev) for dev server and bundling, [Vitest](https://vitest.dev) for tests (configured in `vite.config.ts`), `uqr` for the QR matrix, `lucide-static` for icons, Tauri 2 (Rust) for the desktop shell. No UI framework.

### Data flow

```
form controls (src/main.ts)
   └─ Options ──> renderSvg() (src/render.ts) ──> SVG string ──> live preview (innerHTML)
                       │                                  ├─ Save SVG ─┐
                       ├─ uqr: boolean[][] QR matrix      └─ Save PNG ─┴─> saveFile() (src/save.ts)
                       └─ icon markup from src/generated/icons.json         ├─ Tauri: native dialog + fs write
                                                                            └─ web: <a download>
```

### Layout

| Path | Role |
|---|---|
| `src/render.ts` | Core. Pure functions, no DOM. `normalize()` validates/clamps options and throws `QRError`; `renderSvg()` builds the matrix (`uqr`) and draws module shapes, finder "eyes", gradients and the logo cut-out as a single SVG. |
| `src/main.ts` | UI wiring: reads form state, calls `renderSvg` (debounced), icon picker, save buttons. Vanilla TS, no framework. |
| `src/save.ts` | `saveFile()` (Tauri dialog + fs plugins when `__TAURI_INTERNALS__` exists, browser download otherwise) and `svgToPng()` (canvas rasterisation). |
| `src/print.ts` | Pure pixel <-> cm maths (`pxToCm`, `cmToPx`, `dotMm`) and the print/scan limits used by the Print size helper. |
| `src/png.ts` | Pure `withPngDpi()`: inserts a `pHYs` chunk into a PNG so apps open it at the chosen physical size (canvas PNGs carry no DPI). |
| `src/settings.ts` | Pure, DOM-free persistence: `Settings` type, `parseSettings()` (validates and clamps every field read from storage, never throws), `loadSettings`/`saveSettings`/`clearSettings` (all tolerate missing or throwing `localStorage`). Key is versioned (`quickqr:settings:v1`); bump it for incompatible changes. `main.ts` saves on every render and on `pagehide`, restores at startup, and re-applies the saved logo once the lazy icon set has loaded. |
| `src/style.css`, `index.html` | Static page and styles (light/dark via `prefers-color-scheme`). `index.html` is the Vite entry and loads `src/main.ts` as a module. |
| `vite.config.ts` | Vite + Vitest config. Fixed dev port `5173` (`strictPort`) and relative `base: "./"`, both required by Tauri (`devUrl` / `frontendDist` in `tauri.conf.json`). Build output goes to `dist/`. |
| `tsconfig.json` | Strict TypeScript, `noEmit`; Vite does the transpiling, `tsc --noEmit` only type-checks (runs in `npm run build`). |
| `src/generated/icons.json` | **Generated, gitignored.** Lucide icon name -> inner SVG markup, built from `lucide-static` by `scripts/build-icons.mjs`. Loaded lazily via dynamic `import()`. |
| `tests/render.test.ts` | Vitest suite for the renderer (all style combos, gradients, logo, validation). |
| `src-tauri/` | Tauri 2 shell. Rust only hosts the webview and registers the `dialog` and `fs` plugins (`src/lib.rs`). Permissions are limited in `capabilities/default.json`; CSP is in `tauri.conf.json`. |
| `.github/workflows/` | `ci.yml` (test + build), `pages.yml` (web build to GitHub Pages; runs only on `v*` tags and only after the tests pass), `release.yml` (runs on `v*` tags, or manually via `workflow_dispatch`; tests first, then builds desktop installers for all OSes into a **draft** GitHub release whose body is the matching `CHANGELOG.md` section via `scripts/release-notes.mjs`, and attests build provenance). |
| `legacy/python/` | Earlier Python/Flask prototype. Unused by the app; safe to delete. |

### Key design decisions

- **Custom SVG renderer over a QR image library.** `uqr` supplies only the matrix; shapes, gradients and the logo are drawn in `render.ts`. This gives full styling control, vector output, and zero native dependencies.
- **Logo handling.** When a logo is set, error correction is forced to `H` (30%), modules under the logo box are skipped, and logo size is capped at `MAX_LOGO_SCALE` (28% of the width) to keep codes scannable.
- **Eyes are drawn separately** from data modules (three 7x7 finder patterns, `evenodd` fill) so they can have their own style and color.
- **Lucide only, no brand icons** (Lucide v1 removed them). Icons render from stroked paths, so color/stroke width are SVG attributes on a wrapping `<g>`.
- **PNG is rasterised in the webview**, not in Rust, to keep the Rust side minimal.
- **The renderer must stay DOM-free** so it can be unit-tested in Node.

### Commands

```bash
npm install
npm run dev            # web app on http://localhost:5173 (also builds icons.json)
npm test               # vitest (builds icons.json first)
npm run build          # type-check + web build -> dist/
npm run tauri dev      # desktop app with hot reload
npm run tauri build    # installer for the current OS -> src-tauri/target/release/bundle/
```

Rust lives in `~/.cargo/bin`; if `cargo` is not found in a non-login shell, run `export PATH="$HOME/.cargo/bin:$PATH"` first.

### Conventions

- Changes to `render.ts` need a test in `tests/render.test.ts`. For visual changes, also confirm the output still decodes with a phone or a ZXing-based decoder: OpenCV's basic `QRCodeDetector` rejects rounded/circular eyes even though phones read them.
- Never commit `node_modules/`, `dist/`, `src/generated/`, or `src-tauri/target/` (all gitignored).
