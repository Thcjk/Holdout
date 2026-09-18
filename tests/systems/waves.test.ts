import { describe, expect, it } from "vitest";
import { WAVES } from "../../src/config/balance";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import {
  buildWave,
  startWave,
  stepRound,
  waveComposition,
  waveScaling,
} from "../../src/systems/waves";
import { damagePlayer } from "../../src/systems/combat";
import { createWorld } from "../../src/systems/world";
import { soloSetup } from "../helpers";

describe("Wellenformel", () => {
  it("folgt der Formel aus dem Briefing bei einem Spieler", () => {
    const composition = waveComposition(1, 1);
    const scale = WAVES.playerCountBase + WAVES.playerCountFactor * 1;

    expect(composition.runners).toBe(Math.round((3 + 1 * 2) * scale));
    expect(composition.shooters).toBe(0);
    expect(composition.brutes).toBe(0);
  });

  it("laesst Schuetzen ab Welle 3 und Brocken ab Welle 5 auftreten", () => {
    expect(waveComposition(2, 1).shooters).toBe(0);
    expect(waveComposition(3, 1).shooters).toBeGreaterThan(0);
    expect(waveComposition(4, 1).brutes).toBe(0);
    expect(waveComposition(5, 1).brutes).toBeGreaterThan(0);
  });

  it("skaliert mit der Spielerzahl, aber nicht linear", () => {
    const solo = waveComposition(6, 1).runners;
    const four = waveComposition(6, 4).runners;

    expect(four).toBeGreaterThan(solo);
    // Vier Spieler bekommen rund das Doppelte, nicht das Vierfache.
    expect(four).toBeLessThan(solo * 3);
  });

  it("macht jede fuenfte Welle zur Boss-Welle", () => {
    expect(waveComposition(5, 1).boss).toBe(true);
    expect(waveComposition(10, 1).boss).toBe(true);
    expect(waveComposition(7, 1).boss).toBe(false);
  });

  it("steigert Leben um 8 % und Schaden um 4 % pro Welle", () => {
    expect(waveScaling(1).health).toBeCloseTo(1.08, 6);
    expect(waveScaling(2).health).toBeCloseTo(1.08 * 1.08, 6);
    expect(waveScaling(1).damage).toBeCloseTo(1.04, 6);
  });
});

describe("Spawnliste", () => {
  it("laesst Gegner nacheinander erscheinen, nicht alle gleichzeitig", () => {
    const state = createWorld(soloSetup());
    const orders = buildWave(state, 1);

    const ticks = new Set(orders.map((order) => order.atTick));
    expect(orders.length).toBeGreaterThan(1);
    expect(ticks.size).toBe(orders.length);
  });

  it("enthaelt in einer Boss-Welle genau einen Boss", () => {
    const state = createWorld(soloSetup());
    const orders = buildWave(state, WAVES.bossEveryWaves);

    expect(orders.filter((order) => order.isBoss)).toHaveLength(1);
  });
});

describe("Rundenablauf", () => {
  it("startet nach der Vorbereitung die erste Welle", () => {
    const state = createWorld(soloSetup());
    expect(state.phase).toBe("preparing");

    for (let i = 0; i < WAVES.preparationSeconds * TICK_RATE + 2; i += 1) {
      stepRound(state, TICK_SECONDS);
      state.tick += 1;
    }

    expect(state.phase).toBe("wave");
    expect(state.wave).toBe(1);
  });

  it("geht in die Pause, wenn die Welle leer ist, und heilt dabei", () => {
    const state = createWorld(soloSetup());
    startWave(state, 1);
    state.pendingSpawns.length = 0;
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    player.health = 100;

    stepRound(state, TICK_SECONDS);

    expect(state.phase).toBe("break");
    expect(player.health).toBeGreaterThan(100);
  });

  it("meldet Start UND Ende einer Welle - beides braucht einen Klang", () => {
    const state = createWorld(soloSetup());

    startWave(state, 1);
    expect(state.events.some((event) => event.type === "waveStart")).toBe(true);

    // Welle leerraeumen: Damit ist sie geschafft.
    state.events.length = 0;
    state.pendingSpawns.length = 0;
    stepRound(state, TICK_SECONDS);

    const geschafft = state.events.find((event) => event.type === "waveCleared");
    expect(geschafft).toBeDefined();
    expect(geschafft?.type === "waveCleared" && geschafft.wave).toBe(1);
  });

  it("hilft Gefallenen in der Pause wieder auf", () => {
    const state = createWorld([
      { id: "a", name: "A", character: "scout" },
      { id: "b", name: "B", character: "tank" },
    ]);
    startWave(state, 1);
    state.pendingSpawns.length = 0;
    const down = state.players[0];
    if (!down) throw new Error("Testaufbau");
    damagePlayer(state, down, down.maxHealth);
    expect(down.down).toBe(true);

    stepRound(state, TICK_SECONDS);

    expect(down.down).toBe(false);
  });

  it("beendet die Runde, wenn alle Spieler gleichzeitig am Boden sind", () => {
    const state = createWorld(soloSetup());
    startWave(state, 1);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    damagePlayer(state, player, player.maxHealth);

    stepRound(state, TICK_SECONDS);

    expect(state.phase).toBe("gameover");
    expect(state.events.some((event) => event.type === "gameOver")).toBe(true);
  });

  it("warnt eine Sekunde vor jedem Spawn", () => {
    const state = createWorld(soloSetup());
    startWave(state, 1);

    let warnings = 0;
    for (let i = 0; i < 4 * TICK_RATE; i += 1) {
      stepRound(state, TICK_SECONDS);
      warnings += state.events.filter((event) => event.type === "spawnWarning").length;
      state.events.length = 0;
      state.tick += 1;
    }

    expect(warnings).toBeGreaterThan(0);
  });
});
