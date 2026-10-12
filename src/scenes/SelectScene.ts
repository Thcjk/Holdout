/**
 * Charakter und Startwaffe waehlen.
 *
 * Links die sechs Charaktere, rechts Beschreibung, Werte und die Waffen, mit
 * denen er beginnen darf. Danach geht es solo direkt los, im Koop in die Lobby.
 */

import Phaser from "phaser";
import { figureScale } from "../ui/comicFigures";
import { characterKey, weaponIconKey } from "../config/assets";
import { SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { ABILITIES } from "../game/data/abilities";
import { CHARACTERS, CHARACTER_IDS } from "../game/data/characters";
import { WEAPONS } from "../game/data/weapons";
import type { CharacterId, WeaponId } from "../game/types";
import { FORCED_SEED } from "../platform/debugFlags";
import { Button } from "../ui/Button";
import { describeMods } from "../ui/describe";
import { insetPanel, menuBackground, menuText, woodPanel } from "../ui/menuStyle";
import { SoloSession } from "../net/SoloSession";
import { playerName } from "../app";
import type { PlayMode } from "../app";

const CARD_W = 156;
const CARD_H = 188;
const GAP = 12;

export class SelectScene extends Phaser.Scene {
  private mode: PlayMode = "solo";
  private character: CharacterId = "soeldner";
  private weapon: WeaponId = "pistol";
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private buttons: Button[] = [];
  private frames = new Map<CharacterId, Phaser.GameObjects.Rectangle>();

  constructor() {
    super("Select");
  }

  init(data: { mode?: PlayMode }): void {
    this.mode = data.mode ?? "solo";
    this.character = "soeldner";
    this.weapon = CHARACTERS.soeldner.starts[0] ?? "pistol";
    this.dynamic = [];
    this.buttons = [];
    this.frames = new Map();
  }

  create(): void {
    menuBackground(this);
    const left = SAFE.left + 24;
    menuText(this, VIEWPORT.width / 2, 34, "Wähle deinen Charakter", 28, UI.text.title, true);

    new Button(this, left + 50, 34, "‹ Zurück", () => this.scene.start("Title"), {
      width: 100,
      height: 44,
      fontSize: 18,
      variant: "secondary",
    });

    // Raster: 3 Spalten, 2 Reihen.
    CHARACTER_IDS.forEach((id, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = left + col * (CARD_W + GAP) + CARD_W / 2;
      const y = 76 + row * (CARD_H + GAP) + CARD_H / 2;
      this.buildCard(id, x, y);
    });

    this.refresh();
  }

  private buildCard(id: CharacterId, x: number, y: number): void {
    const def = CHARACTERS[id];
    woodPanel(this, x, y, CARD_W, CARD_H);
    insetPanel(this, x, y - 20, CARD_W - 28, 104);
    this.add.image(x, y - 20, characterKey(id)).setScale(figureScale(1.3));
    menuText(this, x, y + 56, def.name, 22, UI.text.body, true);
    menuText(this, x, y + 78, `${def.slots} Waffenplätze`, 14, UI.text.muted);

    const frame = this.add.rectangle(x, y, CARD_W - 2, CARD_H - 2).setStrokeStyle(4, 0xb5532f).setFillStyle(0, 0);
    frame.setVisible(false);
    this.frames.set(id, frame);

    const hit = this.add.rectangle(x, y, CARD_W, CARD_H, 0, 0).setInteractive();
    hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.character = id;
      this.weapon = def.starts[0] ?? "pistol";
      this.refresh();
    });
  }

  /** Baut die rechte Seite fuer den gewaehlten Charakter neu auf. */
  private refresh(): void {
    for (const object of this.dynamic) {
      object.destroy();
    }
    for (const button of this.buttons) {
      button.destroy();
    }
    this.dynamic = [];
    this.buttons = [];
    for (const [id, frame] of this.frames) {
      frame.setVisible(id === this.character);
    }

    const def = CHARACTERS[this.character];
    const left = SAFE.left + 24;
    const panelX = left + 3 * CARD_W + 2 * GAP + 18;
    const panelW = VIEWPORT.width - SAFE.right - 24 - panelX;
    const cx = panelX + panelW / 2;
    const panelH = 2 * CARD_H + GAP;
    const top = 76;

    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.dynamic.push(object);
      return object;
    };

    add(woodPanel(this, cx, top + panelH / 2, panelW, panelH) as unknown as Phaser.GameObjects.GameObject);
    add(menuText(this, cx, top + 30, def.name, 30, UI.text.accent, true));
    add(
      this.add
        .text(panelX + 20, top + 56, def.description, {
          fontFamily: UI.font,
          fontSize: "17px",
          color: UI.text.body,
          wordWrap: { width: panelW - 40 },
        })
        .setShadow(1, 2, UI.text.shadow, 2),
    );

    // Werte des Charakters.
    const lines = describeMods(def.mods);
    lines.forEach((line, index) => {
      add(
        this.add
          .text(panelX + 20 + (index % 2) * (panelW / 2 - 10), top + 108 + Math.floor(index / 2) * 22, line.text, {
            fontFamily: UI.font,
            fontSize: "16px",
            color: line.good ? "#4e6b2a" : "#a8321c",
            fontStyle: "bold",
          })
          .setShadow(1, 2, UI.text.shadow, 2),
      );
    });

    // Faehigkeit des Helden.
    const ability = ABILITIES[this.character];
    add(
      this.add.text(panelX + 20, top + 158, `Fähigkeit: ${ability.name}`, {
        fontFamily: UI.font,
        fontSize: "17px",
        color: UI.text.accent,
      }),
    );
    add(
      this.add.text(panelX + 20, top + 178, ability.description, {
        fontFamily: UI.font,
        fontSize: "14px",
        color: UI.text.body,
        wordWrap: { width: panelW - 40 },
      }),
    );

    // Startwaffen.
    add(menuText(this, cx, top + 214, "Startwaffe", 18, UI.text.muted));
    const starts = def.starts;
    const slot = 76;
    const rowW = starts.length * slot + (starts.length - 1) * 8;
    starts.forEach((id, index) => {
      const x = cx - rowW / 2 + slot / 2 + index * (slot + 8);
      const y = top + 262;
      const selected = id === this.weapon;
      add(insetPanel(this, x, y, slot, slot) as unknown as Phaser.GameObjects.GameObject);
      add(this.add.image(x, y - 4, weaponIconKey(id)).setDisplaySize(52, 52));
      add(menuText(this, x, y + 28, WEAPONS[id].name, 12, UI.text.dark, true));
      if (selected) {
        add(this.add.rectangle(x, y, slot + 2, slot + 2).setStrokeStyle(4, 0xb5532f).setFillStyle(0, 0));
      }
      const hit = add(this.add.rectangle(x, y, slot, slot, 0, 0).setInteractive());
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.weapon = id;
        this.refresh();
      });
    });

    const label = this.mode === "solo" ? "Los geht's!" : "Weiter";
    this.buttons.push(
      new Button(this, cx, top + panelH - 44, label, () => this.confirm(), { width: panelW - 40, height: 60, fontSize: 26 }),
    );
  }

  private confirm(): void {
    if (this.mode === "solo") {
      const seed = FORCED_SEED ?? Math.floor(Math.random() * 0x7fffffff);
      const session = new SoloSession(
        { id: "solo", name: playerName(), character: this.character, startWeapon: this.weapon },
        seed,
      );
      this.scene.start("Game", { session, character: this.character, weapon: this.weapon, mode: this.mode });
      return;
    }
    this.scene.start("Lobby", { mode: this.mode, character: this.character, weapon: this.weapon });
  }
}
