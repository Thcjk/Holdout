/**
 * Ein Run auf der Knoten-Karte: wo das Team steht, was es schon hinter sich
 * hat, und was jeder Spieler von Gebiet zu Gebiet mitnimmt.
 *
 * Phaserfrei - die Kartenansicht (`scenes/MapScene.ts`) zeigt es nur an, und
 * im Koop rechnet jedes Geraet dieselben Schritte aus demselben Seed.
 *
 * ================================================================
 * DER ABLAUF
 * ================================================================
 *
 *   Packen -> Karte -> Gebiet -> (Ausgang) -> Karte -> Gebiet -> ...
 *                        |                      |
 *                        +-- Wipe: Run verloren  +-- Rast: heilen, Tasche
 *                                                +-- Extraktion: Ausgang
 *                                                    im Gebiet = Run gewonnen
 *                                                +-- Ende-Boss: besiegen = Run gewonnen
 *
 * Man geht nur VORWAERTS: erreichbar sind die Nachfolger des Knotens, auf
 * dem man steht. Wer eine leichte Abzweigung nimmt, bekommt dort schwaechere
 * Beute und kommt nicht mehr zurueck - das ist die Entscheidung.
 */

import { itemAt } from "../config/items";
import { generateNodeMap } from "./NodeMapGenerator";
import type { MapNode, NodeMap } from "./NodeMapGenerator";
import type { PackedItem } from "./types";
import type { PlayerSetup } from "./world";

export interface RunState {
  /** Karten-Seed - daraus entstehen Karte und jedes Gebiet. */
  seed: number;
  map: NodeMap;
  /** Knoten, auf dem das Team steht (am Anfang der Start). */
  current: number;
  /** Alle betretenen Knoten, in Reihenfolge - fuer die Anzeige des Wegs. */
  visited: number[];
  /** Wie viele Gebiete geschafft sind ("Tag 3"). */
  day: number;
  /** Die Spieler mit dem, was sie gerade tragen. */
  players: PlayerSetup[];
}

export function createRun(seed: number, players: readonly PlayerSetup[]): RunState {
  const map = generateNodeMap(seed);
  return {
    seed,
    map,
    current: map.startId,
    visited: [map.startId],
    day: 0,
    players: players.map((player) => ({ ...player })),
  };
}

export function currentNode(run: RunState): MapNode {
  return run.map.nodes[run.current] as MapNode;
}

/** Die Knoten, die man von hier aus waehlen kann. */
export function reachableNodes(run: RunState): MapNode[] {
  return currentNode(run).next.map((id) => run.map.nodes[id] as MapNode);
}

export function canEnter(run: RunState, nodeId: number): boolean {
  return currentNode(run).next.includes(nodeId);
}

/** Was mit einem gewaehlten Knoten passiert. */
export type NodeAction = "fight" | "rest";

/**
 * Das Team zieht auf einen Knoten. Rast wird sofort abgewickelt (kein Kampf);
 * alles andere ist ein Gebiet, das gespielt werden muss.
 */
export function enterNode(run: RunState, nodeId: number): NodeAction {
  if (!canEnter(run, nodeId)) {
    throw new Error(`Knoten ${nodeId} ist von ${run.current} aus nicht erreichbar.`);
  }
  run.current = nodeId;
  run.visited.push(nodeId);
  const node = currentNode(run);
  if (node.type === "rest") {
    rest(run);
    run.day += 1;
    return "rest";
  }
  return "fight";
}

/** Was ein Spieler am Ende eines Gebiets hatte - aus dem Weltzustand abgelesen. */
export interface PlayerResult {
  id: string;
  health: number;
  down: boolean;
  backpack: PackedItem[];
}

/**
 * Ein Gebiet ist ueber den Ausgang geschafft. Rucksaecke und Leben werden
 * uebernommen; wer am Boden lag, kommt mit einem Viertel Leben mit (er wurde
 * mitgeschleppt).
 */
export function completeNode(
  run: RunState,
  results: readonly PlayerResult[],
  maxHealth: (id: string) => number,
): void {
  run.day += 1;
  for (const player of run.players) {
    const result = results.find((entry) => entry.id === player.id);
    if (!result) {
      continue; // Hat die Runde verlassen - nimmt nichts mit.
    }
    player.backpack = result.backpack.map((entry) => ({ ...entry }));
    player.health = result.down
      ? Math.round(maxHealth(player.id) * DOWNED_CARRY)
      : Math.max(1, Math.round(result.health));
  }
  // Wer gegangen ist, faellt aus dem Run.
  run.players = run.players.filter((player) => results.some((entry) => entry.id === player.id));
}

/** Anteil Leben, mit dem ein am Boden Liegender ins naechste Gebiet kommt. */
const DOWNED_CARRY = 0.25;

/** Rast: alle wieder voll. `health` weglassen heisst "volles Leben". */
function rest(run: RunState): void {
  for (const player of run.players) {
    delete player.health;
  }
}

/** Ist der Run mit diesem Knoten zu Ende, wenn man sein Gebiet verlaesst? */
export function isFinalNode(node: MapNode): boolean {
  return node.type === "extraction" || node.type === "boss";
}

/** Kurzbeschreibung eines Knotentyps fuer die Karte. */
export function nodeTypeLabel(node: MapNode): string {
  switch (node.type) {
    case "start":
      return "Start";
    case "combat":
      return "Gebiet";
    case "elite":
      return "Elite";
    case "rest":
      return "Rastplatz";
    case "extraction":
      return "Extraktion";
    case "boss":
      return "Ende-Boss";
  }
}

/** Anzahl Gegenstaende (ohne Starter-Set) im Rucksack - fuer die Anzeige. */
export function carriedCount(backpack: readonly PackedItem[] | undefined): number {
  return (backpack ?? []).filter((entry) => !entry.starter && itemAt(entry.def) !== null).length;
}
