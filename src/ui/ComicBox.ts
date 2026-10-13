/**
 * Tafeln, Einlagen und Knoepfe im Chibi-Fantasy-Stil.
 *
 * - Tafel: Pergament in einem Holzrahmen mit goldenen Nieten in den Ecken.
 * - Einlage: etwas dunkleres Pergament mit feiner Kontur.
 * - Hauptknopf: Gold, oben heller, unten dunkler - wie ein Edelmetall-Schild.
 * - Nebenknopf: Schieferblau.
 * Alles mit dicker dunkler Kontur und einem weichen Schatten darunter.
 */

import Phaser from "phaser";
import { GOLD, INK, PAPER, PAPER_DARK, WOOD, WOOD_DARK } from "./paper";

export type BoxKind = "panel" | "inset" | "primary" | "secondary";

export interface BoxStyle {
  kind: BoxKind;
  radius: number;
  /** Versatz des Schattens nach unten; 0 = keiner. */
  shadow: number;
}

export const BOX = {
  panel: { kind: "panel", radius: 12, shadow: 6 } satisfies BoxStyle,
  inset: { kind: "inset", radius: 8, shadow: 0 } satisfies BoxStyle,
  primary: { kind: "primary", radius: 12, shadow: 4 } satisfies BoxStyle,
  secondary: { kind: "secondary", radius: 12, shadow: 4 } satisfies BoxStyle,
} as const;

/** Farben der Knoepfe: oben, Mitte, unten. */
const BUTTON_COLORS: Record<"primary" | "secondary", [number, number, number]> = {
  primary: [0xffd877, GOLD, 0xc9851f],
  secondary: [0x8aa0b8, 0x5d7590, 0x3f5268],
};

export class ComicBox {
  readonly container: Phaser.GameObjects.Container;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private pressed = false;

  /** @param x, y  Mittelpunkt (wie bei `add.rectangle`). */
  constructor(
    scene: Phaser.Scene,
    private readonly style: BoxStyle,
    x: number,
    y: number,
    private width: number,
    private height: number,
  ) {
    this.graphics = scene.add.graphics();
    this.container = scene.add.container(x, y, [this.graphics]);
    this.draw();
  }

  /** Gedrueckt: Der Knopf sinkt auf seinen Schatten. */
  setPressed(pressed: boolean): this {
    if (pressed !== this.pressed) {
      this.pressed = pressed;
      this.draw();
    }
    return this;
  }

  setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    this.draw();
    return this;
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(x, y);
    return this;
  }

  setDepth(depth: number): this {
    this.container.setDepth(depth);
    return this;
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  setAlpha(alpha: number): this {
    this.container.setAlpha(alpha);
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }

  private draw(): void {
    const g = this.graphics;
    const { style } = this;
    const w = this.width;
    const h = this.height;
    const dy = this.pressed ? Math.min(3, style.shadow) : 0;
    const x = -w / 2;
    const y = -h / 2 + dy;
    const r = Math.min(style.radius, w / 2, h / 2);

    g.clear();
    if (style.shadow > 0 && !this.pressed) {
      g.fillStyle(INK, 0.35).fillRoundedRect(x, y + style.shadow, w, h, r);
    }
    // Aeussere Kontur
    g.fillStyle(INK, 1).fillRoundedRect(x, y, w, h, r);

    switch (style.kind) {
      case "panel": {
        const b = 3;
        const frame = Math.min(9, Math.max(5, Math.min(w, h) * 0.06));
        g.fillStyle(WOOD, 1).fillRoundedRect(x + b, y + b, w - 2 * b, h - 2 * b, Math.max(2, r - b));
        // Holzmaserung: ein paar dunklere Linien im Rahmen
        g.lineStyle(1.2, WOOD_DARK, 0.6);
        g.lineBetween(x + r, y + b + 2, x + w - r, y + b + 2);
        g.lineBetween(x + r, y + h - b - 3, x + w - r, y + h - b - 3);
        const ix = x + b + frame;
        const iy = y + b + frame;
        const iw = w - 2 * (b + frame);
        const ih = h - 2 * (b + frame);
        g.fillStyle(INK, 1).fillRoundedRect(ix - 2, iy - 2, iw + 4, ih + 4, Math.max(2, r - frame));
        g.fillStyle(PAPER, 1).fillRoundedRect(ix, iy, iw, ih, Math.max(2, r - frame - 2));
        // innerer Schatten oben
        g.fillStyle(WOOD_DARK, 0.12).fillRect(ix + 4, iy + 1, iw - 8, 4);
        // goldene Nieten in den Ecken
        if (w > 60 && h > 60) {
          for (const [cx, cy] of [
            [x + b + frame / 2, y + b + frame / 2],
            [x + w - b - frame / 2, y + b + frame / 2],
            [x + b + frame / 2, y + h - b - frame / 2],
            [x + w - b - frame / 2, y + h - b - frame / 2],
          ] as const) {
            g.fillStyle(INK, 1).fillCircle(cx, cy, frame / 2 + 1.5);
            g.fillStyle(GOLD, 1).fillCircle(cx, cy, frame / 2);
            g.fillStyle(0xffffff, 0.5).fillCircle(cx - 1, cy - 1, frame / 5);
          }
        }
        break;
      }
      case "inset": {
        const b = 2;
        g.fillStyle(PAPER_DARK, 1).fillRoundedRect(x + b, y + b, w - 2 * b, h - 2 * b, Math.max(2, r - b));
        g.fillStyle(WOOD_DARK, 0.18).fillRoundedRect(x + b, y + b, w - 2 * b, 5, { tl: r - b, tr: r - b, bl: 0, br: 0 });
        break;
      }
      case "primary":
      case "secondary": {
        const [top, mid, bottom] = BUTTON_COLORS[style.kind];
        const b = 3;
        const iw = w - 2 * b;
        const ih = h - 2 * b;
        const ir = Math.max(2, r - b);
        g.fillStyle(bottom, 1).fillRoundedRect(x + b, y + b, iw, ih, ir);
        g.fillStyle(mid, 1).fillRoundedRect(x + b, y + b, iw, ih * 0.78, ir);
        g.fillStyle(top, 1).fillRoundedRect(x + b + 3, y + b + 2, iw - 6, Math.max(3, ih * 0.22), Math.min(ir, ih * 0.11));
        break;
      }
    }
  }
}
