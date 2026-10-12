/**
 * Der Titelbildschirm, gebaut wie ein Buch- oder Filmplakat:
 *
 * links oben der Schriftzug und ein kurzer Satz in Handschrift, darunter die
 * drei Wege ins Spiel; rechts steht der Held auf einer Klippe und schaut auf
 * den dunklen Berg mit der Burg (der liegt im Hintergrund, `menuStyle`).
 * Unten ein dunkles Band mit kleinen Stichworten - wie auf einem Plakat.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { characterKey } from "../config/assets";
import { SAFE, VIEWPORT } from "../config/constants";
import { Button } from "../ui/Button";
import { figureScale } from "../ui/comicFigures";
import { menuBackground } from "../ui/menuStyle";
import { FONT_HAND } from "../ui/paper";
import type { PlayMode } from "../app";

const INK = "#1d1c19";
const RUST = "#b5532f";
const CREAM = "#f1e5c9";

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

    const left = SAFE.left + 34;
    const right = VIEWPORT.width - SAFE.right;

    // --- Rechts: Held auf der Klippe -----------------------------------------
    const cliffScale = 0.66;
    // Die Klippe ragt von unten in die Mitte, ihre Spitze zeigt zum Berg rechts.
    const cliffRight = Math.max(left + 640, VIEWPORT.width * 0.66);
    const cliffBottom = VIEWPORT.height - 36;
    this.add.image(cliffRight, cliffBottom, "title-cliff").setOrigin(1, 1).setScale(cliffScale);
    const ground = cliffBottom - 300 * cliffScale + 98 * cliffScale;
    const hero = this.add
      .image(cliffRight - 175, ground + 4, characterKey("soeldner"))
      .setOrigin(0.5, 0.93)
      .setScale(figureScale(1.7));
    const friend = this.add
      .image(cliffRight - 255, ground + 6, characterKey("glueckspilz"))
      .setOrigin(0.5, 0.93)
      .setScale(figureScale(1.05));
    // Ruhiges Atmen und ein Wehen im Wind.
    this.tweens.add({ targets: hero, scaleY: hero.scaleY * 1.025, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({ targets: friend, scaleY: friend.scaleY * 1.03, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: 300 });

    // --- Links: Schriftzug, Satz, Knoepfe ------------------------------------
    this.add.image(left - 34, 6, "logo").setOrigin(0, 0).setDisplaySize(450, 150);

    const line = { fontFamily: FONT_HAND, fontSize: "19px", color: INK };
    this.add.text(left, 166, "MANCHMAL IST DER EINZIGE WEG", line);
    const second = this.add.text(left, 190, "NACH VORN:", line);
    this.add.text(left + second.width + 6, 190, "STANDHALTEN.", { ...line, color: RUST });

    const choose = (mode: PlayMode): void => {
      audio.unlock();
      this.scene.start("Select", { mode });
    };
    const column = left + 150;
    new Button(this, column, 262, "Solo spielen", () => choose("solo"), { width: 300, height: 56, fontSize: 26 });
    new Button(this, column, 324, "Koop: Raum erstellen", () => choose("host"), {
      width: 300,
      height: 48,
      fontSize: 21,
      variant: "secondary",
    });
    new Button(this, column, 380, "Koop: Beitreten", () => choose("join"), {
      width: 300,
      height: 48,
      fontSize: 21,
      variant: "secondary",
    });

    const mute = new Button(
      this,
      right - 76,
      30,
      audio.isMuted ? "Ton: aus" : "Ton: an",
      () => {
        audio.unlock();
        const muted = audio.toggleMuted();
        mute.setText(muted ? "Ton: aus" : "Ton: an");
        if (!muted) {
          audio.setMusic("menu");
        }
      },
      { width: 110, height: 38, fontSize: 17, variant: "secondary" },
    );

    // --- Unten: dunkles Band mit Stichworten ----------------------------------
    const bandTop = VIEWPORT.height - 36;
    this.add.rectangle(0, bandTop, VIEWPORT.width, 36, 0x1d1c19).setOrigin(0);
    const items = ["KÄMPFEN. SAMMELN. ÜBERLEBEN.", "6 HELDEN", "20 WELLEN", "SOLO ODER ZU VIERT"];
    const span = right - 90 - left;
    items.forEach((label, index) => {
      const x = left + (span / items.length) * index;
      this.add.image(x + 7, bandTop + 18, index === 0 ? "heart" : "gem").setDisplaySize(14, 14);
      this.add
        .text(x + 20, bandTop + 18, label, { fontFamily: FONT_HAND, fontSize: "15px", color: CREAM })
        .setOrigin(0, 0.5);
    });
    this.add
      .text(right - 14, bandTop + 18, `v${__APP_VERSION__}`, { fontFamily: FONT_HAND, fontSize: "14px", color: "#a89a76" })
      .setOrigin(1, 0.5);
  }
}
