/**
 * Der Titelbildschirm: Abenddaemmerung vor der Feste Holdout.
 *
 * Links das Wappen-Logo und darunter die drei Wege ins Spiel, rechts im
 * Hintergrund die Burg (gemalt in `menuStyle`). Unten auf der Wiese stehen alle
 * sechs Helden in einer Reihe und wippen ungeduldig - wie auf einem Gruppenbild.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { characterKey } from "../config/assets";
import { SAFE, VIEWPORT } from "../config/constants";
import { CHARACTER_IDS } from "../game/data/characters";
import { Button } from "../ui/Button";
import { figureScale } from "../ui/comicFigures";
import { menuBackground } from "../ui/menuStyle";
import { FONT_HAND } from "../ui/paper";
import type { PlayMode } from "../app";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    menuBackground(this);

    // Der erste Tipp schaltet den Ton frei (Browser erlauben Ton nur nach einer Beruehrung).
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      audio.unlock();
      audio.setMusic("menu");
    });
    audio.setMusic("menu");

    const left = SAFE.left + 24;
    const right = VIEWPORT.width - SAFE.right;
    const column = left + 170;

    // --- Logo und Knoepfe links ----------------------------------------------
    const logo = this.add.image(column, 98, "logo").setDisplaySize(400, 160);
    this.tweens.add({ targets: logo, y: 94, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const choose = (mode: PlayMode): void => {
      audio.unlock();
      this.scene.start("Select", { mode });
    };
    new Button(this, column, 222, "Solo spielen", () => choose("solo"), { width: 300, height: 58, fontSize: 26 });
    new Button(this, column, 286, "Koop: Raum erstellen", () => choose("host"), {
      width: 300,
      height: 50,
      fontSize: 21,
      variant: "secondary",
    });
    new Button(this, column, 344, "Koop: Beitreten", () => choose("join"), {
      width: 300,
      height: 50,
      fontSize: 21,
      variant: "secondary",
    });

    const mute = new Button(
      this,
      right - 76,
      32,
      audio.isMuted ? "Ton: aus" : "Ton: an",
      () => {
        audio.unlock();
        const muted = audio.toggleMuted();
        mute.setText(muted ? "Ton: aus" : "Ton: an");
        if (!muted) {
          audio.setMusic("menu");
        }
      },
      { width: 116, height: 42, fontSize: 17, variant: "secondary" },
    );

    // --- Die Heldenreihe unten ---------------------------------------------------
    const rowLeft = left + 20;
    const rowRight = right - 30;
    const step = (rowRight - rowLeft) / CHARACTER_IDS.length;
    CHARACTER_IDS.forEach((id, index) => {
      const x = rowLeft + step * (index + 0.5);
      const hero = this.add
        .image(x, VIEWPORT.height - 14, characterKey(id))
        .setOrigin(0.5, 0.93)
        .setScale(figureScale(1.2));
      this.tweens.add({
        targets: hero,
        y: hero.y - 7,
        duration: 420 + index * 37,
        yoyo: true,
        repeat: -1,
        delay: index * 110,
        ease: "Quad.Out",
      });
    });

    this.add
      .text(right - 10, VIEWPORT.height - 6, `v${__APP_VERSION__}`, { fontFamily: FONT_HAND, fontSize: "14px", color: "#f4e4c1" })
      .setOrigin(1, 1)
      .setStroke("#2b2320", 3);
  }
}
