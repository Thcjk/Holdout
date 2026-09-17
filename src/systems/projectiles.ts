/**
 * Projektile mit Object Pooling.
 *
 * "Pooling" heisst: Objekte werden nicht staendig neu erzeugt und weggeworfen,
 * sondern wiederverwendet. Der Grund steht im Briefing (Abschnitt 7): Ohne
 * Pooling raeumt die Speicherbereinigung des Browsers mitten im Gefecht auf, und
 * das Spiel ruckelt. Ein inaktives Projektil bleibt deshalb im Array liegen und
 * wird beim naechsten Schuss neu befuellt.
 */

import { LIMITS, PROJECTILE } from "../config/balance";
import { damageEnemy, damagePlayer } from "./combat";
import type { ProjectileOwner, ProjectileState, Rect, Vec2, WorldState } from "./types";

export interface ProjectileOptions {
  owner: ProjectileOwner;
  ownerId: string;
  position: Vec2;
  direction: Vec2;
  speed: number;
  damage: number;
  range: number;
  radius: number;
  piercing: boolean;
}

/** Ein freies Projektil aus dem Pool holen - oder das aelteste ueberschreiben. */
function takeFromPool(state: WorldState): ProjectileState | null {
  for (const projectile of state.projectiles) {
    if (!projectile.active) {
      return projectile;
    }
  }

  if (state.projectiles.length < LIMITS.maxProjectiles) {
    const fresh: ProjectileState = {
      id: 0,
      active: false,
      owner: "player",
      ownerId: "",
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      radius: PROJECTILE.radius,
      damage: 0,
      rangeLeft: 0,
      piercing: false,
      hitEnemies: [],
    };
    state.projectiles.push(fresh);
    return fresh;
  }

  // Hartes Limit erreicht: lieber das aelteste Projektil opfern, als die
  // Bildrate zu opfern.
  return state.projectiles[0] ?? null;
}

export function spawnProjectile(state: WorldState, options: ProjectileOptions): void {
  const projectile = takeFromPool(state);
  if (!projectile) {
    return;
  }

  projectile.id = state.nextProjectileId++;
  projectile.active = true;
  projectile.owner = options.owner;
  projectile.ownerId = options.ownerId;
  projectile.position.x = options.position.x;
  projectile.position.y = options.position.y;
  projectile.velocity.x = options.direction.x * options.speed;
  projectile.velocity.y = options.direction.y * options.speed;
  projectile.radius = options.radius;
  projectile.damage = options.damage;
  projectile.rangeLeft = options.range;
  projectile.piercing = options.piercing;
  projectile.hitEnemies.length = 0;
}

function hitsWall(position: Vec2, radius: number, walls: readonly Rect[]): boolean {
  for (const wall of walls) {
    const nearestX = Math.max(wall.x, Math.min(position.x, wall.x + wall.width));
    const nearestY = Math.max(wall.y, Math.min(position.y, wall.y + wall.height));
    const dx = position.x - nearestX;
    const dy = position.y - nearestY;
    if (dx * dx + dy * dy <= radius * radius) {
      return true;
    }
  }
  return false;
}

/** Alle Projektile einen Schritt weiterfliegen lassen und Treffer aufloesen. */
export function stepProjectiles(state: WorldState, dt: number): void {
  for (const projectile of state.projectiles) {
    if (!projectile.active) {
      continue;
    }

    const stepX = projectile.velocity.x * dt;
    const stepY = projectile.velocity.y * dt;
    projectile.position.x += stepX;
    projectile.position.y += stepY;

    // Die Reichweite ist die Flugstrecke, nicht die Lebensdauer - so bedeutet
    // "Reichweite 450" bei jedem Charakter dasselbe.
    projectile.rangeLeft -= Math.hypot(stepX, stepY);
    if (projectile.rangeLeft <= 0) {
      projectile.active = false;
      continue;
    }

    if (hitsWall(projectile.position, projectile.radius, state.walls)) {
      projectile.active = false;
      continue;
    }

    if (projectile.owner === "player") {
      resolveEnemyHits(state, projectile);
    } else {
      resolvePlayerHits(state, projectile);
    }
  }
}

function resolveEnemyHits(state: WorldState, projectile: ProjectileState): void {
  for (const enemy of state.enemies) {
    if (projectile.hitEnemies.includes(enemy.id)) {
      continue;
    }

    const dx = enemy.position.x - projectile.position.x;
    const dy = enemy.position.y - projectile.position.y;
    const reach = enemy.radius + projectile.radius;
    if (dx * dx + dy * dy > reach * reach) {
      continue;
    }

    damageEnemy(state, enemy, projectile.damage, projectile.ownerId, {
      x: projectile.velocity.x,
      y: projectile.velocity.y,
    });

    if (projectile.piercing) {
      // Ein Durchschuss trifft jeden Gegner genau einmal.
      projectile.hitEnemies.push(enemy.id);
    } else {
      projectile.active = false;
      return;
    }
  }
}

function resolvePlayerHits(state: WorldState, projectile: ProjectileState): void {
  for (const player of state.players) {
    if (player.down) {
      continue;
    }

    const dx = player.position.x - projectile.position.x;
    const dy = player.position.y - projectile.position.y;
    const reach = player.radius + projectile.radius;
    if (dx * dx + dy * dy > reach * reach) {
      continue;
    }

    damagePlayer(state, player, projectile.damage);
    projectile.active = false;
    return;
  }
}

/** Anzahl fliegender Projektile - fuer Tests und die Leistungsanzeige. */
export function activeProjectileCount(state: WorldState): number {
  return state.projectiles.reduce((count, entry) => count + (entry.active ? 1 : 0), 0);
}
