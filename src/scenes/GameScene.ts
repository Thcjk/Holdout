/**
 * Die Spielszene. Ihre einzige Aufgabe ist Darstellung und Eingabe:
 *
 *   Eingabe einsammeln -> Simulation weiterlaufen lassen -> Zustand zeichnen
 *
 * Bewusst keine Spiellogik hier. Wo der Spieler steht und woran er stehen bleibt,
 * entscheidet `systems/` (siehe CLAUDE.md, Architektur-Grundregel).
 */

import Phaser from "phaser";
import { CHARACTERS } from "../config/balance";
import { ARENA, COLORS, DEPTH, VIEWPORT } from "../config/constants";
import { InputManager } from "../input/InputManager";
import { ArenaRenderer } from "../render/ArenaRenderer";
import { CameraController } from "../render/CameraController";
import { Simulation } from "../systems/Simulation";
import type { InputState, PlayerState } from "../systems/types";

const LOCAL_PLAYER_ID = "local";

export class GameScene extends Phaser.Scene {
  private simulation!: Simulation;
  private inputManager!: InputManager;
  private cameraController!: CameraController;
  private arena!: ArenaRenderer;

  private playerSprite!: Phaser.GameObjects.Arc;
  private facingMarker!: Phaser.GameObjects.Triangle;
  private aimLine!: Phaser.GameObjects.Graphics;

  private readonly inputs = new Map<string, InputState>();

  constructor() {
    super("Game");
  }

  create(): void {
    this.simulation = new Simulation([{ id: LOCAL_PLAYER_ID, name: "Du", character: "scout" }]);

    this.arena = new ArenaRenderer(this, this.simulation.state);
    this.inputManager = new InputManager(this);
    this.cameraController = new CameraController(this, ARENA.width, ARENA.height);

    this.createPlayerSprite();
    this.aimLine = this.add.graphics().setDepth(DEPTH.projectiles);
    this.drawHint();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputManager.destroy();
      this.cameraController.destroy();
      this.arena.destroy();
    });
  }

  update(_time: number, delta: number): void {
    const player = this.localPlayer();
    if (!player) {
      return;
    }

    const input = this.inputManager.getState(player.position);
    this.inputs.set(LOCAL_PLAYER_ID, input);

    const ticks = this.simulation.advance(delta, this.inputs);
    if (ticks > 0) {
      // Einmalige Wuensche (Schuss, Super) erst loeschen, wenn ein Tick sie
      // gesehen hat - sonst geht ein Klick zwischen zwei Ticks verloren.
      this.inputManager.clearOneShots();
    }

    this.drawPlayer(player);
    this.drawAim(player, input);

    this.cameraController.update([
      {
        position: this.simulation.renderPlayerPosition(player.id),
        isSelf: true,
        down: player.down,
      },
    ]);
  }

  private localPlayer(): PlayerState | undefined {
    return this.simulation.state.players.find((entry) => entry.id === LOCAL_PLAYER_ID);
  }

  private createPlayerSprite(): void {
    const player = this.localPlayer();
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

    // Kleiner Keil, der die Blickrichtung zeigt. Ohne ihn sieht man nicht,
    // wohin die Figur zielt, solange nicht geschossen wird.
    this.facingMarker = this.add.triangle(0, 0, 0, -7, 0, 7, 15, 0, COLORS.playerOutline);
    this.facingMarker.setDepth(DEPTH.players + 1);
  }

  private drawPlayer(player: PlayerState): void {
    const position = this.simulation.renderPlayerPosition(player.id);
    this.playerSprite.setPosition(position.x, position.y);

    const angle = Math.atan2(player.facing.y, player.facing.x);
    const distance = player.radius + 6;
    this.facingMarker.setPosition(
      position.x + Math.cos(angle) * distance,
      position.y + Math.sin(angle) * distance,
    );
    this.facingMarker.setRotation(angle);
  }

  /**
   * Ziellinie mit Reichweitenanzeige: Sie zeigt, wie weit die eigene Waffe
   * reicht, damit man nicht ins Leere schiesst.
   */
  private drawAim(player: PlayerState, input: InputState): void {
    this.aimLine.clear();
    if (!input.aim) {
      return;
    }

    const position = this.simulation.renderPlayerPosition(player.id);
    const range = CHARACTERS[player.character].shot.range;
    const strength = Math.max(0.25, this.inputManager.aimStrength);
    const length = range * strength;

    const endX = position.x + input.aim.x * length;
    const endY = position.y + input.aim.y * length;

    this.aimLine.lineStyle(3, COLORS.playerBullet, 0.5);
    this.aimLine.lineBetween(position.x, position.y, endX, endY);
    // Der Kreis am Ende markiert die maximale Reichweite.
    this.aimLine.lineStyle(2, COLORS.playerBullet, 0.85);
    this.aimLine.strokeCircle(endX, endY, 12);
  }

  private drawHint(): void {
    const hint = this.add.text(
      16,
      VIEWPORT.height - 30,
      "Laufen: WASD  ·  Zielen: Maus  ·  Schiessen: Linksklick  ·  Super: Leertaste",
      { fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#8ea6c4" },
    );
    hint.setScrollFactor(0);
    hint.setDepth(DEPTH.hud);
  }
}
