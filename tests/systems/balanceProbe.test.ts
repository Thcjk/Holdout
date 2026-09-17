import { describe, expect, it } from "vitest";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { createWorld, stepWorld } from "../../src/systems/world";
import { createBot } from "../bot";
import type { CharacterId } from "../../src/systems/types";

/**
 * Balancing-Werkzeug, kein normaler Test.
 *
 * Ein einfacher Bot spielt jeden Charakter fuenfmal durch und gibt aus, wie weit
 * er kommt. Damit laesst sich eine Aenderung in `balance.ts` sofort in Zahlen
 * ablesen, statt zwanzig Runden von Hand zu spielen.
 *
 * Wichtig: Der Bot ist schlechter als ein Mensch. Er nutzt keine Deckung, keine
 * Buesche (in denen Gegner ihn gar nicht sehen) und weicht Projektilen nicht aus.
 * Seine Zahlen sind also eine Untergrenze, kein Zielwert - das Briefing sagt
 * ausdruecklich, dass ueber Game Feel nur das eigene Spielen entscheidet.
 *
 * Die Zusicherung unten ist bewusst grosszuegig: Sie soll nur auffallen, wenn
 * eine Aenderung das Spiel unspielbar macht.
 */
describe("Balancing-Messung", () => {
  for (const character of ["scout", "tank", "sniper"] as CharacterId[]) {
    it(`misst ${character}`, () => {
      const runs: number[] = [];
      for (let seed = 1; seed <= 5; seed += 1) {
        const state = createWorld([{ id: "p", name: "Bot", character }], seed * 7919);
        const bot = createBot();
        for (let i = 0; i < TICK_RATE * 900 && state.phase !== "gameover"; i += 1) {
          stepWorld(state, bot(state), TICK_SECONDS);
        }
        runs.push(state.wave);
      }
      const average = runs.reduce((a, b) => a + b, 0) / runs.length;
      console.log(`${character}: Wellen ${runs.join(", ")} (Schnitt ${average.toFixed(1)})`);

      // Untergrenze: Ein Bot ohne Deckung und Buesche muss mindestens durch die
      // ersten Wellen kommen, sonst stimmt etwas Grundsaetzliches nicht.
      expect(average).toBeGreaterThanOrEqual(3);
    });
  }
});
