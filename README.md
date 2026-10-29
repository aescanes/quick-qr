# QuickQR

Make good-looking QR codes from text or URLs. One TypeScript codebase runs as a **web app** and as a native **desktop app** (macOS, Windows, Linux) via [Tauri](https://tauri.app). Everything runs on your device; nothing is uploaded.

- **Colors**: foreground, background (or transparent), gradients (horizontal / vertical / diagonal / radial), separate corner-eye color
- **Styles**: square, rounded, dots, diamond, vertical bars, horizontal bars; square, rounded or circle corner eyes
- **Logo**: any icon from [Lucide](https://lucide.dev) (~2,200 bundled, works offline), with its own foreground/background colors (they follow the code's colors whenever those change, never the other way round), size and stroke
- **Export**: SVG (vector) or PNG (256 to 4096 px)

## Develop

```bash
npm install
npm run dev          # web app at http://localhost:5173
npm test             # renderer tests
npm run build        # web build -> dist/
```

Desktop app (needs [Rust](https://rustup.rs) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)):

```bash
npm run tauri dev     # native window with hot reload
npm run tauri build   # installer for the current OS -> src-tauri/target/release/bundle/
```

## How it works

| Piece | Choice |
|---|---|
| QR matrix | [`uqr`](https://github.com/unjs/uqr) (zero dependencies) |
| Rendering | `src/render.ts`: custom SVG writer for dot shapes, gradients and the logo cut-out |
| UI | Vite + vanilla TypeScript, no framework |
| Icons | `lucide-static`, packed into one lazily loaded JSON by `scripts/build-icons.mjs` |
| Desktop shell | Tauri 2 (`src-tauri/`); Rust only hosts the webview and native save dialogs |
| PNG export | canvas rasterisation of the SVG |

With a logo set, error correction is forced to **High (30%)** and the modules under the logo are removed. Logo size is capped at 28% of the width to keep codes scannable.

## Releases

- Desktop releases are **paused** while the UI and web version are being built. `.github/workflows/release.yml` (installers for macOS, Windows and Linux into a draft GitHub release) only runs when started manually; the `v*` tag trigger will be restored later.
- Pushes to `main` publish the web build to GitHub Pages (`.github/workflows/pages.yml`).
- Installers are unsigned. macOS and Windows will show a first-run warning until you add signing certificates.

## Scanning tips

Keep strong contrast (dark on light scans best), keep the margin at 2+ modules, and test with a phone before printing. Heavily rounded or circular eyes are fine for phone cameras, but some strict decoders (e.g. OpenCV's basic `QRCodeDetector`) won't read them. Lucide v1 removed brand icons (GitHub, etc.), so only generic icons are available.

`legacy/python/` holds the earlier Python/Flask prototype; it is not used by the app and can be deleted.

## License

MIT. Bundled Lucide icons are ISC licensed.
