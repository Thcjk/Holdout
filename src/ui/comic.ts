/**
 * Die gemalten Texturen des Spiels: Arena, Hintergrund, Geschoss, Material,
 * Logo, Klippe fuers Titelbild und Herz fuer die Lebensanzeige.
 *
 * Poster-Stil: Alles liegt auf Creme-Papier mit Korn. Die Arena ist eine
 * gemalte Lichtung mit Weg, Steinkreis und Blumen, deren Rand unregelmaessig
 * ist und in Tusche umrandet - ringsum stehen Baeume, Felsen und Ruinen wie
 * auf einer illustrierten Karte. Alles wird einmal auf Leinwaende gemalt
 * (feste Startwerte, damit es bei jedem Start gleich aussieht).
 * Figuren stehen in `comicFigures.ts`, Waffen in `comicWeapons.ts`.
 */

import type Phaser from "phaser";
import { arenaKey } from "../config/assets";
import { ARENA } from "../game/constants";
import { createFigureTextures, inkify } from "./comicFigures";
import { createWeaponTextures } from "./comicWeapons";
import { NOIR } from "./noir";
import { FONT_HAND, FONT_TITLE, grain, inkLine, seeded } from "./paper";

/** So weit reicht das Arenabild ueber die Spielflaeche hinaus (fuer Baeume und Felsen). */
export const ARENA_WALL = 44;

type Ctx = CanvasRenderingContext2D;

const INK = "#1d1c19";

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; context: Ctx } | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  return context ? { canvas, context } : null;
}

function addTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) {
    return;
  }
  scene.textures.addCanvas(key, canvas)?.setFilter(1);
}

// --- Gezeichnete Kleinteile fuer Landschaften -------------------------------------

/** Ein Laubbaum: Stamm und runde Krone aus drei Blobs, Tusche-Rand. */
function leafTree(context: Ctx, x: number, y: number, h: number, random: () => number, color = "#5d7d43"): void {
  const crownR = h * 0.32;
  context.fillStyle = "#4a3426";
  context.strokeStyle = INK;
  context.lineWidth = 1.6;
  context.beginPath();
  context.moveTo(x - h * 0.04, y);
  context.lineTo(x - h * 0.03, y - h * 0.45);
  context.lineTo(x + h * 0.03, y - h * 0.45);
  context.lineTo(x + h * 0.05, y);
  context.closePath();
  context.fill();
  context.stroke();
  const blobs: [number, number, number][] = [
    [x - crownR * 0.55, y - h * 0.55, crownR * 0.8],
    [x + crownR * 0.55, y - h * 0.58, crownR * 0.78],
    [x, y - h * 0.75, crownR],
  ];
  context.beginPath();
  for (const [bx, by, r] of blobs) {
    context.moveTo(bx + r, by);
    context.arc(bx, by, r, 0, Math.PI * 2);
  }
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 1.8;
  context.stroke();
  // dunklere Unterseite der Krone
  context.save();
  context.clip();
  context.fillStyle = "rgba(29,28,25,0.22)";
  context.fillRect(x - h, y - h * 0.62, h * 2, h);
  context.restore();
  // ein paar Blatt-Striche
  for (let i = 0; i < 4; i += 1) {
    const bx = x + (random() - 0.5) * crownR * 1.4;
    const by = y - h * 0.7 + (random() - 0.5) * crownR;
    inkLine(context, [[bx, by], [bx + 3, by - 2]], 1, random, "rgba(29,28,25,0.5)");
  }
}

/** Eine Tanne: geschichtete Dreiecke mit Tusche-Rand. */
function pineTree(context: Ctx, x: number, y: number, h: number, color = "#3e5a4a"): void {
  const w = h * 0.42;
  context.beginPath();
  context.moveTo(x, y - h);
  for (const [dy, dx] of [[0.35, 0.55], [0.38, 0.32], [0.65, 0.8], [0.68, 0.5], [0.95, 1]] as const) {
    context.lineTo(x + w * dx, y - h + h * dy);
  }
  context.lineTo(x + w * 0.12, y - h * 0.05);
  context.lineTo(x + w * 0.12, y);
  context.lineTo(x - w * 0.12, y);
  context.lineTo(x - w * 0.12, y - h * 0.05);
  for (const [dy, dx] of [[0.95, 1], [0.68, 0.5], [0.65, 0.8], [0.38, 0.32], [0.35, 0.55]] as const) {
    context.lineTo(x - w * dx, y - h + h * dy);
  }
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 1.7;
  context.strokeStyle = INK;
  context.stroke();
  context.save();
  context.clip();
  context.fillStyle = "rgba(29,28,25,0.25)";
  context.fillRect(x, y - h, w, h);
  context.restore();
}

/** Ein Felsbrocken. */
function rock(context: Ctx, x: number, y: number, r: number, random: () => number): void {
  const points: [number, number][] = [];
  for (let i = 0; i < 7; i += 1) {
    const a = Math.PI + (i / 6) * Math.PI;
    const rr = r * (0.75 + random() * 0.35);
    points.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75]);
  }
  context.beginPath();
  points.forEach(([px, py], index) => (index === 0 ? context.moveTo(px, py) : context.lineTo(px, py)));
  context.closePath();
  context.fillStyle = "#8d9688";
  context.fill();
  context.lineWidth = 1.6;
  context.strokeStyle = INK;
  context.stroke();
  context.save();
  context.clip();
  context.fillStyle = "rgba(29,28,25,0.25)";
  context.fillRect(x, y - r, r * 2, r * 2);
  context.restore();
}

/** Eine zerbrochene Saeule aus Stein. */
function pillar(context: Ctx, x: number, y: number, h: number, random: () => number): void {
  const w = h * 0.34;
  context.beginPath();
  context.moveTo(x - w / 2, y);
  context.lineTo(x - w / 2, y - h * 0.8);
  context.lineTo(x - w * 0.1, y - h);
  context.lineTo(x + w * 0.15, y - h * 0.86);
  context.lineTo(x + w / 2, y - h * 0.92);
  context.lineTo(x + w / 2, y);
  context.closePath();
  context.fillStyle = "#c2bba3";
  context.fill();
  context.lineWidth = 1.6;
  context.strokeStyle = INK;
  context.stroke();
  context.save();
  context.clip();
  context.fillStyle = "rgba(29,28,25,0.22)";
  context.fillRect(x + w * 0.1, y - h, w, h);
  context.restore();
  for (let i = 1; i < 3; i += 1) {
    inkLine(context, [[x - w / 2, y - (h * i) / 3], [x + w / 2, y - (h * i) / 3]], 1, random, "rgba(29,28,25,0.55)");
  }
  // Moos
  context.fillStyle = "#6e8f3a";
  context.beginPath();
  context.ellipse(x - w * 0.1, y - h * 0.8, w * 0.35, 2.5, 0, 0, Math.PI * 2);
  context.fill();
}

// --- Arena ---------------------------------------------------------------------

/** Unregelmaessiger Rand der Lichtung: ein Rechteck, dessen Kante sanft wellt. */
function clearingPath(context: Ctx, x: number, y: number, w: number, h: number, random: () => number): void {
  const points: [number, number][] = [];
  const bump = (): number => 4 + random() * 7;
  const step = 22;
  for (let px = x; px < x + w; px += step) {
    points.push([px, y - bump()]);
  }
  for (let py = y; py < y + h; py += step) {
    points.push([x + w + bump(), py]);
  }
  for (let px = x + w; px > x; px -= step) {
    points.push([px, y + h + bump()]);
  }
  for (let py = y + h; py > y; py -= step) {
    points.push([x - bump(), py]);
  }
  context.beginPath();
  points.forEach(([px, py], index) => {
    const [nx, ny] = points[(index + 1) % points.length] as [number, number];
    if (index === 0) {
      context.moveTo((px + nx) / 2, (py + ny) / 2);
    } else {
      context.quadraticCurveTo(px, py, (px + nx) / 2, (py + ny) / 2);
    }
  });
  const [fx, fy] = points[0] as [number, number];
  const [sx, sy] = points[1] as [number, number];
  context.quadraticCurveTo(fx, fy, (fx + sx) / 2, (fy + sy) / 2);
  context.closePath();
}

function paintArena(context: Ctx): void {
  const wall = ARENA_WALL;
  const width = ARENA.width + wall * 2;
  const height = ARENA.height + wall * 2;
  const random = seeded(77);
  const x0 = wall;
  const y0 = wall;
  const w = ARENA.width;
  const h = ARENA.height;

  // Lichtung: gemalte Wiese, nur innerhalb des welligen Rands.
  context.save();
  clearingPath(context, x0, y0, w, h, seeded(9));
  context.save();
  context.clip();
  context.fillStyle = "#b5ba8f";
  context.fillRect(0, 0, width, height);
  // Pinselflecken in Salbei und Oliv
  for (let i = 0; i < 70; i += 1) {
    const px = x0 + random() * w;
    const py = y0 + random() * h;
    const tone = random();
    context.fillStyle =
      tone < 0.35 ? "rgba(205,206,165,0.55)" : tone < 0.7 ? "rgba(146,160,112,0.45)" : "rgba(122,140,96,0.35)";
    context.beginPath();
    context.ellipse(px, py, 30 + random() * 70, 14 + random() * 30, random() * 3, 0, Math.PI * 2);
    context.fill();
  }
  // Ein heller Trampelpfad quer durch die Lichtung.
  context.strokeStyle = "#d9c9a0";
  context.lineCap = "round";
  context.lineWidth = 34;
  context.beginPath();
  context.moveTo(x0 - 20, y0 + h * 0.72);
  context.bezierCurveTo(x0 + w * 0.25, y0 + h * 0.5, x0 + w * 0.42, y0 + h * 0.62, x0 + w * 0.5, y0 + h * 0.5);
  context.bezierCurveTo(x0 + w * 0.6, y0 + h * 0.36, x0 + w * 0.78, y0 + h * 0.3, x0 + w + 20, y0 + h * 0.36);
  context.stroke();
  context.strokeStyle = "rgba(160,132,90,0.35)";
  context.lineWidth = 2;
  context.setLineDash([3, 9]);
  context.stroke();
  context.setLineDash([]);
  // Lichtung mit altem Steinkreis in der Mitte.
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  context.fillStyle = "#cfc7a2";
  context.beginPath();
  context.ellipse(cx, cy, 110, 66, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(29,28,25,0.35)";
  context.lineWidth = 1.4;
  context.stroke();
  for (let i = 0; i < 16; i += 1) {
    if (i % 5 === 3) {
      continue;
    }
    const a = (i / 16) * Math.PI * 2;
    const sx = cx + Math.cos(a) * 96;
    const sy = cy + Math.sin(a) * 56;
    context.fillStyle = "#a9a690";
    context.beginPath();
    context.ellipse(sx, sy, 8, 5, a, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = INK;
    context.lineWidth = 1.3;
    context.stroke();
  }
  // Grasstriche in Tusche und Gruen
  for (let i = 0; i < 260; i += 1) {
    const px = x0 + random() * w;
    const py = y0 + 6 + random() * (h - 6);
    const color = random() < 0.3 ? "rgba(29,28,25,0.55)" : random() < 0.6 ? "#6f8a4a" : "#56703a";
    for (let k = -1; k <= 1; k += 1) {
      inkLine(context, [[px + k * 2, py], [px + k * 3.4, py - 4 - random() * 4]], 1.2, random, color);
    }
  }
  // Blumen
  for (let i = 0; i < 46; i += 1) {
    const px = x0 + 8 + random() * (w - 16);
    const py = y0 + 8 + random() * (h - 16);
    context.fillStyle = random() < 0.4 ? NOIR.amber : random() < 0.6 ? NOIR.blood : NOIR.bone;
    context.beginPath();
    context.arc(px, py, 2.4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = INK;
    context.lineWidth = 0.8;
    context.stroke();
  }
  // Kieselsteine
  for (let i = 0; i < 30; i += 1) {
    rock(context, x0 + 10 + random() * (w - 20), y0 + 12 + random() * (h - 20), 3 + random() * 4, random);
  }
  // Dunklere Kante innen: die Lichtung liegt etwas tiefer als der Wald.
  context.lineWidth = 26;
  context.strokeStyle = "rgba(60,72,48,0.28)";
  clearingPath(context, x0, y0, w, h, seeded(9));
  context.stroke();
  grain(context, width, height, 0.5, random);
  context.restore();
  // Tusche-Rand der Lichtung
  clearingPath(context, x0, y0, w, h, seeded(9));
  context.lineWidth = 2.6;
  context.strokeStyle = INK;
  context.stroke();
  context.restore();

  // Ringsum: Baeume hinter dem oberen Rand, Baeume an den Seiten, Felsen und Ruinen.
  const back: (() => void)[] = [];
  for (let px = -6; px < width + 10; px += 14 + random() * 16) {
    const hgt = 22 + random() * 12;
    const kind = random();
    back.push(() =>
      kind < 0.5
        ? pineTree(context, px, y0 + 4, hgt, random() < 0.5 ? "#3e5a4a" : "#4d6c50")
        : leafTree(context, px, y0 + 6, hgt, random, random() < 0.5 ? "#6b8a4a" : "#5d7d43"),
    );
  }
  for (const draw of back) {
    draw();
  }
  for (const side of [0, 1]) {
    for (let py = y0 + 34; py < y0 + h + 30; py += 26 + random() * 22) {
      const px = side === 0 ? x0 - 18 - random() * 14 : x0 + w + 18 + random() * 14;
      if (random() < 0.6) {
        pineTree(context, px, py, 26 + random() * 14, random() < 0.5 ? "#3e5a4a" : "#4d6c50");
      } else {
        leafTree(context, px, py, 28 + random() * 12, random, random() < 0.5 ? "#6b8a4a" : "#5d7d43");
      }
    }
  }
  // unten nur niedriges Zeug, damit nichts die Spielflaeche verdeckt
  for (let px = 10; px < width; px += 30 + random() * 40) {
    if (random() < 0.5) {
      rock(context, px, y0 + h + 22 + random() * 10, 7 + random() * 6, random);
    } else {
      context.fillStyle = "#56703a";
      context.beginPath();
      context.ellipse(px, y0 + h + 24, 12 + random() * 8, 7, 0, 0, Math.PI * 2);
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = INK;
      context.stroke();
    }
  }
  // Ruinen in den Ecken
  pillar(context, x0 - 22, y0 + h + 12, 34, random);
  pillar(context, x0 + w + 24, y0 + h + 14, 28, random);
  pillar(context, x0 + w + 10, y0 + 22, 22, random);

  // Nebelfetzen am Rand
  for (let i = 0; i < 12; i += 1) {
    const px = random() * width;
    const py = random() < 0.5 ? y0 + random() * 26 : y0 + h - random() * 26;
    const fog = context.createRadialGradient(px, py, 0, px, py, 70);
    fog.addColorStop(0, "rgba(241,229,201,0.35)");
    fog.addColorStop(1, "rgba(241,229,201,0)");
    context.fillStyle = fog;
    context.fillRect(px - 70, py - 70, 140, 140);
  }
}

function createArena(scene: Phaser.Scene): void {
  const scale = 2;
  const wall = ARENA_WALL;
  const target = canvasOf((ARENA.width + wall * 2) * scale, (ARENA.height + wall * 2) * scale);
  if (!target) {
    return;
  }
  target.context.scale(scale, scale);
  paintArena(target.context);
  addTexture(scene, arenaKey, target.canvas);
}

/** Papier hinter der Arena, mit blassen Bergen am oberen Rand. */
function createGameBackground(scene: Phaser.Scene): void {
  const width = 1600;
  const height = 540;
  const target = canvasOf(width, height);
  if (!target) {
    return;
  }
  const { context } = target;
  const random = seeded(31);
  context.fillStyle = "#f1e5c9";
  context.fillRect(0, 0, width, height);
  for (const [base, color, amp] of [[90, "rgba(158,176,164,0.35)", 60], [110, "rgba(122,150,140,0.3)", 40]] as const) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(0, base);
    for (let x = 0; x <= width; x += 50) {
      context.lineTo(x, base - random() * amp);
    }
    context.lineTo(width, 0);
    context.closePath();
    context.fill();
  }
  // Untere Kante etwas dunkler, wie gealtertes Papier.
  const age = context.createRadialGradient(width / 2, height / 2, height * 0.4, width / 2, height / 2, width * 0.6);
  age.addColorStop(0, "rgba(120,90,50,0)");
  age.addColorStop(1, "rgba(120,90,50,0.22)");
  context.fillStyle = age;
  context.fillRect(0, 0, width, height);
  grain(context, width, height, 0.35, random);
  addTexture(scene, "bg-game", target.canvas);
}

// --- Kleinteile ------------------------------------------------------------------

/** Das Geschoss: heller Kern mit Tusche-Rand (wird im Spiel eingefaerbt). */
function createBullet(scene: Phaser.Scene): void {
  const target = canvasOf(32, 32);
  if (!target) {
    return;
  }
  const { context } = target;
  context.fillStyle = INK;
  context.beginPath();
  context.arc(16, 16, 13, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(16, 16, 9.5, 0, Math.PI * 2);
  context.fill();
  addTexture(scene, "bullet", target.canvas);
}

/** Das Material: ein Bernstein-Splitter mit Tusche-Rand. */
function createGem(scene: Phaser.Scene): void {
  const target = canvasOf(48, 48);
  if (!target) {
    return;
  }
  const { context } = target;
  const outline = [[24, 4], [37, 16], [33, 40], [24, 45], [15, 40], [11, 16]] as const;
  context.lineJoin = "round";
  context.beginPath();
  outline.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
  context.closePath();
  context.fillStyle = NOIR.amber;
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = INK;
  context.stroke();
  context.fillStyle = NOIR.amberDark;
  context.beginPath();
  context.moveTo(24, 20);
  context.lineTo(37, 16);
  context.lineTo(33, 40);
  context.lineTo(24, 45);
  context.closePath();
  context.fill();
  context.fillStyle = "#f6dc98";
  context.beginPath();
  context.moveTo(24, 7);
  context.lineTo(33, 16);
  context.lineTo(24, 20);
  context.lineTo(15, 16);
  context.closePath();
  context.fill();
  addTexture(scene, "gem", target.canvas);
}

/** Herz fuer die Lebensanzeige. */
function createHeart(scene: Phaser.Scene): void {
  const target = canvasOf(48, 48);
  if (!target) {
    return;
  }
  const { context } = target;
  context.beginPath();
  context.moveTo(24, 41);
  context.bezierCurveTo(6, 30, 3, 18, 10, 11);
  context.bezierCurveTo(16, 5, 23, 9, 24, 15);
  context.bezierCurveTo(25, 9, 32, 5, 38, 11);
  context.bezierCurveTo(45, 18, 42, 30, 24, 41);
  context.closePath();
  context.fillStyle = NOIR.blood;
  context.fill();
  context.lineWidth = 3.4;
  context.strokeStyle = INK;
  context.stroke();
  context.fillStyle = "rgba(241,229,201,0.6)";
  context.beginPath();
  context.ellipse(15, 16, 4, 2.4, -0.7, 0, Math.PI * 2);
  context.fill();
  addTexture(scene, "heart", target.canvas);
}

// --- Logo ------------------------------------------------------------------------

/**
 * Der Schriftzug wie auf einem Buchumschlag: dicke, handgezeichnete
 * Grossbuchstaben in Tusche, leicht abgenutzt, darunter eine Zeile mit Strich.
 */
function createLogo(scene: Phaser.Scene): void {
  const width = 900;
  const height = 300;
  const target = canvasOf(width, height);
  if (!target) {
    return;
  }
  const { context } = target;
  const random = seeded(5);

  let fontSize = 220;
  context.font = `900 ${fontSize}px ${FONT_TITLE}`;
  while (context.measureText("HOLDOUT").width > 820 && fontSize > 80) {
    fontSize -= 4;
    context.font = `900 ${fontSize}px ${FONT_TITLE}`;
  }
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  const baseline = 200;
  context.fillStyle = INK;
  context.fillText("HOLDOUT", width / 2, baseline);
  // Abnutzung: kleine Stellen, an denen das Papier durchscheint.
  context.save();
  context.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 900; i += 1) {
    context.fillStyle = `rgba(0,0,0,${0.3 + random() * 0.6})`;
    const s = 1 + random() * 2.2;
    context.fillRect(random() * width, 20 + random() * (baseline - 10), s, s);
  }
  context.restore();

  // Unterzeile: Strich, dann Handschrift mit einem Wort in Rost.
  context.font = `40px ${FONT_HAND}`;
  context.textAlign = "left";
  const first = "ÜBERLEBE ";
  const second = "20 WELLEN";
  const textWidth = context.measureText(first + second).width;
  const startX = width / 2 - textWidth / 2 + 40;
  inkLine(context, [[startX - 120, 246], [startX - 24, 244]], 4, random);
  context.fillStyle = INK;
  context.fillText(first, startX, 258);
  context.fillStyle = NOIR.blood;
  context.fillText(second, startX + context.measureText(first).width, 258);

  addTexture(scene, "logo", target.canvas);
}

/** Klippe fuers Titelbild: ein Felsvorsprung mit Gras, auf dem der Held steht. */
function createCliff(scene: Phaser.Scene): void {
  const width = 520;
  const height = 300;
  const target = canvasOf(width, height);
  if (!target) {
    return;
  }
  const { context } = target;
  const random = seeded(12);
  context.beginPath();
  context.moveTo(10, height);
  context.lineTo(50, 210);
  context.lineTo(96, 140);
  context.lineTo(160, 100);
  context.lineTo(300, 92);
  context.lineTo(420, 96);
  context.lineTo(470, 104);
  context.lineTo(455, 140);
  context.lineTo(420, 170);
  context.lineTo(400, 230);
  context.lineTo(380, height);
  context.closePath();
  context.fillStyle = "#56645e";
  context.fill();
  context.save();
  context.clip();
  context.fillStyle = "#3f4b47";
  context.beginPath();
  context.moveTo(260, height);
  context.lineTo(330, 130);
  context.lineTo(470, 110);
  context.lineTo(470, height);
  context.closePath();
  context.fill();
  for (let i = 0; i < 14; i += 1) {
    const x = random() * width;
    const y = 120 + random() * 170;
    inkLine(context, [[x, y], [x + 14 + random() * 20, y + 6 + random() * 12]], 1.4, random, "rgba(29,28,25,0.45)");
  }
  context.restore();
  // Grasdecke oben
  context.beginPath();
  context.moveTo(150, 112);
  context.lineTo(156, 98);
  for (let x = 160; x <= 470; x += 10) {
    context.lineTo(x, 96 + (x > 420 ? (x - 420) * 0.15 : 0) - random() * 6);
  }
  context.lineTo(468, 114);
  context.quadraticCurveTo(300, 116, 150, 112);
  context.closePath();
  context.fillStyle = "#6e8f3a";
  context.fill();
  for (let x = 160; x < 460; x += 8) {
    inkLine(context, [[x, 104], [x + 2, 96 - random() * 6]], 1.2, random, "#4c6a2a");
  }
  // Blumen
  for (let i = 0; i < 8; i += 1) {
    context.fillStyle = random() < 0.5 ? NOIR.amber : NOIR.blood;
    context.beginPath();
    context.arc(170 + random() * 280, 102 + random() * 8, 3, 0, Math.PI * 2);
    context.fill();
  }
  addTexture(scene, "title-cliff", inkify(target.canvas, "title-cliff", false, 2.6));
}

// --- Einstieg --------------------------------------------------------------------

/** Malt alle Texturen. Mehrfach aufrufen ist harmlos. */
export function createComicTextures(scene: Phaser.Scene): void {
  createFigureTextures(scene);
  createWeaponTextures(scene);
  createArena(scene);
  createGameBackground(scene);
  createBullet(scene);
  createGem(scene);
  createHeart(scene);
  createLogo(scene);
  createCliff(scene);
}
