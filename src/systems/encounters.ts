/**
 * Encounter und Extraktion - die beiden Enden eines Runs.
 *
 * Seit Phase 9 kann ein Run auch GUT ausgehen. Vorher gab es nur einen Ausgang:
 * alle am Boden. Jetzt sind es drei, und diese Datei bringt zwei davon:
 *
 *   EXTRAKTION      Das Team steht gemeinsam in einer Ausstiegszone und haelt
 *                   sie fuenf Sekunden. Der Run endet erfolgreich.
 *   ENDE-BOSS       Der grosse Waechter faellt. Der Run endet ebenfalls
 *                   erfolgreich, nur eine Stufe hoeher.
 *
 * ================================================================
 * WARUM DER BOSS ERST BEIM BETRETEN ENTSTEHT
 * ================================================================
 *
 * Naheliegend waere, alle Bosse beim Weltaufbau in `state.enemies` zu legen und
 * schlafen zu lassen. Das haette zwei stille Fehler ergeben:
 *
 *  1. `despawnDistant` raeumt Gegner weg, die weit hinter dem Team liegen -
 *     ein schlafender Boss am anderen Ende der Karte waere sofort verschwunden.
 *  2. Die Obergrenze von 40 Gegnern haette sich mit Schlaefern gefuellt, und
 *     vorne waere nichts mehr erschienen.
 *
 * Deshalb ist ein Encounter bis zum Betreten nur ein EINTRAG IN EINER LISTE.
 * Sichtbar ist er trotzdem: Die Darstellung zeichnet Ring und Sprite aus genau
 * diesem Eintrag - dasselbe Bild, das man danach bekaempft.
 */

import { ENCOUNTERS, LIMITS } from "../config/balance";
import { createEnemy } from "./enemies";
import { zoneScaling } from "./zones";
import type { EncounterSpot, PlayerState, Vec2, WorldState } from "./types";

/** Abstand zweier Punkte. */
function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Alle Spieler, die noch stehen. */
function standingPlayers(state: WorldState): PlayerState[] {
  return state.players.filter((player) => !player.down);
}

/** Ein Tick Encounter und Extraktion. */
export function stepEncounters(state: WorldState, dt: number): void {
  discoverExtractions(state);
  wakeEncounters(state);
  checkCleared(state);
  stepExtraction(state, dt);
}

/**
 * Merkt sich jeden Ausstieg, an dem jemand nah genug vorbeigekommen ist.
 *
 * ================================================================
 * WARUM DAS EIN EIGENER SCHRITT IST UND NICHT NUR ANZEIGE
 * ================================================================
 *
 * Zurueckgemeldet wurde "Extraktionspunkte sind schwer bis gar nicht zu
 * finden". Nachgemessen war es kein Fehler in der Erzeugung: Ueber 500
 * zufaellige Seeds entstehen jedes Mal genau sechs Zonen, keine einzige
 * fehlte. Das Problem war die Sichtbarkeit - eine Zone mit 220 px Radius, die
 * naechste 1200 px vom Start entfernt, bei einem Bild von damals 1169 px
 * Breite. Man musste praktisch darueberlaufen.
 *
 * Die Zone selbst groesser zu machen waere der falsche Hebel gewesen: Sie ist
 * der Ort, an dem das ganze Team gleichzeitig stehen muss, und diese Zahl ist
 * eine Spielentscheidung. Was gefehlt hat, war das WISSEN darueber, wo sie
 * liegt. Genau das hier ist dieses Wissen - und weil es im Koop fuer alle
 * gilt, gehoert es in die Simulation und nicht in die Darstellung.
 *
 * Einmal entdeckt, bleibt es entdeckt: Ein Kompass, der wieder vergisst,
 * waere schlimmer als keiner.
 */
function discoverExtractions(state: WorldState): void {
  const living = standingPlayers(state);
  if (living.length === 0) {
    return;
  }

  for (const zone of state.extractions) {
    if (zone.discovered) {
      continue;
    }
    if (living.some((player) => distance(player.position, zone.position) <= ENCOUNTERS.discoverRadius)) {
      zone.discovered = true;
      state.events.push({
        type: "extractionFound",
        x: zone.position.x,
        y: zone.position.y,
      });
    }
  }
}

/**
 * Weckt jeden Encounter, dessen Radius ein Spieler betreten hat.
 *
 * Erst beim Betreten, damit man nicht aus der Ferne angegriffen wird, waehrend
 * man noch gar nicht weiss, dass da etwas steht. Der Ring auf dem Boden ist die
 * Warnung; wer ihn ueberschreitet, hat sich entschieden.
 */
function wakeEncounters(state: WorldState): void {
  const living = standingPlayers(state);
  if (living.length === 0) {
    return;
  }

  state.encounters.forEach((spot, index) => {
    if (spot.status !== "sleeping") {
      return;
    }
    // Der Ende-Boss hat einen groesseren Ring - und weckt entsprechend weiter
    // aussen. Die Darstellung zeichnet denselben Faktor.
    const radius = ENCOUNTERS.triggerRadius * (spot.isFinal ? 1.35 : 1);
    if (!living.some((player) => distance(player.position, spot.position) <= radius)) {
      return;
    }

    spawnBoss(state, spot, index);
  });
}

/**
 * Erweckt den Boss eines Encounters.
 *
 * Er umgeht die Obergrenze von 40 Gegnern bewusst: Sie ist eine Zusage an die
 * Handy-Leistung fuer die LAUFENDE Gegnerschar. Ein einzelner Boss mehr reisst
 * sie nicht - ein Encounter, der stumm nicht startet, weil gerade vierzig
 * Laeufer unterwegs sind, waere dagegen ein Fehler, den niemand versteht.
 */
function spawnBoss(state: WorldState, spot: EncounterSpot, index: number): void {
  const scaling = zoneScaling(spot.zone);
  const enemy = createEnemy(
    state.nextEnemyId++,
    "boss",
    spot.position,
    scaling.health,
    scaling.damage,
    spot.isFinal,
  );
  enemy.encounterIndex = index;

  state.enemies.push(enemy);

  spot.status = "active";
  spot.enemyId = enemy.id;

  state.events.push({
    type: "encounterStarted",
    index,
    isFinal: spot.isFinal,
    x: spot.position.x,
    y: spot.position.y,
  });
}

/**
 * Sieht nach, ob der Boss eines laufenden Encounters gefallen ist.
 *
 * ABGELESEN STATT GEMELDET: Naheliegend waere, `killEnemy` Bescheid sagen zu
 * lassen. Das haette aber einen Import-Zyklus ergeben (combat -> encounters ->
 * enemies -> boss -> combat), und es haette nur EINEN Weg abgedeckt. So zaehlt,
 * was tatsaechlich der Fall ist: Ist der Gegner nicht mehr da, ist der
 * Encounter geschafft - egal, woran er gestorben ist.
 *
 * Kosten: ein Durchlauf ueber rund zehn Eintraege je Tick.
 */
function checkCleared(state: WorldState): void {
  state.encounters.forEach((spot, index) => {
    if (spot.status !== "active" || spot.enemyId === null) {
      return;
    }
    if (state.enemies.some((enemy) => enemy.id === spot.enemyId)) {
      return;
    }

    spot.status = "cleared";
    spot.enemyId = null;
    state.events.push({ type: "encounterCleared", index, isFinal: spot.isFinal });

    if (spot.isFinal) {
      // Der Ende-Boss beendet den Run sofort - das ist der beste Ausgang, den
      // es gibt, und man soll ihn nicht noch nach Hause tragen muessen.
      endRun(state, "bossDefeated");
    }
  });
}

/**
 * Der Countdown in einer Ausstiegszone.
 *
 * ALLE SPIELER MUESSEN DRIN STEHEN, auch die am Boden liegenden. Das ist eine
 * Entscheidung und keine Nachlaessigkeit: "Alle LEBENDEN" haette geheissen, dass
 * man einen Gefallenen einfach liegen lassen und gehen kann. So muss man ihn
 * erst aufheben - und genau das ist der Moment, um den es im Koop geht.
 *
 * Verlaesst jemand die Zone, faengt der Countdown von vorn an. Kein langsames
 * Zuruecklaufen: Ein Fortschritt, der sich halb haelt, waere schwer zu lesen -
 * man wuesste nie, wie lange es noch dauert.
 */
function stepExtraction(state: WorldState, dt: number): void {
  const index = zoneWithWholeTeam(state);

  if (index < 0) {
    state.extractionIndex = -1;
    state.extractionProgress = 0;
    return;
  }

  if (state.extractionIndex !== index) {
    state.extractionIndex = index;
    state.extractionProgress = 0;
  }

  state.extractionProgress += dt;

  if (state.extractionProgress >= ENCOUNTERS.extractionSeconds) {
    endRun(state, "extracted");
  }
}

/** In welcher Ausstiegszone steht das ganze Team? -1, wenn in keiner. */
function zoneWithWholeTeam(state: WorldState): number {
  if (state.players.length === 0) {
    return -1;
  }

  for (let i = 0; i < state.extractions.length; i += 1) {
    const zone = state.extractions[i];
    if (!zone) {
      continue;
    }
    if (state.players.every((player) => distance(player.position, zone.position) <= zone.radius)) {
      return i;
    }
  }

  return -1;
}

/** Beendet den Run mit diesem Ausgang. Mehrfach zu rufen ist harmlos. */
export function endRun(state: WorldState, outcome: WorldState["outcome"]): void {
  if (state.phase === "ended") {
    return;
  }

  state.phase = "ended";
  state.outcome = outcome;
  state.events.push({
    type: "runEnded",
    outcome: outcome ?? "wipe",
    score: state.score,
    zone: state.deepestZone,
  });
}

/** Nur fuer die Anzeige: Wie weit ist der Countdown, als Anteil von 0 bis 1? */
export function extractionFraction(state: WorldState): number {
  if (state.extractionIndex < 0) {
    return 0;
  }
  return Math.min(1, state.extractionProgress / ENCOUNTERS.extractionSeconds);
}

/** Wie viele Gegner darf es neben den Bossen noch geben? */
export function enemyBudget(state: WorldState): number {
  const bosses = state.enemies.filter((enemy) => enemy.type === "boss").length;
  return LIMITS.maxEnemies + bosses;
}
