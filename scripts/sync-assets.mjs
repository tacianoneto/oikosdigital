// Cross-platform asset sync (used locally and by the Netlify build).
// Mirrors scripts/sync-assets.ps1.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicAssets = join(root, "apps", "web", "public", "assets");

const groups = [
  { from: join(root, "boards"), to: join(publicAssets, "boards") },
  { from: join(root, "cartas floresta"), to: join(publicAssets, "forest-cards") },
  {
    from: join(root, "cartas floresta", "cartas iniciais floresta"),
    to: join(publicAssets, "forest-cards", "initial")
  },
  { from: join(root, "cartas objetivos"), to: join(publicAssets, "objective-cards") },
  { from: join(root, "cartas cenário"), to: join(publicAssets, "scenario-cards") },
  { from: join(root, "cartas ameaça"), to: join(publicAssets, "threat-cards") },
  { from: join(root, "meeples"), to: join(publicAssets, "meeples") },
  { from: join(root, "portraits"), to: join(publicAssets, "portraits") },
  { from: join(root, "movimentos"), to: join(publicAssets, "movimentos") },
  { from: join(root, "recursos"), to: join(publicAssets, "resources") }
];

let copied = 0;
for (const group of groups) {
  mkdirSync(group.to, { recursive: true });
  for (const entry of readdirSync(group.from, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      copyFileSync(join(group.from, entry.name), join(group.to, entry.name));
      copied += 1;
    }
  }
}

console.log(`Assets synced to ${publicAssets} (${copied} files)`);
