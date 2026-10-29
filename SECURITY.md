# Security Policy

## Supported versions

Only the latest release receives security fixes. Please update before reporting an issue.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through GitHub: go to the repository's **Security** tab and choose **Report a vulnerability** ([private vulnerability reporting](https://github.com/aescanes/quick-qr/security/advisories/new)). Include what you found, steps to reproduce, and the affected version or platform (web or desktop).

You can expect an acknowledgement within 7 days. Once the issue is confirmed, a fix is prepared privately and released, and the report is then disclosed with credit to the reporter unless you prefer to stay anonymous.

Non-sensitive bugs can go in a normal public issue.

## Security measures

### Application

- **No backend, no uploads.** QR generation runs entirely on the client. The text or URL you enter never leaves your device.
- **Restrictive CSP** in the desktop app (`default-src 'self'`; no remote scripts, styles or connections).
- **Minimal desktop permissions.** The Tauri shell only registers the `dialog` and `fs` plugins and allows just `dialog:allow-save` and `fs:allow-write-file` ([capabilities/default.json](src-tauri/capabilities/default.json)). The app can only write a file the user picked in a save dialog.
- **Validated stored settings.** Settings read from `localStorage` are validated and clamped field by field and never trusted as-is.

### Supply chain

- **Exact dependency versions.** Every dependency in `package.json` is pinned to an exact version (no `^`, `~` or `latest`), and `save-exact=true` in [.npmrc](.npmrc) keeps new installs pinned.
- **No dependency install scripts.** `ignore-scripts=true` in [.npmrc](.npmrc) stops `npm install` and `npm ci` from running dependencies' `preinstall`, `install` and `postinstall` scripts, the most common npm supply-chain attack path. Only this project's own scripts run, and git hooks are installed explicitly with `npm run setup`.
- **Committed lockfiles** (`package-lock.json`, `Cargo.lock`), with CI installing through `npm ci` so builds are reproducible.

### Process

- **Tests gate releases.** CI runs the type-check and tests, and the GitHub Pages deploy runs only on `v*` tags and only after the tests pass.
- **Pre-commit validation.** A Husky hook runs `npm run validate` (type-check and tests) before every commit.
- **Humans publish.** Pushing code, tags and releases is done by a maintainer, not automated tooling.

## Scope

In scope: the QuickQR web app, the desktop app, and the build and release configuration in this repository. Vulnerabilities in third-party dependencies should be reported to their maintainers, but let us know if QuickQR is affected so we can update.
