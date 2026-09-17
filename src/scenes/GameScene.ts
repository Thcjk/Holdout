/**
 * Die Spielszene. Ihre einzige Aufgabe ist Darstellung und Eingabe:
 *
 *   Eingabe einsammeln -> Simulation weiterlaufen lassen -> Zustand zeichnen
 *
 * Bewusst keine Spiellogik hier. Wo der Spieler steht, wen er trifft und wie viel
 * Schaden das macht, entscheidet `systems/` (siehe CLAUDE.md, Architektur-Grundregel).
 */

import Phaser from "phaser";
import { CHARACTERS } from "../config/balance";
import { ARENA, COLORS, DEPTH, VIEWPORT } from "../config/constants";
import { InputManager } from "../input/InputManager";
import { ArenaRenderer } from "../render/ArenaRenderer";
import { CameraController } from "../render/CameraController";
import { EntityRenderer } from "../render/EntityRenderer";
import { Juice } from "../render/Juice";
import { Simulation } from "../systems/Simulation";
import { ammoCount, isSuperReady } from "../systems/combat";
import type { InputState, PlayerState } from "../systems/types";

const LOCAL_PLAYER_ID = "local";

export class GameScene extends Phaser.Scene {
  private simulation!: Simulation;
  private inputManager!: InputManager;
  private cameraController!: CameraController;
  private arena!: ArenaRenderer;
  private entities!: EntityRenderer;
  private juice!: Juice;

  private aimLine!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;

  private readonly inputs = new Map<string, InputState>();

  constructor() {
    super("Game");
  }

  create(): void {
    this.simulation = new Simulation([{ id: LOCAL_PLAYER_ID, name: "Du", character: "scout" }]);

    this.arena = new ArenaRenderer(this, this.simulation.state);
    this.juice = new Juice(this);
    this.entities = new EntityRenderer(this, this.simulation, LOCAL_PLAYER_ID);
    this.inputManager = new InputManager(this);
    this.cameraController = new CameraController(this, ARENA.width, ARENA.height);

    this.aimLine = this.add.graphics().setDepth(DEPTH.projectiles);
    this.createStatusText();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputManager.destroy();
      this.cameraController.destroy();
      this.entities.destroy();
      this.juice.destroy();
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

    // Beim Super laeuft die Zeit kurz langsamer. Die Simulation merkt davon
    // nichts - sie bekommt einfach weniger Zeit zugeteilt.
    this.juice.update(delta);
    const ticks = this.simulation.advance(delta * this.juice.currentTimeScale, this.inputs);
    if (ticks > 0) {
      // Einmalige Wuensche (Schuss, Super) erst loeschen, wenn ein Tick sie
      // gesehen hat - sonst geht ein Klick zwischen zwei Ticks verloren.
      this.inputManager.clearOneShots();
    }

    for (const event of this.simulation.events) {
      if (event.type === "hit") {
        this.entities.flashEnemy(event.enemyId);
      }
    }
    this.juice.handle(this.simulation.events);

    this.entities.update();
    this.drawAim(player, input);
    this.updateStatusText(player);
    this.inputManager.setSuperReady(isSuperReady(player));

    this.cameraController.update(
      this.simulation.state.players.map((entry) => ({
        position: this.simulation.renderPlayerPosition(entry.id),
        isSelf: entry.id === LOCAL_PLAYER_ID,
        down: entry.down,
      })),
    );
  }

  private localPlayer(): PlayerState | undefined {
    return this.simulation.state.players.find((entry) => entry.id === LOCAL_PLAYER_ID);
  }

  /**
   * Ziellinie mit Reichweitenanzeige: Sie zeigt, wie weit die eigene Waffe
   * reicht, damit man nicht ins Leere schiesst.
   */
  private drawAim(player: PlayerState, input: InputState): void {
    this.aimLine.clear();
    if (!input.aim || player.down) {
      return;
    }

    const position = this.simulation.renderPlayerPosition(player.id);
    const range = CHARACTERS[player.character].shot.range;
    const strength = Math.max(0.25, this.inputManager.aimStrength);
    const length = range * strength;

    const endX = position.x + input.aim.x * length;
    const endY = position.y + input.aim.y * length;

    this.aimLine.lineStyle(3, COLORS.playerBullet, 0.45);
    this.aimLine.lineBetween(position.x, position.y, endX, endY);
    this.aimLine.lineStyle(2, COLORS.playerBullet, 0.8);
    this.aimLine.strokeCircle(endX, endY, 12);
  }

  private createStatusText(): void {
    this.statusText = this.add.text(14, 12, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "15px",
      color: "#dce8f7",
    });
    this.statusText.setScrollFactor(0);
    this.statusText.setDepth(DEPTH.hud);

    const hint = this.add.text(
      14,
      VIEWPORT.height - 28,
      "WASD laufen · Maus zielen · Linksklick schiessen · Leertaste Super",
      { fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#8ea6c4" },
    );
    hint.setScrollFactor(0);
    hint.setDepth(DEPTH.hud);
  }

  /** Vorlaeufige Anzeige. Das richtige HUD kommt in Phase 4. */
  private updateStatusText(player: PlayerState): void {
    const ammo = "|".repeat(ammoCount(player)).padEnd(player.reloadTimers.length, ".");
    this.statusText.setText(
      `Leben ${Math.ceil(player.health)}/${player.maxHealth}   Munition ${ammo}   ` +
        `Super ${Math.floor(player.superCharge)}%   Score ${this.simulation.state.score}`,
    );
  }
}
