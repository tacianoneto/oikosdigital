// Cross-platform asset sync (used locally and by the Netlify build).
// PNG sources are converted to WebP (much smaller, same visual quality) into
// apps/web/public/assets; fonts are copied as-is. Conversion is incremental:
// a target is only rebuilt when the source is newer.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicAssets = join(root, "apps", "web", "public", "assets");
const portraitSources = join(root, "portraits");
const openPortraitAssets = join(publicAssets, "portraits-open");

const WEBP_QUALITY = 82;

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
  { from: join(root, "icones"), to: join(publicAssets, "icones") },
  { from: join(root, "logo"), to: join(publicAssets, "logo") },
  { from: join(root, "interface", "onça"), to: join(publicAssets, "interface", "onça") },
  { from: join(root, "interface", "lobo guara"), to: join(publicAssets, "interface", "lobo") },
  { from: join(root, "interface", "tatu"), to: join(publicAssets, "interface", "tatu") },
  { from: join(root, "interface", "arara"), to: join(publicAssets, "interface", "arara") },
  { from: join(root, "interface", "galo de campina"), to: join(publicAssets, "interface", "galo") },
  { from: join(root, "interface", "macaco prego"), to: join(publicAssets, "interface", "macaco") },
  { from: join(root, "interface", "quati"), to: join(publicAssets, "interface", "quati") },
  { from: join(root, "fonts"), to: join(publicAssets, "fonts"), extensions: [".ttf", ".otf", ".woff", ".woff2"], copy: true }
];

// The login screen logo lives in the public root (referenced as /oikos-logo.webp).
const extraConversions = [
  { from: join(root, "logo", "Logo.png"), to: join(root, "apps", "web", "public", "oikos-logo.webp") }
];

function isUpToDate(source, target) {
  if (!existsSync(target)) return false;
  return statSync(target).mtimeMs >= statSync(source).mtimeMs;
}

function targetNameFor(sourceName, convert) {
  if (!convert) return sourceName;
  return `${basename(sourceName, extname(sourceName))}.webp`;
}

let converted = 0;
let copied = 0;
let skipped = 0;
const jobs = [];

// These variants keep artwork outside the printed circle away from the image
// boundary. Lobby and opponent rail can render them without any CSS mask.
mkdirSync(openPortraitAssets, { recursive: true });
const openPortraitEntries = readdirSync(portraitSources, { withFileTypes: true }).filter(
  (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png")
);
const expectedOpenPortraits = new Set(openPortraitEntries.map((entry) => targetNameFor(entry.name, true)));

for (const entry of readdirSync(openPortraitAssets, { withFileTypes: true })) {
  if (entry.isFile() && !expectedOpenPortraits.has(entry.name) && /\.(png|webp)$/i.test(entry.name)) {
    rmSync(join(openPortraitAssets, entry.name));
  }
}

for (const entry of openPortraitEntries) {
  const source = join(portraitSources, entry.name);
  const target = join(openPortraitAssets, targetNameFor(entry.name, true));

  if (isUpToDate(source, target)) {
    skipped += 1;
    continue;
  }

  jobs.push(
    (async () => {
      const image = sharp(source);
      const { width = 0, height = 0 } = await image.metadata();
      const canvasSize = Math.max(315, width, height);
      const horizontalSpace = canvasSize - width;
      const verticalSpace = canvasSize - height;

      await image
        .extend({
          left: Math.floor(horizontalSpace / 2),
          right: Math.ceil(horizontalSpace / 2),
          top: Math.floor(verticalSpace / 2),
          bottom: Math.ceil(verticalSpace / 2),
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: WEBP_QUALITY })
        .toFile(target);
      converted += 1;
    })()
  );
}

for (const group of groups) {
  mkdirSync(group.to, { recursive: true });
  const convert = !group.copy;
  const allowed = group.extensions ?? [".png"];
  const sourceEntries = readdirSync(group.from, { withFileTypes: true }).filter(
    (entry) => entry.isFile() && allowed.some((ext) => entry.name.toLowerCase().endsWith(ext))
  );
  const expectedTargets = new Set(sourceEntries.map((entry) => targetNameFor(entry.name, convert)));

  // Drop stale outputs (renamed/removed sources and leftover .png copies).
  for (const entry of readdirSync(group.to, { withFileTypes: true })) {
    if (entry.isFile() && !expectedTargets.has(entry.name) && (convert ? /\.(png|webp)$/i : /./).test(entry.name)) {
      rmSync(join(group.to, entry.name));
    }
  }

  for (const entry of sourceEntries) {
    const source = join(group.from, entry.name);
    const target = join(group.to, targetNameFor(entry.name, convert));

    if (isUpToDate(source, target)) {
      skipped += 1;
      continue;
    }

    if (convert) {
      jobs.push(
        sharp(source)
          .webp({ quality: WEBP_QUALITY })
          .toFile(target)
          .then(() => {
            converted += 1;
          })
      );
    } else {
      copyFileSync(source, target);
      copied += 1;
    }
  }
}

for (const extra of extraConversions) {
  if (isUpToDate(extra.from, extra.to)) {
    skipped += 1;
    continue;
  }
  jobs.push(
    sharp(extra.from)
      .webp({ quality: WEBP_QUALITY })
      .toFile(extra.to)
      .then(() => {
        converted += 1;
      })
  );
}

await Promise.all(jobs);
console.log(`Assets synced to ${publicAssets} (${converted} converted, ${copied} copied, ${skipped} up-to-date)`);
