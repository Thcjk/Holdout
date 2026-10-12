/**
 * Der schwebende Daumen-Stick: Wo der Daumen aufsetzt, entsteht der Stick.
 *
 * Brotato kennt nur Bewegung - geschossen wird von selbst. Deshalb gibt es
 * genau EINEN Stick und keine Knoepfe. Er haengt nicht an einer festen Stelle,
 * sondern erscheint dort, wo der Daumen den Bildschirm beruehrt (in der linken
 * Bildschirmhaelfte). So muss man nie hinschauen, um ihn zu treffen.
 *
 * Eine Beruehrung, die auf einem Knopf landet (Pause), startet den Stick nicht -
 * sonst liefe die Figur beim Antippen des Knopfs los.
 */

import Phaser from "phaser";
import type { PlayerInput } from "../game/types";

const RADIUS = 58;
const DEAD_ZONE = 6;
const DEPTH = 9400;

export class FloatingStick {
  enabled = true;

  private readonly base: Phaser.GameObjects.Arc;
  private readonly knob: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private mx = 0;
  private my = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly region: Phaser.Geom.Rectangle,
  ) {
    this.base = scene.add.circle(0, 0, RADIUS, 0xffffff, 0.14).setStrokeStyle(3, 0xffffff, 0.35).setDepth(DEPTH);
    this.knob = scene.add.circle(0, 0, 26, 0xffffff, 0.4).setDepth(DEPTH + 1);
    this.base.setVisible(false);
    this.knob.setVisible(false);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  get value(): PlayerInput {
    return this.enabled ? { mx: this.mx, my: this.my } : { mx: 0, my: 0 };
  }

  /** Stick sofort loslassen (z. B. wenn der Shop aufgeht). */
  release(): void {
    this.pointerId = null;
    this.mx = 0;
    this.my = 0;
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.base.destroy();
    this.knob.destroy();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || this.pointerId !== null) {
      return;
    }
    if (!this.region.contains(pointer.x, pointer.y)) {
      return;
    }
    if (this.scene.input.hitTestPointer(pointer).length > 0) {
      return;
    }
    this.pointerId = pointer.id;
    this.originX = pointer.x;
    this.originY = pointer.y;
    this.base.setPosition(pointer.x, pointer.y).setVisible(true);
    this.knob.setPosition(pointer.x, pointer.y).setVisible(true);
    this.mx = 0;
    this.my = 0;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) {
      return;
    }
    const dx = pointer.x - this.originX;
    const dy = pointer.y - this.originY;
    const distance = Math.hypot(dx, dy);
    if (distance < DEAD_ZONE) {
      this.mx = 0;
      this.my = 0;
      this.knob.setPosition(this.originX, this.originY);
      return;
    }
    const clamped = Math.min(distance, RADIUS);
    const nx = dx / distance;
    const ny = dy / distance;
    this.mx = nx * (clamped / RADIUS);
    this.my = ny * (clamped / RADIUS);
    this.knob.setPosition(this.originX + nx * clamped, this.originY + ny * clamped);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.pointerId) {
      this.release();
    }
  }
}
