/**
 * Die Waffen. Alle schiessen und schlagen von selbst - gesteuert wird nur die Bewegung.
 *
 * Jede Waffe gibt es in vier Stufen. Die Werte stehen als Reihen mit je vier
 * Eintraegen (Stufe 1 bis 4). Zwei gleiche Waffen derselben Stufe verschmelzen
 * beim Kauf zur naechsten Stufe.
 *
 * Reichweite = so weit, wie die Waffe wirklich reicht (gemessen von der Mitte
 * der Figur, die etwa 20 breit ist): Dolch 55, Doppelschwert 75, Axt 80,
 * Hammer 85 (rundum), Langschwert 95 - Bogen und Staebe deutlich weiter,
 * der Langbogen am weitesten. Kurze Waffen gleichen das mit Tempo oder Wucht aus.
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
    name: "Kurzbogen",
    kind: "ranged",
    price: 18,
    damage: [12, 18, 26, 38],
    cooldown: [0.55, 0.5, 0.45, 0.4],
    range: 360,
    count: 1,
    spread: 3,
    pierce: [0, 0, 1, 2],
    speed: 720,
    knockback: 40,
    scaling: 1,
    critBonus: 0,
    color: 0xfff2a8,
    look: 1,
  },
  smg: {
    id: "smg",
    name: "Wurfdolche",
    kind: "ranged",
    price: 25,
    damage: [7, 10, 14, 20],
    cooldown: [0.22, 0.2, 0.18, 0.16],
    range: 240,
    count: 1,
    spread: 8,
    pierce: [0, 0, 1, 1],
    speed: 700,
    knockback: 20,
    scaling: 0.6,
    critBonus: 0,
    color: 0xb5532f,
    look: 7,
  },
  shotgun: {
    id: "shotgun",
    name: "Funkenfächer",
    kind: "ranged",
    price: 28,
    damage: [5, 7, 9, 13],
    cooldown: [1.1, 1.0, 0.9, 0.8],
    range: 220,
    count: 5,
    spread: 38,
    pierce: [0, 0, 1, 1],
    speed: 640,
    knockback: 70,
    scaling: 0.5,
    critBonus: 0,
    color: 0xffb36b,
    look: 8,
  },
  sniper: {
    id: "sniper",
    name: "Langbogen",
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
    look: 1,
  },
  fist: {
    id: "fist",
    name: "Axt",
    kind: "melee",
    price: 14,
    damage: [20, 28, 39, 55],
    cooldown: [0.8, 0.74, 0.68, 0.6],
    range: 80,
    count: 2,
    spread: 90,
    pierce: [0, 0, 0, 0],
    speed: 0,
    knockback: 110,
    scaling: 1.5,
    critBonus: 4,
    color: 0xf6ead2,
  },
  knife: {
    id: "knife",
    name: "Dolch",
    kind: "melee",
    price: 22,
    damage: [13, 18, 25, 36],
    cooldown: [0.3, 0.27, 0.25, 0.22],
    range: 55,
    count: 1,
    spread: 60,
    pierce: [0, 0, 0, 0],
    speed: 0,
    knockback: 25,
    scaling: 1,
    critBonus: 15,
    color: 0xdde6ee,
  },
  spear: {
    id: "spear",
    name: "Langschwert",
    kind: "melee",
    price: 32,
    damage: [16, 23, 32, 46],
    cooldown: [0.75, 0.7, 0.65, 0.58],
    range: 95,
    count: 3,
    spread: 120,
    pierce: [0, 0, 0, 0],
    speed: 0,
    knockback: 60,
    scaling: 1.3,
    critBonus: 0,
    color: 0xc9a66b,
  },
  crossbow: {
    id: "crossbow",
    name: "Armbrust",
    kind: "ranged",
    price: 30,
    damage: [26, 38, 54, 78],
    cooldown: [0.95, 0.88, 0.8, 0.7],
    range: 450,
    count: 1,
    spread: 2,
    pierce: [1, 2, 3, 4],
    speed: 900,
    knockback: 30,
    scaling: 1.1,
    critBonus: 5,
    color: 0xc9a66b,
    look: 1,
  },
  rocket: {
    id: "rocket",
    name: "Feuerkugel",
    kind: "ranged",
    price: 42,
    damage: [26, 38, 54, 80],
    cooldown: [1.7, 1.55, 1.4, 1.2],
    range: 400,
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
    name: "Flammenstab",
    kind: "ranged",
    price: 34,
    damage: [3, 4, 6, 9],
    cooldown: [0.1, 0.09, 0.085, 0.08],
    range: 140,
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
    name: "Kriegshammer",
    kind: "melee",
    price: 36,
    damage: [22, 32, 46, 66],
    cooldown: [1.4, 1.3, 1.2, 1.05],
    range: 85,
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
  twin: {
    id: "twin",
    name: "Doppelschwert",
    kind: "melee",
    price: 26,
    damage: [9, 13, 18, 26],
    cooldown: [0.42, 0.38, 0.34, 0.3],
    range: 75,
    count: 2,
    spread: 100,
    pierce: [0, 0, 0, 0],
    speed: 0,
    knockback: 40,
    scaling: 1.1,
    critBonus: 6,
    color: 0xdde6ee,
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
