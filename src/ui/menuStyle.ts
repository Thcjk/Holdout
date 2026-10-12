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
  let state = 4321;
  const random = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const W = BACKGROUND_WIDTH;
  const H = BACKGROUND_HEIGHT;

  // Daemmerhimmel
  const sky = context.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#4b7a80");
  sky.addColorStop(0.55, "#5f8c8c");
  sky.addColorStop(1, "#243638");
  context.fillStyle = sky;
  context.fillRect(0, 0, W, H);

  // Heller Schein hinter dem Titel
  const halo = context.createRadialGradient(W / 2, H * 0.28, 10, W / 2, H * 0.28, 330);
  halo.addColorStop(0, "rgba(240,228,200,0.5)");
  halo.addColorStop(1, "rgba(240,228,200,0)");
  context.fillStyle = halo;
  context.fillRect(0, 0, W, H);

  // Berge in Schichten, hinten hell und neblig, vorn dunkel
  const ridge = (base: number, color: string, amp: number, step: number): void => {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, H);
    let x = 0;
    let y = base;
    while (x <= W + step) {
      y = base - random() * amp;
      context.lineTo(x, y);
      x += step * (0.6 + random() * 0.8);
    }
    context.lineTo(W, H);
    context.closePath();
    context.fill();
  };
  ridge(H * 0.62, "#7aa09b", 90, 70);
  // Nebelband
  const mist = context.createLinearGradient(0, H * 0.5, 0, H * 0.72);
  mist.addColorStop(0, "rgba(240,228,200,0)");
  mist.addColorStop(1, "rgba(240,228,200,0.35)");
  context.fillStyle = mist;
  context.fillRect(0, H * 0.5, W, H * 0.22);
  ridge(H * 0.74, "#4f7d7e", 80, 60);

  // Turm auf dem Berg rechts, mit Dornenring
  const tx = W * 0.5 + 360;
  context.fillStyle = "#1f2f31";
  context.beginPath();
  context.moveTo(tx - 46, H * 0.8);
  context.lineTo(tx - 22, H * 0.52);
  context.lineTo(tx - 14, H * 0.52);
  context.lineTo(tx - 8, H * 0.4);
  context.lineTo(tx, H * 0.3);
  context.lineTo(tx + 8, H * 0.4);
  context.lineTo(tx + 14, H * 0.52);
  context.lineTo(tx + 22, H * 0.52);
  context.lineTo(tx + 46, H * 0.8);
  context.closePath();
  context.fill();
  context.strokeStyle = "#1f2f31";
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(tx, H * 0.27, 44, 12, -0.1, 0, Math.PI * 2);
  context.stroke();

  ridge(H * 0.84, "#2f4d50", 70, 50);

  // Voegel
  context.strokeStyle = "rgba(240,228,200,0.8)";
  context.lineWidth = 2;
  for (const [bx, by] of [[W * 0.5 - 330, 90], [W * 0.5 - 290, 70], [W * 0.5 - 360, 60], [W * 0.5 + 240, 110]] as const) {
    context.beginPath();
    context.moveTo(bx - 8, by);
    context.quadraticCurveTo(bx - 3, by - 6, bx, by);
    context.quadraticCurveTo(bx + 3, by - 6, bx + 8, by);
    context.stroke();
  }

  // Dunkle Tannen im Vordergrund
  for (let x = -10; x < W + 20; x += 18 + random() * 22) {
    const h = 50 + random() * 90;
    const w = h * 0.5;
    context.fillStyle = random() < 0.5 ? "#16201f" : "#1d2a2b";
    context.beginPath();
    context.moveTo(x, H - h);
    context.lineTo(x + w * 0.4, H - h * 0.6);
    context.lineTo(x + w * 0.2, H - h * 0.6);
    context.lineTo(x + w * 0.5, H - h * 0.28);
    context.lineTo(x + w * 0.26, H - h * 0.28);
    context.lineTo(x + w * 0.56, H);
    context.lineTo(x - w * 0.56, H);
    context.lineTo(x - w * 0.26, H - h * 0.28);
    context.lineTo(x - w * 0.5, H - h * 0.28);
    context.lineTo(x - w * 0.2, H - h * 0.6);
    context.lineTo(x - w * 0.4, H - h * 0.6);
    context.closePath();
    context.fill();
  }
  context.fillStyle = "#16201f";
  context.fillRect(0, H - 14, W, 14);

  // Papierkorn
  for (let i = 0; i < 9000; i += 1) {
    context.fillStyle = random() < 0.5 ? "rgba(29,28,25,0.07)" : "rgba(255,248,225,0.08)";
    context.fillRect(random() * W, random() * H, 1 + random() * 1.5, 1 + random() * 1.5);
  }

  // Weicher Schatten an den Raendern
  const vignette = context.createRadialGradient(W / 2, H * 0.45, H * 0.4, W / 2, H * 0.45, W * 0.62);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(15,22,23,0.5)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, W, H);
}

/** Eine Tafel (Mittelpunkt, Groesse). */
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
    label.setStroke("#1d1c19", Math.max(3, Math.round(size / 5)));
  }
  return label;
}
