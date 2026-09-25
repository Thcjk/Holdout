/**
 * Schaden, Schuesse, Munition, Tod und Wiederbelebung.
 *
 * Alles hier arbeitet auf reinen Datenobjekten und meldet, was passiert ist,
 * ueber `state.events` - daraus macht die Darstellung Effekte und Toene, und ab
 * Phase 6 werden genau diese Ereignisse an die Mitspieler geschickt.
 */

import { FIST, PLAYER, PROJECTILE, SUPERS, CONSUMABLES } from "../config/balance";
import { hasLineOfSight } from "./collision";
import { spawnProjectile } from "./projectiles";
import { nearestEnemy } from "./targeting";
import { activeWeapon, ammoCapacity, autoAimReach, reloadTimeOf } from "./weapons";
import type { EnemyState, InputState, PlayerState, Vec2, WorldState } from "./types";
import { dropFromEnemy } from "./loot";

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
  // Magazin auf- oder abgesetzt, Waffe gewechselt: Anzahl der Ladungen
  // angleichen. Neue Ladungen muessen erst nachgeladen werden - sonst gaebe
  // Aufsetzen und Abnehmen freie Schuesse.
  const capacity = ammoCapacity(player);
  while (player.reloadTimers.length < capacity) {
    player.reloadTimers.push(reloadTimeOf(player));
  }
  if (player.reloadTimers.length > capacity) {
    player.reloadTimers.length = capacity;
  }
  // Munitionskiste: Nachladen laeuft schneller (`CONSUMABLES.ammoBox`).
  const reloadStep = player.fastReload > 0 ? dt * CONSUMABLES.ammoBox.reloadFactor : dt;
  for (let i = 0; i < player.reloadTimers.length; i += 1) {
    const timer = player.reloadTimers[i] ?? 0;
    if (timer > 0) {
      player.reloadTimers[i] = Math.max(0, timer - reloadStep);
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
      player.reloadTimers[i] = reloadTimeOf(player);
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

  const target = nearestEnemy(state, player.position, autoAimReach(player));
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

/**
 * Ein Angriffsversuch. Gibt zurueck, ob tatsaechlich angegriffen wurde.
 *
 * Mit Waffe: Geschosse nach den Werten der AUSGERUESTETEN Waffe
 * (`systems/weapons.ts`) - Schaden, Reichweite, Faecher, Nachladen, Takt.
 * Ohne Waffe: der Faustschlag.
 */
export function tryShoot(state: WorldState, player: PlayerState, input: InputState): boolean {
  if (!input.fire || player.down || player.shootCooldown > 0) {
    return false;
  }

  const weapon = activeWeapon(player);
  if (!weapon) {
    punch(state, player, shootDirection(state, player, input));
    return true;
  }
  if (ammoCount(player) === 0) {
    return false;
  }

  const direction = shootDirection(state, player, input);
  const baseAngle = Math.atan2(direction.y, direction.x);
  const spread = (weapon.spread * Math.PI) / 180;
  const bullets = weapon.bullets;

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
      damage: weapon.damage,
      range: weapon.range,
      radius: PROJECTILE.radius,
      piercing: weapon.piercing,
    });
  }

  consumeAmmo(player);
  player.shootCooldown = weapon.cooldown;
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

/**
 * Der Faustschlag: trifft den naechsten Gegner vor der Figur, sofort.
 *
 * Kein Geschoss - eine Faust, die man fliegen sieht, waere keine. Getroffen
 * wird hoechstens EIN Gegner (der naechste), und nur innerhalb eines Bogens
 * von `FIST.arc` Grad zu beiden Seiten der Schlagrichtung, mit
 * `FIST.reach` Pixeln ab Koerperrand zu Koerperrand. Durch Waende schlaegt
 * man nicht: Eine Wand ist 48 px dick und passt in die Reichweite.
 */
function punch(state: WorldState, player: PlayerState, direction: Vec2): void {
  const cosArc = Math.cos((FIST.arc * Math.PI) / 180);
  let best: EnemyState | null = null;
  let bestGap = Number.POSITIVE_INFINITY;

  for (const enemy of state.enemies) {
    const dx = enemy.position.x - player.position.x;
    const dy = enemy.position.y - player.position.y;
    const distance = Math.hypot(dx, dy);
    const gap = distance - player.radius - enemy.radius;
    if (gap > FIST.reach || gap >= bestGap) {
      continue;
    }
    // Wer schon ueberlappt, wird immer getroffen - die Richtung ist dann
    // kaum bestimmbar und ein Vorbeischlagen fuehlte sich falsch an.
    if (gap > 0 && (dx * direction.x + dy * direction.y) / distance < cosArc) {
      continue;
    }
    if (!hasLineOfSight(state.walls, player.position, enemy.position)) {
      continue;
    }
    best = enemy;
    bestGap = gap;
  }

  player.shootCooldown = FIST.cooldown;
  player.facing.x = direction.x;
  player.facing.y = direction.y;

  state.events.push({
    type: "punch",
    playerId: player.id,
    x: player.position.x,
    y: player.position.y,
    dx: direction.x,
    dy: direction.y,
    hit: best !== null,
  });

  if (best) {
    damageEnemy(state, best, FIST.damage, player.id, direction);
  }
}

/** Schaden an einem Gegner, inklusive Rueckstoss und Super-Aufladung. */
export function damageEnemy(
  state: WorldState,
  enemy: EnemyState,
  amount: number,
  sourcePlayerId: string,
  knockbackDirection?: Vec2,
): void {
  // Aufgedeckte Gegner (Aufklaerungsschuss des Snipers) nehmen mehr Schaden -
  // egal, wer trifft. Das ist der Sinn: eine Ansage fuers ganze Team.
  const multiplier = enemy.marked > 0 ? 1 + SUPERS.sniper.teamDamageBonus : 1;
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

  chargeSuper(state, sourcePlayerId, applied);

  if (enemy.health <= 0) {
    killEnemy(state, enemy);
  }
}

/**
 * Super-Aufladung in Prozent fuer einen Treffer mit `damage` Schaden.
 *
 * Bewusst am Schaden statt an der Trefferzahl: Sonst laedt ein Charakter mit
 * fuenf Kugeln je Schuss fuenfmal so schnell wie einer mit einer Kugel, ganz
 * unabhaengig davon, wie viel er tatsaechlich anrichtet.
 *
 * Stand frueher in `skills.ts` und wurde dort mit der Super-Stufe
 * multipliziert. Mit dem Skillpunkte-System ist dieser Faktor weggefallen
 * (er war auf Stufe 0 ohnehin 1) - die Rechnung selbst bleibt.
 */
function superChargeFor(damage: number): number {
  return (PLAYER.superChargePerDamage * damage) / 1000;
}

function chargeSuper(state: WorldState, playerId: string, damage: number): void {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) {
    return;
  }

  const wasReady = isSuperReady(player);
  player.superCharge = Math.min(100, player.superCharge + superChargeFor(damage));

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

  // ERST entfernen, DANN Loot legen: `dropFromEnemy` liest die Position des
  // Gegners, aendert `state.enemies` aber nicht - die Reihenfolge ist hier
  // also ungefaehrlich und so herum besser lesbar.
  dropFromEnemy(state, enemy);
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
  // `shielded`: Rucksack offen - in Ruhe umraeumen (2026-09-26).
  if (player.down || player.invulnerable > 0 || player.shielded) {
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
