/**
 * Erste Szene. "Scene" ist in Phaser ein abgeschlossener Abschnitt des Spiels -
 * Menue, Spiel, Game Over sind je eine eigene Szene mit eigenem `create()` und `update()`.
 *
 * Phase 1 laedt noch nichts: Alles wird als farbige Form direkt gezeichnet
 * (Briefing, Abschnitt 7: erst ab Phase 5 echte Sprites). Diese Szene existiert
 * trotzdem schon, weil spaeter hier der Ladebalken und die Texture Atlanten liegen.
 */

import Phaser from "phaser";
import { COLORS } from "../config/constants";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
  }

  create(): void {
    this.scene.start("Game");
  }
}
