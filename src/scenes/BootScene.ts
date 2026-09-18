/**
 * Erste Szene. "Scene" ist in Phaser ein abgeschlossener Abschnitt des Spiels -
 * Menue, Spiel, Game Over sind je eine eigene Szene mit eigenem `create()` und `update()`.
 *
 * Hier werden die Texturen erzeugt und anschliessend ins Spiel gewechselt.
 */

import Phaser from "phaser";
import { buildAtlas } from "../assets/textures";
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
    // Projektile, Funken und Punkte bleiben gezeichnet: Das Paket hat dafuer
    // nichts Passendes, und abstrakte Punkte passen in jeden Stil.
    buildAtlas(this);
    this.scene.start("Menu");
  }
}
