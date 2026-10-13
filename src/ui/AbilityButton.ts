/**
 * Der Knopf fuer die Faehigkeit, rechts unten im Gefecht.
 *
 * Ein rundes Pergamentschild mit dem Gesicht des Helden. Solange die Faehigkeit
 * sich auflaedt, liegt ein dunkler Tortenschnitt darueber, der kleiner wird,
 * und die Restsekunden stehen in der Mitte. Ist sie bereit, pulsiert der Knopf.
 *
 * Der Knopf zaehlt nur Druecke (`presses`). Die Szene gibt den Zaehler mit der
 * Bewegung an die Sitzung weiter; die Simulation entscheidet, ob ausgeloest wird.
 */

import Phaser from "phaser";
import { characterKey } from "../config/assets";
import { SAFE, VIEWPORT } from "../config/constants";
import { ABILITIES } from "../game/data/abilities";
import type { CharacterId } from "../game/types";
import { figureScale } from "./comicFigures";
import { FONT_TITLE, GOLD, INK, PAPER, wobblyRect } from "./paper";

const RADIUS = 44;
const DEPTH = 9400;

export class AbilityButton {
  presses = 0;
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly shade: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly seconds: Phaser.GameObjects.Text;
  private readonly hit: Phaser.GameObjects.Arc;
  private readonly container: Phaser.GameObjects.Container;
  private wasReady = false;
  private visible = true;

  constructor(
    private readonly scene: Phaser.Scene,
    character: CharacterId,
  ) {
    const x = VIEWPORT.width - SAFE.right - RADIUS - 22;
    const y = VIEWPORT.height - SAFE.bottom - RADIUS - 26;
    this.base = scene.add.graphics();
    this.drawBase(false);
    this.face = scene.add.image(0, 4, characterKey(character)).setScale(figureScale(0.95));
    this.shade = scene.add.graphics();
    this.seconds = scene.add
      .text(0, 2, "", { fontFamily: FONT_TITLE, fontSize: "34px", color: "#f4e4c1" })
      .setOrigin(0.5)
      .setStroke("#2b2320", 5);
    this.label = scene.add
      .text(0, RADIUS + 12, ABILITIES[character].name, {
        fontFamily: FONT_TITLE,
        fontSize: "16px",
        color: "#2b2320",
        backgroundColor: "#f4e4c1dd",
        padding: { x: 5, y: 1 },
      })
      .setOrigin(0.5);
    this.container = scene.add
      .container(x, y, [this.base, this.face, this.shade, this.seconds, this.label])
      .setDepth(DEPTH);

    this.hit = scene.add.circle(x, y, RADIUS + 10, 0x000000, 0).setDepth(DEPTH + 1).setInteractive({ useHandCursor: true });
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.presses += 1;
      this.scene.tweens.add({ targets: this.container, scale: 0.9, duration: 70, yoyo: true });
    });
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.setVisible(visible);
    this.hit.setVisible(visible);
    if (visible) {
      this.hit.setInteractive();
    } else {
      this.hit.disableInteractive();
    }
  }

  /** Jedes Bild: Restzeit zeigen. `total` ist die volle Abklingzeit. */
  update(cooldown: number, total: number, alive: boolean): void {
    if (!this.visible) {
      return;
    }
    const ready = cooldown <= 0.05 && alive;
    this.shade.clear();
    if (!ready) {
      const fraction = Phaser.Math.Clamp(cooldown / Math.max(0.1, total), 0, 1);
      this.shade.fillStyle(INK, 0.6);
      this.shade.slice(0, 0, RADIUS - 3, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2, false);
      this.shade.fillPath();
      this.seconds.setText(alive ? String(Math.ceil(cooldown)) : "");
    } else {
      this.seconds.setText("");
    }
    if (ready !== this.wasReady) {
      this.wasReady = ready;
      this.drawBase(ready);
      if (ready) {
        this.scene.tweens.add({ targets: this.container, scale: 1.12, duration: 140, yoyo: true, ease: "Quad.Out" });
      }
    }
  }

  destroy(): void {
    this.container.destroy();
    this.hit.destroy();
  }

  /** Pergamentscheibe mit dunklem Rand; bereit = goldener Ring aussen. */
  private drawBase(ready: boolean): void {
    const g = this.base;
    g.clear();
    g.fillStyle(INK, 0.25).fillCircle(2, 5, RADIUS);
    if (ready) {
      g.fillStyle(GOLD, 1).fillCircle(0, 0, RADIUS + 6);
      g.lineStyle(2.4, INK, 1).strokeCircle(0, 0, RADIUS + 6);
    }
    const ring = wobblyRect(-RADIUS, -RADIUS, RADIUS * 2, RADIUS * 2, RADIUS, 77, 1);
    g.fillStyle(PAPER, 1).fillPoints(ring, true);
    g.lineStyle(2.6, INK, 1).strokePoints(ring, true);
  }
}
