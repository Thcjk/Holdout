/**
 * Die gemalten Texturen des Spiels: Arena, Hintergrund, Geschoss, Material, Logo.
 *
 * Maerchenbuch-Stil: eine Salbei-Wiese mit Koernung, Nebelflecken und
 * Grasbuescheln, ringsum ein dunkler Tannenwald. Alles wird einmal auf
 * Leinwaende gemalt (feste Startwerte, damit es bei jedem Start gleich
 * aussieht) und danach nur noch als Bild benutzt. Figuren stehen in
 * `comicFigures.ts`, Waffen in `comicWeapons.ts`, die Farben in `noir.ts`.
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

/** Feines Papierkorn: winzige helle und dunkle Punkte. */
export function grain(context: Ctx, width: number, height: number, count: number, random: () => number): void {
  for (let i = 0; i < count; i += 1) {
    context.fillStyle = random() < 0.5 ? "rgba(29,28,25,0.07)" : "rgba(255,248,225,0.09)";
    context.fillRect(random() * width, random() * height, 1 + random() * 1.6, 1 + random() * 1.6);
  }
}

function paintArena(context: Ctx): void {
  const wall = ARENA_WALL;
  const width = ARENA.width + wall * 2;
  const height = ARENA.height + wall * 2;
  const random = seeded(77);

  // Wiese: Salbei mit hellen und dunklen Flecken.
  context.fillStyle = "#a8b48c";
  context.fillRect(0, 0, width, height);
  for (let i = 0; i < 46; i += 1) {
    const x = wall + random() * ARENA.width;
    const y = wall + random() * ARENA.height;
    context.fillStyle = random() < 0.5 ? "rgba(214,222,184,0.35)" : "rgba(118,138,100,0.28)";
    context.beginPath();
    context.ellipse(x, y, 40 + random() * 90, 24 + random() * 50, random() * 3, 0, Math.PI * 2);
    context.fill();
  }
  // Lichtung in der Mitte.
  const clearing = context.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, 250);
  clearing.addColorStop(0, "rgba(240,228,200,0.42)");
  clearing.addColorStop(1, "rgba(240,228,200,0)");
  context.fillStyle = clearing;
  context.fillRect(wall, wall, ARENA.width, ARENA.height);

  // Ausgetretener Pfad: gestrichelter Ring.
  context.strokeStyle = "rgba(240,228,200,0.5)";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.setLineDash([2, 20]);
  context.beginPath();
  context.ellipse(width / 2, height / 2, 190, 120, 0, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  // Grasbueschel.
  context.lineCap = "round";
  for (let i = 0; i < 150; i += 1) {
    const x = wall + 6 + random() * (ARENA.width - 12);
    const y = wall + 8 + random() * (ARENA.height - 14);
    const tone = random();
    context.strokeStyle = tone < 0.5 ? "#6f8a5a" : tone < 0.8 ? "#869c6c" : "#5d6a2f";
    context.lineWidth = 1.8;
    for (let k = -1; k <= 1; k += 1) {
      context.beginPath();
      context.moveTo(x + k * 2.2, y);
      context.lineTo(x + k * 4.5, y - 5 - random() * 4);
      context.stroke();
    }
  }
  // Kleine Blumen.
  for (let i = 0; i < 26; i += 1) {
    const x = wall + 10 + random() * (ARENA.width - 20);
    const y = wall + 10 + random() * (ARENA.height - 20);
    context.fillStyle = random() < 0.5 ? NOIR.amber : NOIR.blood;
    context.beginPath();
    context.arc(x, y, 2.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = NOIR.bone;
    context.beginPath();
    context.arc(x, y, 0.9, 0, Math.PI * 2);
    context.fill();
  }
  // Flache Steine.
  for (let i = 0; i < 22; i += 1) {
    const x = wall + 12 + random() * (ARENA.width - 24);
    const y = wall + 12 + random() * (ARENA.height - 24);
    const rx = 3 + random() * 6;
    context.fillStyle = "#8d9a8c";
    context.beginPath();
    context.ellipse(x, y, rx, rx * 0.65, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#b7c1b0";
    context.beginPath();
    context.ellipse(x - rx * 0.2, y - rx * 0.2, rx * 0.65, rx * 0.35, 0, 0, Math.PI * 2);
    context.fill();
  }
  grain(context, width, height, 5200, random);

  // Waldrand: dunkler Streifen, davor dichte Baumkronen, die ein Stueck in die Wiese ragen.
  const forest = NOIR.steel0;
  const back = "#1b2527";
  const light = NOIR.steel1;
  context.fillStyle = back;
  context.fillRect(0, 0, width, wall);
  context.fillRect(0, height - wall, width, wall);
  context.fillRect(0, 0, wall, height);
  context.fillRect(width - wall, 0, wall, height);
  const crown = (x: number, y: number, r: number): void => {
    context.fillStyle = back;
    context.beginPath();
    context.arc(x, y + 1.5, r + 1.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = forest;
    context.beginPath();
    context.arc(x, y, r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = light;
    context.beginPath();
    context.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, Math.PI * 2);
    context.fill();
  };
  for (let x = 0; x < width + 14; x += 11 + random() * 6) {
    crown(x, wall - 1 + random() * 4, 8 + random() * 7);
    crown(x + 5, height - wall + 1 - random() * 4, 8 + random() * 7);
  }
  for (let y = wall; y < height - wall + 6; y += 11 + random() * 6) {
    crown(wall - 1 + random() * 4, y, 8 + random() * 7);
    crown(width - wall + 1 - random() * 4, y + 4, 8 + random() * 7);
  }
  // Aeusserer Streifen bleibt geschlossen dunkel.
  context.fillStyle = back;
  context.fillRect(0, 0, width, 5);
  context.fillRect(0, height - 5, width, 5);
  context.fillRect(0, 0, 5, height);
  context.fillRect(width - 5, 0, 5, height);
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

/** Hinter der Arena: Daemmerung mit Nebelbergen. */
function createGameBackground(scene: Phaser.Scene): void {
  const width = 1600;
  const height = 540;
  const target = canvasOf(width, height);
  if (!target) {
    return;
  }
  const { context } = target;
  const random = seeded(31);
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#35585e");
  gradient.addColorStop(1, "#1d2a2c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  for (const [base, color, amp] of [[420, "#3f6a70", 120], [480, "#2f4d52", 90], [540, "#20353a", 60]] as const) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, height);
    for (let x = 0; x <= width; x += 40) {
      context.lineTo(x, base - random() * amp - 20);
    }
    context.lineTo(width, height);
    context.closePath();
    context.fill();
  }
  grain(context, width, height, 4000, random);
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
  context.fillStyle = "rgba(29,28,25,0.25)";
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

  // Dornenring wie ein Heiligenschein hinter dem Schriftzug.
  context.save();
  context.translate(width / 2 + 180, 62);
  context.rotate(-0.12);
  context.beginPath();
  for (let i = 0; i <= 64; i += 1) {
    const a = (i / 64) * Math.PI * 2;
    const spike = i % 2 === 0 ? 1.08 : 1;
    const x = Math.cos(a) * 150 * spike;
    const y = Math.sin(a) * 34 * spike;
    if (i === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.lineWidth = 4;
  context.strokeStyle = "rgba(29,28,25,0.8)";
  context.stroke();
  context.restore();

  // Schriftzug: breite Grossbuchstaben, Creme mit dunklem Versatzschatten.
  context.save();
  context.translate(width / 2, 150);
  context.rotate(-0.012);
  let fontSize = 180;
  const family = `900 FONTpx "Arial Black", "Segoe UI Black", Impact, system-ui, sans-serif`;
  context.font = family.replace("FONT", String(fontSize));
  const spacing = 6;
  if ("letterSpacing" in context) {
    (context as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
  }
  while (context.measureText("HOLDOUT").width > 720 && fontSize > 80) {
    fontSize -= 4;
    context.font = family.replace("FONT", String(fontSize));
  }
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(29,28,25,0.85)";
  context.fillText("HOLDOUT", 7, 9);
  context.strokeStyle = NOIR.ink;
  context.lineWidth = 7;
  context.strokeText("HOLDOUT", 0, 0);
  context.fillStyle = NOIR.bone;
  context.fillText("HOLDOUT", 0, 0);
  // Papierkorn und Abrieb.
  context.save();
  context.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 700; i += 1) {
    context.fillStyle = random() < 0.5 ? "rgba(29,28,25,0.12)" : "rgba(168,122,28,0.14)";
    context.fillRect((random() - 0.5) * 760, (random() - 0.5) * fontSize, 1.5, 1.5);
  }
  context.restore();
  context.restore();

  // Unterzeile mit zwei Strichen, in Senfgelb.
  context.save();
  context.translate(width / 2, 272);
  context.strokeStyle = NOIR.amber;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-330, 0);
  context.lineTo(-200, 0);
  context.moveTo(200, 0);
  context.lineTo(330, 0);
  context.stroke();
  context.font = `800 26px "Arial Black", system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  if ("letterSpacing" in context) {
    (context as unknown as { letterSpacing: string }).letterSpacing = "6px";
  }
  context.fillStyle = "rgba(29,28,25,0.8)";
  context.fillText("ÜBERLEBE 20 WELLEN", 2, 3);
  context.fillStyle = NOIR.amber;
  context.fillText("ÜBERLEBE 20 WELLEN", 0, 0);
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
