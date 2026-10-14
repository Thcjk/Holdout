import { describe, expect, it } from "vitest";
import {
  DECK_H,
  FORT_SPEED,
  HULL_MAX,
  REROLL_COST,
  REROLL_STEP,
  START_SCRAP,
  TICK,
} from "../../src/game/constants";
import { MODULES, sellValue, upgradeCost } from "../../src/game/data/modules";
import { canPlace, generatorBonus } from "../../src/game/deck";
import { Simulation } from "../../src/game/Simulation";
import type { EnemyState, ModuleId } from "../../src/game/types";
import { QUIET, placeEnemy } from "./helpers";

const ME = "p1";

function fresh(route = QUIET): Simulation {
  return new Simulation([{ id: ME, name: "Test", crew: "schrauber" }], 3, { route });
}

/** Ein Modul anbieten und bauen (unabhaengig vom Zufall des Angebots). */
function build(s: Simulation, type: ModuleId, col: number, row: number): void {
  s.state.offer = [type];
  s.state.bank += MODULES[type].cost;
  s.command(ME, { kind: "build", module: type, col, row });
}

function run(s: Simulation, seconds: number): void {
  for (let i = 0; i < Math.round(seconds / TICK); i += 1) {
    s.advance(TICK * 1000 + 0.01, new Map([[ME, { mx: 0, my: 0 }]]));
  }
}

function enemy(s: Simulation, lx: number, y: number, hp = 24): EnemyState {
  return placeEnemy(s, s.state.fort.x + lx, y, { hp, hpMax: hp, attackCd: 99 });
}

describe("Ausbau in der Rast", () => {
  it("der Lauf beginnt mit einer Rast, Startschrott und einem Angebot aus vier Modulen", () => {
    const s = fresh();
    expect(s.state.phase).toBe("rest");
    expect(s.state.bank).toBe(START_SCRAP);
    expect(s.state.offer).toHaveLength(4);
    expect(new Set(s.state.offer).size).toBe(4);
  });

  it("bauen kostet Schrott, jedes Angebot gibt es nur einmal", () => {
    const s = fresh();
    const type = s.state.offer[0]!;
    s.state.bank = 200;
    const col = MODULES[type].edgeOnly ? 0 : 1;
    s.command(ME, { kind: "build", module: type, col, row: 3 });
    expect(s.state.modules).toHaveLength(1);
    expect(s.state.bank).toBe(200 - MODULES[type].cost);
    expect(s.state.offer).not.toContain(type);
    s.command(ME, { kind: "build", module: type, col: 2, row: 3 });
    expect(s.state.modules).toHaveLength(1);
  });

  it("nicht auf feste Aufbauten, nicht doppelt, Randmodule nur am Rand", () => {
    const s = fresh();
    expect(canPlace(s.state.modules, "geschuetz", 3, 1)).toBe(false); // Sonnenherz
    expect(canPlace(s.state.modules, "geschuetz", 0, 1)).toBe(false); // Motor
    expect(canPlace(s.state.modules, "oel", 2, 2)).toBe(false); // nicht am Rand
    expect(canPlace(s.state.modules, "oel", 2, 3)).toBe(true);
    expect(canPlace(s.state.modules, "motor", 6, 0)).toBe(false); // ragt uebers Deck
    build(s, "geschuetz", 2, 3);
    expect(canPlace(s.state.modules, "werkstatt", 1, 3)).toBe(false); // ueberlappt
  });

  it("aufruesten bis Stufe 3, abbauen gibt die Haelfte zurueck", () => {
    const s = fresh();
    build(s, "geschuetz", 2, 3);
    const m = s.state.modules[0]!;
    s.state.bank = 1000;
    s.command(ME, { kind: "upgrade", uid: m.uid });
    s.command(ME, { kind: "upgrade", uid: m.uid });
    s.command(ME, { kind: "upgrade", uid: m.uid });
    expect(m.level).toBe(3);
    expect(s.state.bank).toBe(
      1000 - (upgradeCost("geschuetz", 1) ?? 0) - (upgradeCost("geschuetz", 2) ?? 0),
    );
    s.command(ME, { kind: "sell", uid: m.uid });
    expect(s.state.modules).toHaveLength(0);
    expect(sellValue("geschuetz", 3)).toBe(Math.floor((25 + 25 + 50) / 2));
  });

  it("neu wuerfeln wird jedes Mal teurer", () => {
    const s = fresh();
    s.state.bank = 100;
    s.command(ME, { kind: "reroll" });
    s.command(ME, { kind: "reroll" });
    expect(s.state.bank).toBe(100 - REROLL_COST - (REROLL_COST + REROLL_STEP));
    expect(s.state.offer).toHaveLength(4);
  });

  it("Panzerplatte hebt den Rumpf, Dampfmotor macht die Festung schneller", () => {
    const s = fresh();
    build(s, "platte", 0, 3);
    expect(s.state.fort.hullMax).toBe(HULL_MAX + 80);
    build(s, "motor", 1, 0);
    expect(s.state.fort.speed).toBeCloseTo(1.12, 5);
    s.command(ME, { kind: "depart" });
    run(s, 1);
    expect(s.state.fort.x).toBeCloseTo(FORT_SPEED * 1.12, 0);
  });

  it("Generator macht Waffen auf Nachbarfeldern schneller", () => {
    const s = fresh();
    build(s, "geschuetz", 2, 3);
    build(s, "generator", 3, 3);
    const gun = s.state.modules.find((m) => m.type === "geschuetz")!;
    expect(generatorBonus(s.state.modules, gun)).toBeCloseTo(0.3, 5);
  });
});

describe("Module im Marsch", () => {
  it("ein Geschuetzturm erledigt Gegner vor der Festung", () => {
    const s = fresh();
    build(s, "geschuetz", 2, 3);
    s.command(ME, { kind: "depart" });
    // Der Mech soll nicht helfen: ihn ausser Gefecht setzen.
    s.state.players[0]!.alive = false;
    s.state.players[0]!.respawn = 999;
    enemy(s, 100, DECK_H + 90);
    run(s, 3);
    expect(s.state.kills).toBe(1);
  });

  it("die Funkenspule trifft auch unter dem Deck", () => {
    const s = fresh();
    build(s, "spule", 2, 2);
    s.command(ME, { kind: "depart" });
    const e = enemy(s, 90, 60, 200);
    run(s, 1);
    expect(e.hp).toBeLessThan(200);
  });

  it("der Oelkessel verbrennt, was unter seiner Kante steht", () => {
    const s = fresh();
    build(s, "oel", 2, 3);
    s.command(ME, { kind: "depart" });
    const e = enemy(s, 100, DECK_H - 10, 200);
    run(s, 2);
    expect(e.hp).toBeLessThan(200);
  });

  it("der Schrottmagnet holt Schrott aufs Deck", () => {
    const s = fresh();
    build(s, "magnet", 2, 3);
    s.command(ME, { kind: "depart" });
    const bank = s.state.bank;
    s.state.scrap.push({ id: 999, x: s.state.fort.x + 100, y: DECK_H + 60, z: 0, value: 2 });
    run(s, 2);
    expect(s.state.bank).toBe(bank + 2);
  });
});

describe("Angriffe von allen Seiten", () => {
  it("Trupps kuendigen sich an und kommen aus allen vier Richtungen", () => {
    const sides = new Set<string>();
    let warned = false;
    // Drei Laeufe mit anderem Zufall: zusammen kommen sie von ueberall.
    for (const seed of [11, 12, 13]) {
      const s = new Simulation([{ id: ME, name: "Test", crew: "schrauber" }], seed);
      s.command(ME, { kind: "depart" });
      for (let i = 0; i < Math.round(60 / TICK); i += 1) {
        s.advance(TICK * 1000 + 0.01, new Map([[ME, { mx: 0, my: 0 }]]));
        warned ||= s.state.warnings.length > 0;
        for (const event of s.events) {
          if (event.kind === "trupp") {
            sides.add(event.side);
          }
        }
      }
    }
    expect(warned).toBe(true);
    expect(sides).toEqual(new Set(["hinten", "vorn", "oben", "unten"]));
  });
});
