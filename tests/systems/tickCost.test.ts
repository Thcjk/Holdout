/**
 * Was kostet ein Simulationsschritt?
 *
 * Messwerkzeug, kein normaler Test - wie `balanceProbe`. Es beantwortet eine
 * Frage, die mit Phase 8 neu entstanden ist:
 *
 * Die Welt ist von 1600 x 1200 auf ein Vielfaches gewachsen, und mit ihr die
 * Zahl der Deckungsbloecke - aus 12 Rechtecken wurden mehrere hundert. Waende
 * werden aber in den heissesten Schleifen LINEAR durchlaufen: jede Bewegung
 * prueft sie (`collision.ts`), und jedes Projektil tastet seine Flugstrecke
 * gegen sie ab (`projectiles.ts`). Zehnmal so viele Waende heisst dort
 * zehnmal so viel Arbeit.
 *
 * Ob das ein Problem ist, laesst sich nicht schaetzen - deshalb wird es hier
 * gemessen. Das Budget ist klar: Bei 30 Ticks je Sekunde hat ein Tick 33 ms,
 * und davon darf die Simulation nur einen Bruchteil brauchen, weil das
 * Zeichnen auf demselben Kern laeuft.
 *
 * ACHTUNG BEI DER ZAHL: Sie stammt aus diesem Container ohne Grafikkarte und
 * sagt nichts ueber ein Handy aus. Aussagekraeftig ist der VERGLEICH - vorher
 * gegen nachher, eine Welt gegen eine andere.
 */

import { describe, expect, it } from "vitest";
import { LIMITS } from "../../src/config/balance";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { createWorld, stepWorld } from "../../src/systems/world";
import { generateWorld } from "../../src/systems/WorldGenerator";
import { createBot } from "../bot";

describe("Kosten eines Simulationsschritts", () => {
  it("misst, was ein Tick unter voller Last kostet", () => {
    const state = createWorld([{ id: "p", name: "Bot", character: "scout" }], 20260918);
    const bot = createBot();

    // Erst einlaufen lassen, bis wirklich etwas los ist: Gegner unterwegs,
    // Projektile in der Luft. Ein Tick auf einer leeren Welt misst nichts.
    for (let i = 0; i < TICK_RATE * 40; i += 1) {
      stepWorld(state, bot(state), TICK_SECONDS);
      if (state.phase === "ended") {
        break;
      }
    }

    const walls = state.walls.length;
    const enemies = state.enemies.length;

    const ticks = 2000;
    const start = performance.now();
    for (let i = 0; i < ticks; i += 1) {
      // Unverwundbar: Es geht um die Kosten, nicht ums Ueberleben.
      for (const player of state.players) {
        player.health = player.maxHealth;
      }
      stepWorld(state, bot(state), TICK_SECONDS);
    }
    const perTick = (performance.now() - start) / ticks;

    console.log(
      `Welt ${state.bounds.width} px, ${walls} Waende, ${enemies} Gegner: ` +
        `${perTick.toFixed(3)} ms je Tick (Budget 33 ms)`,
    );

    // Grosszuegig: Das soll nur auffallen, wenn eine Aenderung die Simulation
    // um Groessenordnungen teurer macht.
    expect(perTick).toBeLessThan(5);
  });

  it("berichtet, wie viel der Generator in die Welt streut", () => {
    for (const seed of [1, 4242, 20260918]) {
      const world = generateWorld(seed);
      console.log(
        `   Seed ${String(seed).padStart(8)}: ${world.walls.length} Waende, ` +
          `${world.bushes.length} Buschfelder auf ${world.bounds.width} px`,
      );
      // Mehr als die vier Aussenmauern - sonst waere die Welt eine leere Wiese.
      expect(world.walls.length).toBeGreaterThan(20);
    }
  });

  it("haelt die Gegnerzahl unter der Obergrenze aus dem Briefing", () => {
    const state = createWorld([{ id: "p", name: "Bot", character: "tank" }], 555);
    const bot = createBot();

    let worst = 0;
    for (let i = 0; i < TICK_RATE * 240 && state.phase !== "ended"; i += 1) {
      for (const player of state.players) {
        player.health = player.maxHealth;
      }
      stepWorld(state, bot(state), TICK_SECONDS);
      worst = Math.max(worst, state.enemies.length);
    }

    console.log(`hoechste Gegnerzahl: ${worst} (Grenze ${LIMITS.maxEnemies})`);
    expect(worst).toBeLessThanOrEqual(LIMITS.maxEnemies);
  });
});
