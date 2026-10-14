/**
 * Das Raster auf dem Deck: Welche Felder sind frei, wo darf was hin, wer ist
 * wessen Nachbar. Reine Rechnerei ohne Zustand.
 *
 * Felder: Spalte 0..6 (links = hinten in Laufrichtung, rechts = Bug),
 * Reihe 0..3 (0 = hinten am Gelaender, 3 = vorn an der Kante zur Kamera).
 */

import { DECK_COLS, DECK_H, DECK_ROWS, DECK_W, TILE_H, TILE_W } from "./constants";
import { MODULES } from "./data/modules";
import { FIXED_MODULES } from "./fortress";
import type { ModuleId, ModuleState } from "./types";

export interface Tile {
  col: number;
  row: number;
}

/** Felder, die ein Modul belegt (breite Module zwei nebeneinander). */
export function tilesOf(type: ModuleId, col: number, row: number): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < MODULES[type].width; i += 1) {
    tiles.push({ col: col + i, row });
  }
  return tiles;
}

/** Liegt das Feld am Rand des Decks? */
export function isEdgeTile(col: number, row: number): boolean {
  return col === 0 || col === DECK_COLS - 1 || row === 0 || row === DECK_ROWS - 1;
}

function fixedAt(col: number, row: number): boolean {
  return FIXED_MODULES.some(
    (m) => col >= m.col && col < m.col + m.cols && row >= m.row && row < m.row + m.rows,
  );
}

/** Welches gebaute Modul steht auf diesem Feld? */
export function moduleAt(
  modules: readonly ModuleState[],
  col: number,
  row: number,
): ModuleState | null {
  for (const m of modules) {
    if (tilesOf(m.type, m.col, m.row).some((t) => t.col === col && t.row === row)) {
      return m;
    }
  }
  return null;
}

/** Ist das Feld frei (kein fester Aufbau, kein Modul)? */
export function tileFree(modules: readonly ModuleState[], col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= DECK_COLS || row >= DECK_ROWS) {
    return false;
  }
  return !fixedAt(col, row) && !moduleAt(modules, col, row);
}

/** Darf `type` mit linkem Feld (col, row) gebaut werden? */
export function canPlace(
  modules: readonly ModuleState[],
  type: ModuleId,
  col: number,
  row: number,
): boolean {
  const spec = MODULES[type];
  return tilesOf(type, col, row).every(
    (t) => tileFree(modules, t.col, t.row) && (!spec.edgeOnly || isEdgeTile(t.col, t.row)),
  );
}

/** Mitte eines Moduls auf dem Deck (relativ zur Festung, Bodenebene). */
export function moduleCenter(m: Pick<ModuleState, "type" | "col" | "row">): {
  x: number;
  y: number;
} {
  return {
    x: (m.col + MODULES[m.type].width / 2) * TILE_W,
    y: (m.row + 0.5) * TILE_H,
  };
}

/** Summe der Generator-Boni auf den Nachbarfeldern (waagerecht und senkrecht). */
export function generatorBonus(modules: readonly ModuleState[], m: ModuleState): number {
  const own = tilesOf(m.type, m.col, m.row);
  let bonus = 0;
  for (const other of modules) {
    if (other.uid === m.uid || other.type !== "generator") {
      continue;
    }
    const touches = own.some(
      (t) => Math.abs(t.col - other.col) + Math.abs(t.row - other.row) === 1,
    );
    if (touches) {
      bonus += MODULES.generator.power?.[other.level - 1] ?? 0;
    }
  }
  return bonus;
}

/** Bereich am Boden unter einem Oelkessel (relativ zur Festung). Trifft auch Kletterer. */
export function oilZone(m: Pick<ModuleState, "col" | "row">): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  const x = m.col * TILE_W;
  const y = m.row * TILE_H;
  if (m.row === DECK_ROWS - 1) {
    return { x0: x - 8, y0: DECK_H - 50, x1: x + TILE_W + 8, y1: DECK_H + 24 };
  }
  if (m.row === 0) {
    return { x0: x - 8, y0: -34, x1: x + TILE_W + 8, y1: 22 };
  }
  if (m.col === 0) {
    return { x0: -62, y0: y - 8, x1: 20, y1: y + TILE_H + 8 };
  }
  if (m.col === DECK_COLS - 1) {
    return { x0: DECK_W - 20, y0: y - 8, x1: DECK_W + 62, y1: y + TILE_H + 8 };
  }
  return { x0: 0, y0: 0, x1: 0, y1: 0 };
}

/**
 * Wo Enterer an der Rumpfwand hochklettern koennen (relativ zur Festung):
 * an der Vorderkante (zur Kamera), links (Heck) und rechts (Bug).
 * Hinten ist das Gelaender. Felder mit einer Panzerplatte sind zu glatt.
 */
export interface ClimbPoint {
  /** Am Boden vor der Wand. */
  x: number;
  y: number;
  /** Wo er oben auf dem Deck ankommt. */
  deckX: number;
  deckY: number;
  col: number;
  row: number;
}

export const CLIMB_POINTS: readonly ClimbPoint[] = [
  ...Array.from({ length: DECK_COLS }, (_, col) => ({
    x: col * TILE_W + TILE_W / 2,
    y: DECK_H + 6,
    deckX: col * TILE_W + TILE_W / 2,
    deckY: DECK_H - 10,
    col,
    row: DECK_ROWS - 1,
  })),
  ...Array.from({ length: DECK_ROWS - 1 }, (_, i) => ({
    x: -10,
    y: (i + 1) * TILE_H + TILE_H / 2,
    deckX: 10,
    deckY: (i + 1) * TILE_H + TILE_H / 2,
    col: 0,
    row: i + 1,
  })),
  ...Array.from({ length: DECK_ROWS - 1 }, (_, i) => ({
    x: DECK_W + 10,
    y: (i + 1) * TILE_H + TILE_H / 2,
    deckX: DECK_W - 10,
    deckY: (i + 1) * TILE_H + TILE_H / 2,
    col: DECK_COLS - 1,
    row: i + 1,
  })),
];

/** Kann man hier hochklettern (keine Panzerplatte auf dem Randfeld)? */
export function climbOpen(modules: readonly ModuleState[], point: ClimbPoint): boolean {
  const m = moduleAt(modules, point.col, point.row);
  return !m || m.type !== "platte" || m.broken;
}

/** Feld-Rechteck eines Moduls (relativ zur Festung). */
export function moduleRect(m: Pick<ModuleState, "type" | "col" | "row">): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  return {
    x0: m.col * TILE_W,
    y0: m.row * TILE_H,
    x1: (m.col + MODULES[m.type].width) * TILE_W,
    y1: (m.row + 1) * TILE_H,
  };
}
