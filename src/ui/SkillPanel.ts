/**
 * Die Auswahl in der sicheren Zone: einen Punkt in eine Fähigkeit stecken.
 *
 * Erscheint nur in der Pause und in der Vorbereitung - mitten im Gefecht wäre
 * ein Menü über dem halben Bildschirm genau das Falsche. Wer den Punkt liegen
 * lässt, behält ihn; die Anzeige oben links erinnert daran.
 */

import Phaser from "phaser";
import { SKILLS, SKILL_ORDER } from "../config/balance";
import { COLORS, DEPTH, VIEWPORT } from "../config/constants";
import type { SkillId } from "../systems/types";

const CARD_WIDTH = 196;
const CARD_HEIGHT = 116;
const CARD_GAP = 18;

/**
 * Die Reihe sitzt bewusst im oberen Mittelfeld: Weiter unten wuerde sie den
 * Feuerknopf ueberdecken, und ein Knopf, den ein Menue verdeckt, ist die Art
 * Fehler, die man erst mitten im Spiel merkt.
 */
const PANEL_Y = 288;

interface SkillCard {
  background: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  effect: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Text;
}

export class SkillPanel {
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly cards = new Map<SkillId, SkillCard>();
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onPick: (skill: SkillId) => void,
  ) {
    this.backdrop = scene.add
      .rectangle(VIEWPORT.width / 2, PANEL_Y, VIEWPORT.width, 182, 0x11161f, 0.86)
      .setDepth(DEPTH.hud + 10);

    this.title = scene.add
      .text(VIEWPORT.width / 2, PANEL_Y - 70, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#ffd166",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 11);

    // Die Reihe exakt mittig setzen, statt die erste Karte zu schaetzen.
    const rowWidth = SKILL_ORDER.length * CARD_WIDTH + (SKILL_ORDER.length - 1) * CARD_GAP;
    const firstCenter = (VIEWPORT.width - rowWidth) / 2 + CARD_WIDTH / 2;

    SKILL_ORDER.forEach((skill, index) => {
      this.cards.set(skill, this.createCard(skill, firstCenter + index * (CARD_WIDTH + CARD_GAP)));
    });

    this.setVisible(false);
  }

  /** Zeigt die Auswahl, wenn Punkte offen sind und gerade nicht gekämpft wird. */
  update(skillPoints: number, levels: Record<SkillId, number>, inBreak: boolean): void {
    const shouldShow = skillPoints > 0 && inBreak;
    if (shouldShow !== this.visible) {
      this.setVisible(shouldShow);
    }
    if (!shouldShow) {
      return;
    }

    this.title.setText(
      skillPoints === 1 ? "Ein Punkt zu verteilen" : `${skillPoints} Punkte zu verteilen`,
    );

    for (const skill of SKILL_ORDER) {
      const card = this.cards.get(skill);
      if (!card) {
        continue;
      }

      const level = levels[skill] ?? 0;
      const maxed = level >= SKILLS[skill].maxLevel;

      card.pips.setText(pips(level, SKILLS[skill].maxLevel));
      card.pips.setColor(maxed ? "#ffd166" : "#dce8f7");
      card.background.setFillStyle(maxed ? 0x1a222e : 0x24344a, 1);
      card.background.setStrokeStyle(3, maxed ? COLORS.hudDim : COLORS.player);
      card.effect.setColor(maxed ? "#8ea6c4" : "#dce8f7");
      card.effect.setText(maxed ? "voll ausgebaut" : SKILLS[skill].effect);
    }
  }

  destroy(): void {
    this.backdrop.destroy();
    this.title.destroy();
    for (const card of this.cards.values()) {
      card.background.destroy();
      card.name.destroy();
      card.effect.destroy();
      card.pips.destroy();
    }
  }

  private createCard(skill: SkillId, centerX: number): SkillCard {
    const definition = SKILLS[skill];

    const background = this.scene.add
      .rectangle(centerX, PANEL_Y + 14, CARD_WIDTH, CARD_HEIGHT, 0x24344a, 1)
      .setStrokeStyle(3, COLORS.player)
      .setDepth(DEPTH.hud + 11)
      .setInteractive({ useHandCursor: true });

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.onPick(skill));

    const name = this.scene.add
      .text(centerX, PANEL_Y - 18, definition.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#dce8f7",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 12);

    const effect = this.scene.add
      .text(centerX, PANEL_Y + 14, definition.effect, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
        color: "#dce8f7",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 12);

    const pipsText = this.scene.add
      .text(centerX, PANEL_Y + 44, pips(0, definition.maxLevel), {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#dce8f7",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 12);

    return { background, name, effect, pips: pipsText };
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    this.backdrop.setVisible(visible);
    this.title.setVisible(visible);

    for (const card of this.cards.values()) {
      card.background.setVisible(visible);
      card.name.setVisible(visible);
      card.effect.setVisible(visible);
      card.pips.setVisible(visible);

      // Unsichtbare Knoepfe duerfen keine Beruehrungen mehr schlucken.
      if (visible) {
        card.background.setInteractive({ useHandCursor: true });
      } else {
        card.background.disableInteractive();
      }
    }
  }
}

/** Gefüllte und leere Punkte, z. B. "● ● ○ ○ ○". */
function pips(level: number, maxLevel: number): string {
  return Array.from({ length: maxLevel }, (_, index) => (index < level ? "●" : "○")).join(" ");
}
