/**
 * Das Gebiet eines Knotens: wiederholbar, begehbar, dichter mit steigender
 * Gefahr, innerhalb der Leistungsgrenzen.
 */

import { describe, expect, it } from "vitest";
import { NODE_ARENA, PLAYER, WORLD } from "../../src/config/balance";
import { ITEMS } from "../../src/config/items";
import {
  buildArena,
  densityCount,
  generateNodeArena,
} from "../../src/systems/NodeArenaGenerator";
import type { NodeArena } from "../../src/systems/NodeArenaGenerator";
import type { MapNode } from "../../src/systems/NodeMapGenerator";
import { createWorld } from "../../src/systems/world";
import { SOLID_PROP_KINDS } from "../../src/systems/types";
import { soloSetup } from "../helpers";

const SEEDS = [1, 42, 4242, 90210, -7, 777, 31337, 2024];

function node(
  danger: number,
  type: MapNode["type"] = "combat",
  arenaSize: 1 | 2 | 3 = 2,
  layer = 3,
): MapNode {
  return { id: 3, layer, column: 1, type, danger, arenaSize, loot: danger, next: [] };
}

/** Je eine Schicht aus jeder Region: Stadtrand, Industrie, Wald, Kueste. */
const REGION_LAYERS = [1, 4, 7, 10];

/**
 * Flutfuellung auf einem 24-px-Raster: Welche Zellen erreicht ein Spieler
 * vom Start aus? Eine Zelle ist frei, wenn ein Kreis mit Spielerradius dort
 * keine Wand beruehrt.
 */
function reachable(arena: NodeArena): { free: number; reached: Set<number>; cellOf: (x: number, y: number) => number } {
  const step = 24;
  const columns = Math.floor(arena.bounds.width / step);
  const rows = Math.floor(arena.bounds.height / step);
  const r = PLAYER.radius;
  const blocked = new Uint8Array(columns * rows);
  let free = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * step + step / 2;
      const y = row * step + step / 2;
      const hit = arena.walls.some((wall) => {
        const dx = Math.max(wall.x - x, 0, x - (wall.x + wall.width));
        const dy = Math.max(wall.y - y, 0, y - (wall.y + wall.height));
        return dx * dx + dy * dy < r * r;
      });
      blocked[row * columns + column] = hit ? 1 : 0;
      if (!hit) free += 1;
    }
  }
  const cellOf = (x: number, y: number): number =>
    Math.floor(y / step) * columns + Math.floor(x / step);
  const start = cellOf(arena.spawnPoint.x, arena.spawnPoint.y);
  const reached = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.pop() as number;
    const column = cell % columns;
    const row = Math.floor(cell / columns);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = column + dc;
      const rr = row + dr;
      if (c < 0 || rr < 0 || c >= columns || rr >= rows) continue;
      const next = rr * columns + c;
      if (!blocked[next] && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  return { free, reached, cellOf };
}

describe("Knoten-Gebiet", () => {
  it("ist bei gleichem Seed und Knoten identisch", () => {
    for (const seed of SEEDS) {
      expect(generateNodeArena(seed, 5)).toEqual(generateNodeArena(seed, 5));
    }
  });

  it("unterscheidet sich zwischen Knoten derselben Karte", () => {
    const a = generateNodeArena(4242, 1);
    const b = generateNodeArena(4242, 2);
    expect(a.walls).not.toEqual(b.walls);
  });

  it("liegt mit allen Waenden und Bueschen auf dem Kachelraster", () => {
    for (const seed of SEEDS) {
      const arena = buildArena(seed, node(6));
      for (const rect of [...arena.walls, ...arena.bushes]) {
        for (const value of [rect.x, rect.y, rect.width, rect.height]) {
          expect(value % WORLD.grid).toBe(0);
        }
      }
    }
  });

  it("ist ganz begehbar: jede freie Stelle, jede Beute und der Ausstieg sind erreichbar", () => {
    for (const seed of SEEDS) {
      for (const [index, danger] of [1, 5, 11, 7].entries()) {
        const layer = REGION_LAYERS[index] as number;
        const arena = buildArena(seed, node(danger, danger > 8 ? "elite" : "combat", 2, layer));
        const { free, reached, cellOf } = reachable(arena);
        // Gegenprobe gegen einen stillen Fehlschlag: Es gibt ueberhaupt Platz.
        expect(free).toBeGreaterThan(1000);
        expect(reached.size / free, `Seed ${seed}, g ${danger}`).toBeGreaterThan(0.999);
        for (const item of arena.lootSpots) {
          expect(reached.has(cellOf(item.position.x, item.position.y)), `Beute Seed ${seed}`).toBe(true);
        }
        const exit = arena.extractions[0];
        expect(exit).toBeDefined();
        expect(reached.has(cellOf(exit!.position.x, exit!.position.y))).toBe(true);
      }
    }
  });

  it("wird mit steigender Gefahr dichter - Haeuser, Deckung, Deko", () => {
    const totals = (danger: number) => {
      let walls = 0;
      let crates = 0;
      let buildings = 0;
      let wrecks = 0;
      for (const seed of SEEDS) {
        const arena = buildArena(seed, node(danger));
        walls += arena.walls.length;
        buildings += arena.buildings.length;
        // Ausgebrannte Autos auf der Strasse (Spielart 4 und 5).
        wrecks += arena.props.filter((prop) => prop.kind === "car" && prop.variant >= 4).length;
        crates += arena.props.filter((prop) => prop.kind.startsWith("crate")).length;
      }
      return { walls, crates, buildings, wrecks };
    };
    const low = totals(1);
    const high = totals(9);
    console.log("   g=1:", low, " g=9:", high);
    expect(high.crates).toBeGreaterThan(low.crates * 1.5);
    // Die Orte an der Strasse (mit ihren Haeusern) haengen an Kartengroesse
    // und Region, nicht an g - deshalb hier kein Vergleich der Haeuser. Die
    // Autowracks auf der Strasse wachsen mit g.
    expect(high.wrecks).toBeGreaterThan(low.wrecks);
    expect(high.walls).toBeGreaterThan(low.walls);
    // Die Formel selbst: Grundwert + Faktor x g, begrenzt.
    expect(densityCount(NODE_ARENA.cover, 1)).toBe(Math.round(6 + 1.5));
    expect(densityCount(NODE_ARENA.cover, 100)).toBe(NODE_ARENA.cover.max);
  });

  it("haelt die Leistungsgrenze ein: nie mehr Kisten als erlaubt", () => {
    for (const seed of SEEDS) {
      const arena = buildArena(seed, node(30, "combat", 3));
      const crates = arena.props.filter((prop) => prop.kind.startsWith("crate")).length;
      expect(crates).toBeLessThanOrEqual(NODE_ARENA.maxCrates);
    }
  });

  it("hat Umgebung: Blockierendes steht in walls, Kleinkram in keiner Wand, Umland draussen", () => {
    for (const seed of SEEDS) {
      const arena = buildArena(seed, node(6));
      const inside = (x: number, y: number, rect: { x: number; y: number; width: number; height: number }) =>
        x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height;
      const withinBounds = (x: number, y: number) => inside(x, y, arena.bounds);

      expect(arena.props.length).toBeLessThanOrEqual(NODE_ARENA.maxProps);
      const kinds = new Set(arena.props.map((prop) => prop.kind));
      for (const kind of ["tree", "pine", "rock", "grass", "stone", "shrub"] as const) {
        expect(kinds.has(kind), `Seed ${seed}: ${kind}`).toBe(true);
      }

      for (const prop of arena.props) {
        if (!withinBounds(prop.x, prop.y)) {
          continue; // Umland
        }
        const inWall = arena.walls.some((wall) => inside(prop.x, prop.y, wall));
        if (SOLID_PROP_KINDS.has(prop.kind)) {
          // Was blockiert aussieht, blockiert auch - sonst liefe man durch
          // einen Baum.
          expect(inWall, `Seed ${seed}: ${prop.kind} ohne Wand`).toBe(true);
        } else if (prop.kind !== "patch" && prop.kind !== "smoke") {
          // Gras, Steine, Blumen, Schutt, Straeucher stechen nicht aus Waenden.
          expect(inWall, `Seed ${seed}: ${prop.kind} in Wand`).toBe(false);
        }
      }

      // Umland: nur ausserhalb der Mauer, und es gibt welches.
      const outskirts = arena.props.filter((prop) => !withinBounds(prop.x, prop.y));
      expect(outskirts.length).toBeGreaterThan(40);
    }
  });

  it("baut je Region passende Orte an eine Strasse", () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      for (const layer of REGION_LAYERS) {
        const arena = buildArena(seed, node(4, "combat", 3, layer));
        // Die Strasse laeuft der Laenge nach durch - Start und Ausstieg liegen darauf.
        const road = arena.roads[0]!;
        for (const point of [arena.spawnPoint, arena.extractions[0]!.position]) {
          expect(point.y).toBeGreaterThanOrEqual(road.y);
          expect(point.y).toBeLessThanOrEqual(road.y + road.height);
        }
        expect(arena.extractions[0]!.position.x).toBeGreaterThan(arena.bounds.width * 0.8);
        for (const prop of arena.props) seen.add(`${arena.theme}:${prop.kind}`);
      }
    }
    // Stichproben: Zapfsaeulen am Stadtrand, Container im Industriegebiet,
    // Zelte im Wald, Boote an der Kueste.
    for (const expected of ["suburb:pump", "industry:container", "forest:tent", "coast:boat"]) {
      expect(seen.has(expected), expected).toBe(true);
    }
  });

  it("laesst den Startplatz frei", () => {
    for (const seed of SEEDS) {
      const arena = buildArena(seed, node(11));
      const { x, y } = arena.spawnPoint;
      for (const wall of arena.walls) {
        const dx = Math.max(wall.x - x, 0, x - (wall.x + wall.width));
        const dy = Math.max(wall.y - y, 0, y - (wall.y + wall.height));
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(NODE_ARENA.spawnClear);
      }
    }
  });

  it("gibt bei hoeherer Gefahr bessere Beute", () => {
    const averageRarity = (danger: number): number => {
      let sum = 0;
      let count = 0;
      for (let seed = 0; seed < 60; seed += 1) {
        for (const item of buildArena(seed, node(danger)).lootSpots) {
          sum += ITEMS[item.def]?.rarity ?? 0;
          count += 1;
        }
      }
      return sum / count;
    };
    const low = averageRarity(1);
    const high = averageRarity(9);
    console.log(`   mittlere Seltenheit g=1: ${low.toFixed(2)}, g=9: ${high.toFixed(2)}`);
    expect(high).toBeGreaterThan(low + 0.3);
  });

  it("setzt einen Boss nur in Elite- und Ende-Boss-Knoten", () => {
    expect(buildArena(1, node(3)).encounters).toHaveLength(0);
    const elite = buildArena(1, node(6, "elite", 1)).encounters;
    expect(elite).toHaveLength(1);
    expect(elite[0]?.isFinal).toBe(false);
    expect(elite[0]?.zone).toBe(6);
    const boss = buildArena(1, node(11, "boss", 3)).encounters;
    expect(boss[0]?.isFinal).toBe(true);
  });

  it("wird zum Weltzustand: feste Zone g, keine Heilzone, Kulisse dabei", () => {
    const state = createWorld(soloSetup(), 4242, { nodeId: null });
    expect(state.fixedZone).toBeGreaterThanOrEqual(1);
    expect(state.safeRadius).toBe(0);
    expect(state.props?.length).toBeGreaterThan(0);
    // Laenglich, rund doppelt so gross wie die alten 40-56 m (2026-09-25),
    // aber weit kleiner als die offene Welt.
    expect(state.bounds.width).toBeLessThan(6000);
    expect(state.bounds.width).toBeGreaterThan(state.bounds.height);
    // Die offene Welt bleibt, wie sie war.
    const open = createWorld(soloSetup(), 4242);
    expect(open.fixedZone).toBeUndefined();
    expect(open.bounds.width).toBe(16000);
  });
});
