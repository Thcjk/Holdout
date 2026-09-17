/**
 * Zeichnet die unbewegliche Arena: Boden, Raster, Waende und Buesche.
 *
 * Alles hier wird einmal gezeichnet und danach nicht mehr angefasst - das ist
 * billiger, als jedes Bild neu zu zeichnen.
 */

import Phaser from "phaser";
import { ARENA, COLORS, DEPTH } from "../config/constants";
import type { WorldState } from "../systems/types";

export class ArenaRenderer {
  private readonly floor: Phaser.GameObjects.Graphics;
  private readonly walls: Phaser.GameObjects.Graphics;
  private readonly bushes: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, state: WorldState) {
    this.floor = scene.add.graphics().setDepth(DEPTH.floor);
    this.bushes = scene.add.graphics().setDepth(DEPTH.bushesAbove);
    this.walls = scene.add.graphics().setDepth(DEPTH.walls);

    this.drawFloor();
    this.drawWalls(state);
    this.drawBushes(state);
  }

  destroy(): void {
    this.floor.destroy();
    this.walls.destroy();
    this.bushes.destroy();
  }

  private drawFloor(): void {
    this.floor.fillStyle(COLORS.floor, 1);
    this.floor.fillRect(0, 0, ARENA.width, ARENA.height);

    // Raster: hilft beim Entwickeln, Entfernungen und Tempo einzuschaetzen,
    // und gibt dem Auge im Spiel einen Anhaltspunkt fuer die eigene Bewegung.
    this.floor.lineStyle(1, COLORS.floorGrid, 1);
    const step = 100;
    for (let x = step; x < ARENA.width; x += step) {
      this.floor.lineBetween(x, 0, x, ARENA.height);
    }
    for (let y = step; y < ARENA.height; y += step) {
      this.floor.lineBetween(0, y, ARENA.width, y);
    }
  }

  private drawWalls(state: WorldState): void {
    for (const wall of state.walls) {
      this.walls.fillStyle(COLORS.wall, 1);
      this.walls.fillRect(wall.x, wall.y, wall.width, wall.height);
      this.walls.lineStyle(2, COLORS.wallEdge, 1);
      this.walls.strokeRect(wall.x, wall.y, wall.width, wall.height);
    }
  }

  /**
   * Buesche liegen ueber den Figuren: Wer drinsteht, ist halb verdeckt -
   * genau das ist ja der Sinn eines Verstecks.
   */
  private drawBushes(state: WorldState): void {
    for (const bush of state.bushes) {
      this.bushes.fillStyle(COLORS.bush, 0.82);
      this.bushes.fillRoundedRect(bush.x, bush.y, bush.width, bush.height, 22);
      this.bushes.lineStyle(3, COLORS.bushEdge, 0.9);
      this.bushes.strokeRoundedRect(bush.x, bush.y, bush.width, bush.height, 22);
    }
  }
}
