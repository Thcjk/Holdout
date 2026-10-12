/**
 * Level-Ups: Bei jedem Stufenaufstieg zeigt die Pause vier davon, einer wird gewaehlt.
 *
 * Gratis, kleiner als Gegenstaende und ohne Nachteil. Auch hier ist die
 * Reihenfolge fest (Zaehler je Index, siehe `items.ts`).
 */

import type { StatMods } from "../types";

export interface UpgradeDef {
  id: string;
  name: string;
  mods: StatMods;
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: "hp", name: "+6 Leben", mods: { maxHp: 6 } },
  { id: "regen", name: "+1 Regeneration", mods: { regen: 1 } },
  { id: "damage", name: "+5 % Schaden", mods: { damage: 5 } },
  { id: "melee", name: "+2 Nahkampf", mods: { melee: 2 } },
  { id: "ranged", name: "+2 Fernkampf", mods: { ranged: 2 } },
  { id: "speedAtk", name: "+6 % Angriffstempo", mods: { attackSpeed: 6 } },
  { id: "crit", name: "+3 % Krit", mods: { crit: 3 } },
  { id: "range", name: "+20 Reichweite", mods: { range: 20 } },
  { id: "armor", name: "+1 Rüstung", mods: { armor: 1 } },
  { id: "dodge", name: "+3 % Ausweichen", mods: { dodge: 3 } },
  { id: "speed", name: "+5 % Tempo", mods: { speed: 5 } },
  { id: "luck", name: "+8 Glück", mods: { luck: 8 } },
  { id: "harvest", name: "+2 Ernte", mods: { harvesting: 2 } },
  { id: "steal", name: "+2 % Lebensraub", mods: { lifesteal: 2 } },
];
