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

const INK = 0x14101c;

export const BOX = {
  /** Grosse Tafel: dunkles Violett. */
  panel: { fill: 0x3a2670, shade: 0x2a1a55, light: 0x5d41a8, radius: 16, border: 4, shadow: 6 } satisfies BoxStyle,
  /** Beige Einlage fuer alles, was man lesen soll. */
  inset: { fill: 0xfff1cf, shade: 0xecd29c, light: 0xffffff, radius: 11, border: 3, shadow: 0 } satisfies BoxStyle,
  /** Hauptknopf: leuchtendes Gelb-Orange. */
  primary: { fill: 0xffc21f, shade: 0xe8860a, light: 0xfff0a0, radius: 14, border: 4, shadow: 5 } satisfies BoxStyle,
  /** Nebenknopf: Violett. */
  secondary: { fill: 0x8a5cff, shade: 0x5b34c9, light: 0xc3a8ff, radius: 14, border: 4, shadow: 5 } satisfies BoxStyle,
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
    g.fillStyle(style.light, 0.55).fillRoundedRect(left + b + 4, top + b + dy + 3, iw - 8, lightH, Math.min(ir, lightH / 2));
  }
}
