/**
 * Ein Marsch: wohin, wie weit, wie stark die Armee angreift.
 */

import type { EnemyType, TruppKind } from "../types";

export interface MarchSpec {
  /** Ziel des Marschs. */
  station: string;
  /** Strecke in Pixeln (bei 26 px/s etwa 75 Sekunden). */
  length: number;
  /** Gegner pro Sekunde am Anfang und am Ende des Marschs. */
  spawnStart: number;
  spawnEnd: number;
  /** Leben der Gegner (Vielfaches). */
  hp: number;
  /** Welche Trupps kommen, mit Gewicht. */
  mix: Partial<Record<TruppKind, number>>;
  /** Endgegner dieses Marschs - das Ziel gilt erst, wenn er besiegt ist. */
  boss?: EnemyType;
}

/** Hier beginnt jeder Lauf: am Grab, in dem die Crew das Sonnenherz gefunden hat. */
export const START_STATION = "Grab von Aurum";

/** Kurzer fester Lauf (Tests, `?debug=kurz`). */
export const PROBE_ROUTE: readonly MarchSpec[] = [
  {
    station: "Oase",
    length: 1900,
    spawnStart: 0.6,
    spawnEnd: 1.6,
    hp: 1,
    mix: { laeufer: 6, enterer: 2, schwarm: 1 },
  },
  {
    station: "Ruine",
    length: 2000,
    spawnStart: 0.8,
    spawnEnd: 1.8,
    hp: 1.5,
    mix: { laeufer: 4, enterer: 3, phalanx: 2, schwarm: 2, wagen: 1, ballista: 1 },
  },
  {
    station: "Küste",
    length: 2100,
    spawnStart: 0.9,
    spawnEnd: 2.0,
    hp: 2,
    mix: { laeufer: 3, enterer: 3, phalanx: 3, schwarm: 2, wagen: 2, ballista: 2, turm: 1 },
    boss: "koloss",
  },
];
