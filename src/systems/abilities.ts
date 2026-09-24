/**
 * Die zweite aktive Faehigkeit je Charakter.
 *
 * Unterschied zum Super (`supers.ts`): Der Super laedt sich ueber ausgeteilten
 * Schaden auf und ist der grosse Moment. Diese Faehigkeit hat eine feste
 * Abklingzeit und soll laufend eingesetzt werden.
 *
 * DIE LEITREGEL NACH DEM ZWEITEN SPIELTEST: Eine Faehigkeit muss binnen einer
 * Sekunde SICHTBAR sein. Die erste Fassung hatte fuer Scout und Tank je eine,
 * die das nicht war - eine Blendung, bei der die Gegner unveraendert
 * weiterliefen, und eine Wand, die nur Schuesse hielt, waehrend der Tank im
 * Nahkampf steht. Beide wirkten messbar und fuehlten sich trotzdem wie nichts
 * an. Eine Wirkung, die man nicht sieht, benutzt niemand. Die Begruendungen im
 * Einzelnen stehen bei den Werten in `config/balance.ts`.
 *
 * Wie ueberall unter `systems/`: reine Logik auf Datenobjekten, kein Phaser.
 */

import { ABILITIES } from "../config/balance";
import { damageEnemy } from "./combat";
import { spawnProjectile } from "./projectiles";
import type { EnemyState, InputState, PlayerState, Vec2, WorldState } from "./types";

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
      throwFragGrenade(state, player, direction);
      break;
    case "tank":
      startHealField(player);
      break;
    case "sniper":
      fireRootShot(state, player, direction);
      break;
  }

  player.abilityCooldown = ABILITIES[player.character].cooldown;

  // Die Heilung des Tanks hat keine Richtung - seine Blickrichtung deshalb
  // nicht verdrehen, nur weil ein Knopf gedrueckt wurde.
  if (player.character !== "tank") {
    player.facing.x = direction.x;
    player.facing.y = direction.y;
  }

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
 * Scout: Splittergranate.
 *
 * Ein gewoehnliches Projektil mit Zusatzwirkung - beim Aufschlag explodiert es
 * (siehe `detonate`). Absichtlich ueber den normalen Projektilweg statt als
 * Sonderfall: So gelten dieselbe Flugbahnpruefung und dieselben Waende wie fuer
 * alles andere, und ein Wurf hinter eine Deckung ist unmoeglich.
 *
 * Das Wurfgeschoss selbst macht keinen Schaden (`damage: 0`) - der ganze
 * Schaden steckt in der Explosion. Sonst bekaeme ein direkt getroffener Gegner
 * doppelt ab, und die Granate waere gegen einen einzelnen Gegner stark statt
 * gegen eine Gruppe.
 */
function throwFragGrenade(state: WorldState, player: PlayerState, direction: Vec2): void {
  const ability = ABILITIES.scout;
  spawnProjectile(state, {
    owner: "player",
    ownerId: player.id,
    position: player.position,
    direction,
    speed: ability.speed,
    damage: 0,
    range: ability.range,
    radius: 10,
    piercing: false,
    effect: "blast",
    blastRadius: ability.blastRadius,
    blastDamage: ability.damage,
  });
}

/**
 * Tank: Zweite Luft - heilt sofort.
 *
 * Ueber das Maximum hinaus wird nicht geheilt; `Math.min` ist hier der ganze
 * Trick. Gemeldet wird der TATSAECHLICH geheilte Betrag, nicht der aus den
 * Werten: Bei fast vollem Leben soll die Anzeige nicht 1000 behaupten, wenn
 * nur 80 angekommen sind.
 */
/**
 * Heilfeld des Tanks (Etappe 10): ein Feld um ihn, das drei Sekunden lang
 * alle STEHENDEN Mitspieler darin heilt, ihn selbst eingeschlossen.
 *
 * Wer am Boden liegt, wird nicht geheilt - aufstehen geht nur ueber die
 * Wiederbelebung, sonst waere das Feld nebenbei eine zweite, schnellere.
 */
function startHealField(player: PlayerState): void {
  player.healField = ABILITIES.tank.duration;
  player.healFieldPending = {};
}

/**
 * Heilt, solange das Feld steht - ein Stueck je Tick.
 *
 * Gemeldet wird gesammelt, einmal je Sekunde und am Ende: Eine Zahl je Tick
 * (30 je Sekunde) waere ein Schwarm von "+3", den niemand liest.
 */
export function stepHealFields(state: WorldState, dt: number): void {
  const ability = ABILITIES.tank;
  const radiusSquared = ability.radius * ability.radius;

  for (const tank of state.players) {
    if (tank.healField <= 0) {
      continue;
    }

    const before = tank.healField;
    tank.healField = Math.max(0, tank.healField - dt);
    const step = before - tank.healField;

    for (const mate of state.players) {
      if (mate.down) {
        continue;
      }
      const dx = mate.position.x - tank.position.x;
      const dy = mate.position.y - tank.position.y;
      if (dx * dx + dy * dy > radiusSquared) {
        continue;
      }
      const healed = Math.min(mate.maxHealth - mate.health, ability.healPerSecond * step);
      if (healed <= 0) {
        continue;
      }
      mate.health += healed;
      tank.healFieldPending[mate.id] = (tank.healFieldPending[mate.id] ?? 0) + healed;
    }

    // Volle Sekunde vorbei oder Feld zu Ende: sammeln und melden.
    const crossedSecond = Math.floor(before) !== Math.floor(tank.healField);
    if (crossedSecond || tank.healField <= 0) {
      for (const [id, amount] of Object.entries(tank.healFieldPending)) {
        const mate = state.players.find((entry) => entry.id === id);
        // Gemeldet wird die echte Heilung, nicht der Tabellenwert.
        const rounded = Math.round(amount);
        if (mate && rounded > 0) {
          state.events.push({
            type: "healed",
            playerId: id,
            amount: rounded,
            x: mate.position.x,
            y: mate.position.y,
          });
        }
      }
      tank.healFieldPending = {};
    }
  }
}

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
    blastDamage: 0,
  });
}

/**
 * Wirkung der Splittergranate, sobald sie etwas trifft oder ihre Wurfweite
 * aufbraucht.
 *
 * Wird aus `projectiles.ts` gerufen - dort liegt die Flugbahn, hier die
 * Wirkung. Die Trennung haelt die Flugbahnrechnung frei von Sonderfaellen.
 *
 * Der Schaden ist im ganzen Radius gleich hoch, ohne Abschwaechung nach aussen.
 * Das ist Absicht: Der Zielkreis am Knopf zeigt genau diesen Radius, und eine
 * Abschwaechung wuerde bedeuten, dass der Kreis etwas anderes verspricht, als
 * er haelt.
 */
export function detonate(
  state: WorldState,
  x: number,
  y: number,
  radius: number,
  damage: number,
  ownerId: string,
): void {
  /*
   * ERST SAMMELN, DANN SCHADEN MACHEN.
   *
   * `damageEnemy` kann den Gegner toeten, und ein toter Gegner wird sofort aus
   * `state.enemies` entfernt. Wuerde man direkt ueber diese Liste laufen und
   * dabei toeten, ruecken die folgenden Eintraege eine Stelle vor - jeder
   * zweite Gegner im Radius bliebe unversehrt. Genau der Fehler, der sich als
   * "die Granate trifft manchmal nicht alle" zeigen wuerde.
   */
  const targets: EnemyState[] = [];
  for (const enemy of state.enemies) {
    const dx = enemy.position.x - x;
    const dy = enemy.position.y - y;
    const reach = radius + enemy.radius;
    if (dx * dx + dy * dy <= reach * reach) {
      targets.push(enemy);
    }
  }

  for (const enemy of targets) {
    /*
     * Ueber `damageEnemy` statt `enemy.health -= ...`: Dort haengen Markierung,
     * Superladung, Todesmeldung und Punkte dran. Wer den Schaden von Hand
     * abzieht, bekommt Gegner mit null Leben, die weiterlaufen.
     *
     * Ohne Rueckstossrichtung - eine Explosion kommt aus der Mitte und hat
     * keine Flugrichtung.
     */
    damageEnemy(state, enemy, damage, ownerId);
  }

  state.events.push({ type: "blast", x, y, radius });
}

/** Zaehlt die Abklingzeiten herunter. */
export function stepAbilities(state: WorldState, dt: number): void {
  for (const player of state.players) {
    if (player.abilityCooldown > 0) {
      player.abilityCooldown = Math.max(0, player.abilityCooldown - dt);
    }
  }
}
