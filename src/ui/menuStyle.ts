/**
 * Der gemeinsame Look aller Bildschirme ausserhalb des Gefechts.
 *
 * Bis 2026-09-25 hatten Menue, Lobby und Ergebnis einen flachen,
 * dunkelblauen Hintergrund mit blaugrauer Schrift - aus der Zeit vor dem
 * 3D-Umbau. Im Spiel gibt es inzwischen Sand, Wiese, Holz und die Tafeln
 * aus dem UI-Paket; der Wechsel ins Menue wirkte wie ein anderes Spiel
 * (Rueckmeldung: "passt so gar nicht zum In-Game").
 *
 * Hier steht deshalb EIN Look fuer alle: erdiger Hintergrund mit Waldrand,
 * Holztafeln und beige Einlagen aus dem Paket, warme Schrift. Farben und
 * Grafiknamen kommen aus `config/ui.ts`.
 */

import type Phaser from "phaser";
import { UI } from "../config/ui";
import { UiNineSlice } from "./UiNineSlice";

const BACKGROUND_KEY = "menu-background";
/** Breiter als jede Entwurfsflaeche (max. 1600) - dann reicht EINE Textur. */
const BACKGROUND_WIDTH = 1600;
const BACKGROUND_HEIGHT = 540;

/**
 * Der Hintergrund: Verlauf von dunklem Oliv zu Erdbraun, feine Koernung
 * wie der Boden im Spiel, unten eine Reihe Tannen als Silhouette - der
 * Waldrand, der auch die Gebiete umgibt. Einmal gemalt, dann als Textur
 * wiederverwendet.
 */
export function menuBackground(scene: Phaser.Scene): Phaser.GameObjects.Image {
  if (!scene.textures.exists(BACKGROUND_KEY)) {
    const canvas = document.createElement("canvas");
    canvas.width = BACKGROUND_WIDTH;
    canvas.height = BACKGROUND_HEIGHT;
    const context = canvas.getContext("2d");
    if (context) {
      paintBackground(context);
    }
    scene.textures.addCanvas(BACKGROUND_KEY, canvas);
  }
  return scene.add.image(0, 0, BACKGROUND_KEY).setOrigin(0).setDepth(-100).setScrollFactor(0);
}

function paintBackground(context: CanvasRenderingContext2D): void {
  const gradient = context.createLinearGradient(0, 0, 0, BACKGROUND_HEIGHT);
  gradient.addColorStop(0, "#39402c");
  gradient.addColorStop(0.55, "#2c2a1f");
  gradient.addColorStop(1, "#1f1b14");
  context.fillStyle = gradient;
  context.fillRect(0, 0, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);

  // Koernung - fester Startwert, damit es bei jedem Start gleich aussieht.
  let state = 1234;
  const random = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < 2600; i += 1) {
    context.fillStyle = random() < 0.5 ? "rgba(255,240,200,0.05)" : "rgba(0,0,0,0.12)";
    context.fillRect(Math.floor(random() * BACKGROUND_WIDTH), Math.floor(random() * BACKGROUND_HEIGHT), 2, 2);
  }

  // Zwei Reihen Tannen-Silhouetten, die hintere heller (Dunst).
  const row = (baseY: number, color: string, minHeight: number, spread: number): void => {
    context.fillStyle = color;
    let x = -20;
    while (x < BACKGROUND_WIDTH + 40) {
      const height = minHeight + random() * spread;
      const width = height * (0.42 + random() * 0.12);
      context.beginPath();
      context.moveTo(x, baseY);
      context.lineTo(x + width / 2, baseY - height);
      context.lineTo(x + width, baseY);
      context.closePath();
      context.fill();
      x += width * (0.45 + random() * 0.35);
    }
    context.fillRect(0, baseY, BACKGROUND_WIDTH, BACKGROUND_HEIGHT - baseY);
  };
  row(BACKGROUND_HEIGHT - 26, "#2a3324", 40, 46);
  row(BACKGROUND_HEIGHT - 4, "#1a2016", 28, 34);

  // Weicher Schatten an den Raendern lenkt den Blick in die Mitte.
  const vignette = context.createRadialGradient(
    BACKGROUND_WIDTH / 2,
    BACKGROUND_HEIGHT * 0.45,
    BACKGROUND_HEIGHT * 0.35,
    BACKGROUND_WIDTH / 2,
    BACKGROUND_HEIGHT * 0.45,
    BACKGROUND_WIDTH * 0.62,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
}

/** Eine Holztafel (Mittelpunkt, Groesse). */
export function woodPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number): UiNineSlice {
  return new UiNineSlice(scene, UI.panel.frame, UI.panel.slice, x, y, width, height);
}

/** Eine beige Einlage - fuer Dinge, die man lesen soll (Code, Namen). */
export function insetPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number): UiNineSlice {
  return new UiNineSlice(scene, UI.inset.frame, UI.inset.slice, x, y, width, height);
}

/** Text im Menue-Look, zentriert, mit leichtem Schatten. */
export function menuText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color: string = UI.text.body,
  bold = false,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: UI.font,
      fontSize: `${size}px`,
      color,
      fontStyle: bold ? "bold" : "normal",
      align: "center",
    })
    .setOrigin(0.5)
    .setShadow(1, 2, UI.text.shadow, 3);
}
