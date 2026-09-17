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
import { SHOW_HITBOXES } from "../platform/debugFlags";
import type { CharacterId, EnemyState, EnemyType, PlayerState, WorldState } from "../systems/types";

/** Wie lange ein getroffener Gegner weiss aufblitzt, in Millisekunden. */
// 130 statt 110 Millisekunden: Bei 60 Bildern je Sekunde sind das acht
// Bilder statt sechs - der Unterschied zwischen "war da was?" und "getroffen".
const HIT_FLASH_MS = 130;

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
  /** Aufgestellte Schildwaende (Tank-Faehigkeit). */
  private readonly barriers: Phaser.GameObjects.Graphics;
  private readonly bars: Phaser.GameObjects.Graphics;
  /** Nur mit `?debug=hitbox`: die Trefferradien als Umriss. */
  private readonly hitboxes: Phaser.GameObjects.Graphics | null;
  private readonly flashUntil = new Map<number, number>();
  /**
   * Welcher Atlas-Ausschnitt in einem Sprite gerade steckt.
   *
   * Phaser markiert ein Sprite bei jedem `setTexture` als veraendert, auch wenn
   * sich nichts geaendert hat. Bei 40 Gegnern in jedem Bild ist das messbare
   * Arbeit fuer nichts - deshalb wird der Wechsel hier gemerkt.
   */
  private readonly enemyFrames: string[] = [];
  private readonly projectileFrames: string[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly simulation: WorldView,
    private readonly selfId: string,
  ) {
    this.trails = scene.add.graphics().setDepth(DEPTH.projectiles - 1);
    this.barriers = scene.add.graphics().setDepth(DEPTH.walls + 1);
    this.bars = scene.add.graphics().setDepth(DEPTH.enemies + 1);
    // Ueber allem, damit kein Sprite den Umriss verdeckt.
    this.hitboxes = SHOW_HITBOXES ? scene.add.graphics().setDepth(DEPTH.hud - 1) : null;
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
    this.drawBarriers(state);
    this.drawHitboxes(state);
  }

  /**
   * Schildwaende: eine dicke Strecke, genau dort, wo die Simulation sie hat.
   *
   * Sie blinkt in der letzten Sekunde - so sieht man, dass sie gleich
   * verschwindet, statt sich ploetzlich ungeschuetzt wiederzufinden.
   */
  private drawBarriers(state: WorldState): void {
    this.barriers.clear();
    if (state.barriers.length === 0) {
      return;
    }

    for (const barrier of state.barriers) {
      const halfX = barrier.along.x * barrier.halfWidth;
      const halfY = barrier.along.y * barrier.halfWidth;
      const blinking = barrier.remaining < 1 && Math.floor(barrier.remaining * 8) % 2 === 0;
      const alpha = blinking ? 0.3 : 0.9;

      this.barriers.lineStyle(10, COLORS.player, alpha * 0.45);
      this.barriers.lineBetween(
        barrier.position.x - halfX,
        barrier.position.y - halfY,
        barrier.position.x + halfX,
        barrier.position.y + halfY,
      );
      this.barriers.lineStyle(4, COLORS.playerOutline, alpha);
      this.barriers.lineBetween(
        barrier.position.x - halfX,
        barrier.position.y - halfY,
        barrier.position.x + halfX,
        barrier.position.y + halfY,
      );
    }
  }

  /**
   * Die Kreise, mit denen die Simulation wirklich rechnet.
   *
   * Wichtig ist, dass hier dieselben Zahlen stehen wie in `systems/` - der
   * Radius wird aus dem Weltzustand gelesen, nicht noch einmal aufgeschrieben.
   * Sonst zeigt der Umriss etwas anderes an, als getroffen wird, und die
   * Anzeige wuerde luegen statt zu helfen.
   */
  private drawHitboxes(state: WorldState): void {
    const graphics = this.hitboxes;
    if (!graphics) {
      return;
    }

    graphics.clear();

    graphics.lineStyle(2, 0x66ff9f, 0.85);
    for (const player of state.players) {
      const position = this.simulation.renderPlayerPosition(player.id);
      graphics.strokeCircle(position.x, position.y, player.radius);
    }

    graphics.lineStyle(2, 0xff5a70, 0.85);
    for (const enemy of state.enemies) {
      const position = this.simulation.renderEnemyPosition(enemy.id, enemy.position);
      graphics.strokeCircle(position.x, position.y, enemy.radius);
    }

    graphics.lineStyle(2, 0xffe066, 0.9);
    for (const projectile of state.projectiles) {
      if (!projectile.active) {
        continue;
      }
      const position = this.simulation.renderProjectilePosition(
        projectile.position,
        projectile.velocity,
      );
      graphics.strokeCircle(position.x, position.y, projectile.radius);
      // Die Strecke, die es im naechsten Tick zuruecklegt - genau auf ihr wird
      // seit dem Umbau geprueft. Wer sie sieht, versteht die Trefferpruefung.
      graphics.lineBetween(
        position.x,
        position.y,
        position.x + projectile.velocity.x / 30,
        position.y + projectile.velocity.y / 30,
      );
    }
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
    this.barriers.destroy();
    this.bars.destroy();
    this.hitboxes?.destroy();
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

      const frame = ENEMY_FRAMES[enemy.type];
      if (this.enemyFrames[i] !== frame) {
        sprite.setTexture(ATLAS_KEY, frame);
        this.enemyFrames[i] = frame;
      }
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
      } else if (enemy.blinded > 0) {
        // Geblendet: hell und blass - er laeuft noch, greift aber nicht an.
        sprite.setTint(0xfff2a8);
      } else if (enemy.rooted > 0) {
        // Gewurzelt: kaltes Blau - er steht fest, greift aber weiter an.
        sprite.setTint(0x6fd3ff);
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
    const playerTrails: number[] = [];
    const enemyTrails: number[] = [];

    for (const projectile of state.projectiles) {
      if (!projectile.active) {
        continue;
      }

      const index = used;
      const sprite = this.projectileSprite(index);
      used += 1;

      const position = this.simulation.renderProjectilePosition(
        projectile.position,
        projectile.velocity,
      );
      const isPlayerShot = projectile.owner === "player";

      const frame = isPlayerShot ? FRAMES.bulletPlayer : FRAMES.bulletEnemy;
      if (this.projectileFrames[index] !== frame) {
        sprite.setTexture(ATLAS_KEY, frame);
        this.projectileFrames[index] = frame;
      }
      sprite.setPosition(position.x, position.y);
      sprite.setScale(projectile.radius / BULLET_RADIUS_IN_CELL);
      sprite.setVisible(true);

      // Spuranzeige: eine kurze Linie entgegen der Flugrichtung. Ohne sie wirken
      // schnelle Projektile wie einzelne Punkte, die springen. Erst sammeln,
      // dann in zwei Zuegen zeichnen - jeder Stilwechsel ist ein eigener
      // Zeichenaufruf, und davon will man nicht sechzig pro Bild.
      const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
      if (speed > 1) {
        const length = Math.min(34, speed * 0.05);
        (isPlayerShot ? playerTrails : enemyTrails).push(
          position.x,
          position.y,
          position.x - (projectile.velocity.x / speed) * length,
          position.y - (projectile.velocity.y / speed) * length,
        );
      }
    }

    this.drawTrails(playerTrails, COLORS.playerBullet);
    this.drawTrails(enemyTrails, COLORS.enemyBullet);

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

  /** Alle Spuren einer Farbe in einem Zug. */
  private drawTrails(points: readonly number[], color: number): void {
    if (points.length === 0) {
      return;
    }
    this.trails.lineStyle(8, color, 0.32);
    for (let i = 0; i < points.length; i += 4) {
      this.trails.lineBetween(
        points[i] ?? 0,
        points[i + 1] ?? 0,
        points[i + 2] ?? 0,
        points[i + 3] ?? 0,
      );
    }
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
