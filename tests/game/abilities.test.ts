import { describe, expect, it } from "vitest";
import { Simulation } from "../../src/game/Simulation";
import { encodeState, decodeState } from "../../src/net/protocol";
import type { CharacterId, Enemy, PlayerInput, WeaponId } from "../../src/game/types";

function setup(character: CharacterId, weapon: WeaponId = "pistol"): Simulation {
  const sim = new Simulation([{ id: "a", name: "A", character, startWeapon: weapon }], 7);
  // Wellenplan leeren: Die Tests stellen ihre Gegner selbst auf.
  (sim as unknown as { plan: unknown[] }).plan = [];
  sim.state.markers = [];
  return sim;
}

function enemyAt(sim: Simulation, type: Enemy["type"], x: number, y: number): Enemy {
  return (sim as unknown as { spawnEnemy: (t: Enemy["type"], x: number, y: number) => Enemy }).spawnEnemy(type, x, y);
}

function input(ability: number): Map<string, PlayerInput> {
  return new Map([["a", { mx: 0, my: 0, ability }]]);
}

describe("Faehigkeiten", () => {
  it("loest nur einmal je neuem Zaehlerstand aus und laedt dann auf", () => {
    const sim = setup("zwerg", "fist");
    const player = sim.state.players[0]!;
    player.abilityCd = 0;
    sim.step(input(1));
    const cooldown = player.abilityCd;
    expect(cooldown).toBeGreaterThan(1);
    // Gleicher Zaehler noch einmal: nichts passiert.
    player.abilityCd = 0;
    sim.step(input(1));
    expect(player.abilityCd).toBe(0);
  });

  it("Stampfer betaeubt und schadet allen Gegnern ringsum", () => {
    const sim = setup("zwerg", "fist");
    const player = sim.state.players[0]!;
    player.abilityCd = 0;
    const near = enemyAt(sim, "bruiser", player.x + 60, player.y);
    const far = enemyAt(sim, "bruiser", player.x + 400, player.y);
    sim.step(input(1));
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(near.stun).toBeGreaterThan(0);
    expect(far.hp).toBe(far.maxHp);
  });

  it("Schildwall macht den Ritter unverwundbar", () => {
    const sim = setup("ritter", "shotgun");
    const player = sim.state.players[0]!;
    player.abilityCd = 0;
    sim.step(input(1));
    const hp = player.hp;
    enemyAt(sim, "bruiser", player.x, player.y);
    for (let i = 0; i < 30; i += 1) {
      sim.step(input(1));
    }
    expect(player.hp).toBe(hp);
  });
});

describe("Waffen-Effekte und neue Gegner", () => {
  it("die Rakete explodiert und trifft mehrere Gegner", () => {
    const sim = setup("magierin", "rocket");
    const player = sim.state.players[0]!;
    const a = enemyAt(sim, "bruiser", player.x + 150, player.y);
    const b = enemyAt(sim, "bruiser", player.x + 170, player.y + 30);
    for (let i = 0; i < 90; i += 1) {
      sim.step(input(0));
    }
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it("die Mumie zerfaellt beim Tod in Wuselchen", () => {
    const sim = setup("magierin");
    const splitter = enemyAt(sim, "splitter", 100, 100);
    (sim as unknown as { killEnemy: (e: Enemy, o: null) => void }).killEnemy(splitter, null);
    expect(sim.state.enemies.filter((enemy) => enemy.type === "swarmer").length).toBe(3);
  });

  it("der Zuender explodiert neben dem Spieler", () => {
    const sim = setup("magierin");
    const player = sim.state.players[0]!;
    player.weapons = [];
    player.iframes = 0;
    const hp = player.hp;
    enemyAt(sim, "exploder", player.x + 40, player.y);
    for (let i = 0; i < 60; i += 1) {
      sim.step(input(0));
    }
    expect(player.hp).toBeLessThan(hp);
    expect(sim.state.enemies.some((enemy) => enemy.type === "exploder")).toBe(false);
  });

  it("Zustand mit Status und Faehigkeit uebersteht den Weg durchs Netz", () => {
    const sim = setup("zauberer");
    const player = sim.state.players[0]!;
    player.abilityCd = 4.2;
    const enemy = enemyAt(sim, "exploder", 300, 200);
    enemy.burn = 2;
    enemy.slow = 1;
    const copy = decodeState(encodeState(sim.state));
    expect(copy.players[0]?.abilityCd).toBeCloseTo(4.2, 1);
    expect(copy.enemies[0]?.type).toBe("exploder");
    expect(copy.enemies[0]?.burn).toBeGreaterThan(0);
    expect(copy.enemies[0]?.slow).toBeGreaterThan(0);
  });
});
