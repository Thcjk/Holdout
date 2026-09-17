/**
 * ALLE Spielwerte an einem Ort.
 *
 * Diese Zahlen sind Startwerte aus dem Briefing, keine Wahrheiten. Sie zu aendern
 * ist der Sinn dieser Datei: Balancing merkt man nur beim Spielen. Kein anderes
 * Modul darf Spielwerte fest verdrahten - sonst sucht man sie spaeter an zwanzig Stellen.
 *
 * Stand: Nur die mit (Phase 1) markierten Werte werden aktuell benutzt. Der Rest
 * steht schon hier, damit spaetere Phasen nichts Neues erfinden muessen.
 */

export const PLAYER = {
  /** (Phase 1) Grundtempo in Pixel pro Sekunde. */
  speed: 220,
  /** (Phase 1) Zeit in Sekunden bis Vollgeschwindigkeit - nicht sofort, nicht traege. */
  accelerationTime: 0.1,
  /** (Phase 1) Kollisionsradius in Pixeln. */
  radius: 18,
  /** Unverwundbarkeit nach einem Treffer, in Sekunden (mit Aufblinken). */
  invulnerabilityTime: 0.3,
  /** Dauer einer Wiederbelebung in Sekunden, in Reichweite bleiben. */
  reviveTime: 3.0,
  /** Munitionsladungen, die einzeln und parallel nachladen. */
  ammoCharges: 3,
  /** Aufladung der Super-Faehigkeit pro Treffer, in Prozent. */
  superChargePerHit: 17,
} as const;

/** Startwerte fuer Projektile. Ab Phase 3 in Gebrauch. */
export const PROJECTILE = {
  speed: 600,
} as const;

/**
 * Die drei Charaktere. Ab Phase 5 in Gebrauch - bewusst schon hier, damit die
 * Werte nicht in den Charakterklassen verstreut landen.
 */
export const CHARACTERS = {
  scout: {
    name: "Scout",
    health: 2400,
    speed: 250,
    reloadTime: 1.3,
    shot: { bullets: 3, damage: 220, range: 450, spread: 18 },
  },
  tank: {
    name: "Tank",
    health: 4200,
    speed: 190,
    reloadTime: 1.9,
    shot: { bullets: 5, damage: 320, range: 250, spread: 30 },
  },
  sniper: {
    name: "Sniper",
    health: 1800,
    speed: 220,
    reloadTime: 2.2,
    shot: { bullets: 1, damage: 900, range: 900, spread: 0, piercing: true },
  },
} as const;

/** Die drei Gegnertypen. Ab Phase 3 (Laeufer) bzw. Phase 4 in Gebrauch. */
export const ENEMIES = {
  runner: { name: "Laeufer", health: 600, speed: 180, contactDamage: 300, score: 10 },
  brute: { name: "Brocken", health: 2800, speed: 90, contactDamage: 800, score: 50 },
  shooter: {
    name: "Schuetze",
    health: 900,
    speed: 140,
    shotDamage: 250,
    shotInterval: 2.0,
    score: 25,
  },
} as const;

/** Wellenformel aus dem Briefing, Abschnitt 4. Ab Phase 4 in Gebrauch. */
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
} as const;

/** Harte Obergrenzen fuer die Handy-Leistung (Briefing, Abschnitt 7). */
export const LIMITS = {
  maxEnemies: 40,
  maxProjectiles: 60,
} as const;
