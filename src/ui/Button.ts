/**
 * Ein Knopf aus dem UI-Paket (Kenney "UI Pack RPG") mit Beschriftung.
 *
 * Phaser bringt keine fertigen Bedienelemente mit - das ist Absicht, denn ein
 * Spiel braucht selten Standardknoepfe. Fuer die Menues reicht diese kleine
 * Klasse, und sie haelt die Trefferflaeche grosszuegig genug fuer Daumen.
 *
 * Bis zum UI-Paket war der Knopf ein gezeichnetes Rechteck. Jetzt ist er eine
 * Neunerteilung des Paket-Knopfs (`ui/UiNineSlice.ts`), damit er in jeder
 * Groesse gleich aussieht - von 80 x 30 im HUD bis 300 x 56 in der Lobby.
 * Beim Druecken wechselt er auf die gedrueckte Fassung (ohne Lippe) und die
 * Schrift rutscht mit: Man SIEHT, dass der Daumen getroffen hat.
 *
 * Die Beruehrung faengt ein unsichtbares Rechteck in genau Knopfgroesse ab -
 * so bleibt die Trefferflaeche unabhaengig davon, wie das Bild aussieht.
 */

import Phaser from "phaser";
import { UI } from "../config/ui";
import type { ButtonLook } from "../config/ui";
import { UiNineSlice } from "./UiNineSlice";

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  /**
   * "primary" (hell, Standard) fuer die Handlung, die man als Naechstes tun
   * soll; "secondary" (dunkel) fuer Zurueck, Abbrechen und die kleinen
   * HUD-Knoepfe.
   */
  variant?: keyof typeof UI.button;
}

export class Button {
  private readonly hitArea: Phaser.GameObjects.Rectangle;
  private readonly image: UiNineSlice;
  private readonly label: Phaser.GameObjects.Text;
  private readonly look: ButtonLook;
  private pressed = false;

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
    this.look = UI.button[options.variant ?? "primary"];

    this.image = new UiNineSlice(scene, this.look.frame, this.look.slice, x, y, width, height);

    this.label = scene.add.text(x, y, text, {
      fontFamily: UI.font,
      fontSize: `${options.fontSize ?? 22}px`,
      color: this.look.textColor,
      fontStyle: "bold",
    });
    this.label.setOrigin(0.5);

    // Unsichtbar, aber beruehrbar (Deckkraft 0 blockt die Eingabe nicht).
    this.hitArea = scene.add.rectangle(x, y, width, height, 0x000000, 0);
    this.hitArea.setInteractive({ useHandCursor: true });

    this.hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.setPressed(true));
    this.hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      this.setPressed(false);
      onClick();
    });
    this.hitArea.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => this.setPressed(false));
  }

  /** Gedrueckte Fassung ein/aus - Schrift rutscht mit dem Knopf nach unten. */
  private setPressed(pressed: boolean): void {
    if (pressed === this.pressed) {
      return;
    }
    this.pressed = pressed;
    this.image.setFrame(
      pressed ? this.look.pressed : this.look.frame,
      pressed ? this.look.pressedSlice : this.look.slice,
    );
    this.label.y += pressed ? this.look.pressOffset : -this.look.pressOffset;
  }

  /**
   * Verschiebt den Knopf.
   *
   * Gebraucht, wenn sich die Entwurfsflaeche aendert - dann muessen alle
   * Anzeigen am Bildschirmrand nachruecken, statt an der alten Kante zu kleben.
   */
  setPosition(x: number, y: number): this {
    this.hitArea.setPosition(x, y);
    this.image.setPosition(x, y);
    this.label.setPosition(x, y + (this.pressed ? this.look.pressOffset : 0));
    return this;
  }

  /** Die Flaeche des Knopfs - fuer Anzeigen, die ihm ausweichen muessen. */
  getBounds(): Phaser.Geom.Rectangle {
    return this.hitArea.getBounds();
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
    this.image.setAlpha(enabled ? 1 : 0.45);
    this.label.setAlpha(enabled ? 1 : 0.6);
    if (enabled) {
      this.hitArea.setInteractive({ useHandCursor: true });
    } else {
      this.hitArea.disableInteractive();
      this.setPressed(false);
    }
  }

  setVisible(visible: boolean): void {
    this.image.setVisible(visible);
    this.label.setVisible(visible);
    this.hitArea.setVisible(visible);
  }

  destroy(): void {
    this.image.destroy();
    this.label.destroy();
    this.hitArea.destroy();
  }

  setDepth(depth: number): void {
    this.image.setDepth(depth);
    this.label.setDepth(depth);
    this.hitArea.setDepth(depth);
  }
}
