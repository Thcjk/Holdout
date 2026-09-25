/**
 * Charakterwahl (Szene "Menu").
 *
 * Seit 2026-09-26 nicht mehr der erste Bildschirm: Davor kommen Titel,
 * Speicherplatz und Solo/Koop (`TitleScene`, `SlotScene`, `ModeScene`). Ton,
 * Vollbild und Installieren sind in die Einstellungen gewandert.
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
import { activeCharacterOr, saveActive, setActiveCharacter } from "../storage/saveSlots";
import type { CharacterId } from "../systems/types";
import { Button } from "../ui/Button";
import { setReloadSafe } from "../platform/update";
import { insetPanel, menuBackground, menuText, woodPanel } from "../ui/menuStyle";

const CARD_WIDTH = 268;
const CARD_HEIGHT = 248;
const CARD_GAP = 24;
const CARD_Y = 268;

export interface MenuSceneData {
  /** Nach der Wahl allein los oder in die Lobby. */
  coop?: boolean;
}

export class MenuScene extends Phaser.Scene {
  private selected: CharacterId = "scout";
  private coop = false;
  /** Je Karte der Auswahlrahmen - gold, wenn gewaehlt. */
  private cards = new Map<CharacterId, Phaser.GameObjects.Graphics>();

  constructor() {
    super("Menu");
  }

  init(data: MenuSceneData): void {
    this.coop = data?.coop === true;
    // Der Charakter des Spielstands ist vorgewaehlt.
    this.selected = activeCharacterOr(this.selected);
  }

  create(): void {
    setReloadSafe(false);
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
    this.highlightSelection();
  }

  private createHeader(): void {
    menuText(this, VIEWPORT.width / 2, 52, "Wähle deinen Charakter", 30, UI.text.title, true);
    menuText(
      this,
      VIEWPORT.width / 2,
      90,
      this.coop ? "Koop – danach packen, dann die Lobby" : "Solo – danach packen, dann die Karte",
      15,
      UI.text.muted,
    );
  }

  private createCards(): void {
    for (const id of CHARACTER_ORDER) {
      this.createCard(id, this.cardCenterX(id));
    }
  }

  private createActions(): void {
    new Button(
      this,
      VIEWPORT.width / 2,
      440,
      "Weiter",
      () => {
        audio.unlock();
        audio.setMusic("menu");
        // Den Charakter im Spielstand merken - beim naechsten Mal vorgewaehlt.
        setActiveCharacter(this.selected);
        saveActive(null);
        this.scene.start("Loadout", { character: this.selected, coop: this.coop });
      },
      { width: 300 },
    );

    new Button(this, SAFE.left + 92, VIEWPORT.height - SAFE.bottom - 34, "Zurück", () => this.scene.start("Mode"), {
      width: 140,
      height: 40,
      fontSize: 16,
      variant: "secondary",
    });
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
