/**
 * Wer wann wo erscheint - und der Ablauf eines Runs.
 *
 * Nachfolger von `waves.ts`. Der Unterschied ist nicht technisch, sondern
 * spielerisch:
 *
 *   FRUEHER  Die Schwierigkeit stieg mit der WELLENNUMMER, also mit der Zeit.
 *            Man konnte nichts dagegen tun ausser besser zu spielen.
 *   JETZT    Sie steigt mit der ENTFERNUNG zum Startpunkt. Wie gefaehrlich es
 *            wird, entscheidet das Team selbst - aus einem Schicksal wird eine
 *            Entscheidung.
 *
 * ================================================================
 * ZIELBEVOELKERUNG STATT WELLENLISTE
 * ================================================================
 *
 * Eine Welle war eine fertige Liste: zwoelf Gegner, nacheinander, fertig. Das
 * geht in einer offenen Welt nicht mehr - es gibt keinen Moment, an dem "die
 * Welle vorbei" waere.
 *
 * Stattdessen gibt es eine Zielzahl: So viele Gegner sollen rund um die Spieler
 * gleichzeitig unterwegs sein. Liegt die tatsaechliche Zahl darunter, erscheint
 * Nachschub knapp ausserhalb des Sichtfelds. Wer weit genug weglaeuft, laesst
 * Gegner hinter sich - sie werden entfernt, statt ewig hinterherzutrotten.
 *
 * Die Zahlen stammen alle aus `config/balance.ts`.
 */

import { DIFFICULTY, LIMITS, PLAYER, WORLD } from "../config/balance";
import { TICK_RATE } from "../config/constants";
import { createEnemy } from "./enemies";
import { nextRandom, randomRange } from "./rng";
import {
  distanceFromStart,
  safeRadiusOf,
  targetPopulation,
  zoneOf,
  zoneScaling,
} from "./zones";
import { enemyBudget, endRun } from "./encounters";
import type { EnemyType, PlayerState, Vec2, WorldState } from "./types";

/** Welcher Gegnertyp erscheint in dieser Zone? */
function pickType(state: WorldState, zone: number): EnemyType {
  const roll = nextRandom(state);

  if (zone >= DIFFICULTY.bruteFromZone && roll < DIFFICULTY.bruteShare) {
    return "brute";
  }
  if (zone >= DIFFICULTY.shooterFromZone && roll < DIFFICULTY.bruteShare + DIFFICULTY.shooterShare) {
    return "shooter";
  }
  return "runner";
}

/** Alle Spieler, die noch stehen. */
function livingPlayers(state: WorldState): PlayerState[] {
  return state.players.filter((player) => !player.down);
}

/**
 * Ein Punkt auf einem Ring um den Spieler, der frei ist.
 *
 * Mehrere Versuche, weil ein zufaelliger Punkt in einer Mauer oder ausserhalb
 * der Karte landen kann. Klappt keiner, erscheint diesmal eben nichts - das ist
 * besser, als einen Gegner in eine Wand zu setzen, aus der er nicht herauskommt.
 */
function findSpawnPoint(state: WorldState, around: Vec2): Vec2 | null {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = randomRange(state, 0, Math.PI * 2);
    const radius = randomRange(state, DIFFICULTY.spawnRadiusMin, DIFFICULTY.spawnRadiusMax);
    const point = {
      x: around.x + Math.cos(angle) * radius,
      y: around.y + Math.sin(angle) * radius,
    };

    const margin = WORLD.wallThickness + 60;
    if (
      point.x < margin ||
      point.y < margin ||
      point.x > state.bounds.width - margin ||
      point.y > state.bounds.height - margin
    ) {
      continue;
    }

    if (state.walls.some((wall) => pointInRect(point, wall, 40))) {
      continue;
    }

    /*
     * NIE IN DER SICHEREN STARTZONE.
     *
     * Diese Pruefung fehlte bis zur Ueberarbeitung - aufgefallen erst beim
     * Nachpruefen gegen das Arbeitsdokument ("keine Gegner-Spawns
     * innerhalb"). Gesucht wird auf einem Ring von 700 bis 1200 Pixeln um
     * einen Spieler; steht der am Rand der Startzone, liegt ein Teil dieses
     * Rings mitten in ihr. Ein Gegner, der dort auftaucht, macht die
     * "ungefaehrliche Zone" aus dem Briefing zur Luege - und genau dort
     * steht man, um zu heilen.
     *
     * Mit 120 Pixeln Aufschlag, damit ein Gegner nicht auf der Grenze
     * erscheint und mit dem ersten Schritt schon drin ist.
     */
    const safe = safeRadiusOf(state);
    if (safe > 0 && distanceFromStart(state, point) < safe + 120) {
      continue;
    }

    return point;
  }

  return null;
}

function pointInRect(point: Vec2, rect: { x: number; y: number; width: number; height: number }, pad: number): boolean {
  return (
    point.x >= rect.x - pad &&
    point.x <= rect.x + rect.width + pad &&
    point.y >= rect.y - pad &&
    point.y <= rect.y + rect.height + pad
  );
}

/**
 * Der Ablauf eines Runs, ein Tick davon.
 *
 * Reihenfolge: erst pruefen, ob alle am Boden sind (dann ist Schluss), dann die
 * Zone fortschreiben, dann aufraeumen, dann nachlegen.
 */
export function stepRound(state: WorldState, dt: number): void {
  stepNodeTimer(state, dt);
  if (state.phase === "ended") {
    return;
  }

  if (state.players.length > 0 && state.players.every((player) => player.down)) {
    endRun(state, "wipe");
    return;
  }

  state.runTime += dt;

  updateZone(state);
  healInSafeZone(state, dt);
  despawnDistant(state);
  spawnDueEnemies(state);
  queueSpawns(state);
}

/**
 * In der sicheren Zone um den Startpunkt heilt man sich.
 *
 * DAS IST DER ERSATZ FUER DIE PAUSENHEILUNG. Frueher kam zwischen zwei Wellen
 * ein guter Teil des Lebens zurueck. Ohne Wellen gibt es diese Pause nicht mehr,
 * und ohne Ersatz gaebe es im ganzen Run ueberhaupt keine Heilung ausser der
 * Tank-Faehigkeit - jeder Run endete dann zwangslaeufig nach wenigen Minuten.
 *
 * Der Weg zurueck kostet Zeit, und genau das soll er: Er ist die kleine
 * Schwester der Entscheidung, um die sich der ganze Run dreht - weiter
 * vorruecken oder erst einmal durchatmen.
 *
 * Gefallene stehen hier NICHT von selbst wieder auf. Dafuer gibt es die
 * Wiederbelebung durch Mitspieler; allein zu sterben beendet den Run.
 */
function healInSafeZone(state: WorldState, dt: number): void {
  for (const player of state.players) {
    if (player.down || player.health >= player.maxHealth) {
      continue;
    }
    // Radius 0 heisst: keine sichere Zone (Knoten-Gebiet) - auch nicht
    // genau auf dem Mittelpunkt.
    const safe = safeRadiusOf(state);
    if (safe <= 0 || distanceFromStart(state, player.position) > safe) {
      continue;
    }

    player.health = Math.min(
      player.maxHealth,
      player.health + player.maxHealth * PLAYER.safeZoneHealPerSecond * dt,
    );
  }
}

/**
 * Die Zone des Teams: die des am weitesten vorgedrungenen lebenden Spielers.
 *
 * Bewusst der WEITESTE und nicht der Durchschnitt: Die Anzeige soll sagen, wie
 * tief das Team schon war, nicht wo seine Mitte steht. Fuer die Staerke der
 * Gegner zaehlt ohnehin nicht diese Zahl, sondern die Entfernung ihres eigenen
 * Erscheinungsorts - ein Gegner am Start bleibt schwach, auch wenn ein
 * Mitspieler gerade weit draussen unterwegs ist.
 */
function updateZone(state: WorldState): void {
  const living = livingPlayers(state);
  if (living.length === 0) {
    return;
  }

  let deepest = 0;
  for (const player of living) {
    deepest = Math.max(deepest, zoneOf(state, player.position));
  }
  state.zone = deepest;

  if (deepest <= state.deepestZone) {
    return;
  }

  // Mehrere Zonen auf einmal sind moeglich (Dash ueber eine Grenze), deshalb
  // eine Schleife statt eines einzelnen Schritts.
  while (state.deepestZone < deepest) {
    state.deepestZone += 1;
    state.events.push({ type: "zoneReached", zone: state.deepestZone });
  }
}

/**
 * Gegner, die weit hinter dem Team liegen, verschwinden.
 *
 * Ohne diese Zeile sammelt sich die halbe Karte im Schlepptau an und stoesst an
 * die Obergrenze von 40 Gegnern. Vorne erschiene dann nichts mehr, obwohl man
 * tief im gefaehrlichen Gebiet steht - das Spiel wuerde ausgerechnet dort
 * leerer, wo es voller werden soll.
 *
 * AUFGERAEUMT WERDEN AUCH DIE VORMERKUNGEN, nicht nur die fertigen Gegner. Das
 * hat ein Test gefunden: Wer sich weit genug absetzt, liess trotzdem noch acht
 * Gegner hinter sich erscheinen - naemlich die, die eine Sekunde vorher an der
 * alten Stelle angekuendigt worden waren. Sie verschwanden im naechsten Tick
 * gleich wieder, aber die Spawnmarkierung war da schon zu sehen.
 */
function despawnDistant(state: WorldState): void {
  const living = livingPlayers(state);
  if (living.length === 0) {
    return;
  }

  const distanceToNearestPlayer = (point: Vec2): number =>
    living.reduce(
      (min, player) =>
        Math.min(min, Math.hypot(point.x - player.position.x, point.y - player.position.y)),
      Number.POSITIVE_INFINITY,
    );

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    /*
     * Ein Boss wird NIE aufgeraeumt.
     *
     * Ohne diese Ausnahme koennte man einen Encounter erledigen, indem man
     * einmal weglaeuft - der Boss verschwaende lautlos, der Punkt bliebe fuer
     * immer "aktiv", und der Ende-Boss waere gar nicht mehr zu besiegen.
     */
    if (enemy?.type === "boss") {
      continue;
    }
    if (enemy && distanceToNearestPlayer(enemy.position) > DIFFICULTY.despawnRadius) {
      // Lautlos: kein Todesereignis, keine Punkte. Der Gegner ist nicht
      // gestorben, er ist nur nicht mehr da.
      state.enemies.splice(i, 1);
    }
  }

  for (let i = state.pendingSpawns.length - 1; i >= 0; i -= 1) {
    const order = state.pendingSpawns[i];
    if (order && distanceToNearestPlayer(order.position) > DIFFICULTY.despawnRadius) {
      state.pendingSpawns.splice(i, 1);
    }
  }
}

/** Legt neuen Nachschub in die Warteschlange, wenn zu wenige unterwegs sind. */
function queueSpawns(state: WorldState): void {
  const interval = Math.max(1, Math.round(DIFFICULTY.spawnIntervalSeconds * TICK_RATE));
  if (state.tick % interval !== 0) {
    return;
  }

  const living = livingPlayers(state);
  if (living.length === 0) {
    return;
  }

  // Ist die Horde da (Timer eines Gebiets abgelaufen), sollen deutlich mehr
  // Gegner unterwegs sein - begrenzt bleibt es durch `LIMITS.maxEnemies`.
  const base = targetPopulation(state.zone, state.players.length);
  const target = state.horde
    ? Math.min(LIMITS.maxEnemies, Math.round(base * DIFFICULTY.hordeFactor))
    : base;
  const unterwegs = state.enemies.length + state.pendingSpawns.length;
  if (unterwegs >= target) {
    return;
  }

  // Um einen zufaellig gewaehlten lebenden Spieler herum - sonst bekaeme im
  // Koop immer derselbe den ganzen Druck ab.
  const player = living[Math.floor(nextRandom(state) * living.length) % living.length];
  if (!player) {
    return;
  }

  const position = findSpawnPoint(state, player.position);
  if (!position) {
    return;
  }

  const zone = zoneOf(state, position);

  state.pendingSpawns.push({
    type: pickType(state, zone),
    isBoss: false,
    atTick: state.tick + Math.round(DIFFICULTY.spawnWarningSeconds * TICK_RATE),
    position,
  });

  state.events.push({ type: "spawnWarning", x: position.x, y: position.y });
}

/** Faellige Gegner erscheinen lassen. */
function spawnDueEnemies(state: WorldState): void {
  for (let i = state.pendingSpawns.length - 1; i >= 0; i -= 1) {
    const order = state.pendingSpawns[i];
    if (!order || state.tick < order.atTick) {
      continue;
    }

    // Harte Obergrenze fuer die Handy-Leistung: lieber spaeter erscheinen
    // lassen, als die Bildrate einbrechen zu lassen. Bosse zaehlen nicht mit -
    // sonst blockierte eine volle Gegnerschar den Encounter.
    if (state.enemies.length >= enemyBudget(state)) {
      continue;
    }

    // Die Staerke haengt am Erscheinungsort, nicht an der Zone des Teams.
    const scaling = zoneScaling(zoneOf(state, order.position));

    state.enemies.push(
      createEnemy(
        state.nextEnemyId++,
        order.type,
        order.position,
        scaling.health,
        scaling.damage,
        order.isBoss,
      ),
    );
    state.pendingSpawns.splice(i, 1);
  }
}

/**
 * Der Timer eines Knoten-Gebiets. Laeuft er ab, kommt die Horde - einmal, mit
 * Ereignis fuer Ansage und Ton. Verloren ist damit nichts: Wer schnell zum
 * Ausgang laeuft, kommt noch raus.
 */
function stepNodeTimer(state: WorldState, dt: number): void {
  if (state.nodeTimer === undefined || state.horde) {
    return;
  }
  state.nodeTimer = Math.max(0, state.nodeTimer - dt);
  if (state.nodeTimer <= 0) {
    state.horde = true;
    state.events.push({ type: "hordeStarted" });
  }
}
