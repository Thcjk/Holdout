/**
 * Distanzzonen - die gemeinsame Rechnung hinter der Schwierigkeit.
 *
 * Eigene Datei, weil zwei Module sie brauchen: `spawning.ts` (wie viele und wie
 * starke Gegner) und `encounters.ts` (wie stark der Boss dieses Punktes ist).
 * Laege sie in einem der beiden, muessten sich die zwei gegenseitig
 * importieren - und ein Import-Zyklus ist genau die Sorte Fehler, die erst beim
 * Bauen auffaellt und dann schwer zu lesen ist.
 */

import { DIFFICULTY, LIMITS } from "../config/balance";
import type { Vec2, WorldState } from "./types";

/** In welcher Distanzzone liegt ein Punkt mit diesem Abstand zum Start? */
export function zoneAt(distance: number): number {
  return Math.max(0, Math.floor(distance / DIFFICULTY.zoneSize));
}

/** Abstand eines Punktes zum Startpunkt der Welt. */
export function distanceFromStart(state: WorldState, point: Vec2): number {
  const center = { x: state.bounds.width / 2, y: state.bounds.height / 2 };
  return Math.hypot(point.x - center.x, point.y - center.y);
}

/**
 * Lebens- und Schadensfaktor einer Zone.
 *
 * Dieselben Wachstumsraten wie frueher je Welle (+8 % Leben, +4 % Schaden) -
 * nur haengen sie jetzt daran, WO ein Gegner erscheint, nicht WANN. Ein Gegner
 * nahe am Start bleibt also schwach, auch nach einer Stunde Spielzeit.
 */
export function zoneScaling(zone: number): { health: number; damage: number } {
  return {
    health: Math.pow(DIFFICULTY.healthGrowth, zone),
    damage: Math.pow(DIFFICULTY.damageGrowth, zone),
  };
}

/**
 * Wie viele Gegner sollen bei dieser Zone gleichzeitig unterwegs sein?
 *
 * `playerCount` geht wie frueher mit 0,6 + 0,4 * Spielerzahl ein: Vier Spieler
 * bekommen gut das Doppelte eines Einzelspielers, nicht das Vierfache.
 */
export function targetPopulation(zone: number, playerCount: number): number {
  const scale = DIFFICULTY.playerCountBase + DIFFICULTY.playerCountFactor * playerCount;
  const target = (DIFFICULTY.baseEnemies + DIFFICULTY.enemiesPerZone * zone) * scale;
  return Math.min(LIMITS.maxEnemies, Math.round(target));
}
