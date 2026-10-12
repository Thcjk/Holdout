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
import { BOX, ComicBox } from "./ComicBox";

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
  gradient.addColorStop(0, "#222838");
  gradient.addColorStop(1, "#0a0910");
  context.fillStyle = gradient;
  context.fillRect(0, 0, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);

  // Strahlen wie auf einem Heftchen-Titelbild: hell und dunkel im Wechsel.
  const cx = BACKGROUND_WIDTH / 2;
  const cy = BACKGROUND_HEIGHT * 0.4;
  const rays = 28;
  context.fillStyle = "rgba(233,228,212,0.04)";
  for (let i = 0; i < rays; i += 2) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = ((i + 1) / rays) * Math.PI * 2;
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(cx + Math.cos(a0) * 2400, cy + Math.sin(a0) * 2400);
    context.lineTo(cx + Math.cos(a1) * 2400, cy + Math.sin(a1) * 2400);
    context.closePath();
    context.fill();
  }

  // Rote Rasterpunkte, zum unteren Rand hin groesser.
  context.fillStyle = "rgba(196,38,46,0.14)";
  for (let y = 10; y < BACKGROUND_HEIGHT; y += 18) {
    for (let x = 10 + (Math.floor(y / 18) % 2) * 9; x < BACKGROUND_WIDTH; x += 18) {
      const radius = (y / BACKGROUND_HEIGHT) * 4.2;
      if (radius > 0.6) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  // Zwei Reihen zerstoerter Haeuser als Silhouette, einzelne Fenster leuchten.
  let state = 1234;
  const random = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const row = (baseY: number, color: string, minHeight: number, spread: number, windows: boolean): void => {
    let x = -20;
    while (x < BACKGROUND_WIDTH + 40) {
      const height = minHeight + random() * spread;
      const width = 34 + random() * 46;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(x, baseY);
      context.lineTo(x, baseY - height);
      // abgebrochene, schraege Dachkante
      context.lineTo(x + width * (0.4 + random() * 0.3), baseY - height - random() * 16);
      context.lineTo(x + width, baseY - height + random() * 10);
      context.lineTo(x + width, baseY);
      context.closePath();
      context.fill();
      if (windows) {
        for (let wy = baseY - height + 12; wy < baseY - 12; wy += 16) {
          for (let wx = x + 6; wx < x + width - 8; wx += 12) {
            if (random() < 0.12) {
              context.fillStyle = "rgba(232,163,23,0.7)";
              context.fillRect(wx, wy, 5, 7);
            }
          }
        }
      }
      x += width + random() * 6;
    }
    context.fillStyle = color;
    context.fillRect(0, baseY, BACKGROUND_WIDTH, BACKGROUND_HEIGHT - baseY);
  };
  row(BACKGROUND_HEIGHT - 26, "#161a26", 60, 70, true);
  row(BACKGROUND_HEIGHT - 4, "#07060b", 30, 40, false);

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
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
}

/** Eine Comic-Tafel (Mittelpunkt, Groesse). */
export function woodPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number): ComicBox {
  return new ComicBox(scene, BOX.panel, x, y, width, height);
}

/** Eine beige Einlage - fuer Dinge, die man lesen soll (Code, Namen). */
export function insetPanel(scene: Phaser.Scene, x: number, y: number, width: number, height: number): ComicBox {
  return new ComicBox(scene, BOX.inset, x, y, width, height);
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
  const onLight = color === UI.text.dark;
  const label = scene.add
    .text(x, y, text, {
      fontFamily: UI.font,
      fontSize: `${size}px`,
      color,
      fontStyle: bold ? "bold" : "normal",
      align: "center",
    })
    .setOrigin(0.5);
  if (!onLight) {
    // Helle Schrift bekommt den dicken Comic-Rand; dunkle Schrift steht auf hellen Einlagen.
    label.setStroke("#0a0910", Math.max(3, Math.round(size / 5)));
  }
  return label;
}
