/**
 * Einstellungen: Ton, Vollbild, App installieren, Spielstaende loeschen.
 *
 * Ton, Vollbild und Installieren sassen bis 2026-09-26 als kleine Knoepfe
 * unter der Charakterwahl. Mit dem Titelbildschirm haben sie hier ihren
 * eigenen Platz.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { CHARACTERS } from "../config/balance";
import { SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { isInstalledApp } from "../platform/device";
import {
  canPromptInstall,
  manualInstructions,
  needsManualInstructions,
  promptInstall,
} from "../platform/install";
import { setReloadSafe } from "../platform/update";
import { SLOT_COUNT, deleteSlot, listSlots } from "../storage/saveSlots";
import { Button } from "../ui/Button";
import { menuBackground, menuText, woodPanel } from "../ui/menuStyle";

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super("Settings");
  }

  create(): void {
    setReloadSafe(false);
    menuBackground(this);
    const centerX = VIEWPORT.width / 2;
    menuText(this, centerX, 52, "Einstellungen", 30, UI.text.title, true);

    const left = centerX - 170;
    const right = centerX + 170;
    woodPanel(this, left, 270, 310, 300);
    woodPanel(this, right, 270, 310, 300);
    menuText(this, left, 146, "Spiel", 18, UI.text.accent, true);
    menuText(this, right, 146, "Spielstände", 18, UI.text.accent, true);

    // --- Links: Ton, Vollbild, Installieren ---
    const sound: Button = new Button(
      this,
      left,
      200,
      audio.isMuted ? "Ton: aus" : "Ton: an",
      () => {
        audio.unlock();
        const muted = audio.toggleMuted();
        sound.setText(muted ? "Ton: aus" : "Ton: an");
        if (!muted) audio.setMusic("menu");
      },
      { width: 240, height: 48, fontSize: 18 },
    );

    if (this.sys.game.device.fullscreen.available) {
      const fullscreen: Button = new Button(
        this,
        left,
        262,
        this.scale.isFullscreen ? "Vollbild: an" : "Vollbild: aus",
        () => {
          if (this.scale.isFullscreen) {
            this.scale.stopFullscreen();
            fullscreen.setText("Vollbild: aus");
          } else {
            this.scale.startFullscreen();
            fullscreen.setText("Vollbild: an");
          }
        },
        { width: 240, height: 48, fontSize: 18 },
      );
    }

    if (!isInstalledApp() && (canPromptInstall() || needsManualInstructions())) {
      const install: Button = new Button(
        this,
        left,
        324,
        "App installieren",
        () => {
          if (canPromptInstall()) {
            void promptInstall().then((accepted) => {
              if (accepted) install.setVisible(false);
            });
            return;
          }
          this.showInstallInstructions();
        },
        { width: 240, height: 48, fontSize: 18 },
      );
    }

    // --- Rechts: Spielstaende loeschen (zwei Tipps) ---
    const slots = listSlots();
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      const save = slots[slot];
      const label = save ? `Platz ${slot + 1} löschen (${CHARACTERS[save.character].name})` : `Platz ${slot + 1}: leer`;
      let armed = false;
      const button: Button = new Button(
        this,
        right,
        200 + slot * 62,
        label,
        () => {
          if (!armed) {
            armed = true;
            button.setText("Wirklich löschen?");
            return;
          }
          deleteSlot(slot);
          button.setText(`Platz ${slot + 1}: leer`);
          button.setEnabled(false);
        },
        { width: 270, height: 48, fontSize: 15, variant: "secondary" },
      );
      button.setEnabled(save !== null);
    }

    new Button(this, SAFE.left + 92, VIEWPORT.height - SAFE.bottom - 34, "Zurück", () => this.scene.start("Title"), {
      width: 140,
      height: 40,
      fontSize: 16,
      variant: "secondary",
    });
  }

  /** Schritt-fuer-Schritt-Anleitung fuer das iPhone (dort gibt es keinen Knopf). */
  private showInstallInstructions(): void {
    const parts: { destroy(): void }[] = [];
    parts.push(
      this.add
        .rectangle(VIEWPORT.width / 2, VIEWPORT.height / 2, VIEWPORT.width, VIEWPORT.height, 0x1f1b14, 0.95)
        .setDepth(200)
        .setInteractive(),
    );
    parts.push(menuText(this, VIEWPORT.width / 2, 150, "Als App installieren", 28, UI.text.title, true).setDepth(201));
    parts.push(
      this.add
        .text(VIEWPORT.width / 2, 250, manualInstructions().join("\n"), {
          fontFamily: UI.font,
          fontSize: "18px",
          color: UI.text.body,
          align: "center",
          lineSpacing: 12,
        })
        .setOrigin(0.5)
        .setDepth(201),
    );
    const close: Button = new Button(
      this,
      VIEWPORT.width / 2,
      430,
      "Verstanden",
      () => {
        for (const part of parts) part.destroy();
        close.destroy();
      },
      { width: 220 },
    );
    close.setDepth(202);
  }
}
