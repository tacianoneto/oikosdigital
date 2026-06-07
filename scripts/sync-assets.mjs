// Cross-platform asset sync (used locally and by the Netlify build).
// Mirrors scripts/sync-assets.ps1.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
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
  { from: join(root, "movimentos", "Separados"), to: join(publicAssets, "movimentos", "separados") },
  { from: join(root, "recursos"), to: join(publicAssets, "resources") },
  { from: join(root, "logo"), to: join(publicAssets, "logo") },
  { from: join(root, "interface", "onça"), to: join(publicAssets, "interface", "onça") },
  { from: join(root, "interface", "lobo guara"), to: join(publicAssets, "interface", "lobo") },
  { from: join(root, "interface", "tatu"), to: join(publicAssets, "interface", "tatu") },
  { from: join(root, "interface", "arara"), to: join(publicAssets, "interface", "arara") },
  { from: join(root, "interface", "galo de campina"), to: join(publicAssets, "interface", "galo") },
  { from: join(root, "interface", "macaco prego"), to: join(publicAssets, "interface", "macaco") },
  { from: join(root, "interface", "quati"), to: join(publicAssets, "interface", "quati") },
  { from: join(root, "fonts"), to: join(publicAssets, "fonts"), extensions: [".ttf", ".otf", ".woff", ".woff2"] }
];

const defaultExtensions = [".png"];
let copied = 0;
for (const group of groups) {
  mkdirSync(group.to, { recursive: true });
  const allowed = group.extensions ?? defaultExtensions;
  const sourceFiles = new Set(
    readdirSync(group.from, { withFileTypes: true })
      .filter((entry) => entry.isFile() && allowed.some((ext) => entry.name.toLowerCase().endsWith(ext)))
      .map((entry) => entry.name)
  );

  if (existsSync(group.to)) {
    for (const entry of readdirSync(group.to, { withFileTypes: true })) {
      if (
        entry.isFile() &&
        allowed.some((ext) => entry.name.toLowerCase().endsWith(ext)) &&
        !sourceFiles.has(entry.name)
      ) {
        rmSync(join(group.to, entry.name));
      }
    }
  }

  for (const entry of readdirSync(group.from, { withFileTypes: true })) {
    if (entry.isFile() && allowed.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      copyFileSync(join(group.from, entry.name), join(group.to, entry.name));
      copied += 1;
    }
  }
}

console.log(`Assets synced to ${publicAssets} (${copied} files)`);
