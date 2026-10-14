import { describe, expect, it } from "vitest";
import { DECK_H, DECK_W, ELEVATION, TICK } from "../../src/game/constants";
import { ENEMIES } from "../../src/game/data/enemies";
import { MODULES } from "../../src/game/data/modules";
import type { MarchSpec } from "../../src/game/data/route";
import { CLIMB_POINTS, climbOpen } from "../../src/game/deck";
import { Simulation } from "../../src/game/Simulation";
import { damageEnemy, findTarget } from "../../src/game/systems/combat";
import { ENEMY_CLIMB_TIME, SLAM_WARNING, addEnemy } from "../../src/game/systems/enemies";
import type { ModuleId, PlayerInput } from "../../src/game/types";
import { QUIET, placeEnemy } from "./helpers";

const ME = "p1";

function sim(route: readonly MarchSpec[] = QUIET): Simulation {
  return new Simulation([{ id: ME, name: "Test", crew: "schrauber" }], 5, { route });
}

function build(s: Simulation, type: ModuleId, col: number, row: number): number {
  s.state.offer = [type];
  s.state.bank += MODULES[type].cost;
  s.command(ME, { kind: "build", module: type, col, row });
  return s.state.modules[s.state.modules.length - 1]!.uid;
}

function run(s: Simulation, seconds: number, input: PlayerInput = { mx: 0, my: 0 }): void {
  for (let i = 0; i < Math.round(seconds / TICK); i += 1) {
    s.advance(TICK * 1000 + 0.01, new Map([[ME, input]]));
  }
}

/** Den eigenen Mech an den Rand stellen, damit er nicht mitkaempft. */
function parkPlayer(s: Simulation): void {
  const p = s.state.players[0]!;
  p.alive = false;
  p.respawn = 9999;
}

describe("Enterer", () => {
  it("klettert an der Rumpfwand hoch und zerlegt auf dem Deck ein Modul", () => {
    const s = sim();
    const uid = build(s, "geschuetz", 2, 2);
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    // Geschuetz kaputt machen, damit es den Enterer nicht vorher erwischt.
    s.state.modules[0]!.cooldown = 9999;
    const e = addEnemy(s, "enterer", s.state.fort.x + 100, DECK_H + 60, 10);
    run(s, 3);
    expect(e.layer === "climb" || e.layer === "deck").toBe(true);
    run(s, ENEMY_CLIMB_TIME + 0.5);
    expect(e.layer).toBe("deck");
    expect(e.z).toBe(ELEVATION);
    const module = s.state.modules.find((m) => m.uid === uid)!;
    run(s, 25);
    expect(module.broken).toBe(true);
  });

  it("auf dem Deck trifft man ihn nur von oben", () => {
    const s = sim();
    s.command(ME, { kind: "depart" });
    const e = placeEnemy(s, 120, 60, {
      layer: "deck",
      mode: "deck",
      z: ELEVATION,
      type: "enterer",
    });
    expect(findTarget(s, 120, DECK_H + 40, 300, false)).toBeNull();
    expect(findTarget(s, 100, 60, 300, true)).toBe(e);
  });

  it("eine Panzerplatte am Rand macht die Wand dort zu glatt", () => {
    const s = sim();
    build(s, "platte", 2, 3);
    const point = CLIMB_POINTS.find((p) => p.col === 2 && p.row === 3)!;
    expect(climbOpen(s.state.modules, point)).toBe(false);
    const other = CLIMB_POINTS.find((p) => p.col === 4 && p.row === 3)!;
    expect(climbOpen(s.state.modules, other)).toBe(true);
  });

  it("brennendes Oel trifft Kletterer doppelt", () => {
    const s = sim();
    build(s, "oel", 2, 3);
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    const climber = placeEnemy(s, s.state.fort.x + 100, DECK_H + 6, {
      type: "enterer",
      layer: "climb",
      mode: "climb",
      timer: 99,
      hp: 500,
      hpMax: 500,
    });
    const walker = placeEnemy(s, s.state.fort.x + 100, DECK_H + 10, { hp: 500, hpMax: 500 });
    run(s, 1);
    expect(500 - climber.hp).toBeCloseTo(2 * (500 - walker.hp), 0);
  });
});

describe("Phalanx und Sandpriester", () => {
  it("der Turmschild haelt Treffer von vorn fast ganz ab, von hinten nicht", () => {
    const s = sim();
    const e = placeEnemy(s, 300, 50, { type: "phalanx", facing: -1, hp: 100, hpMax: 100 });
    damageEnemy(s, e, 10, 200, 50, null);
    expect(e.hp).toBeCloseTo(98, 5);
    damageEnemy(s, e, 10, 400, 50, null);
    expect(e.hp).toBeCloseTo(88, 5);
    // Moerser und Blitz gehen durch.
    damageEnemy(s, e, 10, 200, 50, null, { pierce: true });
    expect(e.hp).toBeCloseTo(78, 5);
  });

  it("der Priester gibt Verbuendeten in der Naehe einen Schild", () => {
    const s = sim();
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    const priest = addEnemy(s, "priester", s.state.fort.x + 500, 40, 1);
    priest.attackCd = 0;
    const friend = placeEnemy(s, priest.x + 30, 40, { hp: 50, hpMax: 50 });
    run(s, 0.1);
    expect(friend.shield).toBeGreaterThan(0);
    damageEnemy(s, friend, 20, friend.x, friend.y, null);
    expect(friend.hp).toBe(50);
  });
});

describe("Streitwagen, Ballista, Turm, Skarabaeus", () => {
  it("ein Streitwagen rammt ein Bein: Rumpfschaden, die Festung wird langsamer", () => {
    const s = sim();
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    const hull = s.state.fort.hull;
    const e = addEnemy(s, "streitwagen", s.state.fort.x - 200, 30, 10);
    let rammed = false;
    for (let i = 0; i < Math.round(6 / TICK) && !rammed; i += 1) {
      run(s, TICK);
      rammed = s.events.some((event) => event.kind === "ram");
    }
    expect(rammed).toBe(true);
    expect(s.state.fort.hull).toBeLessThanOrEqual(hull - ENEMIES.streitwagen.hullDamage);
    expect(s.state.fort.slow).toBeGreaterThan(0);
    expect(e.mode).toBe("retreat");
    const x = s.state.fort.x;
    run(s, 1);
    expect(s.state.fort.x - x).toBeLessThan(26 * 0.7);
  });

  it("Ballista-Bolzen machen Module kaputt; kaputte Module schiessen nicht", () => {
    const s = sim();
    const uid = build(s, "geschuetz", 2, 1);
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    const ballista = addEnemy(s, "ballista", s.state.fort.x + DECK_W + 400, 60, 50);
    ballista.attackCd = 0;
    run(s, 16);
    const module = s.state.modules.find((m) => m.uid === uid)!;
    expect(module.broken).toBe(true);
    placeEnemy(s, s.state.fort.x + 140, DECK_H + 80, { hp: 9999, hpMax: 9999 });
    run(s, 1);
    expect(s.state.shots.filter((shot) => shot.owner === `m${uid}`).length).toBe(0);
  });

  it("der Schrauber flickt Module in seiner Naehe, an der Station wird alles heil", () => {
    const s = sim([
      { station: "A", length: 400, spawnStart: 0, spawnEnd: 0, hp: 1, mix: {} },
      { station: "B", length: 400, spawnStart: 0, spawnEnd: 0, hp: 1, mix: {} },
    ]);
    build(s, "geschuetz", 2, 3);
    s.command(ME, { kind: "depart" });
    const module = s.state.modules[0]!;
    module.hp = 0;
    module.broken = true;
    const p = s.state.players[0]!;
    p.x = s.state.fort.x + 100;
    p.y = DECK_H - 10;
    run(s, 5);
    expect(module.hp).toBeGreaterThan(30);
    expect(module.broken).toBe(false);
    module.hp = 5;
    p.alive = false;
    p.respawn = 9999;
    run(s, 15);
    expect(s.state.phase).toBe("rest");
    expect(module.hp).toBe(module.hpMax);
  });

  it("der Belagerungsturm dockt an und laesst Enterer aufs Deck", () => {
    const s = sim();
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    const tower = addEnemy(s, "turm", s.state.fort.x - 200, 92, 10);
    run(s, 14);
    expect(tower.mode).toBe("dock");
    expect(s.state.enemies.some((e) => e.type === "enterer" && e.layer === "deck")).toBe(true);
  });

  it("der Skarabaeus fliegt ueber das Deck und landet dort", () => {
    const s = sim();
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    const e = addEnemy(s, "skarabaeus", s.state.fort.x - 150, 60, 10);
    expect(e.layer).toBe("air");
    // In der Luft trifft man ihn von unten und von oben.
    expect(findTarget(s, e.x + 10, e.y, 100, false)).toBe(e);
    run(s, 10);
    expect(e.layer).toBe("deck");
  });
});

describe("Goldener Koloss", () => {
  const BOSS: readonly MarchSpec[] = [
    { station: "Ziel", length: 200, spawnStart: 0, spawnEnd: 0, hp: 1, mix: {}, boss: "koloss" },
  ];

  it("kommt im Bossmarsch, und solange er lebt, kommt die Festung nicht an", () => {
    const s = sim(BOSS);
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    let called = false;
    for (let i = 0; i < Math.round(20 / TICK); i += 1) {
      run(s, TICK);
      called ||= s.events.some((event) => event.kind === "boss");
    }
    expect(called).toBe(true);
    expect(s.state.march.boss).toBe("alive");
    expect(s.state.phase).toBe("march");
    expect(s.state.march.done).toBeLessThan(200);
    // Besiegt: dann geht es weiter zum Ziel.
    const boss = s.state.enemies.find((e) => e.type === "koloss")!;
    damageEnemy(s, boss, 999999, boss.x, boss.y, null, { pierce: true });
    run(s, 0.2);
    expect(s.state.phase).toBe("won");
  });

  it("sein Schlag ist vorher zu sehen und trifft die Module darunter", () => {
    const s = sim();
    build(s, "geschuetz", 0, 0);
    const far = build(s, "magnet", 6, 3);
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    const boss = addEnemy(s, "koloss", s.state.fort.x + DECK_W / 2, DECK_H + 92, 10);
    boss.attackCd = 99;
    boss.mode = "slam";
    boss.tx = 40;
    boss.ty = 32;
    boss.timer = SLAM_WARNING;
    const hull = s.state.fort.hull;
    run(s, SLAM_WARNING + 0.1);
    const near = s.state.modules[0]!;
    expect(near.hp).toBeLessThan(near.hpMax);
    expect(s.state.modules.find((m) => m.uid === far)!.hp).toBe(MODULES.magnet.hp);
    expect(s.state.fort.hull).toBeLessThan(hull);
  });
});

describe("Mischung der Trupps", () => {
  it("ein Marsch mit nur Schwaermen bringt Skarabaeen", () => {
    const s = sim([
      { station: "X", length: 5000, spawnStart: 2, spawnEnd: 2, hp: 1, mix: { schwarm: 1 } },
    ]);
    s.command(ME, { kind: "depart" });
    parkPlayer(s);
    run(s, 15);
    const types = new Set(s.state.enemies.map((e) => e.type));
    expect(types.has("skarabaeus")).toBe(true);
  });
});
