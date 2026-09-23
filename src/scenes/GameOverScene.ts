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
import type { CharacterId, RunOutcome } from "../systems/types";
import { Button } from "../ui/Button";
import { setReloadSafe } from "../platform/update";

export interface GameOverData {
  score: number;
  /** Tiefste erreichte Distanzzone - Nachfolger der Wellennummer. */
  zone: number;
  /** Wie der Run ausgegangen ist. Seit Phase 9 kann er auch gut enden. */
  outcome: RunOutcome;
  character: CharacterId;
}

/**
 * Titel und Farbe je Ausgang.
 *
 * Bis Phase 9 stand hier immer "Runde vorbei" - es gab ja nur einen Ausgang.
 * Jetzt sind es drei, und der Unterschied ist der ganze Sinn des Umbaus: Wer
 * rechtzeitig aussteigt, hat etwas richtig gemacht, und das muss der
 * Bildschirm auch sagen. Stuende dort nach einer geglueckten Extraktion
 * dasselbe wie nach einem Team-Wipe, waere die Entscheidung, um die sich der
 * Run dreht, nachtraeglich entwertet.
 */
const OUTCOMES: Record<RunOutcome, { title: string; color: string; note: string }> = {
  wipe: {
    title: "Team am Boden",
    color: "#ff5470",
    note: "Kein Ausstieg geschafft.",
  },
  extracted: {
    title: "Extrahiert",
    color: "#7ee08a",
    note: "Rechtzeitig rausgekommen.",
  },
  bossDefeated: {
    title: "Wächter besiegt",
    color: "#ffd166",
    note: "Der Ende-Boss ist gefallen - mehr geht nicht.",
  },
};

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

    const outcome = OUTCOMES[this.result.outcome] ?? OUTCOMES.wipe;

    this.add
      .text(VIEWPORT.width / 2, 100, outcome.title, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "44px",
        color: outcome.color,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(VIEWPORT.width / 2, 142, outcome.note, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#8ea6c4",
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
