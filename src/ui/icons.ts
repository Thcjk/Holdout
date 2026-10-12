/**
 * Symbole, die beim Start gezeichnet werden, weil das Grafikpaket sie nicht hat.
 *
 * Gegenstaende bekommen eine farbige Plakette mit Kuerzel - die Farbe sagt, was
 * der Gegenstand vor allem tut (rot = Schaden, grau = Schutz, blau = Tempo ...).
 * So findet man im Shop schon am Farbton, was man sucht, ohne zu lesen.
 */

import type Phaser from "phaser";
import { itemIconKey } from "../config/assets";
import { ITEMS } from "../game/data/items";
import type { StatKey } from "../game/types";

const ICON_SIZE = 64;

/** Farbe nach dem wichtigsten Wert des Gegenstands. */
const STAT_COLORS: Record<StatKey, string> = {
  damage: "#c9503c",
  melee: "#c9503c",
  ranged: "#d9783c",
  attackSpeed: "#d9a23c",
  crit: "#e8c14a",
  range: "#6aa0c9",
  maxHp: "#5fa05a",
  regen: "#4fae8a",
  lifesteal: "#a8406a",
  armor: "#7d8794",
  dodge: "#5a7fc9",
  speed: "#4a9ad9",
  luck: "#8ab83c",
  harvesting: "#c9a03c",
};

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

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawItemIcon(scene: Phaser.Scene, id: string, label: string, color: string): void {
  const context = createCanvas(scene, itemIconKey(id));
  if (!context) {
    return;
  }
  context.fillStyle = "#3a2a1a";
  roundedRect(context, 2, 2, ICON_SIZE - 4, ICON_SIZE - 4, 12);
  context.fill();
  context.fillStyle = color;
  roundedRect(context, 6, 6, ICON_SIZE - 12, ICON_SIZE - 12, 9);
  context.fill();
  // Heller Streifen oben gibt der Plakette etwas Koerper.
  context.fillStyle = "rgba(255,255,255,0.18)";
  roundedRect(context, 8, 8, ICON_SIZE - 16, 16, 7);
  context.fill();
  context.fillStyle = "#fff8e6";
  context.font = "bold 26px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(0,0,0,0.5)";
  context.shadowBlur = 3;
  context.fillText(label, ICON_SIZE / 2, ICON_SIZE / 2 + 3);
  refreshTexture(scene, itemIconKey(id));
}

/** Zeichnet alle fehlenden Symbole. Mehrfach aufrufen ist harmlos. */
export function createIcons(scene: Phaser.Scene): void {
  for (const item of ITEMS) {
    const first = (Object.keys(item.mods) as StatKey[])[0];
    const main = (Object.keys(item.mods) as StatKey[]).find((key) => (item.mods[key] ?? 0) > 0) ?? first;
    drawItemIcon(scene, item.id, item.icon, main ? STAT_COLORS[main] : "#888888");
  }

  // Das Kreuz, das vor einem Gegner am Boden erscheint.
  const marker = createCanvas(scene, "marker");
  if (marker) {
    marker.strokeStyle = "#c4262e";
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
