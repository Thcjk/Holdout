/**
 * Die Module, die auf das Deck gebaut werden koennen.
 *
 * Jedes Modul hat drei Stufen. Werte stehen als Liste [Stufe 1, Stufe 2, Stufe 3].
 * Aufruesten kostet: Stufe 2 = Grundpreis, Stufe 3 = doppelter Grundpreis.
 * Abbauen gibt die Haelfte von allem zurueck, was hineingesteckt wurde.
 */

import type { ModuleId } from "../types";

type Levels = readonly [number, number, number];

export interface ModuleSpec {
  id: ModuleId;
  name: string;
  /** Kurz, was es tut (fuer die Bau-Ansicht). */
  text: string;
  /** Felder breit (alle Module sind ein Feld hoch). */
  width: 1 | 2;
  cost: number;
  /** Nur am Rand des Decks (Panzerplatte, Oelkessel). */
  edgeOnly?: boolean;
  /** Schiesst selbst - profitiert vom Generator. */
  weapon?: boolean;
  damage?: Levels;
  cooldown?: Levels;
  range?: Levels;
  /** Moerser: Explosionsradius. Funkenspule: wie viele Ziele. */
  area?: Levels;
  /** Panzerplatte: mehr Rumpf. Werkstatt: Reparatur pro Sekunde. Generator: Tempo-Bonus.
   *  Motor: schneller laufen. Magnet: Reichweite. Oelkessel: Schaden pro Sekunde. */
  power?: Levels;
}

export const MODULE_IDS: readonly ModuleId[] = [
  "geschuetz",
  "harpune",
  "moerser",
  "spule",
  "platte",
  "oel",
  "generator",
  "magnet",
  "motor",
  "werkstatt",
];

export const MODULES: Record<ModuleId, ModuleSpec> = {
  geschuetz: {
    id: "geschuetz",
    name: "Geschützturm",
    text: "Schießt auf den nächsten Gegner am Boden.",
    width: 1,
    cost: 25,
    weapon: true,
    damage: [7, 11, 16],
    cooldown: [0.5, 0.42, 0.34],
    range: [230, 250, 275],
  },
  harpune: {
    id: "harpune",
    name: "Harpune",
    text: "Spießt den stärksten Gegner auf und reißt ihn unter einen Fuß der Festung.",
    width: 1,
    cost: 35,
    weapon: true,
    damage: [40, 65, 95],
    cooldown: [3.2, 2.8, 2.4],
    range: [320, 340, 360],
  },
  moerser: {
    id: "moerser",
    name: "Mörser",
    text: "Feuert im hohen Bogen auf Gruppen. Trifft nichts direkt daneben.",
    width: 1,
    cost: 45,
    weapon: true,
    damage: [22, 34, 50],
    cooldown: [2.6, 2.3, 2.0],
    range: [380, 400, 420],
    area: [40, 46, 52],
  },
  spule: {
    id: "spule",
    name: "Funkenspule",
    text: "Blitz springt von Gegner zu Gegner – auch zu denen unter dem Deck.",
    width: 1,
    cost: 40,
    weapon: true,
    damage: [10, 15, 22],
    cooldown: [1.3, 1.15, 1.0],
    range: [150, 165, 180],
    area: [3, 4, 5],
  },
  platte: {
    id: "platte",
    name: "Panzerplatte",
    text: "Mehr Rumpf. Nur am Rand.",
    width: 1,
    cost: 15,
    edgeOnly: true,
    power: [80, 160, 260],
  },
  oel: {
    id: "oel",
    name: "Ölkessel",
    text: "Gießt brennendes Öl auf alles, was unter dieser Kante steht. Nur am Rand.",
    width: 1,
    cost: 20,
    edgeOnly: true,
    power: [10, 16, 24],
  },
  generator: {
    id: "generator",
    name: "Generator",
    text: "Waffen auf den Nachbarfeldern feuern schneller.",
    width: 1,
    cost: 30,
    power: [0.3, 0.45, 0.6],
  },
  magnet: {
    id: "magnet",
    name: "Schrottmagnet",
    text: "Zieht Schrott vom Boden aufs Deck.",
    width: 1,
    cost: 25,
    power: [140, 190, 240],
  },
  motor: {
    id: "motor",
    name: "Dampfmotor",
    text: "Die Festung läuft schneller, die Märsche werden kürzer.",
    width: 2,
    cost: 50,
    power: [0.12, 0.2, 0.28],
  },
  werkstatt: {
    id: "werkstatt",
    name: "Werkstatt",
    text: "Repariert den Rumpf während des Marschs.",
    width: 2,
    cost: 45,
    power: [1, 1.7, 2.5],
  },
};

/** Was der naechste Schritt kostet (null = schon Stufe 3). */
export function upgradeCost(id: ModuleId, level: number): number | null {
  if (level >= 3) {
    return null;
  }
  return MODULES[id].cost * level;
}

/** Was es zurueckgibt, wenn man es abbaut: die Haelfte von allem Hineingesteckten. */
export function sellValue(id: ModuleId, level: number): number {
  const base = MODULES[id].cost;
  let invested = base;
  for (let l = 1; l < level; l += 1) {
    invested += base * l;
  }
  return Math.floor(invested / 2);
}

/** Wert eines Moduls auf seiner Stufe. */
export function stat(levels: Levels | undefined, level: number): number {
  return levels ? (levels[Math.max(0, Math.min(2, level - 1))] ?? 0) : 0;
}
