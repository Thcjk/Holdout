/**
 * Eine gezeichnete Comic-Flaeche: Tafeln, Einlagen und Knoepfe.
 *
 * Ersetzt die Holz-Grafiken aus dem UI-Paket. Jede Flaeche hat eine dicke
 * schwarze Kontur, eine flache Farbe, einen Schattenstreifen unten, einen
 * hellen Glanzstreifen oben und einen harten Versatzschatten - wie ein
 * Sprechblasen-Kaestchen im Comic. Gezeichnet wird mit einer Graphics-Ebene,
 * das funktioniert mit jedem Renderer und in jeder Groesse ohne Verzerrung.
 */

import Phaser from "phaser";

export interface BoxStyle {
  fill: number;
  /** Streifen unten (dunkler). */
  shade: number;
  /** Streifen oben (heller). */
  light: number;
  radius: number;
  border: number;
  /** Versatz des harten Schattens; 0 = keiner. */
  shadow: number;
}

const INK = 0x0a0910;

export const BOX = {
  /** Grosse Tafel: dunkler Stahl. */
  panel: { fill: 0x2a3040, shade: 0x1b1f2b, light: 0x5b667c, radius: 6, border: 3, shadow: 5 } satisfies BoxStyle,
  /** Helles Papier fuer alles, was man lesen soll. */
  inset: { fill: 0xe9e4d4, shade: 0xb9b19b, light: 0xffffff, radius: 4, border: 3, shadow: 0 } satisfies BoxStyle,
  /** Hauptknopf: Blutrot. */
  primary: { fill: 0xc4262e, shade: 0x7c1219, light: 0xff7a80, radius: 5, border: 3, shadow: 4 } satisfies BoxStyle,
  /** Nebenknopf: Stahlgrau. */
  secondary: { fill: 0x3d4658, shade: 0x2a3040, light: 0x8d98ae, radius: 5, border: 3, shadow: 4 } satisfies BoxStyle,
} as const;

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

  /** Gedrueckt: Der Knopf sinkt auf seinen Schatten, der Schatten verschwindet. */
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
    const left = -w / 2;
    const top = -h / 2;
    const dy = this.pressed ? Math.min(3, style.shadow) : 0;
    const r = Math.min(style.radius, h / 2, w / 2);
    const b = style.border;

    g.clear();
    if (style.shadow > 0 && !this.pressed) {
      g.fillStyle(INK, 0.5).fillRoundedRect(left + style.shadow * 0.4, top + style.shadow, w, h, r);
    }
    // Kontur, dann Flaeche.
    g.fillStyle(INK, 1).fillRoundedRect(left, top + dy, w, h, r);
    const iw = w - b * 2;
    const ih = h - b * 2;
    const ir = Math.max(2, r - b * 0.6);
    g.fillStyle(style.fill, 1).fillRoundedRect(left + b, top + b + dy, iw, ih, ir);
    // Schattenstreifen unten.
    const shadeH = Math.min(ih * 0.28, 16);
    g.fillStyle(style.shade, 1).fillRoundedRect(left + b, top + b + dy + ih - shadeH, iw, shadeH, { tl: 0, tr: 0, bl: ir, br: ir });
    // Glanzstreifen oben.
    const lightH = Math.min(ih * 0.22, 9);
    g.fillStyle(style.light, 0.3).fillRoundedRect(left + b + 4, top + b + dy + 3, iw - 8, lightH, Math.min(ir, lightH / 2));
  }
}
