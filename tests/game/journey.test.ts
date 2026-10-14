import { describe, expect, it } from "vitest";
import { STATION_BONUS, TICK } from "../../src/game/constants";
import { ACTS, LEAD_AFTER_HORDE, LEAD_START } from "../../src/game/data/acts";
import { EVENTS } from "../../src/game/data/events";
import { MODULES } from "../../src/game/data/modules";
import { generateMap } from "../../src/game/map";
import { createRng } from "../../src/game/rng";
import { Simulation } from "../../src/game/Simulation";
import { CHEST_TIME, LOOT_TIME, OASIS_REPAIR, STORM_BONUS } from "../../src/game/systems/journey";
import type { NodeType, PlayerInput } from "../../src/game/types";

const ME = "p1";

/** Lauf mit sehr kurzen Maerschen (eine gute Sekunde), damit man schnell ankommt. */
function sim(seed = 4): Simulation {
  return new Simulation([{ id: ME, name: "Test", crew: "schrauber" }], seed, {
    lengthFactor: 0.02,
  });
}

function run(s: Simulation, seconds: number, input: PlayerInput = { mx: 0, my: 0 }): void {
  for (let i = 0; i < Math.round(seconds / TICK); i += 1) {
    s.advance(TICK * 1000 + 0.01, new Map([[ME, input]]));
  }
}

/** Die erste erreichbare Station bekommt diese Art; dorthin losziehen und ankommen. */
function travelTo(s: Simulation, type: NodeType): void {
  const here = s.state.map.nodes[s.state.at]!;
  const target = s.state.map.nodes[here.next[0]!]!;
  target.type = type;
  s.command(ME, { kind: "depart", node: target.id });
  run(s, 2.5);
}

describe("Routenkarte", () => {
  it("hat Start, Endgegner und lauter verbundene Stationen dazwischen", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const map = generateMap(createRng(seed), 0);
      const layers = ACTS[0]!.layers;
      expect(map.layers).toBe(layers);
      expect(map.nodes.filter((n) => n.layer === 0)).toHaveLength(1);
      const bosses = map.nodes.filter((n) => n.layer === layers - 1);
      expect(bosses).toHaveLength(1);
      expect(bosses[0]!.type).toBe("boss");
      for (const node of map.nodes) {
        if (node.layer > 0) {
          expect(map.nodes.some((n) => n.next.includes(node.id))).toBe(true);
        }
        if (node.layer < layers - 1) {
          expect(node.next.length).toBeGreaterThan(0);
          for (const id of node.next) {
            expect(map.nodes[id]!.layer).toBe(node.layer + 1);
          }
        }
      }
      // Vor dem Endgegner gibt es eine Oase zur Wahl, unterwegs einen Haendler.
      expect(map.nodes.some((n) => n.layer === layers - 2 && n.type === "oase")).toBe(true);
      expect(map.nodes.some((n) => n.type === "haendler")).toBe(true);
    }
  });

  it("jeder Lauf wuerfelt eine andere Karte, derselbe Seed dieselbe", () => {
    const a = JSON.stringify(generateMap(createRng(1), 0));
    expect(JSON.stringify(generateMap(createRng(1), 0))).toBe(a);
    expect(JSON.stringify(generateMap(createRng(2), 0))).not.toBe(a);
  });

  it("man zieht zur gewaehlten Station, nicht zu einer unerreichbaren", () => {
    const s = sim();
    const start = s.state.map.nodes[0]!;
    const choice = start.next[start.next.length - 1]!;
    s.command(ME, { kind: "depart", node: choice });
    expect(s.state.march.node).toBe(choice);
    const t = sim();
    t.command(ME, { kind: "depart", node: 999 });
    expect(t.state.march.node).toBe(start.next[0]);
  });
});

describe("Stationen", () => {
  it("Ruine: Die Festung haelt, Truhen am Boden, dann Rast", () => {
    const s = sim();
    travelTo(s, "ruine");
    expect(s.state.lead).toBe(LEAD_START - 1);
    expect(s.state.phase).toBe("loot");
    expect(s.state.chests.length).toBeGreaterThan(0);
    const x = s.state.fort.x;
    // Neben eine Truhe stellen (der Mech steht schon am Boden).
    const p = s.state.players[0]!;
    const chest = s.state.chests[0]!;
    p.layer = "ground";
    p.z = 0;
    p.x = chest.x;
    p.y = chest.y;
    const bank = s.state.bank;
    run(s, CHEST_TIME + 0.5);
    expect(chest.opened).toBe(true);
    expect(s.state.fort.x).toBe(x);
    // Der Inhalt springt heraus und wird gleich aufgesammelt.
    expect(s.state.bank).toBeGreaterThanOrEqual(bank + chest.value);
    run(s, LOOT_TIME);
    expect(s.state.phase).toBe("rest");
    expect(s.state.enemies).toHaveLength(0);
  });

  it("Oase repariert den Rumpf", () => {
    const s = sim();
    s.state.fort.hull = 300;
    travelTo(s, "oase");
    expect(s.state.phase).toBe("rest");
    expect(s.state.fort.hull).toBe(300 + OASIS_REPAIR);
  });

  it("Haendler: sechs Module im Angebot, Neu-Wuerfeln billig", () => {
    const s = sim();
    travelTo(s, "haendler");
    expect(s.state.offer).toHaveLength(6);
    expect(s.rerollCost()).toBeLessThan(5);
  });

  it("Sturm: Fundstuecke und Vorsprung", () => {
    const s = sim();
    const bank = s.state.bank;
    travelTo(s, "sturm");
    expect(s.state.lead).toBe(Math.min(5, LEAD_START + 2));
    expect(s.state.bank).toBe(bank + STATION_BONUS + STORM_BONUS);
  });

  it("Schrottfeld: am Weg liegt Schrott", () => {
    const s = sim();
    const target = s.state.map.nodes[s.state.map.nodes[0]!.next[0]!]!;
    target.type = "schrott";
    s.command(ME, { kind: "depart", node: target.id });
    expect(s.state.scrap.length).toBeGreaterThan(10);
  });

  it("Ereignis: erst entscheiden, dann weiter", () => {
    const s = sim();
    travelTo(s, "ereignis");
    expect(s.state.event).not.toBeNull();
    const event = EVENTS.find((e) => e.id === s.state.event!.id)!;
    s.command(ME, { kind: "depart" });
    expect(s.state.phase).toBe("rest");
    const bank = s.state.bank;
    const lead = s.state.lead;
    s.command(ME, { kind: "choose", option: 0 });
    expect(s.state.event).toBeNull();
    const effect = event.choices[0].effect;
    expect(s.state.bank).toBe(Math.max(0, bank + (effect.scrap ?? 0)) + (effect.upgrade ? 30 : 0));
    expect(s.state.lead).toBe(Math.max(0, Math.min(5, lead + (effect.lead ?? 0))));
    s.command(ME, { kind: "depart" });
    expect(s.state.phase).toBe("march");
  });

  it("Vorsprung 0: Die Armee holt auf, der naechste Marsch wird eine Heerschar", () => {
    const s = sim();
    s.state.lead = 1;
    const target = s.state.map.nodes[s.state.map.nodes[0]!.next[0]!]!;
    target.type = "ruine";
    s.command(ME, { kind: "depart", node: target.id });
    expect(s.state.march.horde).toBe(true);
    expect(s.state.lead).toBe(LEAD_AFTER_HORDE);
    const normal = s.specFor(target, false);
    const horde = s.march()!;
    expect(horde.spawnEnd).toBeGreaterThan(normal.spawnEnd * 1.4);
  });

  it("der Endgegner-Marsch beendet den Akt, wenn der Koloss faellt", () => {
    const s = sim();
    // Direkt vor den Endgegner springen.
    const boss = s.state.map.nodes.find((n) => n.type === "boss")!;
    const before = s.state.map.nodes.find((n) => n.next.includes(boss.id))!;
    s.state.at = before.id;
    s.command(ME, { kind: "depart", node: boss.id });
    expect(s.state.march.boss).toBe("waiting");
    run(s, 3);
    expect(s.state.phase).toBe("march");
    const koloss = s.state.enemies.find((e) => e.type === "koloss")!;
    koloss.hp = 1;
    s.state.shots.push({
      id: 9999,
      owner: ME,
      look: "rivet",
      pull: 0,
      x: koloss.x,
      y: koloss.y,
      z: 10,
      vx: 0,
      vy: 0,
      vz: 0,
      damage: 50,
      life: 1,
      splash: 0,
      pierce: 0,
      hit: [],
    });
    run(s, 0.5);
    expect(s.state.phase).toBe("won");
  });

  it("Module kosten weiter ihren Preis, egal an welcher Station", () => {
    const s = sim();
    travelTo(s, "oase");
    const type = s.state.offer[0]!;
    const bank = s.state.bank;
    s.command(ME, { kind: "build", module: type, col: 1, row: 3 });
    if (s.state.modules.length > 0) {
      expect(s.state.bank).toBe(bank - MODULES[type].cost);
    }
  });
});
