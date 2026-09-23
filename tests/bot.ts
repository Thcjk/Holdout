/**
 * Der Bot fuer die Balancing-Messungen.
 *
 * Er ist absichtlich mittelmaessig: Er nutzt keine Deckung, keine Buesche und
 * weicht einzelnen Projektilen nicht aus. Seine Zahlen sind eine Untergrenze,
 * kein Zielwert.
 *
 * Eine Sache muss er aber koennen, sonst misst er Unsinn: **auf seine eigene
 * Reichweite achten.** Ein frueherer Bot hielt pauschal 300 Pixel Abstand zu
 * allen Gegnern - der Tank reicht aber nur 250. Er floh damit staendig aus
 * seiner eigenen Reichweite heraus und schoss minutenlang ins Leere; eine Welle
 * dauerte dann fuenf Minuten statt dreissig Sekunden. Das sah nach einem
 * kaputten Charakter aus, war aber ein kaputter Bot.
 *
 * Deshalb haelt er jetzt einen Abstand, der zu seiner Waffe passt: nah genug
 * zum Treffen, weit genug, um nicht im Nahkampf zu stehen.
 */

import { CHARACTERS } from "../src/config/balance";
import { nearestEnemy } from "../src/systems/targeting";
import type { InputState, Vec2, WorldState } from "../src/systems/types";
import { makeInput } from "./helpers";

/**
 * Abstand zur Aussenmauer, den der Bot haelt.
 *
 * Er laeuft nach AUSSEN, weil dort seit Phase 8 der Fortschritt liegt - aber
 * nicht bis an die Mauer. Dort gaebe es kein Ausweichen mehr, und gemessen
 * wuerde dann das Sterben an einer Wand statt an der Schwierigkeit.
 */
const BORDER_KEEPOUT = 700;

/**
 * Ein Bot mit Gedaechtnis.
 *
 * Gebraucht wird genau eine Erinnerung: wann er zuletzt etwas getroffen hat.
 * Trifft er laenger nichts, obwohl Gegner leben, steht etwas zwischen ihm und
 * ihnen - meistens eine Wand. Dann geht er direkt drauf zu, statt seinen
 * Wunschabstand zu halten. Genau das macht ein Mensch auch; ohne diese Regel
 * standen sich Bot und Gegner minutenlang durch eine Deckung hindurch
 * gegenueber, und eine Welle dauerte 290 statt 15 Sekunden.
 *
 * Je Durchlauf einen eigenen Bot erzeugen - sonst schleppt der naechste
 * Durchlauf die Erinnerung des vorherigen mit.
 */
export function createBot(): (state: WorldState) => Map<string, InputState> {
  let lastHitTick = 0;
  return (state) => botInput(state, () => lastHitTick, (t) => (lastHitTick = t));
}

/** Nach so vielen Sekunden ohne Treffer geht der Bot stur nach vorne. */
const BLOCKED_SECONDS = 3;

function botInput(
  state: WorldState,
  getLastHitTick: () => number,
  setLastHitTick: (tick: number) => void,
): Map<string, InputState> {
  // Die Ereignisse des vorherigen Ticks liegen noch an.
  for (const event of state.events) {
    if (event.type === "hit") {
      setLastHitTick(state.tick);
      break;
    }
  }

  const player = state.players[0];
  if (!player) {
    return new Map();
  }

  const range = CHARACTERS[player.character].shot.range;
  // Wunschabstand: knapp innerhalb der eigenen Reichweite. Der Sniper (900)
  // bleibt damit weit weg, der Tank (250) muss ran - genau wie gedacht.
  const wanted = range * 0.7;
  const tooClose = range * 0.45;

  const target = nearestEnemy(state, player.position, 4000);
  let aim: Vec2 | null = null;
  let distance = Infinity;

  if (target) {
    const dx = target.position.x - player.position.x;
    const dy = target.position.y - player.position.y;
    distance = Math.hypot(dx, dy) || 1;
    aim = { x: dx / distance, y: dy / distance };
  }

  // Laenger nichts getroffen, obwohl Gegner da sind? Dann steht etwas im Weg.
  const ticksBlocked = state.tick - getLastHitTick();
  const blocked = state.enemies.length > 0 && ticksBlocked > BLOCKED_SECONDS * 30;

  let moveX = 0;
  let moveY = 0;

  if (aim && blocked) {
    // Direkt drauf zu, ohne Ruecksicht auf den Wunschabstand - nur so kommt er
    // um die Deckung herum, hinter der alle stehen.
    moveX = aim.x;
    moveY = aim.y;
  } else if (aim && distance > wanted) {
    // Zu weit weg: ran, sonst treffen die eigenen Schuesse nie.
    moveX = aim.x;
    moveY = aim.y;
  } else if (aim && distance < tooClose && target !== null && target.contactDamage > 0) {
    // Zu nah an etwas, das durch Beruehrung wehtut: ein Stueck zurueck.
    //
    // Nur bei Beruehrungsschaden. Vor einem Schuetzen zurueckzuweichen bringt
    // nichts - er schiesst ja - und der Bot lief sich damit in einer Arenaecke
    // fest: Er drueckte 290 Sekunden lang gegen die Wand, waehrend der Schuetze
    // ausser Schussbahn stand. Das sah nach einem zaehen Charakter aus, war aber
    // ein Bot, der sich selbst in die Ecke manoevrierte.
    moveX = -aim.x;
    moveY = -aim.y;
  } else if (aim) {
    // Im guten Abstand: seitlich ausweichen statt stehenzubleiben.
    moveX = -aim.y;
    moveY = aim.x;
  }

  // Von allem wegdruecken, was direkt am Koerper klebt - Beruehrungsschaden tut
  // am meisten weh. Der Radius haengt an der eigenen Reichweite, nicht an einer
  // festen Zahl.
  const panic = Math.min(160, range * 0.5);
  for (const enemy of state.enemies) {
    const dx = player.position.x - enemy.position.x;
    const dy = player.position.y - enemy.position.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < panic) {
      const weight = ((panic - d) / panic) * 1.5;
      moveX += (dx / d) * weight;
      moveY += (dy / d) * weight;
    }
  }

  /*
   * Sanft nach aussen - das ist die groesste Aenderung am Bot seit Phase 8.
   *
   * Frueher zog es ihn zur Arenamitte, damit er sich nicht in einer Ecke
   * verkriecht. In einer offenen Welt waere das genau falsch: Er bliebe fuer
   * immer in Zone 0 stehen, und die Messung saegte, das Spiel sei leicht -
   * obwohl er nie irgendwo war, wo es schwer wird.
   *
   * Vor der Aussenmauer dreht der Zug um, sonst drueckt er dort nur noch
   * dagegen.
   */
  const center: Vec2 = { x: state.bounds.width / 2, y: state.bounds.height / 2 };
  const outX = player.position.x - center.x;
  const outY = player.position.y - center.y;
  const radius = Math.hypot(outX, outY) || 1;
  const maxRadius = state.bounds.width / 2 - BORDER_KEEPOUT;
  const direction = radius < maxRadius ? 1 : -1;

  moveX += (outX / radius) * 0.6 * direction;
  moveY += (outY / radius) * 0.6 * direction;

  const length = Math.hypot(moveX, moveY);
  const move = length > 0.05 ? { x: moveX / length, y: moveY / length } : { x: 0, y: 0 };

  return new Map([
    [player.id, makeInput(move, { aim, fire: true, useSuper: player.superCharge >= 100 })],
  ]);
}
