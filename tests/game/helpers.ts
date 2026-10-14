/**
 * Gemeinsame Helfer fuer die Tests des Spielkerns.
 */

import type { MarchSpec } from "../../src/game/data/route";
import type { Simulation } from "../../src/game/Simulation";
import type { EnemyState } from "../../src/game/types";

/** Ein langer Marsch ganz ohne Angriffe - die Tests setzen ihre Gegner selbst. */
export const QUIET: readonly MarchSpec[] = [
  { station: "Test", length: 100000, spawnStart: 0, spawnEnd: 0, hp: 1, mix: {} },
];

/** Einen Gegner von Hand hinstellen (steht still und schlaegt erst spaet zu). */
export function placeEnemy(
  s: Simulation,
  x: number,
  y: number,
  extra: Partial<EnemyState> = {},
): EnemyState {
  const e: EnemyState = {
    id: s.state.nextId++,
    type: "laeufer",
    x,
    y,
    z: 0,
    layer: "ground",
    mode: "approach",
    timer: 0,
    hp: 24,
    hpMax: 24,
    speed: 0,
    facing: 1,
    slotX: x - s.state.fort.x,
    slotY: y - s.state.fort.y,
    tx: 0,
    ty: 0,
    attacking: false,
    attackCd: 5,
    cd2: 0,
    shield: 0,
    pushX: 0,
    pushY: 0,
    ...extra,
  };
  s.state.enemies.push(e);
  return e;
}
