/**
 * Aufbau der Arena als reine Daten.
 *
 * Bewusst nicht im Code der Szene verdrahtet: So kann die Simulation die Arena
 * ohne Phaser laden und testen, und eine zweite Karte waere spaeter nur eine
 * zweite Datei dieser Form.
 */

import type { Rect, Vec2 } from "../systems/types";
import { ARENA } from "./constants";

/** Dicke der Aussenmauern in Pixeln. */
export const WALL_THICKNESS = 40;

/** Startpunkt der Spieler: die offene Mitte. */
export const SPAWN_POINT: Vec2 = { x: ARENA.width / 2, y: ARENA.height / 2 };

/** Die vier Aussenmauern. Sie halten Spieler und Gegner im Spielfeld. */
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

/**
 * Vier Buschfelder. Gegner sehen Spieler darin nicht - Rueckzugsort und Falle.
 * Buesche blockieren weder Bewegung noch Schuesse.
 */
const BUSH_FIELDS: Rect[] = [
  { x: 430, y: 430, width: 180, height: 140 },
  { x: 990, y: 430, width: 180, height: 140 },
  { x: 430, y: 630, width: 180, height: 140 },
  { x: 990, y: 630, width: 180, height: 140 },
];

/**
 * Vier Spawnzonen an den Kartenraendern. Gegner erscheinen irgendwo darin,
 * eine Sekunde nachdem eine Warnmarkierung aufgetaucht ist.
 */
export const SPAWN_ZONES: Rect[] = [
  { x: 560, y: 70, width: 480, height: 70 },
  { x: 560, y: ARENA.height - 140, width: 480, height: 70 },
  { x: 70, y: 420, width: 70, height: 360 },
  { x: ARENA.width - 140, y: 420, width: 70, height: 360 },
];

/** Alle blockierenden Rechtecke der Arena. */
export function createArenaWalls(): Rect[] {
  return [...OUTER_WALLS, ...COVER_BLOCKS].map((wall) => ({ ...wall }));
}

export function createArenaBushes(): Rect[] {
  return BUSH_FIELDS.map((bush) => ({ ...bush }));
}

export const ARENA_BOUNDS: Rect = {
  x: 0,
  y: 0,
  width: ARENA.width,
  height: ARENA.height,
};
