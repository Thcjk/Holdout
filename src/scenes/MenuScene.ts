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
import { CHARACTER_TILES, SHEET_KEY, WORLD_SCALE } from "../config/assets";
import { audio } from "../audio/AudioEngine";
import { ABILITIES, CHARACTERS, CHARACTER_ORDER } from "../config/balance";
import { SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
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
import { setReloadSafe } from "../platform/update";
import { insetPanel, menuBackground, woodPanel } from "../ui/menuStyle";

const CARD_WIDTH = 268;
const CARD_HEIGHT = 248;
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
  /** Je Karte der Auswahlrahmen - gold, wenn gewaehlt. */
  private cards = new Map<CharacterId, Phaser.GameObjects.Graphics>();

  constructor() {
    super("Menu");
  }

  create(): void {
    // Im Menue darf eine wartende neue Version sofort greifen.
    setReloadSafe(true);
    this.cards.clear();
    menuBackground(this);

    /*
     * Im Menue laeuft Menuemusik.
     *
     * Zweimal gesetzt, und beides ist noetig:
     *  - Hier sofort, damit die Musik beim RUECKWEG aus einer Runde direkt
     *    weiterlaeuft. Der Ton ist dann laengst freigegeben.
     *  - Im Antipp-Ereignis, weil beim ALLERERSTEN Aufruf noch nichts klingen
     *    darf: Browser verweigern Ton vor der ersten Beruehrung.
     * `setMusic` merkt sich den Wunsch; `unlock()` setzt ihn dann um.
     */
    audio.setMusic("menu");
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      audio.unlock();
      audio.setMusic("menu");
    });

    this.createHeader();
    this.createCards();
    this.createActions();
    this.createUtilityRow();
    this.createVersionLabel();
    this.highlightSelection();
  }

  /**
   * Versionsnummer klein in der Ecke.
   *
   * Klingt nach Kosmetik, ist aber Diagnose: Wenn jemand meldet „geht nicht",
   * ist die erste Frage, welcher Stand auf dem Geraet ueberhaupt laeuft - ein
   * Service Worker kann noch eine aeltere Fassung ausliefern.
   */
  private createVersionLabel(): void {
    this.add
      .text(
        VIEWPORT.width - SAFE.right - 10,
        VIEWPORT.height - SAFE.bottom - 8,
        `v${__APP_VERSION__}`,
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "11px",
          color: "#a8977a",
        },
      )
      .setOrigin(1, 1);
  }

  private createHeader(): void {
    this.centeredText(40, "Holdout", 42, UI.text.title, "bold");

    const best = loadHighscore();
    this.centeredText(
      76,
      best
        ? `Dein Rekord: ${best.score} Punkte${best.zone === undefined ? "" : `, Zone ${best.zone}`}`
        : "Halte durch, solange du kannst.",
      15,
      UI.text.muted,
    );

    this.centeredText(104, "Wähle deinen Charakter", 16, UI.text.accent, "bold");
  }

  private createCards(): void {
    for (const id of CHARACTER_ORDER) {
      this.createCard(id, this.cardCenterX(id));
    }
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
        audio.setMusic("menu");
        // Ueber den Rucksack statt direkt ins Spiel: Was man mitnimmt, ist
        // seit Phase 11 eine Entscheidung vor dem Run.
        this.scene.start("Loadout", { character: this.selected });
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
        this.scene.start("Loadout", { character: this.selected, coop: true });
      },
      { width },
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
          audio.setMusic("menu");
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
        { width: entry.width, height: 38, fontSize: 15, variant: "secondary" },
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
          0x1f1b14,
          0.95,
        )
        .setDepth(200)
        .setInteractive(),
    );
    parts.push(this.centeredText(150, "Als App installieren", 28, UI.text.title, "bold").setDepth(201));
    parts.push(
      this.add
        .text(VIEWPORT.width / 2, 250, manualInstructions().join("\n"), {
          fontFamily: "system-ui, sans-serif",
          fontSize: "18px",
          color: UI.text.body,
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
            color: UI.text.muted,
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

    // Die Karte ist eine Holztafel aus dem UI-Paket - dieselbe wie das
    // Rucksackfenster im Spiel. Angetippt wird eine unsichtbare Flaeche
    // darueber (die Tafel selbst besteht aus neun Einzelbildern).
    woodPanel(this, centerX, CARD_Y, CARD_WIDTH, CARD_HEIGHT);
    insetPanel(this, centerX, CARD_Y - 86, 80, 58);
    const frame = this.add.graphics();
    this.cards.set(id, frame);

    const hit = this.add.zone(centerX, CARD_Y, CARD_WIDTH, CARD_HEIGHT);
    hit.setInteractive({ useHandCursor: true });
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.selected = id;
      audio.unlock();
      audio.play("superReady");
      this.highlightSelection();
    });

    /*
     * Das Bild auf der Karte kommt aus demselben Sheet wie die Figur im Spiel.
     *
     * Sonst waere die Auswahl eine Luege: Man saehe im Menue etwas anderes, als
     * man danach steuert. Ganzzahlig vergroessert (viermal statt dreimal wie in
     * der Welt) - auf der Karte ist Platz, und bei Pixel-Art muss der Faktor
     * ganzzahlig bleiben, sonst franst das Bild aus.
     */
    const portrait = this.add.image(centerX, CARD_Y - 86, SHEET_KEY, CHARACTER_TILES[id]);
    portrait.setScale(WORLD_SCALE + 1);

    this.add
      .text(centerX, CARD_Y - 34, definition.name, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "23px",
        color: UI.text.title,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setShadow(1, 2, UI.text.shadow, 3);

    this.add
      .text(centerX, CARD_Y - 12, definition.role, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: UI.text.muted,
      })
      .setOrigin(0.5);

    this.add
      .text(
        centerX,
        CARD_Y + 30,
        [
          `Leben ${definition.health}   Tempo ${definition.speed}`,
          // Seit der Waffen-Ausruestung schiesst die Waffe, nicht der
          // Charakter - die Karte nennt deshalb die Faehigkeit (der Super
          // steht darunter ohnehin schon, gelb).
          `Fähigkeit: ${ABILITIES[definition.id].name}`,
        ].join("\n"),
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          color: UI.text.body,
          align: "center",
          lineSpacing: 4,
        },
      )
      .setOrigin(0.5);

    this.add
      .text(centerX, CARD_Y + 88, `Super: ${definition.super.name}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: UI.text.accent,
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
        fontFamily: UI.font,
        fontSize: `${size}px`,
        color,
        fontStyle: style,
      })
      .setOrigin(0.5)
      .setShadow(1, 2, UI.text.shadow, 3);
  }

  /**
   * Gewaehlte Karte: goldener Rahmen um die Tafel (die Farbe der Beute-
   * kisten im Spiel). Die anderen bleiben ohne Rahmen - nur EINE Karte
   * soll herausstechen.
   */
  private highlightSelection(): void {
    for (const [id, frame] of this.cards) {
      frame.clear();
      if (id !== this.selected) {
        continue;
      }
      const x = this.cardCenterX(id) - CARD_WIDTH / 2 - 4;
      frame.lineStyle(4, 0xffd166, 1);
      frame.strokeRoundedRect(x, CARD_Y - CARD_HEIGHT / 2 - 4, CARD_WIDTH + 8, CARD_HEIGHT + 8, 8);
    }
  }

  /**
   * Aus der Gesamtbreite heraus zentriert: Dann sitzt die Reihe exakt in der
   * Mitte, egal wie breit die Karten sind.
   */
  private cardCenterX(id: CharacterId): number {
    const count = CHARACTER_ORDER.length;
    const rowWidth = count * CARD_WIDTH + (count - 1) * CARD_GAP;
    return (VIEWPORT.width - rowWidth) / 2 + CARD_WIDTH / 2 + CHARACTER_ORDER.indexOf(id) * (CARD_WIDTH + CARD_GAP);
  }
}
