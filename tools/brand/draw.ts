/**
 * Zeichnet App-Icon und Splash mit derselben Pixel-Art wie das Spiel. Laeuft im
 * Browser (siehe `tools/generate-brand.mjs`).
 *
 * Icon: der Schrauber vor dem goldenen Sonnenherz und einem Daemmerungshimmel.
 * Splash: die Wanderfestung auf dem Wuestenboden, darueber der Schriftzug.
 */

import { paintCrew } from "../../src/ui/pixel/crew";
import { FORT_H, FORT_W, paintFortress, paintModule, tileFoot } from "../../src/ui/pixel/festung";
import { paintDesert } from "../../src/ui/pixel/wueste";

function make(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

/** Daemmerung: oben dunkles Violett, unten warmes Rostrot. */
function dusk(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#1c1426");
  sky.addColorStop(0.6, "#4a2c34");
  sky.addColorStop(1, "#6e4a42");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
}

/** Icon: Mech gross in der Mitte. `scale` = Anteil der Kantenlaenge. */
export function icon(size: number, scale: number, transparent: boolean): string {
  const [canvas, ctx] = make(size, size);
  if (!transparent) {
    dusk(ctx, size, size);
    // Goldene Sonne hinter dem Kopf
    const glow = ctx.createRadialGradient(
      size / 2,
      size * 0.42,
      0,
      size / 2,
      size * 0.42,
      size * 0.42,
    );
    glow.addColorStop(0, "rgba(255,210,120,0.95)");
    glow.addColorStop(0.45, "rgba(240,160,60,0.55)");
    glow.addColorStop(1, "rgba(240,160,60,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  }
  // Der ganze Mech, etwas groesser als die halbe Kante (Raster 64, Mitte bei ~x 32, y 33).
  const mech = paintCrew("schrauber").toCanvas();
  const s = (size * scale * 0.9) / 64;
  ctx.drawImage(mech, size / 2 - 32 * s, size * 0.5 - 33 * s, 64 * s, 64 * s);
  return canvas.toDataURL("image/png");
}

export function splash(width: number, height: number): string {
  const [canvas, ctx] = make(width, height);
  const unit = Math.max(1, Math.floor(Math.min(width / 520, height / 300)));
  const ground = paintDesert(Math.ceil(width / unit), Math.ceil(height / unit), {
    seed: 11,
  }).toCanvas();
  ctx.drawImage(ground, 0, 0, ground.width * unit, ground.height * unit);
  // Festung mit Herz, Motor und Bruecke
  const fort = make(FORT_W, FORT_H);
  fort[1].drawImage(paintFortress().toCanvas(), 0, 0);
  const place = (
    id: "herz" | "bruecke" | "motor",
    col: number,
    row: number,
    cols: number,
  ): void => {
    const image = paintModule(id).toCanvas();
    const [fx, fy] = tileFoot(col, row);
    fort[1].drawImage(image, fx + (cols - 1) * 20 - image.width / 2, fy + 4 - image.height);
  };
  place("motor", 0, 1, 2);
  place("herz", 3, 2, 2);
  place("bruecke", 6, 2, 1);
  const x = Math.round((width - FORT_W * unit) / 2);
  const y = Math.round(height * 0.62 - (FORT_H * unit) / 2);
  ctx.drawImage(fort[0], x, y, FORT_W * unit, FORT_H * unit);
  // Schriftzug
  const titleSize = Math.round(Math.min(width * 0.16, height * 0.2));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${titleSize}px "Jersey 10"`;
  ctx.lineJoin = "round";
  ctx.lineWidth = titleSize / 9;
  ctx.strokeStyle = "#120f1e";
  ctx.fillStyle = "#5e3a14";
  ctx.fillText("HOLDOUT", width / 2, height * 0.17 + titleSize * 0.06);
  ctx.strokeText("HOLDOUT", width / 2, height * 0.17);
  ctx.fillStyle = "#f0b23e";
  ctx.fillText("HOLDOUT", width / 2, height * 0.17);
  return canvas.toDataURL("image/png");
}

async function prepare(): Promise<void> {
  await document.fonts.load(`48px "Jersey 10"`);
}

(window as unknown as Record<string, unknown>).brand = { icon, splash, ready: prepare() };
