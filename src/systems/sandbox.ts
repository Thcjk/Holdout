/**
 * Uebergangsloesung fuer Phase 3: haelt eine Handvoll Laeufer am Leben, damit
 * man Schiessen, Treffer und Sterben ueberhaupt ausprobieren kann.
 *
 * Wird in Phase 4 durch den richtigen Wellenmanager ersetzt - diese Datei
 * verschwindet dann wieder.
 */

import { SPAWN_ZONES } from "../config/arena";
import { createEnemy } from "./enemies";
import { randomIndex, randomRange } from "./rng";
import type { WorldState } from "./types";

const TARGET_ENEMY_COUNT = 6;

export function keepSandboxEnemiesAlive(state: WorldState): void {
  while (state.enemies.length < TARGET_ENEMY_COUNT) {
    const zone = SPAWN_ZONES[randomIndex(state, SPAWN_ZONES.length)];
    if (!zone) {
      return;
    }

    state.enemies.push(
      createEnemy(
        state.nextEnemyId++,
        "runner",
        {
          x: randomRange(state, zone.x, zone.x + zone.width),
          y: randomRange(state, zone.y, zone.y + zone.height),
        },
        1,
        1,
        false,
      ),
    );
  }
}
