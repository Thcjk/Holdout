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
 * 2. GETIPPT WIRD GEDREHT, GEZOGEN WIRD VERSCHOBEN - AUSSER BEI WAFFEN.
 *    Seit der Waffen-Ausruestung heisst ein Tipp auf eine Waffe "ausruesten"
 *    (wo das Gitter es erlaubt: `equipOnTap`). Gedreht wird eine Waffe dann
 *    mit dem DREHEN-Knopf, der waehrend des Haltens erscheint. Ausruesten ist
 *    die haeufigere Handlung - sie bekommt den einfachsten Griff.
 *
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
import { ATTACHMENT_KINDS, RARITY_COLORS, itemAt } from "../config/items";
import type { AttachmentKind } from "../config/items";
import { attachInGrid, canAttach, detachInGrid, hasMod, weaponSlots } from "../systems/gear";
import {
  fits,
  footprint,
  itemIndexAt,
  move,
  place,
  removeAt,
} from "../systems/InventoryGridSystem";
import type { InventoryGrid as GridData, ItemInstance } from "../systems/types";
import { equipAt, isWeapon } from "../systems/weapons";
import { UI } from "../config/ui";
import { UiNineSlice } from "./UiNineSlice";

/**
 * Ab dieser Zugstrecke gilt eine Beruehrung als Ziehen und nicht als Tipp.
 *
 * 14 Einheiten sind rund ein Fuenftel einer Zelle - klein genug, dass ein
 * gewolltes Verschieben sofort greift, gross genug, dass das unvermeidliche
 * Wackeln beim Antippen nicht schon als Zug zaehlt.
 */
const TAP_THRESHOLD = 14;

/** Abstand des Paket-Rahmens um das Gitter (= Randbreite des Panels). */
const FRAME_MARGIN = 10;

/** Wie weit der gezogene Gegenstand ueber dem Finger schwebt. */
const DRAG_LIFT = INVENTORY.cellSize;

/** Farbe und Buchstabe je Aufsatzart - auf der Waffe und im Guertel gleich. */
const MOD_COLORS: Record<AttachmentKind, number> = {
  scope: 0x7fd1ff,
  barrel: 0xff9f5a,
  mag: 0xffd166,
  grip: 0x9be07a,
};
const MOD_LETTERS: Record<AttachmentKind, string> = { scope: "V", barrel: "L", mag: "M", grip: "G" };

export interface InventoryGridOptions {
  /** Linke obere Ecke in Entwurfseinheiten. */
  x: number;
  y: number;
  cellSize?: number;
  /** Wird gerufen, sobald sich am Inhalt etwas geaendert hat. */
  onChange?: () => void;
  /**
   * Wo der Drehknopf sitzt. Ohne Angabe mittig unter dem Gitter. Im
   * Packbildschirm liegen zwei Gitter nebeneinander, dort sitzt er dazwischen
   * - unter dem Gitter kaeme er dem Knopf "Run starten" ins Gehege.
   */
  rotateButtonAt?: { x: number; y: number };
  /** Breite des Drehknopfs (Standard 150). Zwischen zwei Gittern ist es eng. */
  rotateButtonWidth?: number;
  /**
   * Nach jedem erfolgreichen Verschieben oder Drehen: woher, wohin. Im Run
   * wird daraus ein Befehl an die Simulation (Etappe 9) - das Gitter hier ist
   * dort nur eine Vorschau, der Rucksack gehoert der Simulation.
   */
  onMoved?: (from: { x: number; y: number }, to: { x: number; y: number; rotated: boolean }) => void;
  /**
   * Wird ein Gegenstand AUS dem Gitter gezogen (und nicht in ein zweites),
   * gilt das als Wegwerfen - aber nur, wenn es diesen Haken gibt. Ohne ihn
   * springt er zurueck wie bisher.
   */
  onDiscard?: (from: { x: number; y: number }) => void;
  /**
   * Tipp auf eine Waffe ruestet sie aus, statt sie zu drehen. Nur im
   * Rucksack - im Lager gibt es nichts auszuruesten.
   */
  equipOnTap?: boolean;
  /** Nach einem Ausruesten per Tipp: welche Zelle. Im Run ein Befehl. */
  onEquipped?: (at: { x: number; y: number }) => void;
  /** Aufsatz auf eine Waffe gezogen (beide Zellen). Im Run ein Befehl. */
  onAttached?: (from: { x: number; y: number }, to: { x: number; y: number }) => void;
  /** Aufsatz per Tipp auf sein Symbol abgenommen. Im Run ein Befehl. */
  onDetached?: (at: { x: number; y: number }, kindIndex: number) => void;
  /**
   * Ein Gegenstand wird ausserhalb dieses Gitters losgelassen (und nicht im
   * verbundenen zweiten). Gibt `true` zurueck, wenn er dort angenommen wurde
   * - etwa vom Guertel. Dann verschwindet er hier; sonst geht es weiter wie
   * bisher (wegwerfen oder zurueckspringen).
   */
  dropOutside?: (item: ItemInstance, from: { x: number; y: number }, screenX: number, screenY: number) => boolean;
  /** Waehrend des Ziehens: wo der Griffpunkt gerade ist (fuer Zielmarken aussen). */
  onDragHover?: (item: ItemInstance | null, screenX: number, screenY: number) => void;
  /**
   * Unterste Zeichenebene. Im Run liegt das Gitter in einem Fenster UEBER
   * einem abdunkelnden Hintergrund - mit der festen HUD-Ebene lag es darunter,
   * war dunkel und nahm keine Beruehrung an (im Emulator gesehen).
   */
  depth?: number;
}

/** Was ein anderes Gitter gerade ueber diesem schweben laesst. */
interface ForeignHover {
  def: number;
  rotated: boolean;
  x: number;
  y: number;
  valid: boolean;
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
  /** Rahmen aus dem UI-Paket (Neunerteilung), hinter den Zellen. */
  private readonly frame: UiNineSlice;
  private readonly cells: Phaser.GameObjects.Graphics;
  private readonly contents: Phaser.GameObjects.Graphics;
  /** Nur der gerade gezogene Gegenstand - ueber allen Beschriftungen. */
  private readonly heldLayer: Phaser.GameObjects.Graphics;
  private heldLabel: Phaser.GameObjects.Text | null = null;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  /** Buchstaben auf den Aufsatzplaetzen der Waffen (gepoolt wie `labels`). */
  private readonly modLetters: Phaser.GameObjects.Text[] = [];
  /** Waffe, auf die der gezogene Aufsatz gerade passen wuerde (Index), oder -1. */
  private attachHover = -1;
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private readonly rotateHint: Phaser.GameObjects.Container;

  private readonly cellSize: number;
  private readonly baseDepth: number;
  private drag: DragState | null = null;

  /**
   * Das zweite Gitter, in das man hinueberziehen kann (Lager <-> Rucksack).
   *
   * Seit Etappe 9: Der Packbildschirm hat links das Lager, rechts den
   * Rucksack. Jedes Gitter bleibt Herr ueber seinen Inhalt - ein Gegenstand
   * wechselt nur, wenn das ZIEL ihn per `acceptForeign` annimmt. Erst dann
   * nimmt ihn die Quelle heraus. So kann nichts verlorengehen und nichts
   * doppelt auftauchen.
   */
  private peer: InventoryGrid | null = null;
  private foreign: ForeignHover | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private grid: GridData,
    private readonly options: InventoryGridOptions,
  ) {
    this.cellSize = options.cellSize ?? INVENTORY.cellSize;
    this.baseDepth = options.depth ?? DEPTH.hud;

    /*
     * Der Rahmen kommt aus dem UI-Paket (`UI.panel`), 10 Einheiten um das
     * Gitter herum - genau die Randbreite des Paket-Panels, damit die Zellen
     * innerhalb des Rahmens beginnen und nicht auf seinen Zierkerben liegen.
     * Gleiche Ebene wie die Zellen, aber vorher angelegt: liegt also darunter.
     */
    const frameWidth = grid.width * this.cellSize + 2 * FRAME_MARGIN;
    const frameHeight = grid.height * this.cellSize + 2 * FRAME_MARGIN;
    this.frame = new UiNineSlice(
      scene,
      UI.panel.frame,
      UI.panel.slice,
      options.x - FRAME_MARGIN + frameWidth / 2,
      options.y - FRAME_MARGIN + frameHeight / 2,
      frameWidth,
      frameHeight,
    ).setDepth(this.baseDepth);
    this.cells = scene.add.graphics().setDepth(this.baseDepth);
    this.contents = scene.add.graphics().setDepth(this.baseDepth + 1);
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
    this.heldLayer = scene.add.graphics().setDepth(this.baseDepth + 4);

    const width = grid.width * this.cellSize;
    const height = grid.height * this.cellSize;
    this.hitArea = scene.add
      .rectangle(options.x, options.y, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(this.baseDepth + 2)
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

  /** Verbindet zwei Gitter, damit man zwischen ihnen ziehen kann. */
  link(other: InventoryGrid): void {
    this.peer = other;
    other.peer = this;
  }

  /** Der aktuelle Inhalt. */
  get data(): GridData {
    return this.grid;
  }

  /** Liegt dieser Bildschirmpunkt ueber dem Gitter? */
  contains(screenX: number, screenY: number): boolean {
    return this.cellAt(screenX, screenY) !== null;
  }

  /** Zeigt, wohin ein Gegenstand aus dem anderen Gitter fallen wuerde. */
  showForeign(
    def: number,
    rotated: boolean,
    grabX: number,
    grabY: number,
    screenX: number,
    screenY: number,
  ): void {
    const cell = this.cellAt(screenX, screenY, true);
    const hit = cell ? this.grid.items[itemIndexAt(this.grid, cell.x, cell.y)] : undefined;
    const attaches = hit !== undefined && canAttach(hit.item, def);
    this.foreign = cell
      ? {
          def,
          rotated,
          x: cell.x - grabX,
          y: cell.y - grabY,
          valid: attaches || fits(this.grid, def, rotated, cell.x - grabX, cell.y - grabY),
        }
      : null;
    this.draw();
  }

  clearForeign(): void {
    if (this.foreign) {
      this.foreign = null;
      this.draw();
    }
  }

  /** Nimmt einen Gegenstand aus dem anderen Gitter an - wenn er passt. */
  acceptForeign(
    item: ItemInstance,
    rotated: boolean,
    grabX: number,
    grabY: number,
    screenX: number,
    screenY: number,
  ): boolean {
    this.foreign = null;
    const cell = this.cellAt(screenX, screenY, true);
    // Aufsatz aus dem anderen Gitter direkt auf eine Waffe hier (Lager -> Waffe im Rucksack).
    const hit = cell ? this.grid.items[itemIndexAt(this.grid, cell.x, cell.y)] : undefined;
    if (hit && itemAt(item.def)?.type === "attachment" && canAttach(hit.item, item.def)) {
      const kind = itemAt(item.def)?.attachment as AttachmentKind;
      hit.item.mods = (hit.item.mods ?? 0) | (1 << ATTACHMENT_KINDS.indexOf(kind));
      this.options.onChange?.();
      this.draw();
      return true;
    }
    const ok = cell !== null && place(this.grid, item, cell.x - grabX, cell.y - grabY, rotated);
    if (ok) {
      this.options.onChange?.();
    }
    this.draw();
    return ok;
  }

  /** Wird gerade ein Gegenstand gehalten? Dann nicht von aussen umbauen. */
  get busy(): boolean {
    return this.drag !== null;
  }

  /** Blendet das ganze Gitter ein oder aus (samt Beruehrungsfeld). */
  setVisible(visible: boolean): void {
    this.frame.setVisible(visible);
    this.cells.setVisible(visible);
    this.contents.setVisible(visible);
    this.heldLayer.setVisible(visible);
    this.hitArea.setVisible(visible);
    if (visible) {
      this.hitArea.setInteractive();
    } else {
      this.hitArea.disableInteractive();
      this.drag = null;
      this.rotateHint.setVisible(false);
    }
    for (const label of this.labels) {
      label.setVisible(visible && label.visible);
    }
    for (const letter of this.modLetters) {
      letter.setVisible(visible && letter.visible);
    }
    this.heldLabel?.setVisible(false);
    if (visible) {
      this.draw();
    }
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
    this.frame.destroy();
    this.cells.destroy();
    this.contents.destroy();
    this.heldLayer.destroy();
    this.heldLabel?.destroy();
    this.hitArea.destroy();
    this.rotateHint.destroy();
    for (const label of this.labels) {
      label.destroy();
    }
    for (const letter of this.modLetters) {
      letter.destroy();
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

    // Ein Aufsatz ueber einer passenden Waffe? Die leuchtet dann gruen auf.
    this.attachHover = this.drag.moved ? this.attachTargetIndex(this.drag) : -1;
    if (this.drag.moved) {
      const dragged = this.grid.items[this.drag.index];
      this.options.onDragHover?.(dragged?.item ?? null, pointer.x, pointer.y - DRAG_LIFT);
    }

    // Ueber dem anderen Gitter? Dann zeigt DAS die Zielmarkierung.
    if (this.drag.moved && this.peer) {
      const liftedY = pointer.y - DRAG_LIFT;
      const entry = this.grid.items[this.drag.index];
      if (entry && this.overPeer(pointer.x, liftedY)) {
        this.peer.showForeign(
          entry.item.def,
          this.drag.rotated,
          this.drag.grabX,
          this.drag.grabY,
          pointer.x,
          liftedY,
        );
      } else {
        this.peer.clearForeign();
      }
    }

    this.draw();
  }

  /** Zeigt der angehobene Griffpunkt auf das ANDERE Gitter? */
  private overPeer(screenX: number, liftedY: number): boolean {
    return (
      this.peer !== null &&
      this.peer.contains(screenX, liftedY) &&
      !this.contains(screenX, liftedY)
    );
  }

  private onUp(): void {
    const drag = this.drag;
    if (!drag) {
      return;
    }

    this.drag = null;
    this.rotateHint.setVisible(false);
    this.attachHover = -1;
    this.options.onDragHover?.(null, 0, 0);

    if (!drag.moved) {
      const entry = this.grid.items[drag.index];
      // Tipp auf ein belegtes Aufsatzsymbol: abnehmen.
      const kindIndex = entry ? this.modIconAt(entry, drag.startX, drag.startY) : -1;
      if (entry && kindIndex >= 0) {
        if (detachInGrid(this.grid, { x: entry.x, y: entry.y }, kindIndex)) {
          this.options.onDetached?.({ x: entry.x, y: entry.y }, kindIndex);
          this.options.onChange?.();
        }
        this.draw();
        return;
      }
      if (this.options.equipOnTap && entry && isWeapon(entry.item.def)) {
        // Ein Tipp auf eine Waffe: ausruesten (siehe Kopfkommentar, Punkt 2).
        if (equipAt(this.grid, entry.x, entry.y)) {
          this.options.onEquipped?.({ x: entry.x, y: entry.y });
          this.options.onChange?.();
        }
        this.draw();
        return;
      }
      // Ein Tipp: an Ort und Stelle drehen, wenn es so passt.
      this.rotateInPlace(drag.index);
      this.draw();
      return;
    }

    // Aufsatz auf eine Waffe fallen lassen: aufsetzen.
    const weaponIndex = this.attachTargetIndex(drag);
    if (weaponIndex >= 0) {
      const attachment = this.grid.items[drag.index];
      const weapon = this.grid.items[weaponIndex];
      if (attachment && weapon) {
        const from = { x: attachment.x, y: attachment.y };
        const to = { x: weapon.x, y: weapon.y };
        if (attachInGrid(this.grid, from, to)) {
          this.options.onAttached?.(from, to);
          this.options.onChange?.();
        }
      }
      this.draw();
      return;
    }

    // Ins andere Gitter hinueber: Erst wenn das Ziel ihn annimmt, nimmt die
    // Quelle ihn heraus.
    const liftedY = drag.pointerY - DRAG_LIFT;
    if (this.peer && this.overPeer(drag.pointerX, liftedY)) {
      const entry = this.grid.items[drag.index];
      if (
        entry &&
        this.peer.acceptForeign(
          entry.item,
          drag.rotated,
          drag.grabX,
          drag.grabY,
          drag.pointerX,
          liftedY,
        )
      ) {
        removeAt(this.grid, drag.index);
        this.options.onChange?.();
      }
      this.draw();
      return;
    }
    this.peer?.clearForeign();

    // Ausserhalb losgelassen - vielleicht nimmt ihn jemand an (Guertel).
    if (this.options.dropOutside && !this.contains(drag.pointerX, liftedY)) {
      const entry = this.grid.items[drag.index];
      if (entry && this.options.dropOutside(entry.item, { x: entry.x, y: entry.y }, drag.pointerX, liftedY)) {
        removeAt(this.grid, drag.index);
        this.options.onChange?.();
        this.draw();
        return;
      }
    }

    // Aus dem Gitter hinaus: wegwerfen, wenn das hier erlaubt ist.
    if (this.options.onDiscard && !this.contains(drag.pointerX, liftedY)) {
      const entry = this.grid.items[drag.index];
      if (entry) {
        const from = { x: entry.x, y: entry.y };
        removeAt(this.grid, drag.index);
        this.options.onDiscard(from);
        this.options.onChange?.();
      }
      this.draw();
      return;
    }

    const target = this.targetCell(drag);
    if (target) {
      const entry = this.grid.items[drag.index];
      const from = entry ? { x: entry.x, y: entry.y } : null;
      if (
        entry &&
        from &&
        move(this.grid, drag.index, target.x, target.y, drag.rotated)
      ) {
        this.options.onMoved?.(from, { x: target.x, y: target.y, rotated: drag.rotated });
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
    const rotated = !entry.rotated;
    if (move(this.grid, index, entry.x, entry.y, rotated)) {
      this.options.onMoved?.({ x: entry.x, y: entry.y }, { x: entry.x, y: entry.y, rotated });
      this.options.onChange?.();
    }
  }

  /**
   * Liegt der angehobene Griffpunkt eines gezogenen Aufsatzes ueber einer
   * Waffe, die ihn nehmen kann? Dann deren Index, sonst -1.
   */
  private attachTargetIndex(drag: DragState): number {
    const dragged = this.grid.items[drag.index];
    if (!dragged || itemAt(dragged.item.def)?.type !== "attachment") {
      return -1;
    }
    const cell = this.cellAt(drag.pointerX, drag.pointerY - DRAG_LIFT);
    if (!cell) {
      return -1;
    }
    const index = itemIndexAt(this.grid, cell.x, cell.y);
    const target = this.grid.items[index];
    return target && index !== drag.index && canAttach(target.item, dragged.item.def) ? index : -1;
  }

  /**
   * Die Aufsatzplaetze einer liegenden Waffe als Rechtecke: unten links im
   * Gegenstand, nebeneinander. Dieselbe Rechnung fuer Zeichnen und Antippen.
   */
  private modIcons(
    entry: { item: ItemInstance; x: number; y: number; rotated: boolean },
    px: number,
    py: number,
    h: number,
  ): Array<{ kind: AttachmentKind; x: number; y: number; size: number }> {
    const size = Math.max(14, Math.min(20, Math.round(this.cellSize * 0.3)));
    return weaponSlots(entry.item.def).map((kind, index) => ({
      kind,
      x: px + 7 + index * (size + 3),
      y: py + 3 + h - size - 4,
      size,
    }));
  }

  /** Nummer der Aufsatzart unter dem Finger (nur belegte Plaetze), sonst -1. */
  private modIconAt(
    entry: { item: ItemInstance; x: number; y: number; rotated: boolean },
    screenX: number,
    screenY: number,
  ): number {
    const size = footprint(entry.item.def, entry.rotated);
    if (!size) return -1;
    const px = this.options.x + entry.x * this.cellSize;
    const py = this.options.y + entry.y * this.cellSize;
    const h = size.height * this.cellSize - 6;
    // Etwas grosszuegiger als gezeichnet: Die Symbole sind klein, der Daumen nicht.
    const slack = 6;
    for (const icon of this.modIcons(entry, px, py, h)) {
      if (
        hasMod(entry.item, icon.kind) &&
        screenX >= icon.x - slack &&
        screenX <= icon.x + icon.size + slack &&
        screenY >= icon.y - slack &&
        screenY <= icon.y + icon.size + slack
      ) {
        return ATTACHMENT_KINDS.indexOf(icon.kind);
      }
    }
    return -1;
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

    // Der Rahmen ist das Paket-Panel (`this.frame`); hier nur die Zellen,
    // vertieft in einem dunkleren Ton desselben Holzes.
    for (let y = 0; y < this.grid.height; y += 1) {
      for (let x = 0; x < this.grid.width; x += 1) {
        g.fillStyle(UI.panel.cellColor, UI.panel.cellAlpha);
        g.fillRect(
          left + x * this.cellSize + 2,
          top + y * this.cellSize + 2,
          this.cellSize - 4,
          this.cellSize - 4,
        );
      }
    }

    if (this.foreign) {
      this.drawTarget(this.foreign.def, this.foreign.rotated, this.foreign.x, this.foreign.y, this.foreign.valid);
    }

    if (!this.drag || !this.drag.moved) {
      return;
    }
    if (this.overPeer(this.drag.pointerX, this.drag.pointerY - DRAG_LIFT)) {
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

    const valid = fits(
      this.grid,
      entry.item.def,
      this.drag.rotated,
      target.x,
      target.y,
      this.drag.index,
    );
    this.drawTarget(entry.item.def, this.drag.rotated, target.x, target.y, valid);
  }

  /** Die gruene oder rote Zielflaeche - genau die Zellen, die belegt wuerden. */
  private drawTarget(def: number, rotated: boolean, x: number, y: number, valid: boolean): void {
    const g = this.cells;
    const size = footprint(def, rotated);
    if (!size) {
      return;
    }
    const { x: left, y: top } = this.options;

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
    const px = left + x * this.cellSize;
    const py = top + y * this.cellSize;
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
    let letterIndex = 0;

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

      // Starter-Set: goldene Ecke oben links. Geschuetzt, geht nie verloren -
      // das soll man sehen, bevor man entscheidet, was mitkommt.
      if (entry.item.starter) {
        g.fillStyle(COLORS.superReady, 1);
        g.fillTriangle(px + 5, py + 5, px + 21, py + 5, px + 5, py + 21);
      }

      // Ausgeruestete Waffe: heller Rahmen plus Haekchen oben rechts. Beides,
      // weil ein Rahmen allein auf der hellen Seltenheitsfarbe untergeht.
      if (entry.item.equipped) {
        g.lineStyle(3, 0xffffff, 1);
        g.strokeRoundedRect(px + 1, py + 1, w + 4, h + 4, 7);
        const cx = px + w - 9;
        const cy = py + 13;
        g.fillStyle(0x11161f, 0.95);
        g.fillCircle(cx, cy, 9);
        g.lineStyle(3, COLORS.mate, 1);
        g.beginPath();
        g.moveTo(cx - 5, cy);
        g.lineTo(cx - 1, cy + 4);
        g.lineTo(cx + 5, cy - 4);
        g.strokePath();
      }

      // Waffe, auf die der gezogene Aufsatz passt: gruener Rahmen.
      if (i === this.attachHover) {
        g.lineStyle(4, COLORS.mate, 1);
        g.strokeRoundedRect(px, py, w + 6, h + 6, 8);
      }

      // Aufsatzplaetze: belegte farbig mit Buchstabe, freie durchsichtig -
      // man sieht schon am Rucksack, was auf die Waffe passt.
      if (!held) {
        for (const icon of this.modIcons(entry, px, py, h)) {
          const filled = hasMod(entry.item, icon.kind);
          g.fillStyle(MOD_COLORS[icon.kind], filled ? 1 : 0.18);
          g.fillRoundedRect(icon.x, icon.y, icon.size, icon.size, 4);
          g.lineStyle(filled ? 2 : 1.5, filled ? 0x0d1420 : 0xffffff, filled ? 0.9 : 0.7);
          g.strokeRoundedRect(icon.x, icon.y, icon.size, icon.size, 4);
          const letter = this.modLetterFor(letterIndex);
          letterIndex += 1;
          letter.setText(MOD_LETTERS[icon.kind]);
          letter.setAlpha(filled ? 1 : 0.55);
          letter.setColor(filled ? "#11161f" : "#ffffff");
          letter.setPosition(icon.x + icon.size / 2, icon.y + icon.size / 2 + 0.5);
          letter.setVisible(true);
        }
      }

      const label = held ? this.heldLabelObject() : this.labelFor(labelIndex);
      if (!held) {
        labelIndex += 1;
      }
      label.setText(shortLabel(def.name, size.width));
      // Einzelne Zellen: kleinere Schrift. "Verband" lief bei 12 Punkt ueber
      // den Rand einer 62er Zelle - im Emulator gesehen.
      label.setFontSize(size.width === 1 ? 10 : 12);
      // Passt es trotzdem nicht (kleinere Zellen, wenn der Bildschirm wenig
      // Hoehe hat), wird die Beschriftung gestaucht statt abgeschnitten.
      label.setScale(1);
      if (label.width > w - 4) {
        label.setScale((w - 4) / label.width);
      }
      // Einreihige Waffen: Name nach oben, unten sitzen die Aufsatzplaetze.
      const lift = !held && size.height === 1 && weaponSlots(entry.item.def).length > 0 ? 9 : 0;
      label.setPosition(px + 3 + w / 2, py + 3 + h / 2 - lift);
      label.setVisible(true);
    }

    // Uebrige Beschriftungen aus frueheren Bildern ausblenden.
    for (let i = labelIndex; i < this.labels.length; i += 1) {
      this.labels[i]?.setVisible(false);
    }
    for (let i = letterIndex; i < this.modLetters.length; i += 1) {
      this.modLetters[i]?.setVisible(false);
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
        .setDepth(this.baseDepth + 5);
    }
    return this.heldLabel;
  }

  /** Buchstabe auf einem Aufsatzplatz (gepoolt). */
  private modLetterFor(index: number): Phaser.GameObjects.Text {
    const existing = this.modLetters[index];
    if (existing) {
      return existing;
    }
    const letter = this.scene.add
      .text(0, 0, "", { fontFamily: UI.font, fontSize: "11px", color: "#11161f", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(this.baseDepth + 3);
    this.modLetters.push(letter);
    return letter;
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
      .setDepth(this.baseDepth + 2);
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
    const x = this.options.rotateButtonAt?.x ?? this.options.x + width / 2;
    const y = this.options.rotateButtonAt?.y ?? this.options.y + height + 34;
    const buttonWidth = this.options.rotateButtonWidth ?? 150;

    // Bild aus dem UI-Paket wie jeder andere Hauptknopf (`ui/Button.ts`),
    // darueber eine unsichtbare Flaeche, die die Beruehrung abfaengt.
    const look = UI.button.primary;
    const image = new UiNineSlice(this.scene, look.frame, look.slice, 0, 0, buttonWidth, 48);
    const background = this.scene.add
      .rectangle(0, 0, buttonWidth, 48, 0x000000, 0)
      .setInteractive();
    const text = this.scene.add
      .text(0, 0, "DREHEN", {
        fontFamily: UI.font,
        fontSize: buttonWidth < 100 ? "13px" : "16px",
        color: look.textColor,
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

    const container = this.scene.add.container(x, y, [image.container, background, text]);
    container.setDepth(this.baseDepth + 6);
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
