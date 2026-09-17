/**
 * Zentrale Stelle fuer alle Grafiken.
 *
 * Solange es keine echten Sprites gibt, werden die Texturen hier zur Laufzeit
 * gezeichnet. Der Punkt dieser Datei ist nicht die Grafik selbst, sondern die
 * Schnittstelle: Im Spielcode steht nur noch `TEXTURES.runner`, nie ein Dateiname.
 * Ein Wechsel auf echte Sprites (Briefing, Abschnitt 7) tauscht dann diese eine
 * Datei aus, statt fuenfzig Stellen im Spiel.
 */

import Phaser from "phaser";
import { COLORS } from "../config/constants";

export const TEXTURES = {
  dot: "tex-dot",
  spark: "tex-spark",
} as const;

/** Erzeugt alle Texturen. Wird einmal in der BootScene aufgerufen. */
export function createTextures(scene: Phaser.Scene): void {
  createCircleTexture(scene, TEXTURES.dot, 8, 0xffffff);
  createCircleTexture(scene, TEXTURES.spark, 6, COLORS.playerBullet);
}

function createCircleTexture(
  scene: Phaser.Scene,
  key: string,
  radius: number,
  color: number,
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  graphics.fillStyle(color, 1);
  graphics.fillCircle(radius, radius, radius);
  graphics.generateTexture(key, radius * 2, radius * 2);
  graphics.destroy();
}
