/**
 * Zeichnet alles Bewegliche: Spieler, Gegner, Projektile.
 *
 * Die Sprites lesen den Weltzustand nur aus - sie entscheiden nichts. Und sie
 * werden wiederverwendet statt staendig neu erzeugt (Pooling), weil das Erzeugen
 * und Wegwerfen von Objekten auf dem Handy der haeufigste Ruckler-Grund ist.
 *
 * Alle Bilder kommen aus dem Texture Atlas (`assets/textures.ts`), nie aus
 * hartkodierten Formen - deshalb ist ein Wechsel auf echte Sprites eine Datei.
 */

import Phaser from "phaser";
import { ATLAS_KEY, BODY_RADIUS, FRAMES } from "../assets/textures";
import { COLORS, DEPTH } from "../config/constants";
import type { WorldView } from "../net/GameSession";
import type { CharacterId, EnemyState, EnemyType, PlayerState, WorldState } from "../systems/types";

/** Wie lange ein getroffener Gegner weiss aufblitzt, in Millisekunden. */
const HIT_FLASH_MS = 110;

const ENEMY_FRAMES: Record<EnemyType, string> = {
  runner: FRAMES.runner,
  brute: FRAMES.brute,
  shooter: FRAMES.shooter,
};

const CHARACTER_FRAMES: Record<CharacterId, string> = {
  scout: FRAMES.scout,
  tank: FRAMES.tank,
  sniper: FRAMES.sniper,
};

/** Halber Durchmesser des Leuchtkerns eines Projektils im Atlas. */
const BULLET_RADIUS_IN_CELL = BODY_RADIUS * 0.72;

interface PlayerVisual {
  body: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

export class EntityRenderer {
  private readonly playerVisuals = new Map<string, PlayerVisual>();
  private readonly enemySprites: Phaser.GameObjects.Image[] = [];
  private readonly projectileSprites: Phaser.GameObjects.Image[] = [];
  private readonly trails: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  private readonly flashUntil = new Map<number, number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly simulation: WorldView,
    private readonly selfId: string,
  ) {
    this.trails = scene.add.graphics().setDepth(DEPTH.projectiles - 1);
    this.bars = scene.add.graphics().setDepth(DEPTH.enemies + 1);
  }

  /** Meldet einen Treffer, damit der Gegner kurz weiss aufblitzt. */
  flashEnemy(enemyId: number): void {
    this.flashUntil.set(enemyId, this.scene.time.now + HIT_FLASH_MS);
  }

  update(): void {
    const state = this.simulation.state;
    this.bars.clear();
    this.trails.clear();

    this.updatePlayers(state);
    this.updateEnemies(state);
    this.updateProjectiles(state);
  }

  destroy(): void {
    for (const visual of this.playerVisuals.values()) {
      visual.body.destroy();
      visual.label.destroy();
    }
    for (const sprite of this.enemySprites) {
      sprite.destroy();
    }
    for (const sprite of this.projectileSprites) {
      sprite.destroy();
    }
    this.trails.destroy();
    this.bars.destroy();
  }

  private updatePlayers(state: WorldState): void {
    for (const player of state.players) {
      const visual = this.playerVisual(player);
      const position = this.simulation.renderPlayerPosition(player.id);

      visual.body.setPosition(position.x, position.y);
      visual.body.setScale(player.radius / BODY_RADIUS);
      visual.body.setRotation(Math.atan2(player.facing.y, player.facing.x));

      // Am Boden: grau und flach. Unverwundbar nach einem Treffer: blinkt.
      const blinking = player.invulnerable > 0 && Math.floor(this.scene.time.now / 60) % 2 === 0;
      visual.body.setAlpha(player.down ? 0.4 : blinking ? 0.4 : 1);
      if (player.down) {
        visual.body.setTint(COLORS.playerDown);
      } else if (player.id === this.selfId) {
        visual.body.clearTint();
      } else {
        // Mitspieler bekommen einen gruenen Stich, damit man sich im Getuemmel
        // selbst wiederfindet.
        visual.body.setTint(COLORS.mate);
      }

      visual.label.setPosition(position.x, position.y - player.radius - 28);
      visual.label.setVisible(state.players.length > 1 || player.down);
      visual.label.setText(
        player.down
          ? `${player.name} am Boden ${Math.ceil(Math.max(0, 3 - player.reviveProgress))}s`
          : player.name,
      );

      this.drawHealthBar(
        position.x,
        position.y - player.radius - 14,
        player.health / player.maxHealth,
        36,
        player.down ? COLORS.danger : COLORS.mate,
      );
    }
  }

  private playerVisual(player: PlayerState): PlayerVisual {
    const existing = this.playerVisuals.get(player.id);
    if (existing) {
      return existing;
    }

    const body = this.scene.add.image(0, 0, ATLAS_KEY, CHARACTER_FRAMES[player.character]);
    body.setDepth(DEPTH.players);

    const label = this.scene.add.text(0, 0, player.name, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "13px",
      color: "#dce8f7",
    });
    label.setOrigin(0.5);
    label.setDepth(DEPTH.players + 2);

    const visual: PlayerVisual = { body, label };
    this.playerVisuals.set(player.id, visual);
    return visual;
  }

  private updateEnemies(state: WorldState): void {
    const now = this.scene.time.now;

    for (let i = 0; i < state.enemies.length; i += 1) {
      const enemy = state.enemies[i];
      if (!enemy) {
        continue;
      }

      const sprite = this.enemySprite(i);
      const position = this.simulation.renderEnemyPosition(enemy.id, enemy.position);

      sprite.setTexture(ATLAS_KEY, ENEMY_FRAMES[enemy.type]);
      sprite.setPosition(position.x, position.y);
      sprite.setScale(enemy.radius / BODY_RADIUS);
      sprite.setVisible(true);

      // In Laufrichtung drehen, solange der Gegner sich bewegt.
      const speed = Math.hypot(enemy.velocity.x, enemy.velocity.y);
      if (speed > 5) {
        sprite.setRotation(Math.atan2(enemy.velocity.y, enemy.velocity.x));
      }

      if ((this.flashUntil.get(enemy.id) ?? 0) > now) {
        sprite.setTintFill(0xffffff);
      } else if (enemy.marked > 0) {
        sprite.setTint(COLORS.marked);
      } else if (enemy.stunned > 0) {
        sprite.setTint(COLORS.hudDim);
      } else {
        sprite.clearTint();
      }

      if (enemy.health < enemy.maxHealth) {
        this.drawEnemyHealthBar(position.x, position.y - enemy.radius - 12, enemy);
      }
    }

    // Uebrige Sprites aus dem Pool ausblenden statt loeschen.
    for (let i = state.enemies.length; i < this.enemySprites.length; i += 1) {
      this.enemySprites[i]?.setVisible(false);
    }
  }

  private enemySprite(index: number): Phaser.GameObjects.Image {
    const existing = this.enemySprites[index];
    if (existing) {
      return existing;
    }

    const sprite = this.scene.add.image(0, 0, ATLAS_KEY, FRAMES.runner);
    sprite.setDepth(DEPTH.enemies);
    this.enemySprites[index] = sprite;
    return sprite;
  }

  private updateProjectiles(state: WorldState): void {
    let used = 0;

    for (const projectile of state.projectiles) {
      if (!projectile.active) {
        continue;
      }

      const sprite = this.projectileSprite(used);
      used += 1;

      const position = this.simulation.renderProjectilePosition(
        projectile.position,
        projectile.velocity,
      );
      const isPlayerShot = projectile.owner === "player";
      const color = isPlayerShot ? COLORS.playerBullet : COLORS.enemyBullet;

      sprite.setTexture(ATLAS_KEY, isPlayerShot ? FRAMES.bulletPlayer : FRAMES.bulletEnemy);
      sprite.setPosition(position.x, position.y);
      sprite.setScale(projectile.radius / BULLET_RADIUS_IN_CELL);
      sprite.setVisible(true);

      // Spuranzeige: eine kurze Linie entgegen der Flugrichtung. Ohne sie wirken
      // schnelle Projektile wie einzelne Punkte, die springen.
      const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
      if (speed > 1) {
        const length = Math.min(34, speed * 0.05);
        this.trails.lineStyle(projectile.radius * 1.1, color, 0.32);
        this.trails.lineBetween(
          position.x,
          position.y,
          position.x - (projectile.velocity.x / speed) * length,
          position.y - (projectile.velocity.y / speed) * length,
        );
      }
    }

    for (let i = used; i < this.projectileSprites.length; i += 1) {
      this.projectileSprites[i]?.setVisible(false);
    }
  }

  private projectileSprite(index: number): Phaser.GameObjects.Image {
    const existing = this.projectileSprites[index];
    if (existing) {
      return existing;
    }

    const sprite = this.scene.add.image(0, 0, ATLAS_KEY, FRAMES.bulletPlayer);
    sprite.setDepth(DEPTH.projectiles);
    this.projectileSprites[index] = sprite;
    return sprite;
  }

  private drawEnemyHealthBar(x: number, y: number, enemy: EnemyState): void {
    const width = enemy.isBoss ? 72 : 34;
    this.drawHealthBar(x, y, enemy.health / enemy.maxHealth, width, COLORS.danger);
  }

  private drawHealthBar(
    x: number,
    y: number,
    fraction: number,
    width: number,
    color: number,
  ): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    const height = 5;
    const left = x - width / 2;

    this.bars.fillStyle(0x000000, 0.55);
    this.bars.fillRect(left - 1, y - 1, width + 2, height + 2);
    this.bars.fillStyle(color, 1);
    this.bars.fillRect(left, y, width * clamped, height);
  }
}
