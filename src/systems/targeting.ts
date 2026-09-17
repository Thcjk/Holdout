/**
 * Wer sieht wen? Reine Suchfunktionen ohne Nebenwirkungen.
 */

import type { EnemyState, PlayerState, Vec2, WorldState } from "./types";

function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Der naechste lebende Gegner innerhalb der Reichweite, oder null. */
export function nearestEnemy(state: WorldState, from: Vec2, maxRange: number): EnemyState | null {
  let best: EnemyState | null = null;
  let bestDistance = maxRange * maxRange;

  for (const enemy of state.enemies) {
    const distance = distanceSquared(from, enemy.position);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = enemy;
    }
  }

  return best;
}

/**
 * Das naechste Ziel fuer einen Gegner.
 *
 * Spieler im Busch werden nicht gesehen - das ist der Sinn der Buesche. Spieler
 * am Boden sind ebenfalls kein Ziel; sonst wuerden Gegner auf einem Gefallenen
 * herumstehen, statt die Wiederbelebung zu stoeren.
 */
export function nearestVisiblePlayer(state: WorldState, from: Vec2): PlayerState | null {
  let best: PlayerState | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const player of state.players) {
    if (player.down || player.inBush) {
      continue;
    }
    const distance = distanceSquared(from, player.position);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = player;
    }
  }

  return best;
}

/** Irgendein lebender Spieler - als Rueckfall, wenn alle im Busch stehen. */
export function anyStandingPlayer(state: WorldState): PlayerState | null {
  return state.players.find((player) => !player.down) ?? null;
}
