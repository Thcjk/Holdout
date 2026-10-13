/**
 * Der Knopf fuer die Faehigkeit, rechts unten.
 *
 * Solange sich die Faehigkeit auflaedt, liegt ein dunkler Tortenschnitt darueber
 * und die Restsekunden stehen in der Mitte. Bereit: goldener Ring, der pulsiert.
 *
 * Der Knopf zaehlt nur Druecke (`presses`). Die Szene gibt den Zaehler mit der
 * Bewegung an die Sitzung; die Simulation entscheidet, ob ausgeloest wird.
 */

import Phaser from "phaser";
import { SAFE, VIEWPORT } from "../config/constants";
import { CREW } from "../game/data/crew";
import type { PlayerState } from "../game/types";
import { crewKey } from "./pixel/textures";
import { C, FONT_BODY, FONT_TITLE, T } from "./theme";
import { DEPTH } from "./world/view";

const RADIUS = 42;

export class AbilityButton {
  presses = 0;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly face: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly seconds: Phaser.GameObjects.Text;
  private readonly hit: Phaser.GameObjects.Arc;
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly crew: PlayerState["crew"],
  ) {
    this.ring = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.face = scene.add
      .image(0, 0, crewKey(crew))
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1)
      .setScale(0.9);
    this.label = scene.add
      .text(0, 0, CREW[crew].ability.name.toUpperCase(), {
        fontFamily: FONT_BODY,
        fontSize: "12px",
        color: T.light,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setStroke(T.outline, 3)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 2);
    this.seconds = scene.add
      .text(0, 0, "", { fontFamily: FONT_TITLE, fontSize: "34px", color: T.light })
      .setOrigin(0.5)
      .setStroke(T.outline, 5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 3);
    this.hit = scene.add
      .circle(0, 0, RADIUS + 6, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 4)
      .setInteractive();
    this.hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.presses += 1;
    });
    this.layout();
  }

  layout(): void {
    const x = VIEWPORT.width - SAFE.right - RADIUS - 22;
    const y = VIEWPORT.height - SAFE.bottom - RADIUS - 30;
    this.face.setPosition(x, y + 2);
    this.label.setPosition(x, y + RADIUS + 14);
    this.seconds.setPosition(x, y);
    this.hit.setPosition(x, y);
  }

  update(self: PlayerState | undefined, deltaMs: number): void {
    this.time += deltaMs / 1000;
    const x = this.hit.x;
    const y = this.hit.y;
    const g = this.ring;
    g.clear();
    const cooldown = CREW[this.crew].ability.cooldown;
    const left = self ? self.abilityCd : cooldown;
    const ready = !!self && self.alive && left <= 0;
    const pulse = ready ? 2 + Math.sin(this.time * 6) * 2 : 0;
    g.fillStyle(C.outline, 1).fillCircle(x, y, RADIUS + 4 + pulse);
    g.fillStyle(ready ? C.gold : C.bronzeDark, 1).fillCircle(x, y, RADIUS + pulse);
    g.fillStyle(C.stone, 1).fillCircle(x, y, RADIUS - 6);
    if (!ready && left > 0) {
      const share = left / cooldown;
      g.fillStyle(C.outline, 0.6);
      g.slice(x, y, RADIUS - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share, false).fillPath();
    }
    this.seconds.setText(!ready && left > 0 ? `${Math.ceil(left)}` : "");
    this.face.setAlpha(ready ? 1 : 0.55);
  }

  destroy(): void {
    this.ring.destroy();
    this.face.destroy();
    this.label.destroy();
    this.seconds.destroy();
    this.hit.destroy();
  }
}
