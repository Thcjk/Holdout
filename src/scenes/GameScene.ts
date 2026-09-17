/**
 * Die Spielszene. Ihre einzige Aufgabe ist Darstellung und Eingabe:
 *
 *   Eingabe einsammeln -> Simulation weiterlaufen lassen -> Zustand zeichnen
 *
 * Bewusst keine Spiellogik hier. Wo der Spieler steht, wen er trifft und wie viel
 * Schaden das macht, entscheidet `systems/` (siehe CLAUDE.md, Architektur-Grundregel).
 *
 * Die Bedienelemente liegen in der HudScene, die parallel darueber laeuft - siehe
 * die Begruendung dort.
 */

import Phaser from "phaser";
import { CHARACTERS, PLAYER } from "../config/balance";
import { ARENA, COLORS, DEPTH } from "../config/constants";
import { ArenaRenderer } from "../render/ArenaRenderer";
import { CameraController } from "../render/CameraController";
import { EntityRenderer } from "../render/EntityRenderer";
import { Juice } from "../render/Juice";
import { loadHighscore } from "../storage/highscore";
import { Simulation } from "../systems/Simulation";
import type { CharacterId, InputState, PlayerState } from "../systems/types";
import { createHudModel } from "../ui/HudModel";
import type { HudModel } from "../ui/HudModel";
import { HudScene } from "./HudScene";

const LOCAL_PLAYER_ID = "local";

export interface GameSceneData {
  character?: CharacterId;
}

export class GameScene extends Phaser.Scene {
  private simulation!: Simulation;
  private cameraController!: CameraController;
  private arena!: ArenaRenderer;
  private entities!: EntityRenderer;
  private juice!: Juice;

  private aimLine!: Phaser.GameObjects.Graphics;
  private hudModel: HudModel = createHudModel();
  private hud?: HudScene;
  private character: CharacterId = "scout";
  private finished = false;

  private readonly inputs = new Map<string, InputState>();

  constructor() {
    super("Game");
  }

  init(data: GameSceneData): void {
    this.character = data.character ?? "scout";
    this.finished = false;
    this.hudModel = createHudModel();
    this.hudModel.highscore = loadHighscore()?.score ?? 0;
    this.inputs.clear();
  }

  create(): void {
    this.simulation = new Simulation([
      { id: LOCAL_PLAYER_ID, name: "Du", character: this.character },
    ]);

    this.arena = new ArenaRenderer(this, this.simulation.state);
    this.juice = new Juice(this);
    this.entities = new EntityRenderer(this, this.simulation, LOCAL_PLAYER_ID);
    this.cameraController = new CameraController(this, ARENA.width, ARENA.height);
    this.aimLine = this.add.graphics().setDepth(DEPTH.projectiles);

    this.scene.launch("Hud", { model: this.hudModel, gameCamera: this.cameras.main });
    this.hud = this.scene.get("Hud") as HudScene;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop("Hud");
      this.cameraController.destroy();
      this.entities.destroy();
      this.juice.destroy();
      this.arena.destroy();
    });
  }

  update(_time: number, delta: number): void {
    const player = this.localPlayer();
    // Die HudScene startet ein Bild spaeter als diese Szene. Solange sie nicht
    // bereit ist, gibt es noch keine Eingabe - ein Bild ohne Steuerung faellt
    // niemandem auf, ein Absturz schon.
    if (!player || !this.hud?.ready) {
      return;
    }

    const input = this.hud.inputManager.getState(player.position);
    this.inputs.set(LOCAL_PLAYER_ID, input);

    // Beim Super laeuft die Zeit kurz langsamer. Die Simulation merkt davon
    // nichts - sie bekommt einfach weniger Zeit zugeteilt.
    this.juice.update(delta);
    const ticks = this.simulation.advance(delta * this.juice.currentTimeScale, this.inputs);
    if (ticks > 0) {
      // Einmalige Wuensche (Schuss, Super) erst loeschen, wenn ein Tick sie
      // gesehen hat - sonst geht ein Klick zwischen zwei Ticks verloren.
      this.hud.inputManager.clearOneShots();
    }

    this.handleEvents();
    this.entities.update();
    this.drawAim(player, input);
    this.updateHudModel(player);

    this.cameraController.update(
      this.simulation.state.players.map((entry) => ({
        position: this.simulation.renderPlayerPosition(entry.id),
        isSelf: entry.id === LOCAL_PLAYER_ID,
        down: entry.down,
      })),
    );
  }

  private handleEvents(): void {
    for (const event of this.simulation.events) {
      if (event.type === "hit") {
        this.entities.flashEnemy(event.enemyId);
      }
      if (event.type === "gameOver" && !this.finished) {
        this.finished = true;
        // Kurz warten, damit der letzte Effekt noch zu sehen ist.
        this.time.delayedCall(900, () => {
          this.scene.stop("Hud");
          this.scene.start("GameOver", { score: event.score, wave: event.wave });
        });
      }
    }

    this.juice.handle(this.simulation.events);
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
    if (!input.aim || player.down || !this.hud) {
      return;
    }

    const position = this.simulation.renderPlayerPosition(player.id);
    const range = CHARACTERS[player.character].shot.range;
    const strength = Math.max(0.25, this.hud.inputManager.aimStrength);
    const length = range * strength;

    const endX = position.x + input.aim.x * length;
    const endY = position.y + input.aim.y * length;

    this.aimLine.lineStyle(3, COLORS.playerBullet, 0.45);
    this.aimLine.lineBetween(position.x, position.y, endX, endY);
    this.aimLine.lineStyle(2, COLORS.playerBullet, 0.8);
    this.aimLine.strokeCircle(endX, endY, 12);
  }

  /** Fuellt das Objekt, das die HudScene liest. */
  private updateHudModel(player: PlayerState): void {
    const state = this.simulation.state;
    const reloadTime = CHARACTERS[player.character].reloadTime;

    this.hudModel.characterName = CHARACTERS[player.character].name;
    this.hudModel.health = player.health;
    this.hudModel.maxHealth = player.maxHealth;
    this.hudModel.ammo = player.reloadTimers.map((timer) =>
      timer <= 0 ? 1 : 1 - timer / reloadTime,
    );
    this.hudModel.superCharge = player.superCharge;
    this.hudModel.wave = state.wave;
    this.hudModel.score = state.score;
    this.hudModel.phase = state.phase;
    this.hudModel.phaseTime = state.phaseTime;
    this.hudModel.enemiesLeft = state.enemies.length + state.pendingSpawns.length;
    this.hudModel.down = player.down;
    this.hudModel.reviveProgress = player.reviveProgress / PLAYER.reviveTime;
    this.hudModel.mates = state.players
      .filter((entry) => entry.id !== player.id)
      .map((entry) => ({
        name: entry.name,
        healthFraction: entry.health / entry.maxHealth,
        down: entry.down,
      }));
  }
}
