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
import { setReloadSafe } from "../platform/update";

export interface GameOverData {
  score: number;
  /** Tiefste erreichte Distanzzone - Nachfolger der Wellennummer. */
  zone: number;
  character: CharacterId;
}

/**
 * Die Rekordzeile.
 *
 * Alte Rekorde aus der Wellen-Zeit haben keine Zone. Statt eine zu erfinden,
 * steht dort nur die Punktzahl - sie ist das Einzige, was ueber beide Fassungen
 * hinweg dasselbe bedeutet.
 */
function recordLine(best: ReturnType<typeof loadHighscore>): string {
  if (!best) {
    return "Dein Rekord: 0 Punkte";
  }
  return best.zone === undefined
    ? `Dein Rekord: ${best.score} Punkte`
    : `Dein Rekord: ${best.score} Punkte (Zone ${best.zone})`;
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
    // Hier nicht neu laden: Das wuerde diesen Bildschirm wegwischen.
    setReloadSafe(false);
    const isRecord = saveHighscore(this.result.score, this.result.zone);
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
        `Zone ${this.result.zone}   ·   ${this.result.score} Punkte`,
        { fontFamily: "system-ui, sans-serif", fontSize: "26px", color: "#ffd166" },
      )
      .setOrigin(0.5);

    this.add
      .text(
        VIEWPORT.width / 2,
        240,
        isRecord
          ? "Neuer Rekord!"
          : recordLine(best),
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
  }

  private restart(): void {
    audio.unlock();
    this.scene.start("Game", { character: this.result.character });
  }
}
