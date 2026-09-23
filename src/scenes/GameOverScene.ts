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
  /**
   * Wurde im Koop gespielt?
   *
   * DAS WAR EIN ECHTER FEHLER, kein Schoenheitsfehler. "Nochmal" startete die
   * Spielszene ohne Sitzung - und die legt sich dann eine `SoloSession` an.
   * Nach einem Koop-Run landete man also stillschweigend allein in einer neuen
   * Welt, waehrend die Mitspieler noch dasassen. Nichts sagte das an.
   *
   * Im Koop darf ein neuer Run nur vom Host ausgehen: Er wuerfelt den Seed und
   * schickt ihn an alle (`Lobby.start()`). Deshalb fuehrt der Knopf dort
   * zurueck in die Lobby, statt einen zweiten Startweg zu erfinden, der
   * dasselbe noch einmal anders macht.
   */
  coop: boolean;
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

  private restartButton!: Button;

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

    /*
     * Der Hinweis, dass die naechste Welt eine andere ist.
     *
     * Jeder Run zieht einen frischen Seed, die Karte ist also wirklich neu -
     * nur sieht man das einer prozeduralen Welt nicht sofort an, weil sie
     * ueberall aus denselben Bausteinen besteht. Ein Satz kostet nichts und
     * beantwortet die Frage, bevor sie entsteht.
     */
    this.add
      .text(
        VIEWPORT.width / 2,
        300,
        this.result.coop
          ? "Neue Welt, neuer Raum - die Verbindung endet mit dem Run."
          : "Ein neuer Run bekommt eine neue Welt.",
        { fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#8ea6c4" },
      )
      .setOrigin(0.5);

    this.restartButton = new Button(
      this,
      VIEWPORT.width / 2 - 132,
      380,
      this.result.coop ? "Zur Lobby" : "Neuer Run",
      () => this.restart(),
      { width: 230 },
    );

    new Button(
      this,
      VIEWPORT.width / 2 + 132,
      380,
      "Charakter wechseln",
      () => this.scene.start("Menu"),
      { width: 230, fontSize: 18, color: COLORS.hudDim },
    );
  }

  /**
   * Startet den naechsten Run - und zeigt dabei, dass etwas passiert.
   *
   * Die Welt entsteht aus einem Seed: ueber 500 Deckungsbloecke, Buschfelder,
   * Encounter und Ausstiege. Das dauert zwar nur Millisekunden, blockiert aber
   * das Bild - ohne Rueckmeldung sieht ein Antippen deshalb aus, als waere es
   * nicht angekommen, und man tippt ein zweites Mal.
   *
   * `delayedCall` statt eines direkten Aufrufs, damit Phaser den geaenderten
   * Text noch EINMAL zeichnet, bevor die Arbeit beginnt. Ohne diese Pause
   * wuerde die Beschriftung nie sichtbar - die neue Szene ist schneller da.
   */
  private restart(): void {
    audio.unlock();
    this.restartButton.setText("Welt wird gebaut ...");
    this.restartButton.setEnabled(false);

    this.time.delayedCall(60, () => {
      if (this.result.coop) {
        /*
         * Zurueck in die Lobby: Dort zieht der Host den neuen Seed und
         * schickt ihn an alle - derselbe Weg wie beim allerersten Start.
         *
         * WAS DABEI NICHT GEHT, und die Beschriftung sagt es deshalb auch:
         * Die Verbindung ueberlebt den Run nicht. `GameScene` raeumt beim
         * Verlassen die Sitzung ab, und die schliesst den Transport - der
         * Host schickt sogar ein "bye". Der Raum ist danach zu, alle
         * brauchen einen neuen Code.
         *
         * Das liesse sich aendern, waere aber kein kleiner Eingriff: Der
         * Transport muesste die Szene ueberleben, also jemand anderem
         * gehoeren als der Spielszene. Solange das nicht so ist, ist eine
         * ehrliche Beschriftung besser als ein Knopf, der Nahtlosigkeit
         * verspricht und dann in einer leeren Lobby endet.
         */
        this.scene.start("Lobby");
        return;
      }
      // Solo: `SoloSession` wuerfelt beim Anlegen einen neuen Seed, und
      // `createWorld` setzt Position, Leben und Munition ohnehin neu.
      this.scene.start("Game", { character: this.result.character });
    });
  }
}
