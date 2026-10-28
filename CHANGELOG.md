# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Generate QR codes from text or URLs, entirely client-side (nothing is uploaded).
- Colors: foreground, background or transparent, gradients (horizontal, vertical, diagonal, radial) and a separate corner-eye color.
- Styles: six dot shapes (square, rounded, dots, diamond, vertical bars, horizontal bars) and three corner-eye shapes (square, rounded, circle).
- Logo in the center from the [Lucide](https://lucide.dev) icon set, with custom icon color, size, stroke and backing color. Error correction is raised to High automatically when a logo is set.
- Export as SVG or PNG (512 to 4096 px).
- Web app (Vite + TypeScript) and desktop app shell (Tauri 2) for macOS, Windows and Linux.
- CI workflow (tests and build) and GitHub Pages deploy of the web app.
- Desktop release workflow, currently manual-only while the UI and web version are being built.
