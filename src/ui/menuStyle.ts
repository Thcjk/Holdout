/**
 * Der gemeinsame Look aller Bildschirme ausserhalb des Gefechts.
 *
 * Abenddaemmerung im Grauland (gemalt in `landscape.ts`): schieferblauer Himmel
 * mit Sternen und Mond, Berge in Schichten und rechts die Feste Holdout auf ihrem
 * Huegel. Darauf liegen Pergament-Tafeln mit Holzrahmen.
 */

import type Phaser from "phaser";
import { VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { BOX, ComicBox } from "./ComicBox";
import { landscapeGrain, paintLandscape } from "./landscape";

const BACKGROUND_KEY = "menu-background";
/** Breiter als jede Entwurfsflaeche (max. 1600) - dann reicht EINE Textur. */
const BACKGROUND_WIDTH = 1600;
const BACKGROUND_HEIGHT = 540;
/** Etwas feiner gemalt, als es angezeigt wird - dann bleiben die Konturen scharf. */
const BACKGROUND_SCALE = 1.5;

/**
 * Der Hintergrund: die Landschaft mit der Feste (`landscape.ts`). Einmal gemalt,
 * dann als Textur wiederverwendet.
 */
export function menuBackground(scene: Phaser.Scene): Phaser.GameObjects.Image {
  if (!scene.textures.exists(BACKGROUND_KEY)) {
    const canvas = document.createElement("canvas");
    canvas.width = BACKGROUND_WIDTH * BACKGROUND_SCALE;
    canvas.height = BACKGROUND_HEIGHT * BACKGROUND_SCALE;
    const context = canvas.getContext("2d");
    if (context) {
      context.scale(BACKGROUND_SCALE, BACKGROUND_SCALE);
      paintLandscape(context, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
      landscapeGrain(context, canvas.width, canvas.height);
    }
    scene.textures.addCanvas(BACKGROUND_KEY, canvas)?.setFilter(1);
  }
  // Mittig: Burg und Mond sitzen um die Mitte der Textur, egal wie breit der Bildschirm ist.
  return scene.add
    .image(VIEWPORT.width / 2, 0, BACKGROUND_KEY)
    .setOrigin(0.5, 0)
    .setDisplaySize(BACKGROUND_WIDTH, BACKGROUND_HEIGHT)
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
  const label = scene.add
    .text(x, y, text, {
      fontFamily: UI.font,
      fontSize: `${size}px`,
      color,
      fontStyle: bold ? "bold" : "normal",
      align: "center",
    })
    .setOrigin(0.5)
    // Heller Rand: lesbar auf Pergament und auf dem schieferblauen Hintergrund.
    .setStroke("#f4e4c1", Math.max(3, Math.round(size / 6)));
  return label;
}
