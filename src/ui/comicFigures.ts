/**
 * Massstaebe und Grossbilder der Pixel-Figuren.
 *
 * Gemalt werden die Figuren in `pixel/heroes.ts` (64 x 64) und
 * `pixel/enemies.ts` (48 x 48), angemeldet in `pixel/textures.ts`.
 * (Der Dateiname stammt aus der Comic-Fassung.)
 */

import type { CharacterId, EnemyType } from "../game/types";
import { drawEnemyPixels, ENEMY_SIZE } from "./pixel/enemies";
import { HERO_SIZE, paintHero } from "./pixel/heroes";

/**
 * Massstab fuer Helden: Mit `figureScale(1)` ist die Figur etwa 78 Entwurfspixel
 * gross (im Spiel 0.8 - dann ist ein Bildpixel ungefaehr ein Entwurfspixel).
 */
export function figureScale(designScale: number): number {
  return (designScale * 78) / HERO_SIZE;
}

/**
 * Massstab fuer Gegner nach ihrem Trefferkreis: Das Bild ist etwas groesser als
 * der Kreis. Grosse Gegner werden begrenzt, damit ihre Pixel nicht zu grob werden.
 */
export function enemyFigureScale(radius: number): number {
  const size = Math.min(150, (radius / 15) * 78);
  return size / ENEMY_SIZE;
}

/** Ein Held gross, mit harten Pixeln (Icon, Splash). */
export function renderHero(id: CharacterId, size: number): HTMLCanvasElement {
  return scaled(paintHero(id).toCanvas(), size);
}

/** Ein Gegner gross, mit harten Pixeln (Splash). */
export function renderMonster(type: EnemyType, size: number): HTMLCanvasElement {
  return scaled(drawEnemyPixels(type).toCanvas(), size);
}

function scaled(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, size, size);
  }
  return canvas;
}
