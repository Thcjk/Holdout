/**
 * Die Route. In Etappe 1 ein fester Probelauf mit drei Maerschen; die Karte mit
 * Abzweigungen kommt spaeter.
 */

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
}

/** Hier beginnt jeder Lauf: am Grab, in dem die Crew das Sonnenherz gefunden hat. */
export const START_STATION = "Grab von Aurum";

export const PROBE_ROUTE: readonly MarchSpec[] = [
  { station: "Oase", length: 1900, spawnStart: 0.8, spawnEnd: 2.0, hp: 1 },
  { station: "Ruine", length: 2000, spawnStart: 1.2, spawnEnd: 2.8, hp: 1.6 },
  { station: "Küste", length: 2100, spawnStart: 1.6, spawnEnd: 3.6, hp: 2.3 },
];
