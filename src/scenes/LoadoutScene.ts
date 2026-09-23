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
 */

import Phaser from "phaser";
import { audio } from "../audio/AudioEngine";
import { INVENTORY } from "../config/balance";
import { COLORS, SAFE, VIEWPORT } from "../config/constants";
import { itemIndex } from "../config/items";
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
import type { CharacterId, ItemInstance, PackedItem } from "../systems/types";

export interface LoadoutData {
  character: CharacterId;
  /** Wohin es nach dem Packen geht: allein oder in die Lobby. */
  coop?: boolean;
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
  }));
}

export class LoadoutScene extends Phaser.Scene {
  // NICHT `data` nennen: Phasers `Scene` hat bereits ein Feld dieses
  // Namens (den DataManager), und TypeScript weist die Ueberschreibung
  // zu Recht zurueck.
  private setup!: LoadoutData;
  private backpack!: GridData;
  private view!: InventoryGrid;
  private summary!: Phaser.GameObjects.Text;

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
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.backpack = createGrid();
    this.fillWithStarterSet();

    this.add
      .text(VIEWPORT.width / 2, SAFE.top + 22, "Rucksack packen", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "26px",
        color: "#dce8f7",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(
        VIEWPORT.width / 2,
        SAFE.top + 54,
        "Ziehen verschiebt · Tippen dreht · DREHEN dreht beim Halten",
        { fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#8ea6c4" },
      )
      .setOrigin(0.5);

    const gridWidth = INVENTORY.width * INVENTORY.cellSize;
    this.view = new InventoryGrid(this, this.backpack, {
      x: (VIEWPORT.width - gridWidth) / 2,
      y: SAFE.top + 92,
      onChange: () => this.updateSummary(),
    });

    this.summary = this.add
      .text(VIEWPORT.width / 2, SAFE.top + 92 + INVENTORY.height * INVENTORY.cellSize + 62, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#8ea6c4",
      })
      .setOrigin(0.5);
    this.updateSummary();

    new Button(
      this,
      VIEWPORT.width - SAFE.right - 96,
      VIEWPORT.height - SAFE.bottom - 34,
      "Run starten",
      () => this.startRun(),
      { width: 170, height: 46, fontSize: 18 },
    );

    new Button(
      this,
      SAFE.left + 84,
      VIEWPORT.height - SAFE.bottom - 34,
      "Zurück",
      () => this.scene.start("Menu"),
      { width: 140, height: 46, fontSize: 16, color: COLORS.hudDim },
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.view.destroy());
  }

  /**
   * Legt das Starter-Set ein.
   *
   * Ueber `findFreeSpot`, also genau ueber den Weg, den auch das Aufsammeln
   * im Gefecht nimmt. Eine eigene Anordnung von Hand waere eine zweite
   * Platzierungslogik - und die erste, die nicht mehr stimmt, sobald jemand
   * die Gittergroesse aendert.
   */
  private fillWithStarterSet(): void {
    for (const item of starterItems(1)) {
      const spot = findFreeSpot(this.backpack, item.def);
      if (spot) {
        place(this.backpack, item, spot.x, spot.y, spot.rotated);
      }
    }
  }

  private updateSummary(): void {
    const cells = this.backpack.width * this.backpack.height;
    this.summary.setText(
      `${this.backpack.items.length} Gegenstände · ${usedCells(this.backpack)} von ${cells} Zellen belegt`,
    );
  }

  /**
   * Der gepackte Rucksack in der Form, die durch den Run reist.
   *
   * Position und Drehung kommen mit, nicht nur die Gegenstaende: Wer gerade
   * von Hand eingeraeumt hat, soll seinen Rucksack im Run genauso vorfinden.
   */
  private packed(): PackedItem[] {
    return this.backpack.items.map((entry) => ({
      def: entry.item.def,
      x: entry.x,
      y: entry.y,
      rotated: entry.rotated,
    }));
  }

  private startRun(): void {
    audio.unlock();
    const backpack = this.packed();

    if (this.setup.coop) {
      // Im Koop geht der Rucksack ueber die Lobby: Der Client meldet ihn im
      // `hello`, der Host nimmt ihn in die Spielerliste und schickt sie im
      // `start` an alle. So baut jedes Geraet denselben Rucksack auf.
      this.scene.start("Lobby", { character: this.setup.character, backpack });
      return;
    }
    this.scene.start("Game", { character: this.setup.character, backpack });
  }
}
