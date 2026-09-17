/**
 * Die zweite aktive Faehigkeit je Charakter.
 *
 * Unterschied zum Super (`supers.ts`): Der Super laedt sich ueber ausgeteilten
 * Schaden auf und ist der grosse Moment. Diese Faehigkeit hat eine feste
 * Abklingzeit und soll laufend eingesetzt werden.
 *
 * Wie ueberall unter `systems/`: reine Logik auf Datenobjekten, kein Phaser.
 */

import { ABILITIES } from "../config/balance";
import { spawnProjectile } from "./projectiles";
import type { BarrierState, InputState, PlayerState, Vec2, WorldState } from "./types";

/** Ist die Faehigkeit gerade einsatzbereit? */
export function isAbilityReady(player: PlayerState): boolean {
  return player.abilityCooldown <= 0 && !player.down;
}

/**
 * Richtung der Faehigkeit.
 *
 * Wer beim Halten gezogen hat, bestimmt sie selbst. Ein kurzes Antippen ohne
 * Ziehen schickt `null` - dann gilt die Blickrichtung der Figur. Genau so steht
 * es in der Beschreibung der Steuerung.
 */
function abilityDirection(player: PlayerState, input: InputState): Vec2 {
  const aim = input.abilityAim;
  if (aim) {
    const length = Math.hypot(aim.x, aim.y);
    if (length > 1e-6) {
      return { x: aim.x / length, y: aim.y / length };
    }
  }
  return { x: player.facing.x, y: player.facing.y };
}

/** Ein Versuch, die Faehigkeit auszuloesen. Gibt zurueck, ob sie ausgeloest wurde. */
export function tryAbility(state: WorldState, player: PlayerState, input: InputState): boolean {
  if (!input.useAbility || !isAbilityReady(player)) {
    return false;
  }

  const direction = abilityDirection(player, input);

  switch (player.character) {
    case "scout":
      throwFlashGrenade(state, player, direction);
      break;
    case "tank":
      raiseBarrier(state, player, direction);
      break;
    case "sniper":
      fireRootShot(state, player, direction);
      break;
  }

  player.abilityCooldown = ABILITIES[player.character].cooldown;
  player.facing.x = direction.x;
  player.facing.y = direction.y;

  state.events.push({
    type: "abilityUsed",
    playerId: player.id,
    character: player.character,
    x: player.position.x,
    y: player.position.y,
  });

  return true;
}

/**
 * Scout: Blendgranate.
 *
 * Ein gewoehnliches Projektil mit Zusatzwirkung - beim Aufschlag explodiert es
 * (siehe `detonate`). Absichtlich ueber den normalen Projektilweg statt als
 * Sonderfall: So gelten dieselbe Flugbahnpruefung und dieselben Waende wie fuer
 * alles andere, und ein Wurf hinter eine Deckung ist unmoeglich.
 */
function throwFlashGrenade(state: WorldState, player: PlayerState, direction: Vec2): void {
  const ability = ABILITIES.scout;
  spawnProjectile(state, {
    owner: "player",
    ownerId: player.id,
    position: player.position,
    direction,
    speed: ability.speed,
    // Die Granate selbst macht keinen Schaden - sie blendet nur.
    damage: 0,
    range: ability.range,
    radius: 10,
    piercing: false,
    effect: "blind",
    blastRadius: ability.blastRadius,
  });
}

/**
 * Tank: Schildwand.
 *
 * Sie steht QUER zur Blickrichtung, ein Stueck vor dem Spieler. "Quer" heisst:
 * Die Wand verlaeuft entlang der um 90 Grad gedrehten Blickrichtung - sonst
 * stuende sie in Blickrichtung und man schiesse selbst dagegen.
 */
function raiseBarrier(state: WorldState, player: PlayerState, direction: Vec2): void {
  const ability = ABILITIES.tank;
  const barrier: BarrierState = {
    id: state.nextBarrierId++,
    ownerId: player.id,
    position: {
      x: player.position.x + direction.x * ability.range,
      y: player.position.y + direction.y * ability.range,
    },
    // Um 90 Grad gedreht: aus (x, y) wird (-y, x).
    along: { x: -direction.y, y: direction.x },
    halfWidth: ability.width / 2,
    remaining: ability.duration,
  };
  state.barriers.push(barrier);

  state.events.push({ type: "barrierUp", x: barrier.position.x, y: barrier.position.y });
}

/** Sniper: Laehmschuss - langsam, weniger Schaden, wurzelt den Getroffenen fest. */
function fireRootShot(state: WorldState, player: PlayerState, direction: Vec2): void {
  const ability = ABILITIES.sniper;
  spawnProjectile(state, {
    owner: "player",
    ownerId: player.id,
    position: player.position,
    direction,
    speed: ability.speed,
    damage: ability.damage,
    range: ability.range,
    radius: 9,
    piercing: false,
    effect: "root",
    blastRadius: 0,
  });
}

/**
 * Wirkung eines Projektils mit Zusatzeffekt, sobald es etwas trifft oder seine
 * Reichweite aufbraucht.
 *
 * Wird aus `projectiles.ts` gerufen - dort liegt die Flugbahn, hier die
 * Wirkung. Die Trennung haelt die Flugbahnrechnung frei von Sonderfaellen.
 */
export function detonate(state: WorldState, x: number, y: number, radius: number): void {
  const blind = ABILITIES.scout.blindDuration;
  for (const enemy of state.enemies) {
    const dx = enemy.position.x - x;
    const dy = enemy.position.y - y;
    const reach = radius + enemy.radius;
    if (dx * dx + dy * dy <= reach * reach) {
      enemy.blinded = Math.max(enemy.blinded, blind);
    }
  }
  state.events.push({ type: "blast", x, y, radius });
}

/** Zaehlt Abklingzeiten und Standzeiten herunter. */
export function stepAbilities(state: WorldState, dt: number): void {
  for (const player of state.players) {
    if (player.abilityCooldown > 0) {
      player.abilityCooldown = Math.max(0, player.abilityCooldown - dt);
    }
  }

  // Rueckwaerts laufen, damit das Entfernen die Reihenfolge nicht durcheinander
  // bringt.
  for (let i = state.barriers.length - 1; i >= 0; i -= 1) {
    const barrier = state.barriers[i];
    if (!barrier) {
      continue;
    }
    barrier.remaining -= dt;
    if (barrier.remaining <= 0) {
      state.barriers.splice(i, 1);
    }
  }
}

/**
 * Blockiert eine Schildwand die Strecke von `from` nach `to`?
 *
 * Zwei Strecken schneiden sich - das ist die ganze Rechnung. Sie ist exakt und
 * braucht kein Abtasten, also kann auch ein schnelles Projektil nicht
 * hindurchspringen.
 *
 * @returns Anteil der Strecke bis zum Treffer (0 bis 1), oder null.
 */
export function barrierHitTime(
  state: WorldState,
  fromX: number,
  fromY: number,
  stepX: number,
  stepY: number,
): number | null {
  let earliest: number | null = null;

  for (const barrier of state.barriers) {
    const wallX = barrier.along.x * barrier.halfWidth;
    const wallY = barrier.along.y * barrier.halfWidth;
    const startX = barrier.position.x - wallX;
    const startY = barrier.position.y - wallY;

    // Schnitt der Strecken (from + t * step) und (start + u * 2*wall).
    const denominator = stepX * (2 * wallY) - stepY * (2 * wallX);
    if (Math.abs(denominator) < 1e-9) {
      // Parallel - kein Schnitt.
      continue;
    }

    const diffX = startX - fromX;
    const diffY = startY - fromY;
    const t = (diffX * (2 * wallY) - diffY * (2 * wallX)) / denominator;
    const u = (diffX * stepY - diffY * stepX) / denominator;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      if (earliest === null || t < earliest) {
        earliest = t;
      }
    }
  }

  return earliest;
}
