# QuickQR

Make good-looking QR codes from text or URLs. One TypeScript codebase runs as a **web app** and as a native **desktop app** (macOS, Windows, Linux) via [Tauri](https://tauri.app). Everything runs on your device; nothing is uploaded.

**Try it online: <https://aescanes.github.io/quick-qr/>**

- **Colors**: foreground, background (or transparent), gradients (horizontal / vertical / diagonal / radial), separate corner-eye color
- **Styles**: square, rounded, dots, diamond, vertical bars, horizontal bars; square, rounded or circle corner eyes
- **Logo**: any icon from [Lucide](https://lucide.dev) (~2,200 bundled, works offline), with its own foreground/background colors (they follow the code's colors whenever those change, never the other way round), size and stroke
- **Export**: SVG (vector) or PNG (256 to 4096 px)

## Develop

```bash
npm install
npm run setup        # once: installs the git pre-commit hook (npm scripts are disabled by .npmrc)
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

- Pushing a version tag like `v0.1.0` builds the desktop installers (macOS Apple Silicon + Intel, Windows, Linux) with `.github/workflows/release.yml`, but only if the tests pass. They are attached to a **draft** GitHub release whose notes are the matching `CHANGELOG.md` section (the build fails if it is missing); review and publish the draft by hand. The workflow can also be started manually from the Actions tab. Installers carry a build provenance attestation: `gh attestation verify <installer> --repo aescanes/quick-qr`.
- The same tag also publishes the web build to GitHub Pages (`.github/workflows/pages.yml`), but only if the tests pass. Ordinary pushes to `main` do not deploy. One-time setup: Settings ▸ Pages ▸ Source: **GitHub Actions**, and in Settings ▸ Environments ▸ `github-pages` add a deployment tag rule `v*`.
- Installers are unsigned. macOS and Windows will show a first-run warning until you add signing certificates.

## Scanning tips

Keep strong contrast (dark on light scans best), keep the margin at 2+ modules, and test with a phone before printing. Heavily rounded or circular eyes are fine for phone cameras, but some strict decoders (e.g. OpenCV's basic `QRCodeDetector`) won't read them. Lucide v1 removed brand icons (GitHub, etc.), so only generic icons are available.

`legacy/python/` holds the earlier Python/Flask prototype; it is not used by the app and can be deleted.

## License

MIT. Bundled Lucide icons are ISC licensed.
