/**
 * Erste Szene. "Scene" ist in Phaser ein abgeschlossener Abschnitt des Spiels -
 * Menue, Spiel, Game Over sind je eine eigene Szene mit eigenem `create()` und `update()`.
 *
 * Hier wird das Kenney-Sheet geladen und anschliessend ins Menue gewechselt.
 */

import Phaser from "phaser";
import { SHEET_KEY, SHEET_PATH, SPACING, TILE } from "../config/assets";
import { COLORS } from "../config/constants";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    /*
     * Das Pixel-Art-Sheet von Kenney.
     *
     * `spritesheet` und nicht `atlas`/`atlasXML`: Das Paket bringt keine Datei
     * mit Koordinaten mit, dafuer ein gleichmaessiges Raster. Die Masse stehen
     * in `config/assets.ts` und sind dort nachgerechnet.
     */
    this.load.spritesheet(SHEET_KEY, SHEET_PATH, {
      frameWidth: TILE,
      frameHeight: TILE,
      spacing: SPACING,
    });
  }

  create(): void {
    // Bis Etappe 5 wurde hier ein zweiter, selbst GEZEICHNETER Atlas gebaut
    // (Projektile, Funken, Punkte). Seitdem kommt alles aus dem Sheet - auch
    // Geschosse und Partikel (`BULLET_TILE`, `PARTICLE_TILES`).
    this.scene.start("Menu");
  }
}
