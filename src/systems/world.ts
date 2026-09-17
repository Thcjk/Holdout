/**
 * Der Weltzustand und sein Fortschreiten um genau einen Tick.
 *
 * Das ist das Herz der Architektur-Grundregel: Alles, was passiert, passiert hier
 * auf reinen Datenobjekten. Die Szene liest diesen Zustand nur aus und zeichnet ihn.
 *
 * Die Reihenfolge der Schritte ist bewusst gewaehlt: erst bewegen sich die
 * Spieler, dann schiessen sie, dann handeln die Gegner, dann fliegen die
 * Projektile. So trifft ein Schuss die Gegnerposition dieses Ticks und nicht die
 * des letzten.
 */

import { ARENA_BOUNDS, SPAWN_POINT, createArenaBushes, createArenaWalls } from "../config/arena";
import { CHARACTERS, PLAYER, WAVES } from "../config/balance";
import { stepReload, stepRevive, tryShoot } from "./combat";
import { stepEnemies } from "./enemies";
import { clampToArena, stepPlayerMovement } from "./movement";
import { stepProjectiles } from "./projectiles";
import { applyLevelUp, emptySkills } from "./skills";
import { stepDashDamage, trySuper } from "./supers";
import { stepRound } from "./waves";
import { emptyInput } from "./types";
import type { CharacterId, InputState, PlayerState, Vec2, WorldState } from "./types";

export interface PlayerSetup {
  id: string;
  name: string;
  character: CharacterId;
}

/**
 * Startpositionen im Kreis um die Mitte, damit mehrere Spieler nicht
 * uebereinander stehen.
 */
function spawnPosition(index: number, total: number): Vec2 {
  if (total <= 1) {
    return { x: SPAWN_POINT.x, y: SPAWN_POINT.y };
  }
  const angle = (index / total) * Math.PI * 2;
  const offset = 70;
  return {
    x: SPAWN_POINT.x + Math.cos(angle) * offset,
    y: SPAWN_POINT.y + Math.sin(angle) * offset,
  };
}

export function createPlayer(setup: PlayerSetup, index: number, total: number): PlayerState {
  const definition = CHARACTERS[setup.character];
  const position = spawnPosition(index, total);

  return {
    id: setup.id,
    name: setup.name,
    character: setup.character,
    position,
    velocity: { x: 0, y: 0 },
    radius: PLAYER.radius,
    facing: { x: 0, y: 1 },
    health: definition.health,
    maxHealth: definition.health,
    reloadTimers: new Array<number>(PLAYER.ammoCharges).fill(0),
    superCharge: 0,
    superWasReady: false,
    down: false,
    reviveProgress: 0,
    invulnerable: 0,
    dashTime: 0,
    dashDirection: { x: 0, y: 0 },
    dashHits: [],
    inBush: false,
    shootCooldown: 0,
    skillPoints: 0,
    skills: emptySkills(),
  };
}

export function createWorld(setups: readonly PlayerSetup[], seed = 1): WorldState {
  return {
    tick: 0,
    // Die Runde beginnt mit dem Countdown, nicht mitten im Gefecht.
    phase: "preparing",
    phaseTime: WAVES.preparationSeconds,
    wave: 0,
    score: 0,
    players: setups.map((setup, index) => createPlayer(setup, index, setups.length)),
    enemies: [],
    projectiles: [],
    pendingSpawns: [],
    walls: createArenaWalls(),
    bushes: createArenaBushes(),
    bounds: { ...ARENA_BOUNDS },
    events: [],
    rngState: seed | 0,
    nextEnemyId: 1,
    nextProjectileId: 1,
  };
}

/** Steht ein Punkt in einem der Buschfelder? */
export function isInBush(state: WorldState, position: Vec2): boolean {
  for (const bush of state.bushes) {
    if (
      position.x >= bush.x &&
      position.x <= bush.x + bush.width &&
      position.y >= bush.y &&
      position.y <= bush.y + bush.height
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Ein Simulationsschritt. `dt` ist immer derselbe feste Wert (TICK_SECONDS) -
 * das ist der ganze Punkt am festen Zeitschritt.
 */
export function stepWorld(
  state: WorldState,
  inputs: ReadonlyMap<string, InputState>,
  dt: number,
): void {
  // Ereignisse des vorherigen Ticks sind ausgewertet.
  state.events.length = 0;

  // Nach dem Rundenende steht die Welt still; nur der Tickzaehler laeuft weiter,
  // damit die Darstellung ihre Effekte zu Ende spielen kann.
  if (state.phase === "gameover") {
    state.tick += 1;
    return;
  }

  for (const player of state.players) {
    const input = inputs.get(player.id) ?? emptyInput();

    if (input.levelUp) {
      applyLevelUp(state, player, input.levelUp);
    }

    stepReload(player, dt);
    stepPlayerMovement(player, input, state.walls, dt);
    // Notbremse gegen das Durchschlagen der Aussenmauer bei hohem Tempo.
    clampToArena(player.position, player.radius, state.bounds);
    updateFacing(player, input);
    player.inBush = isInBush(state, player.position);
    trySuper(state, player, input);
    stepDashDamage(state, player);
    tryShoot(state, player, input);
  }

  stepEnemies(state, dt);
  stepProjectiles(state, dt);
  stepRevive(state, dt);
  stepRound(state, dt);

  state.tick += 1;
}

/**
 * Blickrichtung: Wer zielt, schaut dorthin. Wer nur laeuft, schaut in
 * Laufrichtung. Wer steht, behaelt die letzte Richtung - sonst wuerde die Figur
 * beim Stehenbleiben nach Norden schnappen.
 */
function updateFacing(player: PlayerState, input: InputState): void {
  if (input.aim) {
    const length = Math.hypot(input.aim.x, input.aim.y);
    if (length > 1e-6) {
      player.facing.x = input.aim.x / length;
      player.facing.y = input.aim.y / length;
      return;
    }
  }

  const moveLength = Math.hypot(input.move.x, input.move.y);
  if (moveLength > 1e-6) {
    player.facing.x = input.move.x / moveLength;
    player.facing.y = input.move.y / moveLength;
  }
}
