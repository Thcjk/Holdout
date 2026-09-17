/**
 * "Juice" - die kleinen Effekte, die ein technisch korrektes Spiel lebendig machen.
 *
 * Laut Briefing (Abschnitt 3) haben sie die groesste Wirkung pro Zeile Code.
 * Wichtig ist die Dosierung: Ein Bildschirmwackeln von 2 bis 4 Pixeln ist ein
 * Treffergefuehl, eines von 20 Pixeln ist Seekrankheit.
 *
 * Alles hier ist reine Darstellung. Die Simulation weiss davon nichts, sie meldet
 * nur, was passiert ist.
 */

import Phaser from "phaser";
import { COLORS, DEPTH } from "../config/constants";
import { ATLAS_KEY, FRAMES } from "../assets/textures";
import type { GameEvent } from "../systems/types";

/** Wie viele Schadenszahlen gleichzeitig hoechstens sichtbar sind. */
const DAMAGE_TEXT_POOL_SIZE = 24;

export class Juice {
  private readonly damageTexts: Phaser.GameObjects.Text[] = [];
  private nextDamageText = 0;
  private readonly deathParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly hitParticles: Phaser.GameObjects.Particles.ParticleEmitter;

  /** Zeitlupe: 1 = normal, kleiner = langsamer. */
  private timeScale = 1;
  private hitstopRemaining = 0;

  constructor(private readonly scene: Phaser.Scene) {
    // Textobjekte sind teuer. Sie werden - wie die Projektile - gepoolt.
    for (let i = 0; i < DAMAGE_TEXT_POOL_SIZE; i += 1) {
      const text = scene.add.text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#fff2a8",
        fontStyle: "bold",
      });
      text.setOrigin(0.5);
      text.setDepth(DEPTH.damageNumbers);
      text.setActive(false).setVisible(false);
      this.damageTexts.push(text);
    }

    this.deathParticles = scene.add.particles(0, 0, ATLAS_KEY, {
      frame: FRAMES.dot,
      lifespan: 420,
      speed: { min: 60, max: 220 },
      scale: { start: 1.1, end: 0 },
      quantity: 10,
      emitting: false,
    });
    this.deathParticles.setDepth(DEPTH.particles);

    this.hitParticles = scene.add.particles(0, 0, ATLAS_KEY, {
      frame: FRAMES.spark,
      lifespan: 200,
      speed: { min: 40, max: 120 },
      scale: { start: 0.8, end: 0 },
      quantity: 3,
      emitting: false,
    });
    this.hitParticles.setDepth(DEPTH.particles);
  }

  /**
   * Zeitfaktor fuer die Simulation. Beim Super wird das Spiel kurz langsamer -
   * ein "Zucken" von etwa 80 Millisekunden, das den Moment betont.
   */
  get currentTimeScale(): number {
    return this.timeScale;
  }

  update(deltaMs: number): void {
    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining -= deltaMs;
      if (this.hitstopRemaining <= 0) {
        this.timeScale = 1;
      }
    }
  }

  /** Wertet die Ereignisse eines Bildes aus und macht daraus Effekte. */
  handle(events: readonly GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "shot":
          if (event.owner === "player") {
            this.shake(0.0018, 60);
          }
          break;
        case "hit":
          this.damageNumber(event.x, event.y, event.damage);
          this.hitParticles.emitParticleAt(event.x, event.y, 3);
          break;
        case "enemyDied":
          this.shake(event.isBoss ? 0.006 : 0.003, event.isBoss ? 220 : 110);
          this.deathParticles.emitParticleAt(event.x, event.y, event.isBoss ? 24 : 12);
          break;
        case "playerHit":
          this.shake(0.005, 140);
          this.scene.cameras.main.flash(120, 255, 84, 112, false);
          break;
        case "playerDown":
          this.shake(0.01, 320);
          break;
        case "spawnWarning":
          this.spawnWarning(event.x, event.y);
          break;
        case "superUsed":
          this.hitstop(80);
          this.shake(0.008, 200);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Warnmarkierung, eine Sekunde bevor an dieser Stelle ein Gegner erscheint.
   * Ohne sie waere jeder Spawn ein Hinterhalt - und das waere nur unfair, nicht spannend.
   */
  spawnWarning(x: number, y: number): void {
    const marker = this.scene.add.circle(x, y, 26, COLORS.danger, 0.22);
    marker.setStrokeStyle(3, COLORS.danger, 0.9);
    marker.setDepth(DEPTH.spawnWarning);

    this.scene.tweens.add({
      targets: marker,
      scale: { from: 0.4, to: 1.25 },
      alpha: { from: 1, to: 0.15 },
      duration: 1000,
      ease: "Quad.easeOut",
      onComplete: () => marker.destroy(),
    });
  }

  /** Dezentes Wackeln. `intensity` ist ein Bruchteil der Bildschirmbreite. */
  shake(intensity: number, durationMs: number): void {
    this.scene.cameras.main.shake(durationMs, intensity, false);
  }

  /** Kurze Zeitlupe. */
  hitstop(durationMs: number): void {
    this.timeScale = 0.25;
    this.hitstopRemaining = durationMs;
  }

  /** Eine Schadenszahl, die kurz nach oben schwebt und verblasst. */
  damageNumber(x: number, y: number, amount: number): void {
    const text = this.damageTexts[this.nextDamageText];
    this.nextDamageText = (this.nextDamageText + 1) % this.damageTexts.length;
    if (!text) {
      return;
    }

    this.scene.tweens.killTweensOf(text);
    text.setText(String(amount));
    text.setColor(amount >= 600 ? "#ffd166" : "#fff2a8");
    text.setPosition(x + Phaser.Math.Between(-10, 10), y - 12);
    text.setAlpha(1);
    text.setScale(1);
    text.setActive(true).setVisible(true);

    this.scene.tweens.add({
      targets: text,
      y: text.y - 36,
      alpha: 0,
      scale: 1.25,
      duration: 620,
      ease: "Quad.easeOut",
      onComplete: () => text.setActive(false).setVisible(false),
    });
  }

  destroy(): void {
    for (const text of this.damageTexts) {
      text.destroy();
    }
    this.deathParticles.destroy();
    this.hitParticles.destroy();
  }
}
