/**
 * Ein Marsch: wohin, wie weit, wie stark die Armee angreift.
 * Die Werte je Station berechnet `data/acts.ts` (`marchFor`); Tests koennen eine
 * feste Liste von Maerschen vorgeben (`SimulationOptions.route`).
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
