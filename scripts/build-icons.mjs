// Pack the Lucide SVGs (node_modules/lucide-static) into one JSON map: name -> inner SVG markup.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "node_modules", "lucide-static", "icons");
const out = {};
for (const file of readdirSync(dir).filter((f) => f.endsWith(".svg")).sort()) {
  const m = readFileSync(join(dir, file), "utf8").match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (m) out[file.slice(0, -4)] = m[1].replace(/\s+/g, " ").replace(/> </g, "><").trim();
}
mkdirSync(join(root, "src", "generated"), { recursive: true });
writeFileSync(join(root, "src", "generated", "icons.json"), JSON.stringify(out));
console.log(`icons: packed ${Object.keys(out).length} Lucide icons`);
