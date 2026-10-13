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

export const PROBE_ROUTE: readonly MarchSpec[] = [
  { station: "Oase", length: 1900, spawnStart: 0.6, spawnEnd: 1.6, hp: 1 },
  { station: "Ruine", length: 2000, spawnStart: 0.85, spawnEnd: 2.05, hp: 1.35 },
  { station: "Küste", length: 2100, spawnStart: 1.1, spawnEnd: 2.5, hp: 1.65 },
];
