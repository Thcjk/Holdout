/**
 * Die Charaktere. Jeder bricht mindestens eine Regel - das macht ihn spielenswert.
 */

import type { CharacterId, StatMods, WeaponId } from "../types";
import { WEAPONS } from "./weapons";

export interface CharacterDef {
  id: CharacterId;
  name: string;
  description: string;
  mods: StatMods;
  /** Wie viele Waffen er tragen kann. */
  slots: number;
  /** Welche Waffen er benutzen darf - der Shop bietet ihm nur diese an. */
  allowed: readonly WeaponId[];
  /** Waffen zur Auswahl am Anfang. */
  starts: readonly WeaponId[];
  /** Farbe fuer Platzhalter und Namensschild. */
  color: number;
}

const ALL_WEAPONS = Object.keys(WEAPONS) as WeaponId[];
const RANGED_WEAPONS = ALL_WEAPONS.filter((id) => WEAPONS[id].kind === "ranged");

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  ritter: {
    id: "ritter",
    name: "Ritter",
    description: "Schwer gerüstet und zäh, aber langsam und nur vier Waffenplätze.",
    mods: { maxHp: 60, armor: 6, regen: 2, speed: -4 },
    slots: 4,
    allowed: ALL_WEAPONS,
    starts: ["spear", "knife", "crossbow"],
    color: 0x8a96a6,
  },
  magierin: {
    id: "magierin",
    name: "Feuermagierin",
    description: "Heißer Zauber: viel Schaden und Tempo, aber nur drei Waffenplätze.",
    mods: { damage: 20, attackSpeed: 15, armor: 1, maxHp: -5 },
    slots: 3,
    allowed: ALL_WEAPONS,
    starts: ["flamer", "rocket", "shotgun"],
    color: 0xc4512f,
  },
  schurke: {
    id: "schurke",
    name: "Schurke",
    description: "Trifft kritisch und weicht aus, hält aber wenig aus.",
    mods: { crit: 15, dodge: 10, speed: 10, maxHp: -15 },
    slots: 6,
    allowed: ALL_WEAPONS,
    starts: ["knife", "smg", "crossbow"],
    color: 0x4a4f5a,
  },
  elfe: {
    id: "elfe",
    name: "Elfe",
    description: "Waldläuferin: nur Fernkampf, große Reichweite, wenig Leben.",
    mods: { ranged: 3, range: 50, maxHp: -10 },
    slots: 6,
    allowed: RANGED_WEAPONS,
    starts: ["pistol", "crossbow", "sniper"],
    color: 0x6f9a4a,
  },
  zwerg: {
    id: "zwerg",
    name: "Zwerg",
    description: "Nur Axt und Hammer – dafür hart im Nehmen und hart im Austeilen.",
    mods: { melee: 6, damage: 15, speed: 12, maxHp: 25, armor: 2, range: -20 },
    slots: 6,
    allowed: ["fist", "hammer"],
    starts: ["fist", "hammer"],
    color: 0xa0612f,
  },
  zauberer: {
    id: "zauberer",
    name: "Zauberer",
    description: "Weise und vom Glück begünstigt: mehr Glück und Ernte, etwas weniger Schaden.",
    mods: { luck: 25, harvesting: 6, damage: -6, crit: 5 },
    slots: 6,
    allowed: ALL_WEAPONS,
    starts: ["wand", "frost", "smg"],
    color: 0x3f5f9e,
  },
};

export const CHARACTER_IDS: readonly CharacterId[] = ["ritter", "magierin", "schurke", "elfe", "zwerg", "zauberer"];
