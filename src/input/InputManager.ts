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
import type { InputState, SkillId } from "../systems/types";
import { TouchControls } from "../ui/TouchControls";

export class InputManager {
  private readonly touch: TouchControls;
  /** Gewuenschte Aufwertung, bis ein Simulationsschritt sie gesehen hat. */
  private pendingLevelUp: SkillId | null = null;

  constructor(scene: Phaser.Scene) {
    this.touch = new TouchControls(scene);
  }

  /** Ist der Super bereit? Faerbt den Knopf ein. */
  setSuperReady(ready: boolean): void {
    this.touch.setSuperReady(ready);
  }

  /** Vom HUD gerufen, wenn ein Skillpunkt verteilt wird. */
  requestLevelUp(skill: SkillId): void {
    this.pendingLevelUp = skill;
  }

  /** Der aktuelle Eingabezustand fuer den naechsten Simulationsschritt. */
  getState(): InputState {
    const output = this.touch.read();
    return {
      move: output.move,
      aim: output.aim,
      fire: output.fire,
      useSuper: output.useSuper,
      levelUp: this.pendingLevelUp,
    };
  }

  /** Zugstaerke des Zielsticks, 0 bis 1 - fuer die Reichweitenanzeige. */
  get aimStrength(): number {
    return this.touch.read().aimStrength;
  }

  /**
   * Einmalige Wuensche loeschen. Die Szene ruft das erst, wenn die Simulation
   * sie verarbeitet hat - sonst ginge ein Schuss verloren, der zwischen zwei
   * Ticks ausgeloest wurde.
   */
  clearOneShots(): void {
    this.pendingLevelUp = null;
    this.touch.clearOneShots();
  }

  destroy(): void {
    this.touch.destroy();
  }
}
