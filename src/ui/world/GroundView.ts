/**
 * Der Boden: eine nahtlos kachelnde Wuestentextur, die mit der Kamera mitzieht,
 * dazu Fussabdruecke der Festung, die zurueckbleiben.
 */

import type Phaser from "phaser";
import { VIEWPORT } from "../../config/constants";
import { TEX, ensureGround } from "../pixel/textures";
import { DEPTH } from "./view";

export class GroundView {
  private readonly tile: Phaser.GameObjects.TileSprite;
  private readonly prints: Phaser.GameObjects.Image[] = [];
  private act = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.tile = scene.add
      .tileSprite(0, 0, VIEWPORT.width, VIEWPORT.height, ensureGround(scene, 0))
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.ground);
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, act = 0): void {
    if (act !== this.act) {
      // Neuer Akt, neuer Boden (wird beim ersten Mal gemalt).
      this.act = act;
      this.tile.setTexture(ensureGround(this.scene, act));
    }
    this.tile.setSize(VIEWPORT.width, VIEWPORT.height);
    this.tile.tilePositionX = camera.scrollX;
    // Abdruecke weit hinter dem Bild wegraeumen
    const left = camera.scrollX - 200;
    for (let i = this.prints.length - 1; i >= 0; i -= 1) {
      const print = this.prints[i]!;
      if (print.x < left) {
        print.destroy();
        this.prints.splice(i, 1);
      }
    }
  }

  /** Ein Fuss hat aufgesetzt: Abdruck hinterlassen. */
  addPrint(x: number, y: number): void {
    const print = this.scene.add
      .image(Math.round(x), Math.round(y), TEX.footprint)
      .setDepth(DEPTH.prints);
    this.prints.push(print);
  }

  destroy(): void {
    this.tile.destroy();
    for (const print of this.prints) {
      print.destroy();
    }
  }
}
