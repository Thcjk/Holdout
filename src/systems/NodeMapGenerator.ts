/**
 * Die Knoten-Karte eines Runs - reines Datenmodell, noch ohne Anzeige.
 *
 * ================================================================
 * WAS SICH AENDERT
 * ================================================================
 *
 * Bisher war ein Run eine offene Welt (16000 x 16000 px), in der man selbst
 * entschied, wie weit man hinauslaeuft. Nach dem ueberarbeiteten Briefing
 * (Vorbild "Deadly Days: Roadtrip") wird er eine KARTE AUS KNOTEN: Man
 * waehlt von Station zu Station einen Weg, jede Station ist ein kleines
 * Gebiet mit einer Aufgabe, und je tiefer man kommt, desto gefaehrlicher
 * wird es. Die Entscheidung "wie weit wage ich mich" bleibt - sie faellt
 * jetzt an jeder Weggabelung statt am Stueck.
 *
 * Dieser Schritt baut NUR die Datenstruktur. Welcher Knoten welches Gebiet
 * erzeugt und wie die Karte aussieht, kommt spaeter.
 *
 * ================================================================
 * WIE DIE KARTE ENTSTEHT
 * ================================================================
 *
 *   Schicht 0          [Start]
 *                    /  |   |  \
 *   Schicht 1      K    K   K   K       jede Spalte, die ein Pfad trifft
 *                  |  / |    \  |
 *   ...           ...  ...   ...        Pfade gehen nur in NACHBARspalten
 *                    \  |   |  /
 *   letzte           [Boss]
 *
 * 1. Es werden `NODE_MAP.paths` Pfade von oben nach unten gezogen. Jeder
 *    Schritt geht in dieselbe Spalte oder eine daneben.
 * 2. Ein Schritt, der eine schon gezogene Kante KREUZEN wuerde, ist
 *    verboten. Geradeaus kreuzt nie - es bleibt also immer ein erlaubter
 *    Schritt. Kreuzungsfrei heisst: Die Karte laesst sich spaeter ohne
 *    verwirrende Ueberschneidungen zeichnen.
 * 3. Wo Pfade dieselbe Stelle treffen, entsteht EIN Knoten. Daraus
 *    ergeben sich die Gabelungen und Zusammenfuehrungen.
 * 4. Erst danach bekommen die Knoten ihren Typ und ihre Gefahr.
 *
 * Weil jeder Knoten auf einem Pfad vom Start zum Ziel liegt, ist jeder
 * erreichbar und fuehrt zum Ende. Eine Sackgasse kann es nicht geben - der
 * Aufbau schliesst sie aus, statt sie hinterher zu suchen (dieselbe Idee
 * wie beim Zusammenhang der offenen Welt in `WorldGenerator.ts`).
 *
 * ================================================================
 * DETERMINISMUS
 * ================================================================
 *
 * Zufall nur ueber Mulberry32 (`rng.ts`), mit eigenem Zustand aus dem Seed -
 * nie `Math.random()`. Gleicher Seed, gleiche Karte, auf jedem Geraet. Im
 * Koop muss so nur der Seed uebers Netz, nicht die Karte.
 */

import { NODE_MAP } from "../config/balance";
import { nextRandom, randomIndex } from "./rng";
import type { RngHolder } from "./rng";

/** Die Knotentypen aus BRIEFING Abschnitt 4. */
export type NodeType = "start" | "combat" | "elite" | "rest" | "extraction" | "boss";

export interface MapNode {
  /** Laufende Nummer, von oben nach unten und links nach rechts. */
  id: number;
  /** Schicht (Tiefe), 0 = Start. */
  layer: number;
  /** Spalte innerhalb der Schicht, 0 = links. */
  column: number;
  type: NodeType;
  /** Gefahrenstufe g, steigt mit der Tiefe. Start = 0. */
  danger: number;
  /**
   * Kartengroesse des Gebiets: 1 klein, 2 mittel, 3 gross. Eckdaten-Balken
   * vor der Auswahl (Briefing: "Kartengroesse, Gefahrenlevel, Beute").
   */
  arenaSize: 1 | 2 | 3;
  /** Beute-Potenzial, 0 fuer Knoten ohne Kampf. */
  loot: number;
  /** IDs der Knoten, zu denen es von hier aus weitergeht (aufsteigend). */
  next: number[];
}

export interface NodeMap {
  seed: number;
  depth: number;
  columns: number;
  nodes: MapNode[];
  startId: number;
  bossId: number;
}

/** Die Stellschrauben - Voreinstellung aus `NODE_MAP`, im Test ueberschreibbar. */
export interface NodeMapOptions {
  depth: number;
  columns: number;
  paths: number;
  typeWeights: Readonly<Record<"combat" | "elite" | "rest" | "extraction", number>>;
  eliteFromLayer: number;
  restFromLayer: number;
  extractionFromLayer: number;
  dangerPerLayer: number;
  eliteDangerBonus: number;
  lootBonus: Readonly<Record<"combat" | "elite" | "boss", number>>;
  sizeWeights: readonly number[];
  /** Kampfknoten weichen bis zu so viele Stufen von ihrer Schicht ab. */
  dangerSpread?: number;
}

/**
 * Die Grund-Gefahr einer Schicht. Eigene Funktion, weil Test und spaetere
 * Gebietserzeugung dieselbe Rechnung brauchen.
 */
export function layerDanger(layer: number, options: NodeMapOptions = NODE_MAP): number {
  return layer === 0 ? 0 : 1 + Math.floor(layer * options.dangerPerLayer);
}

export function generateNodeMap(seed: number, options: NodeMapOptions = NODE_MAP): NodeMap {
  const { depth, columns } = options;
  if (depth < 3 || columns < 1) {
    throw new Error("Eine Knoten-Karte braucht mindestens 3 Schichten und 1 Spalte.");
  }

  // Eigener Zufallsstrom - unabhaengig von Welt- und Spielzufall.
  const rng: RngHolder = { rngState: seed | 0 };
  const first = 1;
  const last = depth - 2;

  // --- 1.-3. Pfade ziehen -------------------------------------------------
  // `edges[layer]` sind die Kanten von Schicht `layer` nach `layer + 1`,
  // jeweils als [Spalte oben, Spalte unten].
  const edges: Array<Array<[number, number]>> = Array.from({ length: depth }, () => []);
  const used: Array<Set<number>> = Array.from({ length: depth }, () => new Set());

  let firstStart = -1;
  for (let path = 0; path < options.paths; path += 1) {
    let column = randomIndex(rng, columns);
    // Der zweite Pfad beginnt woanders als der erste: sonst gaebe es mit
    // etwas Pech gleich am Start keine Wahl.
    if (path === 1 && columns > 1 && column === firstStart) {
      column = (column + 1 + randomIndex(rng, columns - 1)) % columns;
    }
    if (path === 0) {
      firstStart = column;
    }
    used[first]?.add(column);

    for (let layer = first; layer < last; layer += 1) {
      const allowed = [column - 1, column, column + 1].filter(
        (target) =>
          target >= 0 &&
          target < columns &&
          !crosses(edges[layer] ?? [], column, target),
      );
      const target = allowed[randomIndex(rng, allowed.length)] ?? column;
      const list = edges[layer] ?? [];
      if (!list.some(([from, to]) => from === column && to === target)) {
        list.push([column, target]);
      }
      used[layer + 1]?.add(target);
      column = target;
    }
  }

  // --- Knoten anlegen, in fester Reihenfolge ------------------------------
  const nodes: MapNode[] = [];
  const idAt = new Map<string, number>();
  const key = (layer: number, column: number): string => `${layer}:${column}`;

  const middle = Math.floor((columns - 1) / 2);
  const add = (layer: number, column: number): void => {
    const id = nodes.length;
    nodes.push({ id, layer, column, type: "combat", danger: 0, arenaSize: 2, loot: 0, next: [] });
    idAt.set(key(layer, column), id);
  };

  add(0, middle);
  for (let layer = first; layer <= last; layer += 1) {
    for (const column of [...(used[layer] ?? [])].sort((a, b) => a - b)) {
      add(layer, column);
    }
  }
  add(depth - 1, middle);

  const startId = 0;
  const bossId = nodes.length - 1;
  const idOf = (layer: number, column: number): number => {
    const id = idAt.get(key(layer, column));
    if (id === undefined) {
      throw new Error(`Knoten ${key(layer, column)} fehlt - Fehler im Generator.`);
    }
    return id;
  };

  // --- Kanten eintragen ---------------------------------------------------
  const start = nodes[startId] as MapNode;
  for (const node of nodes) {
    if (node.layer === first) {
      start.next.push(node.id);
    }
    if (node.layer === last) {
      node.next.push(bossId);
    }
  }
  for (let layer = first; layer < last; layer += 1) {
    for (const [from, to] of edges[layer] ?? []) {
      (nodes[idOf(layer, from)] as MapNode).next.push(idOf(layer + 1, to));
    }
  }
  for (const node of nodes) {
    node.next.sort((a, b) => a - b);
  }

  // --- 4. Typ, Gefahr, Eckdaten -----------------------------------------
  assignTypes(nodes, rng, options, { first, last, depth });
  for (const node of nodes) {
    node.danger = layerDanger(node.layer, options);
    /*
     * Leichte und schwere Abzweigungen (Rueckmeldung 2026-09-25): Ein
     * Kampfknoten liegt eine Stufe unter oder ueber seiner Schicht. Die
     * Beute haengt an der Gefahr - wer den leichten Weg nimmt, findet
     * schwaecheres Zeug. Der Zug kommt NACH den Typen, damit die Typen
     * dieselben bleiben.
     */
    if (node.type === "combat") {
      const spread = options.dangerSpread ?? 0;
      const offset = spread > 0 ? randomIndex(rng, 2 * spread + 1) - spread : 0;
      node.danger = Math.max(1, node.danger + offset);
    }
    if (node.type === "elite") {
      node.danger += options.eliteDangerBonus;
    }
    if (node.type === "boss") {
      node.danger += options.eliteDangerBonus + 1;
    }
    node.loot =
      node.type === "combat" || node.type === "elite" || node.type === "boss"
        ? node.danger + options.lootBonus[node.type]
        : 0;
    // Groesse NACH den Typen wuerfeln, in fester Reihenfolge - so aendert
    // eine neue Regel fuer Groessen nichts an den Typen.
    const size = weightedIndex(rng, options.sizeWeights) + 1;
    node.arenaSize =
      node.type === "elite" ? 1 : node.type === "boss" ? 3 : (Math.min(3, size) as 1 | 2 | 3);
  }

  return { seed, depth, columns, nodes, startId, bossId };
}

/**
 * Wuerde die Kante (von -> nach) eine vorhandene kreuzen? Zwei Kanten
 * zwischen denselben Schichten kreuzen sich, wenn sie oben und unten in
 * umgekehrter Reihenfolge liegen.
 */
function crosses(existing: ReadonlyArray<[number, number]>, from: number, to: number): boolean {
  return existing.some(
    ([otherFrom, otherTo]) =>
      (otherFrom < from && otherTo > to) || (otherFrom > from && otherTo < to),
  );
}

/**
 * Knotentypen verteilen.
 *
 *   Start / Boss       fest an Anfang und Ende
 *   erste Schicht      immer Kampf - man soll mit dem Spiel anfangen
 *   vorletzte Schicht  immer Rast - Luft holen vor dem Boss
 *   dazwischen         nach Gewicht, mit Sperren: Extraktion erst ab
 *                      `extractionFromLayer`, Elite erst ab `eliteFromLayer`, Rast erst ab
 *                      `restFromLayer`, nie direkt nach einer Rast und nie
 *                      direkt vor der Pflicht-Rast
 *
 * Die Reihenfolge der Zufallszuege ist fest (Schicht fuer Schicht, links
 * nach rechts), sonst waere die Karte nicht wiederholbar.
 */
function assignTypes(
  nodes: MapNode[],
  rng: RngHolder,
  options: NodeMapOptions,
  layers: { first: number; last: number; depth: number },
): void {
  const parents = new Map<number, MapNode[]>();
  for (const node of nodes) {
    for (const id of node.next) {
      const list = parents.get(id) ?? [];
      list.push(node);
      parents.set(id, list);
    }
  }

  for (const node of nodes) {
    if (node.layer === 0) {
      node.type = "start";
    } else if (node.layer === layers.depth - 1) {
      node.type = "boss";
    } else if (node.layer === layers.first) {
      node.type = "combat";
    } else if (node.layer === layers.last) {
      node.type = "rest";
    } else {
      const afterRest = (parents.get(node.id) ?? []).some((parent) => parent.type === "rest");
      const choices: Array<[NodeType, number]> = [["combat", options.typeWeights.combat]];
      if (node.layer >= options.extractionFromLayer) {
        choices.push(["extraction", options.typeWeights.extraction]);
      }
      if (node.layer >= options.eliteFromLayer) {
        choices.push(["elite", options.typeWeights.elite]);
      }
      // Nicht direkt vor der Pflicht-Rast: sonst zwei Rasten hintereinander.
      if (node.layer >= options.restFromLayer && node.layer < layers.last - 1 && !afterRest) {
        choices.push(["rest", options.typeWeights.rest]);
      }
      node.type = weightedPick(rng, choices);
    }
  }
}

function weightedIndex(rng: RngHolder, weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = nextRandom(rng) * total;
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll < 0) {
      return index;
    }
  }
  return weights.length - 1;
}

function weightedPick(rng: RngHolder, choices: ReadonlyArray<[NodeType, number]>): NodeType {
  const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = nextRandom(rng) * total;
  for (const [type, weight] of choices) {
    roll -= weight;
    if (roll < 0) {
      return type;
    }
  }
  return choices[choices.length - 1]?.[0] ?? "combat";
}

/** Kurzzeichen je Typ fuer die Textausgabe. */
const SYMBOL: Record<NodeType, string> = {
  start: "S",
  combat: "K",
  elite: "E",
  rest: "R",
  extraction: "X",
  boss: "B",
};

/**
 * Die Karte als Text - zum Pruefen auf der Konsole (`npm run nodemap`).
 *
 *   K = Kampf, E = Elite, R = Rast, X = Extraktion, S = Start, B = Boss
 *   die Zahl dahinter ist die Gefahrenstufe g
 */
export function describeNodeMap(map: NodeMap): string {
  const lines = [`Knoten-Karte, Seed ${map.seed}: ${map.nodes.length} Knoten`];
  for (let layer = 0; layer < map.depth; layer += 1) {
    const row = Array.from({ length: map.columns }, () => "    ");
    const links: string[] = [];
    for (const node of map.nodes.filter((entry) => entry.layer === layer)) {
      row[node.column] = `${SYMBOL[node.type]}${node.danger}`.padEnd(4);
      if (node.next.length > 0) {
        const targets = node.next.map((id) => map.nodes[id]?.column ?? "?").join(",");
        links.push(`${node.column}->${targets}`);
      }
    }
    lines.push(`${String(layer).padStart(2)} | ${row.join("")}| ${links.join("  ")}`);
  }
  lines.push("K Kampf  E Elite  R Rast  X Extraktion  S Start  B Boss  Zahl = Gefahr g");
  return lines.join("\n");
}
