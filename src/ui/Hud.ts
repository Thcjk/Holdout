/**
 * Die Anzeige im Gefecht: Leben, Erfahrung, Welle, Zeit, Material.
 *
 * Gezeichnet wird mit einer einzigen Graphics-Ebene und ein paar Texten, die
 * jedes Bild neu gesetzt werden - bei so wenigen Elementen ist das billiger als
 * jede Verwaltung dazu.
 */

import Phaser from "phaser";
import { PALETTE, SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { xpNeeded } from "../game/player";
import type { GameState, PlayerState } from "../game/types";

const DEPTH = 9500;

function label(scene: Phaser.Scene, size: number, color: string = PALETTE.hudText): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, "", { fontFamily: UI.font, fontSize: `${size}px`, color, fontStyle: "bold" })
    .setStroke("#1d1c19", 4)
    .setDepth(DEPTH + 1);
}

export class Hud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly goldIcon: Phaser.GameObjects.Image;
  private readonly mateTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(DEPTH);
    this.hpText = label(scene, 16);
    this.levelText = label(scene, 15, PALETTE.gold);
    this.waveText = label(scene, 18, "#f6ead2").setOrigin(0.5, 0);
    this.timeText = label(scene, 34).setOrigin(0.5, 0);
    this.goldText = label(scene, 22, PALETTE.gold).setOrigin(1, 0);
    this.goldIcon = scene.add.image(0, 0, "gem").setDisplaySize(24, 24).setDepth(DEPTH + 1);
    for (let i = 0; i < 3; i += 1) {
      this.mateTexts.push(label(scene, 13));
    }
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    for (const text of [this.hpText, this.levelText, this.waveText, this.timeText, this.goldText, ...this.mateTexts]) {
      text.setVisible(visible);
    }
    this.goldIcon.setVisible(visible);
  }

  update(state: GameState, self: PlayerState | undefined, selfId: string): void {
    const g = this.graphics;
    g.clear();
    const left = SAFE.left + 14;
    // Rechts bleibt Platz fuer den Pause-Knopf.
    const right = VIEWPORT.width - SAFE.right - 14 - 56;
    const centerX = VIEWPORT.width / 2;

    if (self) {
      // Leben: breiter Balken links oben.
      const width = 230;
      const hpFraction = Phaser.Math.Clamp(self.hp / self.stats.maxHp, 0, 1);
      g.fillStyle(0x1d1c19, 1).fillRoundedRect(left - 2, 8, width + 4, 28, 8);
      g.fillStyle(0x3e5558, 1).fillRoundedRect(left + 2, 12, width - 4, 20, 5);
      g.fillStyle(hpFraction > 0.3 ? 0xb5532f : 0xff6a2a, 1).fillRoundedRect(left + 2, 12, Math.max(0, (width - 4) * hpFraction), 20, 5);
      g.fillStyle(0xf0e4c8, 0.22).fillRoundedRect(left + 6, 14, Math.max(0, (width - 12) * hpFraction), 5, 2);
      this.hpText.setText(`${Math.ceil(Math.max(0, self.hp))} / ${Math.round(self.stats.maxHp)}`);
      this.hpText.setPosition(left + width / 2 - this.hpText.width / 2, 12);

      // Erfahrung: dünner Balken darunter.
      const xpFraction = Phaser.Math.Clamp(self.xp / xpNeeded(self.level), 0, 1);
      g.fillStyle(0x1d1c19, 1).fillRoundedRect(left - 2, 38, width + 4, 14, 5);
      g.fillStyle(0x3e5558, 1).fillRoundedRect(left + 1, 41, width - 2, 8, 3);
      g.fillStyle(0x4f9aa0, 1).fillRoundedRect(left + 1, 41, Math.max(0, (width - 2) * xpFraction), 8, 3);
      this.levelText.setText(`Lv ${self.level}`);
      this.levelText.setPosition(left + width + 8, 30);

      this.goldText.setText(String(self.gold));
      this.goldText.setPosition(right - 30, 12);
      this.goldIcon.setPosition(right - 12, 24);
    }

    this.waveText.setText(`Welle ${state.wave}`);
    this.waveText.setPosition(centerX, 8);
    this.timeText.setText(String(Math.max(0, Math.ceil(state.timeLeft))));
    this.timeText.setPosition(centerX, 26);
    this.timeText.setColor(state.timeLeft <= 5 ? PALETTE.danger : PALETTE.hudText);

    // Mitspieler: kleine Zeilen unter dem eigenen Balken.
    const mates = state.players.filter((player) => player.id !== selfId);
    this.mateTexts.forEach((text, index) => {
      const mate = mates[index];
      if (!mate) {
        text.setVisible(false);
        return;
      }
      const y = 56 + index * 20;
      const fraction = mate.alive ? Phaser.Math.Clamp(mate.hp / mate.stats.maxHp, 0, 1) : 0;
      g.fillStyle(0x1d1c19, 1).fillRoundedRect(left - 1, y + 1, 82, 12, 4);
      g.fillStyle(mate.alive ? 0xb5532f : 0x444444, 1).fillRoundedRect(left + 1, y + 3, 78 * fraction, 8, 3);
      text.setVisible(true);
      text.setText(mate.name);
      text.setPosition(left + 88, y - 1);
    });
  }
}
