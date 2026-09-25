/**
 * Die Werkbank am Rastplatz (2026-09-26): aus Material Verbrauchsgueter und
 * Aufsaetze bauen.
 *
 * Arbeitet auf dem gepackten Rucksack, wie er zwischen zwei Gebieten im Run
 * liegt (`RunState.players[].backpack`). Die Regeln stehen in
 * `systems/gear.ts` (`craft`), die Rezepte in `balance.ts` (`RECIPES`) -
 * hier wird nur angezeigt und angetippt.
 */

import Phaser from "phaser";
import { RECIPES } from "../config/balance";
import { VIEWPORT } from "../config/constants";
import { itemAt, itemIndex } from "../config/items";
import { UI } from "../config/ui";
import { craft, hasIngredients } from "../systems/gear";
import type { PackedItem } from "../systems/types";
import { Button } from "./Button";
import { menuText, woodPanel } from "./menuStyle";

const DEPTH = 500;

export class WorkbenchWindow {
  private parts: Array<{ destroy(): void }> = [];

  constructor(
    private readonly scene: Phaser.Scene,
    /** Der aktuelle Rucksack und seine Groesse. */
    private readonly read: () => { items: PackedItem[]; size: { width: number; height: number } },
    /** Neuer Rucksack nach dem Bauen. */
    private readonly write: (items: PackedItem[]) => void,
  ) {}

  get isOpen(): boolean {
    return this.parts.length > 0;
  }

  open(): void {
    this.close();
    const { items, size } = this.read();
    const centerX = VIEWPORT.width / 2;
    const width = Math.min(760, VIEWPORT.width - 60);
    const height = 430;
    const top = (VIEWPORT.height - height) / 2;

    const backdrop = this.scene.add
      .rectangle(0, 0, VIEWPORT.width * 2, VIEWPORT.height * 2, 0x070b12, 0.7)
      .setOrigin(0)
      .setDepth(DEPTH)
      .setInteractive();
    this.parts.push(backdrop);
    const panel = woodPanel(this.scene, centerX, top + height / 2, width, height);
    panel.setDepth(DEPTH + 1);
    this.parts.push(panel);
    this.parts.push(menuText(this.scene, centerX, top + 28, "Werkbank", 26, UI.text.title, true).setDepth(DEPTH + 2));
    this.parts.push(
      menuText(this.scene, centerX, top + 58, `Material dabei: ${materialLine(items)}`, 13, UI.text.muted).setDepth(DEPTH + 2),
    );

    // Zwei Spalten mit Rezepten.
    const columnWidth = (width - 60) / 2;
    RECIPES.forEach((recipe, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = centerX - width / 2 + 30 + column * (columnWidth + 0);
      const y = top + 92 + row * 62;
      const name = itemAt(itemIndex(recipe.result))?.name ?? recipe.result;
      this.parts.push(
        this.scene.add
          .text(x, y, `${name}\n${needsLine(recipe.needs)}`, {
            fontFamily: UI.font,
            fontSize: "13px",
            color: UI.text.body,
            lineSpacing: 2,
          })
          .setShadow(1, 1, UI.text.shadow, 2)
          .setDepth(DEPTH + 2),
      );
      const possible = craft(items, size, recipe) !== null;
      const reason = hasIngredients(items, recipe) ? "kein Platz" : "fehlt";
      const button = new Button(
        this.scene,
        x + columnWidth - 70,
        y + 18,
        possible ? "Bauen" : reason,
        () => {
          const current = this.read();
          const next = craft(current.items, current.size, recipe);
          if (next) {
            this.write(next);
            this.open(); // neu aufbauen: Material und Knoepfe stimmen wieder
          }
        },
        { width: 110, height: 38, fontSize: 14, variant: possible ? "primary" : "secondary" },
      );
      button.setEnabled(possible);
      button.setDepth(DEPTH + 3);
      this.parts.push(button);
    });

    const close = new Button(this.scene, centerX, top + height - 34, "Fertig", () => this.close(), {
      width: 180,
      height: 44,
      fontSize: 18,
    });
    close.setDepth(DEPTH + 3);
    this.parts.push(close);
  }

  close(): void {
    for (const part of this.parts) part.destroy();
    this.parts = [];
  }
}

/** "2× Schrott + Kabel" */
function needsLine(needs: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const need of needs) counts.set(need, (counts.get(need) ?? 0) + 1);
  return [...counts]
    .map(([id, count]) => `${count > 1 ? `${count}× ` : ""}${itemAt(itemIndex(id))?.name ?? id}`)
    .join(" + ");
}

/** Was an Material im Rucksack liegt, gezaehlt. */
function materialLine(items: readonly PackedItem[]): string {
  const counts = new Map<string, number>();
  for (const entry of items) {
    const def = itemAt(entry.def);
    if (def?.type === "material" && !entry.starter) counts.set(def.name, (counts.get(def.name) ?? 0) + 1);
  }
  return counts.size === 0 ? "keins" : [...counts].map(([name, count]) => `${name} ${count}`).join(", ");
}
