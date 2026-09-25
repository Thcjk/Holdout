/**
 * Solo oder Koop - nach "Neu" bzw. nach dem Laden eines Stands ohne
 * laufenden Run. Danach kommt die Charakterwahl (`MenuScene`).
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { CHARACTERS } from "../config/balance";
import { SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { setReloadSafe } from "../platform/update";
import { activeCharacterOr, currentSlot } from "../storage/saveSlots";
import { Button } from "../ui/Button";
import { menuBackground, menuText, woodPanel } from "../ui/menuStyle";

export class ModeScene extends Phaser.Scene {
  constructor() {
    super("Mode");
  }

  create(): void {
    setReloadSafe(false);
    menuBackground(this);
    const centerX = VIEWPORT.width / 2;
    menuText(this, centerX, 52, "Wie willst du spielen?", 30, UI.text.title, true);
    const slot = currentSlot();
    if (slot !== null) {
      menuText(
        this,
        centerX,
        88,
        `Platz ${slot + 1} · ${CHARACTERS[activeCharacterOr("scout")].name}`,
        15,
        UI.text.muted,
      );
    }

    const offset = Math.min(200, VIEWPORT.width / 4);
    this.option(centerX - offset, "Solo", "Allein über die Karte. Der Run wird nach jedem Gebiet gespeichert.", false);
    this.option(
      centerX + offset,
      "Koop",
      "Mit bis zu drei Freunden. Jeder bringt sein Lager mit; den Run hält der Host.",
      true,
    );

    new Button(this, SAFE.left + 92, VIEWPORT.height - SAFE.bottom - 34, "Zurück", () => this.scene.start("Title"), {
      width: 140,
      height: 40,
      fontSize: 16,
      variant: "secondary",
    });
  }

  private option(x: number, title: string, text: string, coop: boolean): void {
    const width = 340;
    woodPanel(this, x, 270, width, 250);
    menuText(this, x, 190, title, 30, UI.text.title, true);
    this.add
      .text(x, 262, text, {
        fontFamily: UI.font,
        fontSize: "15px",
        color: UI.text.body,
        align: "center",
        lineSpacing: 5,
        wordWrap: { width: width - 60 },
      })
      .setOrigin(0.5)
      .setShadow(1, 1, UI.text.shadow, 2);
    new Button(
      this,
      x,
      346,
      title === "Solo" ? "Allein los" : "Zusammen",
      () => {
        audio.unlock();
        this.scene.start("Menu", { coop });
      },
      { width: width - 80 },
    );
  }
}
