/**
 * Laedt alle Grafiken und zeichnet die fehlenden Symbole, dann geht es zum Titel.
 */

import Phaser from "phaser";
import { SHEET_KEY, SHEET_PATH, SPACING, TILE } from "../config/assets";
import { UI_ATLAS, UI_ATLAS_IMAGE, UI_ATLAS_XML } from "../config/ui";
import { VIEWPORT } from "../config/constants";
import { createComicTextures } from "../ui/comic";
import { createIcons } from "../ui/icons";
import { FONT_HAND, waitForFonts } from "../ui/paper";
import { padAtlas } from "../ui/padAtlas";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    const text = this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height / 2, "Lädt …", {
        fontFamily: FONT_HAND,
        fontSize: "26px",
        color: "#1d1c19",
      })
      .setOrigin(0.5);
    this.load.on("progress", (value: number) => text.setText(`Lädt … ${Math.round(value * 100)} %`));

    this.load.spritesheet(SHEET_KEY, SHEET_PATH, {
      frameWidth: TILE,
      frameHeight: TILE,
      spacing: SPACING,
    });
    this.load.atlasXML(UI_ATLAS, UI_ATLAS_IMAGE, UI_ATLAS_XML);
  }

  create(): void {
    padAtlas(this.textures, UI_ATLAS);
    // Erst wenn die Handschriften da sind, wird gemalt - das Logo braucht sie.
    void waitForFonts().then(() => {
      createIcons(this);
      createComicTextures(this);
      this.scene.start("Title");
    });
  }
}
