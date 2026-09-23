/**
 * Gegner-KI - bewusst simpel gehalten (Briefing, Abschnitt 4).
 *
 * Kein A*-Pathfinding: Gegner laufen in Richtung ihres Ziels und weichen
 * Hindernissen mit einem einzigen Blick nach vorne aus. Die Karte ist so gebaut,
 * dass das reicht. Ein Wegfindungssystem waere viel Code fuer einen Effekt, den
 * bei diesem Spieltempo niemand bemerkt.
 */

import { ENEMIES, ENEMY_CONTACT_INTERVAL, PROJECTILE } from "../config/balance";
import { hasLineOfSight, resolveAgainstWalls } from "./collision";
import { clampToArena } from "./movement";
import { damagePlayer } from "./combat";
import { createBossState, stepBoss } from "./boss";
import { spawnProjectile } from "./projectiles";
import { anyStandingPlayer, nearestVisiblePlayer } from "./targeting";
import type { EnemyState, EnemyType, PlayerState, Rect, Vec2, WorldState } from "./types";

/** Wie schnell ein Gegner auf seine Wunschgeschwindigkeit kommt (Sekunden). */
const ENEMY_ACCELERATION_TIME = 0.25;

/** Wie weit ein Gegner nach vorne schaut, um einer Wand auszuweichen. */
const LOOKAHEAD = 40;

/**
 * Drehwinkel, die beim Ausweichen der Reihe nach probiert werden (in Radiant).
 * Der Faecher geht bis ueber 90 Grad hinaus: Steht ein Gegner frontal vor einem
 * breiten Block, sind alle kleinen Drehungen ebenfalls blockiert - er muss
 * seitlich daran vorbei.
 */
const AVOID_ANGLES = [0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4];

/** Ab dieser Zeit ohne Fortschritt weicht ein Gegner quer aus. */
const STUCK_SECONDS = 0.4;

/** Wie lange das seitliche Ausweichen dann anhaelt. */
const SIDESTEP_SECONDS = 0.8;

export function createEnemy(
  id: number,
  type: EnemyType,
  position: Vec2,
  healthMultiplier: number,
  damageMultiplier: number,
  isBoss: boolean,
): EnemyState {
  const definition = ENEMIES[type];
  const scale = isBoss ? 2 : 1;
  const health = Math.round(definition.health * healthMultiplier * (isBoss ? 5 : 1));

  return {
    id,
    type,
    position: { x: position.x, y: position.y },
    velocity: { x: 0, y: 0 },
    radius: definition.radius * scale,
    health,
    maxHealth: health,
    speed: definition.speed,
    contactDamage: Math.round(definition.contactDamage * damageMultiplier),
    damageMultiplier,
    scoreValue: definition.score * (isBoss ? 5 : 1),
    isBoss,
    scale,
    stunned: 0,
    marked: 0,
    rooted: 0,
    shootCooldown: 0,
    contactCooldown: 0,
    stuckTime: 0,
    // Der Angriffszustand gehoert zur Geburt, nicht zum Aufrufer: Sonst gaebe
    // es Bosse ohne Angriffe, wenn jemand die Zeile vergisst.
    ...(type === "boss" ? { boss: createBossState() } : {}),
  };
}

export function stepEnemies(state: WorldState, dt: number): void {
  for (const enemy of state.enemies) {
    tickTimers(enemy, dt);

    const target = nearestVisiblePlayer(state, enemy.position) ?? anyStandingPlayer(state);
    const desired = desiredVelocity(state, enemy, target);

    // Beschleunigen statt Geschwindigkeit hart setzen: So klingt auch ein
    // Rueckstoss von selbst wieder ab, statt im naechsten Tick zu verschwinden.
    const maxDelta = (enemy.speed / ENEMY_ACCELERATION_TIME) * dt;
    enemy.velocity.x = approach(enemy.velocity.x, desired.x, maxDelta);
    enemy.velocity.y = approach(enemy.velocity.y, desired.y, maxDelta);

    const beforeX = enemy.position.x;
    const beforeY = enemy.position.y;

    enemy.position.x += enemy.velocity.x * dt;
    enemy.position.y += enemy.velocity.y * dt;
    resolveAgainstWalls(enemy.position, enemy.velocity, enemy.radius, state.walls);
    // Ein Rueckstoss kann einen Gegner genauso durch die Aussenmauer schleudern.
    clampToArena(enemy.position, enemy.radius, state.bounds);

    trackProgress(enemy, desired, beforeX, beforeY, dt);

    if (enemy.type === "shooter" && target) {
      tryEnemyShot(state, enemy, target);
    }

    if (enemy.type === "boss") {
      // Nach der Bewegung, damit der Warnkreis dort liegt, wo der Boss am Ende
      // dieses Ticks wirklich steht.
      stepBoss(state, enemy, target, dt);
    }

    applyContactDamage(state, enemy);
  }
}

function tickTimers(enemy: EnemyState, dt: number): void {
  enemy.stunned = Math.max(0, enemy.stunned - dt);
  enemy.marked = Math.max(0, enemy.marked - dt);
  enemy.rooted = Math.max(0, enemy.rooted - dt);
  enemy.shootCooldown = Math.max(0, enemy.shootCooldown - dt);
  enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
}

function approach(value: number, target: number, maxDelta: number): number {
  const difference = target - value;
  if (Math.abs(difference) <= maxDelta) {
    return target;
  }
  return value + Math.sign(difference) * maxDelta;
}

/**
 * Merkt sich, ob ein Gegner tatsaechlich vorwaertskommt.
 *
 * Wer laufen will, aber an einer Wand klebt, sammelt `stuckTime` an. Ab einer
 * knappen halben Sekunde laeuft er quer zur Wunschrichtung - und kommt so um den
 * Block herum. Ohne diese Notbremse kann eine Welle ewig offen bleiben, weil ein
 * einzelner Gegner in einer Ecke feststeckt.
 */
function trackProgress(
  enemy: EnemyState,
  desired: Vec2,
  beforeX: number,
  beforeY: number,
  dt: number,
): void {
  const wanted = Math.hypot(desired.x, desired.y) * dt;
  if (wanted < 1e-6) {
    enemy.stuckTime = 0;
    return;
  }

  const moved = Math.hypot(enemy.position.x - beforeX, enemy.position.y - beforeY);

  if (enemy.stuckTime > STUCK_SECONDS) {
    // Das Ausweichen laeuft eine Weile weiter, sonst dreht der Gegner sofort
    // zurueck in die Wand und zittert davor.
    enemy.stuckTime += dt;
    if (enemy.stuckTime > STUCK_SECONDS + SIDESTEP_SECONDS) {
      enemy.stuckTime = 0;
    }
    return;
  }

  enemy.stuckTime = moved < wanted * 0.35 ? enemy.stuckTime + dt : 0;
}

function desiredVelocity(state: WorldState, enemy: EnemyState, target: PlayerState | null): Vec2 {
  // Gewurzelt (Sniper-Laehmschuss) heisst: steht fest, greift aber weiter an.
  // Betaeubt (Tank-Super) heisst: tut gar nichts.
  if (enemy.stunned > 0 || enemy.rooted > 0 || !target) {
    return { x: 0, y: 0 };
  }

  const dx = target.position.x - enemy.position.x;
  const dy = target.position.y - enemy.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) {
    return { x: 0, y: 0 };
  }

  let dirX = dx / distance;
  let dirY = dy / distance;

  if (enemy.type === "shooter") {
    // Abstand halten lohnt sich nur, wenn er den Spieler ueberhaupt sieht.
    //
    // WARUM DIESE BEDINGUNG DA IST: Ohne sie blieb ein Schuetze hinter einer
    // Wand stehen, weil der Abstand stimmte - schiessen konnte er nicht (dafuer
    // braucht er Sicht), getroffen wurde er auch nicht (die Wand faengt die
    // Schuesse). Beide warteten aufeinander, und die Welle endete nie. Im
    // Balancing-Protokoll standen dann Wellen mit 290 bis 400 Sekunden statt
    // dreissig. Sieht er nichts, geht er vor wie jeder andere Gegner, bis er
    // wieder freie Sicht hat.
    const sees = hasLineOfSight(state.walls, enemy.position, target.position);
    if (sees) {
      const preferred = ENEMIES.shooter.preferredRange;
      // Erst zurueckweichen, wenn es wirklich eng wird. Wer schon bei kleinen
      // Annaeherungen flieht, ist fuer Nahkaempfer unerreichbar.
      if (distance < preferred * 0.6) {
        dirX = -dirX;
        dirY = -dirY;
      } else if (distance < preferred * 1.15) {
        return { x: 0, y: 0 };
      }
    }
  }

  if (enemy.stuckTime > STUCK_SECONDS) {
    // Quer zur Wunschrichtung ausweichen. Die Seite haengt an der Gegner-ID,
    // damit zwei Gegner am selben Block nicht in dieselbe Ecke rennen - und
    // damit die Entscheidung wiederholbar bleibt (wichtig fuer den Koop).
    const side = enemy.id % 2 === 0 ? 1 : -1;
    return { x: -dirY * side * enemy.speed, y: dirX * side * enemy.speed };
  }

  const free = avoidWalls(state.walls, enemy, { x: dirX, y: dirY });
  return { x: free.x * enemy.speed, y: free.y * enemy.speed };
}

/**
 * Ein Blick nach vorne: Steckt direkt vor dem Gegner eine Wand, wird die
 * Laufrichtung nach links oder rechts gedreht - je nachdem, wo mehr Platz ist.
 */
function avoidWalls(walls: readonly Rect[], enemy: EnemyState, direction: Vec2): Vec2 {
  if (!blocked(walls, enemy, direction, LOOKAHEAD)) {
    return direction;
  }

  const angle = Math.atan2(direction.y, direction.x);
  for (const turn of AVOID_ANGLES) {
    const candidate = { x: Math.cos(angle + turn), y: Math.sin(angle + turn) };
    if (!blocked(walls, enemy, candidate, LOOKAHEAD)) {
      return candidate;
    }
  }

  return direction;
}

function blocked(
  walls: readonly Rect[],
  enemy: EnemyState,
  direction: Vec2,
  lookahead: number,
): boolean {
  const probeX = enemy.position.x + direction.x * (enemy.radius + lookahead);
  const probeY = enemy.position.y + direction.y * (enemy.radius + lookahead);

  for (const wall of walls) {
    if (
      probeX >= wall.x - enemy.radius &&
      probeX <= wall.x + wall.width + enemy.radius &&
      probeY >= wall.y - enemy.radius &&
      probeY <= wall.y + wall.height + enemy.radius
    ) {
      return true;
    }
  }
  return false;
}

function tryEnemyShot(state: WorldState, enemy: EnemyState, target: PlayerState): void {
  if (enemy.stunned > 0 || enemy.shootCooldown > 0) {
    return;
  }
  if (!hasLineOfSight(state.walls, enemy.position, target.position)) {
    return;
  }

  const dx = target.position.x - enemy.position.x;
  const dy = target.position.y - enemy.position.y;
  const distance = Math.hypot(dx, dy);
  if (distance > ENEMIES.shooter.preferredRange * 1.4 || distance < 1e-6) {
    return;
  }

  enemy.shootCooldown = ENEMIES.shooter.shotInterval;

  spawnProjectile(state, {
    owner: "enemy",
    ownerId: String(enemy.id),
    position: enemy.position,
    direction: { x: dx / distance, y: dy / distance },
    speed: PROJECTILE.enemySpeed,
    damage: Math.round(ENEMIES.shooter.shotDamage * enemy.damageMultiplier),
    range: ENEMIES.shooter.preferredRange * 1.6,
    radius: PROJECTILE.enemyRadius,
    piercing: false,
  });

  state.events.push({
    type: "shot",
    x: enemy.position.x,
    y: enemy.position.y,
    dx: dx / distance,
    dy: dy / distance,
    owner: "enemy",
  });
}

/**
 * Der Schuetze hat keinen Beruehrungsschaden, deshalb steckt seine
 * Wellenskalierung im Schussschaden. Abgeleitet aus dem Verhaeltnis von
 * aktuellem zu ursprünglichem Leben - so braucht der Gegner kein zusaetzliches Feld.
 */
function applyContactDamage(state: WorldState, enemy: EnemyState): void {
  if (enemy.contactDamage <= 0 || enemy.contactCooldown > 0 || enemy.stunned > 0) {
    return;
  }

  for (const player of state.players) {
    if (player.down) {
      continue;
    }
    const dx = player.position.x - enemy.position.x;
    const dy = player.position.y - enemy.position.y;
    const reach = player.radius + enemy.radius;
    if (dx * dx + dy * dy <= reach * reach) {
      damagePlayer(state, player, enemy.contactDamage);
      enemy.contactCooldown = ENEMY_CONTACT_INTERVAL;
      return;
    }
  }
}
