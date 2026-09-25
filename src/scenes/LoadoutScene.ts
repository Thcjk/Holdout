/**
 * Der Rucksack vor dem Run.
 *
 * ================================================================
 * WARUM DAS EINE EIGENE SZENE IST UND KEIN ANHANG DES MENUES
 * ================================================================
 *
 * Das Menue waehlt den CHARAKTER - drei Karten nebeneinander, die den ganzen
 * Bildschirm fuellen. Der Rucksack braucht ein Gitter von 512 x 256
 * Entwurfseinheiten plus eine Liste daneben; beides in eine Szene zu
 * quetschen hiesse, eines von beidem zu verkleinern, bis es auf dem Handy
 * nicht mehr zu bedienen ist.
 *
 * Ausserdem sind es zwei verschiedene Fragen: "Wer bin ich?" und "Was nehme
 * ich mit?". Sie nacheinander zu stellen ist auch inhaltlich richtig - die
 * zweite haengt ab Phase 12 von der ersten ab.
 *
 * ================================================================
 * STARTEN GEHT AUCH MIT LEEREM RUCKSACK
 * ================================================================
 *
 * Erwogen war, den Knopf erst freizugeben, wenn etwas eingepackt ist. Dagegen
 * spricht, dass es in dieser Phase NICHTS ABZUWAEGEN gibt: Das Starter-Set
 * ist das Einzige, was zur Auswahl steht, und es passt vollstaendig hinein
 * (6 von 32 Zellen). Ein Zwang waere damit eine Pflichtuebung ohne
 * Entscheidung dahinter - und genau solche Huerden sind es, die zwischen
 * "nochmal" und dem naechsten Run stehen.
 *
 * Ab Phase 13, wenn das Lager echte Alternativen bietet, wird das Packen von
 * selbst interessant. Dann kann man die Frage neu stellen.
 *
 * ================================================================
 * SEIT ETAPPE 9: LAGER LINKS, RUCKSACK RECHTS
 * ================================================================
 *
 * Das Arbeitsdokument verlangt: Starter-Set links, LEERER Rucksack rechts.
 * Vorher lag das Starter-Set schon fertig im Rucksack - es gab nichts zu
 * packen, nur umzuraeumen. Jetzt:
 *
 *   links   Lager (5 x 6): das Starter-Set, soweit es nicht schon im
 *           Rucksack liegt, plus alles, was man frueher herausgenommen hat.
 *   rechts  Rucksack (8 x 6): leer nach einem Wipe; nach einem Erfolg so,
 *           wie er aus dem Run kam.
 *
 * Gezogen wird zwischen beiden wie innerhalb eines Gitters. Starter-Stuecke
 * tragen eine goldene Ecke: Sie gehen nie verloren (`storage/carried.ts`).
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { INVENTORY } from "../config/balance";
import { SAFE, VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { menuBackground } from "../ui/menuStyle";
import { itemIndex } from "../config/items";
import {
  backpackForNextRun,
  saveStash,
  stashItems,
} from "../storage/carried";
import { packGrid } from "../systems/backpackCodec";
import { createRun } from "../systems/run";
import { startSize } from "../systems/InventoryGridSystem";
import { FORCED_SEED, PLACE_FROM_URL } from "../platform/debugFlags";
import { clearEquipped, settleEquipped, weaponLabel } from "../systems/weapons";
import {
  createGrid,
  findFreeSpot,
  place,
  usedCells,
} from "../systems/InventoryGridSystem";
import type { InventoryGrid as GridData } from "../systems/types";
import { Button } from "../ui/Button";
import { InventoryGrid } from "../ui/InventoryGrid";
import { setReloadSafe } from "../platform/update";
import type { Transport } from "../net/Transport";
import type { CharacterId, ItemInstance, PackedItem } from "../systems/types";

export interface LoadoutData {
  character: CharacterId;
  /** Wohin es nach dem Packen geht: allein oder in die Lobby. */
  coop?: boolean;
  /** Nach einem Koop-Run: die noch offene Verbindung zum selben Raum. */
  transport?: Transport;
}

/**
 * Das Starter-Set als frische Gegenstaende.
 *
 * Jedes Mal NEU erzeugt und nicht aus einer Vorratsliste genommen: Es ist
 * laut Briefing unverlierbar, steht also unabhaengig davon zur Verfuegung,
 * was ein vorheriger Run gekostet hat. Sobald es in Phase 13 ein echtes Lager
 * gibt, kommt der Rest von dort - das Starter-Set bleibt daneben bestehen.
 */
function starterItems(startId: number): ItemInstance[] {
  return INVENTORY.starterSet.map((id, offset) => ({
    id: startId + offset,
    def: itemIndex(id),
    starter: true,
  }));
}

/**
 * Zellengroesse im Packbildschirm - zwei Einheiten kleiner als im Spiel.
 *
 * Mit 64 waeren beide Gitter zusammen 6 x 64 = 384 hoch, und auf einem
 * iPhone (unterer Rand 21) laege die Knopfzeile ueber der letzten Gitterzeile.
 * 62 sind auf dem iPhone 13 quer 62 x 0,722 = 44,8 Punkte - weiterhin ueber
 * Apples Mindestmass von 44.
 */
const LOADOUT_CELL = 62;
/** Kleiner wird eine Zelle nie - darunter trifft kein Daumen mehr sicher. */
const MIN_CELL = 40;
/** Hoehe der Knopfzeile unten, samt Luft zum Gitter. */
const FOOTER_HEIGHT = 66;
/** Platz zwischen den Gittern fuer den Drehknopf. */
const MIN_MIDDLE_GAP = 96;
/** Ueber den Gittern und gezogenen Gegenstaenden. */
const BUTTON_DEPTH = 1000;

export class LoadoutScene extends Phaser.Scene {
  // NICHT `data` nennen: Phasers `Scene` hat bereits ein Feld dieses
  // Namens (den DataManager), und TypeScript weist die Ueberschreibung
  // zu Recht zurueck.
  private setup!: LoadoutData;
  private backpack!: GridData;
  private stash!: GridData;
  private view!: InventoryGrid;
  private stashView!: InventoryGrid;
  private summary!: Phaser.GameObjects.Text;
  private nextId = 1;

  constructor() {
    super("Loadout");
  }

  init(setup: LoadoutData): void {
    this.setup = setup;
  }

  create(): void {
    // Hier laeuft keine Runde - ein Neustart wegen einer neuen Version kostet
    // hoechstens ein paar Sekunden Packen.
    setReloadSafe(true);
    menuBackground(this);

    this.nextId = 1;
    // Jeder Run beginnt mit dem KLEINEN Rucksack - er waechst unterwegs
    // durch Taschen und Rastplaetze (`INVENTORY.growth`).
    const start = startSize();
    this.backpack = createGrid(start.width, start.height);
    this.stash = createGrid(INVENTORY.stashWidth, INVENTORY.stashHeight);
    this.fillFromStorage();
    settleEquipped(this.backpack);

    this.add
      .text(VIEWPORT.width / 2, SAFE.top + 18, "Rucksack packen", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "24px",
        color: UI.text.title,
        fontStyle: "bold",
      })
      .setShadow(1, 2, UI.text.shadow, 3)
      .setOrigin(0.5);

    this.add
      .text(
        VIEWPORT.width / 2,
        SAFE.top + 44,
        "Ziehen verschiebt · Waffe antippen = ausrüsten ✓ · Rucksack wächst im Run durch Taschen",
        { fontFamily: "system-ui, sans-serif", fontSize: "13px", color: UI.text.muted },
      )
      .setShadow(1, 1, UI.text.shadow, 2)
      .setOrigin(0.5);

    const top = SAFE.top + 82;
    /*
     * Zellgroesse nach dem Platz, der WIRKLICH da ist: zwischen Kopfzeile und
     * Knopfzeile, und zwischen linkem und rechtem Rand. Fest 62 ging auf
     * einem iPhone mit grossem oberen Rand schief - die Gitter ragten ueber
     * die Knoepfe, und "Run starten" war nicht mehr zu erreichen. Lieber
     * etwas kleinere Zellen als ein Spiel, das sich nicht starten laesst.
     */
    const footer = FOOTER_HEIGHT + SAFE.bottom;
    const byHeight = Math.floor((VIEWPORT.height - footer - top) / INVENTORY.height);
    const byWidth = Math.floor(
      (VIEWPORT.width - SAFE.left - SAFE.right - 40 - MIN_MIDDLE_GAP) /
        (INVENTORY.stashWidth + INVENTORY.width),
    );
    const cell = Math.max(MIN_CELL, Math.min(LOADOUT_CELL, byHeight, byWidth));
    const stashLeft = SAFE.left + 20;
    // Platz fuer den VOLL ausgebauten Rucksack freihalten, damit das Bild
    // nicht springt; der kleine Start-Rucksack sitzt rechtsbuendig darin.
    const fullLeft = VIEWPORT.width - SAFE.right - 20 - INVENTORY.width * cell;
    const backpackLeft = VIEWPORT.width - SAFE.right - 20 - this.backpack.width * cell;
    const stashRight = stashLeft + INVENTORY.stashWidth * cell;
    const gap = fullLeft - stashRight;
    // Der Drehknopf sitzt zwischen den Gittern - unter ihnen waere er der
    // Knopfzeile im Weg.
    const rotateButtonAt = {
      x: stashRight + gap / 2,
      y: top + (INVENTORY.height * cell) / 2,
    };
    const rotateButtonWidth = Math.max(80, Math.min(140, gap - 16));

    this.stashView = new InventoryGrid(this, this.stash, {
      x: stashLeft,
      y: top,
      cellSize: cell,
      onChange: () => this.updateSummary(),
      rotateButtonAt,
      rotateButtonWidth,
    });
    this.view = new InventoryGrid(this, this.backpack, {
      x: backpackLeft,
      y: top,
      cellSize: cell,
      onChange: () => this.updateSummary(),
      equipOnTap: true,
      rotateButtonAt,
      rotateButtonWidth,
    });
    this.stashView.link(this.view);

    const labelStyle = { fontFamily: "system-ui, sans-serif", fontSize: "14px", color: UI.text.body };
    this.add.text(stashLeft, top - 28, "Lager", labelStyle).setShadow(1, 1, "#00000066", 2);
    this.summary = this.add
      .text(fullLeft, top - 28, "", labelStyle)
      .setShadow(1, 1, "#00000066", 2);
    this.updateSummary();

    // Knoepfe ueber allem - selbst wenn es einmal eng wird, liegen sie nie
    // unter einem Gitter.
    new Button(
      this,
      VIEWPORT.width - SAFE.right - 96,
      VIEWPORT.height - SAFE.bottom - 34,
      "Run starten",
      () => this.startRun(),
      { width: 170, height: 46, fontSize: 18 },
    ).setDepth(BUTTON_DEPTH);

    new Button(
      this,
      SAFE.left + 84,
      VIEWPORT.height - SAFE.bottom - 34,
      "Zurück",
      () => {
        // Zurueck ins Menue heisst: raus aus dem Raum.
        this.setup.transport?.close();
        this.scene.start("Menu");
      },
      { width: 140, height: 46, fontSize: 16, variant: "secondary" },
    ).setDepth(BUTTON_DEPTH);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.view.destroy();
      this.stashView.destroy();
    });
  }

  /**
   * Fuellt beide Gitter aus dem, was der letzte Run hinterlassen hat.
   *
   * Rucksack: nach einem Erfolg wie er war, nach einem Wipe leer. Lager:
   * was man frueher herausgenommen hat, plus die Starter-Stuecke, die NICHT
   * schon im Rucksack liegen - sonst gaebe es nach einem Erfolg zwei
   * Pistolen.
   *
   * Wo die gespeicherte Lage nicht mehr passt, sucht `findFreeSpot` einen
   * Platz - derselbe Weg wie beim Aufsammeln im Gefecht.
   */
  private fillFromStorage(): void {
    for (const entry of backpackForNextRun()) {
      const item = { id: this.nextId++, def: entry.def, starter: entry.starter, equipped: entry.equipped };
      // Nach einem Erfolg war der Rucksack evtl. groesser als der kleine
      // Start-Rucksack - was nicht passt, wandert ins Lager statt zu verschwinden.
      if (!this.put(this.backpack, item, entry)) {
        this.put(this.stash, { ...item, equipped: false }, null);
      }
    }
    for (const entry of stashItems()) {
      this.put(this.stash, { id: this.nextId++, def: entry.def }, entry);
    }

    const alreadyPacked = this.backpack.items
      .filter((entry) => entry.item.starter)
      .map((entry) => entry.item.def);
    for (const item of starterItems(this.nextId)) {
      this.nextId += 1;
      const packedIndex = alreadyPacked.indexOf(item.def);
      if (packedIndex >= 0) {
        alreadyPacked.splice(packedIndex, 1);
        continue;
      }
      this.put(this.stash, item, null);
    }
  }

  /** Legt an die gewuenschte Stelle, sonst an die erste freie. */
  private put(
    grid: GridData,
    item: ItemInstance,
    at: { x: number; y: number; rotated: boolean } | null,
  ): boolean {
    if (at && place(grid, item, at.x, at.y, at.rotated)) {
      return true;
    }
    const spot = findFreeSpot(grid, item.def);
    if (spot) {
      return place(grid, item, spot.x, spot.y, spot.rotated);
    }
    return false;
  }

  private updateSummary(): void {
    /*
     * Nach JEDER Aenderung: Im Lager ist nichts ausgeruestet, im Rucksack
     * genau eine Waffe, wenn eine da ist. Wird die aktive Waffe ins Lager
     * gezogen, springt die naechste ein; kommt die erste Waffe in den
     * Rucksack, ist sie sofort ausgeruestet (`systems/weapons.ts`).
     */
    clearEquipped(this.stash);
    settleEquipped(this.backpack);

    const cells = this.backpack.width * this.backpack.height;
    this.summary.setText(
      `Rucksack · ${this.backpack.items.length} ${this.backpack.items.length === 1 ? "Gegenstand" : "Gegenstände"} · ${usedCells(this.backpack)} von ${cells} Zellen · Waffe: ${weaponLabel(this.backpack)}`,
    );
  }

  /**
   * Der gepackte Rucksack in der Form, die durch den Run reist.
   *
   * Position und Drehung kommen mit, nicht nur die Gegenstaende: Wer gerade
   * von Hand eingeraeumt hat, soll seinen Rucksack im Run genauso vorfinden.
   */
  private packed(): PackedItem[] {
    return packGrid(this.backpack);
  }

  private startRun(): void {
    audio.unlock();
    const backpack = this.packed();
    // Das Lager bleibt, wie es beim Loslaufen aussah - ein Wipe fasst es
    // nicht an.
    saveStash(packGrid(this.stash));

    if (this.setup.coop) {
      // Im Koop geht der Rucksack ueber die Lobby: Der Client meldet ihn im
      // `hello`, der Host nimmt ihn in die Spielerliste und schickt sie im
      // `start` an alle. So baut jedes Geraet denselben Rucksack auf.
      this.scene.start("Lobby", {
        character: this.setup.character,
        backpack,
        transport: this.setup.transport,
      });
      return;
    }
    if (PLACE_FROM_URL) {
      // `?knoten=` / `?welt=offen`: direkt ins Gebiet, ohne Karte.
      this.scene.start("Game", { character: this.setup.character, backpack });
      return;
    }
    // Solo geht es zuerst auf die Knoten-Karte (seit 2026-09-25): Dort
    // waehlt man das erste Gebiet, nicht der Zufall.
    const run = createRun(FORCED_SEED ?? Date.now() & 0x7fffffff, [
      { id: "local", name: "Du", character: this.setup.character, backpack },
    ]);
    this.scene.start("Map", { run, character: this.setup.character });
  }
}
