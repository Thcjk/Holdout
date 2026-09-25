import { describe, expect, it } from "vitest";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { generateNodeMap } from "../../src/systems/NodeMapGenerator";
import { createWorld, stepWorld } from "../../src/systems/world";
import { createBot } from "../bot";
import { armed } from "../helpers";

/**
 * Balancing-Werkzeug fuer die Knoten-Gebiete (so wird seit 2.2 gespielt).
 *
 * `balanceProbe` misst weiter die offene Welt. Hier spielt der Bot mit der
 * Starter-Pistole je Gefahrenstufe g mehrere Gebiete (verschiedene Seeds)
 * und gibt aus, wie lange er haelt und wie viel Schaden er je Minute nimmt.
 *
 * Wie beim anderen Messwerkzeug: Der Bot ist schlechter als ein Mensch (keine
 * Deckung, keine Buesche, keine Faehigkeiten). Die Zahlen sind Untergrenzen -
 * wenn aber schon g 1 den Bot in einer Minute umlegt, ist es fuer den Anfang
 * zu schwer.
 */
const SECONDS = 150;
const SEEDS = [11, 23, 42, 77, 4242];

/**
 * Der `skip`-te Kampfknoten mit genau dieser Gefahr - so misst jeder Lauf ein
 * anderes Gebiet, nicht fuenfmal dasselbe.
 */
function nodeWithDanger(danger: number, skip: number): { seed: number; nodeId: number } | null {
  let seen = 0;
  for (let seed = 1; seed < 2000; seed += 1) {
    const node = generateNodeMap(seed).nodes.find(
      (entry) => entry.type === "combat" && entry.danger === danger,
    );
    if (node && seen++ === skip) return { seed, nodeId: node.id };
  }
  return null;
}

describe("Balancing-Messung Knoten-Gebiete", () => {
  it("misst den Scout mit Pistole je Gefahrenstufe", () => {
    const lines: string[] = [];
    let firstSurvival = 0;
    for (const danger of [1, 2, 3, 5, 7, 8]) {
      const survived: number[] = [];
      const damagePerMinute: number[] = [];
      for (const [index, offset] of SEEDS.entries()) {
        const found = nodeWithDanger(danger, index);
        if (!found) continue;
        // Je Lauf ein anderes Gebiet derselben Gefahr, dazu ein anderer
        // Spielzufall (`offset`) fuer die Gegnerfolge.
        const state = createWorld(
          [{ id: "p", name: "Bot", character: "scout", backpack: armed("pistol") }],
          found.seed,
          { nodeId: found.nodeId },
        );
        state.rngState = (state.rngState + offset * 7919) >>> 0;
        const bot = createBot();
        let taken = 0;
        let last = state.players[0]!.health;
        for (let i = 0; i < TICK_RATE * SECONDS && state.phase !== "ended"; i += 1) {
          stepWorld(state, bot(state), TICK_SECONDS);
          const player = state.players[0]!;
          if (player.health < last) taken += last - player.health;
          last = player.health;
          if (player.down) break;
        }
        survived.push(state.runTime);
        damagePerMinute.push((taken / Math.max(1, state.runTime)) * 60);
      }
      const avg = (list: number[]): number => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
      if (danger === 1) firstSurvival = avg(survived);
      lines.push(
        `g ${danger}: haelt ${avg(survived).toFixed(0)} s (von ${SECONDS}), ` +
          `Schaden/min ${avg(damagePerMinute).toFixed(0)}`,
      );
    }
    console.log(lines.join("\n"));
    // Nur eine grobe Grenze: Das erste Gebiet darf den Bot nicht sofort umlegen.
    expect(firstSurvival).toBeGreaterThan(30);
  }, 120_000);
});
