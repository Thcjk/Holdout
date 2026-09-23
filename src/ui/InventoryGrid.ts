/**
 * Das sichtbare Rucksack-Gitter mit Ziehen und Drehen.
 *
 * Zeichnet und nimmt Beruehrungen entgegen - mehr nicht. OB etwas an eine
 * Stelle passt, entscheidet ausschliesslich `systems/InventoryGridSystem.ts`.
 * Diese Datei fragt dort nach und stellt die Antwort dar.
 *
 * ================================================================
 * DREI ENTSCHEIDUNGEN, DIE DER DAUMEN ERZWUNGEN HAT
 * ================================================================
 *
 * 1. DER GEZOGENE GEGENSTAND SCHWEBT UEBER DEM FINGER, nicht unter ihm.
 *    Auf einem Handy verdeckt die Fingerkuppe rund eine Daumenbreite - bei
 *    einer Zelle von 64 Einheiten also mehr als die ganze Zelle. Man wuerde
 *    blind schieben. Deshalb liegt das gezogene Bild um eine Zellenhoehe
 *    nach OBEN versetzt: Man sieht, was man traegt, und man sieht die
 *    Zielzelle darunter.
 *
 * 2. GETIPPT WIRD GEDREHT, GEZOGEN WIRD VERSCHOBEN.
 *    Ein Doppeltipp waere auf einem kleinen Bildschirm unzuverlaessig (der
 *    zweite Tipp landet leicht eine Zelle daneben), und ein Drehknopf, den
 *    man nur mit der zweiten Hand erreicht, hilft niemandem, der das Handy
 *    einhaendig haelt. Ein kurzer Tipp ohne Ziehen ist eindeutig von einer
 *    Zugbewegung zu unterscheiden - er hat keine andere Bedeutung, die damit
 *    kollidieren koennte, denn eine Auswahl gibt es hier nicht.
 *
 * 3. ZUSAETZLICH EIN DREHKNOPF, WAEHREND MAN HAELT.
 *    Fuer den Fall, der sonst umstaendlich waere: Der Gegenstand passt an
 *    die Zielstelle NUR gedreht. Ohne Knopf muesste man ihn ablegen,
 *    antippen und neu aufnehmen. Der Knopf erscheint nur waehrend des
 *    Ziehens und wird mit einem zweiten Finger getippt - auf einem Handy die
 *    natuerliche Bewegung, Daumen haelt, Zeigefinger tippt.
 */

import Phaser from "phaser";
import { INVENTORY } from "../config/balance";
import { COLORS, DEPTH } from "../config/constants";
import { RARITY_COLORS, itemAt } from "../config/items";
import {
  fits,
  footprint,
  itemIndexAt,
  move,
  type InventoryGrid as GridData,
} from "../systems/InventoryGridSystem";

/**
 * Ab dieser Zugstrecke gilt eine Beruehrung als Ziehen und nicht als Tipp.
 *
 * 14 Einheiten sind rund ein Fuenftel einer Zelle - klein genug, dass ein
 * gewolltes Verschieben sofort greift, gross genug, dass das unvermeidliche
 * Wackeln beim Antippen nicht schon als Zug zaehlt.
 */
const TAP_THRESHOLD = 14;

/** Wie weit der gezogene Gegenstand ueber dem Finger schwebt. */
const DRAG_LIFT = INVENTORY.cellSize;

export interface InventoryGridOptions {
  /** Linke obere Ecke in Entwurfseinheiten. */
  x: number;
  y: number;
  cellSize?: number;
  /** Wird gerufen, sobald sich am Inhalt etwas geaendert hat. */
  onChange?: () => void;
}

interface DragState {
  index: number;
  /** Wo im Gegenstand der Finger aufgesetzt hat, in Zellen. */
  grabX: number;
  grabY: number;
  rotated: boolean;
  /** Ausgangslage - dorthin geht es zurueck, wenn das Ziel nicht passt. */
  fromX: number;
  fromY: number;
  fromRotated: boolean;
  /** Startpunkt der Beruehrung, um Tipp von Zug zu unterscheiden. */
  startX: number;
  startY: number;
  moved: boolean;
  pointerX: number;
  pointerY: number;
}

export class InventoryGrid {
  private readonly cells: Phaser.GameObjects.Graphics;
  private readonly contents: Phaser.GameObjects.Graphics;
  /** Nur der gerade gezogene Gegenstand - ueber allen Beschriftungen. */
  private readonly heldLayer: Phaser.GameObjects.Graphics;
  private heldLabel: Phaser.GameObjects.Text | null = null;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private readonly rotateHint: Phaser.GameObjects.Container;

  private readonly cellSize: number;
  private drag: DragState | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private grid: GridData,
    private readonly options: InventoryGridOptions,
  ) {
    this.cellSize = options.cellSize ?? INVENTORY.cellSize;

    this.cells = scene.add.graphics().setDepth(DEPTH.hud);
    this.contents = scene.add.graphics().setDepth(DEPTH.hud + 1);
    /*
     * EIGENE EBENE FUER DAS GETRAGENE.
     *
     * Beschriftungen sind eigene Textobjekte und liegen ueber der
     * Zeichenflaeche der Koerper. Solange alles auf EINER Ebene liegt, steht
     * damit "Verband" auch dann noch da, wenn die gezogene Pistole laengst
     * darueber liegt - im Emulator stand an einer Stelle "Pistole" quer durch
     * "Verband" und "Munitionskiste". Zwei Woerter uebereinander liest
     * niemand.
     *
     * Das Getragene bekommt deshalb eine Ebene UEBER allen Beschriftungen,
     * seine eigene noch eine darueber.
     */
    this.heldLayer = scene.add.graphics().setDepth(DEPTH.hud + 4);

    const width = grid.width * this.cellSize;
    const height = grid.height * this.cellSize;
    this.hitArea = scene.add
      .rectangle(options.x, options.y, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(DEPTH.hud + 2)
      .setInteractive();

    /*
     * Ein EINZIGES Beruehrungsfeld ueber dem ganzen Gitter statt eines
     * Objekts je Gegenstand.
     *
     * Mit einem Objekt je Gegenstand muesste bei jeder Bewegung eines
     * angelegt, verschoben und wieder abgeraeumt werden - und die Reihenfolge,
     * in der Phaser sie trifft, haengt dann an der Zeichenreihenfolge. Welche
     * Zelle beruehrt wurde, laesst sich dagegen direkt ausrechnen, und WAS
     * dort liegt, weiss ohnehin nur das Gittersystem.
     */
    this.hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);

    // Zweiter Finger fuer den Drehknopf.
    scene.input.addPointer(1);

    this.rotateHint = this.buildRotateButton();
    this.draw();
  }

  /** Tauscht den dargestellten Rucksack aus. */
  setGrid(grid: GridData): void {
    this.grid = grid;
    this.drag = null;
    this.draw();
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.cells.destroy();
    this.contents.destroy();
    this.heldLayer.destroy();
    this.heldLabel?.destroy();
    this.hitArea.destroy();
    this.rotateHint.destroy();
    for (const label of this.labels) {
      label.destroy();
    }
  }

  // ----------------------------------------------------------------
  // Beruehrung
  // ----------------------------------------------------------------

  private onDown(pointer: Phaser.Input.Pointer): void {
    const cell = this.cellAt(pointer.x, pointer.y);
    if (!cell) {
      return;
    }

    const index = itemIndexAt(this.grid, cell.x, cell.y);
    if (index < 0) {
      return;
    }

    const entry = this.grid.items[index];
    if (!entry) {
      return;
    }

    this.drag = {
      index,
      grabX: cell.x - entry.x,
      grabY: cell.y - entry.y,
      rotated: entry.rotated,
      fromX: entry.x,
      fromY: entry.y,
      fromRotated: entry.rotated,
      startX: pointer.x,
      startY: pointer.y,
      moved: false,
      pointerX: pointer.x,
      pointerY: pointer.y,
    };

    this.rotateHint.setVisible(true);
    this.draw();
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.drag || !pointer.isDown) {
      return;
    }

    this.drag.pointerX = pointer.x;
    this.drag.pointerY = pointer.y;

    const travelled = Math.hypot(
      pointer.x - this.drag.startX,
      pointer.y - this.drag.startY,
    );
    if (travelled > TAP_THRESHOLD) {
      this.drag.moved = true;
    }

    this.draw();
  }

  private onUp(): void {
    const drag = this.drag;
    if (!drag) {
      return;
    }

    this.drag = null;
    this.rotateHint.setVisible(false);

    if (!drag.moved) {
      // Ein Tipp: an Ort und Stelle drehen, wenn es so passt.
      this.rotateInPlace(drag.index);
      this.draw();
      return;
    }

    const target = this.targetCell(drag);
    if (target) {
      const entry = this.grid.items[drag.index];
      if (
        entry &&
        move(this.grid, drag.index, target.x, target.y, drag.rotated)
      ) {
        this.options.onChange?.();
      }
    }

    this.draw();
  }

  /**
   * Dreht einen liegenden Gegenstand an Ort und Stelle.
   *
   * Passt er gedreht nicht an dieselbe Stelle, bleibt er, wie er ist - er
   * springt NICHT woandershin. Ein Gegenstand, der beim Antippen quer durch
   * den Rucksack huepft, ist nicht hilfreich, sondern verwirrend: Man haette
   * nicht darum gebeten, ihn zu verschieben.
   */
  private rotateInPlace(index: number): void {
    const entry = this.grid.items[index];
    if (!entry) {
      return;
    }
    if (move(this.grid, index, entry.x, entry.y, !entry.rotated)) {
      this.options.onChange?.();
    }
  }

  /** In welche Zelle wuerde der gezogene Gegenstand abgelegt? */
  private targetCell(drag: DragState): { x: number; y: number } | null {
    // Der Griffpunkt bleibt unter dem Finger - nur eben eine Zellenhoehe
    // darueber, weil das Bild angehoben schwebt.
    const cell = this.cellAt(drag.pointerX, drag.pointerY - DRAG_LIFT, true);
    if (!cell) {
      return null;
    }
    return { x: cell.x - drag.grabX, y: cell.y - drag.grabY };
  }

  /**
   * Rechnet Bildschirmkoordinaten in eine Zelle um.
   *
   * `allowOutside` laesst Zellen ausserhalb des Gitters zu - beim Ziehen
   * gebraucht, damit ein Gegenstand, dessen Griffpunkt gerade ueber dem Rand
   * liegt, trotzdem eine sinnvolle Zielzelle hat. Ob das Ergebnis gueltig
   * ist, entscheidet ohnehin `fits`.
   */
  private cellAt(
    screenX: number,
    screenY: number,
    allowOutside = false,
  ): { x: number; y: number } | null {
    const x = Math.floor((screenX - this.options.x) / this.cellSize);
    const y = Math.floor((screenY - this.options.y) / this.cellSize);

    if (!allowOutside) {
      if (x < 0 || y < 0 || x >= this.grid.width || y >= this.grid.height) {
        return null;
      }
    }

    return { x, y };
  }

  // ----------------------------------------------------------------
  // Zeichnen
  // ----------------------------------------------------------------

  private draw(): void {
    this.drawCells();
    this.drawItems();
  }

  /** Das leere Raster plus die Markierung der Zielzellen beim Ziehen. */
  private drawCells(): void {
    const g = this.cells;
    g.clear();

    const { x: left, y: top } = this.options;
    const width = this.grid.width * this.cellSize;
    const height = this.grid.height * this.cellSize;

    g.fillStyle(0x0d1420, 0.85);
    g.fillRoundedRect(left - 6, top - 6, width + 12, height + 12, 8);

    for (let y = 0; y < this.grid.height; y += 1) {
      for (let x = 0; x < this.grid.width; x += 1) {
        g.fillStyle(0x1b2430, 0.9);
        g.fillRect(
          left + x * this.cellSize + 2,
          top + y * this.cellSize + 2,
          this.cellSize - 4,
          this.cellSize - 4,
        );
      }
    }

    g.lineStyle(2, COLORS.hudDim, 0.7);
    g.strokeRoundedRect(left - 6, top - 6, width + 12, height + 12, 8);

    if (!this.drag || !this.drag.moved) {
      return;
    }

    /*
     * Gruen heisst "passt", rot heisst "passt nicht" - und die Flaeche zeigt
     * GENAU die Zellen, die der Gegenstand belegen wuerde. Ein blosser Rahmen
     * um die eine Zelle unter dem Finger waere eine Luege bei allem, was
     * groesser als 1x1 ist.
     */
    const entry = this.grid.items[this.drag.index];
    const target = this.targetCell(this.drag);
    if (!entry || !target) {
      return;
    }

    const size = footprint(entry.item.def, this.drag.rotated);
    if (!size) {
      return;
    }

    const valid = fits(
      this.grid,
      entry.item.def,
      this.drag.rotated,
      target.x,
      target.y,
      this.drag.index,
    );

    /*
     * Fuellung UND kraeftiger Rahmen - im ersten Versuch nur Fuellung, und
     * das war im Emulator fast nicht zu sehen: Das gezogene Bild liegt genau
     * auf der Zielflaeche und deckte sie ab, uebrig blieb ein Streifen von
     * drei Pixeln. Die Rueckmeldung "passt / passt nicht" ist aber der ganze
     * Sinn der Markierung.
     *
     * Deshalb jetzt beides: ein Rahmen, der um den Gegenstand herum
     * sichtbar bleibt, und eine Fuellung, die durch das halbdurchsichtige
     * Bild durchscheint.
     */
    const color = valid ? COLORS.mate : COLORS.danger;
    const px = left + target.x * this.cellSize;
    const py = top + target.y * this.cellSize;
    const pw = size.width * this.cellSize;
    const ph = size.height * this.cellSize;

    g.fillStyle(color, 0.35);
    g.fillRect(px, py, pw, ph);
    g.lineStyle(5, color, 1);
    g.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
  }

  /** Die Gegenstaende selbst. */
  private drawItems(): void {
    this.contents.clear();
    this.heldLayer.clear();

    let labelIndex = 0;

    /*
     * DER GETRAGENE GEGENSTAND WIRD ZULETZT GEZEICHNET.
     *
     * Im ersten Versuch lief diese Schleife einfach in Listenreihenfolge. Die
     * Pistole steht im Starter-Set an erster Stelle, wurde also als erste
     * gezeichnet - und die drei Gegenstaende danach deckten sie zu. Im
     * Emulator war vom gezogenen Gegenstand nur noch die Beschriftung zu
     * sehen (die liegt als eigenes Textobjekt darueber), der Koerper
     * verschwand hinter den anderen. Es sah aus, als waere er verschwunden.
     *
     * Die Reihenfolge ist deshalb nicht die der Liste, sondern: erst alles
     * Liegende, dann das Getragene.
     */
    const heldIndex = this.drag?.moved ? this.drag.index : -1;
    const order: number[] = [];
    for (let i = 0; i < this.grid.items.length; i += 1) {
      if (i !== heldIndex) {
        order.push(i);
      }
    }
    if (heldIndex >= 0) {
      order.push(heldIndex);
    }

    for (const i of order) {
      const entry = this.grid.items[i];
      if (!entry) {
        continue;
      }

      const held = i === heldIndex;
      const rotated = held ? this.drag!.rotated : entry.rotated;
      const size = footprint(entry.item.def, rotated);
      const def = itemAt(entry.item.def);
      if (!size || !def) {
        continue;
      }

      let px: number;
      let py: number;
      if (held && this.drag) {
        // Am Finger, um eine Zellenhoehe angehoben - siehe Kopfkommentar.
        px = this.drag.pointerX - (this.drag.grabX + 0.5) * this.cellSize;
        py = this.drag.pointerY - DRAG_LIFT - (this.drag.grabY + 0.5) * this.cellSize;
      } else {
        px = this.options.x + entry.x * this.cellSize;
        py = this.options.y + entry.y * this.cellSize;
      }

      const w = size.width * this.cellSize - 6;
      const h = size.height * this.cellSize - 6;
      const color = RARITY_COLORS[def.rarity] ?? 0xffffff;
      const g = held ? this.heldLayer : this.contents;

      /*
       * Der gezogene Gegenstand bleibt DECKEND.
       *
       * Halbdurchsichtig war er im ersten Versuch, damit die Zielmarkierung
       * durchscheint. Im Emulator zeigte sich der Preis: Die Beschriftungen
       * der Gegenstaende darunter schlugen durch, und ueber "Verband" stand
       * "Pistole" - zwei Woerter uebereinander liest niemand.
       *
       * Die Rueckmeldung traegt jetzt der kraeftige Rahmen um die Zielflaeche,
       * der rundherum sichtbar bleibt. Dazu ein dunkler Schlagschatten, damit
       * sich das Getragene sichtbar vom Untergrund abhebt.
       */
      if (held) {
        g.fillStyle(0x0d1420, 0.5);
        g.fillRoundedRect(px + 7, py + 8, w, h, 6);
      }

      g.fillStyle(color, 0.94);
      g.fillRoundedRect(px + 3, py + 3, w, h, 6);
      g.lineStyle(held ? 3 : 2, 0x0d1420, 0.95);
      g.strokeRoundedRect(px + 3, py + 3, w, h, 6);

      const label = held ? this.heldLabelObject() : this.labelFor(labelIndex);
      if (!held) {
        labelIndex += 1;
      }
      label.setText(shortLabel(def.name, size.width));
      label.setPosition(px + 3 + w / 2, py + 3 + h / 2);
      label.setVisible(true);
    }

    // Uebrige Beschriftungen aus frueheren Bildern ausblenden.
    for (let i = labelIndex; i < this.labels.length; i += 1) {
      this.labels[i]?.setVisible(false);
    }
    if (heldIndex < 0) {
      this.heldLabel?.setVisible(false);
    }
  }

  /** Die Beschriftung des getragenen Gegenstands, ganz oben. */
  private heldLabelObject(): Phaser.GameObjects.Text {
    if (!this.heldLabel) {
      this.heldLabel = this.scene.add
        .text(0, 0, "", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "12px",
          color: "#11161f",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.hud + 5);
    }
    return this.heldLabel;
  }

  /** Beschriftungen werden gepoolt - Textobjekte sind teuer. */
  private labelFor(index: number): Phaser.GameObjects.Text {
    const existing = this.labels[index];
    if (existing) {
      return existing;
    }
    const label = this.scene.add
      .text(0, 0, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#11161f",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud + 2);
    this.labels.push(label);
    return label;
  }

  /**
   * Der Drehknopf, der nur waehrend des Ziehens sichtbar ist.
   *
   * Er sitzt UNTER dem Gitter und damit ausserhalb des Bereichs, in dem der
   * ziehende Daumen unterwegs ist - sonst loeste ihn genau die Bewegung aus,
   * die man gerade macht.
   */
  private buildRotateButton(): Phaser.GameObjects.Container {
    const width = this.grid.width * this.cellSize;
    const height = this.grid.height * this.cellSize;
    const x = this.options.x + width / 2;
    const y = this.options.y + height + 34;

    const background = this.scene.add
      .rectangle(0, 0, 150, 40, COLORS.player, 0.92)
      .setStrokeStyle(2, COLORS.playerOutline)
      .setInteractive();
    const text = this.scene.add
      .text(0, 0, "DREHEN", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#11161f",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (!this.drag) {
        return;
      }
      this.drag.rotated = !this.drag.rotated;
      // Sobald gedreht wurde, ist es kein Tipp mehr - sonst wuerde beim
      // Loslassen ein zweites Mal gedreht und die Drehung hoebe sich auf.
      this.drag.moved = true;
      this.draw();
    });

    const container = this.scene.add.container(x, y, [background, text]);
    container.setDepth(DEPTH.hud + 6);
    container.setVisible(false);
    return container;
  }
}

/**
 * Kuerzt einen Namen so, dass er in `cells` Zellen passt.
 *
 * Bei 12 Punkt Schrift passen rund 7 Zeichen je Zelle. "Maschinenpistole" auf
 * einer 3x1-Flaeche wird damit zu "Maschinen..." - lesbar genug, um es
 * wiederzuerkennen. Die Seltenheitsfarbe traegt ohnehin den groessten Teil
 * der Information.
 */
function shortLabel(name: string, cells: number): string {
  const maxChars = Math.max(2, cells * 7);
  if (name.length <= maxChars) {
    return name;
  }
  return `${name.slice(0, Math.max(2, maxChars - 1))}.`;
}
