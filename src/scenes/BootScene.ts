/**
 * Wartet auf die Pixelschriften, malt alle Bilder (es gibt keine Bilddateien)
 * und geht zum Titel.
 */

import Phaser from "phaser";
import { VIEWPORT } from "../config/constants";
import { createPixelTextures } from "../ui/pixel/textures";
import { FONT_BODY, T, waitForFonts } from "../ui/theme";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height / 2, "Die Festung erwacht …", {
        fontFamily: FONT_BODY,
        fontSize: "24px",
        color: T.light,
      })
      .setOrigin(0.5);
    void waitForFonts().then(() => {
      // Ein Bild Zeit lassen, damit der Text oben erscheint, bevor das Malen beginnt.
      this.time.delayedCall(30, () => {
        createPixelTextures(this);
        this.scene.start("Title");
      });
    });
  }
}
