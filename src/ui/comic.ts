/**
 * Die gemalten Texturen des Spiels: Arena, Hintergrund, Geschoss, Material, Logo.
 *
 * Duester und hart: Beton und Asphalt, Warnstreifen an der Mauer, Risse,
 * Blutflecken, Rasterpunkte in den Ecken. Alles wird einmal auf Leinwaende
 * gemalt (feste Startwerte, damit es bei jedem Start gleich aussieht) und
 * danach nur noch als Bild benutzt. Figuren stehen in `comicFigures.ts`,
 * Waffen in `comicWeapons.ts`, die Farben in `noir.ts`.
 */

import type Phaser from "phaser";
import { arenaKey } from "../config/assets";
import { ARENA } from "../game/constants";
import { createFigureTextures } from "./comicFigures";
import { createWeaponTextures } from "./comicWeapons";
import { NOIR } from "./noir";

/** Breite des Mauerrands um die Arena in Entwurfseinheiten. */
export const ARENA_WALL = 18;

type Ctx = CanvasRenderingContext2D;

function canvasOf(width: number, height: number): { canvas: HTMLCanvasElement; context: Ctx } | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  return context ? { canvas, context } : null;
}

/** Ein Zufallsstrom mit festem Startwert: Die Arena sieht bei jedem Start gleich aus. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addTexture(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): void {
  if (scene.textures.exists(key)) {
    return;
  }
  // Gemalte Flaechen sollen weich skalieren; das Spiel stellt sonst alles auf harte Pixel.
  scene.textures.addCanvas(key, canvas)?.setFilter(1);
}

// --- Arena ---------------------------------------------------------------------

/** Diagonale Warnstreifen in einem Rechteck. */
function hazard(context: Ctx, x: number, y: number, w: number, h: number): void {
  context.save();
  context.beginPath();
  context.rect(x, y, w, h);
  context.clip();
  context.fillStyle = NOIR.ink;
  context.fillRect(x, y, w, h);
  context.fillStyle = NOIR.amber;
  const step = 12;
  for (let i = -h; i < w + h; i += step * 2) {
    context.beginPath();
    context.moveTo(x + i, y + h);
    context.lineTo(x + i + step, y + h);
    context.lineTo(x + i + step + h, y);
    context.lineTo(x + i + h, y);
    context.closePath();
    context.fill();
  }
  context.restore();
}

function paintArena(context: Ctx): void {
  const wall = ARENA_WALL;
  const width = ARENA.width + wall * 2;
  const height = ARENA.height + wall * 2;
  const random = seeded(77);

  // Boden: Betonplatten mit dunklen Fugen.
  context.fillStyle = "#454c5d";
  context.fillRect(0, 0, width, height);
  const slab = 75;
  for (let y = wall; y < height - wall; y += slab) {
    for (let x = wall; x < width - wall; x += slab) {
      const tone = random();
      context.fillStyle = tone < 0.33 ? "rgba(255,255,255,0.035)" : tone < 0.66 ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0)";
      context.fillRect(x, y, slab, slab);
    }
  }
  context.strokeStyle = "rgba(10,9,16,0.55)";
  context.lineWidth = 2;
  for (let x = wall; x <= width - wall; x += slab) {
    context.beginPath();
    context.moveTo(x, wall);
    context.lineTo(x, height - wall);
    context.stroke();
  }
  for (let y = wall; y <= height - wall; y += slab) {
    context.beginPath();
    context.moveTo(wall, y);
    context.lineTo(width - wall, y);
    context.stroke();
  }

  // Oelflecken und alte Blutspritzer.
  for (let i = 0; i < 9; i += 1) {
    const x = wall + 40 + random() * (ARENA.width - 80);
    const y = wall + 30 + random() * (ARENA.height - 60);
    context.fillStyle = "rgba(10,9,16,0.28)";
    context.beginPath();
    context.ellipse(x, y, 20 + random() * 36, 12 + random() * 22, random() * 3, 0, Math.PI * 2);
    context.fill();
  }
  for (let i = 0; i < 6; i += 1) {
    const x = wall + 60 + random() * (ARENA.width - 120);
    const y = wall + 50 + random() * (ARENA.height - 100);
    context.fillStyle = "rgba(124,18,25,0.45)";
    context.beginPath();
    context.ellipse(x, y, 9 + random() * 14, 6 + random() * 9, random() * 3, 0, Math.PI * 2);
    context.fill();
    for (let k = 0; k < 6; k += 1) {
      context.beginPath();
      context.arc(x + (random() - 0.5) * 60, y + (random() - 0.5) * 40, 1.5 + random() * 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  // Verblasste Bodenmarkierung: Ring und Kreuz in der Mitte.
  context.strokeStyle = "rgba(233,228,212,0.22)";
  context.lineWidth = 5;
  context.setLineDash([22, 16]);
  context.beginPath();
  context.arc(width / 2, height / 2, 130, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(width / 2 - 22, height / 2);
  context.lineTo(width / 2 + 22, height / 2);
  context.moveTo(width / 2, height / 2 - 22);
  context.lineTo(width / 2, height / 2 + 22);
  context.stroke();

  // Risse.
  context.strokeStyle = NOIR.ink;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let i = 0; i < 16; i += 1) {
    let x = wall + 30 + random() * (ARENA.width - 60);
    let y = wall + 30 + random() * (ARENA.height - 60);
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(x, y);
    for (let k = 0; k < 4; k += 1) {
      x += (random() - 0.5) * 46;
      y += (random() - 0.35) * 36;
      context.lineTo(x, y);
    }
    context.stroke();
  }

  // Schutt.
  for (let i = 0; i < 40; i += 1) {
    const x = wall + 10 + random() * (ARENA.width - 20);
    const y = wall + 10 + random() * (ARENA.height - 20);
    const r = 1.6 + random() * 3.4;
    context.fillStyle = random() < 0.5 ? "#2c3240" : "#5f687c";
    context.beginPath();
    context.moveTo(x - r, y);
    context.lineTo(x - r * 0.3, y - r);
    context.lineTo(x + r, y - r * 0.2);
    context.lineTo(x + r * 0.5, y + r);
    context.closePath();
    context.fill();
    context.strokeStyle = NOIR.ink;
    context.lineWidth = 1.5;
    context.stroke();
  }

  // Rasterpunkte in den Ecken, vom Rand nach innen schwaecher.
  context.fillStyle = "rgba(10,9,16,0.35)";
  for (let y = wall + 4; y < height - wall; y += 9) {
    for (let x = wall + 4 + (Math.floor(y / 9) % 2) * 4.5; x < width - wall; x += 9) {
      const dx = Math.min(x - wall, width - wall - x) / 150;
      const dy = Math.min(y - wall, height - wall - y) / 110;
      const edge = 1 - Math.min(1, Math.min(dx, dy));
      if (edge > 0.05) {
        context.beginPath();
        context.arc(x, y, edge * 2.1, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  // Innerer Schatten.
  const shadow = context.createLinearGradient(0, wall, 0, wall + 34);
  shadow.addColorStop(0, "rgba(10,9,16,0.55)");
  shadow.addColorStop(1, "rgba(10,9,16,0)");
  context.fillStyle = shadow;
  context.fillRect(wall, wall, ARENA.width, 34);

  // Mauer: Betonbloecke mit Warnstreifen an der Innenkante.
  context.fillStyle = NOIR.steel1;
  context.fillRect(0, 0, width, wall);
  context.fillRect(0, height - wall, width, wall);
  context.fillRect(0, 0, wall, height);
  context.fillRect(width - wall, 0, wall, height);
  context.strokeStyle = NOIR.ink;
  context.lineWidth = 2;
  for (let x = 0; x < width; x += 54) {
    for (const y of [0, height - wall]) {
      context.fillStyle = (x / 54) % 2 === 0 ? NOIR.steel2 : NOIR.steel1;
      context.fillRect(x + 1, y + 1, 52, wall - 2);
      context.strokeRect(x + 1, y + 1, 52, wall - 2);
      context.fillStyle = "rgba(233,228,212,0.14)";
      context.fillRect(x + 4, y + 3, 46, 2);
    }
  }
  for (let y = wall; y < height - wall; y += 40) {
    for (const x of [0, width - wall]) {
      context.fillStyle = (y / 40) % 2 === 0 ? NOIR.steel2 : NOIR.steel1;
      context.fillRect(x + 1, y + 1, wall - 2, 38);
      context.strokeRect(x + 1, y + 1, wall - 2, 38);
    }
  }
  // Warnstreifen
  hazard(context, wall, wall - 6, ARENA.width, 6);
  hazard(context, wall, height - wall, ARENA.width, 6);
  hazard(context, wall - 6, wall - 6, 6, ARENA.height + 12);
  hazard(context, width - wall, wall - 6, 6, ARENA.height + 12);

  context.strokeStyle = NOIR.ink;
  context.lineWidth = 4;
  context.strokeRect(wall - 3, wall - 3, ARENA.width + 6, ARENA.height + 6);
  context.lineWidth = 5;
  context.strokeRect(1.5, 1.5, width - 3, height - 3);
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

/** Nacht hinter der Arena: fast schwarzer Verlauf mit feinem Raster. */
function createGameBackground(scene: Phaser.Scene): void {
  const width = 1600;
  const height = 540;
  const target = canvasOf(width, height);
  if (!target) {
    return;
  }
  const { context } = target;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#1b2030");
  gradient.addColorStop(1, NOIR.ink);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(196,38,46,0.07)";
  for (let y = 8; y < height; y += 16) {
    for (let x = 8 + (Math.floor(y / 16) % 2) * 8; x < width; x += 16) {
      context.beginPath();
      context.arc(x, y, 1.2 + (y / height) * 2, 0, Math.PI * 2);
      context.fill();
    }
  }
  addTexture(scene, "bg-game", target.canvas);
}

// --- Kleinteile ------------------------------------------------------------------

/** Das Geschoss: weissglühender Kern mit dunklem Ring (wird im Spiel eingefaerbt). */
function createBullet(scene: Phaser.Scene): void {
  const target = canvasOf(32, 32);
  if (!target) {
    return;
  }
  const { context } = target;
  context.fillStyle = NOIR.ink;
  context.beginPath();
  context.arc(16, 16, 14, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(16, 16, 10, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(10,9,16,0.25)";
  context.beginPath();
  context.arc(19, 19, 6, 0, Math.PI * 2);
  context.fill();
  addTexture(scene, "bullet", target.canvas);
}

/** Das Material: ein Bernstein-Splitter. */
function createGem(scene: Phaser.Scene): void {
  const target = canvasOf(48, 48);
  if (!target) {
    return;
  }
  const { context } = target;
  const outline = [[24, 3], [38, 16], [33, 40], [24, 45], [15, 40], [10, 16]] as const;
  context.lineJoin = "round";
  context.beginPath();
  outline.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
  context.closePath();
  context.fillStyle = NOIR.amber;
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = NOIR.ink;
  context.stroke();
  // harte Facetten
  context.fillStyle = NOIR.amberDark;
  context.beginPath();
  context.moveTo(24, 20);
  context.lineTo(38, 16);
  context.lineTo(33, 40);
  context.lineTo(24, 45);
  context.closePath();
  context.fill();
  context.fillStyle = "#ffe08a";
  context.beginPath();
  context.moveTo(24, 6);
  context.lineTo(34, 16);
  context.lineTo(24, 20);
  context.lineTo(14, 16);
  context.closePath();
  context.fill();
  addTexture(scene, "gem", target.canvas);
}

// --- Logo ------------------------------------------------------------------------

function createLogo(scene: Phaser.Scene): void {
  const width = 900;
  const height = 320;
  const target = canvasOf(width, height);
  if (!target) {
    return;
  }
  const { context } = target;
  context.lineJoin = "round";
  context.lineCap = "round";
  const random = seeded(5);

  // Rote Wunde quer hinter dem Schriftzug.
  context.save();
  context.translate(width / 2, 138);
  context.rotate(-0.05);
  context.beginPath();
  context.moveTo(-430, -52);
  context.lineTo(-300, -70);
  context.lineTo(-120, -58);
  context.lineTo(120, -72);
  context.lineTo(330, -56);
  context.lineTo(436, -64);
  context.lineTo(420, -8);
  context.lineTo(440, 46);
  context.lineTo(300, 70);
  context.lineTo(60, 58);
  context.lineTo(-180, 74);
  context.lineTo(-400, 56);
  context.lineTo(-436, 6);
  context.closePath();
  context.fillStyle = NOIR.ink;
  context.lineWidth = 16;
  context.strokeStyle = NOIR.ink;
  context.stroke();
  context.fill();
  context.fillStyle = NOIR.blood;
  context.fill();
  context.fillStyle = NOIR.bloodDark;
  context.beginPath();
  context.moveTo(-436, 6);
  context.lineTo(-400, 56);
  context.lineTo(-180, 74);
  context.lineTo(60, 58);
  context.lineTo(300, 70);
  context.lineTo(440, 46);
  context.lineTo(420, 10);
  context.lineTo(60, 28);
  context.lineTo(-300, 30);
  context.closePath();
  context.fill();
  context.restore();

  // Schriftzug.
  context.save();
  context.translate(width / 2, 142);
  context.rotate(-0.03);
  context.transform(1, 0, -0.14, 1, 0, 0);
  let fontSize = 176;
  const family = `900 FONTpx "Arial Black", "Segoe UI Black", Impact, system-ui, sans-serif`;
  context.font = family.replace("FONT", String(fontSize));
  while (context.measureText("HOLDOUT").width > 660 && fontSize > 80) {
    fontSize -= 4;
    context.font = family.replace("FONT", String(fontSize));
  }
  context.textAlign = "center";
  context.textBaseline = "middle";
  // Harter Schlagschatten, dann Tinte, dann Knochenweiss.
  context.strokeStyle = NOIR.ink;
  context.fillStyle = NOIR.ink;
  context.lineWidth = 30;
  context.strokeText("HOLDOUT", 10, 12);
  context.fillText("HOLDOUT", 10, 12);
  context.lineWidth = 28;
  context.strokeText("HOLDOUT", 0, 0);
  const fill = context.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2);
  fill.addColorStop(0, NOIR.bone);
  fill.addColorStop(0.55, NOIR.bone);
  fill.addColorStop(0.56, NOIR.boneDark);
  fill.addColorStop(1, "#8d866f");
  context.fillStyle = fill;
  context.fillText("HOLDOUT", 0, 0);
  // Kratzer und Abplatzer im Schriftzug.
  context.save();
  context.globalCompositeOperation = "source-atop";
  context.strokeStyle = "rgba(10,9,16,0.55)";
  context.lineWidth = 2;
  for (let i = 0; i < 26; i += 1) {
    const x = (random() - 0.5) * 680;
    const y = (random() - 0.5) * fontSize * 0.9;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + (random() - 0.2) * 36, y + (random() - 0.5) * 14);
    context.stroke();
  }
  context.restore();
  context.restore();

  // Unterzeile auf schwarzem Streifen.
  context.save();
  context.translate(width / 2, 280);
  context.rotate(-0.02);
  context.fillStyle = NOIR.ink;
  context.fillRect(-270, -24, 540, 48);
  context.fillStyle = NOIR.amber;
  context.fillRect(-270, 18, 540, 6);
  context.font = `800 26px "Arial Black", system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = NOIR.bone;
  if ("letterSpacing" in context) {
    (context as unknown as { letterSpacing: string }).letterSpacing = "5px";
  }
  context.fillText("ÜBERLEBE 20 WELLEN", 0, -2);
  context.restore();

  addTexture(scene, "logo", target.canvas);
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
  createLogo(scene);
}
