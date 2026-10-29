// `npm version` postversion hook. npm creates the tag (v<version>) with just the
// bare version as its message; this rewrites that annotation to be the matching
// CHANGELOG.md section, so `git show <tag>` and GitHub's tag view carry the
// real release notes. It never pushes: publishing the tag is a manual step.
//
// Safe to no-op: if HEAD has no tag or CHANGELOG.md has no "## [<version>]"
// section, the tag keeps the message `npm version` gave it.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { releaseNotes } from "./release-notes.mjs";

const version = process.env.npm_package_version;

const git = (args) => execFileSync("git", args, { encoding: "utf8" });

let tag;
try {
  tag = git(["describe", "--tags", "--exact-match", "HEAD"]).trim();
} catch {
  console.warn("version-tag: HEAD has no tag; nothing to annotate.");
  process.exit(0);
}

let changelog = "";
try {
  changelog = readFileSync("CHANGELOG.md", "utf8");
} catch {
  process.exit(0);
}

const body = releaseNotes(version, changelog);

if (!body) {
  console.warn(`version-tag: no "## [${version}]" section in CHANGELOG.md; keeping the default tag message.`);
  process.exit(0);
}

// --cleanup=verbatim keeps lines starting with "#" (the "### Added" sub-headings).
git(["tag", "-a", tag, "-f", "--cleanup=verbatim", "-m", `${version}\n\n${body}\n`]);
console.log(`version-tag: annotated tag ${tag} from CHANGELOG.md`);
