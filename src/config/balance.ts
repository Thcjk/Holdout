/**
 * ALLE Spielwerte an einem Ort.
 *
 * Diese Zahlen sind Startwerte aus dem Briefing, keine Wahrheiten. Sie zu aendern
 * ist der Sinn dieser Datei: Balancing merkt man nur beim Spielen. Kein anderes
 * Modul darf Spielwerte fest verdrahten - sonst sucht man sie spaeter an zwanzig Stellen.
 */

import type { CharacterId } from "../systems/types";

export const PLAYER = {
  /** Grundtempo in Pixel pro Sekunde (je Charakter ueberschrieben). */
  speed: 220,
  /** Zeit in Sekunden bis Vollgeschwindigkeit - nicht sofort, nicht traege. */
  accelerationTime: 0.1,
  /** Kollisionsradius in Pixeln. */
  radius: 18,
  /** Unverwundbarkeit nach einem Treffer, in Sekunden (mit Aufblinken). */
  invulnerabilityTime: 0.3,
  /** Dauer einer Wiederbelebung in Sekunden, in Reichweite bleiben. */
  reviveTime: 3.0,
  /** Hoechstabstand zum Wiederbeleben, in Pixeln. */
  reviveRange: 90,
  /** Munitionsladungen, die einzeln und parallel nachladen. */
  ammoCharges: 3,
  /** Aufladung der Super-Faehigkeit pro Treffer, in Prozent. */
  superChargePerHit: 17,
  /** Mindestabstand zwischen zwei Schuessen in Sekunden. */
  shootCooldown: 0.25,
  /** Anteil des Lebens, der in der Pause zwischen zwei Wellen zurueckkommt. */
  breakHealFraction: 0.45,
} as const;

/** Startwerte fuer Projektile. */
export const PROJECTILE = {
  speed: 600,
  radius: 7,
  /** Gegnerprojektile sind langsamer, damit man ihnen ausweichen kann. */
  enemySpeed: 380,
  enemyRadius: 9,
} as const;

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  role: string;
  health: number;
  speed: number;
  reloadTime: number;
  shot: {
    bullets: number;
    damage: number;
    range: number;
    /** Gesamter Fächerwinkel in Grad. */
    spread: number;
    piercing: boolean;
  };
  super: {
    name: string;
    description: string;
  };
}

/** Die drei Charaktere. Drei Archetypen, nicht drei Varianten derselben Figur. */
export const CHARACTERS: Record<CharacterId, CharacterDefinition> = {
  scout: {
    id: "scout",
    name: "Scout",
    role: "Beweglich, Dauerfeuer",
    health: 2400,
    speed: 250,
    reloadTime: 1.3,
    shot: { bullets: 3, damage: 220, range: 450, spread: 18, piercing: false },
    super: { name: "Dash", description: "Kurzer Sprint, der Gegner auf dem Weg zurückstösst" },
  },
  tank: {
    id: "tank",
    name: "Tank",
    role: "Nahkampf, hält aus",
    health: 4200,
    speed: 190,
    reloadTime: 1.9,
    shot: { bullets: 5, damage: 320, range: 250, spread: 34, piercing: false },
    super: { name: "Bodenstampfer", description: "800 Flächenschaden im Radius 200, betäubt 1 s" },
  },
  sniper: {
    id: "sniper",
    name: "Sniper",
    role: "Reichweite, Präzision",
    health: 1800,
    speed: 220,
    reloadTime: 2.2,
    shot: { bullets: 1, damage: 900, range: 900, spread: 0, piercing: true },
    super: {
      name: "Zielscheinwerfer",
      description: "Markiert einen Gegner: doppelter Schaden für 5 s",
    },
  },
};

export const CHARACTER_ORDER: CharacterId[] = ["scout", "tank", "sniper"];

/** Werte der drei Super-Faehigkeiten. */
export const SUPERS = {
  scout: {
    /** Dauer des Dashs in Sekunden. */
    duration: 0.22,
    /** Tempo waehrend des Dashs in Pixel pro Sekunde. */
    speed: 1150,
    /** Rueckstoss auf Gegner, die der Dash streift. */
    knockback: 520,
    damage: 300,
  },
  tank: {
    radius: 200,
    damage: 800,
    stunDuration: 1.0,
    knockback: 420,
  },
  sniper: {
    /** Dauer der Markierung in Sekunden. */
    duration: 5.0,
    damageMultiplier: 2,
    /** Suchradius um die Zielrichtung. */
    searchRange: 900,
  },
} as const;

/** Die drei Gegnertypen. */
export const ENEMIES = {
  runner: {
    name: "Läufer",
    health: 600,
    speed: 180,
    contactDamage: 300,
    score: 10,
    radius: 16,
  },
  brute: {
    name: "Brocken",
    health: 2800,
    speed: 90,
    contactDamage: 800,
    score: 50,
    radius: 28,
  },
  shooter: {
    name: "Schütze",
    health: 900,
    speed: 140,
    contactDamage: 0,
    score: 25,
    radius: 18,
    shotDamage: 250,
    shotInterval: 2.0,
    /** Wunschabstand zum Spieler: naeher laufen, weiter weg ausweichen. */
    preferredRange: 420,
  },
} as const;

/** Wie oft ein Gegner durch Beruehrung Schaden macht (Sekunden). */
export const ENEMY_CONTACT_INTERVAL = 0.6;

/** Wellenformel aus dem Briefing, Abschnitt 4. */
export const WAVES = {
  preparationSeconds: 5,
  breakSeconds: 10,
  runnerBase: 3,
  runnerPerWave: 2,
  shooterFromWave: 3,
  bruteFromWave: 5,
  /** Gegnerleben steigt um 8 % pro Welle, Schaden um 4 %. */
  healthGrowth: 1.08,
  damageGrowth: 1.04,
  /** Gegnerzahl * (0.6 + 0.4 * Spielerzahl), damit vier Spieler nicht durchrauschen. */
  playerCountBase: 0.6,
  playerCountFactor: 0.4,
  /** Alle 5 Wellen ein Brocken mit fuenffachem Leben und doppelter Groesse. */
  bossEveryWaves: 5,
  bossHealthMultiplier: 5,
  bossScaleMultiplier: 2,
  /** Vorwarnzeit der Spawnmarkierung in Sekunden. */
  spawnWarningSeconds: 1,
  /** Abstand zwischen zwei Gegnern derselben Welle in Sekunden. */
  spawnIntervalSeconds: 0.35,
} as const;

/** Harte Obergrenzen fuer die Handy-Leistung (Briefing, Abschnitt 7). */
export const LIMITS = {
  maxEnemies: 40,
  maxProjectiles: 60,
} as const;
