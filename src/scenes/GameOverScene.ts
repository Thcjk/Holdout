/**
 * Ergebnisbildschirm: Punkte, erreichte Welle, Rekord, Neustart.
 *
 * Bewusst kurz und mit einem grossen Knopf: Der Reiz des Spiels ist "gleich
 * nochmal", und alles, was dazwischen steht, kostet genau diesen Impuls.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { COLORS, VIEWPORT } from "../config/constants";
import { loadHighscore, saveHighscore } from "../storage/highscore";
import type { CharacterId } from "../systems/types";
import { Button } from "../ui/Button";

export interface GameOverData {
  score: number;
  wave: number;
  character: CharacterId;
}

export class GameOverScene extends Phaser.Scene {
  private result!: GameOverData;

  constructor() {
    super("GameOver");
  }

  init(data: GameOverData): void {
    this.result = data;
  }

  create(): void {
    const isRecord = saveHighscore(this.result.score, this.result.wave);
    const best = loadHighscore();

    this.cameras.main.setBackgroundColor(COLORS.background);

    this.add
      .text(VIEWPORT.width / 2, 110, "Runde vorbei", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "44px",
        color: "#dce8f7",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(
        VIEWPORT.width / 2,
        190,
        `Welle ${this.result.wave}   ·   ${this.result.score} Punkte`,
        { fontFamily: "system-ui, sans-serif", fontSize: "26px", color: "#ffd166" },
      )
      .setOrigin(0.5);

    this.add
      .text(
        VIEWPORT.width / 2,
        240,
        isRecord
          ? "Neuer Rekord!"
          : `Dein Rekord: ${best?.score ?? 0} Punkte (Welle ${best?.wave ?? 0})`,
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          color: isRecord ? "#7ee08a" : "#8ea6c4",
        },
      )
      .setOrigin(0.5);

    new Button(this, VIEWPORT.width / 2 - 132, 380, "Nochmal", () => this.restart(), {
      width: 230,
    });

    new Button(
      this,
      VIEWPORT.width / 2 + 132,
      380,
      "Charakter wechseln",
      () => this.scene.start("Menu"),
      { width: 230, fontSize: 18, color: COLORS.hudDim },
    );

    this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height - 28, "Leertaste startet sofort neu", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#8ea6c4",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-SPACE", () => this.restart());
  }

  private restart(): void {
    audio.unlock();
    this.scene.start("Game", { character: this.result.character });
  }
}
