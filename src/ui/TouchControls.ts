/**
 * Twin-Stick-Steuerung fuer Touch, mit Faehigkeiten-Knoepfen im Bogen.
 *
 * Links: ein schwebender Joystick zum Laufen. Er erscheint dort, wo der Daumen
 * die linke Bildschirmhaelfte beruehrt.
 *
 * Rechts: drei feste Knoepfe auf einem Bogen, wie in Wild Rift.
 *
 *   FEUER       innen in der Ecke, der groesste. Antippen feuert SOFORT auf den
 *               naechsten Gegner in Reichweite - ohne jedes Zielen. Halten
 *               feuert weiter, so schnell wie Munition und Schusstakt es
 *               zulassen. Hier wird bewusst NICHT mehr von Hand gezielt: Genau
 *               das war die Ursache fuer "Zielen ist unpraezise".
 *   FAEHIGKEIT  links davon. Halten zeigt den Zielhinweis, Ziehen richtet aus,
 *               Loslassen loest aus. Kurzes Antippen ohne Ziehen loest in
 *               Blickrichtung aus.
 *   SUPER       darueber, groesser als die Faehigkeit. Gleiches Prinzip.
 *
 * Alle drei zeigen einen Abklingring und sind ausgegraut, solange sie nicht
 * einsatzbereit sind.
 *
 * Diese Klasse verteilt die Finger ("Zeiger") auf die Bedienelemente. Ohne
 * diese Verteilung wuerde ein zweiter Finger den ersten Joystick uebernehmen.
 */

import Phaser from "phaser";
import { COLORS, DEPTH, SAFE, TOUCH, VIEWPORT } from "../config/constants";
import type { Vec2 } from "../systems/types";
import { VirtualJoystick } from "./VirtualJoystick";

export interface TouchOutput {
  move: Vec2;
  /**
   * Zielrichtung, solange an Faehigkeit oder Super gezogen wird.
   *
   * Der Schussknopf setzt das NICHT mehr - er zielt automatisch. Solange man
   * eine Faehigkeit ausrichtet, schaut die Figur aber dorthin, und gleichzeitig
   * abgegebene Schuesse folgen derselben Richtung.
   */
  aim: Vec2 | null;
  /** Zugstaerke, 0 bis 1 - daraus entsteht die Laenge der Zielanzeige. */
  aimStrength: number;
  /** Wird gerade gefeuert? Gehaltener Zustand, kein einmaliger Wunsch. */
  fire: boolean;
  /** Einmaliger Wunsch, die Super-Faehigkeit auszuloesen. */
  useSuper: boolean;
  /** Einmaliger Wunsch, die zweite Faehigkeit auszuloesen. */
  useAbility: boolean;
  /** Richtung dafuer, oder null fuer "in Blickrichtung". */
  abilityAim: Vec2 | null;
  /** Welcher Knopf gerade ausgerichtet wird - fuer die Anzeige in der Welt. */
  aiming: "ability" | "super" | null;
}

/** Was die Knoepfe ueber den Spielzustand wissen muessen. */
export interface TouchStatus {
  /** Volle Munitionsladungen und wie viele es insgesamt sind. */
  ammo: number;
  ammoMax: number;
  /** Restliche Abklingzeit der Faehigkeit in Sekunden, und die volle Dauer. */
  abilityCooldown: number;
  abilityCooldownMax: number;
  /** Aufladung des Supers, 0 bis 100. */
  superCharge: number;
  /** Kurzname der Faehigkeit fuer die Beschriftung des Knopfs. */
  abilityLabel: string;
  /**
   * Beschriftung des FEUER-Knopfs: die ausgeruestete Waffe ("PISTOLE") oder
   * "FAUST". So sieht man im Gefecht, womit man gerade angreift - und dass
   * eine weggeworfene Waffe wirklich weg ist.
   */
  attackLabel: string;
}

/**
 * Mitten der drei Knoepfe.
 *
 * Bewusst Funktionen statt Konstanten: Entwurfsbreite und Sicherheitsabstaende
 * stehen erst fest, wenn das Spiel startet. Eine Konstante hier waere beim
 * Laden der Datei berechnet - die Knoepfe saessen dann mitten im Bild.
 */
function centerFor(margin: { marginX: number; marginY: number }): Vec2 {
  return {
    x: VIEWPORT.width - SAFE.right - margin.marginX,
    y: VIEWPORT.height - SAFE.bottom - margin.marginY,
  };
}

/** Ein gehaltener Knopf, der beim Loslassen in eine Richtung ausloest. */
interface AimedButton {
  center: Vec2;
  spec: { radius: number; hitRadius: number };
  pointerId: number | null;
  drag: Vec2;
  downAt: number;
  /** Ausgeloest und noch nicht von der Simulation gesehen. */
  latched: boolean;
  /** Richtung des ausgeloesten Einsatzes, null = Blickrichtung. */
  latchedAim: Vec2 | null;
  ready: boolean;
  /** 0 bis 1 - wie voll der Abklingring ist. */
  progress: number;
  graphics: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

export class TouchControls {
  private readonly moveStick: VirtualJoystick;

  private readonly fireCenter: Vec2 = centerFor(TOUCH.fireButton);
  private readonly fireGraphics: Phaser.GameObjects.Graphics;
  private readonly fireLabel: Phaser.GameObjects.Text;
  private firePointerId: number | null = null;
  /** Siehe `pendingShot` unten - ein gemerkter Schuss geht nie verloren. */
  private pendingShot = false;
  private ammo = 0;
  private ammoMax = 1;

  private readonly ability: AimedButton;
  private readonly superButton: AimedButton;

  constructor(private readonly scene: Phaser.Scene) {
    this.moveStick = new VirtualJoystick(scene, COLORS.player);

    this.fireGraphics = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    this.fireLabel = label(scene, this.fireCenter, "FEUER", 15);

    this.ability = this.makeButton(scene, TOUCH.abilityButton, "");
    this.superButton = this.makeButton(scene, TOUCH.superButton, "SUPER");

    this.drawFireButton();
    this.drawAimedButton(this.ability, COLORS.playerBullet);
    this.drawAimedButton(this.superButton, COLORS.superReady);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }

  private makeButton(
    scene: Phaser.Scene,
    spec: { marginX: number; marginY: number; radius: number; hitRadius: number },
    text: string,
  ): AimedButton {
    const center = centerFor(spec);
    return {
      center,
      spec,
      pointerId: null,
      drag: { x: 0, y: 0 },
      downAt: 0,
      latched: false,
      latchedAim: null,
      ready: false,
      progress: 1,
      graphics: scene.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud),
      label: label(scene, center, text, 12),
    };
  }

  /**
   * Setzt alle Knoepfe neu, nachdem sich die Entwurfsflaeche geaendert hat.
   *
   * Noetig, weil die Mitten aus `VIEWPORT.width` und `SAFE` berechnet werden -
   * beides kann sich aendern, wenn auf dem Handy die Adressleiste ein- oder
   * ausklappt und das Fenster damit ein anderes Seitenverhaeltnis bekommt.
   * Ohne dieses Nachsetzen saessen die Knoepfe danach neben ihrem Bild.
   */
  layout(): void {
    const fire = centerFor(TOUCH.fireButton);
    this.fireCenter.x = fire.x;
    this.fireCenter.y = fire.y;
    this.fireLabel.setPosition(fire.x, fire.y);

    for (const [button, spec] of [
      [this.ability, TOUCH.abilityButton],
      [this.superButton, TOUCH.superButton],
    ] as [AimedButton, { marginX: number; marginY: number }][]) {
      const center = centerFor(spec);
      button.center.x = center.x;
      button.center.y = center.y;
      button.label.setPosition(center.x, center.y);
    }

    this.drawFireButton();
    this.drawAimedButton(this.ability, COLORS.playerBullet);
    this.drawAimedButton(this.superButton, COLORS.superReady);
  }

  /** Aktualisiert Bereitschaft und Abklingringe aus dem Spielzustand. */
  setStatus(status: TouchStatus): void {
    // Der Knopf traegt den Namen der Faehigkeit, nicht das Wort "Faehigkeit".
    // Im Gefecht zaehlt, WAS passiert, nicht in welche Kategorie es faellt.
    if (this.ability.label.text !== status.abilityLabel) {
      this.ability.label.setText(status.abilityLabel);
    }
    if (status.attackLabel && this.fireLabel.text !== status.attackLabel) {
      this.fireLabel.setText(status.attackLabel);
    }

    const ammoChanged = status.ammo !== this.ammo;
    this.ammo = status.ammo;
    this.ammoMax = Math.max(1, status.ammoMax);
    if (ammoChanged) {
      this.drawFireButton();
    }

    const abilityReady = status.abilityCooldown <= 0;
    const abilityProgress =
      status.abilityCooldownMax > 0
        ? 1 - status.abilityCooldown / status.abilityCooldownMax
        : 1;
    if (abilityReady !== this.ability.ready || Math.abs(abilityProgress - this.ability.progress) > 0.02) {
      this.ability.ready = abilityReady;
      this.ability.progress = abilityProgress;
      this.drawAimedButton(this.ability, COLORS.playerBullet);
    }

    const superReady = status.superCharge >= 100;
    const superProgress = Math.min(1, status.superCharge / 100);
    if (superReady !== this.superButton.ready || Math.abs(superProgress - this.superButton.progress) > 0.02) {
      this.superButton.ready = superReady;
      this.superButton.progress = superProgress;
      this.drawAimedButton(this.superButton, COLORS.superReady);
    }
  }

  read(): TouchOutput {
    const aimingButton = this.activeAimButton();
    const aim = aimingButton ? this.dragDirection(aimingButton) : null;

    return {
      move: this.moveStick.vector,
      aim,
      aimStrength: aimingButton ? this.dragStrength(aimingButton) : 0,
      // Gehalten wird dauerhaft gefeuert; ein gemerkter Schuss feuert genau
      // einmal, auch wenn der Finger laengst wieder weg ist.
      fire: this.firePointerId !== null || this.pendingShot,
      useSuper: this.superButton.latched,
      useAbility: this.ability.latched,
      abilityAim: this.ability.latchedAim,
      aiming: aimingButton === this.ability ? "ability" : aimingButton ? "super" : null,
    };
  }

  /** Einmalige Wuensche loeschen, sobald die Simulation sie verarbeitet hat. */
  clearOneShots(): void {
    this.pendingShot = false;
    this.superButton.latched = false;
    this.ability.latched = false;
    this.ability.latchedAim = null;
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.moveStick.destroy();
    this.fireGraphics.destroy();
    this.fireLabel.destroy();
    for (const button of [this.ability, this.superButton]) {
      button.graphics.destroy();
      button.label.destroy();
    }
  }

  private activeAimButton(): AimedButton | null {
    if (this.ability.pointerId !== null) {
      return this.ability;
    }
    if (this.superButton.pointerId !== null) {
      return this.superButton;
    }
    return null;
  }

  private dragDirection(button: AimedButton): Vec2 | null {
    const length = Math.hypot(button.drag.x, button.drag.y);
    if (length <= TOUCH.aim.deadZone) {
      return null;
    }
    return { x: button.drag.x / length, y: button.drag.y / length };
  }

  private dragStrength(button: AimedButton): number {
    const length = Math.hypot(button.drag.x, button.drag.y);
    if (length <= TOUCH.aim.deadZone) {
      return 0;
    }
    const span = Math.max(1, button.spec.hitRadius * 1.6 - TOUCH.aim.deadZone);
    return Math.min(1, (length - TOUCH.aim.deadZone) / span);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) {
      return;
    }

    // Reihenfolge zaehlt: Die festen Knoepfe liegen in der rechten Haelfte und
    // muessen zuerst geprueft werden, sonst schluckt der Joystick sie. Die
    // kleineren zuerst, damit der grosse FEUER-Knopf sie nicht ueberdeckt.
    for (const button of [this.ability, this.superButton]) {
      if (button.pointerId === null && within(pointer, button.center, button.spec.hitRadius)) {
        button.pointerId = pointer.id;
        button.drag = { x: 0, y: 0 };
        button.downAt = this.scene.time.now;
        this.drawAimedButton(button, button === this.ability ? COLORS.playerBullet : COLORS.superReady);
        return;
      }
    }

    if (
      this.firePointerId === null &&
      within(pointer, this.fireCenter, TOUCH.fireButton.hitRadius)
    ) {
      this.firePointerId = pointer.id;
      /*
       * Sofort einen Schuss hinterlegen.
       *
       * `fire` wird jedes Bild frisch vom Finger abgelesen, aber nicht jedes
       * Bild rechnet einen Tick - bei 60 Bildern und 30 Ticks je Sekunde nur
       * jedes zweite. Ein kurzes Antippen, das genau dazwischen beginnt und
       * endet, ginge sonst verloren. Der gemerkte Schuss bleibt liegen, bis die
       * Simulation ihn gesehen hat.
       */
      this.pendingShot = true;
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

    for (const button of [this.ability, this.superButton]) {
      if (button.pointerId === pointer.id) {
        button.drag = { x: pointer.x - button.center.x, y: pointer.y - button.center.y };
        this.drawAimedButton(
          button,
          button === this.ability ? COLORS.playerBullet : COLORS.superReady,
        );
        return;
      }
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!pointer.wasTouch) {
      return;
    }

    for (const button of [this.ability, this.superButton]) {
      if (button.pointerId !== pointer.id) {
        continue;
      }

      const moved = Math.hypot(button.drag.x, button.drag.y);
      const wasTap = moved <= TOUCH.aim.tapMaxMove;
      // Ausloesen nur, wenn die Faehigkeit ueberhaupt bereit ist - sonst waere
      // der Wunsch beim Loslassen weg, obwohl nichts passiert ist.
      if (button.ready) {
        button.latched = true;
        if (button === this.ability) {
          // Antippen ohne Ziehen: Richtung offen lassen, die Simulation nimmt
          // dann die Blickrichtung der Figur.
          this.ability.latchedAim = wasTap ? null : this.dragDirection(button);
        }
      }

      button.pointerId = null;
      button.drag = { x: 0, y: 0 };
      this.drawAimedButton(button, button === this.ability ? COLORS.playerBullet : COLORS.superReady);
      return;
    }

    if (this.firePointerId === pointer.id) {
      this.firePointerId = null;
      this.drawFireButton();
      return;
    }

    if (this.moveStick.ownedPointer === pointer.id) {
      this.moveStick.release();
    }
  }

  /** Der Schussknopf leuchtet beim Halten und zeigt die Munition als Ring. */
  private drawFireButton(): void {
    const held = this.firePointerId !== null;
    const ready = this.ammo > 0;
    const graphics = this.fireGraphics;
    const { radius } = TOUCH.fireButton;

    graphics.clear();
    graphics.fillStyle(COLORS.playerBullet, ready ? (held ? 0.34 : 0.16) : 0.08);
    graphics.fillCircle(this.fireCenter.x, this.fireCenter.y, radius);
    graphics.lineStyle(4, COLORS.playerBullet, ready ? (held ? 0.95 : 0.55) : 0.2);
    graphics.strokeCircle(this.fireCenter.x, this.fireCenter.y, radius);

    // Munition als Ringstuecke - so sieht man blind, ob noch etwas da ist.
    drawSegmentedRing(graphics, this.fireCenter, radius + 9, this.ammo, this.ammoMax, COLORS.playerBullet);

    this.fireLabel.setAlpha(ready ? (held ? 0.35 : 0.9) : 0.3);
  }

  /**
   * Faehigkeit und Super: Fuellung, Abklingring, Zugpunkt.
   *
   * Der Abklingring ist ein Kreisbogen, der sich fuellt - nicht ein Balken.
   * Rund passt zum runden Knopf und ist mit einem Blick zu erfassen.
   */
  private drawAimedButton(button: AimedButton, color: number): void {
    const held = button.pointerId !== null;
    const graphics = button.graphics;
    const { radius } = button.spec;

    graphics.clear();
    graphics.fillStyle(button.ready ? color : COLORS.playerDown, button.ready ? (held ? 0.5 : 0.28) : 0.22);
    graphics.fillCircle(button.center.x, button.center.y, radius);
    graphics.lineStyle(3, button.ready ? color : COLORS.playerOutline, button.ready ? 0.95 : 0.3);
    graphics.strokeCircle(button.center.x, button.center.y, radius);

    if (!button.ready && button.progress < 1) {
      // Abklingring: faengt oben an und laeuft im Uhrzeigersinn zu.
      graphics.lineStyle(5, color, 0.75);
      graphics.beginPath();
      graphics.arc(
        button.center.x,
        button.center.y,
        radius + 7,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * button.progress,
        false,
      );
      graphics.strokePath();
    }

    if (held) {
      const length = Math.hypot(button.drag.x, button.drag.y);
      if (length > TOUCH.aim.deadZone) {
        const clamped = Math.min(length, radius);
        graphics.fillStyle(COLORS.playerOutline, 0.9);
        graphics.fillCircle(
          button.center.x + (button.drag.x / length) * clamped,
          button.center.y + (button.drag.y / length) * clamped,
          14,
        );
      }
    }

    button.label.setAlpha(button.ready ? (held ? 0.4 : 1) : 0.45);
    button.label.setColor(button.ready ? "#11161f" : "#dce8f7");
  }
}

/** Ein Ring aus `total` Stuecken, von denen `filled` leuchten. */
function drawSegmentedRing(
  graphics: Phaser.GameObjects.Graphics,
  center: Vec2,
  radius: number,
  filled: number,
  total: number,
  color: number,
): void {
  const gap = 0.16;
  const span = (Math.PI * 2) / total;
  for (let i = 0; i < total; i += 1) {
    const start = -Math.PI / 2 + i * span + gap / 2;
    const end = start + span - gap;
    graphics.lineStyle(5, color, i < filled ? 0.9 : 0.16);
    graphics.beginPath();
    graphics.arc(center.x, center.y, radius, start, end, false);
    graphics.strokePath();
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
