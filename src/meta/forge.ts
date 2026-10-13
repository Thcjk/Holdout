/**
 * Die Schmiede: dauerhafte Verbesserungen, die man mit Kristallen kauft.
 *
 * Jeder Lauf bringt Kristalle (je weiter, desto mehr). In der Schmiede werden
 * sie zu Stufen, die ab dann in JEDEM Lauf gelten - so arbeitet man sich hoch.
 * Jede Stufe kostet mehr als die vorige (`forgeCost`), damit die letzten
 * Stufen echte Ziele bleiben.
 *
 * Reine Daten und Rechnungen, ohne Speicher und ohne Phaser.
 */

import type { StatKey, StatMods } from "../game/types";

export type ForgeId =
  | "leben"
  | "schaerfe"
  | "panzer"
  | "flink"
  | "rausch"
  | "erholung"
  | "blick"
  | "weite"
  | "glueck"
  | "ernte"
  | "kasse"
  | "durst";

export interface ForgeDef {
  id: ForgeId;
  name: string;
  /** Was eine Stufe bringt (fuer die Anzeige). */
  text: string;
  /** Welcher Wert je Stufe um wie viel steigt. `null` = Sonderfall (Startgold). */
  stat: StatKey | null;
  perLevel: number;
  maxLevel: number;
  /** Preis der ersten Stufe und Faktor je weiterer Stufe. */
  baseCost: number;
  growth: number;
}

/** Reihenfolge = Anzeige in der Schmiede. */
export const FORGE: readonly ForgeDef[] = [
  { id: "leben", name: "Lebenskraft", text: "+5 Leben", stat: "maxHp", perLevel: 5, maxLevel: 8, baseCost: 15, growth: 1.42 },
  { id: "schaerfe", name: "Schärfe", text: "+3 % Schaden", stat: "damage", perLevel: 3, maxLevel: 8, baseCost: 20, growth: 1.42 },
  { id: "panzer", name: "Panzerung", text: "+1 Rüstung", stat: "armor", perLevel: 1, maxLevel: 4, baseCost: 30, growth: 1.7 },
  { id: "rausch", name: "Kampfrausch", text: "+3 % Angriffstempo", stat: "attackSpeed", perLevel: 3, maxLevel: 6, baseCost: 25, growth: 1.5 },
  { id: "flink", name: "Flinke Füße", text: "+2 % Tempo", stat: "speed", perLevel: 2, maxLevel: 5, baseCost: 15, growth: 1.5 },
  { id: "erholung", name: "Erholung", text: "+1 Regeneration", stat: "regen", perLevel: 1, maxLevel: 4, baseCost: 25, growth: 1.6 },
  { id: "blick", name: "Adlerblick", text: "+2 % Krit", stat: "crit", perLevel: 2, maxLevel: 4, baseCost: 20, growth: 1.55 },
  { id: "weite", name: "Weitsicht", text: "+15 Reichweite", stat: "range", perLevel: 15, maxLevel: 4, baseCost: 20, growth: 1.5 },
  { id: "glueck", name: "Glücksbringer", text: "+5 Glück", stat: "luck", perLevel: 5, maxLevel: 5, baseCost: 15, growth: 1.5 },
  { id: "ernte", name: "Sammler", text: "+2 Ernte", stat: "harvesting", perLevel: 2, maxLevel: 5, baseCost: 20, growth: 1.5 },
  { id: "kasse", name: "Kriegskasse", text: "+8 Gold zum Start", stat: null, perLevel: 8, maxLevel: 5, baseCost: 15, growth: 1.5 },
  { id: "durst", name: "Blutdurst", text: "+1 % Lebensraub", stat: "lifesteal", perLevel: 1, maxLevel: 2, baseCost: 50, growth: 1.8 },
];

export const FORGE_IDS: readonly ForgeId[] = FORGE.map((def) => def.id);

export function forgeDef(id: ForgeId): ForgeDef {
  const def = FORGE.find((candidate) => candidate.id === id);
  if (!def) {
    throw new Error(`Unbekannte Schmiede-Stufe: ${id}`);
  }
  return def;
}

/** Preis der NAECHSTEN Stufe, wenn schon `level` Stufen gekauft sind. `null` = ausgebaut. */
export function forgeCost(id: ForgeId, level: number): number | null {
  const def = forgeDef(id);
  if (level >= def.maxLevel) {
    return null;
  }
  return Math.round(def.baseCost * def.growth ** level);
}

/** Was alle gekauften Stufen zusammen bringen: Werte-Boni und Startgold. */
export function forgeBonus(levels: Partial<Record<ForgeId, number>>): { mods: StatMods; startGold: number } {
  const mods: StatMods = {};
  let startGold = 0;
  for (const def of FORGE) {
    const level = Math.min(def.maxLevel, Math.max(0, levels[def.id] ?? 0));
    if (level === 0) {
      continue;
    }
    if (def.stat === null) {
      startGold += def.perLevel * level;
    } else {
      mods[def.stat] = (mods[def.stat] ?? 0) + def.perLevel * level;
    }
  }
  return { mods, startGold };
}

/** Alle gekauften Stufen zusammengezaehlt (fuer Erfolge). */
export function forgeTotal(levels: Partial<Record<ForgeId, number>>): number {
  return FORGE.reduce((sum, def) => sum + Math.min(def.maxLevel, levels[def.id] ?? 0), 0);
}

/** So viele Stufen gibt es insgesamt. */
export const FORGE_MAX_TOTAL = FORGE.reduce((sum, def) => sum + def.maxLevel, 0);
