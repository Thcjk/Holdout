/**
 * Die Uebersichtskarte.
 *
 * ================================================================
 * WARUM SIE EIN PANEL IST UND KEIN VOLLBILD-OVERLAY
 * ================================================================
 *
 * Gewuenscht war: "Pausiert NICHT das Spiel beim Oeffnen - man soll sie kurz
 * checken koennen, waehrend man laeuft." Genau das geht mit einem
 * bildschirmfuellenden Overlay NICHT, und der Grund steht schon in
 * `GameScene`: Die Touch-Steuerung hoert auf die ganze Szene. Ein dunkler
 * Hintergrund liegt zwar optisch ueber dem Joystick, faengt seine Beruehrungen
 * aber nicht ab. Deshalb bekommt die Simulation bei offenen Overlays eine
 * LEERE Eingabe - sonst zieht ein Daumen, der auf einen Knopf zielt, nebenbei
 * den Joystick.
 *
 * Ein Overlay, das nicht pausiert, aber die Eingabe schluckt, waere das
 * Schlechteste aus beiden Welten: Die Gegner laufen weiter, und man kann sich
 * nicht wehren.
 *
 * Die Karte sitzt deshalb in der OBEREN Bildschirmhaelfte und laesst die
 * beiden Bedienecken frei - unten links den Joystick, unten rechts den
 * Knopfbogen. `overlayOpen` wird gar nicht erst gesetzt, die Steuerung bleibt
 * unangetastet, und man laeuft beim Kartenlesen einfach weiter.
 *
 * ================================================================
 * SEIT ETAPPE 6: ZWEI ANSICHTEN
 * ================================================================
 *
 * Das Arbeitsdokument verlangt die Karte IMMER sichtbar, rechts oben unter
 * der Punktzahl, rund 120 x 120, und per Antippen eine groessere Ansicht.
 *
 *   klein  rechts oben, 120 x 120, immer da. Antippen oeffnet/schliesst die
 *          grosse. (Der Knopf "Karte" ist damit weggefallen.)
 *   gross  oben links, bis 250 x 250 - dort, wo die Karte vorher als Panel
 *          sass und im Emulator nachweislich nichts verdeckte.
 *
 * Geschlossen wird ueber die KLEINE Karte, nicht durch Antippen der grossen:
 * Die grosse liegt in der linken Bildhaelfte, und dort startet jede
 * Beruehrung den Joystick.
 *
 * ================================================================
 * SIE ZEIGT NUR, WO JEMAND SCHON WAR
 * ================================================================
 *
 * Encounter und Ausstiege tragen ein Feld `discovered`, das die Simulation
 * setzt (siehe `systems/encounters.ts`). Zeigte die Karte von Anfang an alle
 * Punkte, waere die Welt mit dem ersten Blick geloest - man liefe eine Liste
 * ab, statt zu erkunden. Und im Koop gilt das Aufdecken fuer das ganze Team:
 * Wer etwas findet, findet es fuer alle.
 */

import Phaser from "phaser";
import { COLORS, DEPTH, SAFE, VIEWPORT } from "../config/constants";
import type { MinimapModel } from "./HudModel";

/** Kantenlaenge der kleinen Karte (Arbeitsdokument: rund 120 x 120). */
export const SMALL_SIZE = 120;

/**
 * Abstand der grossen Karte zur oberen Kante, zusaetzlich zum Geraeterand.
 *
 * 86: Darueber stehen die Zonenanzeige und die Mitspielerzeile. Bei 70
 * schnitt das Panel sie an - im Emulator stand der Text halb hinter der Karte.
 */
const LARGE_TOP_MARGIN = 86;

/**
 * Wie viel Platz unten fuer die Bedienung frei bleibt.
 *
 * Der Joystick links erscheint irgendwo in der unteren Haelfte - die grosse
 * Karte darf ihn nicht erreichen.
 */
const BOTTOM_KEEPOUT = 110;

/**
 * Groesste Kantenlaenge der grossen Karte.
 *
 * Nicht in der Bildmitte: Dort steht IMMER die eigene Figur. Im ersten
 * Versuch lag die Karte genau darueber - wer waehrend des Lesens angegriffen
 * wird, saehe es nicht.
 */
const LARGE_MAX = 250;

interface MapView {
  frame: Phaser.GameObjects.Graphics;
  marks: Phaser.GameObjects.Graphics;
  left: number;
  top: number;
  size: number;
}

export class Minimap {
  private readonly small: MapView;
  private readonly large: MapView;
  private readonly hint: Phaser.GameObjects.Text;
  /** Unsichtbare Tippflaeche ueber der kleinen Karte. */
  private readonly hitZone: Phaser.GameObjects.Zone;

  private open = false;

  /**
   * @param anchorTop Oberkante der kleinen Karte - die HUD-Szene gibt sie vor,
   *                  weil sie weiss, wo Punktzahl und Knoepfe enden.
   * @param onToggle  Wird nach jedem Antippen mit dem neuen Zustand gerufen.
   */
  constructor(
    scene: Phaser.Scene,
    private anchorTop: number,
    onToggle: (open: boolean) => void,
  ) {
    this.small = this.createView(scene);
    this.large = this.createView(scene);
    this.large.frame.setVisible(false);
    this.large.marks.setVisible(false);

    this.hint = scene.add
      .text(0, 0, "Die Runde laeuft weiter", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#ffffff",
      })
      .setShadow(1, 1, "#00000066", 2)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud + 5)
      .setVisible(false);

    this.hitZone = scene.add
      .zone(0, 0, SMALL_SIZE, SMALL_SIZE)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.hud + 6);
    this.hitZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      onToggle(this.toggle());
    });

    this.layout();
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): boolean {
    this.open = !this.open;
    this.large.frame.setVisible(this.open);
    this.large.marks.setVisible(this.open);
    this.hint.setVisible(this.open);
    return this.open;
  }

  /** Die kleine Karte als Rechteck - fuer die Sperrflaechen des Kompasses. */
  get smallBounds(): { x: number; y: number; width: number; height: number } {
    return { x: this.small.left, y: this.small.top, width: SMALL_SIZE, height: SMALL_SIZE };
  }

  /** Die grosse Karte, wenn offen - sonst `null`. */
  get largeBounds(): { x: number; y: number; width: number; height: number } | null {
    if (!this.open) {
      return null;
    }
    return { x: this.large.left, y: this.large.top, width: this.large.size, height: this.large.size + 20 };
  }

  /**
   * Setzt beide Karten neu.
   *
   * Muss bei jeder Groessenaenderung laufen: Die Entwurfsbreite aendert sich
   * auch waehrend des Spiels, wenn in Safari die Adressleiste ein- oder
   * ausklappt. Wer seine Position nur einmal bekommt, klebt danach an der
   * alten Kante.
   */
  layout(anchorTop: number = this.anchorTop): void {
    this.anchorTop = anchorTop;

    this.small.size = SMALL_SIZE;
    this.small.left = VIEWPORT.width - SAFE.right - 14 - SMALL_SIZE;
    this.small.top = anchorTop;
    this.hitZone.setPosition(this.small.left, this.small.top);

    const availableHeight = VIEWPORT.height - SAFE.top - LARGE_TOP_MARGIN - BOTTOM_KEEPOUT;
    // Quadratisch, weil die Welt quadratisch ist. Eine verzerrte Karte waere
    // schlimmer als eine kleine: Man schaetzt daraus Entfernungen ab.
    this.large.size = Math.max(SMALL_SIZE, Math.min(availableHeight, LARGE_MAX));
    this.large.left = SAFE.left + 14;
    this.large.top = SAFE.top + LARGE_TOP_MARGIN;

    for (const view of [this.small, this.large]) {
      view.frame.clear();
      view.frame.fillStyle(0x0d1420, 0.72);
      view.frame.fillRoundedRect(view.left, view.top, view.size, view.size, 8);
      view.frame.lineStyle(2, COLORS.hudDim, 0.8);
      view.frame.strokeRoundedRect(view.left, view.top, view.size, view.size, 8);
    }

    this.hint.setPosition(this.large.left + this.large.size / 2, this.large.top + this.large.size + 6);
  }

  /** Zeichnet den aktuellen Stand - die kleine immer, die grosse nur offen. */
  update(model: MinimapModel): void {
    this.draw(this.small, model, 0.6);
    if (this.open) {
      this.draw(this.large, model, 1);
    }
  }

  destroy(): void {
    for (const view of [this.small, this.large]) {
      view.frame.destroy();
      view.marks.destroy();
    }
    this.hint.destroy();
    this.hitZone.destroy();
  }

  private createView(scene: Phaser.Scene): MapView {
    return {
      frame: scene.add.graphics().setDepth(DEPTH.hud + 4),
      marks: scene.add.graphics().setDepth(DEPTH.hud + 5),
      left: 0,
      top: 0,
      size: 0,
    };
  }

  /**
   * Eine Karte zeichnen. `detail` verkleinert die Markierungen auf der
   * kleinen Karte - Punkte in voller Groesse wuerden sie zukleistern.
   */
  private draw(view: MapView, model: MinimapModel, detail: number): void {
    const marks = view.marks;
    marks.clear();

    const scale = view.size / Math.max(1, model.worldSize);
    const toScreen = (x: number, y: number): { x: number; y: number } => ({
      x: view.left + x * scale,
      y: view.top + y * scale,
    });
    const r = (radius: number): number => Math.max(1.5, radius * detail);

    // Die sichere Zone um den Start: der eine Ort, den man immer wiederfinden
    // will, weil man dort heilt.
    const start = toScreen(model.startX, model.startY);
    marks.fillStyle(COLORS.mate, 0.16);
    marks.fillCircle(start.x, start.y, Math.max(2, model.safeRadius * scale));

    // Aufgedeckte Ausstiege: gruene Punkte - dasselbe Gruen wie der Teppich am
    // Boden und der Kompasspfeil. Drei Anzeigen derselben Sache in derselben
    // Farbe sind eine Sprache; drei Farben waeren drei Raetsel.
    for (const zone of model.extractions) {
      const point = toScreen(zone.x, zone.y);
      marks.fillStyle(COLORS.mate, 0.95);
      marks.fillCircle(point.x, point.y, r(4));
      marks.lineStyle(1, 0x0d1420, 0.9);
      marks.strokeCircle(point.x, point.y, r(4));
    }

    // Aufgedeckte Encounter: rot wie ihr Ring am Boden. Geschaffte werden
    // blass, statt zu verschwinden.
    for (const spot of model.encounters) {
      const point = toScreen(spot.x, spot.y);
      const radius = r(spot.isFinal ? 6 : 3.5);
      marks.fillStyle(COLORS.danger, spot.cleared ? 0.28 : 0.95);
      marks.fillCircle(point.x, point.y, radius);
      if (spot.isFinal) {
        marks.lineStyle(1.5, COLORS.danger, spot.cleared ? 0.35 : 1);
        marks.strokeCircle(point.x, point.y, radius + 3 * detail);
      }
    }

    // Aufgedeckte Gegner: gelb wie ihr Leuchten in der Welt.
    for (const enemy of model.revealed) {
      const point = toScreen(enemy.x, enemy.y);
      marks.fillStyle(COLORS.marked, 1);
      marks.fillCircle(point.x, point.y, r(2.5));
    }

    // Mitspieler vor der eigenen Figur zeichnen, damit die eigene obenauf
    // liegt - sie ist die, die man sucht.
    for (const mate of model.mates) {
      const point = toScreen(mate.x, mate.y);
      marks.fillStyle(mate.down ? COLORS.hudDim : COLORS.player, 0.9);
      marks.fillCircle(point.x, point.y, r(3));
    }

    const self = toScreen(model.selfX, model.selfY);
    marks.fillStyle(0xffffff, 1);
    marks.fillCircle(self.x, self.y, r(3.5));
    marks.lineStyle(2, COLORS.player, 1);
    marks.strokeCircle(self.x, self.y, r(6));
  }
}
