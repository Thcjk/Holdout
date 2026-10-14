/**
 * Die goldene Armee: Werte jeder Gegnerart und wie sich Trupps zusammensetzen.
 *
 * Jede Art hat eine Aufgabe gegen die Festung (siehe `systems/enemies.ts`):
 *   Sandlaeufer  - hackt an Beinen und Bauch
 *   Enterer      - klettert an der Rumpfwand hoch und greift auf dem Deck Module an
 *   Phalanx      - wie der Sandlaeufer, aber von vorn schuetzt der Turmschild
 *   Skarabaeus   - fliegt aufs Deck
 *   Sandpriester - haelt Abstand und schuetzt andere mit einem Schild
 *   Streitwagen  - rammt die Beine, die Festung wird kurz langsamer
 *   Ballista     - schiesst aus der Ferne Module kaputt
 *   Belagerungsturm - dockt seitlich an und laesst Enterer aufs Deck
 *   Goldener Koloss - Endgegner: laeuft mit und schlaegt aufs Deck
 */

import type { EnemyType, TruppKind } from "../types";

export interface EnemySpec {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number;
  /** Trefferradius am Boden. */
  radius: number;
  /** Schaden am Rumpf je Hieb. */
  hullDamage: number;
  /** Schaden an einem Mech je Hieb. */
  touchDamage: number;
  /** Schaden an einem Modul je Hieb (Gegner auf dem Deck). */
  moduleDamage: number;
  attackCooldown: number;
  /** Ab dieser Entfernung geht er auf einen Mech am Boden los. 0 = nie. */
  aggro: number;
  /** Schrott, den er fallen laesst. */
  scrap: number;
  /** Wie viel er beim Planen der Angriffe zaehlt (ein Sandlaeufer = 1). */
  threat: number;
}

export const ENEMIES: Record<EnemyType, EnemySpec> = {
  laeufer: {
    type: "laeufer",
    name: "Sandläufer",
    hp: 24,
    speed: 54,
    radius: 9,
    hullDamage: 4,
    touchDamage: 7,
    moduleDamage: 0,
    attackCooldown: 1.2,
    aggro: 90,
    scrap: 2,
    threat: 1,
  },
  enterer: {
    type: "enterer",
    name: "Enterer",
    hp: 30,
    speed: 50,
    radius: 9,
    hullDamage: 3,
    touchDamage: 8,
    moduleDamage: 10,
    attackCooldown: 1,
    aggro: 60,
    scrap: 3,
    threat: 1.3,
  },
  phalanx: {
    type: "phalanx",
    name: "Phalanx",
    hp: 45,
    speed: 40,
    radius: 10,
    hullDamage: 4,
    touchDamage: 10,
    moduleDamage: 0,
    attackCooldown: 1.4,
    aggro: 70,
    scrap: 4,
    threat: 1.6,
  },
  skarabaeus: {
    type: "skarabaeus",
    name: "Skarabäus",
    hp: 12,
    speed: 82,
    radius: 7,
    hullDamage: 2,
    touchDamage: 4,
    moduleDamage: 5,
    attackCooldown: 0.8,
    aggro: 0,
    scrap: 1,
    threat: 0.5,
  },
  priester: {
    type: "priester",
    name: "Sandpriester",
    hp: 45,
    speed: 42,
    radius: 9,
    hullDamage: 0,
    touchDamage: 0,
    moduleDamage: 0,
    attackCooldown: 5,
    aggro: 0,
    scrap: 5,
    threat: 1.5,
  },
  streitwagen: {
    type: "streitwagen",
    name: "Streitwagen",
    hp: 70,
    speed: 112,
    radius: 16,
    hullDamage: 12,
    touchDamage: 15,
    moduleDamage: 0,
    attackCooldown: 1,
    aggro: 0,
    scrap: 6,
    threat: 3,
  },
  ballista: {
    type: "ballista",
    name: "Ballista",
    hp: 90,
    speed: 44,
    radius: 16,
    hullDamage: 14,
    touchDamage: 0,
    moduleDamage: 34,
    attackCooldown: 4.5,
    aggro: 0,
    scrap: 7,
    threat: 4,
  },
  turm: {
    type: "turm",
    name: "Belagerungsturm",
    hp: 300,
    speed: 46,
    radius: 26,
    hullDamage: 0,
    touchDamage: 0,
    moduleDamage: 0,
    attackCooldown: 3.2,
    aggro: 0,
    scrap: 16,
    threat: 8,
  },
  koloss: {
    type: "koloss",
    name: "Goldener Koloss",
    hp: 2000,
    speed: 62,
    radius: 38,
    hullDamage: 25,
    touchDamage: 20,
    moduleDamage: 70,
    attackCooldown: 8,
    aggro: 0,
    scrap: 60,
    threat: 0,
  },
};

/** Wer in einem Trupp mitlaeuft: [Art, wie viele mindestens, wie viele hoechstens]. */
export const TRUPPS: Record<TruppKind, readonly [EnemyType, number, number][]> = {
  laeufer: [["laeufer", 3, 7]],
  enterer: [
    ["enterer", 3, 5],
    ["laeufer", 0, 2],
  ],
  phalanx: [
    ["phalanx", 3, 5],
    ["priester", 0, 1],
  ],
  schwarm: [["skarabaeus", 6, 10]],
  wagen: [["streitwagen", 1, 2]],
  ballista: [
    ["ballista", 1, 1],
    ["laeufer", 2, 3],
  ],
  turm: [
    ["turm", 1, 1],
    ["phalanx", 1, 2],
  ],
};
