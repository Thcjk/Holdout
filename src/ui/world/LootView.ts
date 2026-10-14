/**
 * Ruinen und Sandsturm:
 *   - Truhen am Boden, mit einem Ring, der sich beim Oeffnen fuellt,
 *   - der Sandsturm als dichter Sand am Bildrand, nur um die Festung herum klar,
 *     dazu vorbeiwehende Sandschlieren.
 */

import type Phaser from "phaser";
import { VIEWPORT } from "../../config/constants";
import { DECK_H, DECK_W, ELEVATION } from "../../game/constants";
import type { GameState } from "../../game/types";
import { TEX } from "../pixel/textures";
import { DEPTH } from "./view";

export class LootView {
  private readonly chests = new Map<number, Phaser.GameObjects.Image>();
  private readonly rings: Phaser.GameObjects.Graphics;
  private readonly fog: Phaser.GameObjects.Image;
  private readonly streaks: Phaser.GameObjects.Graphics;
  private time = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.rings = scene.add.graphics().setDepth(DEPTH.effects - 2);
    this.fog = scene.add
      .image(0, 0, TEX.fog)
      .setScrollFactor(0)
      .setDepth(DEPTH.effects + 5)
      .setVisible(false);
    this.streaks = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTH.effects + 6);
  }

  sync(state: GameState, camera: Phaser.Cameras.Scene2D.Camera, deltaMs: number): void {
    this.time += deltaMs / 1000;
    this.syncChests(state);
    this.syncStorm(state, camera);
  }

  private syncChests(state: GameState): void {
    this.rings.clear();
    const seen = new Set<number>();
    for (const chest of state.chests) {
      seen.add(chest.id);
      let image = this.chests.get(chest.id);
      if (!image) {
        image = this.scene.add.image(chest.x, chest.y, TEX.chest).setOrigin(0.5, 0.9);
        this.chests.set(chest.id, image);
      }
      image.setTexture(chest.opened ? TEX.chestOpen : TEX.chest).setDepth(chest.y);
      if (!chest.opened) {
        // Leuchtet, damit man sie zwischen den Gegnern findet.
        const glow = 0.4 + Math.abs(Math.sin(this.time * 3 + chest.id)) * 0.5;
        this.rings.lineStyle(2, 0xffd040, glow).strokeEllipse(chest.x, chest.y - 2, 40, 16);
        if (chest.progress > 0) {
          this.rings.lineStyle(4, 0x120f1e, 1);
          this.rings.beginPath();
          this.rings.arc(chest.x, chest.y - 30, 9, -Math.PI / 2, Math.PI * 1.5);
          this.rings.strokePath();
          this.rings.lineStyle(3, 0x5ef2e6, 1);
          this.rings.beginPath();
          this.rings.arc(
            chest.x,
            chest.y - 30,
            9,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * chest.progress,
          );
          this.rings.strokePath();
        }
      }
    }
    for (const [id, image] of this.chests) {
      if (!seen.has(id)) {
        image.destroy();
        this.chests.delete(id);
      }
    }
  }

  private syncStorm(state: GameState, camera: Phaser.Cameras.Scene2D.Camera): void {
    const storm = state.march.storm && state.phase === "march";
    this.fog.setVisible(storm);
    this.streaks.clear();
    if (!storm) {
      return;
    }
    // Klarer Fleck ueber der Festung, der Rest im Sand.
    const f = state.fort;
    const x = f.x + DECK_W / 2 - camera.scrollX;
    const y = f.y + DECK_H / 2 - ELEVATION / 2 - camera.scrollY;
    const scale = Math.max(VIEWPORT.width / 480, VIEWPORT.height / 270) * 1.25;
    this.fog.setPosition(x, y).setScale(scale);
    // Sandschlieren wehen von rechts nach links.
    const w = VIEWPORT.width;
    for (let i = 0; i < 40; i += 1) {
      const speed = 260 + (i % 7) * 40;
      const sx = w - ((this.time * speed + i * 137) % (w + 120));
      const sy = (i * 53) % VIEWPORT.height;
      this.streaks
        .fillStyle(i % 3 ? 0xc8a888 : 0xe8d0b0, 0.35)
        .fillRect(sx, sy, 18 + (i % 5) * 6, 1);
    }
  }
}
