/**
 * Erzeugt App-Icons, Favicon-Vorlage und Splash-Bilder im Stil des Spiels.
 *
 * Aufruf (Playwright liegt in dieser Umgebung unter /opt/npm-tools):
 *   node tools/generate-brand.mjs
 */
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const bundle = await build({
  entryPoints: ["tools/brand/draw.ts"],
  bundle: true,
  write: false,
  format: "iife",
  define: { "import.meta.env.BASE_URL": '"/"' },
  logLevel: "error",
});

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.setContent("<body></body>");
// Die Schriften als eingebettete Dateien - die Seite hat keinen Zugriff auf die Platte.
const font = (file) => readFileSync(`node_modules/@fontsource/${file}`).toString("base64");
await page.addStyleTag({
  content: `
    @font-face { font-family: "Jersey 10"; src: url(data:font/woff2;base64,${font("jersey-10/files/jersey-10-latin-400-normal.woff2")}) format("woff2"); }
  `,
});
await page.addScriptTag({ content: bundle.outputFiles[0].text });
await page.evaluate(() => window.brand.ready);

const save = (path, dataUrl) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(dataUrl.split(",")[1], "base64"));
};
const icon = (size, scale, transparent) =>
  page.evaluate(([s, k, t]) => window.brand.icon(s, k, t), [size, scale, transparent]);
const splash = (w, h) => page.evaluate(([a, b]) => window.brand.splash(a, b), [w, h]);

// PWA
save("public/icons/icon-192.png", await icon(192, 1.0, false));
save("public/icons/icon-512.png", await icon(512, 1.0, false));
save("public/icons/icon-maskable-512.png", await icon(512, 0.7, false));

// Android
const RES = "android/app/src/main/res";
for (const [folder, size] of [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
]) {
  const png = await icon(size, 1.0, false);
  save(`${RES}/mipmap-${folder}/ic_launcher.png`, png);
  save(`${RES}/mipmap-${folder}/ic_launcher_round.png`, png);
}
for (const [folder, size] of [
  ["mdpi", 108],
  ["hdpi", 162],
  ["xhdpi", 216],
  ["xxhdpi", 324],
  ["xxxhdpi", 432],
]) {
  save(`${RES}/mipmap-${folder}/ic_launcher_foreground.png`, await icon(size, 0.6, true));
}
const sizes = {
  mdpi: [320, 480],
  hdpi: [480, 800],
  xhdpi: [720, 1280],
  xxhdpi: [960, 1600],
  xxxhdpi: [1280, 1920],
};
for (const [density, [w, h]] of Object.entries(sizes)) {
  save(`${RES}/drawable-port-${density}/splash.png`, await splash(w, h));
  save(`${RES}/drawable-land-${density}/splash.png`, await splash(h, w));
}
save(`${RES}/drawable/splash.png`, await splash(480, 320));

await browser.close();
console.log("Marken-Grafiken erzeugt");
