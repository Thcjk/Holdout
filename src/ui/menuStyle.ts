/**
 * Der gemeinsame Look aller Bildschirme ausserhalb des Gefechts.
 *
 * Ein Plakat auf Creme-Papier: Berge in Schichten, ein dunkler Berg mit Burg
 * und Dornenring, ein Turm, Voegel, Tannen im Vordergrund. Darauf liegen
 * Papierblaetter mit Tuscherand und Text in Handschrift.
 */

import type Phaser from "phaser";
import { VIEWPORT } from "../config/constants";
import { UI } from "../config/ui";
import { BOX, ComicBox } from "./ComicBox";
import { grain, inkLine, seeded } from "./paper";

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
  // Mittig: Die Plakat-Motive sitzen um die Mitte der Textur, egal wie breit der Bildschirm ist.
  return scene.add.image(VIEWPORT.width / 2, 0, BACKGROUND_KEY).setOrigin(0.5, 0).setDepth(-100).setScrollFactor(0);
}

function paintBackground(context: CanvasRenderingContext2D): void {
  const random = seeded(4321);
  const W = BACKGROUND_WIDTH;
  const H = BACKGROUND_HEIGHT;
  const cx = W / 2;

  // Papier
  context.fillStyle = "#f1e5c9";
  context.fillRect(0, 0, W, H);

  // Blasse Sonne hinter allem
  context.fillStyle = "rgba(248,238,212,0.9)";
  context.beginPath();
  context.arc(cx + 250, 150, 120, 0, Math.PI * 2);
  context.fill();

  // Berge in Schichten - hinten blass, vorn kraeftiger (Luftperspektive)
  const ridge = (base: number, color: string, amp: number, step: number, ink: boolean): void => {
    context.beginPath();
    context.moveTo(0, H);
    let x = 0;
    while (x <= W + step) {
      context.lineTo(x, base - random() * amp);
      x += step * (0.6 + random() * 0.8);
    }
    context.lineTo(W, H);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    if (ink) {
      context.lineWidth = 1.6;
      context.strokeStyle = "rgba(29,28,25,0.45)";
      context.stroke();
    }
  };
  ridge(H * 0.6, "#d9d6bd", 110, 90, false);
  ridge(H * 0.7, "#b8c4b0", 80, 70, true);
  // Nebelband
  const mist = context.createLinearGradient(0, H * 0.62, 0, H * 0.8);
  mist.addColorStop(0, "rgba(241,229,201,0)");
  mist.addColorStop(1, "rgba(241,229,201,0.8)");
  context.fillStyle = mist;
  context.fillRect(0, H * 0.62, W, H * 0.18);

  // Der grosse dunkle Berg rechts mit Burg und Dornenring - wie auf dem Plakat
  const mx = cx + 330;
  context.beginPath();
  context.moveTo(mx - 260, H);
  context.lineTo(mx - 150, H * 0.62);
  context.lineTo(mx - 90, H * 0.45);
  context.lineTo(mx - 50, H * 0.3);
  context.lineTo(mx - 26, H * 0.22);
  context.lineTo(mx + 30, H * 0.24);
  context.lineTo(mx + 70, H * 0.36);
  context.lineTo(mx + 140, H * 0.55);
  context.lineTo(mx + 260, H * 0.75);
  context.lineTo(mx + 320, H);
  context.closePath();
  context.fillStyle = "#4a5652";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#1d1c19";
  context.stroke();
  context.save();
  context.clip();
  context.fillStyle = "#3a4542";
  context.beginPath();
  context.moveTo(mx + 4, H * 0.22);
  context.lineTo(mx + 330, H);
  context.lineTo(mx + 30, H);
  context.lineTo(mx - 20, H * 0.5);
  context.closePath();
  context.fill();
  // Pfade und Fenster im Berg
  for (let i = 0; i < 18; i += 1) {
    const x = mx - 120 + random() * 220;
    const y = H * 0.35 + random() * H * 0.4;
    inkLine(context, [[x, y], [x + 10 + random() * 16, y + 4]], 1.2, random, "rgba(241,229,201,0.25)");
  }
  context.restore();
  // Burg auf dem Gipfel
  context.fillStyle = "#2f3836";
  context.strokeStyle = "#1d1c19";
  context.lineWidth = 1.6;
  for (const [tx, tw, th] of [[mx - 22, 10, 44], [mx - 6, 14, 64], [mx + 12, 9, 38]] as const) {
    context.beginPath();
    context.rect(tx, H * 0.22 - th, tw, th + 4);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(tx - 2, H * 0.22 - th);
    context.lineTo(tx + tw / 2, H * 0.22 - th - 12);
    context.lineTo(tx + tw + 2, H * 0.22 - th);
    context.closePath();
    context.fill();
    context.stroke();
  }
  // Dornenring ueber der Burg
  context.beginPath();
  for (let i = 0; i <= 60; i += 1) {
    const a = (i / 60) * Math.PI * 2;
    const k = i % 2 === 0 ? 1.08 : 1;
    const x = mx + Math.cos(a) * 70 * k;
    const y = H * 0.12 + Math.sin(a) * 16 * k;
    if (i === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.lineWidth = 2.2;
  context.strokeStyle = "#1d1c19";
  context.stroke();

  // Voegel
  for (const [bx, by] of [[cx + 470, 110], [cx + 500, 96], [cx + 440, 90], [cx + 560, 130]] as const) {
    inkLine(context, [[bx - 7, by], [bx - 2, by - 4], [bx, by], [bx + 2, by - 4], [bx + 7, by]], 1.6, random);
  }

  // Wald im Vordergrund: Tannen in zwei dunklen Gruentoenen, Tusche-Rand
  for (const [base, color, minH, spread] of [[H - 8, "#4d6c50", 60, 70], [H + 6, "#2f4a3c", 50, 60]] as const) {
    for (let x = -10; x < W + 20; x += 16 + random() * 24) {
      const h = minH + random() * spread;
      const w = h * 0.42;
      context.beginPath();
      context.moveTo(x, base - h);
      context.lineTo(x + w * 0.5, base - h * 0.62);
      context.lineTo(x + w * 0.3, base - h * 0.62);
      context.lineTo(x + w * 0.8, base - h * 0.28);
      context.lineTo(x + w * 0.45, base - h * 0.28);
      context.lineTo(x + w, base);
      context.lineTo(x - w, base);
      context.lineTo(x - w * 0.45, base - h * 0.28);
      context.lineTo(x - w * 0.8, base - h * 0.28);
      context.lineTo(x - w * 0.3, base - h * 0.62);
      context.lineTo(x - w * 0.5, base - h * 0.62);
      context.closePath();
      context.fillStyle = color;
      context.fill();
      context.lineWidth = 1.4;
      context.strokeStyle = "#1d1c19";
      context.stroke();
    }
  }

  // Papierkorn und gealterte Raender
  grain(context, W, H, 0.3, random);
  const age = context.createRadialGradient(cx, H * 0.45, H * 0.45, cx, H * 0.45, W * 0.6);
  age.addColorStop(0, "rgba(120,90,50,0)");
  age.addColorStop(1, "rgba(120,90,50,0.25)");
  context.fillStyle = age;
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
  const label = scene.add
    .text(x, y, text, {
      fontFamily: UI.font,
      fontSize: `${size}px`,
      color,
      fontStyle: bold ? "bold" : "normal",
      align: "center",
    })
    .setOrigin(0.5);
  return label;
}
