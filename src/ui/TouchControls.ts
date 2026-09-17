/**
 * Twin-Stick-Steuerung fuer Touch: links laufen, rechts zielen und schiessen,
 * dazu der Super-Knopf rechts unten.
 *
 * Diese Klasse verteilt die Finger ("Zeiger") auf die drei Bedienelemente. Ohne
 * diese Verteilung wuerde ein zweiter Finger den ersten Joystick uebernehmen.
 */

import Phaser from "phaser";
import { COLORS, DEPTH, TOUCH, VIEWPORT } from "../config/constants";
import type { Vec2 } from "../systems/types";
import { VirtualJoystick } from "./VirtualJoystick";

export interface TouchOutput {
  move: Vec2;
  /** Zielrichtung, solange der rechte Daumen zieht. */
  aim: Vec2 | null;
  /** Zugstaerke rechts, 0 bis 1 - daraus entsteht die Reichweitenanzeige. */
  aimStrength: number;
  /** Wurde in diesem Bild ein Schuss ausgeloest? */
  fire: boolean;
  /** Wurde der Super ausgeloest? */
  useSuper: boolean;
  /** Ist gerade ueberhaupt ein Finger im Spiel? Steuert die Sichtbarkeit. */
  active: boolean;
}

export class TouchControls {
  private readonly moveStick: VirtualJoystick;
  private readonly aimStick: VirtualJoystick;
  private readonly superButton: Phaser.GameObjects.Graphics;
  private readonly superLabel: Phaser.GameObjects.Text;

  private superPointerId: number | null = null;
  private fireLatched = false;
  private superLatched = false;
  private used = false;
  private superReady = false;

  private readonly superCenter: Vec2;

  constructor(private readonly scene: Phaser.Scene) {
    this.moveStick = new VirtualJoystick(scene, COLORS.player);
    this.aimStick = new VirtualJoystick(scene, COLORS.playerBullet);

    this.superCenter = {
      x: VIEWPORT.width - TOUCH.superButtonRadius - TOUCH.superButtonMargin,
      y: VIEWPORT.height - TOUCH.superButtonRadius - TOUCH.superButtonMargin,
    };

    this.superButton = scene.add.graphics();
    this.superButton.setScrollFactor(0);
    this.superButton.setDepth(DEPTH.hud);
    this.superButton.setVisible(false);

    this.superLabel = scene.add.text(this.superCenter.x, this.superCenter.y, "SUPER", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: "#11161f",
      fontStyle: "bold",
    });
    this.superLabel.setOrigin(0.5);
    this.superLabel.setScrollFactor(0);
    this.superLabel.setDepth(DEPTH.hud);
    this.superLabel.setVisible(false);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  /** Der Super-Knopf ist ausgegraut, solange die Faehigkeit nicht geladen ist. */
  setSuperReady(ready: boolean): void {
    if (ready !== this.superReady) {
      this.superReady = ready;
      this.drawSuperButton();
    }
  }

  read(): TouchOutput {
    const aimVector = this.aimStick.vector;
    const aimLength = Math.hypot(aimVector.x, aimVector.y);

    const output: TouchOutput = {
      move: this.moveStick.vector,
      aim: aimLength > 1e-6 ? { x: aimVector.x / aimLength, y: aimVector.y / aimLength } : null,
      aimStrength: Math.min(1, aimLength),
      fire: this.fireLatched,
      useSuper: this.superLatched,
      active: this.used,
    };

    return output;
  }

  /** Einmalige Wuensche loeschen, sobald die Simulation sie verarbeitet hat. */
  clearOneShots(): void {
    this.fireLatched = false;
    this.superLatched = false;
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.moveStick.destroy();
    this.aimStick.destroy();
    this.superButton.destroy();
    this.superLabel.destroy();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) {
      return;
    }
    this.markUsed();

    if (this.hitsSuperButton(pointer.x, pointer.y)) {
      this.superPointerId = pointer.id;
      return;
    }

    if (pointer.x < VIEWPORT.width / 2) {
      if (!this.moveStick.isActive) {
        this.moveStick.claim(pointer.id, pointer.x, pointer.y);
      }
      return;
    }

    if (!this.aimStick.isActive) {
      this.aimStick.claim(pointer.id, pointer.x, pointer.y);
    }
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) {
      return;
    }
    if (this.moveStick.ownedPointer === pointer.id) {
      this.moveStick.move(pointer.x, pointer.y);
    } else if (this.aimStick.ownedPointer === pointer.id) {
      this.aimStick.move(pointer.x, pointer.y);
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) {
      return;
    }

    if (this.superPointerId === pointer.id) {
      this.superPointerId = null;
      if (this.superReady) {
        this.superLatched = true;
      }
      return;
    }

    if (this.moveStick.ownedPointer === pointer.id) {
      this.moveStick.release();
      return;
    }

    if (this.aimStick.ownedPointer === pointer.id) {
      // Ziehen und loslassen feuert in die gezogene Richtung. Nur antippen
      // feuert ebenfalls - dann sucht die Simulation selbst den naechsten Gegner.
      this.fireLatched = true;
      this.aimStick.release();
    }
  }

  private hitsSuperButton(x: number, y: number): boolean {
    const distance = Math.hypot(x - this.superCenter.x, y - this.superCenter.y);
    // Grosszuegiger Trefferbereich: Daumen sind ungenau.
    return distance <= TOUCH.superButtonRadius * 1.25;
  }

  private markUsed(): void {
    if (this.used) {
      return;
    }
    this.used = true;
    this.superButton.setVisible(true);
    this.superLabel.setVisible(true);
    this.drawSuperButton();
  }

  private drawSuperButton(): void {
    const fill = this.superReady ? COLORS.superReady : COLORS.playerDown;
    this.superButton.clear();
    this.superButton.fillStyle(fill, this.superReady ? 0.9 : 0.4);
    this.superButton.fillCircle(this.superCenter.x, this.superCenter.y, TOUCH.superButtonRadius);
    this.superButton.lineStyle(3, COLORS.playerOutline, this.superReady ? 0.9 : 0.35);
    this.superButton.strokeCircle(this.superCenter.x, this.superCenter.y, TOUCH.superButtonRadius);
    this.superLabel.setAlpha(this.superReady ? 1 : 0.45);
  }
}
