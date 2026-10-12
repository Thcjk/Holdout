/**
 * Die Anzeige im Gefecht: Leben, Erfahrung, Welle, Zeit, Material.
 *
 * Wie auf dem Papier gezeichnet: ein Herz neben einem Balken mit wackelndem
 * Tuscherand, die Zeit in grosser Handschrift. Gezeichnet wird mit einer
 * einzigen Graphics-Ebene und ein paar Texten, die jedes Bild neu gesetzt werden.
 */

import Phaser from "phaser";
import { PALETTE, SAFE, VIEWPORT } from "../config/constants";
import { xpNeeded } from "../game/player";
import type { GameState, PlayerState } from "../game/types";
import { BOX, ComicBox } from "./ComicBox";
import { FONT_HAND, FONT_TITLE, INK, PAPER_DARK, RUST, wobblyRect } from "./paper";

const DEPTH = 9500;
const TEAL = 0x4f8a8e;

function label(scene: Phaser.Scene, size: number, color: string = PALETTE.hudText, font = FONT_HAND): Phaser.GameObjects.Text {
  return scene.add.text(0, 0, "", { fontFamily: font, fontSize: `${size}px`, color }).setDepth(DEPTH + 1);
}

/** Ein Balken mit wackelndem Tuscherand; der Rand haengt am Startwert und bleibt ruhig. */
function inkBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fraction: number, color: number, seed: number): void {
  const frame = wobblyRect(x, y, w, h, h / 2, seed, 0.9);
  g.fillStyle(PAPER_DARK, 1).fillPoints(frame, true);
  if (fraction > 0.01) {
    g.fillStyle(color, 1).fillPoints(wobblyRect(x + 2, y + 2, Math.max(h - 4, (w - 4) * fraction), h - 4, (h - 4) / 2, seed + 1, 0.5), true);
    // feine Schraffur auf der Fuellung
    g.lineStyle(1, INK, 0.18);
    for (let sx = x + 6; sx < x + 2 + (w - 4) * fraction; sx += 6) {
      g.lineBetween(sx, y + h - 3, sx + 4, y + 3);
    }
  }
  g.lineStyle(2.2, INK, 1).strokePoints(frame, true);
}

export class Hud {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly heart: Phaser.GameObjects.Image;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly goldIcon: Phaser.GameObjects.Image;
  private readonly mateTexts: Phaser.GameObjects.Text[] = [];
  /** Papierschilder unter den Anzeigen - damit sie sich von den Baeumen am Rand abheben. */
  private readonly plaques: ComicBox[];

  constructor(scene: Phaser.Scene) {
    this.plaques = [
      new ComicBox(scene, BOX.panel, 0, 0, 316, 52).setDepth(DEPTH - 1),
      new ComicBox(scene, BOX.panel, 0, 0, 92, 58).setDepth(DEPTH - 1),
      new ComicBox(scene, BOX.panel, 0, 0, 96, 40).setDepth(DEPTH - 1),
    ];
    this.graphics = scene.add.graphics().setDepth(DEPTH);
    this.heart = scene.add.image(0, 0, "heart").setDisplaySize(30, 30).setDepth(DEPTH + 1);
    this.hpText = label(scene, 17).setOrigin(0.5, 0.5);
    this.levelText = label(scene, 16, "#3a6a6e");
    this.waveText = label(scene, 17).setOrigin(0.5, 0);
    this.timeText = label(scene, 38, PALETTE.hudText, FONT_TITLE).setOrigin(0.5, 0);
    this.goldText = label(scene, 26, "#7a5a14", FONT_TITLE).setOrigin(1, 0);
    this.goldIcon = scene.add.image(0, 0, "gem").setDisplaySize(26, 26).setDepth(DEPTH + 1);
    for (let i = 0; i < 3; i += 1) {
      this.mateTexts.push(label(scene, 14));
    }
  }

  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
    for (const text of [this.hpText, this.levelText, this.waveText, this.timeText, this.goldText, ...this.mateTexts]) {
      text.setVisible(visible);
    }
    this.goldIcon.setVisible(visible);
    this.heart.setVisible(visible);
    for (const plaque of this.plaques) {
      plaque.setVisible(visible);
    }
  }

  update(state: GameState, self: PlayerState | undefined, selfId: string): void {
    const g = this.graphics;
    g.clear();
    const left = SAFE.left + 14;
    // Rechts bleibt Platz fuer den Pause-Knopf.
    const right = VIEWPORT.width - SAFE.right - 14 - 56;
    const centerX = VIEWPORT.width / 2;
    const [hpPlaque, timePlaque, goldPlaque] = this.plaques as [ComicBox, ComicBox, ComicBox];
    hpPlaque.setPosition(left + 150, 29);
    timePlaque.setPosition(centerX, 30);
    goldPlaque.setPosition(right - 34, 25);

    if (self) {
      const barX = left + 30;
      const width = 210;
      const hpFraction = Phaser.Math.Clamp(self.hp / self.stats.maxHp, 0, 1);
      this.heart.setPosition(left + 12, 22);
      inkBar(g, barX, 10, width, 24, hpFraction, hpFraction > 0.3 ? RUST : 0xd9772a, 11);
      this.hpText.setText(`${Math.ceil(Math.max(0, self.hp))} / ${Math.round(self.stats.maxHp)}`);
      this.hpText.setPosition(barX + width / 2, 21);

      const xpFraction = Phaser.Math.Clamp(self.xp / xpNeeded(self.level), 0, 1);
      inkBar(g, barX, 38, width, 11, xpFraction, TEAL, 23);
      this.levelText.setText(`Lv ${self.level}`);
      this.levelText.setPosition(barX + width + 8, 32);

      this.goldText.setText(String(self.gold));
      this.goldText.setPosition(right - 30, 6);
      this.goldIcon.setPosition(right - 12, 24);
    }

    this.waveText.setText(`WELLE ${state.wave}`);
    this.waveText.setPosition(centerX, 2);
    this.timeText.setText(String(Math.max(0, Math.ceil(state.timeLeft))));
    this.timeText.setPosition(centerX, 16);
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
      inkBar(g, left, y + 1, 82, 12, fraction, mate.alive ? RUST : 0x777777, 40 + index);
      text.setVisible(true);
      text.setText(mate.name);
      text.setPosition(left + 90, y - 2);
    });
  }
}
