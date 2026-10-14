/**
 * Was alle Teile des Spielkerns gemeinsam brauchen: den Zustand, den Zufall,
 * einen Weg, Ereignisse zu melden, und die Werte des laufenden Marschs.
 *
 * Die Teile (`systems/`) sind einfache Funktionen, die eine `World` bekommen.
 * So bleibt jede Datei bei einem Thema, statt dass eine riesige Klasse alles kann.
 */

import type { MarchSpec } from "./data/route";
import type { Rng } from "./rng";
import type { GameEvent, GameState, MapNode, ModuleId } from "./types";

export interface World {
  readonly state: GameState;
  readonly rng: Rng;
  emit(event: GameEvent): void;
  /** Werte des laufenden bzw. naechsten Marschs. */
  march(): MarchSpec | undefined;
  /** Tempo und Rumpf-Hoechstwert neu aus den (heilen) Modulen berechnen. */
  refreshFortress(): void;
  /** Werte des Marschs zu dieser Station (`horde`: die Armee hat aufgeholt). */
  specFor(node: MapNode, horde: boolean): MarchSpec;
  /** Welche Module im Angebot auftauchen koennen. */
  modulePool(): readonly ModuleId[];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
