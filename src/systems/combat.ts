/**
 * Schaden, Schuesse, Munition, Tod und Wiederbelebung.
 *
 * Alles hier arbeitet auf reinen Datenobjekten und meldet, was passiert ist,
 * ueber `state.events` - daraus macht die Darstellung Effekte und Toene, und ab
 * Phase 6 werden genau diese Ereignisse an die Mitspieler geschickt.
 */

import { CHARACTERS, PLAYER, PROJECTILE, SUPERS } from "../config/balance";
import { spawnProjectile } from "./projectiles";
import { damageFactor, superChargePerHit } from "./skills";
import { nearestEnemy } from "./targeting";
import type { EnemyState, InputState, PlayerState, Vec2, WorldState } from "./types";

/** Volle Munitionsladungen eines Spielers. */
export function ammoCount(player: PlayerState): number {
  return player.reloadTimers.reduce((count, timer) => count + (timer <= 0 ? 1 : 0), 0);
}

export function isSuperReady(player: PlayerState): boolean {
  return player.superCharge >= 100;
}

/**
 * Nachladen: Jede Ladung hat ihre eigene Uhr und laeuft unabhaengig von den
 * anderen. Genau das erzeugt das Gefuehl, Schuesse einteilen zu muessen.
 */
export function stepReload(player: PlayerState, dt: number): void {
  for (let i = 0; i < player.reloadTimers.length; i += 1) {
    const timer = player.reloadTimers[i] ?? 0;
    if (timer > 0) {
      player.reloadTimers[i] = Math.max(0, timer - dt);
    }
  }

  if (player.shootCooldown > 0) {
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  }
  if (player.invulnerable > 0) {
    player.invulnerable = Math.max(0, player.invulnerable - dt);
  }
}

/** Verbraucht eine Ladung und startet deren Nachladeuhr. */
function consumeAmmo(player: PlayerState): boolean {
  for (let i = 0; i < player.reloadTimers.length; i += 1) {
    if ((player.reloadTimers[i] ?? 0) <= 0) {
      player.reloadTimers[i] = CHARACTERS[player.character].reloadTime;
      return true;
    }
  }
  return false;
}

/**
 * Die Schussrichtung.
 *
 * Wer selbst zielt, bestimmt sie. Wer nur antippt, bekommt automatisch den
 * naechsten Gegner - ohne diese Hilfe waere das Spiel auf einem Handy mit einem
 * Daumen nicht bedienbar.
 */
function shootDirection(state: WorldState, player: PlayerState, input: InputState): Vec2 {
  if (input.aim) {
    const length = Math.hypot(input.aim.x, input.aim.y);
    if (length > 1e-6) {
      return { x: input.aim.x / length, y: input.aim.y / length };
    }
  }

  const range = CHARACTERS[player.character].shot.range;
  const target = nearestEnemy(state, player.position, range * 1.15);
  if (target) {
    const dx = target.position.x - player.position.x;
    const dy = target.position.y - player.position.y;
    const length = Math.hypot(dx, dy);
    if (length > 1e-6) {
      return { x: dx / length, y: dy / length };
    }
  }

  return { x: player.facing.x, y: player.facing.y };
}

/** Ein Schussversuch. Gibt zurueck, ob tatsaechlich geschossen wurde. */
export function tryShoot(state: WorldState, player: PlayerState, input: InputState): boolean {
  if (!input.fire || player.down || player.shootCooldown > 0 || ammoCount(player) === 0) {
    return false;
  }

  const definition = CHARACTERS[player.character];
  const direction = shootDirection(state, player, input);
  const baseAngle = Math.atan2(direction.y, direction.x);
  const spread = (definition.shot.spread * Math.PI) / 180;
  const bullets = definition.shot.bullets;

  for (let i = 0; i < bullets; i += 1) {
    // Kugeln gleichmaessig ueber den Faecher verteilen, mittlere Kugel gerade aus.
    const offset = bullets === 1 ? 0 : (i / (bullets - 1) - 0.5) * spread;
    const angle = baseAngle + offset;

    spawnProjectile(state, {
      owner: "player",
      ownerId: player.id,
      position: player.position,
      direction: { x: Math.cos(angle), y: Math.sin(angle) },
      speed: PROJECTILE.speed,
      damage: Math.round(definition.shot.damage * damageFactor(player)),
      range: definition.shot.range,
      radius: PROJECTILE.radius,
      piercing: definition.shot.piercing,
    });
  }

  consumeAmmo(player);
  player.shootCooldown = PLAYER.shootCooldown;
  player.facing.x = direction.x;
  player.facing.y = direction.y;

  state.events.push({
    type: "shot",
    x: player.position.x,
    y: player.position.y,
    dx: direction.x,
    dy: direction.y,
    owner: "player",
  });

  return true;
}

/** Schaden an einem Gegner, inklusive Rueckstoss und Super-Aufladung. */
export function damageEnemy(
  state: WorldState,
  enemy: EnemyState,
  amount: number,
  sourcePlayerId: string,
  knockbackDirection?: Vec2,
): void {
  // Die Sniper-Markierung verdoppelt den Schaden - egal, wer trifft.
  const multiplier = enemy.marked > 0 ? SUPERS.sniper.damageMultiplier : 1;
  const applied = Math.round(amount * multiplier);
  enemy.health -= applied;

  if (knockbackDirection) {
    const length = Math.hypot(knockbackDirection.x, knockbackDirection.y);
    if (length > 1e-6) {
      // Nur ein Schubs: Ein Treffer soll spuerbar sein, aber den Gegner nicht
      // quer durch die Arena schleudern.
      const strength = enemy.isBoss ? 40 : 110;
      enemy.velocity.x += (knockbackDirection.x / length) * strength;
      enemy.velocity.y += (knockbackDirection.y / length) * strength;
    }
  }

  state.events.push({
    type: "hit",
    x: enemy.position.x,
    y: enemy.position.y,
    damage: applied,
    enemyId: enemy.id,
  });

  chargeSuper(state, sourcePlayerId);

  if (enemy.health <= 0) {
    killEnemy(state, enemy);
  }
}

function chargeSuper(state: WorldState, playerId: string): void {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return;
  }

  const wasReady = isSuperReady(player);
  player.superCharge = Math.min(100, player.superCharge + superChargePerHit(player));

  if (!wasReady && isSuperReady(player)) {
    state.events.push({ type: "superReady", playerId: player.id });
  }
}

export function killEnemy(state: WorldState, enemy: EnemyState): void {
  const index = state.enemies.indexOf(enemy);
  if (index < 0) {
    return;
  }

  state.enemies.splice(index, 1);
  state.score += enemy.scoreValue;
  state.events.push({
    type: "enemyDied",
    x: enemy.position.x,
    y: enemy.position.y,
    enemyType: enemy.type,
    isBoss: enemy.isBoss,
  });
}

/**
 * Schaden am Spieler. Die kurze Unverwundbarkeit danach verhindert, dass ein
 * Gegnerhaufen einen Spieler in Sekundenbruchteilen wegputzt.
 */
export function damagePlayer(state: WorldState, player: PlayerState, amount: number): void {
  if (player.down || player.invulnerable > 0) {
    return;
  }

  player.health -= amount;
  player.invulnerable = PLAYER.invulnerabilityTime;

  state.events.push({
    type: "playerHit",
    playerId: player.id,
    x: player.position.x,
    y: player.position.y,
    damage: amount,
  });

  if (player.health <= 0) {
    player.health = 0;
    player.down = true;
    player.reviveProgress = 0;
    player.velocity.x = 0;
    player.velocity.y = 0;
    state.events.push({
      type: "playerDown",
      playerId: player.id,
      x: player.position.x,
      y: player.position.y,
    });
  }
}

/**
 * Wiederbelebung: Ein Mitspieler muss drei Sekunden in Reichweite bleiben.
 * Geht er weg, laeuft der Fortschritt wieder zurueck - sonst koennte man die
 * Wiederbelebung stueckweise "ansparen".
 */
export function stepRevive(state: WorldState, dt: number): void {
  for (const player of state.players) {
    if (!player.down) {
      continue;
    }

    const helper = state.players.find(
      (other) =>
        !other.down &&
        other.id !== player.id &&
        Math.hypot(other.position.x - player.position.x, other.position.y - player.position.y) <=
          PLAYER.reviveRange,
    );

    if (!helper) {
      player.reviveProgress = Math.max(0, player.reviveProgress - dt);
      continue;
    }

    player.reviveProgress += dt;
    if (player.reviveProgress >= PLAYER.reviveTime) {
      player.down = false;
      player.reviveProgress = 0;
      player.health = Math.round(player.maxHealth * 0.5);
      player.invulnerable = 1.0;
      state.events.push({
        type: "playerRevived",
        playerId: player.id,
        x: player.position.x,
        y: player.position.y,
      });
    }
  }
}
