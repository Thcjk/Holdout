/**
 * Hauptmenue mit Charakterauswahl.
 *
 * Die drei Charaktere unterscheiden sich grundlegend (Briefing, Abschnitt 4),
 * deshalb zeigt die Karte nicht nur den Namen, sondern die Werte, an denen man
 * den Unterschied abliest: Leben, Tempo, Waffe, Super.
 *
 * Zum Aufbau: Alles liegt auf einer Mittelachse. Die Kartenreihe wird aus ihrer
 * Gesamtbreite heraus zentriert statt mit geschaetzten Abstaenden, und die
 * kleinen Knoepfe stehen in einer eigenen Reihe unten - sonst haengt einer
 * allein in einer Ecke und das ganze Bild kippt zur Seite.
 */

import Phaser from "phaser";
import { ATLAS_KEY, BODY_RADIUS } from "../assets/textures";
import { audio } from "../audio/AudioEngine";
import { CHARACTERS, CHARACTER_ORDER } from "../config/balance";
import { COLORS, VIEWPORT } from "../config/constants";
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
const CARD_HEIGHT = 236;
const CARD_GAP = 24;
const CARD_Y = 268;

/** Ein kleiner Knopf der unteren Reihe, bevor er erzeugt wird. */
interface UtilityButton {
  label: string;
  width: number;
  onClick: (button: Button) => void;
}

export class MenuScene extends Phaser.Scene {
  private selected: CharacterId = "scout";
  private cards = new Map<CharacterId, Phaser.GameObjects.Rectangle>();

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

    this.createHeader();
    this.createCards();
    this.createActions();
    this.createUtilityRow();
    this.highlightSelection();
  }

  private createHeader(): void {
    this.centeredText(40, "Koop-Arena-Shooter", 34, "#dce8f7", "bold");

    const best = loadHighscore();
    this.centeredText(
      76,
      best
        ? `Dein Rekord: ${best.score} Punkte, Welle ${best.wave}`
        : "Halte durch, solange du kannst.",
      15,
      "#8ea6c4",
    );

    this.centeredText(104, "Wähle deinen Charakter", 16, "#ffd166");
  }

  private createCards(): void {
    // Aus der Gesamtbreite heraus zentrieren: Dann sitzt die Reihe exakt in der
    // Mitte, egal wie breit die Karten sind.
    const rowWidth = CHARACTER_ORDER.length * CARD_WIDTH + (CHARACTER_ORDER.length - 1) * CARD_GAP;
    const firstCenter = (VIEWPORT.width - rowWidth) / 2 + CARD_WIDTH / 2;

    CHARACTER_ORDER.forEach((id, index) => {
      this.createCard(id, firstCenter + index * (CARD_WIDTH + CARD_GAP));
    });
  }

  private createActions(): void {
    const gap = 24;
    const width = 276;
    const offset = (width + gap) / 2;

    new Button(
      this,
      VIEWPORT.width / 2 - offset,
      430,
      "Solo starten",
      () => {
        audio.unlock();
        audio.startMusic();
        this.scene.start("Game", { character: this.selected });
      },
      { width },
    );

    new Button(
      this,
      VIEWPORT.width / 2 + offset,
      430,
      "Zusammen spielen",
      () => {
        audio.unlock();
        this.scene.start("Lobby", { character: this.selected });
      },
      { width, color: COLORS.mate },
    );
  }

  /**
   * Die kleinen Knoepfe unten, als eine Reihe um die Mitte verteilt.
   * Welche es gibt, haengt vom Geraet ab - deshalb wird erst gesammelt und
   * dann gerechnet.
   */
  private createUtilityRow(): void {
    const entries: UtilityButton[] = [];

    if (!isInstalledApp() && (canPromptInstall() || needsManualInstructions())) {
      entries.push({
        label: "App installieren",
        width: 186,
        onClick: (button) => {
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
      });
    }

    entries.push({
      label: audio.isMuted ? "Ton aus" : "Ton an",
      width: 118,
      onClick: (button) => {
        audio.unlock();
        const muted = audio.toggleMuted();
        button.setText(muted ? "Ton aus" : "Ton an");
        if (!muted) {
          audio.startMusic();
        }
      },
    });

    if (this.sys.game.device.fullscreen.available) {
      entries.push({
        label: this.scale.isFullscreen ? "Fenster" : "Vollbild",
        width: 118,
        onClick: (button) => {
          if (this.scale.isFullscreen) {
            this.scale.stopFullscreen();
            button.setText("Vollbild");
          } else {
            this.scale.startFullscreen();
            button.setText("Fenster");
          }
        },
      });
    }

    const gap = 16;
    const totalWidth =
      entries.reduce((sum, entry) => sum + entry.width, 0) + gap * (entries.length - 1);

    let x = (VIEWPORT.width - totalWidth) / 2;
    for (const entry of entries) {
      const button: Button = new Button(
        this,
        x + entry.width / 2,
        500,
        entry.label,
        () => entry.onClick(button),
        { width: entry.width, height: 38, fontSize: 15, color: COLORS.hudDim },
      );
      x += entry.width + gap;
    }
  }

  /** Overlay mit der Schritt-fuer-Schritt-Anleitung fuer das iPhone. */
  private showInstallInstructions(): void {
    const parts: { destroy(): void }[] = [];

    parts.push(
      this.add
        .rectangle(
          VIEWPORT.width / 2,
          VIEWPORT.height / 2,
          VIEWPORT.width,
          VIEWPORT.height,
          0x11161f,
          0.94,
        )
        .setDepth(200)
        .setInteractive(),
    );
    parts.push(this.centeredText(150, "Als App installieren", 28, "#dce8f7", "bold").setDepth(201));
    parts.push(
      this.add
        .text(VIEWPORT.width / 2, 250, manualInstructions().join("\n"), {
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          color: "#dce8f7",
          align: "center",
          lineSpacing: 12,
        })
        .setOrigin(0.5)
        .setDepth(201),
    );
    parts.push(
      this.add
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
        .setDepth(201),
    );

    const close = new Button(
      this,
      VIEWPORT.width / 2,
      430,
      "Verstanden",
      () => {
        for (const part of parts) {
          part.destroy();
        }
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
      this.highlightSelection();
    });
    this.cards.set(id, card);

    const portrait = this.add.image(centerX, CARD_Y - 78, ATLAS_KEY, id);
    portrait.setScale(32 / BODY_RADIUS);

    this.add
      .text(centerX, CARD_Y - 34, definition.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "23px",
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
    this.add
      .text(
        centerX,
        CARD_Y + 30,
        [
          `Leben ${definition.health}   Tempo ${definition.speed}`,
          `${shot.bullets} × ${shot.damage} Schaden, Reichweite ${shot.range}`,
          `Nachladen ${definition.reloadTime.toFixed(1)} s`,
        ].join("\n"),
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          color: "#dce8f7",
          align: "center",
          lineSpacing: 4,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(centerX, CARD_Y + 88, `Super: ${definition.super.name}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#ffd166",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: CARD_WIDTH - 28 },
      })
      .setOrigin(0.5);
  }

  private centeredText(
    y: number,
    text: string,
    size: number,
    color: string,
    style = "normal",
  ): Phaser.GameObjects.Text {
    return this.add
      .text(VIEWPORT.width / 2, y, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: `${size}px`,
        color,
        fontStyle: style,
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
