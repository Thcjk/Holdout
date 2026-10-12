/**
 * Ende der Runde: gewonnen oder verloren, mit ein paar Zahlen.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { PALETTE, SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { FINAL_WAVE } from "../game/data/enemies";
import { setReloadSafe } from "../platform/update";
import { Button } from "../ui/Button";
import { insetPanel, menuBackground, menuText, woodPanel } from "../ui/menuStyle";

interface ResultData {
  won: boolean;
  wave: number;
  kills: number;
  level: number;
  items: number;
  name: string;
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
    const { won, wave, kills, level, items } = this.data0;
    menuBackground(this);

    const title = won ? "Überlebt!" : "Das war's";
    menuText(this, cx, 70, title, 64, won ? PALETTE.gold : PALETTE.danger, true).setShadow(3, 5, UI.text.shadow, 6);
    menuText(
      this,
      cx,
      124,
      won ? `Alle ${FINAL_WAVE} Wellen geschafft.` : `Du bist in Welle ${wave} von ${FINAL_WAVE} gefallen.`,
      22,
      UI.text.body,
    );

    const rows: [string, string][] = [
      ["Welle", `${wave} / ${FINAL_WAVE}`],
      ["Besiegte Gegner", String(kills)],
      ["Level", String(level)],
      ["Gegenstände", String(items)],
    ];
    const width = Math.min(460, VIEWPORT.width - SAFE.left - SAFE.right - 40);
    woodPanel(this, cx, 270, width + 30, 230);
    rows.forEach(([label, value], index) => {
      const y = 190 + index * 52;
      insetPanel(this, cx, y, width, 42);
      this.add
        .text(cx - width / 2 + 16, y, label, { fontFamily: UI.font, fontSize: "20px", color: UI.text.dark, fontStyle: "bold" })
        .setOrigin(0, 0.5);
      this.add
        .text(cx + width / 2 - 16, y, value, { fontFamily: UI.font, fontSize: "22px", color: UI.text.dark, fontStyle: "bold" })
        .setOrigin(1, 0.5);
    });

    new Button(this, cx, 438, "Zum Menü", () => this.scene.start("Title"), { width: 320, height: 62, fontSize: 26 });
  }
}
