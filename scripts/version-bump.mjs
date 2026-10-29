// `npm version` hook. package.json is bumped by npm itself; this copies the
// same version into the desktop app (tauri.conf.json, Cargo.toml and the
// QuickQR entry in Cargo.lock) so the installers carry the right version.
// Edits are targeted replacements, so the files keep their formatting.

import { readFileSync, writeFileSync } from "node:fs";

const version = process.env.npm_package_version;

function replaceOnce(file, pattern, replacement) {
  const text = readFileSync(file, "utf8");
  if (!pattern.test(text)) {
    console.error(`version-bump: could not find the version in ${file}`);
    process.exit(1);
  }
  writeFileSync(file, text.replace(pattern, replacement));
}

replaceOnce("src-tauri/tauri.conf.json", /("version":\s*")[^"]*(")/, `$1${version}$2`);
replaceOnce("src-tauri/Cargo.toml", /^(version\s*=\s*")[^"]*(")/m, `$1${version}$2`);
replaceOnce("src-tauri/Cargo.lock", /(name = "QuickQR"\nversion = ")[^"]*(")/, `$1${version}$2`);
console.log(`version-bump: set the desktop app version to ${version}`);
