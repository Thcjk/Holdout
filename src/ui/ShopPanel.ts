/**
 * Der Shop zwischen den Wellen.
 *
 * Liegt als undurchsichtige Ebene ueber der Arena und zeigt, was der Spieler
 * jetzt tun kann: kaufen, Angebote halten, neu wuerfeln, Waffen verkaufen oder
 * verschmelzen, Werte ansehen, Level-Ups waehlen und "Weiter" druecken.
 *
 * Die Ebene kennt nur den Zustand und schickt Befehle ab - gerechnet wird in
 * `game/shop.ts`, auf dem Host. Damit sie nicht jedes Bild alles neu baut,
 * vergleicht sie eine Kurzfassung des Zustands und baut nur bei Aenderung.
 */

import Phaser from "phaser";
import { itemIconKey, weaponIconKey } from "../config/assets";
import { PALETTE, SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { CHARACTERS } from "../game/data/characters";
import { ITEMS } from "../game/data/items";
import { STAT_KEYS, STAT_LABELS } from "../game/data/stats";
import { UPGRADES } from "../game/data/upgrades";
import { MAX_TIER, WEAPONS, weaponTitle } from "../game/data/weapons";
import { canTakeWeapon, rerollCost, sellPrice } from "../game/shop";
import type { Command, GameState, Offer, PlayerState, WeaponId } from "../game/types";
import { Button } from "./Button";
import { itemLines, weaponLines } from "./describe";
import { insetPanel, menuBackground, menuText, woodPanel } from "./menuStyle";

const DEPTH = 9600;
const TIER_COLORS = [0xb8b2a4, 0x6aa0c9, 0xa070d0, 0xb5532f];

type Disposable = { destroy: () => void };

export class ShopPanel {
  private readonly background: Phaser.GameObjects.Image;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private dynamic: Disposable[] = [];
  private signature = "";
  private selected: number | null = null;
  private showStats = false;
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly send: (command: Command) => void,
  ) {
    this.background = menuBackground(scene).setDepth(DEPTH);
    this.dim = scene.add.rectangle(0, 0, 2000, 1200, 0xf1e5c9, 0.35).setOrigin(0).setDepth(DEPTH);
    this.setVisible(false);
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.background.setVisible(visible);
    this.dim.setVisible(visible);
    if (!visible) {
      this.clear();
      this.signature = "";
      this.selected = null;
      this.showStats = false;
    }
  }

  update(state: GameState, self: PlayerState | undefined): void {
    if (!this.visible || !self) {
      return;
    }
    const readyCount = state.players.filter((player) => player.ready).length;
    const signature = JSON.stringify([
      state.wave,
      state.phase,
      self.gold,
      self.shop,
      self.weapons.map((weapon) => `${weapon.id}${weapon.tier}`),
      self.items,
      self.pendingLevels,
      self.ready,
      readyCount,
      state.players.length,
      this.selected,
      this.showStats,
      self.level,
    ]);
    if (signature === this.signature) {
      return;
    }
    this.signature = signature;
    this.build(state, self, readyCount);
  }

  private clear(): void {
    for (const object of this.dynamic) {
      object.destroy();
    }
    this.dynamic = [];
  }

  private keep<T extends Disposable>(object: T): T {
    this.dynamic.push(object);
    return object;
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    color: string = UI.text.body,
    bold = false,
    originX = 0,
  ): Phaser.GameObjects.Text {
    const text = this.scene.add
      .text(x, y, value, {
        fontFamily: UI.font,
        fontSize: `${size}px`,
        color,
        fontStyle: bold ? "bold" : "normal",
      })
      .setOrigin(originX, 0)
      .setDepth(DEPTH + 3)
      .setShadow(1, 2, UI.text.shadow, 2);
    return this.keep(text);
  }

  private button(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    width: number,
    height: number,
    options: { fontSize?: number; primary?: boolean; enabled?: boolean } = {},
  ): Button {
    const button = new Button(this.scene, x, y, label, onClick, {
      width,
      height,
      fontSize: options.fontSize ?? 18,
      variant: options.primary === false ? "secondary" : "primary",
    });
    button.setDepth(DEPTH + 4);
    button.setEnabled(options.enabled ?? true);
    return this.keep(button);
  }

  private build(state: GameState, self: PlayerState, readyCount: number): void {
    this.clear();
    const left = SAFE.left + 16;
    const right = VIEWPORT.width - SAFE.right - 16;
    const width = right - left;

    // Kopfzeile: Titel links, Material rechts.
    this.keep(menuText(this.scene, left + 130, 26, `Welle ${state.wave} geschafft`, 26, UI.text.title, true).setDepth(DEPTH + 3));
    this.keep(this.scene.add.image(right - 80, 27, "gem").setDisplaySize(30, 30).setDepth(DEPTH + 3));
    this.text(right - 58, 10, String(self.gold), 28, PALETTE.gold, true);

    if (self.pendingLevels > 0 && self.shop.upgradeChoices) {
      this.buildLevelUp(self, left, width);
      return;
    }

    if (this.showStats) {
      this.buildStats(self, left, width);
    } else {
      this.buildOffers(self, left, width);
      // Ein Papierblatt unter Waffen und Gegenstaenden, damit der Text nicht auf dem Bild liegt.
      this.keep(woodPanel(this.scene, left + width / 2, 352, width, 206).setDepth(DEPTH + 1));
      this.buildWeapons(state, self, left + 14);
      this.buildItems(self, left + 454, right - 14);
    }
    this.buildFooter(state, self, readyCount, left, right);
  }

  // --- Level-Up -----------------------------------------------------------

  private buildLevelUp(self: PlayerState, left: number, width: number): void {
    const choices = self.shop.upgradeChoices ?? [];
    this.keep(
      menuText(this.scene, VIEWPORT.width / 2, 92, `Level-Up!  (${self.pendingLevels} offen)`, 34, UI.text.accent, true).setDepth(
        DEPTH + 3,
      ),
    );
    this.keep(menuText(this.scene, VIEWPORT.width / 2, 132, "Wähle eine Verbesserung", 20, UI.text.muted).setDepth(DEPTH + 3));
    const buttonWidth = (width - 20) / 2;
    choices.forEach((id, index) => {
      const upgrade = UPGRADES.find((candidate) => candidate.id === id);
      const x = left + buttonWidth / 2 + (index % 2) * (buttonWidth + 20);
      const y = 210 + Math.floor(index / 2) * 100;
      this.button(x, y, upgrade?.name ?? id, () => this.send({ k: "upgrade", pick: index }), buttonWidth, 80, { fontSize: 26 });
    });
  }

  // --- Angebote -----------------------------------------------------------

  private buildOffers(self: PlayerState, left: number, width: number): void {
    const gap = 10;
    const cardW = (width - 3 * gap) / 4;
    const top = 56;
    const cardH = 190;
    self.shop.offers.forEach((offer, slot) => {
      const x = left + cardW / 2 + slot * (cardW + gap);
      const y = top + cardH / 2;
      this.keep(woodPanel(this.scene, x, y, cardW, cardH).setDepth(DEPTH + 1));
      if (!offer) {
        this.keep(menuText(this.scene, x, y, "Gekauft", 20, UI.text.muted).setDepth(DEPTH + 3));
        return;
      }
      this.buildOfferCard(offer, slot, self, x, y, cardW, cardH);
    });
  }

  private buildOfferCard(
    offer: Offer,
    slot: number,
    self: PlayerState,
    x: number,
    y: number,
    cardW: number,
    cardH: number,
  ): void {
    const isWeapon = offer.kind === "weapon";
    const left = x - cardW / 2 + 10;
    const top = y - cardH / 2 + 8;
    const iconKey = isWeapon ? weaponIconKey(offer.id as WeaponId) : itemIconKey(offer.id);

    this.keep(insetPanel(this.scene, left + 30, top + 32, 60, 60).setDepth(DEPTH + 2));
    this.keep(this.scene.add.image(left + 30, top + 32, iconKey).setDisplaySize(50, 50).setDepth(DEPTH + 3));

    const title = isWeapon ? weaponTitle(offer.id as WeaponId, offer.tier) : (ITEMS.find((item) => item.id === offer.id)?.name ?? offer.id);
    this.text(left + 68, top + 2, title, 17, UI.text.title, true);
    const tag = isWeapon ? (WEAPONS[offer.id as WeaponId].kind === "melee" ? "Nahkampf" : "Fernkampf") : "Gegenstand";
    this.text(left + 68, top + 24, tag, 13, UI.text.muted);
    if (isWeapon) {
      this.keep(
        this.scene.add.rectangle(x + cardW / 2 - 10, top + 8, 10, 10, TIER_COLORS[offer.tier - 1] ?? 0xffffff).setDepth(DEPTH + 3),
      );
    }

    const lines: { text: string; good: boolean }[] = isWeapon
      ? weaponLines(offer.id as WeaponId, offer.tier, self.stats).map((text) => ({ text, good: true }))
      : itemLines(offer.id);
    lines.slice(0, 4).forEach((line, index) => {
      this.text(left + 2, top + 70 + index * 17, line.text, 15, isWeapon ? UI.text.body : line.good ? "#4e6b2a" : "#a8321c", true);
    });

    const canTake = !isWeapon || canTakeWeapon(self, offer.id as WeaponId, offer.tier);
    const afford = self.gold >= offer.price;
    const allowed = !isWeapon || CHARACTERS[self.character].allowed.includes(offer.id as WeaponId);
    const label = !canTake ? "Voll" : `Kaufen · ${offer.price}`;
    this.button(x - cardW / 2 + 10 + (cardW - 106) / 2, y + cardH / 2 - 28, label, () => this.send({ k: "buy", slot }), cardW - 106, 46, {
      enabled: afford && canTake && allowed,
    });
    const locked = self.shop.locked[slot] === true;
    this.button(x + cardW / 2 - 48, y + cardH / 2 - 28, locked ? "Gehalten" : "Halten", () => this.send({ k: "lock", slot }), 84, 46, {
      fontSize: 14,
      primary: !locked,
    });
  }

  // --- Waffen -------------------------------------------------------------

  private buildWeapons(state: GameState, self: PlayerState, left: number): void {
    const slots = CHARACTERS[self.character].slots;
    this.text(left, 256, `Waffen  ${self.weapons.length} / ${slots}`, 18, UI.text.accent, true);
    const cell = 62;
    const gap = 6;
    for (let index = 0; index < slots; index += 1) {
      const x = left + cell / 2 + index * (cell + gap);
      const y = 316;
      const weapon = self.weapons[index];
      this.keep(insetPanel(this.scene, x, y, cell, cell).setDepth(DEPTH + 1));
      if (!weapon) {
        continue;
      }
      this.keep(this.scene.add.image(x, y - 3, weaponIconKey(weapon.id)).setDisplaySize(46, 46).setDepth(DEPTH + 2));
      this.text(x, y + 14, "I".repeat(weapon.tier), 13, UI.text.dark, true, 0.5);
      this.keep(
        this.scene.add
          .rectangle(x, y, cell + 2, cell + 2)
          .setStrokeStyle(index === this.selected ? 5 : 3, index === this.selected ? 0xb5532f : (TIER_COLORS[weapon.tier - 1] ?? 0xffffff))
          .setFillStyle(0, 0)
          .setDepth(DEPTH + 2),
      );
      const hit = this.keep(this.scene.add.rectangle(x, y, cell, cell, 0, 0).setDepth(DEPTH + 4).setInteractive());
      hit.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.selected = this.selected === index ? null : index;
        this.signature = "";
      });
    }

    const weapon = this.selected !== null ? self.weapons[this.selected] : undefined;
    if (weapon && this.selected !== null) {
      const index = this.selected;
      this.text(left, 356, weaponTitle(weapon.id, weapon.tier), 17, UI.text.title, true);
      const canMerge =
        weapon.tier < MAX_TIER &&
        self.weapons.some((other, i) => i !== index && other.id === weapon.id && other.tier === weapon.tier);
      const price = sellPrice(weapon, state.wave);
      this.button(left + 100, 410, `Verkaufen +${price}`, () => {
        this.selected = null;
        this.send({ k: "sell", index });
      }, 190, 46, { enabled: self.weapons.length > 1, fontSize: 17 });
      this.button(left + 305, 410, "Verschmelzen", () => {
        this.selected = null;
        this.send({ k: "merge", index });
      }, 190, 46, { enabled: canMerge, fontSize: 17 });
    } else {
      this.text(left, 360, "Tippe eine Waffe an, um sie zu\nverkaufen oder zu verschmelzen.", 14, UI.text.muted);
    }
  }

  // --- Gegenstaende ---------------------------------------------------------

  private buildItems(self: PlayerState, left: number, right: number): void {
    const owned = self.items.map((count, index) => ({ count, index })).filter((entry) => entry.count > 0);
    this.text(left, 256, `Gegenstände  ${owned.reduce((sum, entry) => sum + entry.count, 0)}`, 18, UI.text.accent, true);
    if (owned.length === 0) {
      this.text(left, 290, "Noch nichts gekauft.", 15, UI.text.muted);
      return;
    }
    const cell = 46;
    const gap = 6;
    const columns = Math.max(1, Math.floor((right - left + gap) / (cell + gap)));
    owned.forEach((entry, position) => {
      const item = ITEMS[entry.index];
      if (!item) {
        return;
      }
      const x = left + cell / 2 + (position % columns) * (cell + gap);
      const y = 302 + Math.floor(position / columns) * (cell + gap) + 4;
      this.keep(this.scene.add.image(x, y, itemIconKey(item.id)).setDisplaySize(cell, cell).setDepth(DEPTH + 2));
      if (entry.count > 1) {
        this.text(x + cell / 2 - 2, y + 4, `×${entry.count}`, 14, PALETTE.gold, true, 1);
      }
    });
  }

  // --- Werte --------------------------------------------------------------

  private buildStats(self: PlayerState, left: number, width: number): void {
    const def = CHARACTERS[self.character];
    this.keep(woodPanel(this.scene, left + width / 2, 272, width, 360).setDepth(DEPTH + 1));
    this.keep(menuText(this.scene, left + width / 2, 110, `${def.name} · Level ${self.level}`, 24, UI.text.accent, true).setDepth(DEPTH + 3));
    const columnWidth = width / 2 - 30;
    STAT_KEYS.forEach((key, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = left + 28 + column * (columnWidth + 24);
      const y = 134 + row * 38;
      const label = STAT_LABELS[key];
      const value = Math.round(self.stats[key] * 10) / 10;
      const unit = label.unit === "%" ? " %" : "";
      this.text(x, y, label.name, 19, UI.text.muted);
      this.text(x + columnWidth, y, `${value}${unit}`, 19, UI.text.title, true, 1);
    });
  }

  // --- Fusszeile ----------------------------------------------------------

  private buildFooter(state: GameState, self: PlayerState, readyCount: number, left: number, right: number): void {
    const y = 494;
    const cost = rerollCost(self, state.wave);
    this.button(left + 110, y, `Neu würfeln · ${cost}`, () => this.send({ k: "reroll" }), 220, 52, {
      enabled: self.gold >= cost && !this.showStats,
      fontSize: 18,
    });
    this.button(left + 340, y, this.showStats ? "Zurück zum Shop" : "Werte", () => {
      this.showStats = !this.showStats;
      this.signature = "";
    }, 200, 52, { primary: false, fontSize: 18 });

    const total = state.players.length;
    const waiting = self.ready;
    const label = waiting
      ? total > 1
        ? `Bereit ✓  ${readyCount}/${total}`
        : "Bereit ✓"
      : self.pendingLevels > 0
        ? "Erst Level-Up wählen"
        : "Weiter ▶";
    this.button(right - 130, y, label, () => this.send({ k: "ready", value: !self.ready }), 260, 58, {
      fontSize: 22,
      enabled: self.pendingLevels === 0,
      primary: !waiting,
    });
  }
}
