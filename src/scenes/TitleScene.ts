/**
 * Der Titelbildschirm: Solo spielen, Koop-Raum erstellen, Koop beitreten.
 */

import Phaser from "phaser";
import { SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { audio } from "../audio/AudioEngine";
import { Button } from "../ui/Button";
import { menuBackground, menuText } from "../ui/menuStyle";
import type { PlayMode } from "../app";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    const cx = VIEWPORT.width / 2;
    menuBackground(this);

    // Der erste Tipp schaltet den Ton frei (Browser erlauben Ton nur nach einer Beruehrung).
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      audio.unlock();
      audio.setMusic("menu");
    });
    audio.setMusic("menu");

    menuText(this, cx, 96, "HOLDOUT", 76, UI.text.accent, true).setShadow(3, 5, UI.text.shadow, 6);
    menuText(this, cx, 156, "Überlebe 20 Wellen. Kauf klug ein.", 22, UI.text.body);

    const choose = (mode: PlayMode): void => {
      audio.unlock();
      this.scene.start("Select", { mode });
    };

    new Button(this, cx, 250, "Solo spielen", () => choose("solo"), { width: 340, height: 64, fontSize: 26 });
    new Button(this, cx, 330, "Koop: Raum erstellen", () => choose("host"), {
      width: 340,
      height: 58,
      fontSize: 22,
      variant: "secondary",
    });
    new Button(this, cx, 400, "Koop: Beitreten", () => choose("join"), {
      width: 340,
      height: 58,
      fontSize: 22,
      variant: "secondary",
    });

    const mute = new Button(
      this,
      SAFE.left + 70,
      VIEWPORT.height - 40,
      audio.isMuted ? "Ton: aus" : "Ton: an",
      () => {
        audio.unlock();
        const muted = audio.toggleMuted();
        mute.setText(muted ? "Ton: aus" : "Ton: an");
        if (!muted) {
          audio.setMusic("menu");
        }
      },
      { width: 120, height: 44, fontSize: 18, variant: "secondary" },
    );

    menuText(this, VIEWPORT.width - SAFE.right - 60, VIEWPORT.height - 28, `v${__APP_VERSION__}`, 14, UI.text.muted);
  }
}
