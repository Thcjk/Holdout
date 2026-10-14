import { describe, expect, it } from "vitest";
import { DECK_H, ELEVATION, TICK } from "../../src/game/constants";
import { CREW, CREW_IDS } from "../../src/game/data/crew";
import {
  ACHIEVEMENTS,
  altgoldFor,
  applyRun,
  newProfile,
  runOptions,
  sanitizeProfile,
  summarize,
  unlockBlueprint,
  unlockCrew,
} from "../../src/game/meta";
import { Simulation, heatEffects } from "../../src/game/Simulation";
import { hurtPlayer } from "../../src/game/systems/combat";
import { equipPart, statsOf } from "../../src/game/systems/players";
import type { CrewId, PlayerInput } from "../../src/game/types";
import { QUIET, placeEnemy } from "./helpers";

const ME = "p1";

function sim(crew: CrewId, options = {}): Simulation {
  const s = new Simulation([{ id: ME, name: "Test", crew }], 2, { route: QUIET, ...options });
  s.command(ME, { kind: "depart" });
  return s;
}

function run(s: Simulation, seconds: number, input: PlayerInput = { mx: 0, my: 0 }): void {
  for (let i = 0; i < Math.round(seconds / TICK); i += 1) {
    s.advance(TICK * 1000 + 0.01, new Map([[ME, input]]));
  }
}

const me = (s: Simulation) => s.state.players[0]!;

/** Den Mech an eine Stelle am Boden stellen. */
function toGround(s: Simulation, x: number, y: number): void {
  const p = me(s);
  p.layer = "ground";
  p.z = 0;
  p.x = x;
  p.y = y;
}

describe("Die sechs Mechs", () => {
  it("jeder kaempft und setzt seine Faehigkeit ein", () => {
    for (const crew of CREW_IDS) {
      const s = sim(crew);
      for (let i = 0; i < 6; i += 1) {
        placeEnemy(s, s.state.fort.x + 120 + i * 12, DECK_H + 70 + (i % 2) * 10, {
          hp: 300,
          hpMax: 300,
        });
      }
      toGround(s, s.state.fort.x + 126, DECK_H + 50);
      run(s, 2);
      const hurt = s.state.enemies.filter((e) => e.hp < 300).length;
      expect(hurt, crew).toBeGreaterThan(0);
      run(s, 0.2, { mx: 0, my: 0, ability: 1 });
      expect(me(s).abilityCd, crew).toBeGreaterThan(0);
    }
  });

  it("Kanonier: Splitter treffen die Nachbarn mit", () => {
    const s = sim("kanonier");
    const a = placeEnemy(s, s.state.fort.x + 140, DECK_H + 90, { hp: 500, hpMax: 500 });
    const b = placeEnemy(s, s.state.fort.x + 156, DECK_H + 96, { hp: 500, hpMax: 500 });
    toGround(s, s.state.fort.x + 140, DECK_H + 20);
    run(s, 1.2);
    expect(a.hp).toBeLessThan(500);
    expect(b.hp).toBeLessThan(500);
  });

  it("Brecher: Hammer trifft alle vor ihm, nicht hinter ihm, und er steckt weniger ein", () => {
    const s = sim("brecher");
    toGround(s, s.state.fort.x + 140, DECK_H + 60);
    me(s).facing = 1;
    const front1 = placeEnemy(s, me(s).x + 30, me(s).y, { hp: 500, hpMax: 500 });
    const front2 = placeEnemy(s, me(s).x + 24, me(s).y + 22, { hp: 500, hpMax: 500 });
    const behind = placeEnemy(s, me(s).x - 40, me(s).y, { hp: 500, hpMax: 500 });
    run(s, 0.7);
    expect(front1.hp).toBeLessThan(500);
    expect(front2.hp).toBeLessThan(500);
    expect(behind.hp).toBe(500);
    // Ein Treffer von 10 kommt beim Brecher nur zu 70 % an.
    const p = me(s);
    p.hp = 100;
    hurtPlayer(s, p, 10);
    expect(p.hp).toBeCloseTo(100 - 10 * (1 - (CREW.brecher.armor ?? 0)), 5);
  });

  it("Brecher: Rammstoss wirft Gegner vom Deck", () => {
    const s = sim("brecher");
    const p = me(s);
    p.x = s.state.fort.x + 100;
    p.y = s.state.fort.y + 112;
    p.facing = 1;
    const boarder = placeEnemy(s, p.x + 20, p.y, {
      type: "enterer",
      layer: "deck",
      mode: "deck",
      z: ELEVATION,
      hp: 500,
      hpMax: 500,
    });
    run(s, 0.4, { mx: 0, my: 0, ability: 1 });
    expect(boarder.layer).toBe("ground");
    expect(boarder.hp).toBeLessThan(500);
  });

  it("Bergungslaeuferin: Enterhaken zurueck aufs Deck, die Seilwinde kostet nichts", () => {
    const s = sim("bergung");
    toGround(s, s.state.fort.x + 140, DECK_H + 80);
    run(s, 0.8, { mx: 0, my: 0, ability: 1 });
    expect(me(s).layer).toBe("deck");
    const t = sim("bergung");
    toGround(t, t.state.fort.x - 320, 40);
    const hull = t.state.fort.hull;
    run(t, 1.5, { mx: -1, my: 0 });
    expect(t.state.stats.winches).toBe(1);
    expect(t.state.fort.hull).toBe(hull);
  });

  it("Funkerin: Drohnen schiessen mit, der Luftschlag bringt fuenf Einschlaege", () => {
    const s = sim("funkerin");
    for (let i = 0; i < 4; i += 1) {
      placeEnemy(s, s.state.fort.x + 140 + i * 14, DECK_H + 100, { hp: 999, hpMax: 999 });
    }
    toGround(s, s.state.fort.x + 140, DECK_H + 40);
    run(s, 0.2, { mx: 0, my: 0, ability: 1 });
    expect(s.state.shells.length).toBe(5);
    const shots = new Set<number>();
    for (let i = 0; i < 60; i += 1) {
      run(s, TICK);
      for (const shot of s.state.shots) {
        shots.add(shot.id);
      }
    }
    // Pistole (gut 3 je Sekunde) plus Drohnen (3 je Sekunde): deutlich mehr als die Pistole allein.
    expect(shots.size).toBeGreaterThan(4);
  });

  it("Sturmspringer: Sturzflug ins Getuemmel, und ueberall die Wand hoch", () => {
    const s = sim("springer");
    const group = [0, 1, 2].map((i) =>
      placeEnemy(s, s.state.fort.x + 140 + i * 16, DECK_H + 110, { hp: 500, hpMax: 500 }),
    );
    run(s, 1, { mx: 0, my: 0, ability: 1 });
    expect(me(s).layer).toBe("ground");
    expect(group.every((e) => e.hp < 500)).toBe(true);
    const t = sim("springer");
    toGround(t, t.state.fort.x + 60, t.state.fort.y + DECK_H + 10);
    run(t, 1, { mx: 0, my: -1 });
    expect(me(t).layer).toBe("deck");
  });
});

describe("Teile", () => {
  it("gleiches Teil wird besser (bis Stufe 3), anderes ersetzt", () => {
    const s = sim("schrauber");
    const p = me(s);
    const base = statsOf(p).cooldown;
    equipPart(s, p, "schnellfeuer");
    expect(statsOf(p).cooldown).toBeLessThan(base);
    equipPart(s, p, "schnellfeuer");
    equipPart(s, p, "schnellfeuer");
    equipPart(s, p, "schnellfeuer");
    expect(p.parts.arm).toEqual({ id: "schnellfeuer", level: 3 });
    equipPart(s, p, "weitschuss");
    expect(p.parts.arm).toEqual({ id: "weitschuss", level: 1 });
    equipPart(s, p, "panzerung");
    expect(p.hpMax).toBe(CREW.schrauber.hp + 35);
  });

  it("beim Haendler kann man Teile kaufen", () => {
    const s = new Simulation([{ id: ME, name: "Test", crew: "schrauber" }], 3, {
      lengthFactor: 0.02,
    });
    const target = s.state.map.nodes[s.state.map.nodes[0]!.next[0]!]!;
    target.type = "haendler";
    s.command(ME, { kind: "depart", node: target.id });
    run(s, 2.5);
    expect(s.state.partOffer.length).toBe(2);
    s.state.bank = 500;
    const part = s.state.partOffer[0]!;
    s.command(ME, { kind: "buyPart", index: 0 });
    expect(s.state.bank).toBe(500 - part.cost);
    const p = me(s);
    expect([p.parts.arm?.id, p.parts.back?.id]).toContain(part.id);
  });
});

describe("Fortschritt ueber Laeufe", () => {
  it("Altgold und Erfolge gibt es einmal, ein Sieg schaltet Hitze frei", () => {
    const profile = newProfile();
    const s = sim("schrauber");
    s.state.phase = "won";
    s.state.path = [0, 1, 2, 3, 4, 5, 6];
    s.state.kills = 320;
    s.state.stats.bossKills = 1;
    const run1 = summarize(s.state, "schrauber");
    const reward = applyRun(profile, run1);
    expect(reward.altgold).toBeGreaterThan(altgoldFor(run1));
    expect(profile.achievements).toContain("sieg");
    expect(profile.achievements).toContain("koloss");
    expect(profile.heatUnlocked).toBe(1);
    const again = applyRun(profile, run1);
    expect(again.achievements).toHaveLength(0);
    expect(again.altgold).toBe(altgoldFor(run1));
  });

  it("Werft: kaufen kostet Altgold, Bauplaene landen im Angebot", () => {
    const profile = newProfile();
    expect(unlockCrew(profile, "kanonier")).toBe(false);
    profile.altgold = 1000;
    expect(unlockCrew(profile, "kanonier")).toBe(true);
    expect(profile.altgold).toBe(1000 - CREW.kanonier.unlock);
    expect(unlockBlueprint(profile, "moerser")).toBe(true);
    expect(runOptions(profile).modulePool).toContain("moerser");
    expect(newProfile().blueprints).not.toContain("moerser");
    expect(runOptions(newProfile()).modulePool).not.toContain("moerser");
  });

  it("kaputte oder alte Profile werden repariert", () => {
    expect(sanitizeProfile(null).crew).toEqual(["schrauber"]);
    const fixed = sanitizeProfile({ altgold: "viel", crew: ["brecher", "gibtsnicht"], heat: 9 });
    expect(fixed.altgold).toBe(0);
    expect(fixed.crew).toEqual(["schrauber", "brecher"]);
    expect(fixed.heat).toBe(0);
  });

  it("Hitze macht Gegner zaeher und zahlreicher", () => {
    const cold = new Simulation([{ id: ME, name: "T", crew: "schrauber" }], 1);
    const hot = new Simulation([{ id: ME, name: "T", crew: "schrauber" }], 1, { heat: 5 });
    const node = cold.state.map.nodes[1]!;
    expect(hot.specFor(node, false).hp).toBeCloseTo(
      cold.specFor(node, false).hp * heatEffects(5).hp,
    );
    expect(hot.state.lead).toBeLessThan(cold.state.lead);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15);
  });
});
