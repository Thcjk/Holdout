/**
 * Ein virtueller Joystick, der dort erscheint, wo der Daumen den Bildschirm
 * beruehrt - nicht an fester Position.
 *
 * Das ist laut Briefing der Unterschied zwischen "geht" und "fuehlt sich gut an":
 * Ein fester Joystick zwingt den Daumen an eine Stelle, die er auf einem grossen
 * Handy nicht bequem erreicht.
 */

import Phaser from "phaser";
import { COLORS, DEPTH, TOUCH } from "../config/constants";
import type { Vec2 } from "../systems/types";

export class VirtualJoystick {
  /** Zeiger-ID des Fingers, der diesen Stick gerade haelt. */
  private pointerId: number | null = null;
  private origin: Vec2 = { x: 0, y: 0 };
  private current: Vec2 = { x: 0, y: 0 };
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    private readonly color: number,
  ) {
    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(DEPTH.hud);
    this.graphics.setVisible(false);
  }

  get isActive(): boolean {
    return this.pointerId !== null;
  }

  get ownedPointer(): number | null {
    return this.pointerId;
  }

  /** Zugstrecke in Bildschirmpixeln - unterscheidet Tippen von Ziehen. */
  get dragDistance(): number {
    return Math.hypot(this.current.x - this.origin.x, this.current.y - this.origin.y);
  }

  /**
   * Ausschlag als Vektor der Laenge 0 bis 1.
   * Innerhalb der toten Zone ist er exakt 0, damit ein zitternder Daumen die
   * Figur nicht ruckeln laesst.
   */
  get vector(): Vec2 {
    if (this.pointerId === null) {
      return { x: 0, y: 0 };
    }

    const dx = this.current.x - this.origin.x;
    const dy = this.current.y - this.origin.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= TOUCH.deadZone) {
      return { x: 0, y: 0 };
    }

    // Ausschlag zwischen toter Zone und Stickradius auf 0 bis 1 abbilden.
    const usable = Math.min(distance, TOUCH.stickRadius) - TOUCH.deadZone;
    const span = TOUCH.stickRadius - TOUCH.deadZone;
    const strength = usable / span;

    return { x: (dx / distance) * strength, y: (dy / distance) * strength };
  }

  claim(pointerId: number, x: number, y: number): void {
    this.pointerId = pointerId;
    this.origin = { x, y };
    this.current = { x, y };
    this.draw();
  }

  move(x: number, y: number): void {
    if (this.pointerId === null) {
      return;
    }
    this.current = { x, y };
    this.draw();
  }

  release(): void {
    this.pointerId = null;
    this.graphics.setVisible(false);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private draw(): void {
    const dx = this.current.x - this.origin.x;
    const dy = this.current.y - this.origin.y;
    const distance = Math.hypot(dx, dy);
    // Der Knopf bleibt innerhalb des Rings, auch wenn der Finger weiter zieht.
    const clamped = Math.min(distance, TOUCH.stickRadius);
    const angle = Math.atan2(dy, dx);

    this.graphics.clear();
    this.graphics.setVisible(true);
    this.graphics.lineStyle(3, this.color, 0.35);
    this.graphics.strokeCircle(this.origin.x, this.origin.y, TOUCH.stickRadius);
    this.graphics.fillStyle(this.color, 0.1);
    this.graphics.fillCircle(this.origin.x, this.origin.y, TOUCH.stickRadius);
    this.graphics.fillStyle(this.color, 0.55);
    this.graphics.fillCircle(
      this.origin.x + Math.cos(angle) * clamped,
      this.origin.y + Math.sin(angle) * clamped,
      TOUCH.knobRadius,
    );
    this.graphics.lineStyle(2, COLORS.playerOutline, 0.7);
    this.graphics.strokeCircle(
      this.origin.x + Math.cos(angle) * clamped,
      this.origin.y + Math.sin(angle) * clamped,
      TOUCH.knobRadius,
    );
  }
}
