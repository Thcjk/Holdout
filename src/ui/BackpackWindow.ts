/**
 * Der Rucksack im laufenden Run (Etappe 9).
 *
 * ================================================================
 * DAS GITTER HIER IST NUR EINE VORSCHAU
 * ================================================================
 *
 * Der Rucksack gehoert der Simulation - im Koop also dem Host. Was man hier
 * zieht, wird deshalb nicht direkt am echten Rucksack geaendert, sondern:
 *
 *   1. sofort in einer KOPIE umgeraeumt, damit der Finger eine Antwort sieht,
 *   2. als Befehl in die Warteschlange gelegt (`InventoryCommand`),
 *   3. von der Spielszene mit der naechsten Eingabe an die Simulation
 *      geschickt, die ihn mit denselben Regeln prueft und ausfuehrt.
 *
 * Kommt danach ein anderer Stand zurueck (etwas aufgehoben, oder der Host
 * hat den Befehl abgelehnt), wird die Kopie neu aufgebaut - aber nie, solange
 * ein Gegenstand am Finger haengt.
 *
 * ================================================================
 * DIE RUNDE LAEUFT WEITER
 * ================================================================
 *
 * Auch solo. Das Arbeitsdokument verlangt fuer den Koop ausdruecklich kein
 * Anhalten, und ein Rucksack, der solo anhaelt und im Koop nicht, waere eine
 * Regel mehr, die man lernen muss. Die Figur bleibt stehen, solange das
 * Fenster offen ist (die Spielszene schickt eine leere Bewegung) - Umraeumen
 * mitten im Gefecht kostet also etwas. Das ist Absicht.
 */

import Phaser from "phaser";
import { INVENTORY } from "../config/balance";
import { DEPTH, VIEWPORT } from "../config/constants";
import { createGrid, findFreeSpot, place } from "../systems/InventoryGridSystem";
import type { InventoryCommand, PackedItem } from "../systems/types";
import { Button } from "./Button";
import { InventoryGrid } from "./InventoryGrid";

/** Oberkante des Gitters im Fenster. */
const GRID_TOP = 96;

interface GridSize {
  width: number;
  height: number;
}
const FULL: GridSize = { width: INVENTORY.width, height: INVENTORY.height };

export class BackpackWindow {
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly closeButton: Button;
  private grid: InventoryGrid | null = null;

  private readonly queue: InventoryCommand[] = [];
  private open = false;
  /** Aktuelle Groesse des Rucksacks - waechst im Run. */
  private size: GridSize = FULL;
  /** Der zuletzt von der Simulation gesehene Stand, als Vergleichswert. */
  private lastSignature = "";

  constructor(
    private readonly scene: Phaser.Scene,
    onClose: () => void,
  ) {
    // Faengt Beruehrungen ab: Ein Daumen neben dem Gitter soll nicht den
    // Joystick darunter ziehen.
    this.backdrop = scene.add
      .rectangle(0, 0, VIEWPORT.width * 2, VIEWPORT.height * 2, 0x070b12, 0.62)
      .setOrigin(0)
      .setDepth(DEPTH.hud + 7)
      .setInteractive();

    this.title = scene.add
      .text(0, 0, "Rucksack", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setShadow(1, 2, "#00000066", 2)
      .setDepth(DEPTH.hud + 15);

    this.hint = scene.add
      .text(
        0,
        0,
        "Runde läuft weiter · Waffe antippen = ausrüsten · hinausziehen = wegwerfen",
        { fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#ffd166" },
      )
      .setDepth(DEPTH.hud + 15);

    this.closeButton = new Button(scene, 0, 0, "Schliessen", onClose, {
      width: 140,
      height: 40,
      fontSize: 16,
      variant: "secondary",
    });
    this.closeButton.setDepth(DEPTH.hud + 15);

    this.layout();
    this.setVisible(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Oeffnet mit dem aktuellen Stand aus der Simulation. */
  show(backpack: readonly PackedItem[], size: GridSize = FULL): void {
    this.open = true;
    this.size = size;
    this.setVisible(true);
    this.rebuild(backpack);
  }

  hide(): void {
    this.open = false;
    this.setVisible(false);
  }

  /**
   * Gleicht die Vorschau mit der Simulation ab - jedes Bild, solange offen.
   * Neu aufgebaut wird nur, wenn sich dort etwas geaendert hat und gerade
   * nichts am Finger haengt.
   */
  sync(backpack: readonly PackedItem[], size: GridSize = FULL): void {
    if (!this.open || this.grid?.busy) {
      return;
    }
    const grown = size.width !== this.size.width || size.height !== this.size.height;
    this.size = size;
    if (grown || signature(backpack) !== this.lastSignature) {
      this.rebuild(backpack);
    }
  }

  /** Der naechste Befehl fuer die Simulation, ohne ihn zu entfernen. */
  peekCommand(): InventoryCommand | null {
    return this.queue[0] ?? null;
  }

  /** Den vordersten Befehl als verarbeitet abhaken. */
  shiftCommand(): void {
    this.queue.shift();
  }

  layout(): void {
    const width = this.size.width * INVENTORY.cellSize;
    const left = (VIEWPORT.width - width) / 2;
    this.title.setPosition(left, GRID_TOP - 62);
    this.hint.setPosition(left, GRID_TOP - 30);
    // Rechts neben dem Gitter, oben - ueber dem Hinweis lag er auf dem Text.
    this.closeButton.setPosition(Math.min(VIEWPORT.width - 76, left + width + 76), GRID_TOP + 24);
    this.backdrop.setSize(VIEWPORT.width * 2, VIEWPORT.height * 2);
    if (this.open && this.grid) {
      // Das Gitter kennt seine Lage nur aus dem Aufbau - also neu aufbauen.
      this.rebuildFromGrid();
    }
  }

  destroy(): void {
    this.grid?.destroy();
    this.backdrop.destroy();
    this.title.destroy();
    this.hint.destroy();
    this.closeButton.destroy();
  }

  private setVisible(visible: boolean): void {
    this.backdrop.setVisible(visible);
    if (visible) {
      this.backdrop.setInteractive();
    } else {
      this.backdrop.disableInteractive();
    }
    this.title.setVisible(visible);
    this.hint.setVisible(visible);
    this.closeButton.setVisible(visible);
    this.grid?.setVisible(visible);
  }

  private rebuild(backpack: readonly PackedItem[]): void {
    this.lastSignature = signature(backpack);
    const data = createGrid(this.size.width, this.size.height);
    backpack.forEach((entry, index) => {
      const item = { id: index + 1, def: entry.def, starter: entry.starter, equipped: entry.equipped };
      if (!place(data, item, entry.x, entry.y, entry.rotated)) {
        const spot = findFreeSpot(data, entry.def);
        if (spot) {
          place(data, item, spot.x, spot.y, spot.rotated);
        }
      }
    });

    this.grid?.destroy();
    const width = this.size.width * INVENTORY.cellSize;
    const left = (VIEWPORT.width - width) / 2;
    const height = this.size.height * INVENTORY.cellSize;
    this.grid = new InventoryGrid(this.scene, data, {
      x: left,
      y: GRID_TOP,
      // Rechts neben dem Gitter statt darunter: Unten ist kein Platz mehr.
      rotateButtonAt: { x: Math.min(VIEWPORT.width - 70, left + width + 76), y: GRID_TOP + height / 2 },
      rotateButtonWidth: 120,
      depth: DEPTH.hud + 8,
      onMoved: (from, to) => {
        this.queue.push({ op: "move", fromX: from.x, fromY: from.y, ...to });
      },
      onDiscard: (from) => {
        this.queue.push({ op: "drop", fromX: from.x, fromY: from.y });
      },
      equipOnTap: true,
      onEquipped: (at) => {
        this.queue.push({ op: "equip", fromX: at.x, fromY: at.y });
      },
    });
    this.grid.setVisible(this.open);
  }

  private rebuildFromGrid(): void {
    const data = this.grid?.data;
    if (!data) {
      return;
    }
    this.rebuild(
      data.items.map((entry) => ({
        def: entry.item.def,
        x: entry.x,
        y: entry.y,
        rotated: entry.rotated,
        starter: entry.item.starter,
        equipped: entry.item.equipped,
      })),
    );
  }
}

/** Ein kurzer Vergleichswert fuer "hat sich der Rucksack geaendert?". */
function signature(items: readonly PackedItem[]): string {
  return items
    .map((entry) => `${entry.def},${entry.x},${entry.y},${entry.rotated ? 1 : 0}${entry.equipped ? "e" : ""}`)
    .join(";");
}
