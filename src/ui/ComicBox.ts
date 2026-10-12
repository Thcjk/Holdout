/**
 * Eine gezeichnete Flaeche im Poster-Stil: Papierblaetter, Einlagen und Knoepfe.
 *
 * Statt glatter Rechtecke mit Glanzstreifen: Papier mit einem leicht
 * wackelnden Tuscherand, der zweimal nachgezogen ist (wie eine Skizze), und
 * ein weicher Schatten darunter. Knoepfe sind Stempel in Rost oder
 * Papierschilder mit Tuscherand.
 */

import Phaser from "phaser";
import { INK, PAPER, PAPER_DARK, RUST, wobblyRect } from "./paper";

export interface BoxStyle {
  fill: number;
  /** Dicke des Tuscherands. */
  border: number;
  /** Versatz des Schattens nach unten; 0 = keiner. */
  shadow: number;
  radius: number;
  /** Zweite, duennere Linie daneben - sieht skizziert aus. */
  sketch: boolean;
}

export const BOX = {
  /** Ein Papierblatt. */
  panel: { fill: PAPER, border: 2.4, shadow: 5, radius: 5, sketch: true } satisfies BoxStyle,
  /** Etwas dunkleres Papier fuer eingelegte Felder. */
  inset: { fill: PAPER_DARK, border: 1.6, shadow: 0, radius: 4, sketch: false } satisfies BoxStyle,
  /** Hauptknopf: ein Stempel in Rost. */
  primary: { fill: RUST, border: 2.4, shadow: 3, radius: 7, sketch: true } satisfies BoxStyle,
  /** Nebenknopf: ein Papierschild. */
  secondary: { fill: PAPER, border: 2.2, shadow: 3, radius: 7, sketch: true } satisfies BoxStyle,
} as const;

export class ComicBox {
  readonly container: Phaser.GameObjects.Container;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly seed = Math.floor(Math.random() * 1e9);
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

  /** Gedrueckt: Das Schild sinkt auf seinen Schatten. */
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
    const dy = this.pressed ? Math.min(2, style.shadow) : 0;
    const left = -w / 2;
    const top = -h / 2 + dy;

    g.clear();
    if (style.shadow > 0 && !this.pressed) {
      g.fillStyle(INK, 0.22);
      g.fillPoints(wobblyRect(left + 2, top + style.shadow, w, h, style.radius, this.seed + 7, 1.2), true);
    }
    const outline = wobblyRect(left, top, w, h, style.radius, this.seed, 1.2);
    g.fillStyle(style.fill, 1);
    g.fillPoints(outline, true);
    g.lineStyle(style.border, INK, 1);
    g.strokePoints(outline, true);
    if (style.sketch) {
      g.lineStyle(Math.max(1, style.border * 0.45), INK, 0.55);
      g.strokePoints(wobblyRect(left + 1.5, top - 1, w - 2, h + 1, style.radius, this.seed + 3, 1.8), true);
    }
  }
}
