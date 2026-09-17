/**
 * Twin-Stick-Steuerung fuer Touch.
 *
 * Links: ein schwebender Joystick zum Laufen. Er erscheint dort, wo der Daumen
 * die linke Bildschirmhaelfte beruehrt - das ist laut Briefing der Unterschied
 * zwischen "geht" und "fuehlt sich gut an".
 *
 * Rechts: ein Schussknopf an FESTER Stelle. Halten feuert dauerhaft (so schnell,
 * wie Munition und Schusstakt es zulassen), Ziehen zielt mit einer Linie,
 * blosses Antippen ueberlaesst der Simulation die Zielsuche. Fest deshalb, weil
 * ein Schussknopf blind zu finden sein muss - im Gefecht schaut niemand hin.
 *
 * Diese Klasse verteilt die Finger ("Zeiger") auf die drei Bedienelemente. Ohne
 * diese Verteilung wuerde ein zweiter Finger den ersten Joystick uebernehmen.
 */

import Phaser from "phaser";
import { COLORS, DEPTH, TOUCH, VIEWPORT } from "../config/constants";
import type { Vec2 } from "../systems/types";
import { VirtualJoystick } from "./VirtualJoystick";

export interface TouchOutput {
  move: Vec2;
  /** Zielrichtung, solange der Daumen vom Schussknopf weg zieht. */
  aim: Vec2 | null;
  /** Zugstaerke, 0 bis 1 - daraus entsteht die Reichweitenanzeige. */
  aimStrength: number;
  /** Wird gerade gefeuert? Gehaltener Zustand, kein einmaliger Wunsch. */
  fire: boolean;
  /** Einmaliger Wunsch, die Super-Faehigkeit auszuloesen. */
  useSuper: boolean;
}

/**
 * Die Mitten der festen Knoepfe.
 *
 * Bewusst Funktionen statt Konstanten: Die Entwurfsbreite haengt seit
 * `fitViewportToScreen` am Geraet und steht erst fest, wenn das Spiel startet -
 * eine Konstante hier wuerde beim Laden der Datei berechnet und waere dann die
 * alte 960er Breite. Die Knoepfe saessen auf einem breiten Handy mitten im Bild.
 */
function fireCenter(): Vec2 {
  return {
    x: VIEWPORT.width - TOUCH.fireButton.marginX,
    y: VIEWPORT.height - TOUCH.fireButton.marginY,
  };
}

function superCenter(): Vec2 {
  return {
    x: VIEWPORT.width - TOUCH.superButton.marginX,
    y: VIEWPORT.height - TOUCH.superButton.marginY,
  };
}

export class TouchControls {
  private readonly moveStick: VirtualJoystick;
  private readonly fireGraphics: Phaser.GameObjects.Graphics;
  private readonly fireLabel: Phaser.GameObjects.Text;
  private readonly superGraphics: Phaser.GameObjects.Graphics;
  private readonly superLabel: Phaser.GameObjects.Text;
  private readonly fireAt: Vec2 = fireCenter();
  private readonly superAt: Vec2 = superCenter();

  private firePointerId: number | null = null;
  private fireDrag: Vec2 = { x: 0, y: 0 };

  /**
   * Ein gemerkter Schuss, der noch auf einen Simulationsschritt wartet.
   *
   * WARUM: `fire` wird jedes Bild frisch vom Finger abgelesen, aber nicht jedes
   * Bild rechnet einen Tick - bei 60 Bildern und 30 Ticks pro Sekunde ist es
   * nur jedes zweite. Ein kurzes Antippen, das genau zwischen zwei Ticks
   * beginnt und endet, wurde deshalb bisher stillschweigend verschluckt. Genau
   * das fuehlt sich an wie "das Schiessen geht nur ab und zu".
   *
   * Jeder Druck auf den Knopf hinterlegt hier einen Schuss. Er bleibt liegen,
   * bis die Simulation ihn wirklich gesehen hat (`clearOneShots`) - und geht
   * damit nie mehr verloren. Genau einer pro Druck, kein Doppelschuss.
   */
  private pendingShot: { aim: Vec2 | null } | null = null;

  /** Wann und wo der Schussfinger aufgesetzt hat - fuer Antippen gegen Ziehen. */
  private fireDownAt = 0;
  private superPointerId: number | null = null;
  private superLatched = false;
  private superReady = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.moveStick = new VirtualJoystick(scene, COLORS.player);

    this.fireGraphics = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.fireLabel = label(scene, this.fireAt, "FEUER", 15);

    this.superGraphics = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.superLabel = label(scene, this.superAt, "SUPER", 13);

    this.drawFireButton();
    this.drawSuperButton();

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  /** Der Super-Knopf ist ausgegraut, solange die Faehigkeit nicht geladen ist. */
  setSuperReady(ready: boolean): void {
    if (ready !== this.superReady) {
      this.superReady = ready;
      this.drawSuperButton();
    }
  }

  read(): TouchOutput {
    const dragLength = Math.hypot(this.fireDrag.x, this.fireDrag.y);
    const aiming = this.firePointerId !== null && dragLength > TOUCH.fireButton.aimDeadZone;

    // Solange gezogen wird, zaehlt die Zugrichtung. Liegt nur noch ein
    // gemerkter Schuss an (Finger schon weg), zaehlt dessen Richtung.
    const aim = aiming
      ? { x: this.fireDrag.x / dragLength, y: this.fireDrag.y / dragLength }
      : (this.pendingShot?.aim ?? null);

    return {
      move: this.moveStick.vector,
      aim,
      aimStrength: aiming
        ? Math.min(
            1,
            (dragLength - TOUCH.fireButton.aimDeadZone) /
              (TOUCH.fireButton.aimRange - TOUCH.fireButton.aimDeadZone),
          )
        : 0,
      // Gehalten wird dauerhaft gefeuert; ein gemerkter Schuss feuert genau
      // einmal, auch wenn der Finger laengst wieder weg ist.
      fire: this.firePointerId !== null || this.pendingShot !== null,
      useSuper: this.superLatched,
    };
  }

  /** Einmalige Wuensche loeschen, sobald die Simulation sie verarbeitet hat. */
  clearOneShots(): void {
    this.superLatched = false;
    this.pendingShot = null;
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.moveStick.destroy();
    this.fireGraphics.destroy();
    this.fireLabel.destroy();
    this.superGraphics.destroy();
    this.superLabel.destroy();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) {
      return;
    }

    // Reihenfolge zaehlt: Die festen Knoepfe liegen in der rechten Haelfte und
    // muessen zuerst gepruefte werden, sonst schluckt der Zielstick sie.
    if (
      this.superPointerId === null &&
      within(pointer, this.superAt, TOUCH.superButton.hitRadius)
    ) {
      this.superPointerId = pointer.id;
      return;
    }

    if (this.firePointerId === null && within(pointer, this.fireAt, TOUCH.fireButton.hitRadius)) {
      this.firePointerId = pointer.id;
      this.fireDrag = { x: 0, y: 0 };
      this.fireDownAt = this.scene.time.now;
      // Sofort einen Schuss hinterlegen: Damit feuert auch das kuerzeste
      // Antippen, ohne Zielen - die Simulation sucht sich dann den naechsten
      // Gegner. Die Richtung kann beim Loslassen noch nachgereicht werden.
      this.pendingShot = { aim: null };
      this.drawFireButton();
      return;
    }

    if (pointer.x < VIEWPORT.width / 2 && !this.moveStick.isActive) {
      this.moveStick.claim(pointer.id, pointer.x, pointer.y);
    }
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) {
      return;
    }

    if (this.moveStick.ownedPointer === pointer.id) {
      this.moveStick.move(pointer.x, pointer.y);
      return;
    }

    if (this.firePointerId === pointer.id) {
      this.fireDrag = { x: pointer.x - this.fireAt.x, y: pointer.y - this.fireAt.y };
      this.drawFireButton();
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) {
      return;
    }

    if (this.superPointerId === pointer.id) {
      this.superPointerId = null;
      if (this.superReady) {
        this.superLatched = true;
      }
      return;
    }

    if (this.firePointerId === pointer.id) {
      const dragLength = Math.hypot(this.fireDrag.x, this.fireDrag.y);
      const wasDrag = dragLength > TOUCH.fireButton.tapMaxMove;
      const heldMs = this.scene.time.now - this.fireDownAt;

      // Wurde gezogen und wartet der Schuss dieses Drucks noch, bekommt er die
      // gezogene Richtung mit - so feuert auch ein schnelles Wischen dorthin,
      // wohin gezielt wurde, statt auf den naechstbesten Gegner.
      if (wasDrag && this.pendingShot) {
        this.pendingShot.aim = { x: this.fireDrag.x / dragLength, y: this.fireDrag.y / dragLength };
      }
      // Ein langes Halten ohne Ziehen hat bereits dauerhaft gefeuert; ein
      // liegengebliebener Schuss waere dann ein Schuss zu viel.
      if (!wasDrag && heldMs > TOUCH.fireButton.tapMaxMs) {
        this.pendingShot = null;
      }

      this.firePointerId = null;
      this.fireDrag = { x: 0, y: 0 };
      this.drawFireButton();
      return;
    }

    if (this.moveStick.ownedPointer === pointer.id) {
      this.moveStick.release();
    }
  }

  /** Der Knopf leuchtet, solange er gehalten wird, und zeigt die Zugrichtung. */
  private drawFireButton(): void {
    const held = this.firePointerId !== null;
    const graphics = this.fireGraphics;
    const { radius } = TOUCH.fireButton;

    graphics.clear();
    graphics.fillStyle(COLORS.playerBullet, held ? 0.34 : 0.16);
    graphics.fillCircle(this.fireAt.x, this.fireAt.y, radius);
    graphics.lineStyle(4, COLORS.playerBullet, held ? 0.95 : 0.55);
    graphics.strokeCircle(this.fireAt.x, this.fireAt.y, radius);

    if (held) {
      const length = Math.hypot(this.fireDrag.x, this.fireDrag.y);
      if (length > TOUCH.fireButton.aimDeadZone) {
        // Der Daumenpunkt bleibt im Knopf, auch wenn der Finger weiter zieht.
        const clamped = Math.min(length, radius);
        graphics.fillStyle(COLORS.playerOutline, 0.9);
        graphics.fillCircle(
          this.fireAt.x + (this.fireDrag.x / length) * clamped,
          this.fireAt.y + (this.fireDrag.y / length) * clamped,
          16,
        );
      }
    }

    this.fireLabel.setAlpha(held ? 0.35 : 0.9);
  }

  private drawSuperButton(): void {
    const ready = this.superReady;
    const graphics = this.superGraphics;

    graphics.clear();
    graphics.fillStyle(ready ? COLORS.superReady : COLORS.playerDown, ready ? 0.9 : 0.35);
    graphics.fillCircle(this.superAt.x, this.superAt.y, TOUCH.superButton.radius);
    graphics.lineStyle(3, COLORS.playerOutline, ready ? 0.9 : 0.3);
    graphics.strokeCircle(this.superAt.x, this.superAt.y, TOUCH.superButton.radius);

    this.superLabel.setAlpha(ready ? 1 : 0.4);
    this.superLabel.setColor(ready ? "#11161f" : "#dce8f7");
  }
}

function within(pointer: Phaser.Input.Pointer, center: Vec2, radius: number): boolean {
  return Math.hypot(pointer.x - center.x, pointer.y - center.y) <= radius;
}

function label(
  scene: Phaser.Scene,
  center: Vec2,
  text: string,
  size: number,
): Phaser.GameObjects.Text {
  return scene.add
    .text(center.x, center.y, text, {
      fontFamily: "system-ui, sans-serif",
      fontSize: `${size}px`,
      color: "#11161f",
      fontStyle: "bold",
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(DEPTH.hud);
}
