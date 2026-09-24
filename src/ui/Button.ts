/**
 * Ein einfacher Knopf aus einem Rechteck und einem Text.
 *
 * Phaser bringt keine fertigen Bedienelemente mit - das ist Absicht, denn ein
 * Spiel braucht selten Standardknoepfe. Fuer die Menues reicht diese kleine
 * Klasse, und sie haelt die Trefferflaeche grosszuegig genug fuer Daumen.
 */

import Phaser from "phaser";
import { COLORS } from "../config/constants";

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  color?: number;
}

export class Button {
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly baseColor: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    options: ButtonOptions = {},
  ) {
    const width = options.width ?? 240;
    const height = options.height ?? 56;
    this.baseColor = options.color ?? COLORS.player;

    this.background = scene.add.rectangle(x, y, width, height, this.baseColor, 0.92);
    this.background.setStrokeStyle(3, COLORS.playerOutline);
    this.background.setInteractive({ useHandCursor: true });

    this.label = scene.add.text(x, y, text, {
      fontFamily: "system-ui, sans-serif",
      fontSize: `${options.fontSize ?? 22}px`,
      color: "#11161f",
      fontStyle: "bold",
    });
    this.label.setOrigin(0.5);

    this.background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onClick);
    this.background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () =>
      this.background.setFillStyle(COLORS.playerOutline, 1),
    );
    this.background.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () =>
      this.background.setFillStyle(this.baseColor, 0.92),
    );
  }

  /**
   * Verschiebt den Knopf.
   *
   * Gebraucht, wenn sich die Entwurfsflaeche aendert - dann muessen alle
   * Anzeigen am Bildschirmrand nachruecken, statt an der alten Kante zu kleben.
   */
  setPosition(x: number, y: number): this {
    this.background.setPosition(x, y);
    this.label.setPosition(x, y);
    return this;
  }

  /** Die Flaeche des Knopfs - fuer Anzeigen, die ihm ausweichen muessen. */
  getBounds(): Phaser.Geom.Rectangle {
    return this.background.getBounds();
  }

  setText(text: string): void {
    this.label.setText(text);
  }

  /**
   * Schaltet den Knopf scharf oder stellt ihn ab.
   *
   * Abgestellt heisst: blass UND nicht mehr anklickbar. Beides zusammen, denn
   * nur blass waere eine Luege (man kann ihn ja doch druecken), und nur
   * unklickbar sieht nach einem kaputten Knopf aus.
   */
  setEnabled(enabled: boolean): void {
    this.background.setAlpha(enabled ? 1 : 0.45);
    this.label.setAlpha(enabled ? 1 : 0.6);
    if (enabled) {
      this.background.setInteractive({ useHandCursor: true });
    } else {
      this.background.disableInteractive();
    }
  }

  setVisible(visible: boolean): void {
    this.background.setVisible(visible);
    this.label.setVisible(visible);
  }

  destroy(): void {
    this.background.destroy();
    this.label.destroy();
  }

  setDepth(depth: number): void {
    this.background.setDepth(depth);
    this.label.setDepth(depth);
  }
}
