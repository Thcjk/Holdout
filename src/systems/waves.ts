/**
 * Wellen: wer wann wo erscheint, und der Ablauf einer Runde.
 *
 * Die Zahlen stammen alle aus `config/balance.ts`. Diese Datei rechnet nur damit -
 * so bleibt Balancing eine Sache von einer Datei, nicht von zehn.
 *
 * Ablauf: Vorbereitung -> Welle -> Pause -> Welle -> ... bis alle Spieler
 * gleichzeitig am Boden sind.
 */

import { SPAWN_ZONES } from "../config/arena";
import { LIMITS, PLAYER, SKILL_POINTS_PER_WAVE, WAVES } from "../config/balance";
import { TICK_RATE } from "../config/constants";
import { createEnemy } from "./enemies";
import { randomIndex, randomRange } from "./rng";
import type { EnemyType, SpawnOrder, WorldState } from "./types";

/**
 * Zusammensetzung einer Welle.
 *
 * `playerCount` geht mit 0,6 + 0,4 * Spielerzahl ein: Vier Spieler bekommen also
 * gut das Doppelte eines Einzelspielers, nicht das Vierfache - sonst waere eine
 * Welle zu viert in Sekunden zerlegt.
 */
export function waveComposition(
  wave: number,
  playerCount: number,
): { runners: number; shooters: number; brutes: number; boss: boolean } {
  const scale = WAVES.playerCountBase + WAVES.playerCountFactor * playerCount;

  const runners = Math.max(1, Math.round((WAVES.runnerBase + wave * WAVES.runnerPerWave) * scale));
  const shooters = wave >= WAVES.shooterFromWave ? Math.round(Math.floor(wave / 2) * scale) : 0;
  const brutes = wave >= WAVES.bruteFromWave ? Math.round(Math.floor(wave / 4) * scale) : 0;

  return {
    runners,
    shooters,
    brutes,
    boss: wave % WAVES.bossEveryWaves === 0,
  };
}

/** Lebens- und Schadensfaktor einer Welle. */
export function waveScaling(wave: number): { health: number; damage: number } {
  return {
    health: Math.pow(WAVES.healthGrowth, wave),
    damage: Math.pow(WAVES.damageGrowth, wave),
  };
}

/**
 * Baut die Spawnliste einer Welle: welcher Gegnertyp an welcher Stelle und in
 * welchem Tick erscheint. Die Gegner kommen nacheinander statt alle auf einmal -
 * ein Schwall von zwanzig Gegnern gleichzeitig ist unlesbar.
 */
export function buildWave(state: WorldState, wave: number): SpawnOrder[] {
  const composition = waveComposition(wave, state.players.length);
  const types: EnemyType[] = [];

  for (let i = 0; i < composition.runners; i += 1) types.push("runner");
  for (let i = 0; i < composition.shooters; i += 1) types.push("shooter");
  for (let i = 0; i < composition.brutes; i += 1) types.push("brute");

  // Durchmischen, damit nicht erst alle Laeufer und dann alle Brocken kommen.
  for (let i = types.length - 1; i > 0; i -= 1) {
    const j = randomIndex(state, i + 1);
    const a = types[i];
    const b = types[j];
    if (a !== undefined && b !== undefined) {
      types[i] = b;
      types[j] = a;
    }
  }

  const orders: SpawnOrder[] = [];
  const interval = Math.max(1, Math.round(WAVES.spawnIntervalSeconds * TICK_RATE));

  types.forEach((type, index) => {
    orders.push({
      type,
      isBoss: false,
      atTick: state.tick + WAVES.spawnWarningSeconds * TICK_RATE + index * interval,
      position: randomSpawnPoint(state),
    });
  });

  if (composition.boss) {
    orders.push({
      type: "brute",
      isBoss: true,
      atTick: state.tick + WAVES.spawnWarningSeconds * TICK_RATE + types.length * interval,
      position: randomSpawnPoint(state),
    });
  }

  return orders;
}

function randomSpawnPoint(state: WorldState): { x: number; y: number } {
  const zone = SPAWN_ZONES[randomIndex(state, SPAWN_ZONES.length)] ?? SPAWN_ZONES[0];
  if (!zone) {
    return { x: 800, y: 600 };
  }
  return {
    x: randomRange(state, zone.x, zone.x + zone.width),
    y: randomRange(state, zone.y, zone.y + zone.height),
  };
}

/** Beginnt eine Welle: Spawnliste bauen und die Phase umstellen. */
export function startWave(state: WorldState, wave: number): void {
  state.wave = wave;
  state.phase = "wave";
  state.phaseTime = 0;
  state.pendingSpawns = buildWave(state, wave);
  state.events.push({ type: "waveStart", wave });
}

/**
 * Der Ablauf einer Runde, ein Tick davon.
 *
 * Reihenfolge: erst pruefen, ob alle am Boden sind (dann ist Schluss), dann die
 * laufende Phase weiterdrehen.
 */
export function stepRound(state: WorldState, dt: number): void {
  if (state.phase === "gameover") {
    return;
  }

  if (state.players.length > 0 && state.players.every((player) => player.down)) {
    state.phase = "gameover";
    state.events.push({ type: "gameOver", score: state.score, wave: state.wave });
    return;
  }

  state.phaseTime -= dt;

  switch (state.phase) {
    case "preparing":
      if (state.phaseTime <= 0) {
        startWave(state, 1);
      }
      break;

    case "wave":
      spawnDueEnemies(state);
      if (state.pendingSpawns.length === 0 && state.enemies.length === 0) {
        startBreak(state);
      }
      break;

    case "break":
      if (state.phaseTime <= 0) {
        startWave(state, state.wave + 1);
      }
      break;
  }
}

/**
 * Die Pause zwischen zwei Wellen: heilen, Gefallene aufhelfen, durchatmen.
 *
 * Gefallene kommen hier zurueck, weil die Runde sonst zu zweit in einer Sackgasse
 * endet: Wer am Boden liegt und dessen Mitspieler gerade beschaeftigt ist, bliebe
 * bis zum Rundenende liegen.
 */
function startBreak(state: WorldState): void {
  state.phase = "break";
  state.phaseTime = WAVES.breakSeconds;

  for (const player of state.players) {
    // Ein Punkt pro geschaffter Welle - auch fuer Gefallene, sonst waere ein
    // schlechter Moment doppelt bestraft.
    player.skillPoints += SKILL_POINTS_PER_WAVE;

    if (player.down) {
      player.down = false;
      player.reviveProgress = 0;
      player.health = Math.round(player.maxHealth * 0.5);
      state.events.push({
        type: "playerRevived",
        playerId: player.id,
        x: player.position.x,
        y: player.position.y,
      });
      continue;
    }

    player.health = Math.min(
      player.maxHealth,
      player.health + Math.round(player.maxHealth * PLAYER.breakHealFraction),
    );
  }
}

/** Faellige Gegner erscheinen lassen - und eine Sekunde vorher warnen. */
function spawnDueEnemies(state: WorldState): void {
  const scaling = waveScaling(state.wave);
  const warnTicks = WAVES.spawnWarningSeconds * TICK_RATE;

  for (let i = state.pendingSpawns.length - 1; i >= 0; i -= 1) {
    const order = state.pendingSpawns[i];
    if (!order) {
      continue;
    }

    if (state.tick === order.atTick - warnTicks) {
      state.events.push({ type: "spawnWarning", x: order.position.x, y: order.position.y });
    }

    if (state.tick < order.atTick) {
      continue;
    }

    // Hartes Obergrenze fuer die Handy-Leistung: lieber spaeter erscheinen
    // lassen, als die Bildrate einbrechen zu lassen.
    if (state.enemies.length >= LIMITS.maxEnemies) {
      continue;
    }

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
