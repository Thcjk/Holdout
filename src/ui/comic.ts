/**
 * Die gemalten Texturen der Welt: Burghof (Arena), Hintergrund, Geschosse,
 * Goldmuenze, Herz und das Wappen-Logo.
 *
 * Die Welt: "Die Feste Holdout" - eine Burg im schieferblauen Grauland. Die
 * Helden verteidigen den Burghof gegen Monsterwellen, die durch das Tor in der
 * Burgmauer hereinbrechen. Der Hof selbst wird in `arena.ts` gemalt.
 *
 * Alles wird einmal auf Leinwaende gemalt (feste Startwerte, damit es bei
 * jedem Start gleich aussieht). Figuren: `comicFigures.ts`, Waffen: `comicWeapons.ts`.
 */

import type Phaser from "phaser";
import { arenaKey } from "../config/assets";
import { ARENA } from "../game/constants";
import { ARENA_WALL, arenaGrain, paintArena } from "./arena";
import { createFigureTextures } from "./comicFigures";
import { createWeaponTextures } from "./comicWeapons";
import { LOGO_HEIGHT, LOGO_WIDTH, paintLogo } from "./logo";

export { ARENA_WALL };

type Ctx = CanvasRenderingContext2D;

const INK = "#2b2320";
const GOLD = "#f0b23e";
const GOLD_DARK = "#c9851f";

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

/** Form fuellen, Schatten unten rechts, Kontur - wie bei den Figuren. */
function cel(c: Ctx, build: () => void, base: string, dark: string, d = 3, line = 2.4): void {
  c.beginPath();
  build();
  c.fillStyle = dark;
  c.fill();
  c.save();
  c.beginPath();
  build();
  c.clip();
  c.translate(-d, -d);
  c.beginPath();
  build();
  c.fillStyle = base;
  c.fill();
  c.restore();
  c.beginPath();
  build();
  c.lineJoin = "round";
  c.lineWidth = line;
  c.strokeStyle = INK;
  c.stroke();
}

// --- Burghof ---------------------------------------------------------------------

/** Kopfsteinpflaster: Reihen unregelmaessiger, gerundeter Steine. */
function createArena(scene: Phaser.Scene): void {
  const scale = 2;
  const wall = ARENA_WALL;
  const target = canvasOf((ARENA.width + wall * 2) * scale, (ARENA.height + wall * 2) * scale);
  if (!target) {
    return;
  }
  target.context.scale(scale, scale);
  paintArena(target.context);
  arenaGrain(target.context, target.canvas.width, target.canvas.height);
  addTexture(scene, arenaKey, target.canvas);
}

/** Hinter der Arena: Schieferblau mit dunkleren Raendern. */
function createGameBackground(scene: Phaser.Scene): void {
  const width = 1600;
  const height = 540;
  const target = canvasOf(width, height);
  if (!target) {
    return;
  }
  const { context } = target;
  const gradient = context.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, width * 0.6);
  gradient.addColorStop(0, "#56667a");
  gradient.addColorStop(1, "#38434f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  addTexture(scene, "bg-game", target.canvas);
}

// --- Kleinteile ------------------------------------------------------------------

/** Gegnergeschoss: lila Zauberkugel (wird im Spiel eingefaerbt). */
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
  context.arc(16, 16, 10, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.8)";
  context.beginPath();
  context.arc(12, 12, 3, 0, Math.PI * 2);
  context.fill();
  addTexture(scene, "bullet", target.canvas);
}

/**
 * Geschosse nach Aussehen (`Projectile.look`): 1 Pfeil, 2 Feuerkugel, 3 Flamme,
 * 4 Blitzfunke, 5 Eissplitter, 6 grosser Feuerball, 7 Dolch, 8 Funke.
 * Alle zeigen nach rechts.
 */
function createShotLooks(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (c: Ctx) => void): void => {
    const target = canvasOf(w, h);
    if (target) {
      draw(target.context);
      addTexture(scene, key, target.canvas);
    }
  };
  const glow = (c: Ctx, x: number, y: number, r: number, color: string): void => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };
  make("shot-1", 46, 14, (c) => {
    c.lineCap = "round";
    c.strokeStyle = INK;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(4, 7);
    c.lineTo(36, 7);
    c.stroke();
    c.strokeStyle = "#c9a66b";
    c.lineWidth = 2;
    c.stroke();
    cel(c, () => {
      c.moveTo(34, 2);
      c.lineTo(44, 7);
      c.lineTo(34, 12);
      c.closePath();
    }, "#dfe5ea", "#a8b1bc", 1, 1.6);
    cel(c, () => {
      c.moveTo(2, 2);
      c.lineTo(10, 7);
      c.lineTo(2, 12);
      c.closePath();
    }, "#d94a3a", "#a8322a", 1, 1.4);
  });
  make("shot-2", 30, 30, (c) => {
    glow(c, 15, 15, 15, "rgba(255,150,60,0.8)");
    cel(c, () => c.arc(15, 15, 8, 0, Math.PI * 2), "#ff8a3a", "#d9542a", 1.6, 2);
    c.fillStyle = "#ffe27a";
    c.beginPath();
    c.arc(13, 13, 3.4, 0, Math.PI * 2);
    c.fill();
  });
  make("shot-3", 28, 28, (c) => {
    const g = c.createRadialGradient(14, 14, 1, 14, 14, 13);
    g.addColorStop(0, "rgba(255,226,122,1)");
    g.addColorStop(0.5, "rgba(255,140,50,0.9)");
    g.addColorStop(1, "rgba(217,74,58,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 28, 28);
  });
  make("shot-4", 26, 26, (c) => {
    glow(c, 13, 13, 13, "rgba(160,220,255,0.8)");
    cel(c, () => {
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? 10 : 4;
        c.lineTo(13 + Math.cos(a) * r, 13 + Math.sin(a) * r);
      }
      c.closePath();
    }, "#e8f7ff", "#9fdcff", 1, 1.6);
  });
  make("shot-5", 28, 18, (c) => {
    cel(c, () => {
      c.moveTo(2, 9);
      c.lineTo(15, 2);
      c.lineTo(26, 9);
      c.lineTo(15, 16);
      c.closePath();
    }, "#d8f2ff", "#8fcbe8", 1.4, 2);
  });
  make("shot-6", 40, 40, (c) => {
    glow(c, 20, 20, 20, "rgba(255,120,50,0.85)");
    cel(c, () => c.arc(20, 20, 11, 0, Math.PI * 2), "#ff7a3a", "#d0442a", 2, 2.4);
    c.fillStyle = "#ffe27a";
    c.beginPath();
    c.arc(17, 17, 5, 0, Math.PI * 2);
    c.fill();
  });
  make("shot-7", 36, 16, (c) => {
    cel(c, () => {
      c.moveTo(12, 3);
      c.lineTo(30, 6);
      c.lineTo(35, 8);
      c.lineTo(30, 10);
      c.lineTo(12, 13);
      c.closePath();
    }, "#dfe5ea", "#a8b1bc", 1, 1.6);
    cel(c, () => c.roundRect(9, 2, 4, 12, 1), GOLD, GOLD_DARK, 0.6, 1.4);
    cel(c, () => c.roundRect(1, 5, 9, 6, 2), "#5a3f7a", "#3f2a5a", 0.6, 1.4);
  });
  make("shot-8", 22, 22, (c) => {
    glow(c, 11, 11, 11, "rgba(255,200,90,0.9)");
    cel(c, () => {
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? 8 : 3;
        c.lineTo(11 + Math.cos(a) * r, 11 + Math.sin(a) * r);
      }
      c.closePath();
    }, "#ffd04a", "#f09a2a", 1, 1.4);
  });
}

/** Das Material: eine Goldmuenze mit Kronen-Praegung. */
function createGem(scene: Phaser.Scene): void {
  const target = canvasOf(48, 48);
  if (!target) {
    return;
  }
  const c = target.context;
  cel(c, () => c.arc(24, 25, 18, 0, Math.PI * 2), GOLD, GOLD_DARK, 3, 3.4);
  c.beginPath();
  c.arc(23, 24, 12, 0, Math.PI * 2);
  c.strokeStyle = GOLD_DARK;
  c.lineWidth = 2;
  c.stroke();
  // kleine Krone
  c.fillStyle = GOLD_DARK;
  c.beginPath();
  c.moveTo(16, 28);
  c.lineTo(16, 19);
  c.lineTo(20, 23);
  c.lineTo(23, 17);
  c.lineTo(26, 23);
  c.lineTo(30, 19);
  c.lineTo(30, 28);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.beginPath();
  c.ellipse(16, 15, 4, 2.4, -0.7, 0, Math.PI * 2);
  c.fill();
  addTexture(scene, "gem", target.canvas);
}

/** Herz fuer die Lebensanzeige. */
function createHeart(scene: Phaser.Scene): void {
  const target = canvasOf(48, 48);
  if (!target) {
    return;
  }
  const c = target.context;
  cel(
    c,
    () => {
      c.moveTo(24, 42);
      c.bezierCurveTo(6, 31, 3, 18, 10, 11);
      c.bezierCurveTo(16, 5, 23, 9, 24, 15);
      c.bezierCurveTo(25, 9, 32, 5, 38, 11);
      c.bezierCurveTo(45, 18, 42, 31, 24, 42);
      c.closePath();
    },
    "#e2483b",
    "#b02f26",
    3,
    3.4,
  );
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.beginPath();
  c.ellipse(15, 16, 4, 2.6, -0.7, 0, Math.PI * 2);
  c.fill();
  addTexture(scene, "heart", target.canvas);
}

// --- Logo ------------------------------------------------------------------------

/**
 * Das Wappen-Logo: ein blauer Schild mit gekreuztem Schwert und Stab dahinter,
 * davor der Name in dicken goldenen Buchstaben, darunter ein rotes Banner
 * "DIE LETZTE FESTE".
 */
function createLogo(scene: Phaser.Scene): void {
  const target = canvasOf(LOGO_WIDTH, LOGO_HEIGHT);
  if (!target) {
    return;
  }
  paintLogo(target.context);
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
  createShotLooks(scene);
  createGem(scene);
  createHeart(scene);
  createLogo(scene);
}
