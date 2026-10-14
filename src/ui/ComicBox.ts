/**
 * Tafeln, Einlagen und Knoepfe (Pixel-Art): Bronze und Stein der Wueste,
 * feine Leuchtlinien der Mech-Technik.
 *
 * - Tafel: Rahmen aus Bronze mit abgeschraegten Ecken und Nieten, innen dunkler
 *   Stein, eine feine cyanfarbene Leuchtlinie laeuft innen am Rand entlang.
 * - Einlage: noch dunklerer Stein mit schmalem Rand - fuer Dinge zum Lesen.
 * - Hauptknopf: Goldplatte (oben hell, unten dunkel), dunkle Schrift.
 * - Nebenknopf: Mech-Technik in dunklem Blau mit cyanfarbener Lichtkante.
 * Alle Kanten sind gerade, die Ecken schraeg abgeschnitten - wie Pixel-Art.
 *
 * (Der Klassenname stammt aus der Comic-Fassung.)
 */

import Phaser from "phaser";
import { C } from "./theme";

export type BoxKind = "panel" | "inset" | "primary" | "secondary";

export interface BoxStyle {
  kind: BoxKind;
  /** Wie weit die Ecken abgeschraegt sind. */
  corner: number;
  /** Versatz des Schattens nach unten; 0 = keiner. */
  shadow: number;
}

export const BOX = {
  panel: { kind: "panel", corner: 6, shadow: 4 } satisfies BoxStyle,
  inset: { kind: "inset", corner: 3, shadow: 0 } satisfies BoxStyle,
  primary: { kind: "primary", corner: 5, shadow: 4 } satisfies BoxStyle,
  secondary: { kind: "secondary", corner: 5, shadow: 4 } satisfies BoxStyle,
} as const;

/** Rechteck mit abgeschraegten Ecken als Punktliste. */
function chamfer(x: number, y: number, w: number, h: number, c: number): Phaser.Math.Vector2[] {
  const k = Math.max(0, Math.min(c, w / 2, h / 2));
  return [
    new Phaser.Math.Vector2(x + k, y),
    new Phaser.Math.Vector2(x + w - k, y),
    new Phaser.Math.Vector2(x + w, y + k),
    new Phaser.Math.Vector2(x + w, y + h - k),
    new Phaser.Math.Vector2(x + w - k, y + h),
    new Phaser.Math.Vector2(x + k, y + h),
    new Phaser.Math.Vector2(x, y + h - k),
    new Phaser.Math.Vector2(x, y + k),
  ];
}

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
    const w = Math.round(this.width);
    const h = Math.round(this.height);
    const dy = this.pressed ? Math.min(3, style.shadow) : 0;
    const x = Math.round(-w / 2);
    const y = Math.round(-h / 2 + dy);
    const c = style.corner;

    g.clear();
    if (style.shadow > 0 && !this.pressed) {
      g.fillStyle(C.outline, 0.45).fillPoints(chamfer(x, y + style.shadow, w, h, c), true);
    }
    // Aeusserer Umriss
    g.fillStyle(C.outline, 1).fillPoints(chamfer(x, y, w, h, c), true);

    switch (style.kind) {
      case "panel": {
        // Bronzerahmen: oben/links hell, unten/rechts dunkel
        g.fillStyle(C.bronzeDark, 1).fillPoints(chamfer(x + 2, y + 2, w - 4, h - 4, c - 1), true);
        g.fillStyle(C.bronze, 1).fillPoints(chamfer(x + 2, y + 2, w - 6, h - 6, c - 1), true);
        g.fillStyle(C.bronzeLight, 1).fillRect(x + c + 1, y + 2, w - 2 * c - 2, 2);
        // Stein innen
        const f = 6;
        g.fillStyle(C.outline, 1).fillPoints(
          chamfer(x + f - 1, y + f - 1, w - 2 * f + 2, h - 2 * f + 2, c - 2),
          true,
        );
        g.fillStyle(C.stone, 1).fillPoints(
          chamfer(x + f, y + f, w - 2 * f, h - 2 * f, c - 2),
          true,
        );
        g.fillStyle(C.stoneMid, 1).fillRect(x + f + 2, y + f, w - 2 * f - 4, 2);
        // Feine Leuchtlinie innen (Technik der Crew)
        g.lineStyle(1, C.cyan, 0.4).strokePoints(
          chamfer(x + f + 3, y + f + 3, w - 2 * f - 6, h - 2 * f - 6, Math.max(1, c - 3)),
          true,
          true,
        );
        // Nieten in den Ecken
        if (w > 60 && h > 50) {
          for (const [nx, ny] of [
            [x + 3, y + 3],
            [x + w - 7, y + 3],
            [x + 3, y + h - 7],
            [x + w - 7, y + h - 7],
          ] as const) {
            g.fillStyle(C.outline, 1).fillRect(nx, ny, 4, 4);
            g.fillStyle(C.goldLight, 1).fillRect(nx + 1, ny + 1, 2, 2);
          }
        }
        break;
      }
      case "inset": {
        g.fillStyle(C.stoneLight, 1).fillPoints(chamfer(x + 1, y + 1, w - 2, h - 2, c - 1), true);
        g.fillStyle(C.inset, 1).fillPoints(chamfer(x + 2, y + 2, w - 4, h - 4, c - 1), true);
        g.fillStyle(C.outline, 0.5).fillRect(x + c, y + 2, w - 2 * c, 2);
        break;
      }
      case "primary": {
        g.fillStyle(C.goldDark, 1).fillPoints(chamfer(x + 2, y + 2, w - 4, h - 4, c - 1), true);
        g.fillStyle(C.gold, 1).fillPoints(chamfer(x + 2, y + 2, w - 4, h - 7, c - 1), true);
        g.fillStyle(C.goldLight, 1).fillRect(x + c + 1, y + 3, w - 2 * c - 2, 3);
        g.fillStyle(C.goldDark, 0.35).fillRect(x + c, y + h - 9, w - 2 * c, 2);
        break;
      }
      case "secondary": {
        g.fillStyle(C.techDark, 1).fillPoints(chamfer(x + 2, y + 2, w - 4, h - 4, c - 1), true);
        g.fillStyle(C.tech, 1).fillPoints(chamfer(x + 2, y + 2, w - 4, h - 7, c - 1), true);
        g.fillStyle(C.techLight, 1).fillRect(x + c + 1, y + 3, w - 2 * c - 2, 2);
        // Cyan-Lichtkante
        g.fillStyle(C.cyan, 0.85).fillRect(x + c + 3, y + h - 7, Math.max(4, w * 0.18), 2);
        g.fillStyle(C.cyan, 0.85).fillRect(x + w - c - 3 - 6, y + h - 7, 6, 2);
        break;
      }
    }
  }
}
