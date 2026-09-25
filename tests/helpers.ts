/** Kleine Hilfen, damit die Tests nicht staendig denselben Aufbau wiederholen. */

import { itemIndex } from "../src/config/items";
import type { InputState, PackedItem, Vec2 } from "../src/systems/types";
import type { PlayerSetup } from "../src/systems/world";

export function makeInput(move: Vec2, extra: Partial<InputState> = {}): InputState {
  return {
    move,
    aim: null,
    fire: false,
    useSuper: false,
    useAbility: false,
    abilityAim: null,
    inventory: null,
    shielded: false,
    ...extra,
  };
}

/**
 * Ein Rucksack mit genau einer ausgeruesteten Waffe.
 *
 * Seit der Waffen-Ausruestung schiesst nur, wer eine Waffe dabei hat - ohne
 * Rucksack gibt es die Faust. Die meisten Tests meinen "ein Spieler, der
 * schiessen kann", also bekommen sie die Starter-Pistole.
 */
export function armed(weapon = "pistol"): PackedItem[] {
  return [{ def: itemIndex(weapon), x: 0, y: 0, rotated: false, equipped: true }];
}

export function soloSetup(id = "p1"): PlayerSetup[] {
  return [{ id, name: "Test", character: "scout", backpack: armed() }];
}
