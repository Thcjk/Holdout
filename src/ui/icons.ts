/**
 * Symbole, die beim Start gezeichnet werden, weil das Grafikpaket sie nicht hat.
 *
 * Gegenstaende bekommen ein Papier-Medaillon mit einer Tusche-Zeichnung, die
 * zeigt, was er vor allem tut: Schwert = Schaden, Schild = Ruestung, Herz =
 * Leben, Blitz = Tempo, Kleeblatt = Glueck ... So erkennt man im Shop ohne zu lesen,
 * was man vor sich hat.
 */

import type Phaser from "phaser";
import { itemIconKey } from "../config/assets";
import { ITEMS } from "../game/data/items";
import type { StatKey } from "../game/types";

const ICON_SIZE = 64;

/** Farbe des Medaillons nach dem wichtigsten Wert - gedaempft wie die Plakatfarben. */
const STAT_COLORS: Record<StatKey, string> = {
  damage: "#b5532f",
  melee: "#9c4426",
  ranged: "#c98a2e",
  attackSpeed: "#d8a23a",
  crit: "#d8a23a",
  range: "#4f8a8e",
  maxHp: "#b5532f",
  regen: "#7f9a5a",
  lifesteal: "#8f2f2f",
  armor: "#7f8f8c",
  dodge: "#6f9fa0",
  speed: "#4f8a8e",
  luck: "#6e8f3a",
  harvesting: "#c98a2e",
};

const INK = "#1d1c19";
const CREAM = "#f1e5c9";

type Ctx = CanvasRenderingContext2D;

function inked(context: Ctx, fill: string, width = 2.6): void {
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = width;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = INK;
  context.stroke();
}

/** Ein Tusche-Bild je Wert, in der Mitte eines 64er-Feldes. */
function drawGlyph(context: Ctx, stat: StatKey, accent: string): void {
  context.save();
  context.translate(32, 32);
  switch (stat) {
    case "damage":
    case "melee": {
      // Schwert
      context.rotate(-0.78);
      context.beginPath();
      context.moveTo(-3, -18);
      context.lineTo(0, -23);
      context.lineTo(3, -18);
      context.lineTo(3, 6);
      context.lineTo(-3, 6);
      context.closePath();
      inked(context, "#d9d4c0");
      context.beginPath();
      context.rect(-9, 6, 18, 4);
      inked(context, accent);
      context.beginPath();
      context.rect(-2.5, 10, 5, 10);
      inked(context, "#6b4228");
      break;
    }
    case "ranged":
    case "range": {
      // Zielscheibe mit Pfeil
      for (const [r, color] of [[17, CREAM], [11, accent], [5, CREAM]] as const) {
        context.beginPath();
        context.arc(0, 0, r, 0, Math.PI * 2);
        inked(context, color, 2.2);
      }
      context.beginPath();
      context.moveTo(18, -18);
      context.lineTo(0, 0);
      context.lineWidth = 3;
      context.strokeStyle = INK;
      context.stroke();
      context.beginPath();
      context.moveTo(14, -20);
      context.lineTo(20, -20);
      context.lineTo(20, -14);
      inked(context, accent, 2);
      break;
    }
    case "attackSpeed":
    case "speed": {
      // Blitz
      context.beginPath();
      context.moveTo(4, -22);
      context.lineTo(-10, 2);
      context.lineTo(-1, 2);
      context.lineTo(-5, 22);
      context.lineTo(11, -4);
      context.lineTo(2, -4);
      context.closePath();
      inked(context, accent);
      break;
    }
    case "crit": {
      // Auge
      context.beginPath();
      context.moveTo(-20, 0);
      context.quadraticCurveTo(0, -18, 20, 0);
      context.quadraticCurveTo(0, 18, -20, 0);
      inked(context, CREAM);
      context.beginPath();
      context.arc(0, 0, 7, 0, Math.PI * 2);
      inked(context, accent, 2);
      context.beginPath();
      context.arc(1, 0, 3, 0, Math.PI * 2);
      context.fillStyle = INK;
      context.fill();
      break;
    }
    case "maxHp":
    case "regen": {
      // Herz, bei Regeneration mit Pluszeichen
      context.beginPath();
      context.moveTo(0, 17);
      context.bezierCurveTo(-18, 6, -20, -8, -12, -14);
      context.bezierCurveTo(-6, -18, -1, -14, 0, -9);
      context.bezierCurveTo(1, -14, 6, -18, 12, -14);
      context.bezierCurveTo(20, -8, 18, 6, 0, 17);
      inked(context, accent);
      if (stat === "regen") {
        context.fillStyle = CREAM;
        context.fillRect(-2.5, -8, 5, 15);
        context.fillRect(-7.5, -3, 15, 5);
      }
      break;
    }
    case "lifesteal": {
      // Tropfen mit Zahn
      context.beginPath();
      context.moveTo(0, -20);
      context.bezierCurveTo(10, -6, 14, 2, 14, 7);
      context.arc(0, 7, 14, 0, Math.PI);
      context.bezierCurveTo(-14, 2, -10, -6, 0, -20);
      inked(context, accent);
      context.beginPath();
      context.moveTo(-5, 2);
      context.lineTo(0, 12);
      context.lineTo(5, 2);
      context.closePath();
      inked(context, CREAM, 1.8);
      break;
    }
    case "armor": {
      // Schild
      context.beginPath();
      context.moveTo(0, -20);
      context.lineTo(16, -14);
      context.quadraticCurveTo(16, 10, 0, 20);
      context.quadraticCurveTo(-16, 10, -16, -14);
      context.closePath();
      inked(context, accent);
      context.beginPath();
      context.moveTo(0, -14);
      context.lineTo(0, 14);
      context.moveTo(-10, -4);
      context.lineTo(10, -4);
      context.lineWidth = 2;
      context.strokeStyle = INK;
      context.stroke();
      break;
    }
    case "dodge": {
      // Feder
      context.rotate(-0.6);
      context.beginPath();
      context.moveTo(0, -22);
      context.quadraticCurveTo(12, -6, 0, 18);
      context.quadraticCurveTo(-12, -6, 0, -22);
      inked(context, accent);
      context.beginPath();
      context.moveTo(0, -18);
      context.lineTo(0, 22);
      context.lineWidth = 2;
      context.stroke();
      for (let y = -12; y < 12; y += 5) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(6, y - 3);
        context.moveTo(0, y);
        context.lineTo(-6, y - 3);
        context.lineWidth = 1;
        context.stroke();
      }
      break;
    }
    case "luck": {
      // Kleeblatt
      for (const [dx, dy] of [[-7, -7], [7, -7], [-7, 7], [7, 7]] as const) {
        context.beginPath();
        context.arc(dx, dy, 8, 0, Math.PI * 2);
        inked(context, accent, 2);
      }
      context.beginPath();
      context.moveTo(2, 4);
      context.quadraticCurveTo(8, 14, 6, 22);
      context.lineWidth = 2.4;
      context.strokeStyle = INK;
      context.stroke();
      break;
    }
    case "harvesting": {
      // Muenzstapel
      for (const y of [10, 3, -4]) {
        context.beginPath();
        context.ellipse(0, y, 15, 6, 0, 0, Math.PI * 2);
        inked(context, accent, 2);
      }
      context.font = `bold 11px ${'"Londrina Solid", sans-serif'}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = INK;
      context.fillText("$", 0, -4);
      break;
    }
  }
  context.restore();
}

function createCanvas(scene: Phaser.Scene, key: string): CanvasRenderingContext2D | null {
  if (scene.textures.exists(key)) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  scene.textures.addCanvas(key, canvas);
  return context;
}

/** Nach dem Zeichnen muss die Grafikkarte die Leinwand neu bekommen - sonst bleibt das Symbol leer. */
function refreshTexture(scene: Phaser.Scene, key: string): void {
  (scene.textures.get(key) as Phaser.Textures.CanvasTexture).refresh();
}

function drawItemIcon(scene: Phaser.Scene, id: string, stat: StatKey | undefined): void {
  const context = createCanvas(scene, itemIconKey(id));
  if (!context) {
    return;
  }
  const accent = stat ? STAT_COLORS[stat] : "#888888";
  // Papier-Medaillon mit Tuscherand, das Bild in der Mitte.
  context.beginPath();
  context.arc(32, 33, 28, 0, Math.PI * 2);
  context.fillStyle = "rgba(29,28,25,0.25)";
  context.fill();
  context.beginPath();
  context.arc(32, 31, 28, 0, Math.PI * 2);
  inked(context, "#efe1bf", 2.6);
  context.beginPath();
  context.arc(32, 31, 23, 0, Math.PI * 2);
  context.lineWidth = 1;
  context.strokeStyle = "rgba(29,28,25,0.35)";
  context.stroke();
  drawGlyph(context, stat ?? "damage", accent);
  refreshTexture(scene, itemIconKey(id));
}

/** Zeichnet alle fehlenden Symbole. Mehrfach aufrufen ist harmlos. */
export function createIcons(scene: Phaser.Scene): void {
  for (const item of ITEMS) {
    const first = (Object.keys(item.mods) as StatKey[])[0];
    const main = (Object.keys(item.mods) as StatKey[]).find((key) => (item.mods[key] ?? 0) > 0) ?? first;
    drawItemIcon(scene, item.id, main);
  }

  // Das Kreuz, das vor einem Gegner am Boden erscheint.
  const marker = createCanvas(scene, "marker");
  if (marker) {
    marker.strokeStyle = "#b5532f";
    marker.lineWidth = 9;
    marker.lineCap = "round";
    marker.beginPath();
    marker.moveTo(14, 14);
    marker.lineTo(50, 50);
    marker.moveTo(50, 14);
    marker.lineTo(14, 50);
    marker.stroke();
    refreshTexture(scene, "marker");
  }

  // Ein weicher Schatten unter jeder Figur.
  const shadow = createCanvas(scene, "shadow");
  if (shadow) {
    const gradient = shadow.createRadialGradient(32, 32, 2, 32, 32, 30);
    gradient.addColorStop(0, "rgba(0,0,0,0.45)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    shadow.fillStyle = gradient;
    shadow.fillRect(0, 0, ICON_SIZE, ICON_SIZE);
    refreshTexture(scene, "shadow");
  }
}
