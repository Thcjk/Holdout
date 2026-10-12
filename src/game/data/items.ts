/**
 * Alle Gegenstaende im Shop.
 *
 * WICHTIG: Die REIHENFOLGE ist fest. Ein Spieler speichert seine Gegenstaende
 * als Zaehler je Index (`items[3] = 2` heisst: zweimal der vierte), und genau
 * diese Liste geht im Koop uebers Netz. Neue Gegenstaende nur HINTEN anhaengen.
 *
 * Jeder Gegenstand hat Vor- UND Nachteile - sonst gaebe es nichts zu entscheiden.
 */

import type { StatMods } from "../types";

export interface ItemDef {
  id: string;
  name: string;
  /** Grundpreis in Material, bevor die Welle ihn verteuert. */
  price: number;
  mods: StatMods;
  /** Ein Kuerzel fuer das Symbol, wenn kein Bild vorliegt. */
  icon: string;
}

export const ITEMS: readonly ItemDef[] = [
  { id: "panzerweste", name: "Panzerweste", price: 15, mods: { armor: 3, speed: -3 }, icon: "Pw" },
  { id: "energydrink", name: "Energy-Drink", price: 13, mods: { speed: 10, maxHp: -4 }, icon: "Ed" },
  { id: "verbandskasten", name: "Verbandskasten", price: 14, mods: { maxHp: 10, regen: 1 }, icon: "Vk" },
  { id: "zielfernrohr", name: "Zielfernrohr", price: 17, mods: { range: 30, crit: 4 }, icon: "Zf" },
  { id: "schleifstein", name: "Schleifstein", price: 18, mods: { damage: 8 }, icon: "Ss" },
  { id: "hantel", name: "Hantel", price: 14, mods: { melee: 4, speed: -2 }, icon: "Ha" },
  { id: "laservisier", name: "Laser-Visier", price: 15, mods: { ranged: 4, crit: 2 }, icon: "Lv" },
  { id: "kleeblatt", name: "Kleeblatt", price: 14, mods: { luck: 15, harvesting: 2 }, icon: "Kl" },
  { id: "sparschwein", name: "Sparschwein", price: 13, mods: { harvesting: 4, damage: -3 }, icon: "Sp" },
  { id: "adrenalin", name: "Adrenalin-Spritze", price: 17, mods: { attackSpeed: 8, maxHp: -3 }, icon: "Ad" },
  { id: "vampirzahn", name: "Vampirzahn", price: 15, mods: { lifesteal: 3, damage: -2 }, icon: "Vz" },
  { id: "turnschuhe", name: "Turnschuhe", price: 14, mods: { dodge: 5, speed: 4 }, icon: "Ts" },
  { id: "schutzbrille", name: "Schutzbrille", price: 14, mods: { dodge: 4, crit: 3 }, icon: "Sb" },
  { id: "metallplatte", name: "Metallplatte", price: 17, mods: { armor: 2, maxHp: 6, speed: -2 }, icon: "Mp" },
  { id: "gummiband", name: "Gummiband", price: 14, mods: { attackSpeed: 6, range: 10 }, icon: "Gb" },
  { id: "kaffeetasse", name: "Kaffeetasse", price: 14, mods: { attackSpeed: 6, speed: 4, harvesting: -1 }, icon: "Kt" },
  { id: "teddy", name: "Teddybär", price: 13, mods: { maxHp: 8, dodge: 2 }, icon: "Tb" },
  { id: "sehne", name: "Sehne", price: 14, mods: { ranged: 3, range: 20, melee: -2 }, icon: "Se" },
  { id: "boxhandschuh", name: "Boxhandschuh", price: 15, mods: { melee: 5, attackSpeed: 3, range: -10 }, icon: "Bh" },
  { id: "rabenfeder", name: "Rabenfeder", price: 14, mods: { crit: 6, dodge: 3, maxHp: -4 }, icon: "Rf" },
  { id: "wundersalbe", name: "Wundersalbe", price: 15, mods: { regen: 3, maxHp: -5 }, icon: "Wa" },
  { id: "goldzahn", name: "Goldzahn", price: 17, mods: { harvesting: 5, luck: 5, armor: -1 }, icon: "Gz" },
  { id: "helm", name: "Helm", price: 13, mods: { armor: 2, maxHp: 4 }, icon: "He" },
  { id: "uhr", name: "Zeitlupe-Uhr", price: 17, mods: { attackSpeed: 10, speed: -6 }, icon: "Zu" },
];

export const ITEM_INDEX: ReadonlyMap<string, number> = new Map(ITEMS.map((item, index) => [item.id, index]));
