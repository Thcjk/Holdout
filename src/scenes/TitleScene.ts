/**
 * Titelbildschirm: Die Wanderfestung stapft durch die Wueste, der Schrauber
 * steht auf dem Deck. Darueber der Schriftzug, darunter die Knoepfe.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { SAFE, VIEWPORT } from "../config/constants";
import { ELEVATION, FORT_SPEED, RESPAWN_SPOT } from "../game/constants";
import { setReloadSafe } from "../platform/update";
import { Button } from "../ui/Button";
import { crewKey, armyKey } from "../ui/pixel/textures";
import { FONT_BODY, FONT_TITLE, T } from "../ui/theme";
import { FortressView } from "../ui/world/FortressView";
import { GroundView } from "../ui/world/GroundView";
import { deckDepth, followFort } from "../ui/world/view";

export class TitleScene extends Phaser.Scene {
  private fort = { x: 0, y: 0, gait: 0, moving: true };
  private ground!: GroundView;
  private fortress!: FortressView;
  private mech!: Phaser.GameObjects.Image;
  private chasers: Phaser.GameObjects.Image[] = [];

  constructor() {
    super("Title");
  }

  create(): void {
    setReloadSafe(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setReloadSafe(false));
    this.fort = { x: 0, y: 0, gait: 0, moving: true };
    this.ground = new GroundView(this);
    this.fortress = new FortressView(this);
    this.mech = this.add
      .image(0, 0, crewKey("schrauber"))
      .setOrigin(0.5, 62 / 64)
      .setFlipX(true);
    // Hinten holt die goldene Armee auf.
    this.chasers = [0, 1, 2, 3].map((i) =>
      this.add
        .image(0, 0, armyKey("laeufer"))
        .setOrigin(0.5, 46 / 48)
        .setData("i", i),
    );

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      audio.unlock();
      audio.setMusic("menu");
    });
    audio.setMusic("menu");

    const w = VIEWPORT.width;
    const title = this.add
      .text(w / 2, SAFE.top + 46, "HOLDOUT", {
        fontFamily: FONT_TITLE,
        fontSize: "96px",
        color: T.gold,
      })
      .setOrigin(0.5)
      .setStroke(T.outline, 10)
      .setShadow(0, 6, "#5e3a14", 0, true, true)
      .setScrollFactor(0)
      .setDepth(9000);
    this.add
      .text(w / 2, SAFE.top + 104, "DIE WANDERFESTUNG", {
        fontFamily: FONT_TITLE,
        fontSize: "36px",
        color: T.light,
      })
      .setOrigin(0.5)
      .setStroke(T.outline, 7)
      .setScrollFactor(0)
      .setDepth(9000);
    this.tweens.add({
      targets: title,
      y: title.y - 3,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    const bottom = VIEWPORT.height - SAFE.bottom;
    const start = new Button(
      this,
      w / 2,
      bottom - 92,
      "LOSZIEHEN",
      () => {
        audio.unlock();
        this.scene.start("Game");
      },
      { width: 280, height: 60, fontSize: 28 },
    );
    const koop = new Button(this, w / 2 - 74, bottom - 34, "KOOP · BALD", () => undefined, {
      width: 140,
      height: 42,
      fontSize: 16,
      variant: "secondary",
    });
    koop.setEnabled(false);
    const mute = new Button(
      this,
      w / 2 + 74,
      bottom - 34,
      audio.isMuted ? "TON: AUS" : "TON: AN",
      () => {
        audio.unlock();
        const muted = audio.toggleMuted();
        mute.setText(muted ? "TON: AUS" : "TON: AN");
        if (!muted) {
          audio.setMusic("menu");
        }
      },
      { width: 140, height: 42, fontSize: 16, variant: "secondary" },
    );
    for (const button of [start, koop, mute]) {
      button.setScrollFactor(0);
      button.setDepth(9000);
    }
    this.add
      .text(
        w - SAFE.right - 10,
        VIEWPORT.height - SAFE.bottom - 6,
        `v${__APP_VERSION__} · Probelauf (Baustufe 2 von 6)`,
        {
          fontFamily: FONT_BODY,
          fontSize: "13px",
          color: T.muted,
        },
      )
      .setOrigin(1, 1)
      .setStroke(T.outline, 3)
      .setScrollFactor(0)
      .setDepth(9000);
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.fort.x += FORT_SPEED * dt;
    this.fort.gait += dt;
    followFort(this.cameras.main, this.fort.x);
    this.ground.update(this.cameras.main);
    this.fortress.update(this.fort, delta);
    this.mech
      .setPosition(this.fort.x + RESPAWN_SPOT.x, this.fort.y + RESPAWN_SPOT.y - ELEVATION)
      .setDepth(deckDepth(RESPAWN_SPOT.y));
    for (const chaser of this.chasers) {
      const i = chaser.getData("i") as number;
      const bob = Math.abs(Math.sin(time / 90 + i)) * 2;
      const x = this.fort.x - 250 + i * 46 + Math.sin(time / 900 + i) * 14;
      const y = 150 + (i % 2) * 70 - i * 16;
      chaser.setPosition(x, y - bob).setDepth(y);
    }
  }
}
