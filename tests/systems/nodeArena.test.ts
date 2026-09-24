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
import { soloSetup } from "../helpers";

const SEEDS = [1, 42, 4242, 90210, -7, 777, 31337, 2024];

function node(danger: number, type: MapNode["type"] = "combat", arenaSize: 1 | 2 | 3 = 2): MapNode {
  return { id: 3, layer: 3, column: 1, type, danger, arenaSize, loot: danger, next: [] };
}

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
      for (const danger of [1, 5, 11]) {
        const arena = buildArena(seed, node(danger, danger > 8 ? "elite" : "combat"));
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
      for (const seed of SEEDS) {
        const arena = buildArena(seed, node(danger));
        walls += arena.walls.length;
        buildings += arena.buildings.length;
        crates += arena.props.filter((prop) => prop.kind.startsWith("crate")).length;
      }
      return { walls, crates, buildings };
    };
    const low = totals(1);
    const high = totals(9);
    console.log("   g=1:", low, " g=9:", high);
    expect(high.crates).toBeGreaterThan(low.crates * 1.5);
    expect(high.buildings).toBeGreaterThan(low.buildings);
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
    expect(state.bounds.width).toBeLessThan(3000);
    // Die offene Welt bleibt, wie sie war.
    const open = createWorld(soloSetup(), 4242);
    expect(open.fixedZone).toBeUndefined();
    expect(open.bounds.width).toBe(16000);
  });
});
