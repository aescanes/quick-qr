// Prints the CHANGELOG.md section for a version (a leading "v" is ignored), without
// its "## [x.y.z] - date" heading. Used by the release workflow for the release body
// and imported by version-tag.mjs for the tag annotation.
//
//   node scripts/release-notes.mjs v0.3.0
//
// Exits with an error if the section is missing or empty, so a release is never
// published with blank notes.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Returns the trimmed body of the "## [version]" section, or "" if absent. */
export function releaseNotes(version, changelog = readFileSync("CHANGELOG.md", "utf8")) {
  const bare = version.replace(/^v/, "");
  // Sections are delimited by level-2 headings ("## [x.y.z] - date").
  const section = changelog.split(/\n## /).find((part) => part.startsWith(`[${bare}]`));
  return section ? section.slice(section.indexOf("\n") + 1).trim() : "";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error("usage: node scripts/release-notes.mjs <version>");
    process.exit(2);
  }
  const body = releaseNotes(version);
  if (!body) {
    console.error(`release-notes: no non-empty "## [${version.replace(/^v/, "")}]" section in CHANGELOG.md`);
    process.exit(1);
  }
  console.log(body);
}
