/**
 * Die Werte eines Spielers und wie sie berechnet werden.
 *
 * Eine einzige Funktion (`computeStats`) rechnet aus Charakter, Schmiede-Boni,
 * Gegenstaenden und Level-Ups die fertigen Werte aus. Host UND Client rufen sie auf - der
 * Client muss deshalb nur die Anzahlen kennen, nicht die fertigen Werte.
 */

import type { CharacterId, StatKey, StatMods, Stats } from "../types";
import { CHARACTERS } from "./characters";
import { ITEMS } from "./items";
import { UPGRADES } from "./upgrades";

export const STAT_KEYS: readonly StatKey[] = [
  "maxHp",
  "regen",
  "lifesteal",
  "damage",
  "melee",
  "ranged",
  "attackSpeed",
  "crit",
  "range",
  "armor",
  "dodge",
  "speed",
  "luck",
  "harvesting",
  "ability",
];

/** Anzeigenamen (Deutsch) und Einheit. */
export const STAT_LABELS: Record<StatKey, { name: string; unit: string }> = {
  maxHp: { name: "Leben", unit: "" },
  regen: { name: "Regeneration", unit: "" },
  lifesteal: { name: "Lebensraub", unit: "%" },
  damage: { name: "Schaden", unit: "%" },
  melee: { name: "Nahkampf", unit: "" },
  ranged: { name: "Fernkampf", unit: "" },
  attackSpeed: { name: "Angriffstempo", unit: "%" },
  crit: { name: "Krit", unit: "%" },
  range: { name: "Reichweite", unit: "" },
  armor: { name: "Rüstung", unit: "" },
  dodge: { name: "Ausweichen", unit: "%" },
  speed: { name: "Tempo", unit: "%" },
  luck: { name: "Glück", unit: "" },
  harvesting: { name: "Ernte", unit: "" },
  ability: { name: "Fähigkeit-Tempo", unit: "%" },
};

/** Ausgangswerte, bevor Charakter, Gegenstaende und Level-Ups etwas aendern. */
export const BASE_STATS: Stats = {
  maxHp: 60,
  regen: 0,
  lifesteal: 0,
  damage: 0,
  melee: 0,
  ranged: 0,
  attackSpeed: 0,
  crit: 3,
  range: 0,
  armor: 0,
  dodge: 0,
  speed: 0,
  luck: 0,
  harvesting: 0,
  ability: 0,
};

function addMods(stats: Stats, mods: StatMods, times: number): void {
  for (const key of STAT_KEYS) {
    const value = mods[key];
    if (value !== undefined) {
      stats[key] += value * times;
    }
  }
}

/** Rechnet die fertigen Werte aus. Reihenfolge der Listen = Index der Zaehler. */
export function computeStats(
  character: CharacterId,
  items: readonly number[],
  upgrades: readonly number[],
  bonus: StatMods = {},
): Stats {
  const stats: Stats = { ...BASE_STATS };
  addMods(stats, CHARACTERS[character].mods, 1);
  addMods(stats, bonus, 1);
  ITEMS.forEach((item, index) => addMods(stats, item.mods, items[index] ?? 0));
  UPGRADES.forEach((upgrade, index) => addMods(stats, upgrade.mods, upgrades[index] ?? 0));

  // Grenzen: ohne sie wuerde ein Stapel Gegenstaende das Spiel kaputtmachen
  // oder ein Wert unter null rutschen, wo er nichts mehr bedeutet.
  stats.maxHp = Math.max(10, stats.maxHp);
  stats.dodge = Math.min(60, Math.max(0, stats.dodge));
  stats.crit = Math.min(100, Math.max(0, stats.crit));
  stats.lifesteal = Math.min(100, Math.max(0, stats.lifesteal));
  stats.attackSpeed = Math.max(-60, stats.attackSpeed);
  stats.speed = Math.min(80, Math.max(-50, stats.speed));
  stats.harvesting = Math.max(0, stats.harvesting);
  stats.luck = Math.max(-50, stats.luck);
  stats.ability = Math.min(150, Math.max(-50, stats.ability));
  return stats;
}

/** Schaden, der nach Abzug der Ruestung noch ankommt. Negative Ruestung verstaerkt ihn. */
export function armorFactor(armor: number): number {
  if (armor >= 0) {
    return 10 / (10 + armor);
  }
  return Math.min(2.5, 1 + -armor / 10);
}
