/**
 * Die Knoten-Karte: wiederholbar, ohne Sackgassen, ohne Kreuzungen, mit
 * steigender Gefahr.
 */

import { describe, expect, it } from "vitest";
import { NODE_MAP } from "../../src/config/balance";
import {
  describeNodeMap,
  generateNodeMap,
  layerDanger,
} from "../../src/systems/NodeMapGenerator";
import type { MapNode, NodeMap } from "../../src/systems/NodeMapGenerator";

const SEEDS = [1, 42, 4242, 90210, -7, 2147483647];

/** Alle Knoten, die vom Start aus erreichbar sind. */
function reachableFromStart(map: NodeMap): Set<number> {
  const seen = new Set<number>([map.startId]);
  const queue = [map.startId];
  while (queue.length > 0) {
    const id = queue.shift() as number;
    for (const next of map.nodes[id]?.next ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

/** Alle Knoten, von denen aus der Boss erreichbar ist. */
function leadsToBoss(map: NodeMap): Set<number> {
  const good = new Set<number>([map.bossId]);
  // Von unten nach oben: Ein Knoten fuehrt zum Boss, wenn einer seiner
  // Nachfolger es tut.
  for (const node of [...map.nodes].sort((a, b) => b.layer - a.layer)) {
    if (node.next.some((id) => good.has(id))) {
      good.add(node.id);
    }
  }
  return good;
}

describe("Knoten-Karte", () => {
  it("ist bei gleichem Seed identisch - bis in den letzten Knoten", () => {
    for (const seed of SEEDS) {
      expect(generateNodeMap(seed)).toEqual(generateNodeMap(seed));
    }
  });

  it("unterscheidet sich bei verschiedenen Seeds", () => {
    const texts = new Set(SEEDS.map((seed) => describeNodeMap(generateNodeMap(seed)).split("\n").slice(1).join("\n")));
    expect(texts.size).toBe(SEEDS.length);
  });

  it("benutzt keinen Math.random", () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error("Math.random darf hier nicht vorkommen");
    };
    try {
      expect(() => generateNodeMap(4242)).not.toThrow();
    } finally {
      Math.random = original;
    }
  });

  it("hat keine Sackgassen: jeder Knoten ist erreichbar und fuehrt zum Boss", () => {
    for (const seed of SEEDS) {
      const map = generateNodeMap(seed);
      expect(reachableFromStart(map).size).toBe(map.nodes.length);
      expect(leadsToBoss(map).size).toBe(map.nodes.length);
    }
  });

  it("geht nur eine Schicht tiefer und nur in Nachbarspalten", () => {
    for (const seed of SEEDS) {
      const map = generateNodeMap(seed);
      for (const node of map.nodes) {
        for (const id of node.next) {
          const target = map.nodes[id] as MapNode;
          expect(target.layer).toBe(node.layer + 1);
          // Start und Boss sind Sammelpunkte - von dort darf es ueberall hin.
          if (node.id !== map.startId && target.id !== map.bossId) {
            expect(Math.abs(target.column - node.column)).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("hat keine sich kreuzenden Wege", () => {
    for (const seed of SEEDS) {
      const map = generateNodeMap(seed);
      for (let layer = 1; layer < map.depth - 2; layer += 1) {
        const edges = map.nodes
          .filter((node) => node.layer === layer)
          .flatMap((node) => node.next.map((id) => [node.column, map.nodes[id]?.column ?? -1]));
        for (const [a, b] of edges) {
          for (const [c, d] of edges) {
            expect((a! < c! && b! > d!) || (a! > c! && b! < d!), `Seed ${seed}, Schicht ${layer}`).toBe(false);
          }
        }
      }
    }
  });

  it("verzweigt sich wirklich: mehrere parallele Wege", () => {
    for (const seed of SEEDS) {
      const map = generateNodeMap(seed);
      const start = map.nodes[map.startId] as MapNode;
      // Gleich am Anfang eine Wahl ...
      expect(start.next.length).toBeGreaterThanOrEqual(2);
      // ... und in der Mitte mehr als ein Knoten je Schicht.
      const middle = map.nodes.filter((node) => node.layer === Math.floor(map.depth / 2));
      expect(middle.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("steigert die Gefahr mit der Tiefe", () => {
    for (let layer = 1; layer < NODE_MAP.depth; layer += 1) {
      expect(layerDanger(layer)).toBeGreaterThanOrEqual(layerDanger(layer - 1));
    }
    expect(layerDanger(NODE_MAP.depth - 1)).toBeGreaterThan(layerDanger(1));

    for (const seed of SEEDS) {
      const map = generateNodeMap(seed);
      for (const node of map.nodes) {
        expect(node.danger).toBeGreaterThanOrEqual(layerDanger(node.layer));
      }
      // Der Boss ist der gefaehrlichste Knoten der Karte.
      const boss = map.nodes[map.bossId] as MapNode;
      expect(Math.max(...map.nodes.map((node) => node.danger))).toBe(boss.danger);
    }
  });

  it("haelt die Regeln fuer Knotentypen ein", () => {
    for (const seed of SEEDS) {
      const map = generateNodeMap(seed);
      expect(map.nodes[map.startId]?.type).toBe("start");
      expect(map.nodes[map.bossId]?.type).toBe("boss");
      for (const node of map.nodes) {
        if (node.layer === 1) expect(node.type).toBe("combat");
        if (node.layer === map.depth - 2) expect(node.type).toBe("rest");
        if (node.type === "elite") {
          expect(node.layer).toBeGreaterThanOrEqual(NODE_MAP.eliteFromLayer);
        }
        if (node.type === "rest" && node.layer < map.depth - 2) {
          expect(node.layer).toBeGreaterThanOrEqual(NODE_MAP.restFromLayer);
        }
      }
      // Nie zwei Rastplaetze hintereinander - auch nicht vor der
      // Pflicht-Rast vor dem Boss.
      for (const node of map.nodes) {
        if (node.type !== "rest") continue;
        for (const id of node.next) {
          expect(map.nodes[id]?.type).not.toBe("rest");
        }
      }
    }
  });

  it("kommt mit Randfaellen zurecht: eine Spalte, kleinste Tiefe", () => {
    const narrow = generateNodeMap(5, { ...NODE_MAP, columns: 1 });
    expect(reachableFromStart(narrow).size).toBe(narrow.nodes.length);
    const shallow = generateNodeMap(5, { ...NODE_MAP, depth: 3 });
    expect(shallow.nodes.map((node) => node.type)).toContain("boss");
    expect(leadsToBoss(shallow).size).toBe(shallow.nodes.length);
  });
});
