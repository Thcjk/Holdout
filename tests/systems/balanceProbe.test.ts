import { describe, expect, it } from "vitest";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { createWorld, stepWorld } from "../../src/systems/world";
import { createBot } from "../bot";
import type { CharacterId } from "../../src/systems/types";
import { armed } from "../helpers";

/**
 * Balancing-Werkzeug, kein normaler Test.
 *
 * Ein einfacher Bot spielt jeden Charakter fuenfmal durch und gibt aus, wie weit
 * er kommt. Damit laesst sich eine Aenderung in `balance.ts` sofort in Zahlen
 * ablesen, statt zwanzig Runden von Hand zu spielen.
 *
 * GEMESSEN WIRD SEIT PHASE 8 DIE TIEFE, NICHT DIE ZEIT. Frueher lautete die
 * Frage "wie viele Wellen haelt er durch", jetzt "wie tief kommt er, bevor er
 * stirbt". Das ist die Frage, um die sich das Spiel jetzt dreht - und es ist
 * dieselbe Zahl, die spaeter ueber die Loot-Qualitaet entscheidet.
 *
 * Wichtig: Der Bot ist schlechter als ein Mensch. Er nutzt keine Deckung, keine
 * Buesche (in denen Gegner ihn gar nicht sehen) und weicht Projektilen nicht aus.
 * Seine Zahlen sind also eine Untergrenze, kein Zielwert - das Briefing sagt
 * ausdruecklich, dass ueber Game Feel nur das eigene Spielen entscheidet.
 *
 * SEIT DER WAFFEN-AUSRUESTUNG schiesst die Waffe, nicht der Charakter. Jeder
 * Charakter wird deshalb mit der Starter-Pistole gemessen (so beginnt jeder
 * Run), und dazu jede Fundwaffe einmal am Scout - drei Laeufe, weil es dort
 * um den Unterschied der Waffen geht, nicht um eine genaue Zahl.
 *
 * Die Zusicherung unten ist bewusst grosszuegig: Sie soll nur auffallen, wenn
 * eine Aenderung das Spiel unspielbar macht.
 */
describe("Balancing-Messung", () => {
  const cases: Array<{ character: CharacterId; weapon: string; runs: number }> = [
    { character: "scout", weapon: "pistol", runs: 5 },
    { character: "tank", weapon: "pistol", runs: 5 },
    { character: "sniper", weapon: "pistol", runs: 5 },
    { character: "scout", weapon: "smg", runs: 3 },
    { character: "scout", weapon: "rifle", runs: 3 },
    { character: "scout", weapon: "railgun", runs: 3 },
  ];
  for (const { character, weapon, runs } of cases) {
    /*
     * Eigenes Zeitlimit statt der fuenf Sekunden von Vitest.
     *
     * Das hier ist ein MESSWERKZEUG, kein normaler Test: Es spielt mehrere
     * volle Runden zu je bis zu 900 Sekunden durch. Seit den Gebaeuden hat
     * die Welt 800 statt 550 Waende, und die Laeufe dauern entsprechend
     * laenger - Scout und Sniper lagen bei 4,9 und 5,5 Sekunden und fielen
     * dadurch abwechselnd durch.
     *
     * Am Tick liegt es NICHT, das ist gemessen: 0,366 ms bei einem Budget von
     * 33 ms (`tickCost.test.ts`). Es ist schlicht viel Simulation.
     */
    it(`misst ${character} mit ${weapon}`, () => {
      const zones: number[] = [];
      const seconds: number[] = [];
      for (let seed = 1; seed <= runs; seed += 1) {
        const state = createWorld(
          [{ id: "p", name: "Bot", character, backpack: armed(weapon) }],
          seed * 7919,
        );
        const bot = createBot();
        for (let i = 0; i < TICK_RATE * 900 && state.phase !== "ended"; i += 1) {
          stepWorld(state, bot(state), TICK_SECONDS);
        }
        zones.push(state.deepestZone);
        seconds.push(state.runTime);
      }
      const average = zones.reduce((a, b) => a + b, 0) / zones.length;
      const averageTime = seconds.reduce((a, b) => a + b, 0) / seconds.length;
      console.log(
        `${character} mit ${weapon}: Zonen ${zones.join(", ")} (Schnitt ${average.toFixed(1)}), ` +
          `ueberlebt ${averageTime.toFixed(0)} s`,
      );

      // Untergrenze: Ein Bot ohne Deckung und Buesche muss mindestens ein paar
      // Zonen weit kommen, sonst stimmt etwas Grundsaetzliches nicht.
      expect(average).toBeGreaterThanOrEqual(2);
    }, 60_000);
  }
});
