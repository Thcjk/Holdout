/**
 * Gemeinsames fuer die Menues (Crew, Werft, Erfolge): Hintergrund, Ueberschrift,
 * Zurueck-Knopf und die Altgold-Anzeige.
 */

import type Phaser from "phaser";
import { SAFE, VIEWPORT } from "../config/constants";
import { Button } from "./Button";
import { BOX, ComicBox } from "./ComicBox";
import { TEX } from "./pixel/textures";
import { FONT_BODY, FONT_TITLE, T } from "./theme";

/** Wuestenboden, abgedunkelt, mit Ueberschrift oben links und Zurueck oben rechts. */
export function menuBackdrop(scene: Phaser.Scene, title: string, back: () => void): void {
  const w = VIEWPORT.width;
  const h = VIEWPORT.height;
  scene.add.tileSprite(0, 0, w, h, TEX.ground).setOrigin(0, 0);
  scene.add.rectangle(0, 0, w, h, 0x0e0a12, 0.72).setOrigin(0, 0);
  scene.add
    .text(SAFE.left + 20, 32, title, { fontFamily: FONT_TITLE, fontSize: "40px", color: T.gold })
    .setOrigin(0, 0.5)
    .setStroke(T.outline, 6);
  new Button(scene, w - SAFE.right - 70, 32, "ZURÜCK", back, {
    width: 120,
    height: 40,
    fontSize: 16,
    variant: "secondary",
  });
}

/** Altgold oben, links neben dem Zurueck-Knopf. Gibt den Text zurueck (zum Aktualisieren). */
export function altgoldBadge(scene: Phaser.Scene, amount: number): Phaser.GameObjects.Text {
  const right = VIEWPORT.width - SAFE.right - 150;
  new ComicBox(scene, BOX.panel, right - 80, 32, 160, 42);
  scene.add.circle(right - 140, 32, 9, 0xf0b23e).setStrokeStyle(2, 0x120f1e);
  scene.add.circle(right - 142, 30, 3, 0xfff2a0);
  scene.add
    .text(right - 124, 32, "Altgold", { fontFamily: FONT_BODY, fontSize: "12px", color: T.muted })
    .setOrigin(0, 0.5);
  return scene.add
    .text(right - 12, 31, `${amount}`, { fontFamily: FONT_TITLE, fontSize: "28px", color: T.gold })
    .setOrigin(1, 0.5)
    .setStroke(T.outline, 4);
}

/** Kleiner Text mit Rand. */
export function label(
  scene: Phaser.Scene,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  options: { width?: number; font?: string; align?: "left" | "center" | "right" } = {},
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: options.font ?? FONT_BODY,
      fontSize: `${size}px`,
      color,
      align: options.align ?? "left",
      lineSpacing: 3,
      ...(options.width ? { wordWrap: { width: options.width } } : {}),
    })
    .setStroke(T.outline, Math.max(3, Math.round(size / 5)));
}
