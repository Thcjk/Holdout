/**
 * Uebersetzt Geraete-Eingaben in den einheitlichen `InputState` der Simulation.
 *
 * Das ist die Schleuse zwischen Phaser und der Spiellogik: Nur hier wird gefragt,
 * welche Taste gedrueckt ist. Die Simulation bekommt am Ende nur einen
 * Richtungsvektor und weiss nicht, ob er von einer Tastatur, einem Daumen oder
 * (ab Phase 6) aus dem Netzwerk kommt.
 *
 * Phase 1: nur Tastatur. Der virtuelle Twin-Stick fuer Touch kommt in Phase 2 dazu.
 */

import Phaser from "phaser";
import { normalizeInput } from "../systems/movement";
import type { InputState } from "../systems/types";

type KeyMap = {
  up: Phaser.Input.Keyboard.Key[];
  down: Phaser.Input.Keyboard.Key[];
  left: Phaser.Input.Keyboard.Key[];
  right: Phaser.Input.Keyboard.Key[];
};

export class InputManager {
  private readonly keys: KeyMap | null;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;

    // Auf einem reinen Touch-Geraet gibt es kein Keyboard-Plugin.
    this.keys = keyboard
      ? {
          up: [keyboard.addKey("W"), keyboard.addKey("UP")],
          down: [keyboard.addKey("S"), keyboard.addKey("DOWN")],
          left: [keyboard.addKey("A"), keyboard.addKey("LEFT")],
          right: [keyboard.addKey("D"), keyboard.addKey("RIGHT")],
        }
      : null;
  }

  /** Der aktuelle Eingabezustand fuer den naechsten Simulationsschritt. */
  getState(): InputState {
    if (!this.keys) {
      return { move: { x: 0, y: 0 } };
    }

    const x = axis(this.keys.left, this.keys.right);
    const y = axis(this.keys.up, this.keys.down);

    // Normalisieren, damit diagonales Laufen nicht schneller ist als gerades.
    return { move: normalizeInput({ x, y }) };
  }
}

function isDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  return keys.some((key) => key.isDown);
}

function axis(
  negative: Phaser.Input.Keyboard.Key[],
  positive: Phaser.Input.Keyboard.Key[],
): number {
  return (isDown(positive) ? 1 : 0) - (isDown(negative) ? 1 : 0);
}
