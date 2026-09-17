/**
 * Ergebnisbildschirm: Punkte, erreichte Welle, Rekord, Neustart.
 *
 * Bewusst kurz und mit einem grossen Knopf: Der Reiz des Spiels ist "gleich
 * nochmal", und alles, was dazwischen steht, kostet genau diesen Impuls.
 */

import Phaser from "phaser";
import { COLORS, VIEWPORT } from "../config/constants";
import { loadHighscore, saveHighscore } from "../storage/highscore";

export interface GameOverData {
  score: number;
  wave: number;
}

export class GameOverScene extends Phaser.Scene {
  private data_!: GameOverData;

  constructor() {
    super("GameOver");
  }

  init(data: GameOverData): void {
    this.data_ = data;
  }

  create(): void {
    const isRecord = saveHighscore(this.data_.score, this.data_.wave);
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
      .text(VIEWPORT.width / 2, 190, `Welle ${this.data_.wave}   ·   ${this.data_.score} Punkte`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#ffd166",
      })
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

    this.createButton(VIEWPORT.height / 2 + 120, "Nochmal", () => {
      this.scene.start("Game");
    });

    this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height - 28, "Tippen oder Leertaste startet neu", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#8ea6c4",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-SPACE", () => this.scene.start("Game"));
  }

  private createButton(y: number, label: string, onClick: () => void): void {
    const width = 240;
    const height = 58;
    const x = VIEWPORT.width / 2;

    const background = this.add.rectangle(x, y, width, height, COLORS.player, 0.9);
    background.setStrokeStyle(3, COLORS.playerOutline);
    background.setInteractive({ useHandCursor: true });

    this.add
      .text(x, y, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#11161f",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onClick);
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      background.setFillStyle(COLORS.playerOutline, 1),
    );
    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      background.setFillStyle(COLORS.player, 0.9),
    );
  }
}
