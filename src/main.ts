/**
 * Einstiegspunkt: baut die Phaser-Instanz und startet die erste Szene.
 */

import Phaser from "phaser";
import { COLORS, VIEWPORT } from "./config/constants";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  // AUTO nimmt WebGL, wenn das Geraet es kann, sonst Canvas.
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: COLORS.background,
  scale: {
    // FIT skaliert die feste Aufloesung auf den Bildschirm und behaelt das
    // Seitenverhaeltnis - dadurch sehen alle Geraete denselben Ausschnitt.
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
  },
  render: {
    antialias: true,
    // Verhindert Weisspixel an den Raendern gezeichneter Formen auf manchen Handys.
    roundPixels: false,
  },
  // Die Simulation rechnet selbst mit festem Takt, deshalb braucht Phaser hier
  // keine eigene Physik-Engine (siehe CLAUDE.md, Architektur-Grundregel).
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);
