/**
 * Die Spielszene. Ihre einzige Aufgabe ist Darstellung und Eingabe:
 *
 *   Eingabe einsammeln -> Simulation weiterlaufen lassen -> Zustand zeichnen
 *
 * Bewusst keine Spiellogik hier. Wo der Spieler steht und woran er stehen bleibt,
 * entscheidet `systems/` (siehe CLAUDE.md, Architektur-Grundregel). Auch die
 * Phaser-Physik (Arcade Physics) wird deshalb absichtlich nicht benutzt.
 */

import Phaser from "phaser";
import { WALL_THICKNESS } from "../config/arena";
import { ARENA, COLORS, DEPTH, VIEWPORT } from "../config/constants";
import { InputManager } from "../input/InputManager";
import { Simulation } from "../systems/Simulation";
import type { InputState } from "../systems/types";

const LOCAL_PLAYER_ID = "local";

export class GameScene extends Phaser.Scene {
  private simulation!: Simulation;
  private inputManager!: InputManager;
  private playerSprite!: Phaser.GameObjects.Arc;
  private readonly inputs = new Map<string, InputState>();

  constructor() {
    super("Game");
  }

  create(): void {
    this.simulation = new Simulation([LOCAL_PLAYER_ID]);
    this.inputManager = new InputManager(this);

    this.drawArena();
    this.createPlayerSprite();
    this.setupCamera();
    this.drawHint();
  }

  update(_time: number, delta: number): void {
    this.inputs.set(LOCAL_PLAYER_ID, this.inputManager.getState());
    this.simulation.advance(delta, this.inputs);

    // Zwischen zwei Simulationsschritten interpolierte Position, damit die
    // Figur mit voller Bildrate weich laeuft statt mit 30 Hz zu ruckeln.
    const position = this.simulation.renderPosition(LOCAL_PLAYER_ID);
    this.playerSprite.setPosition(position.x, position.y);
  }

  /** Boden, Raster und Waende als Platzhaltergrafik. */
  private drawArena(): void {
    const floor = this.add.graphics();
    floor.setDepth(DEPTH.floor);
    floor.fillStyle(COLORS.floor, 1);
    floor.fillRect(0, 0, ARENA.width, ARENA.height);

    // Raster: hilft beim Entwickeln, Entfernungen und Tempo einzuschaetzen.
    floor.lineStyle(1, COLORS.floorGrid, 1);
    const step = 100;
    for (let x = step; x < ARENA.width; x += step) {
      floor.lineBetween(x, WALL_THICKNESS, x, ARENA.height - WALL_THICKNESS);
    }
    for (let y = step; y < ARENA.height; y += step) {
      floor.lineBetween(WALL_THICKNESS, y, ARENA.width - WALL_THICKNESS, y);
    }

    const walls = this.add.graphics();
    walls.setDepth(DEPTH.walls);
    for (const wall of this.simulation.state.walls) {
      walls.fillStyle(COLORS.wall, 1);
      walls.fillRect(wall.x, wall.y, wall.width, wall.height);
      walls.lineStyle(2, COLORS.wallEdge, 1);
      walls.strokeRect(wall.x, wall.y, wall.width, wall.height);
    }
  }

  private createPlayerSprite(): void {
    const player = this.simulation.state.players[0];
    if (!player) {
      throw new Error("Kein Spieler in der Simulation vorhanden.");
    }

    this.playerSprite = this.add.circle(
      player.position.x,
      player.position.y,
      player.radius,
      COLORS.player,
    );
    this.playerSprite.setStrokeStyle(3, COLORS.playerOutline);
    this.playerSprite.setDepth(DEPTH.players);
  }

  /**
   * Die Kamera folgt dem Spieler und bleibt innerhalb der Arena.
   * Die gemeinsame Kamera fuer mehrere Spieler mit dynamischem Zoom kommt in Phase 2.
   */
  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.setBackgroundColor(COLORS.background);
    camera.setBounds(0, 0, ARENA.width, ARENA.height);
    // Die beiden Werte sind die "Traegheit": 1 waere hart angeheftet, kleiner ist weicher.
    camera.startFollow(this.playerSprite, true, 0.15, 0.15);
  }

  private drawHint(): void {
    const hint = this.add.text(
      16,
      VIEWPORT.height - 32,
      "Laufen: WASD oder Pfeiltasten  ·  Phase 1",
      { fontFamily: "system-ui, sans-serif", fontSize: "16px", color: "#8ea6c4" },
    );
    // scrollFactor 0 heftet das Objekt an den Bildschirm statt an die Welt.
    hint.setScrollFactor(0);
    hint.setDepth(DEPTH.hud);
  }
}
