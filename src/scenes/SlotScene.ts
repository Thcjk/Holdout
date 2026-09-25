/**
 * Speicherplatz waehlen - fuer "Neu" und fuer "Laden".
 *
 * Drei Holztafeln nebeneinander, je Platz: Charakter, Stand des Runs
 * (Tag, Region) oder "kein laufender Run", Groesse des Lagers, Datum.
 *
 * Ueberschreiben braucht zwei Tipps: Beim ersten wird der Knopf zu
 * "Wirklich ueberschreiben?". Ein versehentlich geloeschter Stand waere
 * nicht zurueckzuholen.
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { CHARACTERS } from "../config/balance";
import { SAFE, VIEWPORT } from "../config/constants";
import { regionOfLayer } from "../config/story";
import { UI } from "../config/ui";
import { setReloadSafe } from "../platform/update";
import { SLOT_COUNT, listSlots, loadSlot, startNewSlot } from "../storage/saveSlots";
import type { SaveGame } from "../storage/saveSlots";
import { generateNodeMap } from "../systems/NodeMapGenerator";
import { Button } from "../ui/Button";
import { insetPanel, menuBackground, menuText, woodPanel } from "../ui/menuStyle";

export interface SlotSceneData {
  mode: "new" | "load";
}

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 250;
const PANEL_GAP = 24;
const PANEL_Y = 250;

export class SlotScene extends Phaser.Scene {
  private mode: "new" | "load" = "new";

  constructor() {
    super("Slots");
  }

  init(data: SlotSceneData): void {
    this.mode = data.mode ?? "new";
  }

  create(): void {
    setReloadSafe(false);
    menuBackground(this);
    const centerX = VIEWPORT.width / 2;
    menuText(
      this,
      centerX,
      52,
      this.mode === "new" ? "Neues Spiel – Platz wählen" : "Spiel laden",
      30,
      UI.text.title,
      true,
    );

    const slots = listSlots();
    const width = Math.min(PANEL_WIDTH, (VIEWPORT.width - 2 * (SAFE.left + SAFE.right + 20) - 2 * PANEL_GAP) / SLOT_COUNT);
    const rowWidth = SLOT_COUNT * width + (SLOT_COUNT - 1) * PANEL_GAP;
    const firstX = (VIEWPORT.width - rowWidth) / 2 + width / 2;
    slots.forEach((save, slot) => this.buildSlot(slot, save, firstX + slot * (width + PANEL_GAP), width));

    new Button(this, SAFE.left + 92, VIEWPORT.height - SAFE.bottom - 34, "Zurück", () => this.scene.start("Title"), {
      width: 140,
      height: 40,
      fontSize: 16,
      variant: "secondary",
    });
  }

  private buildSlot(slot: number, save: SaveGame | null, x: number, width: number): void {
    woodPanel(this, x, PANEL_Y, width, PANEL_HEIGHT);
    menuText(this, x, PANEL_Y - 98, `Platz ${slot + 1}`, 20, UI.text.accent, true);
    insetPanel(this, x, PANEL_Y - 4, width - 36, 136);

    const lines = save ? describe(save) : ["leer"];
    this.add
      .text(x, PANEL_Y - 4, lines.join("\n"), {
        fontFamily: UI.font,
        fontSize: "15px",
        color: UI.text.dark,
        align: "center",
        lineSpacing: 6,
        wordWrap: { width: width - 56 },
      })
      .setOrigin(0.5);

    const buttonY = PANEL_Y + 92;
    if (this.mode === "load") {
      const button = new Button(this, x, buttonY, "Laden", () => this.loadSlot(slot), {
        width: width - 60,
        height: 46,
        fontSize: 18,
      });
      button.setEnabled(save !== null);
      return;
    }

    let armed = save === null;
    const button: Button = new Button(
      this,
      x,
      buttonY,
      save ? "Überschreiben" : "Hier beginnen",
      () => {
        if (!armed) {
          // Erster Tipp auf einen belegten Platz: nur nachfragen.
          armed = true;
          button.setText("Wirklich überschreiben?");
          return;
        }
        audio.unlock();
        startNewSlot(slot, "scout");
        this.scene.start("Mode");
      },
      { width: width - 60, height: 46, fontSize: 17, variant: save ? "secondary" : "primary" },
    );
  }

  private loadSlot(slot: number): void {
    audio.unlock();
    const loaded = loadSlot(slot);
    if (!loaded) return;
    if (loaded.run) {
      // Ein Run laeuft: direkt auf die Karte, genau dort, wo gespeichert wurde.
      this.scene.start("Map", {
        run: loaded.run,
        character: loaded.save.character,
        message: `Weiter geht es – Tag ${loaded.run.day + 1}.`,
      });
      return;
    }
    this.scene.start("Mode");
  }
}

/** Die Zeilen auf der Einlage eines belegten Platzes. */
function describe(save: SaveGame): string[] {
  const lines = [CHARACTERS[save.character]?.name ?? save.character];
  if (save.run) {
    const map = generateNodeMap(save.run.seed);
    const node = map.nodes[save.run.current];
    const region = node ? regionOfLayer(Math.max(1, node.layer), map.depth).name : "";
    lines.push(`Run: Tag ${save.run.day + 1}${region ? ` · ${region}` : ""}`);
  } else {
    lines.push("Kein laufender Run");
  }
  const stored = save.stash.length + save.backpack.filter((entry) => !entry.starter).length;
  lines.push(`Lager: ${stored} ${stored === 1 ? "Gegenstand" : "Gegenstände"}`);
  if (save.savedAt > 0) {
    const date = new Date(save.savedAt);
    lines.push(
      `${date.toLocaleDateString("de-CH")} ${date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`,
    );
  }
  return lines;
}
