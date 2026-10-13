/**
 * Die Figuren als Texturen: sechs Helden und neun Monster.
 *
 * Gezeichnet werden sie in `figures/heroes.ts` und `figures/monsters.ts` (100er-
 * Raster, Werkzeuge in `figures/kit.ts`). Hier werden sie beim Start auf
 * Leinwaende gemalt, bekommen ein feines Korn und einen gleichmaessigen dunklen
 * Aussenumriss (`inkify`) und werden als Phaser-Texturen angemeldet.
 *
 * Jede Figur schaut leicht nach RECHTS; das Spiel spiegelt sie, wenn sie nach
 * links laeuft.
 */

import type Phaser from "phaser";
import { characterKey, enemyKey } from "../config/assets";
import { CHARACTER_IDS } from "../game/data/characters";
import type { CharacterId, EnemyType } from "../game/types";
import { drawHero } from "./figures/heroes";
import { grainOver, LINE } from "./figures/kit";
import { drawMonster } from "./figures/monsters";

/** Kantenlaenge einer Figurentextur in Pixeln. */
const SIZE = 208;
/** Rand um das 100er-Raster (Platz fuer den Aussenumriss). */
const PAD = 6;

/**
 * Rechnet einen Massstab (bezogen auf ein 78 Pixel grosses Figurenraster) in den
 * Texturmassstab um: Mit `figureScale(1)` ist die Figur etwa 78 Pixel gross.
 */
export function figureScale(designScale: number): number {
  return (designScale * 78) / (SIZE - PAD * 2);
}

function canvas2d(width: number, height = width): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  return ctx ? [canvas, ctx] : null;
}

/**
 * Gibt einer gemalten Leinwand einen gleichmaessigen dunklen Aussenumriss:
 * Die Silhouette wird ringsum versetzt dahinter gestempelt. Weiche Leuchtscheine
 * (halb durchsichtig) bekommen keinen Umriss. Liefert eine neue Leinwand.
 */
export function inkify(artCanvas: HTMLCanvasElement, outline = 2.2): HTMLCanvasElement {
  const width = artCanvas.width;
  const height = artCanvas.height;
  const silhouette = canvas2d(width, height);
  const out = canvas2d(width, height);
  if (!silhouette || !out) {
    return artCanvas;
  }
  const [silCanvas, sctx] = silhouette;
  sctx.drawImage(artCanvas, 0, 0);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = LINE;
  sctx.fillRect(0, 0, width, height);
  const data = sctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.data.length; i += 4) {
    data.data[i] = (data.data[i] ?? 0) > 150 ? 255 : 0;
  }
  sctx.putImageData(data, 0, 0);
  const [outCanvas, octx] = out;
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    octx.drawImage(silCanvas, Math.cos(a) * outline, Math.sin(a) * outline);
  }
  octx.drawImage(artCanvas, 0, 0);
  return outCanvas;
}

/** Malt eine Figur in eine quadratische Leinwand der Groesse `size`. */
function render(size: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement | null {
  const art = canvas2d(size);
  if (!art) {
    return null;
  }
  const [canvas, ctx] = art;
  const pad = (PAD * size) / SIZE;
  const unit = (size - pad * 2) / 100;
  ctx.save();
  ctx.translate(pad, pad);
  ctx.scale(unit, unit);
  draw(ctx);
  ctx.restore();
  grainOver(ctx, size, size, 0.06);
  return inkify(canvas, (2.4 * size) / SIZE);
}

function paint(scene: Phaser.Scene, key: string, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const canvas = render(SIZE, draw);
  if (canvas) {
    scene.textures.addCanvas(key, canvas)?.setFilter(1);
  }
}

/** Malt einen Helden in beliebiger Groesse (fuer App-Icon und Splash). */
export function renderHero(id: CharacterId, size: number): HTMLCanvasElement | null {
  return render(size, (ctx) => drawHero(ctx, id));
}

/** Malt ein Monster in beliebiger Groesse (fuer den Splash). */
export function renderMonster(type: EnemyType, size: number): HTMLCanvasElement | null {
  return render(size, (ctx) => drawMonster(ctx, type));
}

const ENEMY_TYPES_DRAWN: readonly EnemyType[] = ["grunt", "swarmer", "charger", "spitter", "bruiser", "elite", "boss", "exploder", "splitter"];

/** Malt alle Helden und Monster. Mehrfach aufrufen ist harmlos. */
export function createFigureTextures(scene: Phaser.Scene): void {
  for (const id of CHARACTER_IDS) {
    paint(scene, characterKey(id), (ctx) => drawHero(ctx, id));
  }
  for (const type of ENEMY_TYPES_DRAWN) {
    paint(scene, enemyKey(type), (ctx) => drawMonster(ctx, type));
  }
}
