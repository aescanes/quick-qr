# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0](https://github.com/aescanes/quick-qr/releases/tag/v0.2.0) - 2026-10-29

### Added

- Generate QR codes from text or URLs, entirely client-side (nothing is uploaded).
- Colors: foreground, background or transparent, gradients (horizontal, vertical, diagonal, radial) and a separate corner-eye color.
- Styles: six dot shapes (square, rounded, dots, diamond, vertical bars, horizontal bars) and three corner-eye shapes (square, rounded, circle).
- Logo in the center from the [Lucide](https://lucide.dev) icon set, with its own foreground and background colors, size and stroke. The logo colors follow the code's Foreground and Background when those change; changing the logo colors never affects the code. Error correction is raised to High automatically when a logo is set.
- Export as SVG or PNG (256 to 4096 px).
- Print size helper: enter a width in cm and a DPI to get the PNG size needed, see what the selected PNG prints at, and get a warning when the dots would be too small to scan. The chosen DPI is embedded in the saved PNG so other apps open it at its real size.
- Settings are remembered in the browser (`localStorage`): content, colors, styles, logo, print size and PNG size survive a refresh or reopening the page. A "Reset settings" link in the footer restores the defaults. Nothing leaves the device.
- Web app (Vite + TypeScript) and desktop app shell (Tauri 2) for macOS, Windows and Linux.
- CI workflow (tests and build) and a GitHub Pages deploy of the web app that runs on version tags, after the tests pass.
- Desktop release workflow, currently manual-only while the UI and web version are being built.
