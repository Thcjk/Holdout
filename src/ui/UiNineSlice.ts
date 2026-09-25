/**
 * Neuner- und Dreierteilung fuer die Grafiken aus dem UI-Paket.
 *
 * Warum selbst gebaut: Phasers `NineSlice` zeichnet nur mit WebGL, die
 * Oberflaeche laeuft in der 3D-Ansicht aber auf dem Canvas-Renderer (siehe
 * `config/ui.ts`). Nachgebaut ist es klein: neun gewoehnliche Bilder in einem
 * Container, jedes zeigt ein Stueck des Originals.
 *
 * Die Stuecke werden EINMAL je Grafik als eigene Frames in der Textur
 * angelegt (`texture.add`) - danach ist jedes Stueck ein normales Bild, das
 * Phaser wie jedes andere zeichnet. Kein Umkopieren, keine neue Textur.
 */

import Phaser from "phaser";
import { UI, UI_ATLAS } from "../config/ui";
import type { BarLook, SliceInsets } from "../config/ui";

/**
 * Legt die neun Teilstuecke einer Grafik als Frames an (nur beim ersten
 * Mal) und gibt ihre Namen zurueck - Reihenfolge zeilenweise von oben links.
 */
function sliceFrames(scene: Phaser.Scene, frameName: string, slice: SliceInsets): string[] {
  const texture = scene.textures.get(UI_ATLAS);
  const base = texture.get(frameName);
  const xs = [0, slice.left, base.cutWidth - slice.right, base.cutWidth];
  const ys = [0, slice.top, base.cutHeight - slice.bottom, base.cutHeight];
  const names: string[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const name = `${frameName}#${slice.left},${slice.top},${slice.right},${slice.bottom}#${row}${column}`;
      if (!texture.has(name)) {
        texture.add(
          name,
          base.sourceIndex,
          base.cutX + (xs[column] as number),
          base.cutY + (ys[row] as number),
          (xs[column + 1] as number) - (xs[column] as number),
          (ys[row + 1] as number) - (ys[row] as number),
        );
      }
      names.push(name);
    }
  }
  return names;
}

/** Ein Rahmen aus neun Stuecken, beliebig gross, Ecken unverzerrt. */
export class UiNineSlice {
  readonly container: Phaser.GameObjects.Container;
  private readonly parts: Phaser.GameObjects.Image[] = [];
  private slice: SliceInsets;
  private width: number;
  private height: number;

  /**
   * @param x, y  Mittelpunkt (wie bei `add.rectangle`).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    frame: string,
    slice: SliceInsets,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    this.slice = slice;
    this.width = width;
    this.height = height;
    for (let i = 0; i < 9; i += 1) {
      this.parts.push(scene.add.image(0, 0, UI_ATLAS).setOrigin(0));
    }
    this.container = scene.add.container(x, y, this.parts);
    this.setFrame(frame, slice);
  }

  /** Wechselt das Bild - etwa auf die gedrueckte Fassung eines Knopfs. */
  setFrame(frame: string, slice: SliceInsets): this {
    this.slice = slice;
    const names = sliceFrames(this.scene, frame, slice);
    this.parts.forEach((part, index) => part.setFrame(names[index] as string));
    this.layout();
    return this;
  }

  setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    this.layout();
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

  /**
   * Stuecke setzen. Ist das Ziel kleiner als die beiden Raender zusammen,
   * werden die Raender gemeinsam verkleinert - sonst ueberlappten sie.
   */
  private layout(): void {
    const { left, right, top, bottom } = this.slice;
    const k = Math.min(1, this.width / (left + right), this.height / (top + bottom));
    const xs = [0, left * k, this.width - right * k, this.width];
    const ys = [0, top * k, this.height - bottom * k, this.height];
    const originX = -this.width / 2;
    const originY = -this.height / 2;
    this.parts.forEach((part, index) => {
      const row = Math.floor(index / 3);
      const column = index % 3;
      const w = (xs[column + 1] as number) - (xs[column] as number);
      const h = (ys[row + 1] as number) - (ys[row] as number);
      part.setPosition(originX + (xs[column] as number), originY + (ys[row] as number));
      part.setDisplaySize(Math.max(0, w), Math.max(0, h));
      part.setVisible(w > 0 && h > 0);
    });
  }
}

/**
 * Ein Balken aus dem Paket: Hintergrund plus Fuellung, je drei Stuecke
 * (Endstueck, Mitte, Endstueck). Die Hoehe wird gestreckt, die Endstuecke
 * behalten ihr Seitenverhaeltnis.
 */
export class UiBar {
  readonly container: Phaser.GameObjects.Container;
  private readonly back: Phaser.GameObjects.Image[];
  private readonly fill: Phaser.GameObjects.Image[];
  private fraction = 1;

  /** @param x, y  linke obere Ecke. */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private width: number,
    private height: number,
    look: BarLook,
  ) {
    this.back = this.pieces(scene, UI.bar.back);
    this.fill = this.pieces(scene, look);
    this.container = scene.add.container(x, y, [...this.back, ...this.fill]);
    this.layout();
  }

  /** Fuellstand 0 bis 1. Nur bei einer Aenderung wird neu gesetzt. */
  setFraction(fraction: number): this {
    const clamped = Math.max(0, Math.min(1, fraction));
    if (Math.abs(clamped - this.fraction) > 0.001) {
      this.fraction = clamped;
      this.layout();
    }
    return this;
  }

  /** Andere Farbe - etwa rot, wenn das Leben knapp wird. */
  setLook(look: BarLook): this {
    if (this.fill[0]?.frame.name !== look.left) {
      this.fill[0]?.setFrame(look.left);
      this.fill[1]?.setFrame(look.mid);
      this.fill[2]?.setFrame(look.right);
      this.layout();
    }
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

  destroy(): void {
    this.container.destroy();
  }

  private pieces(scene: Phaser.Scene, look: BarLook): Phaser.GameObjects.Image[] {
    return [look.left, look.mid, look.right].map((frame) =>
      scene.add.image(0, 0, UI_ATLAS, frame).setOrigin(0),
    );
  }

  private layout(): void {
    this.place(this.back, this.width);
    this.place(this.fill, this.width * this.fraction);
  }

  /** Drei Stuecke auf `width` verteilen; zu schmal -> Endstuecke schrumpfen. */
  private place(images: Phaser.GameObjects.Image[], width: number): void {
    const [left, mid, right] = images as [
      Phaser.GameObjects.Image,
      Phaser.GameObjects.Image,
      Phaser.GameObjects.Image,
    ];
    const visible = width >= 1;
    for (const image of images) image.setVisible(visible);
    if (!visible) {
      return;
    }
    // Endstuecke im Seitenverhaeltnis des Bildes, aber nie breiter als die
    // Haelfte - ein fast leerer Balken besteht nur noch aus zwei Kappen.
    const cap = Math.min((UI.bar.capWidth * this.height) / UI.bar.height, width / 2);
    left.setPosition(0, 0).setDisplaySize(cap, this.height);
    mid.setPosition(cap, 0).setDisplaySize(Math.max(0, width - 2 * cap), this.height);
    mid.setVisible(width - 2 * cap > 0);
    right.setPosition(width - cap, 0).setDisplaySize(cap, this.height);
  }
}
