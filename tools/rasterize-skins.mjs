/**
 * Rastert die Haut-Texturen der Figuren (SVG, 1024 x 1024) zu kleinen PNGs.
 *
 * Die Kenney-Haeute liegen als SVG vor und nutzen Ueberblend-Modi
 * (mix-blend-mode: overlay) fuer Schattierungen. Die gaengigen SVG-Werkzeuge
 * ohne Browser koennen das nicht - Chromium schon. Deshalb laeuft das hier
 * ueber Playwright.
 *
 * 256 x 256 reicht: Eine Figur ist im Spiel rund 50 Bildpunkte hoch. Groesser
 * kostet nur Grafikspeicher auf dem Handy.
 *
 *   NODE_PATH=$(npm root -g) node tools/rasterize-skins.mjs
 *
 * Welche Haut welche Rolle bekommt, steht in `src/config/models.ts`. Wer dort
 * eine Haut austauscht, traegt sie hier in SKINS ein und laesst das Skript
 * noch einmal laufen.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "models", "skins");
const SIZE = 256;

const SKINS = [
  "athleteMaleBlue",
  "racerOrangeMale",
  "militaryFemaleA",
  "zombieA",
  "zombieB",
  "zombieC",
  "cyborg",
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
});
const page = await browser.newPage();

for (const name of SKINS) {
  const svg = readFileSync(join(ROOT, "public", "Skins", `${name}.svg`), "utf8");
  const base64 = await page.evaluate(
    async ({ svg, size }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { svg, size: SIZE },
  );
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(base64, "base64"));
  console.log(`${name}.png`, Math.round(Buffer.from(base64, "base64").length / 1024), "KB");
}

await browser.close();
