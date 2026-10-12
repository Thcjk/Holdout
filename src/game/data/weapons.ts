/**
 * Die Waffen. Alle schiessen und schlagen von selbst - gesteuert wird nur die Bewegung.
 *
 * Jede Waffe gibt es in vier Stufen. Die Werte stehen als Reihen mit je vier
 * Eintraegen (Stufe 1 bis 4). Zwei gleiche Waffen derselben Stufe verschmelzen
 * beim Kauf zur naechsten Stufe.
 */

import type { Stats, WeaponId } from "../types";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  kind: "ranged" | "melee";
  /** Grundpreis (Stufe 1). */
  price: number;
  /** Grundschaden je Stufe. Dazu kommt Nah- bzw. Fernkampfwert, dann Schaden-Prozent. */
  damage: readonly [number, number, number, number];
  /** Sekunden zwischen zwei Angriffen je Stufe. */
  cooldown: readonly [number, number, number, number];
  range: number;
  /** Geschosse je Schuss (Schrot) bzw. Ziele je Schlag (Nahkampf). */
  count: number;
  /** Streuung in Grad (Fernkampf) bzw. Oeffnungswinkel des Schlags (Nahkampf). */
  spread: number;
  /** Wie viele Gegner ein Geschoss je Stufe durchschlaegt (nur Fernkampf). */
  pierce: readonly [number, number, number, number];
  /** Geschossgeschwindigkeit (nur Fernkampf). */
  speed: number;
  /** Rueckstoss am Gegner. */
  knockback: number;
  /** Multiplikator, mit dem der Nah- bzw. Fernkampfwert in den Schaden eingeht. */
  scaling: number;
  /** Zusaetzliche Kritchance. */
  critBonus: number;
  /** Farbe fuer Geschoss bzw. Schlag. */
  color: number;
  /** Aussehen des Geschosses (siehe `Projectile.look`). */
  look?: number;
  /** Explosion beim Treffer: Radius. Alle Gegner darin bekommen 60 % des Schadens. */
  explode?: number;
  /** Brand: Anteil des Treffers, der drei Sekunden lang als Schaden pro Sekunde nachbrennt. */
  burn?: number;
  /** Kette: So oft springt der Treffer auf den naechsten Gegner (je Stufe +1). */
  chain?: number;
  /** Verlangsamung in Sekunden (halbes Tempo). */
  slow?: number;
  /** Betaeubung in Sekunden (Gegner steht still). */
  stun?: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol",
    name: "Pistole",
    kind: "ranged",
    price: 18,
    damage: [12, 18, 26, 38],
    cooldown: [0.55, 0.5, 0.45, 0.4],
    range: 380,
    count: 1,
    spread: 3,
    pierce: [0, 0, 1, 2],
    speed: 720,
    knockback: 40,
    scaling: 1,
    critBonus: 0,
    color: 0xfff2a8,
  },
  smg: {
    id: "smg",
    name: "MP",
    kind: "ranged",
    price: 25,
    damage: [5, 7, 9, 13],
    cooldown: [0.13, 0.12, 0.11, 0.1],
    range: 330,
    count: 1,
    spread: 9,
    pierce: [0, 0, 0, 1],
    speed: 700,
    knockback: 20,
    scaling: 0.5,
    critBonus: 0,
    color: 0xb5532f,
  },
  shotgun: {
    id: "shotgun",
    name: "Schrotflinte",
    kind: "ranged",
    price: 28,
    damage: [5, 7, 9, 13],
    cooldown: [1.1, 1.0, 0.9, 0.8],
    range: 260,
    count: 5,
    spread: 38,
    pierce: [0, 0, 1, 1],
    speed: 640,
    knockback: 70,
    scaling: 0.5,
    critBonus: 0,
    color: 0xffb36b,
  },
  sniper: {
    id: "sniper",
    name: "Scharfschütze",
    kind: "ranged",
    price: 40,
    damage: [40, 60, 85, 130],
    cooldown: [1.8, 1.7, 1.6, 1.4],
    range: 700,
    count: 1,
    spread: 0,
    pierce: [1, 2, 3, 5],
    speed: 1100,
    knockback: 90,
    scaling: 1.6,
    critBonus: 10,
    color: 0x8fe3ff,
  },
  fist: {
    id: "fist",
    name: "Faust",
    kind: "melee",
    price: 14,
    damage: [12, 17, 23, 32],
    cooldown: [0.45, 0.4, 0.36, 0.32],
    range: 70,
    count: 1,
    spread: 80,
    pierce: [0, 0, 0, 0],
    speed: 0,
    knockback: 90,
    scaling: 1.4,
    critBonus: 0,
    color: 0xf6ead2,
  },
  knife: {
    id: "knife",
    name: "Messer",
    kind: "melee",
    price: 22,
    damage: [14, 20, 28, 40],
    cooldown: [0.7, 0.65, 0.6, 0.55],
    range: 110,
    count: 3,
    spread: 24,
    pierce: [0, 0, 0, 0],
    speed: 0,
    knockback: 50,
    scaling: 1.2,
    critBonus: 8,
    color: 0xdde6ee,
  },
  spear: {
    id: "spear",
    name: "Speer",
    kind: "melee",
    price: 32,
    damage: [18, 26, 36, 52],
    cooldown: [1.0, 0.95, 0.9, 0.8],
    range: 170,
    count: 4,
    spread: 12,
    pierce: [0, 0, 0, 0],
    speed: 0,
    knockback: 60,
    scaling: 1.4,
    critBonus: 0,
    color: 0xc9a66b,
  },
  crossbow: {
    id: "crossbow",
    name: "Armbrust",
    kind: "ranged",
    price: 30,
    damage: [22, 32, 46, 66],
    cooldown: [0.95, 0.88, 0.8, 0.7],
    range: 480,
    count: 1,
    spread: 2,
    pierce: [3, 4, 6, 9],
    speed: 900,
    knockback: 30,
    scaling: 1.1,
    critBonus: 5,
    color: 0xc9a66b,
    look: 1,
  },
  rocket: {
    id: "rocket",
    name: "Raketenwerfer",
    kind: "ranged",
    price: 42,
    damage: [26, 38, 54, 80],
    cooldown: [1.7, 1.55, 1.4, 1.2],
    range: 430,
    count: 1,
    spread: 4,
    pierce: [0, 0, 0, 0],
    speed: 420,
    knockback: 80,
    scaling: 1.2,
    critBonus: 0,
    color: 0xb5532f,
    look: 2,
    explode: 70,
  },
  flamer: {
    id: "flamer",
    name: "Flammenwerfer",
    kind: "ranged",
    price: 34,
    damage: [3, 4, 6, 9],
    cooldown: [0.1, 0.09, 0.085, 0.08],
    range: 150,
    count: 2,
    spread: 26,
    pierce: [1, 1, 2, 3],
    speed: 380,
    knockback: 6,
    scaling: 0.35,
    critBonus: 0,
    color: 0xe8862a,
    look: 3,
    burn: 0.35,
  },
  wand: {
    id: "wand",
    name: "Blitzstab",
    kind: "ranged",
    price: 36,
    damage: [14, 20, 29, 42],
    cooldown: [0.85, 0.78, 0.7, 0.6],
    range: 360,
    count: 1,
    spread: 0,
    pierce: [0, 0, 0, 0],
    speed: 1300,
    knockback: 10,
    scaling: 0.9,
    critBonus: 0,
    color: 0x9fd8e8,
    look: 4,
    chain: 2,
  },
  hammer: {
    id: "hammer",
    name: "Hammer",
    kind: "melee",
    price: 36,
    damage: [22, 32, 46, 66],
    cooldown: [1.4, 1.3, 1.2, 1.05],
    range: 95,
    count: 6,
    spread: 360,
    pierce: [0, 0, 0, 0],
    speed: 0,
    knockback: 140,
    scaling: 1.6,
    critBonus: 0,
    color: 0x8d9688,
    stun: 0.6,
  },
  frost: {
    id: "frost",
    name: "Froststab",
    kind: "ranged",
    price: 30,
    damage: [9, 13, 19, 28],
    cooldown: [0.6, 0.55, 0.5, 0.45],
    range: 340,
    count: 1,
    spread: 4,
    pierce: [1, 1, 2, 2],
    speed: 620,
    knockback: 10,
    scaling: 0.8,
    critBonus: 0,
    color: 0xbfe4f0,
    look: 5,
    slow: 2,
  },
};

export const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[];

/** Preisfaktor je Stufe. Hoehere Stufen sind deutlich teurer als zwei der niedrigeren. */
export const TIER_PRICE: readonly number[] = [1, 2, 3.6, 6];

export const MAX_TIER = 4;

/** Der Name mit Stufe, z. B. "Pistole II". */
export function weaponTitle(id: WeaponId, tier: number): string {
  const roman = ["I", "II", "III", "IV"][tier - 1] ?? String(tier);
  return `${WEAPONS[id].name} ${roman}`;
}

/** Wirksame Reichweite einer Waffe mit den Werten ihres Traegers. */
export function weaponReach(id: WeaponId, stats: Stats): number {
  const def = WEAPONS[id];
  return Math.max(40, def.range + (def.kind === "ranged" ? stats.range : stats.range * 0.4));
}

/** Schaden eines Treffers (ohne Krit) mit den Werten des Traegers. */
export function weaponDamage(id: WeaponId, tier: number, stats: Stats): number {
  const def = WEAPONS[id];
  const base = def.damage[tier - 1] ?? 1;
  const bonus = (def.kind === "ranged" ? stats.ranged : stats.melee) * def.scaling;
  return Math.max(1, (base + bonus) * (1 + stats.damage / 100));
}

/** Sekunden zwischen zwei Angriffen mit den Werten des Traegers. */
export function weaponCooldown(id: WeaponId, tier: number, stats: Stats): number {
  const base = WEAPONS[id].cooldown[tier - 1] ?? 1;
  return Math.max(0.05, base / (1 + stats.attackSpeed / 100));
}
