/**
 * Die Akte und ihre Stationen: wie die Routenkarte aussieht, was jede Art von
 * Station bringt und wie stark die Armee auf jedem Abschnitt angreift.
 */

import type { NodeType, TruppKind } from "../types";
import type { MarchSpec } from "./route";

export interface ActSpec {
  name: string;
  /** Spalten der Karte inklusive Start (0) und Endgegner (letzte). */
  layers: number;
  /** Ziel des Akts (die Endgegner-Station). */
  goal: string;
  /** Leben der Gegner zusaetzlich (spaetere Akte sind haerter). */
  hpBonus: number;
  rateBonus: number;
}

export const ACTS: readonly ActSpec[] = [
  { name: "Die Rostdünen", layers: 7, goal: "Goldenes Tor", hpBonus: 0, rateBonus: 0 },
];

export interface NodeSpec {
  type: NodeType;
  /** Name auf der Karte. */
  label: string;
  /** Was es bringt (Karte, Infotafel). */
  text: string;
  /** Aenderung des Vorsprungs, wenn man diese Station waehlt. */
  lead: number;
  /** Wie oft sie auf der Karte vorkommt. */
  weight: number;
  /** Moegliche Namen. */
  names: readonly string[];
}

export const NODES: Record<NodeType, NodeSpec> = {
  start: { type: "start", label: "Start", text: "", lead: 0, weight: 0, names: [] },
  ruine: {
    type: "ruine",
    label: "Ruine",
    text: "20 Sekunden plündern: Truhen am Boden voller Schrott – die Armee holt dabei auf.",
    lead: -1,
    weight: 2,
    names: ["Ruine von Kesh", "Tempelruine", "Versunkene Halle", "Säulenfeld"],
  },
  oase: {
    type: "oase",
    label: "Oase",
    text: "Ruhe und Wasser: Der Rumpf wird um 150 repariert.",
    lead: 0,
    weight: 1.3,
    names: ["Oase", "Palmenquelle", "Grüner Brunnen"],
  },
  haendler: {
    type: "haendler",
    label: "Händler",
    text: "Sechs Module im Angebot, Neu-Würfeln kostet wenig. Handeln kostet Zeit.",
    lead: -1,
    weight: 1,
    names: ["Händlerlager", "Karawane", "Schrotthändler"],
  },
  schrott: {
    type: "schrott",
    label: "Schrottfeld",
    text: "Unterwegs liegt viel Schrott am Boden – aber es kommen mehr Gegner. Sammeln kostet Zeit.",
    lead: -1,
    weight: 1.2,
    names: ["Schrottfeld", "Wrackfeld", "Alte Schlacht"],
  },
  sturm: {
    type: "sturm",
    label: "Sandsturm",
    text: "Durch den Sturm: Man sieht wenig, es kommen weniger Gegner. Hängt die Armee ab (+2 Vorsprung).",
    lead: 2,
    weight: 0.8,
    names: ["Sturmwand", "Staubkessel"],
  },
  ereignis: {
    type: "ereignis",
    label: "Ereignis",
    text: "Etwas Unerwartetes – ihr entscheidet, was ihr tut.",
    lead: 0,
    weight: 1.2,
    names: ["Wegkreuz", "Verlassenes Lager", "Steinkreis", "Brunnenschacht"],
  },
  boss: {
    type: "boss",
    label: "Endgegner",
    text: "Der Goldene Koloss stellt sich in den Weg. Erst wenn er fällt, ist der Akt geschafft.",
    lead: 0,
    weight: 0,
    names: [],
  },
  station: { type: "station", label: "Station", text: "", lead: 0, weight: 0, names: [] },
};

/** So viel Vorsprung zum Start und hoechstens. */
export const LEAD_START = 3;
export const LEAD_MAX = 5;
/** Nach einer Heerschar hat man wieder so viel Vorsprung. */
export const LEAD_AFTER_HORDE = 2;

/** Wer auf welchem Abschnitt angreift (Abschnitt 1 = erster Marsch). */
const MIX_BY_DEPTH: readonly Partial<Record<TruppKind, number>>[] = [
  { laeufer: 6, enterer: 2, schwarm: 1 },
  { laeufer: 5, enterer: 3, schwarm: 2, phalanx: 1 },
  { laeufer: 4, enterer: 3, phalanx: 2, schwarm: 2, wagen: 1, ballista: 1 },
  { laeufer: 4, enterer: 3, phalanx: 2, schwarm: 2, wagen: 1, ballista: 1, turm: 0.6 },
  { laeufer: 3, enterer: 3, phalanx: 3, schwarm: 2, wagen: 2, ballista: 2, turm: 1 },
  { laeufer: 3, enterer: 3, phalanx: 3, schwarm: 2, wagen: 2, ballista: 2, turm: 1 },
];

/** Der Marsch zu einer Station: Laenge, Angriffe, Besonderheiten. */
export function marchFor(
  act: number,
  type: NodeType,
  layer: number,
  name: string,
  horde: boolean,
): MarchSpec {
  const spec = ACTS[act] ?? ACTS[0]!;
  const depth = Math.max(1, layer);
  const mix = MIX_BY_DEPTH[Math.min(MIX_BY_DEPTH.length, depth) - 1]!;
  let rate = 1 + spec.rateBonus;
  if (type === "schrott") {
    rate *= 1.25;
  } else if (type === "sturm") {
    rate *= 0.7;
  }
  // Spaeter im Akt deutlich zaeher: Die Festung ist dann ja auch voll ausgebaut.
  let hp = 1 + 0.25 * (depth - 1) + 0.06 * (depth - 1) ** 2 + spec.hpBonus;
  if (horde) {
    rate *= 1.5;
    hp *= 1.2;
  }
  const march: MarchSpec = {
    station: name,
    length: 1500 + depth * 40,
    spawnStart: (0.45 + 0.11 * depth) * rate,
    spawnEnd: (1.1 + 0.26 * depth) * rate,
    hp,
    mix,
  };
  if (type === "boss") {
    march.boss = "koloss";
  }
  return march;
}
