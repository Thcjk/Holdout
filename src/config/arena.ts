/**
 * Aufbau der Arena als reine Daten.
 *
 * Bewusst nicht im Code der Szene verdrahtet: So kann die Simulation die Arena
 * ohne Phaser laden und testen. Ab Phase 5 wird diese Liste durch eine Tilemap
 * ersetzt - die Schnittstelle (eine Liste von Rechtecken) bleibt dabei gleich.
 */

import type { Rect } from "../systems/types";
import { ARENA } from "./constants";

/** Dicke der Aussenmauern in Pixeln. */
export const WALL_THICKNESS = 40;

/** Startpunkt des Spielers: die offene Mitte. */
export const SPAWN_POINT = { x: ARENA.width / 2, y: ARENA.height / 2 } as const;

/** Die vier Aussenmauern. Sie halten den Spieler im Spielfeld. */
const OUTER_WALLS: Rect[] = [
  { x: 0, y: 0, width: ARENA.width, height: WALL_THICKNESS },
  { x: 0, y: ARENA.height - WALL_THICKNESS, width: ARENA.width, height: WALL_THICKNESS },
  { x: 0, y: 0, width: WALL_THICKNESS, height: ARENA.height },
  { x: ARENA.width - WALL_THICKNESS, y: 0, width: WALL_THICKNESS, height: ARENA.height },
];

/**
 * Acht Deckungsbloecke, symmetrisch gespiegelt, mit offener Mitte.
 * Symmetrisch, damit keine Spielerposition von vornherein besser ist als eine andere.
 */
const COVER_BLOCKS: Rect[] = [
  { x: 280, y: 240, width: 200, height: 60 },
  { x: 1120, y: 240, width: 200, height: 60 },
  { x: 280, y: 900, width: 200, height: 60 },
  { x: 1120, y: 900, width: 200, height: 60 },
  { x: 220, y: 500, width: 60, height: 200 },
  { x: 1320, y: 500, width: 60, height: 200 },
  { x: 700, y: 160, width: 200, height: 60 },
  { x: 700, y: 980, width: 200, height: 60 },
];

/** Alle blockierenden Rechtecke der Arena. */
export function createArenaWalls(): Rect[] {
  return [...OUTER_WALLS, ...COVER_BLOCKS].map((wall) => ({ ...wall }));
}

export const ARENA_BOUNDS: Rect = {
  x: 0,
  y: 0,
  width: ARENA.width,
  height: ARENA.height,
};
