/**
 * Die Gebaeude der Basis in Pixel-Art (Entwurf fuer das neue Spielprinzip).
 *
 * Mitte der Basis ist der Bohrkern: eine Bohrplattform mit einem leuchtenden
 * Chronit-Kristall im Kaefig. Faellt er, ist die Mission verloren. Darum herum
 * bauen die Mechs zwischen den Wellen Mauern, Tuerme, Fallen und Helfer.
 * Alles in Schraegansicht von vorn (wie die Figuren), Fuss unten.
 */

import { BLUE, BLUE_DEEP, CYAN, CYAN_DARK, CYAN_LIGHT, GRAY, OUTLINE, RIFT, STEEL, WHITE, YELLOW } from "./palette";
import { ellipse, Pix, poly, rect, thick, union, type Mask, type Ramp } from "./pix";

export type BuildingId = "barrikade" | "blaster" | "tesla" | "moerser" | "stasis" | "stacheln" | "reparatur" | "bohrer";

const GLOW: Ramp = [OUTLINE, CYAN_DARK, CYAN, CYAN_LIGHT];
const COPPER: Ramp = ["#2a1408", "#7a3e1a", "#b8682e", "#e89a5a"];
const GREEN_GLOW = "#6cf27a";

/** Gelb-schwarze Warnstreifen innerhalb einer Form. */
export function hazard(p: Pix, mask: Mask, step = 4): void {
  for (let y = mask.y0; y <= mask.y1; y += 1) {
    for (let x = mask.x0; x <= mask.x1; x += 1) {
      if (mask.test(x, y)) {
        p.px(x, y, Math.floor((x + y) / step) % 2 === 0 ? YELLOW[2] : "#1e1c22");
      }
    }
  }
}

/** Runder Sockel mit Warnring vorne. */
function base(p: Pix, cx: number, cy: number, rx: number, ry: number): void {
  p.shape(ellipse(cx, cy, rx, ry), GRAY, { shade: 1 });
  hazard(p, { ...ellipse(cx, cy, rx - 1, ry - 1), test: (x, y) => ellipse(cx, cy, rx - 1, ry - 1).test(x, y) && !ellipse(cx, cy - 1, rx - 3, ry - 2).test(x, y) && y > cy });
  p.shape(ellipse(cx, cy - 1, rx - 3, ry - 2), STEEL, { shade: 1 });
}

function lamp(p: Pix, x: number, y: number, color = CYAN): void {
  p.px(x, y, color);
  p.px(x, y - 1, CYAN_LIGHT);
}

// --- Bohrkern ------------------------------------------------------------------------------

export const CORE_SIZE = 96;

export function drawCore(): Pix {
  const p = new Pix(CORE_SIZE, CORE_SIZE, 41);
  // Plattform
  p.shape(ellipse(48, 78, 43, 15), GRAY, { shade: 2 });
  const ring = ellipse(48, 78, 41, 13.5);
  const top = ellipse(48, 76, 37, 11);
  hazard(p, { ...ring, test: (x, y) => ring.test(x, y) && !top.test(x, y) && y > 76 }, 5);
  p.shape(top, STEEL, { shade: 2 });
  // Seitentanks
  for (const x of [20, 76]) {
    p.shape(union(rect(x - 6, 52, 12, 18), ellipse(x, 52, 6, 3)), BLUE_DEEP, { shade: 2 });
    p.hline(x - 5, x + 5, 58, BLUE_DEEP[3]);
    lamp(p, x, 64);
  }
  // Kabel auf der Plattform
  p.line(26, 72, 36, 76, OUTLINE);
  p.line(70, 72, 60, 76, OUTLINE);
  // Turmfuss
  p.shape(poly(32, 76, 64, 76, 60, 46, 36, 46), BLUE, { shade: 2 });
  hazard(p, rect(34, 66, 28, 4), 3);
  // Kaefig mit Chronit-Kristall
  p.shape(rect(34, 18, 28, 30), GRAY, { shade: 1 });
  p.fill(rect(37, 21, 22, 24), "#0c1424");
  const crystal = poly(48, 14, 57, 30, 48, 50, 39, 30);
  p.shape(crystal, GLOW, { shade: 2, edge: false });
  p.line(48, 17, 48, 46, CYAN_LIGHT);
  p.line(41, 30, 55, 30, CYAN_DARK);
  for (const x of [37, 43, 53, 58]) {
    p.line(x, 20, x, 46, GRAY[2]);
  }
  p.shape(rect(32, 14, 32, 5), BLUE, { shade: 1 });
  p.shape(rect(32, 45, 32, 4), BLUE, { shade: 1 });
  // Antenne mit Warnlicht
  p.line(48, 13, 48, 3, GRAY[2]);
  p.px(48, 2, "#ff4a4a");
  p.px(47, 2, "#ffb0a0");
  // Scheinwerfer an der Plattform
  for (const [x, y] of [[12, 80], [84, 80], [30, 88], [66, 88]] as const) {
    p.shape(rect(x - 2, y - 3, 5, 4), GRAY, { shade: 0 });
    lamp(p, x, y - 2, "#fff6c0");
  }
  p.outline(OUTLINE);
  return p;
}

// --- Gebaeude ------------------------------------------------------------------------------

export const BUILDING_SIZE = 48;

function barrikade(p: Pix): void {
  p.shape(poly(4, 40, 44, 40, 42, 22, 6, 22), GRAY, { shade: 2 });
  p.shape(poly(6, 23, 42, 23, 41, 30, 7, 30), STEEL, { shade: 1 });
  hazard(p, rect(7, 32, 34, 4), 4);
  for (const x of [10, 24, 38]) {
    p.px(x, 26, STEEL[3]);
    p.px(x + 1, 27, STEEL[1]);
  }
  p.hline(12, 36, 24, CYAN);
}

function blaster(p: Pix): void {
  base(p, 24, 40, 15, 6);
  p.shape(rect(20, 26, 8, 13), GRAY, { shade: 1 });
  p.shape(poly(12, 15, 32, 15, 34, 28, 10, 28), BLUE, { shade: 2 });
  p.shape(rect(33, 18, 13, 4), GRAY, { shade: 1 });
  p.shape(rect(33, 23, 11, 3), GRAY, { shade: 1 });
  p.px(46, 19, CYAN);
  p.px(45, 24, CYAN);
  p.shape(rect(16, 18, 7, 4), [OUTLINE, CYAN_DARK, CYAN, CYAN_LIGHT], { shade: 0 });
  p.hline(13, 31, 26, BLUE[1]);
}

function tesla(p: Pix): void {
  base(p, 24, 42, 14, 5);
  p.shape(rect(21, 14, 6, 27), GRAY, { shade: 1 });
  for (let y = 38; y >= 18; y -= 4) {
    p.shape(ellipse(24, y, 8 - (38 - y) * 0.12, 2.6), COPPER, { shade: 1 });
  }
  p.shape(ellipse(24, 10, 6, 6), GLOW, { shade: 1, edge: false });
  p.px(22, 8, "#ffffff");
  // Blitzboegen
  p.line(18, 9, 12, 13, CYAN_LIGHT);
  p.line(12, 13, 8, 10, CYAN);
  p.line(30, 9, 36, 6, CYAN_LIGHT);
  p.line(36, 6, 41, 11, CYAN);
}

function moerser(p: Pix): void {
  p.shape(poly(8, 44, 40, 44, 37, 31, 11, 31), GRAY, { shade: 2 });
  hazard(p, rect(10, 39, 28, 3), 3);
  p.shape(thick(20, 33, 33, 14, 9), STEEL, { shade: 2 });
  p.shape(ellipse(34, 13, 5.5, 4), GRAY, { shade: 1 });
  p.px(34, 12, OUTLINE);
  p.px(35, 12, OUTLINE);
  p.shape(rect(36, 33, 8, 7), YELLOW, { shade: 1 });
  p.hline(37, 43, 36, YELLOW[0]);
  p.shape(ellipse(20, 33, 5, 4), BLUE, { shade: 1 });
}

function stasis(p: Pix): void {
  // Halbdurchsichtige Kuppel ueber dem Sender
  const dome = ellipse(24, 26, 21, 15);
  p.fill(dome, "#9a52e03a");
  p.ring(dome, "#c890ff");
  p.ring(ellipse(24, 26, 16, 11), "#9a52e088");
  p.shape(ellipse(24, 36, 11, 4), GRAY, { shade: 1 });
  p.shape(ellipse(24, 35, 5, 2), RIFT, { shade: 0, edge: false });
  p.px(24, 34, RIFT[3]);
  for (const [x, y] of [[14, 20], [33, 18], [24, 13], [18, 29], [31, 30]] as const) {
    p.px(x, y, RIFT[3]);
  }
}

function stacheln(p: Pix): void {
  p.shape(rect(6, 28, 36, 9), GRAY, { shade: 1 });
  for (let x = 8; x <= 38; x += 6) {
    p.shape(poly(x, 30, x + 2.5, 18, x + 5, 30), STEEL, { shade: 1 });
  }
  hazard(p, rect(8, 34, 32, 2), 3);
}

function reparatur(p: Pix): void {
  base(p, 24, 41, 15, 5);
  p.shape(rect(22, 24, 4, 16), GRAY, { shade: 1 });
  // Hologramm-Kreuz
  const cross = union(rect(19, 8, 10, 4), rect(22, 5, 4, 10));
  p.shape(cross, [OUTLINE, "#2e9a42", GREEN_GLOW, "#d8ffd8"], { shade: 1, edge: false });
  // Kleine Drohne
  p.shape(ellipse(37, 22, 4, 2.5), WHITE, { shade: 1 });
  p.hline(33, 41, 19, GRAY[2]);
  p.px(37, 24, GREEN_GLOW);
}

function bohrer(p: Pix): void {
  // Kristalle im Boden
  for (const [x, h] of [[16, 9], [24, 13], [31, 8]] as const) {
    p.shape(poly(x - 3, 44, x, 44 - h, x + 3, 44), GLOW, { shade: 1, edge: false });
  }
  // Bohrgeruest
  p.shape(thick(8, 44, 20, 8, 3), YELLOW, { shade: 1 });
  p.shape(thick(40, 44, 28, 8, 3), YELLOW, { shade: 1 });
  p.shape(rect(16, 6, 16, 6), GRAY, { shade: 1 });
  p.shape(rect(22, 12, 4, 20), STEEL, { shade: 1 });
  p.shape(poly(21, 32, 27, 32, 24, 38), STEEL, { shade: 0 });
  lamp(p, 19, 9);
}

export function drawBuilding(id: BuildingId): Pix {
  const p = new Pix(BUILDING_SIZE, BUILDING_SIZE, 17);
  switch (id) {
    case "barrikade":
      barrikade(p);
      break;
    case "blaster":
      blaster(p);
      break;
    case "tesla":
      tesla(p);
      break;
    case "moerser":
      moerser(p);
      break;
    case "stasis":
      stasis(p);
      break;
    case "stacheln":
      stacheln(p);
      break;
    case "reparatur":
      reparatur(p);
      break;
    case "bohrer":
      bohrer(p);
      break;
  }
  p.outline(OUTLINE);
  return p;
}

export const BUILDINGS: readonly { id: BuildingId; name: string; cost: number; text: string }[] = [
  { id: "barrikade", name: "Barrikade", cost: 10, text: "Versperrt den Weg. Gegner müssen sie zerschlagen oder außen herum laufen." },
  { id: "blaster", name: "Blaster-Turm", cost: 30, text: "Schießt schnell auf den nächsten Gegner." },
  { id: "tesla", name: "Tesla-Spule", cost: 45, text: "Blitz springt auf bis zu drei Gegner. Kurze Reichweite." },
  { id: "moerser", name: "Mörser", cost: 60, text: "Feuert weit über Mauern, trifft eine ganze Gruppe. Nicht auf Nahe." },
  { id: "stasis", name: "Stasisfeld", cost: 35, text: "Alles im Feld läuft halb so schnell." },
  { id: "stacheln", name: "Stachelfalle", cost: 15, text: "Schadet allem, was darüber läuft. Blockiert nicht." },
  { id: "reparatur", name: "Reparaturstation", cost: 50, text: "Repariert Gebäude und Mechs in der Nähe." },
  { id: "bohrer", name: "Chronit-Bohrer", cost: 40, text: "Bringt nach jeder Welle zusätzliches Chronit." },
];
