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
import { ABILITIES } from "../config/balance";
import { detonate } from "./abilities";
import { damageEnemy, damagePlayer } from "./combat";
import type {
  EnemyState,
  ProjectileEffect,
  PlayerState,
  ProjectileOwner,
  ProjectileState,
  Rect,
  Vec2,
  WorldState,
} from "./types";

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
  /** Zusatzwirkung beim Treffer. Normale Schuesse lassen das weg. */
  effect?: ProjectileEffect;
  /** Wirkradius fuer "blast". */
  blastRadius?: number;
  /** Schaden der Explosion an jedem Gegner im Radius. Nur fuer "blast". */
  blastDamage?: number;
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
      effect: "none",
      blastRadius: 0,
      blastDamage: 0,
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
  projectile.effect = options.effect ?? "none";
  projectile.blastRadius = options.blastRadius ?? 0;
  projectile.blastDamage = options.blastDamage ?? 0;
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

/**
 * Wann auf der Flugstrecke dieses Ticks trifft das Projektil den Kreis?
 *
 * WARUM DAS NOETIG IST: Ein Projektil fliegt 600 Pixel pro Sekunde, ein Tick
 * dauert eine dreissigstel Sekunde - pro Schritt springt es also 20 Pixel weit.
 * Wer nur den Endpunkt prueft, laesst es durch alles hindurchspringen, was
 * schmaler ist als dieser Sprung. Ein Laeufer hat mit Projektil zusammen 23
 * Pixel Trefferradius; alles, was den Rand streift, wurde bisher rund jedes
 * fuenfte Mal einfach uebersprungen. Genau das fuehlt sich wie "danebengezielt"
 * an, obwohl der Schuss sass.
 *
 * Gerechnet wird die Strecke als Linie und der Gegner als Kreis: Wir suchen das
 * erste t zwischen 0 und 1, bei dem der Abstand genau dem Trefferradius
 * entspricht - eine quadratische Gleichung, exakt und ohne Abtasten.
 *
 * @returns t zwischen 0 und 1, oder null wenn die Strecke den Kreis verfehlt.
 */
function sweepHitTime(
  fromX: number,
  fromY: number,
  stepX: number,
  stepY: number,
  centerX: number,
  centerY: number,
  reach: number,
): number | null {
  const offsetX = fromX - centerX;
  const offsetY = fromY - centerY;

  // Startet das Projektil bereits im Kreis, ist der Treffer sofort faellig.
  if (offsetX * offsetX + offsetY * offsetY <= reach * reach) {
    return 0;
  }

  const a = stepX * stepX + stepY * stepY;
  if (a <= 1e-9) {
    return null;
  }
  const b = 2 * (offsetX * stepX + offsetY * stepY);
  const c = offsetX * offsetX + offsetY * offsetY - reach * reach;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }

  const root = Math.sqrt(discriminant);
  // Der kleinere der beiden Schnittpunkte ist der Eintritt in den Kreis.
  const t = (-b - root) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/**
 * Wann auf der Flugstrecke trifft das Projektil eine Wand?
 *
 * Waende sind Rechtecke, nicht Kreise - dort waere die exakte Rechnung deutlich
 * laenger. Stattdessen wird die Strecke in Schritten abgetastet, die hoechstens
 * so lang sind wie der Projektilradius. Damit kann kein Treffer mehr
 * durchrutschen, und bei 20 Pixel Schrittweite sind das drei bis vier Proben.
 */
function wallHitTime(
  fromX: number,
  fromY: number,
  stepX: number,
  stepY: number,
  radius: number,
  walls: readonly Rect[],
): number | null {
  const distance = Math.hypot(stepX, stepY);
  const samples = Math.max(1, Math.ceil(distance / Math.max(1, radius)));
  const probe: Vec2 = { x: 0, y: 0 };

  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    probe.x = fromX + stepX * t;
    probe.y = fromY + stepY * t;
    if (hitsWall(probe, radius, walls)) {
      return t;
    }
  }
  return null;
}

/**
 * Alle Projektile einen Schritt weiterfliegen lassen und Treffer aufloesen.
 *
 * Geprueft wird die ganze Flugstrecke dieses Ticks, nicht nur ihr Endpunkt
 * (siehe `sweepHitTime`). Reihenfolge zaehlt: Steht eine Wand vor dem Gegner,
 * hoert der Schuss an der Wand auf - sonst schoesse man durch Deckung hindurch.
 */
export function stepProjectiles(state: WorldState, dt: number): void {
  for (const projectile of state.projectiles) {
    if (!projectile.active) {
      continue;
    }

    const fromX = projectile.position.x;
    const fromY = projectile.position.y;
    const stepX = projectile.velocity.x * dt;
    const stepY = projectile.velocity.y * dt;

    projectile.position.x = fromX + stepX;
    projectile.position.y = fromY + stepY;

    // Die Reichweite ist die Flugstrecke, nicht die Lebensdauer - so bedeutet
    // "Reichweite 450" bei jedem Charakter dasselbe.
    projectile.rangeLeft -= Math.hypot(stepX, stepY);
    const outOfRange = projectile.rangeLeft <= 0;

    // Bis wohin auf der Strecke darf getroffen werden? Eine Wand schneidet sie ab.
    const wallT = wallHitTime(fromX, fromY, stepX, stepY, projectile.radius, state.walls);

    const limit = wallT ?? 1;

    if (projectile.owner === "player") {
      resolveEnemyHits(state, projectile, fromX, fromY, stepX, stepY, limit);
    } else {
      resolvePlayerHits(state, projectile, fromX, fromY, stepX, stepY, limit);
    }

    if (projectile.active && (wallT !== null || outOfRange)) {
      // Eine Granate wirkt auch dort, wo sie auf eine Wand trifft oder ihre
      // Wurfweite aufbraucht - sonst waere ein Wurf ins Leere wirkungslos,
      // obwohl Gegner danebenstehen.
      if (projectile.effect === "blast") {
        const t = wallT ?? 1;
        detonate(
          state,
          fromX + stepX * t,
          fromY + stepY * t,
          projectile.blastRadius,
          projectile.blastDamage,
          projectile.ownerId,
        );
      }
      projectile.active = false;
    }
  }
}

function resolveEnemyHits(
  state: WorldState,
  projectile: ProjectileState,
  fromX: number,
  fromY: number,
  stepX: number,
  stepY: number,
  limit: number,
): void {
  // Wer zuerst auf der Strecke liegt, wird zuerst getroffen. Ohne diese
  // Sortierung wuerde ein nicht durchschlagendes Projektil den Gegner treffen,
  // der zufaellig frueher in der Liste steht - nicht den vorderen.
  let bestEnemy: EnemyState | null = null;
  let bestT = Number.POSITIVE_INFINITY;

  for (const enemy of state.enemies) {
    if (projectile.hitEnemies.includes(enemy.id)) {
      continue;
    }

    const reach = enemy.radius + projectile.radius;
    const t = sweepHitTime(fromX, fromY, stepX, stepY, enemy.position.x, enemy.position.y, reach);
    if (t === null || t > limit) {
      continue;
    }

    if (projectile.piercing) {
      // Ein Durchschuss trifft auf derselben Strecke jeden Gegner genau einmal.
      projectile.hitEnemies.push(enemy.id);
      damageEnemy(state, enemy, projectile.damage, projectile.ownerId, {
        x: projectile.velocity.x,
        y: projectile.velocity.y,
      });
      continue;
    }

    if (t < bestT) {
      bestT = t;
      bestEnemy = enemy;
    }
  }

  if (bestEnemy) {
    if (projectile.effect === "root") {
      // Wurzeln, bevor der Schaden faellt: Stirbt der Gegner, ist die Wurzelung
      // egal - stirbt er nicht, greift sie sofort.
      bestEnemy.rooted = Math.max(bestEnemy.rooted, ABILITIES.sniper.rootDuration);
    }

    damageEnemy(state, bestEnemy, projectile.damage, projectile.ownerId, {
      x: projectile.velocity.x,
      y: projectile.velocity.y,
    });
    // Am Auftreffpunkt stehenbleiben: Dort gehoert der Funke hin, nicht 20
    // Pixel dahinter.
    projectile.position.x = fromX + stepX * bestT;
    projectile.position.y = fromY + stepY * bestT;

    if (projectile.effect === "blast") {
      detonate(
        state,
        projectile.position.x,
        projectile.position.y,
        projectile.blastRadius,
        projectile.blastDamage,
        projectile.ownerId,
      );
    }

    projectile.active = false;
  }
}

function resolvePlayerHits(
  state: WorldState,
  projectile: ProjectileState,
  fromX: number,
  fromY: number,
  stepX: number,
  stepY: number,
  limit: number,
): void {
  let bestPlayer: PlayerState | null = null;
  let bestT = Number.POSITIVE_INFINITY;

  for (const player of state.players) {
    if (player.down) {
      continue;
    }

    const reach = player.radius + projectile.radius;
    const t = sweepHitTime(fromX, fromY, stepX, stepY, player.position.x, player.position.y, reach);
    if (t === null || t > limit || t >= bestT) {
      continue;
    }
    bestT = t;
    bestPlayer = player;
  }

  if (bestPlayer) {
    damagePlayer(state, bestPlayer, projectile.damage);
    projectile.position.x = fromX + stepX * bestT;
    projectile.position.y = fromY + stepY * bestT;
    projectile.active = false;
  }
}

/** Anzahl fliegender Projektile - fuer Tests und die Leistungsanzeige. */
export function activeProjectileCount(state: WorldState): number {
  return state.projectiles.reduce((count, entry) => count + (entry.active ? 1 : 0), 0);
}
