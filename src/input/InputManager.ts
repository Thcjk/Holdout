/**
 * Uebersetzt Geraete-Eingaben in den einheitlichen `InputState` der Simulation.
 *
 * Das ist die Schleuse zwischen Phaser und der Spiellogik: Nur hier wird gefragt,
 * welche Taste gedrueckt oder wo der Daumen ist. Die Simulation bekommt am Ende
 * nur Richtungsvektoren und weiss nicht, woher sie kommen - das ist die
 * Voraussetzung dafuer, dass ab Phase 6 auch das Netzwerk diese Rolle uebernehmen kann.
 */

import Phaser from "phaser";
import { normalizeInput } from "../systems/movement";
import type { InputState, Vec2 } from "../systems/types";
import { TouchControls } from "../ui/TouchControls";

type KeyGroup = Phaser.Input.Keyboard.Key[];

export class InputManager {
  private readonly touch: TouchControls;
  private keys: {
    up: KeyGroup;
    down: KeyGroup;
    left: KeyGroup;
    right: KeyGroup;
    superKey: Phaser.Input.Keyboard.Key;
  } | null = null;

  /** Einmalige Wuensche, die bis zum naechsten Simulationsschritt warten. */
  private mouseFireLatched = false;
  private keyboardSuperLatched = false;
  /** Zuletzt gemeldete Zielstaerke (fuer die Reichweitenanzeige). */
  private lastAimStrength = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    /**
     * Die Kamera des Spiels - nicht die dieser Szene. Das HUD laeuft in einer
     * eigenen Szene mit eigener Kamera; um aus der Mausposition auf dem
     * Bildschirm eine Position in der Spielwelt zu machen, braucht es die
     * Kamera, die die Welt zeichnet.
     */
    private readonly gameCamera: Phaser.Cameras.Scene2D.Camera,
  ) {
    this.touch = new TouchControls(scene);

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.keys = {
        up: [keyboard.addKey("W"), keyboard.addKey("UP")],
        down: [keyboard.addKey("S"), keyboard.addKey("DOWN")],
        left: [keyboard.addKey("A"), keyboard.addKey("LEFT")],
        right: [keyboard.addKey("D"), keyboard.addKey("RIGHT")],
        superKey: keyboard.addKey("SPACE"),
      };
    }

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
  }

  /** Ist der Super bereit? Faerbt den Touch-Knopf ein. */
  setSuperReady(ready: boolean): void {
    this.touch.setSuperReady(ready);
  }

  /**
   * Der aktuelle Eingabezustand.
   *
   * @param playerPosition Weltposition der eigenen Figur - noetig, um aus der
   *        Mausposition eine Zielrichtung zu machen.
   */
  getState(playerPosition: Vec2): InputState {
    const touchOutput = this.touch.read();

    let move = touchOutput.move;
    let aim = touchOutput.aim;
    let fire = touchOutput.fire;
    let useSuper = touchOutput.useSuper;
    this.lastAimStrength = touchOutput.aimStrength;

    // Tastatur und Maus laufen parallel weiter: Auf dem Desktop wird damit
    // entwickelt und getestet, und ein Handy mit Tastatur soll nicht stoeren.
    if (this.keys) {
      const keyboardMove = normalizeInput({
        x: axis(this.keys.left, this.keys.right),
        y: axis(this.keys.up, this.keys.down),
      });
      if (Math.hypot(keyboardMove.x, keyboardMove.y) > 1e-6) {
        move = keyboardMove;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.superKey)) {
        this.keyboardSuperLatched = true;
      }
    }

    const pointer = this.scene.input.activePointer;
    if (!aim && pointer && !pointer.wasTouch) {
      // Maus: Zielrichtung ist die Linie von der Figur zum Mauszeiger.
      const world = this.gameCamera.getWorldPoint(pointer.x, pointer.y);
      const dx = world.x - playerPosition.x;
      const dy = world.y - playerPosition.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 1e-6) {
        aim = { x: dx / distance, y: dy / distance };
        this.lastAimStrength = 1;
      }
    }

    fire = fire || this.mouseFireLatched;
    useSuper = useSuper || this.keyboardSuperLatched;

    return { move, aim, fire, useSuper };
  }

  /** Zugstaerke des Zielsticks, 0 bis 1 - fuer die Reichweitenanzeige. */
  get aimStrength(): number {
    return this.lastAimStrength;
  }

  /**
   * Einmalige Wuensche loeschen. Die Szene ruft das erst, wenn die Simulation
   * mindestens einen Tick gerechnet hat - sonst ginge ein Schuss verloren, der
   * zwischen zwei Ticks ausgeloest wurde.
   */
  clearOneShots(): void {
    this.mouseFireLatched = false;
    this.keyboardSuperLatched = false;
    this.touch.clearOneShots();
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.touch.destroy();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) {
      return;
    }
    if (pointer.rightButtonDown()) {
      this.keyboardSuperLatched = true;
      return;
    }
    this.mouseFireLatched = true;
  }
}

function isDown(keys: KeyGroup): boolean {
  return keys.some((key) => key.isDown);
}

function axis(negative: KeyGroup, positive: KeyGroup): number {
  return (isDown(positive) ? 1 : 0) - (isDown(negative) ? 1 : 0);
}
