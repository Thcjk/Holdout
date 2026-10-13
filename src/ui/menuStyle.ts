/**
 * Der gemeinsame Look aller Bildschirme ausserhalb des Gefechts.
 *
 * Hintergrund: die Pixel-Welt bei Nacht (`pixel/world.ts`) - Tempelruine,
 * Kolosseum und darueber der violette Zeitriss. Darauf liegen Tafeln aus Bronze
 * und dunklem Stein mit Leuchtlinien (`ComicBox`).
 */

import type Phaser from "phaser";
import { VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { FONT_TITLE, T } from "./theme";
import { BOX, ComicBox } from "./ComicBox";
import { MENU_BACKGROUND_KEY } from "./pixel/textures";
import { MENU_H, MENU_W } from "./pixel/world";

/** Ein Bildpixel des Menuebilds = 3 Entwurfspixel (540 / 180). */
const MENU_SCALE = 3;

/** Der Hintergrund (beim Start in `pixel/textures.ts` gemalt), mittig ausgerichtet. */
export function menuBackground(scene: Phaser.Scene): Phaser.GameObjects.Image {
  return scene.add
    .image(VIEWPORT.width / 2, 0, MENU_BACKGROUND_KEY)
    .setOrigin(0.5, 0)
    .setDisplaySize(MENU_W * MENU_SCALE, MENU_H * MENU_SCALE)
    .setDepth(-100)
    .setScrollFactor(0);
}

/** Eine Tafel (Mittelpunkt, Groesse). */
export function woodPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number): ComicBox {
  return new ComicBox(scene, BOX.panel, x, y, width, height);
}

/** Eine beige Einlage - fuer Dinge, die man lesen soll (Code, Namen). */
export function insetPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number): ComicBox {
  return new ComicBox(scene, BOX.inset, x, y, width, height);
}

/** Text im Menue-Look, zentriert, mit leichtem Schatten. */
export function menuText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color: string = UI.text.body,
  bold = false,
): Phaser.GameObjects.Text {
  // Grosse Ueberschriften in der hohen Titelschrift, alles andere in der Textschrift.
  const title = bold && size >= 24;
  const label = scene.add
    .text(x, y, text, {
      fontFamily: title ? FONT_TITLE : UI.font,
      fontSize: `${title ? Math.round(size * 1.35) : size}px`,
      color,
      fontStyle: bold && !title ? "bold" : "normal",
      align: "center",
    })
    .setOrigin(0.5)
    // Dunkler Rand: lesbar auf Stein und auf dem Nachthimmel.
    .setStroke(T.outline, Math.max(3, Math.round(size / 6)));
  return label;
}
