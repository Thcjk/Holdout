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

/**
 * Abstand des Panels zur oberen Kante, zusaetzlich zum Geraeterand.
 *
 * 86 statt 46: Darueber stehen die Zonenanzeige, die Mitspielerzeile und die
 * damalige Hinweiszeile. Bei 70 schnitt das Panel sie an - im Emulator stand
 * der Text halb hinter der Karte. Die Karte wird
 * dadurch nicht kleiner: Ihre Kantenlaenge ist ohnehin auf 250 begrenzt, und
 * darunter bleibt genug Platz.
 */
const TOP_MARGIN = 86;

/**
 * Wie viel Platz unten fuer die Bedienung frei bleibt.
 *
 * Der Knopfbogen unten rechts ist rund 150 Entwurfseinheiten hoch, der
 * Joystick links erscheint irgendwo in der unteren Haelfte. Beides darf die
 * Karte nicht erreichen - sonst tippt man beim Kartenlesen auf FEUER.
 */
const BOTTOM_KEEPOUT = 110;

/**
 * Groesste Kantenlaenge des Kartenfelds.
 *
 * ================================================================
 * WARUM DIE KARTE LINKS SITZT UND NICHT IN DER MITTE
 * ================================================================
 *
 * Im ersten Versuch sass sie mittig und war 320 Einheiten gross. Im Emulator
 * war sofort zu sehen, was daran falsch ist: Die eigene Figur steht IMMER in
 * der Bildmitte - die Karte lag also genau ueber ihr. Damit war der eine
 * Zweck kaputt, den sie haben soll ("kurz checken, waehrend man laeuft"): Wer
 * waehrend des Lesens angegriffen wird, sieht es nicht.
 *
 * Jetzt liegt sie in der linken oberen Ecke. Frei bleiben damit die Bildmitte
 * (die Figur), unten links Leben und Super, unten rechts der Knopfbogen und
 * oben rechts Punktzahl und Knoepfe.
 */
const MAX_SIZE = 250;

export class Minimap {
  private readonly container: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private readonly hint: Phaser.GameObjects.Text;

  /** Bildschirmkoordinaten und Kantenlaenge des quadratischen Kartenfelds. */
  private left = 0;
  private top = 0;
  private size = 0;

  private open = false;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
    this.container.setDepth(DEPTH.hud + 5);
    this.container.setVisible(false);

    this.frame = scene.add.graphics();
    this.marks = scene.add.graphics();
    this.hint = scene.add.text(0, 0, "", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: "#8ea6c4",
    });
    this.hint.setOrigin(0.5, 0);

    this.container.add([this.frame, this.marks, this.hint]);
    this.layout();
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): boolean {
    this.open = !this.open;
    this.container.setVisible(this.open);
    return this.open;
  }

  /**
   * Setzt das Kartenfeld neu.
   *
   * Muss bei jeder Groessenaenderung laufen: Die Entwurfsbreite aendert sich
   * auch waehrend des Spiels, wenn in Safari die Adressleiste ein- oder
   * ausklappt. Wer seine Position nur einmal bekommt, klebt danach an der
   * alten Kante.
   */
  layout(): void {
    const availableHeight = VIEWPORT.height - SAFE.top - TOP_MARGIN - BOTTOM_KEEPOUT;
    // Quadratisch, weil die Welt quadratisch ist. Eine verzerrte Karte waere
    // schlimmer als eine kleine: Man schaetzt daraus Entfernungen ab.
    this.size = Math.max(120, Math.min(availableHeight, MAX_SIZE));
    this.left = SAFE.left + 14;
    this.top = SAFE.top + TOP_MARGIN;

    this.frame.clear();
    this.frame.fillStyle(0x0d1420, 0.82);
    this.frame.fillRoundedRect(this.left, this.top, this.size, this.size, 8);
    this.frame.lineStyle(2, COLORS.hudDim, 0.8);
    this.frame.strokeRoundedRect(this.left, this.top, this.size, this.size, 8);

    this.hint.setPosition(this.left + this.size / 2, this.top + this.size + 6);
    this.hint.setText("Die Runde laeuft weiter");
  }

  /** Zeichnet den aktuellen Stand. Wird jedes Bild gerufen, solange offen. */
  update(model: MinimapModel): void {
    if (!this.open) {
      return;
    }

    this.marks.clear();

    const scale = this.size / Math.max(1, model.worldSize);
    const toScreen = (x: number, y: number): { x: number; y: number } => ({
      x: this.left + x * scale,
      y: this.top + y * scale,
    });

    // Die sichere Zone um den Start: der eine Ort, den man immer wiederfinden
    // will, weil man dort heilt und Punkte verteilt.
    const start = toScreen(model.startX, model.startY);
    this.marks.fillStyle(COLORS.mate, 0.16);
    this.marks.fillCircle(start.x, start.y, Math.max(3, model.safeRadius * scale));

    // Aufgedeckte Ausstiege: gefuellte gruene Punkte - dasselbe Gruen wie der
    // Ring am Boden und der Kompasspfeil. Drei Anzeigen derselben Sache in
    // derselben Farbe sind eine Sprache; drei Farben waeren drei Raetsel.
    for (const zone of model.extractions) {
      const point = toScreen(zone.x, zone.y);
      this.marks.fillStyle(COLORS.mate, 0.95);
      this.marks.fillCircle(point.x, point.y, 4);
      this.marks.lineStyle(1, 0x0d1420, 0.9);
      this.marks.strokeCircle(point.x, point.y, 4);
    }

    // Aufgedeckte Encounter: rot wie ihr Ring am Boden. Geschaffte werden
    // blass, statt zu verschwinden - so sieht man, was man schon erledigt hat,
    // und kann daraus schliessen, wo es sich noch lohnt.
    for (const spot of model.encounters) {
      const point = toScreen(spot.x, spot.y);
      const radius = spot.isFinal ? 6 : 3.5;
      this.marks.fillStyle(COLORS.danger, spot.cleared ? 0.28 : 0.95);
      this.marks.fillCircle(point.x, point.y, radius);
      if (spot.isFinal) {
        // Der Ende-Boss bekommt einen Ring dazu: Er ist nicht "noch ein
        // Mini-Boss", sondern das Ende des Runs.
        this.marks.lineStyle(1.5, COLORS.danger, spot.cleared ? 0.35 : 1);
        this.marks.strokeCircle(point.x, point.y, radius + 3);
      }
    }

    // Mitspieler vor der eigenen Figur zeichnen, damit die eigene obenauf
    // liegt - sie ist die, die man sucht.
    for (const mate of model.mates) {
      const point = toScreen(mate.x, mate.y);
      this.marks.fillStyle(mate.down ? COLORS.hudDim : COLORS.player, 0.9);
      this.marks.fillCircle(point.x, point.y, 3);
    }

    const self = toScreen(model.selfX, model.selfY);
    this.marks.fillStyle(0xffffff, 1);
    this.marks.fillCircle(self.x, self.y, 3.5);
    this.marks.lineStyle(2, COLORS.player, 1);
    this.marks.strokeCircle(self.x, self.y, 6);
  }

  destroy(): void {
    this.container.destroy();
  }
}
