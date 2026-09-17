/**
 * Die drei Super-Faehigkeiten.
 *
 * Der Super ist laut Briefing "der Moment, auf den man spielt": Er laedt sich
 * durch Treffer auf und wird dann in einem Zug ausgegeben. Deshalb kostet er
 * immer die volle Ladung - eine halbe Faehigkeit gibt es nicht.
 */

import { SUPERS } from "../config/balance";
import { damageEnemy, isSuperReady } from "./combat";
import { damageFactor } from "./skills";
import { nearestEnemy } from "./targeting";
import type { InputState, PlayerState, Vec2, WorldState } from "./types";

/** Loest die Super-Faehigkeit aus, wenn sie bereit ist und gewuenscht wird. */
export function trySuper(state: WorldState, player: PlayerState, input: InputState): boolean {
  if (!input.useSuper || player.down || !isSuperReady(player)) {
    return false;
  }

  const direction = aimDirection(player, input);

  switch (player.character) {
    case "scout":
      startDash(player, direction);
      break;
    case "tank":
      groundSlam(state, player);
      break;
    case "sniper":
      markTarget(state, player, direction);
      break;
  }

  player.superCharge = 0;
  state.events.push({
    type: "superUsed",
    playerId: player.id,
    character: player.character,
    x: player.position.x,
    y: player.position.y,
  });

  return true;
}

function aimDirection(player: PlayerState, input: InputState): Vec2 {
  if (input.aim) {
    const length = Math.hypot(input.aim.x, input.aim.y);
    if (length > 1e-6) {
      return { x: input.aim.x / length, y: input.aim.y / length };
    }
  }
  return { x: player.facing.x, y: player.facing.y };
}

/** Scout: kurzer Sprint. Die Bewegung selbst steckt in `movement.ts`. */
function startDash(player: PlayerState, direction: Vec2): void {
  player.dashTime = SUPERS.scout.duration;
  player.dashDirection = { x: direction.x, y: direction.y };
  player.dashHits.length = 0;
}

/**
 * Waehrend des Dashs: Gegner auf dem Weg nehmen Schaden und werden
 * zurueckgestossen - aber jeder nur einmal pro Dash.
 */
export function stepDashDamage(state: WorldState, player: PlayerState): void {
  if (player.dashTime <= 0) {
    if (player.dashHits.length > 0) {
      player.dashHits.length = 0;
    }
    return;
  }

  for (const enemy of [...state.enemies]) {
    if (player.dashHits.includes(enemy.id)) {
      continue;
    }

    const dx = enemy.position.x - player.position.x;
    const dy = enemy.position.y - player.position.y;
    const reach = enemy.radius + player.radius + 8;
    if (dx * dx + dy * dy > reach * reach) {
      continue;
    }

    player.dashHits.push(enemy.id);
    enemy.velocity.x += player.dashDirection.x * SUPERS.scout.knockback;
    enemy.velocity.y += player.dashDirection.y * SUPERS.scout.knockback;
    damageEnemy(state, enemy, Math.round(SUPERS.scout.damage * damageFactor(player)), player.id);
  }
}

/** Tank: Flaechenschaden rundherum, mit kurzer Betaeubung. */
function groundSlam(state: WorldState, player: PlayerState): void {
  const radiusSquared = SUPERS.tank.radius * SUPERS.tank.radius;

  // Kopie der Liste, weil sterbende Gegner waehrend der Schleife entfernt werden.
  for (const enemy of [...state.enemies]) {
    const dx = enemy.position.x - player.position.x;
    const dy = enemy.position.y - player.position.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > radiusSquared) {
      continue;
    }

    const distance = Math.sqrt(distanceSquared) || 1;
    enemy.stunned = SUPERS.tank.stunDuration;
    enemy.velocity.x += (dx / distance) * SUPERS.tank.knockback;
    enemy.velocity.y += (dy / distance) * SUPERS.tank.knockback;
    damageEnemy(state, enemy, Math.round(SUPERS.tank.damage * damageFactor(player)), player.id);
  }
}

/**
 * Sniper: markiert einen Gegner in Zielrichtung. Markierte Gegner nehmen von
 * jedem Treffer doppelten Schaden - auch von Mitspielern, das ist der Koop-Reiz.
 */
function markTarget(state: WorldState, player: PlayerState, direction: Vec2): void {
  const searchPoint = {
    x: player.position.x + direction.x * SUPERS.sniper.searchRange * 0.5,
    y: player.position.y + direction.y * SUPERS.sniper.searchRange * 0.5,
  };

  const target =
    nearestEnemy(state, searchPoint, SUPERS.sniper.searchRange * 0.5) ??
    nearestEnemy(state, player.position, SUPERS.sniper.searchRange);

  if (target) {
    target.marked = SUPERS.sniper.duration;
  }
}
