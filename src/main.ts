/**
 * Einstiegspunkt: baut die Phaser-Instanz und startet die erste Szene.
 */

import Phaser from "phaser";
import { COLORS, VIEWPORT } from "./config/constants";
import { BootScene } from "./scenes/BootScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { GameScene } from "./scenes/GameScene";
import { HudScene } from "./scenes/HudScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { MenuScene } from "./scenes/MenuScene";

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
  dom: {
    // Erlaubt echte HTML-Elemente ueber dem Canvas. Gebraucht wird das nur fuer
    // das Raumcode-Feld: Nur ein echtes Eingabefeld oeffnet auf dem Handy die
    // Systemtastatur.
    createContainer: true,
  },
  input: {
    // Drei gleichzeitige Finger: linker Stick, rechter Stick, Super-Knopf.
    // Ohne diese Zeile meldet Phaser nur einen Zeiger, und der zweite Daumen
    // wird stillschweigend ignoriert.
    activePointers: 4,
  },
  render: {
    antialias: true,
    // Verhindert Weisspixel an den Raendern gezeichneter Formen auf manchen Handys.
    roundPixels: false,
  },
  // Die Simulation rechnet selbst mit festem Takt, deshalb braucht Phaser hier
  // keine eigene Physik-Engine (siehe CLAUDE.md, Architektur-Grundregel).
  scene: [BootScene, MenuScene, LobbyScene, GameScene, HudScene, GameOverScene],
};

new Phaser.Game(config);
