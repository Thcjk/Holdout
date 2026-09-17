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
import { isInstalledApp } from "../platform/device";
import {
  canPromptInstall,
  manualInstructions,
  needsManualInstructions,
  promptInstall,
} from "../platform/install";
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

    new Button(this, VIEWPORT.width / 2 - 150, VIEWPORT.height - 38, "Solo starten", () => {
      audio.unlock();
      audio.startMusic();
      this.scene.start("Game", { character: this.selected });
    });

    new Button(
      this,
      VIEWPORT.width / 2 + 150,
      VIEWPORT.height - 38,
      "Zusammen spielen",
      () => {
        audio.unlock();
        this.scene.start("Lobby", { character: this.selected });
      },
      { color: COLORS.mate },
    );

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

    // Vollbild lohnt sich auf dem Handy: Ohne Browserleisten ist der
    // Spielbereich spuerbar groesser.
    if (this.scale.fullscreenTarget !== null || this.sys.game.device.fullscreen.available) {
      const fullscreenButton = new Button(
        this,
        VIEWPORT.width - 74,
        92,
        this.scale.isFullscreen ? "Fenster" : "Vollbild",
        () => {
          if (this.scale.isFullscreen) {
            this.scale.stopFullscreen();
            fullscreenButton.setText("Vollbild");
          } else {
            this.scale.startFullscreen();
            fullscreenButton.setText("Fenster");
          }
        },
        { width: 116, height: 38, fontSize: 15, color: COLORS.hudDim },
      );
    }

    this.createInstallButton();
    this.highlightSelection();
  }

  /**
   * Der Weg zum "Herunterladen": Auf Android fragt der Browser direkt, auf dem
   * iPhone gibt es stattdessen eine Anleitung. Wer das Spiel schon installiert
   * hat, sieht den Knopf gar nicht.
   */
  private createInstallButton(): void {
    if (isInstalledApp()) {
      return;
    }
    if (!canPromptInstall() && !needsManualInstructions()) {
      return;
    }

    const button = new Button(
      this,
      108,
      44,
      "App installieren",
      () => {
        if (canPromptInstall()) {
          void promptInstall().then((accepted) => {
            if (accepted) {
              button.setVisible(false);
            }
          });
          return;
        }
        this.showInstallInstructions();
      },
      { width: 182, height: 38, fontSize: 15, color: COLORS.mate },
    );
  }

  /** Overlay mit der Schritt-fuer-Schritt-Anleitung. */
  private showInstallInstructions(): void {
    const backdrop = this.add
      .rectangle(
        VIEWPORT.width / 2,
        VIEWPORT.height / 2,
        VIEWPORT.width,
        VIEWPORT.height,
        0x11161f,
        0.94,
      )
      .setDepth(200)
      .setInteractive();

    const title = this.add
      .text(VIEWPORT.width / 2, 150, "Als App installieren", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        color: "#dce8f7",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(201);

    const steps = this.add
      .text(VIEWPORT.width / 2, 250, manualInstructions().join("\n"), {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#dce8f7",
        align: "center",
        lineSpacing: 12,
      })
      .setOrigin(0.5)
      .setDepth(201);

    const note = this.add
      .text(
        VIEWPORT.width / 2,
        348,
        "Danach startet das Spiel ohne Browserleisten und auch ohne Internet.",
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          color: "#8ea6c4",
          align: "center",
          wordWrap: { width: VIEWPORT.width - 160 },
        },
      )
      .setOrigin(0.5)
      .setDepth(201);

    const close = new Button(
      this,
      VIEWPORT.width / 2,
      440,
      "Verstanden",
      () => {
        backdrop.destroy();
        title.destroy();
        steps.destroy();
        note.destroy();
        close.setVisible(false);
      },
      { width: 220 },
    );
    close.setDepth(202);
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
      // Vollbild lohnt sich auf dem Handy: Ohne Browserleisten ist der
      // Spielbereich spuerbar groesser.
      if (this.scale.fullscreenTarget !== null || this.sys.game.device.fullscreen.available) {
        const fullscreenButton = new Button(
          this,
          VIEWPORT.width - 74,
          92,
          this.scale.isFullscreen ? "Fenster" : "Vollbild",
          () => {
            if (this.scale.isFullscreen) {
              this.scale.stopFullscreen();
              fullscreenButton.setText("Vollbild");
            } else {
              this.scale.startFullscreen();
              fullscreenButton.setText("Fenster");
            }
          },
          { width: 116, height: 38, fontSize: 15, color: COLORS.hudDim },
        );
      }

      this.add
        .text(
          VIEWPORT.width / 2,
          VIEWPORT.height - 76,
          "Esc bringt dich im Spiel zurück ins Menü",
          {
            fontFamily: "system-ui, sans-serif",
            fontSize: "12px",
            color: "#8ea6c4",
          },
        )
        .setOrigin(0.5);

      this.createInstallButton();
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
