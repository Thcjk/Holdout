/**
 * Hauptmenue mit Charakterauswahl.
 *
 * Die drei Charaktere unterscheiden sich grundlegend (Briefing, Abschnitt 4),
 * deshalb zeigt die Karte nicht nur den Namen, sondern die Werte, an denen man
 * den Unterschied ablesen kann: Leben, Tempo, Waffe, Super.
 */

import Phaser from "phaser";
import { ATLAS_KEY, BODY_RADIUS } from "../assets/textures";
import { CHARACTERS, CHARACTER_ORDER } from "../config/balance";
import { COLORS, VIEWPORT } from "../config/constants";
import { audio } from "../audio/AudioEngine";
import { loadHighscore } from "../storage/highscore";
import type { CharacterId } from "../systems/types";
import { Button } from "../ui/Button";

const CARD_WIDTH = 268;
const CARD_HEIGHT = 244;
const CARD_Y = 292;

export class MenuScene extends Phaser.Scene {
  private selected: CharacterId = "scout";
  private cards = new Map<CharacterId, Phaser.GameObjects.Rectangle>();
  private muteButton!: Button;

  constructor() {
    super("Menu");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    // Ton darf erst nach einer Nutzerinteraktion starten - deshalb hier und
    // nicht beim Laden des Spiels.
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      audio.unlock();
      audio.startMusic();
    });
    this.input.keyboard?.once("keydown", () => {
      audio.unlock();
      audio.startMusic();
    });

    this.add
      .text(VIEWPORT.width / 2, 52, "Koop-Arena-Shooter", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "40px",
        color: "#dce8f7",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const best = loadHighscore();
    this.add
      .text(
        VIEWPORT.width / 2,
        92,
        best
          ? `Dein Rekord: ${best.score} Punkte, Welle ${best.wave}`
          : "Halte durch, solange du kannst.",
        { fontFamily: "system-ui, sans-serif", fontSize: "16px", color: "#8ea6c4" },
      )
      .setOrigin(0.5);

    this.add
      .text(VIEWPORT.width / 2, 136, "Wähle deinen Charakter", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#ffd166",
      })
      .setOrigin(0.5);

    CHARACTER_ORDER.forEach((id, index) => {
      this.createCard(id, 168 + index * (CARD_WIDTH + 24));
    });

    new Button(this, VIEWPORT.width / 2, VIEWPORT.height - 38, "Solo starten", () => {
      audio.unlock();
      audio.startMusic();
      this.scene.start("Game", { character: this.selected });
    });

    this.muteButton = new Button(
      this,
      VIEWPORT.width - 74,
      44,
      audio.isMuted ? "Ton aus" : "Ton an",
      () => {
        audio.unlock();
        const muted = audio.toggleMuted();
        this.muteButton.setText(muted ? "Ton aus" : "Ton an");
        if (!muted) {
          audio.startMusic();
        }
      },
      { width: 116, height: 38, fontSize: 15, color: COLORS.hudDim },
    );

    this.highlightSelection();
  }

  private createCard(id: CharacterId, centerX: number): void {
    const definition = CHARACTERS[id];

    const card = this.add.rectangle(centerX, CARD_Y, CARD_WIDTH, CARD_HEIGHT, 0x1e2734, 1);
    card.setStrokeStyle(3, COLORS.hudDim);
    card.setInteractive({ useHandCursor: true });
    card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.selected = id;
      audio.unlock();
      audio.play("superReady");
      this.highlightSelection();
    });
    this.cards.set(id, card);

    const portrait = this.add.image(centerX, CARD_Y - 82, ATLAS_KEY, id);
    portrait.setScale(34 / BODY_RADIUS);

    this.add
      .text(centerX, CARD_Y - 36, definition.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#dce8f7",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, CARD_Y - 12, definition.role, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#8ea6c4",
      })
      .setOrigin(0.5);

    const shot = definition.shot;
    const lines = [
      `Leben ${definition.health}   Tempo ${definition.speed}`,
      `${shot.bullets} × ${shot.damage} Schaden, Reichweite ${shot.range}`,
      `Nachladen ${definition.reloadTime.toFixed(1)} s`,
    ];

    this.add
      .text(centerX, CARD_Y + 34, lines.join("\n"), {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: "#dce8f7",
        align: "center",
        lineSpacing: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, CARD_Y + 94, `Super: ${definition.super.name}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#ffd166",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: CARD_WIDTH - 28 },
      })
      .setOrigin(0.5);
  }

  private highlightSelection(): void {
    for (const [id, card] of this.cards) {
      const active = id === this.selected;
      card.setStrokeStyle(active ? 4 : 3, active ? COLORS.player : COLORS.hudDim);
      card.setFillStyle(active ? 0x24344a : 0x1e2734, 1);
    }
  }
}
