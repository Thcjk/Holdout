import { describe, expect, it } from "vitest";
import { ARENA, TICK_MS } from "../../src/game/constants";
import { FINAL_WAVE, planWave, waveLength } from "../../src/game/data/enemies";
import { createRng } from "../../src/game/rng";
import { Simulation } from "../../src/game/Simulation";
import type { PlayerInput, PlayerSetup } from "../../src/game/types";

const SOLO: PlayerSetup[] = [{ id: "a", name: "A", character: "soeldner", startWeapon: "pistol" }];
const IDLE = new Map<string, PlayerInput>();

function run(sim: Simulation, seconds: number, inputs: ReadonlyMap<string, PlayerInput> = IDLE): void {
  for (let i = 0; i < seconds * 60; i += 1) {
    if (sim.state.phase !== "wave") {
      return;
    }
    sim.step(inputs);
  }
}

function skipToShop(sim: Simulation): void {
  const player = sim.state.players[0];
  // Unverwundbar machen, damit die Welle ohne Ausweichen zu Ende laeuft.
  for (let i = 0; i < 70 * 60 && sim.state.phase === "wave"; i += 1) {
    if (player) {
      player.iframes = 1;
    }
    sim.step(IDLE);
  }
}

describe("Wellenplan", () => {
  it("wird mit der Welle laenger, hoechstens 60 Sekunden", () => {
    expect(waveLength(1)).toBe(20);
    expect(waveLength(2)).toBe(25);
    expect(waveLength(9)).toBe(60);
    expect(waveLength(20)).toBe(60);
  });

  it("enthaelt in Welle 1 nur Larven, in Welle 8 den Zwischengegner, in Welle 20 den Boss", () => {
    const first = planWave(1, 1, createRng(1));
    expect(first.every((group) => group.type === "grunt")).toBe(true);
    expect(planWave(8, 1, createRng(1)).some((group) => group.type === "elite")).toBe(true);
    expect(planWave(FINAL_WAVE, 1, createRng(1)).some((group) => group.type === "boss")).toBe(true);
  });

  it("plant mit mehr Spielern mehr Gegner", () => {
    const count = (players: number): number =>
      planWave(8, players, createRng(5)).reduce((sum, group) => sum + group.count, 0);
    expect(count(4)).toBeGreaterThan(count(1) * 1.5);
  });

  it("legt keine Gruppe in die letzten Sekunden", () => {
    const length = waveLength(5);
    expect(planWave(5, 1, createRng(9)).every((group) => group.at <= length - 4.9)).toBe(true);
  });
});

describe("Simulation", () => {
  it("startet in Welle 1 mit voller Gesundheit und einer Waffe", () => {
    const sim = new Simulation(SOLO, 1);
    const player = sim.state.players[0];
    expect(sim.state.phase).toBe("wave");
    expect(sim.state.wave).toBe(1);
    expect(player?.hp).toBe(player?.stats.maxHp);
    expect(player?.weapons).toHaveLength(1);
  });

  it("laesst Gegner erst nach dem Kreuz erscheinen", () => {
    const sim = new Simulation(SOLO, 2);
    run(sim, 0.5);
    expect(sim.state.enemies.length).toBe(0);
    // Gegner koennen schon wieder tot sein, deshalb ueber die Zeit mitzaehlen.
    let seenMarker = false;
    let seenEnemy = false;
    for (let i = 0; i < 6 * 60; i += 1) {
      sim.state.players[0]!.iframes = 1;
      sim.step(IDLE);
      seenMarker ||= sim.state.markers.length > 0;
      seenEnemy ||= sim.state.enemies.length > 0;
    }
    expect(seenMarker).toBe(true);
    expect(seenEnemy).toBe(true);
  });

  it("bewegt den Spieler und haelt ihn in der Arena", () => {
    const sim = new Simulation(SOLO, 3);
    const player = sim.state.players[0];
    const startX = player?.x ?? 0;
    run(sim, 1, new Map([["a", { mx: 1, my: 0 }]]));
    expect(player?.x).toBeGreaterThan(startX + 100);
    run(sim, 10, new Map([["a", { mx: 1, my: 0 }]]));
    expect(player?.x).toBeLessThanOrEqual(ARENA.width);
  });

  it("schiesst automatisch auf Gegner in Reichweite und laesst Material fallen", () => {
    const sim = new Simulation(SOLO, 4);
    const player = sim.state.players[0];
    if (!player) {
      throw new Error("kein Spieler");
    }
    sim.state.markers.push({ x: player.x + 150, y: player.y, t: 0.01, type: "grunt" });
    let killed = false;
    for (let i = 0; i < 6 * 60 && !killed; i += 1) {
      player.iframes = 1;
      sim.step(IDLE);
      killed = sim.events.some((event) => event.t === "kill");
    }
    expect(killed).toBe(true);
    expect(sim.state.pickups.length + player.gold).toBeGreaterThan(0);
  });

  it("schliesst die Welle ab, sammelt alles Material ein und oeffnet den Shop", () => {
    const sim = new Simulation(SOLO, 5);
    skipToShop(sim);
    expect(sim.state.phase).toBe("shop");
    expect(sim.state.pickups).toHaveLength(0);
    expect(sim.state.enemies).toHaveLength(0);
    const player = sim.state.players[0];
    expect(player?.shop.offers.filter(Boolean).length).toBe(4);
    expect(player?.ready).toBe(false);
  });

  it("geht erst weiter, wenn alle bereit sind", () => {
    const setups: PlayerSetup[] = [
      { id: "a", name: "A", character: "soeldner", startWeapon: "pistol" },
      { id: "b", name: "B", character: "jaeger", startWeapon: "sniper" },
    ];
    const sim = new Simulation(setups, 6);
    for (let i = 0; i < 70 * 60 && sim.state.phase === "wave"; i += 1) {
      for (const player of sim.state.players) {
        player.iframes = 1;
      }
      sim.step(IDLE);
    }
    expect(sim.state.phase).toBe("shop");
    // Offene Level-Ups muessen erst gewaehlt sein, sonst gibt es kein "bereit".
    for (const player of sim.state.players) {
      while (player.pendingLevels > 0) {
        expect(sim.command(player.id, { k: "upgrade", pick: 0 })).toBe(true);
      }
    }
    sim.command("a", { k: "ready", value: true });
    sim.step(IDLE);
    expect(sim.state.phase).toBe("shop");
    sim.command("b", { k: "ready", value: true });
    sim.step(IDLE);
    expect(sim.state.phase).toBe("wave");
    expect(sim.state.wave).toBe(2);
  });

  it("ignoriert Befehle waehrend der Welle", () => {
    const sim = new Simulation(SOLO, 7);
    expect(sim.command("a", { k: "ready", value: true })).toBe(false);
  });

  it("endet verloren, wenn alle am Boden liegen", () => {
    const sim = new Simulation(SOLO, 8);
    const player = sim.state.players[0];
    if (!player) {
      throw new Error("kein Spieler");
    }
    player.hp = 1;
    player.stats.dodge = 0;
    sim.state.markers.push({ x: player.x + 5, y: player.y, t: 0.01, type: "bruiser" });
    run(sim, 5);
    expect(sim.state.phase).toBe("lost");
  });

  it("rechnet mit festem Zeitschritt, egal wie die Zeit zerhackt kommt", () => {
    const a = new Simulation(SOLO, 11);
    const b = new Simulation(SOLO, 11);
    for (let i = 0; i < 300; i += 1) {
      a.advance(TICK_MS, IDLE);
    }
    for (let i = 0; i < 600; i += 1) {
      b.advance(TICK_MS / 2, IDLE);
    }
    expect(b.state.tick).toBe(a.state.tick);
    expect(b.state.timeLeft).toBeCloseTo(a.state.timeLeft, 5);
  });

  it("gewinnt nach der letzten Welle", () => {
    const sim = new Simulation(SOLO, 12);
    sim.state.wave = FINAL_WAVE;
    sim.state.timeLeft = 0.02;
    sim.step(IDLE);
    sim.step(IDLE);
    sim.step(IDLE);
    expect(sim.state.phase).toBe("won");
  });
});
