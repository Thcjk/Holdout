/**
 * Der Weltzustand und sein Fortschreiten um genau einen Tick.
 *
 * Das ist das Herz der Architektur-Grundregel: Alles, was passiert, passiert hier
 * auf reinen Datenobjekten. Die Szene liest diesen Zustand nur aus und zeichnet ihn.
 */

import { ARENA_BOUNDS, SPAWN_POINT, createArenaWalls } from "../config/arena";
import { PLAYER } from "../config/balance";
import { stepPlayerMovement } from "./movement";
import { emptyInput } from "./types";
import type { InputState, PlayerState, WorldState } from "./types";

/**
 * Startpositionen leicht versetzt, damit mehrere Spieler nicht uebereinander
 * stehen. Ab Phase 6 kommen die Mitspieler ueber das Netzwerk dazu.
 */
function spawnPosition(index: number): { x: number; y: number } {
  const offset = 60;
  const angle = (index / 4) * Math.PI * 2;
  return {
    x: SPAWN_POINT.x + Math.cos(angle) * offset * (index === 0 ? 0 : 1),
    y: SPAWN_POINT.y + Math.sin(angle) * offset * (index === 0 ? 0 : 1),
  };
}

export function createPlayer(id: string, index: number): PlayerState {
  const position = spawnPosition(index);
  return {
    id,
    position: { x: position.x, y: position.y },
    velocity: { x: 0, y: 0 },
    radius: PLAYER.radius,
  };
}

export function createWorld(playerIds: readonly string[]): WorldState {
  return {
    tick: 0,
    players: playerIds.map((id, index) => createPlayer(id, index)),
    walls: createArenaWalls(),
    bounds: { ...ARENA_BOUNDS },
  };
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
  for (const player of state.players) {
    const input = inputs.get(player.id) ?? emptyInput();
    stepPlayerMovement(player, input, state.walls, dt);
  }

  state.tick += 1;
}
