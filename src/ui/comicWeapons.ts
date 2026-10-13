/**
 * Die Waffen als Bilder (96 x 96), im gleichen gemalten Stil wie die Figuren.
 *
 * Jede Waffe passt zu einem Helden: Langschwert und Axt fuer den Ritter,
 * Kriegshammer fuer den Zwerg, Boegen fuer die Elfe, Dolche fuer den Schurken,
 * Feuerstaebe fuer die Magierin, Blitz- und Froststab fuer den Zauberer.
 * Gezeichnet waagerecht nach rechts (100er-Raster), dann leicht schraeg gestellt;
 * zum Schluss bekommen alle den gleichen dunklen Aussenumriss wie die Figuren.
 */

import type Phaser from "phaser";
import { weaponIconKey } from "../config/assets";
import type { WeaponId } from "../game/types";
import { inkify } from "./comicFigures";
import { type Ctx, ell, fill, gloss, grainOver, line, P, part, rect, tube } from "./figures/kit";

/** Kontur der Waffen: kraeftiger als bei den Figuren, weil die Bilder klein erscheinen. */
const W = 2.4;

const WOOD = ["#9a6236", "#6b4228"] as const;
const DARK_WOOD = ["#6b4228", "#4a2c18"] as const;
const STEEL = ["#d3d8de", "#8f9aa6"] as const;
const GOLD = ["#f0b23e", "#c27f1d"] as const;
const LEATHER = ["#6e4b2e", "#4a2f1c"] as const;

type Pair = readonly [string, string];

/** Ein Stab oder Stiel von (x1, y1) nach (x2, y2). */
function staff(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: Pair = WOOD, width = 7): void {
  tube(ctx, `M ${x1} ${y1} L ${x2} ${y2}`, width, color[0], color[1], W);
}

/** Leuchtschein hinter einem Zauberkristall oder einer Flamme. */
function glow(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Klinge nach rechts: Wurzel bei x, Spitze bei x + length. */
function blade(ctx: Ctx, x: number, y: number, length: number, width: number): void {
  const h = width / 2;
  const shape = P(`M ${x} ${y - h} L ${x + length - width * 0.8} ${y - h * 0.92} L ${x + length} ${y} L ${x + length - width * 0.8} ${y + h * 0.92} L ${x} ${y + h} Z`);
  part(ctx, shape, { base: STEEL[0], shade: STEEL[1], dx: 0, dy: h * 0.7, line: W });
  line(ctx, `M ${x + 3} ${y + 0.4} L ${x + length - width} ${y + 0.4}`, 1.4, "rgba(110,120,132,0.9)");
  gloss(ctx, x + length * 0.45, y - h * 0.45, length * 0.25, 0.9, 0.7, 0);
}

/** Schwert mit Parierstange und Griff; `grip` = Farbe der Wicklung. */
function sword(ctx: Ctx, x: number, y: number, length: number, width: number, grip: Pair, guard = 26): void {
  blade(ctx, x, y, length, width);
  part(ctx, rect(x - 6, y - guard / 2, 7, guard, 2.4), { base: GOLD[0], shade: GOLD[1], dx: 1, dy: 1.4, line: W });
  part(ctx, rect(x - 24, y - 4.6, 19, 9.2, 3), { base: grip[0], shade: grip[1], dx: 0.6, dy: 1.4, line: W });
  for (let gx = x - 21; gx < x - 7; gx += 4.4) {
    line(ctx, `M ${gx} ${y - 4} L ${gx + 2} ${y + 4}`, 1, "rgba(20,14,12,0.5)");
  }
  part(ctx, ell(x - 27, y, 5, 5), { base: GOLD[0], shade: GOLD[1], dx: 0.8, dy: 1, line: W });
}

function bow(ctx: Ctx, x: number, top: number, bottom: number, bend: number, wood: Pair): void {
  const mid = (top + bottom) / 2;
  line(ctx, `M ${x} ${top} L ${x} ${bottom}`, 1.8, "#f4e4c1");
  const limb = P(`M ${x} ${top} Q ${x + bend} ${mid} ${x} ${bottom} Q ${x + bend - 8} ${mid} ${x} ${top} Z`);
  part(ctx, limb, { base: wood[0], shade: wood[1], dx: -1.2, dy: 0, line: W });
  part(ctx, rect(x + bend / 2 - 5.6, mid - 6, 7, 12, 2), { base: LEATHER[0], shade: LEATHER[1], dx: 0.6, dy: 1, line: W * 0.8 });
}

function arrow(ctx: Ctx, x1: number, x2: number, y: number): void {
  tube(ctx, `M ${x1} ${y} L ${x2} ${y}`, 2.6, "#d2ae72", "#9c7a45", W * 0.8);
  part(ctx, P(`M ${x2 - 1} ${y - 5} L ${x2 + 10} ${y} L ${x2 - 1} ${y + 5} Z`), { base: STEEL[0], shade: STEEL[1], dx: 0, dy: 1.6, line: W });
  part(ctx, P(`M ${x1 - 3} ${y - 6} L ${x1 + 8} ${y - 0.6} L ${x1 + 8} ${y + 0.6} L ${x1 - 3} ${y + 6} L ${x1 + 1} ${y} Z`), { base: "#d9533f", shade: "#a33a2b", dx: 0, dy: 1, line: W * 0.8 });
}

/** Funkelnder Stern (Funken, Magie). */
function spark(ctx: Ctx, x: number, y: number, r: number, color = "#ffd04a"): void {
  glow(ctx, x, y, r * 1.6, "rgba(255,210,100,0.7)");
  const s = P(`M ${x} ${y - r} L ${x + r * 0.28} ${y - r * 0.28} L ${x + r} ${y} L ${x + r * 0.28} ${y + r * 0.28} L ${x} ${y + r} L ${x - r * 0.28} ${y + r * 0.28} L ${x - r} ${y} L ${x - r * 0.28} ${y - r * 0.28} Z`);
  part(ctx, s, { base: color, line: W * 0.8 });
}

function flame(ctx: Ctx, x: number, y: number, s: number): void {
  glow(ctx, x, y - s * 0.2, s * 1.8, "rgba(255,160,60,0.7)");
  const outer = P(
    `M ${x} ${y + s * 0.9} Q ${x - s} ${y + s * 0.6} ${x - s * 0.8} ${y - s * 0.2} Q ${x - s * 0.6} ${y - s * 0.8} ${x - s * 0.2} ${y - s * 1.3} ` +
      `Q ${x - s * 0.1} ${y - s * 0.7} ${x + s * 0.3} ${y - s * 0.7} Q ${x + s * 0.2} ${y - s * 1.2} ${x + s * 0.6} ${y - s * 1.5} ` +
      `Q ${x + s * 1.1} ${y - s * 0.6} ${x + s * 0.9} ${y + s * 0.2} Q ${x + s * 0.7} ${y + s * 0.85} ${x} ${y + s * 0.9} Z`,
  );
  part(ctx, outer, { base: "#ffae3b", shade: "#e8602b", dx: 0, dy: -s * 0.25, line: W });
  fill(ctx, P(`M ${x} ${y + s * 0.6} Q ${x - s * 0.5} ${y + s * 0.3} ${x - s * 0.25} ${y - s * 0.3} Q ${x} ${y - s * 0.1} ${x + s * 0.2} ${y - s * 0.5} Q ${x + s * 0.6} ${y} ${x + s * 0.4} ${y + s * 0.35} Q ${x + s * 0.25} ${y + s * 0.6} ${x} ${y + s * 0.6} Z`), "#ffe58a");
}

function drawShape(ctx: Ctx, id: WeaponId): void {
  switch (id) {
    case "pistol": {
      // Kurzbogen mit aufgelegtem Pfeil
      bow(ctx, 40, 20, 80, 22, WOOD);
      arrow(ctx, 22, 76, 50);
      break;
    }
    case "smg": {
      // Wurfdolche: drei kleine Klingen im Faecher
      for (const [dy, angle] of [[-15, -0.4], [15, 0.4], [0, 0]] as const) {
        ctx.save();
        ctx.translate(46, 50 + dy);
        ctx.rotate(angle);
        ctx.translate(-46, -50);
        blade(ctx, 46, 50, 30, 9);
        part(ctx, rect(40.5, 44, 6, 12, 1.6), { base: GOLD[0], shade: GOLD[1], dx: 0.6, dy: 1, line: W });
        part(ctx, rect(26, 46.5, 15, 7, 2.4), { base: "#4a3f5a", shade: "#2f283c", dx: 0.4, dy: 1, line: W });
        ctx.restore();
      }
      break;
    }
    case "shotgun": {
      // Funkenfaecher: kurzer Stab, vorne drei Funken
      staff(ctx, 12, 62, 54, 46, ["#8a3a2a", "#5e2418"]);
      part(ctx, ell(57, 45, 7, 7), { base: "#ff8a3a", shade: "#d9542a", dx: 1, dy: 1.4, line: W });
      gloss(ctx, 55, 43, 2.4, 1.4, 0.7);
      spark(ctx, 77, 28, 7.5);
      spark(ctx, 84, 46, 7.5);
      spark(ctx, 76, 63, 7.5);
      break;
    }
    case "sniper": {
      // Langbogen: gross, dunkles Holz mit goldenen Spitzen
      bow(ctx, 38, 10, 90, 30, DARK_WOOD);
      part(ctx, P("M 35 5 L 43 11 L 36 14 Z"), { base: GOLD[0], line: W * 0.8 });
      part(ctx, P("M 35 95 L 43 89 L 36 86 Z"), { base: GOLD[0], line: W * 0.8 });
      arrow(ctx, 12, 82, 50);
      break;
    }
    case "fist": {
      // Axt: Holzstiel, breite Stahlklinge
      staff(ctx, 16, 84, 60, 16);
      const head = P("M 50 22 Q 70 6 86 20 Q 80 34 86 50 Q 68 50 54 40 Z");
      part(ctx, head, { base: STEEL[0], shade: STEEL[1], dx: 2, dy: 2, line: W });
      line(ctx, "M 81 22 Q 77 35 81 47", 2, "#ffffff");
      part(ctx, rect(46, 20, 12, 22, 2.6), { base: DARK_WOOD[0], shade: DARK_WOOD[1], dx: 0.8, dy: 1, line: W });
      for (const y of [25, 37]) {
        part(ctx, ell(52, y, 1.6, 1.6), { base: "#c2c5c8", line: 1 });
      }
      break;
    }
    case "knife": {
      // Dolch: kurze Klinge, Goldparierstange, lila Griff
      blade(ctx, 46, 50, 38, 13);
      part(ctx, rect(40, 37, 7, 26, 2.4), { base: GOLD[0], shade: GOLD[1], dx: 0.8, dy: 1.2, line: W });
      part(ctx, rect(21, 45, 20, 10, 3), { base: "#5a3f7a", shade: "#3f2a5a", dx: 0.6, dy: 1.4, line: W });
      part(ctx, ell(18, 50, 5, 5), { base: GOLD[0], shade: GOLD[1], dx: 0.6, dy: 1, line: W });
      break;
    }
    case "spear": {
      // Langschwert: lange Klinge, breite Parierstange, blauer Griff
      sword(ctx, 36, 50, 54, 13, ["#3f5f9e", "#2b4374"], 30);
      break;
    }
    case "crossbow": {
      // Armbrust: Schaft, querliegender Bogen, Bolzen
      part(ctx, P("M 8 52 L 22 45 L 66 45 L 66 55 L 24 55 L 11 62 Z"), { base: WOOD[0], shade: WOOD[1], dx: 0, dy: 1.6, line: W });
      line(ctx, "M 64 18 L 55 50 L 64 82", 1.8, "#f4e4c1");
      const limb = P("M 64 18 Q 78 50 64 82 Q 70 50 64 18 Z");
      part(ctx, limb, { base: "#8f9aa6", shade: "#6a7480", dx: -1, dy: 0, line: W });
      arrow(ctx, 30, 84, 50);
      part(ctx, rect(36, 55, 7, 11, 1.8), { base: DARK_WOOD[0], shade: DARK_WOOD[1], dx: 0.4, dy: 0.8, line: W });
      break;
    }
    case "rocket": {
      // Feuerkugel-Stab: goldene Krallen halten eine gluehende Kugel
      staff(ctx, 10, 82, 58, 34, ["#6a2a1c", "#4a1a10"]);
      glow(ctx, 68, 25, 24, "rgba(255,140,60,0.75)");
      part(ctx, P("M 54 38 L 57 20 L 63 33 Z"), { base: GOLD[0], shade: GOLD[1], dx: 0.6, dy: 0.6, line: W * 0.9 });
      part(ctx, P("M 60 42 L 78 40 L 65 35 Z"), { base: GOLD[0], shade: GOLD[1], dx: 0.6, dy: 0.6, line: W * 0.9 });
      part(ctx, ell(68, 26, 11.5, 11.5), { base: "#ff8a3a", shade: "#d9542a", dx: 2, dy: 2, line: W });
      fill(ctx, ell(65, 23, 5, 5), "#ffd04a");
      gloss(ctx, 63, 20, 2.2, 1.4, 0.85);
      break;
    }
    case "flamer": {
      // Flammenstab: Stab mit Flamme an der Spitze
      staff(ctx, 10, 82, 60, 34, ["#8a3a2a", "#5e2418"]);
      part(ctx, rect(52, 30, 13, 9, 2.4), { base: GOLD[0], shade: GOLD[1], dx: 0.6, dy: 1, line: W });
      flame(ctx, 68, 20, 12);
      break;
    }
    case "wand": {
      // Blitzstab: Stab mit blauem Kristall und Blitzen
      staff(ctx, 10, 84, 58, 36, ["#5a3f7a", "#3f2a5a"]);
      glow(ctx, 66, 24, 24, "rgba(140,210,255,0.8)");
      part(ctx, P("M 66 5 L 77 23 L 66 42 L 55 23 Z"), { base: "#9fdcff", shade: "#5fb4e8", dx: 2, dy: 1, line: W });
      gloss(ctx, 63, 18, 2, 5, 0.75, 0.3);
      for (const d of ["M 80 8 L 87 14 L 82 16 L 91 25", "M 45 12 L 52 17 L 47 19 L 54 26"]) {
        line(ctx, d, 4.6, "#2a201b");
        line(ctx, d, 2, "#ffe27a");
      }
      break;
    }
    case "hammer": {
      // Kriegshammer: dicker Stahlkopf mit Goldband
      staff(ctx, 16, 84, 58, 32);
      part(ctx, rect(40, 6, 44, 33, 5), { base: STEEL[0], shade: STEEL[1], dx: 2, dy: 2.4, line: W });
      part(ctx, rect(56.5, 3.5, 11, 38, 2.4), { base: GOLD[0], shade: GOLD[1], dx: 1, dy: 1.6, line: W });
      for (const [x, y] of [[46, 12], [78, 12], [46, 33], [78, 33]] as const) {
        part(ctx, ell(x, y, 2.2, 2.2), { base: "#a8b0ba", line: 1.2 });
      }
      gloss(ctx, 48, 16, 4, 1.6, 0.6, 0);
      break;
    }
    case "frost": {
      // Froststab: heller Stab, Eiskristall mit Zacken
      staff(ctx, 10, 84, 58, 36, ["#9fb8c8", "#6f8a9c"]);
      glow(ctx, 66, 24, 24, "rgba(190,235,255,0.85)");
      for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
        const dx = Math.cos(a) * 17;
        const dy = Math.sin(a) * 17;
        tube(ctx, `M ${66 - dx} ${24 - dy} L ${66 + dx} ${24 + dy}`, 3.6, "#e2f6ff", "#9fd2ee", W * 0.9);
      }
      part(ctx, P("M 66 13 L 73 24 L 66 35 L 59 24 Z"), { base: "#c4ecff", shade: "#7cc0e8", dx: 1.2, dy: 0.6, line: W });
      break;
    }
  }
}

/** Malt eine Waffe in ein 96 x 96 grosses Feld, leicht schraeg gestellt. */
export function drawWeapon(ctx: Ctx, id: WeaponId): void {
  ctx.save();
  ctx.translate(48, 48);
  ctx.rotate(-0.38);
  ctx.scale(0.84, 0.84);
  ctx.translate(-50, -50);
  drawShape(ctx, id);
  ctx.restore();
}

export const WEAPON_ORDER: readonly WeaponId[] = [
  "pistol",
  "smg",
  "shotgun",
  "sniper",
  "fist",
  "knife",
  "spear",
  "crossbow",
  "rocket",
  "flamer",
  "wand",
  "hammer",
  "frost",
];

/** Malt alle Waffensymbole als Texturen. Mehrfach aufrufen ist harmlos. */
export function createWeaponTextures(scene: Phaser.Scene): void {
  for (const id of WEAPON_ORDER) {
    const key = weaponIconKey(id);
    if (scene.textures.exists(key)) {
      continue;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      continue;
    }
    drawWeapon(ctx, id);
    grainOver(ctx, 96, 96, 0.05);
    scene.textures.addCanvas(key, inkify(canvas, 1.6))?.setFilter(1);
  }
}
