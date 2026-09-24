/**
 * Uebersetzt Daumen-Eingaben in den einheitlichen `InputState` der Simulation.
 *
 * Das ist die Schleuse zwischen Phaser und der Spiellogik: Nur hier wird
 * gefragt, wo die Finger sind. Die Simulation bekommt am Ende nur
 * Richtungsvektoren und weiss nicht, woher sie kommen - das ist die
 * Voraussetzung dafuer, dass im Koop auch das Netzwerk diese Rolle uebernimmt.
 *
 * Tastatur und Maus gibt es bewusst nicht: Das Spiel laeuft nur auf
 * Touchgeraeten (siehe `platform/device.ts`), und eine zweite Steuerung, die
 * niemand benutzt, waere Code, der still veraltet.
 */

import Phaser from "phaser";
import type { InputState } from "../systems/types";
import { TouchControls } from "../ui/TouchControls";
import type { TouchStatus } from "../ui/TouchControls";

export class InputManager {
  private readonly touch: TouchControls;

  constructor(scene: Phaser.Scene) {
    this.touch = new TouchControls(scene);
  }

  /**
   * Meldet den Knoepfen, was gerade geht: Munition, Abklingzeit der Faehigkeit,
   * Ladung des Supers. Daraus entstehen Ausgrauung und Abklingringe.
   */
  setStatus(status: TouchStatus): void {
    this.touch.setStatus(status);
  }

  /** Knoepfe neu einmessen, nachdem sich die Entwurfsflaeche geaendert hat. */
  layout(): void {
    this.touch.layout();
  }

  /** Der aktuelle Eingabezustand fuer den naechsten Simulationsschritt. */
  getState(): InputState {
    const output = this.touch.read();
    return {
      move: output.move,
      aim: output.aim,
      fire: output.fire,
      useSuper: output.useSuper,
      useAbility: output.useAbility,
      abilityAim: output.abilityAim,
      // Rucksack-Befehle kommen nicht vom Daumen auf dem Spielfeld, sondern
      // aus dem Rucksack-Fenster der HUD-Szene - die Spielszene setzt sie ein.
      inventory: null,
    };
  }

  /** Zugstaerke beim Ausrichten, 0 bis 1 - fuer die Laenge der Zielanzeige. */
  get aimStrength(): number {
    return this.touch.read().aimStrength;
  }

  /** Welcher Knopf gerade ausgerichtet wird, oder null. */
  get aiming(): "ability" | "super" | null {
    return this.touch.read().aiming;
  }

  /**
   * Einmalige Wuensche loeschen. Die Szene ruft das erst, wenn die Simulation
   * sie verarbeitet hat - sonst ginge ein Schuss verloren, der zwischen zwei
   * Ticks ausgeloest wurde.
   */
  clearOneShots(): void {
    this.touch.clearOneShots();
  }

  destroy(): void {
    this.touch.destroy();
  }
}
