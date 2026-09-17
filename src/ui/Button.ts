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

  setText(text: string): void {
    this.label.setText(text);
  }

  setVisible(visible: boolean): void {
    this.background.setVisible(visible);
    this.label.setVisible(visible);
  }

  setDepth(depth: number): void {
    this.background.setDepth(depth);
    this.label.setDepth(depth);
  }
}
