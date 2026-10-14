/**
 * Die Routenkarte eines Akts: Spalten von Stationen, von links (Start) nach
 * rechts (Endgegner). Von jeder Station fuehren ein oder zwei Wege weiter.
 * Jeder Lauf wuerfelt eine neue Karte.
 */

import { ACTS, NODES } from "./data/acts";
import { START_STATION, type MarchSpec } from "./data/route";
import type { Rng } from "./rng";
import type { ActMap, MapNode, NodeType } from "./types";

/** Arten, die mitten im Akt vorkommen koennen. */
const MIDDLE: readonly NodeType[] = ["ruine", "oase", "haendler", "schrott", "sturm", "ereignis"];

function pickType(rng: Rng, avoid: ReadonlySet<NodeType>): NodeType {
  const options = MIDDLE.filter((type) => !avoid.has(type));
  const pool = options.length > 0 ? options : MIDDLE;
  const total = pool.reduce((sum, type) => sum + NODES[type].weight, 0);
  let roll = rng() * total;
  for (const type of pool) {
    roll -= NODES[type].weight;
    if (roll <= 0) {
      return type;
    }
  }
  return pool[0]!;
}

/** Neue Karte fuer einen Akt. `start`: Name der Startstation (Ziel des vorigen Akts). */
export function generateMap(rng: Rng, act: number, start = START_STATION): ActMap {
  const spec = ACTS[act] ?? ACTS[0]!;
  const nodes: MapNode[] = [];
  const columns: MapNode[][] = [];
  const usedNames = new Set<string>();
  const add = (layer: number, y: number, type: NodeType, name?: string): MapNode => {
    const names = NODES[type].names.filter((n) => !usedNames.has(n));
    const chosen = name ?? names[Math.floor(rng() * names.length)] ?? NODES[type].label;
    usedNames.add(chosen);
    const node: MapNode = { id: nodes.length, layer, y, type, name: chosen, next: [] };
    nodes.push(node);
    (columns[layer] ??= []).push(node);
    return node;
  };

  add(0, 0.5, "start", start);
  const last = spec.layers - 1;
  for (let layer = 1; layer < last; layer += 1) {
    const count = layer === 1 ? 2 : rng() < 0.55 ? 3 : 2;
    const avoid = new Set<NodeType>();
    for (let i = 0; i < count; i += 1) {
      // Gleichmaessig verteilt, mit etwas Zufall.
      const y = (i + 0.5) / count + (rng() - 0.5) * (0.5 / count);
      const type = pickType(rng, avoid);
      avoid.add(type);
      add(layer, y, type);
    }
  }
  add(last, 0.5, "boss", spec.goal);

  // Vor dem Endgegner soll es eine Oase zur Wahl geben, und unterwegs einen Haendler.
  const beforeBoss = columns[last - 1]!;
  if (!beforeBoss.some((n) => n.type === "oase")) {
    retype(beforeBoss[Math.floor(rng() * beforeBoss.length)]!, "oase", rng, usedNames);
  }
  const middle = columns.slice(2, last - 1).flat();
  if (middle.length > 0 && !middle.some((n) => n.type === "haendler")) {
    retype(middle[Math.floor(rng() * middle.length)]!, "haendler", rng, usedNames);
  }

  // Wege: jede Station zu ein oder zwei in der naechsten Spalte, ohne sich zu kreuzen.
  for (let layer = 0; layer < last; layer += 1) {
    const from = columns[layer]!;
    const to = columns[layer + 1]!;
    const share = (i: number, n: number, m: number): number =>
      n <= 1 ? Math.floor((m - 1) / 2) : Math.round((i * (m - 1)) / (n - 1));
    from.forEach((node, i) => {
      const main = share(i, from.length, to.length);
      link(node, to[main]!);
      // Manchmal eine Abzweigung nach unten, wenn sie nichts kreuzt.
      const nextMain = i + 1 < from.length ? share(i + 1, from.length, to.length) : to.length;
      if (main + 1 < to.length && main + 1 <= nextMain && rng() < 0.6) {
        link(node, to[main + 1]!);
      }
    });
    // Start und kleine Spalten: zu allen.
    if (from.length === 1) {
      to.forEach((node) => link(from[0]!, node));
    }
    to.forEach((node, j) => {
      if (!from.some((n) => n.next.includes(node.id))) {
        link(from[share(j, to.length, from.length)]!, node);
      }
    });
  }
  return { act, name: spec.name, layers: spec.layers, nodes };
}

function link(a: MapNode, b: MapNode): void {
  if (!a.next.includes(b.id)) {
    a.next.push(b.id);
    a.next.sort((x, y) => x - y);
  }
}

function retype(node: MapNode, type: NodeType, rng: Rng, used: Set<string>): void {
  node.type = type;
  const names = NODES[type].names.filter((n) => !used.has(n));
  node.name = names[Math.floor(rng() * names.length)] ?? NODES[type].label;
  used.add(node.name);
}

/** Fester Probelauf als gerade Karte (Tests, `?debug=kurz` mit fester Route). */
export function linearMap(route: readonly MarchSpec[]): ActMap {
  const nodes: MapNode[] = [
    { id: 0, layer: 0, y: 0.5, type: "start", name: START_STATION, next: [1] },
  ];
  route.forEach((march, i) => {
    nodes.push({
      id: i + 1,
      layer: i + 1,
      y: 0.5,
      type: march.boss ? "boss" : "station",
      name: march.station,
      next: i + 1 < route.length ? [i + 2] : [],
      route: i,
    });
  });
  return { act: 0, name: "Probelauf", layers: route.length + 1, nodes, fixed: true };
}

/** Wohin es von hier aus weitergeht. */
export function nextNodes(map: ActMap, at: number): MapNode[] {
  const here = map.nodes[at];
  return here ? here.next.map((id) => map.nodes[id]!).filter(Boolean) : [];
}
