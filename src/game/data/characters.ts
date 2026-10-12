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
  soeldner: {
    id: "soeldner",
    name: "Söldner",
    description: "Kampferprobt: viel Schaden und Tempo, aber nur drei Waffenplätze.",
    mods: { damage: 20, attackSpeed: 15, armor: 1, maxHp: -5 },
    slots: 3,
    allowed: ALL_WEAPONS,
    starts: ["smg", "pistol", "shotgun", "knife"],
    color: 0xc9a227,
  },
  raufbold: {
    id: "raufbold",
    name: "Raufbold",
    description: "Nur Fäuste, dafür schnell und hart.",
    mods: { melee: 6, damage: 15, speed: 12, maxHp: 25, armor: 2, range: -20 },
    slots: 6,
    allowed: ["fist"],
    starts: ["fist"],
    color: 0xb5532f,
  },
  jaeger: {
    id: "jaeger",
    name: "Jäger",
    description: "Nur Fernkampf, große Reichweite, wenig Leben.",
    mods: { ranged: 3, range: 50, maxHp: -10 },
    slots: 6,
    allowed: RANGED_WEAPONS,
    starts: ["pistol", "sniper", "shotgun"],
    color: 0x7fb069,
  },
  panzer: {
    id: "panzer",
    name: "Panzer",
    description: "Zäh, aber langsam und nur vier Waffenplätze.",
    mods: { maxHp: 45, armor: 4, regen: 1, speed: -12 },
    slots: 4,
    allowed: ALL_WEAPONS,
    starts: ["shotgun", "fist", "smg"],
    color: 0x6c7a89,
  },
  glueckspilz: {
    id: "glueckspilz",
    name: "Glückspilz",
    description: "Mehr Glück und Ernte, dafür weniger Schaden.",
    mods: { luck: 25, harvesting: 6, damage: -15 },
    slots: 6,
    allowed: ALL_WEAPONS,
    starts: ["pistol", "knife", "smg"],
    color: 0xb5532f,
  },
  schatten: {
    id: "schatten",
    name: "Schatten",
    description: "Kritisch und flink, aber zerbrechlich.",
    mods: { crit: 15, dodge: 10, speed: 10, maxHp: -15 },
    slots: 6,
    allowed: ALL_WEAPONS,
    starts: ["knife", "pistol", "spear"],
    color: 0x9b6ad3,
  },
};

export const CHARACTER_IDS: readonly CharacterId[] = [
  "soeldner",
  "raufbold",
  "jaeger",
  "panzer",
  "glueckspilz",
  "schatten",
];
