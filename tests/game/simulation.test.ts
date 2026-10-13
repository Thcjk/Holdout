import { describe, expect, it } from "vitest";
import {
  BEHIND,
  CLIMB_TIME,
  DECK_H,
  ELEVATION,
  FORT_SPEED,
  GAIT_PERIOD,
  JUMP_TIME,
  LADDER_TOP,
  REPAIR_AMOUNT,
  REPAIR_COST,
  STOMP_DAMAGE,
  TICK,
  WINCH_COST,
} from "../../src/game/constants";
import { LEGS, STRIDE, legPhase } from "../../src/game/fortress";
import { Simulation } from "../../src/game/Simulation";
import type { EnemyState, PlayerInput } from "../../src/game/types";

const ME = "p1";
const QUIET = [{ station: "Test", length: 100000, spawnStart: 0, spawnEnd: 0, hp: 1 }];

function sim(route = QUIET): Simulation {
  return new Simulation([{ id: ME, name: "Test", crew: "schrauber" }], 1, { route });
}

/** Rechnet `seconds` Sekunden mit fester Eingabe. */
function run(s: Simulation, seconds: number, input: PlayerInput = { mx: 0, my: 0 }): void {
  const steps = Math.round(seconds / TICK);
  for (let i = 0; i < steps; i += 1) {
    s.advance(TICK * 1000 + 0.01, new Map([[ME, input]]));
  }
}

function enemy(s: Simulation, x: number, y: number, extra: Partial<EnemyState> = {}): EnemyState {
  const e: EnemyState = {
    id: s.state.nextId++,
    type: "laeufer",
    x,
    y,
    hp: 24,
    hpMax: 24,
    speed: 0,
    facing: 1,
    slotX: x - s.state.fort.x,
    slotY: y - s.state.fort.y,
    attacking: false,
    attackCd: 5,
    pushX: 0,
    pushY: 0,
    ...extra,
  };
  s.state.enemies.push(e);
  return e;
}

const me = (s: Simulation) => s.state.players[0]!;

describe("Die laufende Festung", () => {
  it("laeuft im Marsch mit festem Tempo und nimmt Mechs auf dem Deck mit", () => {
    const s = sim();
    const startX = me(s).x;
    run(s, 2);
    expect(s.state.fort.x).toBeCloseTo(FORT_SPEED * 2, 0);
    expect(s.state.march.done).toBeCloseTo(FORT_SPEED * 2, 0);
    expect(me(s).layer).toBe("deck");
    expect(me(s).x - startX).toBeCloseTo(FORT_SPEED * 2, 0);
  });

  it("die Fuesse rutschen nicht: Schrittlaenge passt zum Tempo", () => {
    expect(STRIDE).toBeCloseTo(FORT_SPEED * GAIT_PERIOD * 0.6, 5);
  });

  it("ein aufsetzender Fuss stampft Gegner darunter", () => {
    const s = sim();
    const leg = LEGS[0]!;
    // Kurz bevor der Fuss aufsetzt, steht ein Gegner an der Aufsetzstelle.
    let t = 0;
    while (legPhase(t + TICK, leg) > legPhase(t, leg)) {
      t += TICK;
    }
    run(s, t - TICK * 2);
    const landX = s.state.fort.x + leg.footX + STRIDE / 2 + FORT_SPEED * TICK * 3;
    const e = enemy(s, landX, s.state.fort.y + leg.footY, { hp: 100, hpMax: 100 });
    run(s, TICK * 6);
    expect(e.hp).toBe(100 - STOMP_DAMAGE);
  });
});

describe("Deck und Boden", () => {
  it("gegen die linke Kante druecken: Mech springt ab und landet hinter der Festung", () => {
    const s = sim();
    run(s, 3, { mx: -1, my: 0 });
    run(s, JUMP_TIME + 0.1);
    const p = me(s);
    expect(p.layer).toBe("ground");
    expect(p.z).toBe(0);
    expect(p.x).toBeLessThan(s.state.fort.x);
  });

  it("vorne abspringen landet vor dem Bug, nicht gleich wieder an der Strickleiter", () => {
    const s = sim();
    run(s, 1.5, { mx: 0, my: 1 });
    run(s, JUMP_TIME + 0.1);
    expect(me(s).layer).toBe("ground");
    expect(me(s).y).toBeGreaterThan(s.state.fort.y + DECK_H);
  });

  it("an der Strickleiter klettert man aufs Deck", () => {
    const s = sim();
    const p = me(s);
    p.layer = "ground";
    p.z = 0;
    p.x = s.state.fort.x + LADDER_TOP.x;
    p.y = s.state.fort.y + DECK_H + 4;
    run(s, CLIMB_TIME + 0.1);
    expect(p.layer).toBe("deck");
    expect(p.z).toBe(ELEVATION);
    expect(p.y - s.state.fort.y).toBeCloseTo(LADDER_TOP.y, 0);
  });

  it("wer zurueckfaellt, wird von der Seilwinde geholt - das kostet Rumpf", () => {
    const s = sim();
    const p = me(s);
    p.layer = "ground";
    p.z = 0;
    p.x = s.state.fort.x - BEHIND + 5;
    p.y = s.state.fort.y + 200;
    const hull = s.state.fort.hull;
    run(s, 2);
    expect(s.state.fort.hull).toBe(hull - WINCH_COST);
    run(s, 1);
    expect(p.layer).toBe("deck");
  });

  it("vom Deck aus sieht man Gegner unter dem Bauch nicht, vom Boden aus schon", () => {
    const s = sim();
    const p = me(s);
    const e = enemy(s, s.state.fort.x + 140, s.state.fort.y + 60);
    run(s, 1.5);
    expect(e.hp).toBe(24);
    expect(s.state.shots).toHaveLength(0);
    p.layer = "ground";
    p.z = 0;
    p.x = s.state.fort.x + 140;
    p.y = s.state.fort.y + 200;
    run(s, 2);
    expect(s.state.enemies).toHaveLength(0);
    expect(s.state.kills).toBe(1);
  });
});

describe("Gegner, Schrott und Rumpf", () => {
  it("ein Gegner am Bauch hackt auf den Rumpf ein", () => {
    const s = sim();
    const f = s.state.fort;
    enemy(s, f.x + 140, f.y + 40, { speed: 54, attackCd: 0 });
    run(s, 3);
    expect(f.hull).toBeLessThan(f.hullMax);
  });

  it("besiegte Gegner lassen Schrott fallen, nur am Boden sammelt man ihn ein", () => {
    const s = sim();
    const f = s.state.fort;
    s.state.scrap.push({ id: 999, x: f.x + 60, y: f.y + 200, value: 2 });
    run(s, 0.5);
    expect(s.state.bank).toBe(0);
    const p = me(s);
    p.layer = "ground";
    p.z = 0;
    p.x = s.state.scrap[0]!.x - 40;
    p.y = s.state.scrap[0]!.y;
    run(s, 0.5);
    expect(s.state.bank).toBe(2);
    expect(s.state.scrap).toHaveLength(0);
  });

  it("die Notreparatur heilt den Rumpf - ein Druck loest nur einmal aus", () => {
    const s = sim();
    s.state.fort.hull = 500;
    run(s, 0.2, { mx: 0, my: 0, ability: 1 });
    expect(s.state.fort.hull).toBe(545);
    s.state.fort.hull = 500;
    run(s, 30, { mx: 0, my: 0, ability: 1 });
    expect(s.state.fort.hull).toBe(500);
  });

  it("Rumpf auf null: verloren", () => {
    const s = sim();
    s.state.fort.hull = 1;
    enemy(s, s.state.fort.x + 140, s.state.fort.y + 40, { attackCd: 0, speed: 54 });
    run(s, 2);
    expect(s.state.phase).toBe("lost");
  });
});

describe("Etappen und Rast", () => {
  const route = [
    { station: "A", length: 60, spawnStart: 0, spawnEnd: 0, hp: 1 },
    { station: "B", length: 60, spawnStart: 0, spawnEnd: 0, hp: 1 },
  ];

  it("am Ziel ist Rast: reparieren kostet Schrott, dann geht es weiter bis zum Sieg", () => {
    const s = sim(route);
    run(s, 60 / FORT_SPEED + 0.2);
    expect(s.state.phase).toBe("rest");
    const x = s.state.fort.x;
    run(s, 1);
    expect(s.state.fort.x).toBe(x);

    s.state.fort.hull = 500;
    s.command(ME, { kind: "repair" });
    expect(s.state.fort.hull).toBe(500);
    s.state.bank = REPAIR_COST;
    s.command(ME, { kind: "repair" });
    expect(s.state.fort.hull).toBe(500 + REPAIR_AMOUNT);
    expect(s.state.bank).toBe(0);

    s.command(ME, { kind: "depart" });
    expect(s.state.phase).toBe("march");
    expect(s.state.march.station).toBe("B");
    run(s, 60 / FORT_SPEED + 0.2);
    expect(s.state.phase).toBe("won");
  });

  it("die Armee rueckt an: im echten Lauf kommen Gegner", () => {
    const s = new Simulation([{ id: ME, name: "Test", crew: "schrauber" }], 7);
    run(s, 20);
    expect(s.state.enemies.length + s.state.kills).toBeGreaterThan(3);
  });
});
