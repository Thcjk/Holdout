/**
 * Der Guertel als Anzeige: drei Plaetze nebeneinander, im Look der Gitter.
 *
 * Kein zweites `InventoryGrid`: Im Guertel belegt jeder Gegenstand genau
 * einen Platz, egal wie gross er im Rucksack ist (siehe `gear.ts`,
 * `putInBelt`). Das Gitter rechnet mit Groessen - hier waere das falsch.
 *
 * Bedienung:
 *   - Verbrauchsgut aus dem Rucksack auf einen Platz ziehen -> in den Guertel
 *     (das Gitter fragt ueber `dropOutside` bei `slotAt` nach).
 *   - Einen Guertelplatz antippen -> zurueck in den Rucksack (`onTap`).
 */

import Phaser from "phaser";
import { RARITY_COLORS, itemAt } from "../config/items";
import { UI } from "../config/ui";
import type { InventoryGrid as GridData } from "../systems/types";
import { UiNineSlice } from "./UiNineSlice";

const FRAME_MARGIN = 10;

export interface BeltBarOptions {
  x: number;
  y: number;
  cellSize: number;
  depth: number;
  /** Tipp auf einen belegten Platz. */
  onTap?: (slot: number) => void;
}

export class BeltBar {
  private readonly frame: UiNineSlice;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private belt: GridData;
  /** Platz unter einem gezogenen Gegenstand: Index und ob er passt. */
  private hover: { slot: number; valid: boolean } | null = null;

  constructor(
    scene: Phaser.Scene,
    belt: GridData,
    private readonly options: BeltBarOptions,
  ) {
    this.belt = belt;
    const width = belt.width * options.cellSize;
    const height = options.cellSize;
    this.frame = new UiNineSlice(
      scene,
      UI.panel.frame,
      UI.panel.slice,
      options.x + width / 2,
      options.y + height / 2,
      width + 2 * FRAME_MARGIN,
      height + 2 * FRAME_MARGIN,
    );
    this.frame.setDepth(options.depth);
    this.graphics = scene.add.graphics().setDepth(options.depth + 1);
    this.title = scene.add
      .text(options.x, options.y - 34, "Gürtel · im Kampf per Knopf", {
        fontFamily: UI.font,
        fontSize: "14px",
        color: UI.text.body,
      })
      .setShadow(1, 1, UI.text.shadow, 2)
      .setDepth(options.depth + 1);
    for (let slot = 0; slot < belt.width; slot += 1) {
      this.labels.push(
        scene.add
          .text(0, 0, "", { fontFamily: UI.font, fontSize: "10px", color: "#11161f", fontStyle: "bold" })
          .setOrigin(0.5)
          .setDepth(options.depth + 2),
      );
    }
    this.hitArea = scene.add
      .rectangle(options.x, options.y, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(options.depth + 3)
      .setInteractive();
    this.hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      const slot = this.slotAt(pointer.x, pointer.y);
      if (slot >= 0 && this.belt.items.some((entry) => entry.x === slot)) {
        this.options.onTap?.(slot);
      }
    });
    this.draw();
  }

  /** Welcher Platz liegt unter diesem Bildschirmpunkt? -1 fuer keiner. */
  slotAt(screenX: number, screenY: number): number {
    const { x, y, cellSize } = this.options;
    if (screenY < y - 8 || screenY > y + cellSize + 8) return -1;
    const slot = Math.floor((screenX - x) / cellSize);
    return slot >= 0 && slot < this.belt.width ? slot : -1;
  }

  /** Ist dieser Platz frei? */
  isFree(slot: number): boolean {
    return !this.belt.items.some((entry) => entry.x === slot);
  }

  /** Zielmarke waehrend des Ziehens (oder `null` zum Loeschen). */
  setHover(slot: number, valid: boolean): void {
    const next = slot >= 0 ? { slot, valid } : null;
    if (next?.slot === this.hover?.slot && next?.valid === this.hover?.valid) return;
    this.hover = next;
    this.draw();
  }

  setBelt(belt: GridData): void {
    this.belt = belt;
    this.draw();
  }

  setVisible(visible: boolean): void {
    this.frame.setVisible(visible);
    this.graphics.setVisible(visible);
    this.title.setVisible(visible);
    for (const label of this.labels) label.setVisible(visible && label.text !== "");
    if (visible) this.hitArea.setInteractive();
    else this.hitArea.disableInteractive();
    this.hitArea.setVisible(visible);
  }

  destroy(): void {
    this.frame.destroy();
    this.graphics.destroy();
    this.title.destroy();
    for (const label of this.labels) label.destroy();
    this.hitArea.destroy();
  }

  draw(): void {
    const { x, y, cellSize } = this.options;
    const g = this.graphics;
    g.clear();
    for (let slot = 0; slot < this.belt.width; slot += 1) {
      const cx = x + slot * cellSize;
      g.fillStyle(UI.panel.cellColor, UI.panel.cellAlpha);
      g.fillRect(cx + 2, y + 2, cellSize - 4, cellSize - 4);
      const entry = this.belt.items.find((item) => item.x === slot);
      const def = entry ? itemAt(entry.item.def) : null;
      const label = this.labels[slot];
      if (entry && def) {
        g.fillStyle(RARITY_COLORS[def.rarity] ?? 0xffffff, 0.94);
        g.fillRoundedRect(cx + 5, y + 5, cellSize - 10, cellSize - 10, 6);
        g.lineStyle(2, 0x0d1420, 0.95);
        g.strokeRoundedRect(cx + 5, y + 5, cellSize - 10, cellSize - 10, 6);
        label?.setText(def.short ?? def.name).setPosition(cx + cellSize / 2, y + cellSize / 2).setVisible(true);
        if (label && label.width > cellSize - 12) label.setScale((cellSize - 12) / label.width);
        else label?.setScale(1);
      } else {
        label?.setText("").setVisible(false);
      }
      if (this.hover?.slot === slot) {
        g.lineStyle(3, this.hover.valid ? 0x7fb069 : 0xe4572e, 1);
        g.strokeRect(cx + 2, y + 2, cellSize - 4, cellSize - 4);
      }
    }
  }
}
