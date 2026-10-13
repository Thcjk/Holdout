/**
 * Das Raster auf dem Deck: Welche Felder sind frei, wo darf was hin, wer ist
 * wessen Nachbar. Reine Rechnerei ohne Zustand.
 *
 * Felder: Spalte 0..6 (links = hinten in Laufrichtung, rechts = Bug),
 * Reihe 0..3 (0 = hinten am Gelaender, 3 = vorn an der Kante zur Kamera).
 */

import { DECK_COLS, DECK_ROWS, TILE_H, TILE_W } from "./constants";
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
