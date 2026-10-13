/**
 * Ende des Laufs: gewonnen oder verloren, ein paar Zahlen - und was der Lauf
 * fuer den Fortschritt gebracht hat: Kristalle, neue Erfolge, neue Helden.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { characterKey } from "../config/assets";
import { PALETTE, SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { CHARACTERS } from "../game/data/characters";
import { FINAL_WAVE } from "../game/data/enemies";
import type { RunReport } from "../meta/goals";
import { loadProfile } from "../meta/profile";
import { setReloadSafe } from "../platform/update";
import { Button } from "../ui/Button";
import { figureScale } from "../ui/comicFigures";
import { insetPanel, menuBackground, menuText, woodPanel } from "../ui/menuStyle";

interface ResultData {
  won: boolean;
  wave: number;
  kills: number;
  level: number;
  items: number;
  name: string;
  report?: RunReport | null;
}

export class ResultScene extends Phaser.Scene {
  private data0: ResultData = { won: false, wave: 1, kills: 0, level: 0, items: 0, name: "" };

  constructor() {
    super("Result");
  }

  init(data: ResultData): void {
    this.data0 = data;
  }

  create(): void {
    setReloadSafe(true);
    audio.setMusic("menu");
    const cx = VIEWPORT.width / 2;
    const { won, wave, kills, level, items, report } = this.data0;
    menuBackground(this);

    const title = won ? "Überlebt!" : "Gefallen!";
    menuText(this, cx, 46, title, 56, won ? PALETTE.gold : PALETTE.danger, true);
    menuText(
      this,
      cx,
      90,
      won ? `Alle ${FINAL_WAVE} Wellen gehalten - die Feste steht.` : `Du bist in Welle ${wave} von ${FINAL_WAVE} gefallen.`,
      20,
      UI.text.body,
    );

    const usable = VIEWPORT.width - SAFE.left - SAFE.right - 40;
    const panelW = Math.min(440, (usable - 20) / 2);
    const leftX = cx - panelW / 2 - 10;
    const rightX = cx + panelW / 2 + 10;
    const top = 116;
    const panelH = 316;

    // --- Links: Zahlen des Laufs
    woodPanel(this, leftX, top + panelH / 2, panelW, panelH);
    menuText(this, leftX, top + 28, "Dein Lauf", 24, UI.text.accent, true);
    const rows: [string, string][] = [
      ["Welle", `${wave} / ${FINAL_WAVE}`],
      ["Besiegte Monster", String(kills)],
      ["Stufe", String(level)],
      ["Gegenstände", String(items)],
    ];
    const rowW = panelW - 40;
    rows.forEach(([label, value], index) => {
      const y = top + 74 + index * 54;
      insetPanel(this, leftX, y, rowW, 44);
      this.add
        .text(leftX - rowW / 2 + 14, y, label, { fontFamily: UI.font, fontSize: "19px", color: UI.text.dark, fontStyle: "bold" })
        .setOrigin(0, 0.5);
      this.add
        .text(leftX + rowW / 2 - 14, y, value, { fontFamily: UI.font, fontSize: "21px", color: UI.text.dark, fontStyle: "bold" })
        .setOrigin(1, 0.5);
    });

    // --- Rechts: Fortschritt
    woodPanel(this, rightX, top + panelH / 2, panelW, panelH);
    menuText(this, rightX, top + 28, "Belohnung", 24, UI.text.accent, true);
    if (report) {
      this.add.image(rightX - 52, top + 72, "crystal").setDisplaySize(40, 40);
      menuText(this, rightX + 14, top + 72, `+${report.crystals}`, 34, "#2f6fa8", true);
      report.parts.forEach(([label, value], index) => {
        menuText(this, rightX, top + 108 + index * 20, `${label}: +${value}`, 15, UI.text.muted);
      });

      let y = top + 120 + report.parts.length * 20;
      if (report.unlocked.length > 0) {
        for (const id of report.unlocked) {
          this.add.image(rightX - panelW / 2 + 52, y + 26, characterKey(id)).setScale(figureScale(0.7));
          this.add
            .text(rightX - panelW / 2 + 92, y + 26, `Neuer Held frei:\n${CHARACTERS[id].name}!`, {
              fontFamily: UI.font,
              fontSize: "18px",
              color: "#4e6b2a",
              fontStyle: "bold",
            })
            .setOrigin(0, 0.5);
          y += 58;
        }
      }
      if (report.achievements.length > 0) {
        menuText(this, rightX, y + 10, "Neue Erfolge", 18, UI.text.accent, true);
        y += 30;
        const room = Math.max(1, Math.floor((top + panelH - 34 - y) / 22));
        const overflow = report.achievements.length > room;
        const shown = report.achievements.slice(0, overflow ? room - 1 : room);
        for (const achievement of shown) {
          this.add.image(rightX + panelW / 2 - 36, y + 1, "crystal").setDisplaySize(18, 18);
          this.add
            .text(rightX - panelW / 2 + 24, y, achievement.name, { fontFamily: UI.font, fontSize: "17px", color: UI.text.dark, fontStyle: "bold" })
            .setOrigin(0, 0.5);
          this.add
            .text(rightX + panelW / 2 - 48, y, `+${achievement.reward}`, { fontFamily: UI.font, fontSize: "16px", color: "#2f6fa8", fontStyle: "bold" })
            .setOrigin(1, 0.5);
          y += 22;
        }
        if (overflow) {
          menuText(this, rightX, y, `… und ${report.achievements.length - shown.length} weitere (siehe Erfolge)`, 15, UI.text.muted);
        }
      }
      menuText(this, rightX, top + panelH - 22, `Kristalle gesamt: ${loadProfile().crystals}`, 16, UI.text.muted, true);
    } else {
      menuText(this, rightX, top + 120, "Diesmal gab es nichts einzutragen.", 16, UI.text.muted);
    }

    new Button(this, cx - 170, 482, "Zum Menü", () => this.scene.start("Title"), { width: 300, height: 58, fontSize: 24, variant: "secondary" });
    new Button(this, cx + 170, 482, "Zur Schmiede", () => this.scene.start("Forge"), { width: 300, height: 58, fontSize: 24 });
  }
}
