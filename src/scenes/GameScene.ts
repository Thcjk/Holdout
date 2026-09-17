/**
 * Die Spielszene. Ihre einzige Aufgabe ist Darstellung und Eingabe:
 *
 *   Eingabe einsammeln -> Runde weiterlaufen lassen -> Zustand zeichnen
 *
 * Bewusst keine Spiellogik hier. Und bewusst kein Wissen darueber, ob die Runde
 * allein, als Host oder als Client laeuft: Das steckt hinter `GameSession`.
 */

import Phaser from "phaser";
import { playEventSounds } from "../audio/eventSounds";
import { CHARACTERS, PLAYER } from "../config/balance";
import { ARENA, COLORS, DEPTH } from "../config/constants";
import type { GameSession } from "../net/GameSession";
import { SoloSession } from "../net/SoloSession";
import { ArenaRenderer } from "../render/ArenaRenderer";
import { CameraController } from "../render/CameraController";
import { EntityRenderer } from "../render/EntityRenderer";
import { Juice } from "../render/Juice";
import { loadHighscore } from "../storage/highscore";
import { nearestEnemy } from "../systems/targeting";
import type { CharacterId, InputState, PlayerState, Vec2 } from "../systems/types";
import { createHudModel } from "../ui/HudModel";
import type { HudModel } from "../ui/HudModel";
import { HudScene } from "./HudScene";

export interface GameSceneData {
  character?: CharacterId;
  /** Gesetzt, wenn die Runde aus der Lobby kommt. Sonst wird solo gespielt. */
  session?: GameSession;
}

export class GameScene extends Phaser.Scene {
  private session!: GameSession;
  private cameraController!: CameraController;
  private arena!: ArenaRenderer;
  private entities!: EntityRenderer;
  private juice!: Juice;

  private aimLine!: Phaser.GameObjects.Graphics;
  private hudModel: HudModel = createHudModel();
  private hud?: HudScene;
  private character: CharacterId = "scout";
  private finished = false;

  constructor() {
    super("Game");
  }

  init(data: GameSceneData): void {
    this.character = data.character ?? "scout";
    this.finished = false;
    this.hudModel = createHudModel();
    this.hudModel.highscore = loadHighscore()?.score ?? 0;

    this.session =
      data.session ?? new SoloSession({ id: "local", name: "Du", character: this.character });
  }

  create(): void {
    this.arena = new ArenaRenderer(this, this.session.view.state);
    this.juice = new Juice(this);
    this.entities = new EntityRenderer(this, this.session.view, this.session.selfId);
    this.cameraController = new CameraController(this, ARENA.width, ARENA.height);
    this.aimLine = this.add.graphics().setDepth(DEPTH.projectiles);

    this.scene.launch("Hud", { model: this.hudModel });
    this.hud = this.scene.get("Hud") as HudScene;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop("Hud");
      this.session.destroy();
      this.cameraController.destroy();
      this.entities.destroy();
      this.juice.destroy();
      this.arena.destroy();
    });
  }

  update(_time: number, delta: number): void {
    const player = this.selfPlayer();
    // Die HudScene startet ein Bild spaeter als diese Szene. Solange sie nicht
    // bereit ist, gibt es noch keine Eingabe - ein Bild ohne Steuerung faellt
    // niemandem auf, ein Absturz schon.
    if (!player || !this.hud?.ready) {
      return;
    }

    const input = this.hud.inputManager.getState();

    // Beim Super laeuft die Zeit kurz langsamer. Die Simulation merkt davon
    // nichts - sie bekommt einfach weniger Zeit zugeteilt.
    this.juice.update(delta);
    const consumed = this.session.update(delta * this.juice.currentTimeScale, input);
    if (consumed) {
      // Einmalige Wuensche (Schuss, Super) erst loeschen, wenn sie verarbeitet
      // wurden - sonst geht ein Klick zwischen zwei Ticks verloren.
      this.hud.inputManager.clearOneShots();
    }

    this.handleEvents();
    this.checkConnection();
    this.entities.update();
    this.drawAim(player, input);
    this.updateHudModel(player);

    this.cameraController.update(
      this.session.view.state.players.map((entry) => ({
        position: this.session.view.renderPlayerPosition(entry.id),
        isSelf: entry.id === this.session.selfId,
        down: entry.down,
      })),
    );
  }

  private handleEvents(): void {
    const events = this.session.view.events;

    for (const event of events) {
      if (event.type === "hit") {
        this.entities.flashEnemy(event.enemyId);
      }
      if (event.type === "gameOver" && !this.finished) {
        this.finished = true;
        // Kurz warten, damit der letzte Effekt noch zu sehen ist.
        this.time.delayedCall(900, () => {
          this.scene.stop("Hud");
          this.scene.start("GameOver", {
            score: event.score,
            wave: event.wave,
            character: this.character,
          });
        });
      }
    }

    this.juice.handle(events);
    playEventSounds(events);
  }

  /**
   * Reisst die Verbindung ab, ist die Runde vorbei - Host-Migration lohnt sich
   * fuer ein Spiel unter Freunden nicht (Briefing, Abschnitt 6).
   */
  private checkConnection(): void {
    if (this.finished || !this.session.connectionLost) {
      return;
    }

    this.finished = true;
    this.hudModel.connectionMessage = this.session.connectionLost;
    this.time.delayedCall(2600, () => {
      this.scene.stop("Hud");
      this.scene.start("Menu");
    });
  }

  private selfPlayer(): PlayerState | undefined {
    return this.session.view.state.players.find((entry) => entry.id === this.session.selfId);
  }

  /**
   * Ziellinie mit Reichweitenanzeige.
   *
   * Sie zeigt zweierlei: wohin geschossen wird und wie weit die Waffe reicht -
   * damit niemand ins Leere feuert. Wer nur haelt, ohne zu ziehen, sieht die
   * Linie zum Gegner, den die Simulation automatisch anvisiert.
   */
  private drawAim(player: PlayerState, input: InputState): void {
    this.aimLine.clear();
    if (player.down || !this.hud || (!input.aim && !input.fire)) {
      return;
    }

    const position = this.session.view.renderPlayerPosition(player.id);
    const range = CHARACTERS[player.character].shot.range;
    const direction = this.aimDirection(player, input, range);
    if (!direction) {
      return;
    }

    // Beim Ziehen waechst die Linie mit dem Ausschlag, beim blossen Halten
    // zeigt sie die volle Reichweite.
    const strength = input.aim ? Math.max(0.3, this.hud.inputManager.aimStrength) : 1;
    const length = range * strength;

    const endX = position.x + direction.x * length;
    const endY = position.y + direction.y * length;

    this.aimLine.lineStyle(3, COLORS.playerBullet, 0.45);
    this.aimLine.lineBetween(position.x, position.y, endX, endY);
    this.aimLine.lineStyle(2, COLORS.playerBullet, 0.8);
    this.aimLine.strokeCircle(endX, endY, 12);
  }

  /** Gezogene Richtung, sonst die Richtung zum automatisch gewaehlten Ziel. */
  private aimDirection(player: PlayerState, input: InputState, range: number): Vec2 | null {
    if (input.aim) {
      return input.aim;
    }

    const target = nearestEnemy(this.session.view.state, player.position, range * 1.15);
    if (!target) {
      return null;
    }

    const dx = target.position.x - player.position.x;
    const dy = target.position.y - player.position.y;
    const distance = Math.hypot(dx, dy);
    return distance > 1e-6 ? { x: dx / distance, y: dy / distance } : null;
  }

  /** Fuellt das Objekt, das die HudScene liest. */
  private updateHudModel(player: PlayerState): void {
    const state = this.session.view.state;
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
    this.hudModel.enemiesLeft = state.enemies.length + this.session.view.pendingCount;
    this.hudModel.skillPoints = player.skillPoints;
    this.hudModel.skillLevels = player.skills;
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
