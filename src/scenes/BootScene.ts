/**
 * Erste Szene. "Scene" ist in Phaser ein abgeschlossener Abschnitt des Spiels -
 * Menue, Spiel, Game Over sind je eine eigene Szene mit eigenem `create()` und `update()`.
 *
 * Hier werden die Texturen erzeugt und anschliessend ins Spiel gewechselt.
 */

import Phaser from "phaser";
import { buildAtlas } from "../assets/textures";
import { COLORS } from "../config/constants";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
  }

  create(): void {
    buildAtlas(this);
    this.scene.start("Menu");
  }
}
