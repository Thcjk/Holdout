/**
 * Ergebnisbildschirm: Punkte, erreichte Welle, Rekord, Neustart.
 *
 * Bewusst kurz und mit einem grossen Knopf: Der Reiz des Spiels ist "gleich
 * nochmal", und alles, was dazwischen steht, kostet genau diesen Impuls.
 */

import { STORY } from "../config/story";
import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { PALETTE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { menuBackground, woodPanel } from "../ui/menuStyle";
import { loadHighscore, saveHighscore } from "../storage/highscore";
import type { CharacterId, RunOutcome } from "../systems/types";
import { Button } from "../ui/Button";
import { setReloadSafe } from "../platform/update";
import type { Transport } from "../net/Transport";

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
  /** Wie viele Gegenstaende der Run eingebracht oder gekostet hat. */
  loot: { kept: number; lost: number };
  /**
   * Die offene Koop-Verbindung (seit Etappe 7). Sie geht mit "Neuer Run"
   * weiter zum Packen und von dort in denselben Raum - oder wird bei
   * "Charakter wechseln" geschlossen.
   */
  transport?: Transport;
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
    color: PALETTE.danger,
    note: "Kein Ausstieg geschafft.",
  },
  extracted: {
    title: "Extrahiert",
    color: PALETTE.success,
    note: "Rechtzeitig rausgekommen – die Beute ist in Sicherheit.",
  },
  bossDefeated: {
    title: "Wächter besiegt",
    color: "#ffd166",
    // Das Ende der Geschichte (`config/story.ts`).
    note: STORY.victory,
  },
  // Normalerweise fuehrt ein Ausgang zur Karte, nicht hierher (`MapScene`).
  // Nur fuer den Fall, dass ein Run ohne Karte ueber einen Ausgang endet.
  exited: {
    title: "Gebiet verlassen",
    color: PALETTE.success,
    note: "Weiter auf der Karte.",
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

    menuBackground(this);
    // Die Zahlen liegen auf einer Holztafel wie Karte und Lobby - der Titel
    // darueber auf dem Hintergrund, damit seine Farbe (rot/gruen/gold)
    // nicht gegen das Holz kaempfen muss.
    woodPanel(this, VIEWPORT.width / 2, 222, Math.min(760, VIEWPORT.width - 120), 200);

    const outcome = OUTCOMES[this.result.outcome] ?? OUTCOMES.wipe;

    this.add
      .text(VIEWPORT.width / 2, 58, outcome.title, {
        fontFamily: UI.font,
        fontSize: "44px",
        color: outcome.color,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setShadow(2, 3, UI.text.shadow, 4);

    this.add
      .text(VIEWPORT.width / 2, 100, outcome.note, {
        fontFamily: UI.font,
        fontSize: "16px",
        color: UI.text.body,
        align: "center",
        wordWrap: { width: VIEWPORT.width - 160 },
      })
      .setOrigin(0.5)
      .setShadow(1, 2, UI.text.shadow, 3);

    this.add
      .text(
        VIEWPORT.width / 2,
        168,
        `Zone ${this.result.zone}   ·   ${this.result.score} Punkte`,
        { fontFamily: UI.font, fontSize: "26px", color: UI.text.accent, fontStyle: "bold" },
      )
      .setOrigin(0.5)
      .setShadow(1, 2, UI.text.shadow, 3);

    this.add
      .text(
        VIEWPORT.width / 2,
        208,
        isRecord
          ? "Neuer Rekord!"
          : recordLine(best),
        {
          fontFamily: UI.font,
          fontSize: "18px",
          color: isRecord ? PALETTE.success : UI.text.body,
        },
      )
      .setOrigin(0.5)
      .setShadow(1, 2, UI.text.shadow, 3);

    /*
     * Der Hinweis, dass die naechste Welt eine andere ist.
     *
     * Jeder Run zieht einen frischen Seed, die Karte ist also wirklich neu -
     * nur sieht man das einer prozeduralen Welt nicht sofort an, weil sie
     * ueberall aus denselben Bausteinen besteht. Ein Satz kostet nichts und
     * beantwortet die Frage, bevor sie entsteht.
     */
    /*
     * Die Beutezeile - und sie sagt beides aus, auch das Unangenehme.
     *
     * Nach einem Wipe steht dort ausdruecklich, WIE VIEL verloren ist. Das
     * ist der Moment, in dem die Entscheidung "noch tiefer oder raus"
     * nachtraeglich ihren Preis bekommt; ihn zu verschweigen waere, den
     * ganzen Sinn des Aussteigens zu verschweigen.
     */
    const loot = this.result.loot;
    this.add
      .text(
        VIEWPORT.width / 2,
        242,
        loot.lost > 0
          ? // Das Team ist raus, man selbst lag aber am Boden ausserhalb der
            // Zone. Ohne diesen Zusatz stuende "Extrahiert" ueber "verloren".
            this.result.outcome === "wipe"
            ? `${loot.lost} Gegenstände verloren`
            : `Am Boden zurückgelassen – ${loot.lost} Gegenstände verloren`
          : loot.kept > 0
            ? `${loot.kept} Gegenstände gesichert`
            : "Keine Beute gemacht",
        {
          fontFamily: UI.font,
          fontSize: "17px",
          // Auf Holz heller als die Palettenfarben, sonst kaum lesbar.
          color: loot.lost > 0 ? "#ff8a65" : loot.kept > 0 ? "#b5e08c" : UI.text.body,
          fontStyle: "bold",
        },
      )
      .setOrigin(0.5)
      .setShadow(1, 2, UI.text.shadow, 3);

    this.add
      .text(
        VIEWPORT.width / 2,
        284,
        this.result.coop
          ? "Gleicher Raum, neue Welt - der Host startet, sobald alle gepackt haben."
          : "Ein neuer Run bekommt eine neue Welt.",
        { fontFamily: UI.font, fontSize: "14px", color: UI.text.muted },
      )
      .setOrigin(0.5)
      .setShadow(1, 2, UI.text.shadow, 3);

    this.restartButton = new Button(
      this,
      VIEWPORT.width / 2 - 132,
      380,
      "Neuer Run",
      () => this.restart(),
      { width: 230 },
    );

    new Button(
      this,
      VIEWPORT.width / 2 + 132,
      380,
      "Charakter wechseln",
      () => {
        // Wer den Charakter wechselt, verlaesst den Raum: Das Menue kennt
        // keine offene Verbindung, und eine vergessene hielte den Raum fuer
        // die anderen offen, obwohl niemand mehr kommt.
        this.result.transport?.close();
        this.scene.start("Menu", { coop: this.result.coop });
      },
      { width: 230, fontSize: 18, variant: "secondary" },
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
      /*
       * Solo UND Koop gehen erst zum Packen (Etappe 7): Ein neuer Run heisst
       * neuer Rucksack - nach einem Wipe ist er leer, nach einem Erfolg liegt
       * die Beute im Lager.
       *
       * Im Koop reist die offene Verbindung mit. Frueher endete sie mit dem
       * Run (die Spielszene schloss sie beim Aufraeumen), und alle brauchten
       * einen neuen Raumcode. Jetzt geht es vom Packen zurueck in DENSELBEN
       * Raum; der Host zieht dort den neuen Seed und schickt ihn mit dem
       * `start`-Paket an alle - derselbe Weg wie beim allerersten Start.
       */
      this.scene.start("Loadout", {
        character: this.result.character,
        coop: this.result.coop,
        transport: this.result.transport,
      });
    });
  }
}
