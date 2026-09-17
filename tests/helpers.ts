/** Kleine Hilfen, damit die Tests nicht staendig denselben Aufbau wiederholen. */

import type { InputState, Vec2 } from "../src/systems/types";
import type { PlayerSetup } from "../src/systems/world";

export function makeInput(move: Vec2, extra: Partial<InputState> = {}): InputState {
  return { move, aim: null, fire: false, useSuper: false, ...extra };
}

export function soloSetup(id = "p1"): PlayerSetup[] {
  return [{ id, name: "Test", character: "scout" }];
}
