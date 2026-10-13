/**
 * Erfolge: alle Ziele auf einen Blick, erreichte golden, offene blass.
 *
 * Zwei Spalten mit je zehn Zeilen: Haken oder Schloss, Name, was zu tun ist,
 * und die Kristall-Belohnung. Oben die Zaehler (Erfolge, Laeufe, bester Lauf).
 */

import Phaser from "phaser";
import { SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { ACHIEVEMENTS } from "../meta/goals";
import { loadProfile } from "../meta/profile";
import { Button } from "../ui/Button";
import { insetPanel, menuBackground, menuText } from "../ui/menuStyle";

export class AchievementsScene extends Phaser.Scene {
  constructor() {
    super("Achievements");
  }

  create(): void {
    menuBackground(this);
    const profile = loadProfile();
    const left = SAFE.left + 20;
    const width = VIEWPORT.width - SAFE.left - SAFE.right - 40;
    const done = ACHIEVEMENTS.filter((achievement) => profile.achievements.includes(achievement.id)).length;

    menuText(this, VIEWPORT.width / 2, 32, `Erfolge  ${done} / ${ACHIEVEMENTS.length}`, 32, UI.text.title, true);
    new Button(this, left + 50, 32, "‹ Zurück", () => this.scene.start("Title"), { width: 100, height: 44, fontSize: 18, variant: "secondary" });
    menuText(
      this,
      VIEWPORT.width / 2,
      64,
      `Läufe: ${profile.totals.runs} · Beste Welle: ${profile.best.wave} · Monster: ${profile.totals.kills} · Siege: ${profile.totals.wins}`,
      16,
      UI.text.body,
      true,
    );

    const columns = 2;
    const gap = 12;
    const colW = (width - gap) / columns;
    const perColumn = Math.ceil(ACHIEVEMENTS.length / columns);
    const rowH = Math.min(44, (VIEWPORT.height - 96 - 12) / perColumn);
    ACHIEVEMENTS.forEach((achievement, index) => {
      const col = Math.floor(index / perColumn);
      const row = index % perColumn;
      const x = left + col * (colW + gap) + colW / 2;
      const y = 96 + row * rowH + rowH / 2;
      const reached = profile.achievements.includes(achievement.id);
      const panel = insetPanel(this, x, y, colW, rowH - 4);
      if (!reached) {
        panel.setAlpha(0.72);
      }
      const rx = x - colW / 2;
      if (reached) {
        this.add.circle(rx + 18, y, 11, 0xf0b23e).setStrokeStyle(2, 0x2a201b);
        this.add.text(rx + 18, y, "✓", { fontFamily: UI.font, fontSize: "15px", color: "#2a201b", fontStyle: "bold" }).setOrigin(0.5);
      } else {
        this.add.image(rx + 18, y, "lock").setDisplaySize(20, 20).setAlpha(0.8);
      }
      this.add
        .text(rx + 36, y - 8, achievement.name, { fontFamily: UI.font, fontSize: "16px", color: reached ? "#8a5a10" : UI.text.dark, fontStyle: "bold" })
        .setOrigin(0, 0.5);
      this.add
        .text(rx + 36, y + 9, achievement.text, { fontFamily: UI.font, fontSize: "12px", color: UI.text.body })
        .setOrigin(0, 0.5);
      this.add.image(x + colW / 2 - 18, y, "crystal").setDisplaySize(20, 20).setAlpha(reached ? 0.45 : 1);
      this.add
        .text(x + colW / 2 - 32, y, `+${achievement.reward}`, { fontFamily: UI.font, fontSize: "15px", color: reached ? UI.text.muted : "#2f6fa8", fontStyle: "bold" })
        .setOrigin(1, 0.5);
    });
  }
}
