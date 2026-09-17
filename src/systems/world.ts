/**
 * Der Weltzustand und sein Fortschreiten um genau einen Tick.
 *
 * Das ist das Herz der Architektur-Grundregel: Alles, was passiert, passiert hier
 * auf reinen Datenobjekten. Die Szene liest diesen Zustand nur aus und zeichnet ihn.
 */

import { ARENA_BOUNDS, SPAWN_POINT, createArenaBushes, createArenaWalls } from "../config/arena";
import { CHARACTERS, PLAYER } from "../config/balance";
import { stepPlayerMovement } from "./movement";
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
    inBush: false,
    shootCooldown: 0,
  };
}

export function createWorld(setups: readonly PlayerSetup[], seed = 1): WorldState {
  return {
    tick: 0,
    phase: "wave",
    phaseTime: 0,
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

  for (const player of state.players) {
    const input = inputs.get(player.id) ?? emptyInput();
    stepPlayerMovement(player, input, state.walls, dt);
    updateFacing(player, input);
    player.inBush = isInBush(state, player.position);
  }

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
