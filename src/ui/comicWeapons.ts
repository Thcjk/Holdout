/**
 * Waffen: alle sieben als gezeichnete Symbole (96 x 96), dunkler Stahl mit
 * Bernstein-Akzent. Sie zeigen nach rechts und stehen leicht schraeg.
 */

import type Phaser from "phaser";
import { weaponIconKey } from "../config/assets";
import type { WeaponId } from "../game/types";
import { ellipse, inkify, polygon, shape, shine, star, stroke } from "./comicFigures";
import { NOIR } from "./noir";

type Ctx = CanvasRenderingContext2D;

export interface WeaponStyle {
  body: string;
  bodyDark: string;
  accent: string;
  grip: string;
  metal: string;
  round: number;
  line: number;
  burst: boolean;
  rivets: boolean;
  sparkle: boolean;
}

/** Dunkler Stahl, Holzgriff, Bernstein als einzige Farbe. */
export const WEAPON_STYLE: WeaponStyle = {
  body: NOIR.steel2,
  bodyDark: NOIR.steel0,
  accent: NOIR.amber,
  grip: "#6b4228",
  metal: "#c9c6b4",
  round: 2,
  line: 4.5,
  burst: false,
  rivets: true,
  sparkle: false,
};

function box(ctx: Ctx, s: WeaponStyle, x: number, y: number, w: number, h: number, fill: string, dark?: string, r = s.round): void {
  shape(ctx, () => ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2)), fill, s.line);
  if (dark) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2));
    ctx.clip();
    ctx.fillStyle = dark;
    ctx.fillRect(x - 2, y + h * 0.62, w + 4, h);
    ctx.fillStyle = "rgba(240,228,200,0.35)";
    ctx.fillRect(x + 2, y + 2, w - 4, Math.max(1.5, h * 0.1));
    ctx.restore();
  }
}

function rivets(ctx: Ctx, s: WeaponStyle, points: readonly (readonly [number, number])[]): void {
  if (!s.rivets) {
    return;
  }
  for (const [x, y] of points) {
    ellipse(ctx, x, y, 1.6, 1.6, "#2a2f3a", 1.5);
  }
}

function drawShape(ctx: Ctx, id: WeaponId, s: WeaponStyle): void {
  switch (id) {
    case "pistol": {
      box(ctx, s, 28, 44, 15, 26, s.grip, "rgba(0,0,0,0.25)");
      box(ctx, s, 22, 30, 52, 17, s.body, s.bodyDark);
      box(ctx, s, 70, 33, 14, 11, s.accent);
      stroke(ctx, [[44, 48], [44, 53], [50, 53], [50, 48]], 3);
      rivets(ctx, s, [[30, 38], [60, 38]]);
      break;
    }
    case "smg": {
      box(ctx, s, 36, 46, 11, 26, s.accent);
      box(ctx, s, 4, 36, 16, 13, s.grip);
      box(ctx, s, 16, 30, 56, 18, s.body, s.bodyDark);
      box(ctx, s, 70, 34, 20, 8, s.metal);
      box(ctx, s, 26, 26, 14, 6, s.accent);
      box(ctx, s, 54, 46, 8, 14, s.grip);
      rivets(ctx, s, [[24, 40], [48, 40], [62, 40]]);
      break;
    }
    case "shotgun": {
      polygon(ctx, [[4, 44], [34, 38], [38, 52], [10, 58]], s.grip, s.line);
      box(ctx, s, 30, 36, 62, 8, s.metal);
      box(ctx, s, 30, 44, 56, 8, s.metal);
      box(ctx, s, 40, 42, 22, 14, s.body, s.bodyDark);
      box(ctx, s, 28, 38, 14, 15, s.accent);
      rivets(ctx, s, [[46, 49], [56, 49]]);
      break;
    }
    case "sniper": {
      polygon(ctx, [[2, 46], [20, 42], [22, 54], [6, 58]], s.grip, s.line);
      box(ctx, s, 16, 40, 34, 13, s.body, s.bodyDark);
      box(ctx, s, 46, 44, 46, 6, s.metal);
      box(ctx, s, 28, 28, 34, 10, s.accent);
      ellipse(ctx, 63, 33, 5, 6, "#bff3ff", 3.5);
      stroke(ctx, [[50, 52], [44, 66]], 3.5);
      stroke(ctx, [[56, 52], [62, 66]], 3.5);
      rivets(ctx, s, [[24, 47], [40, 47]]);
      break;
    }
    case "fist": {
      box(ctx, s, 8, 36, 22, 26, s.accent);
      ellipse(ctx, 50, 48, 28, 24, "#9c2229");
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(50, 48, 28, 24, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#5e1216";
      ctx.fillRect(20, 58, 70, 30);
      ctx.restore();
      shine(ctx, 50, 48, 28, 24);
      ellipse(ctx, 52, 30, 12, 9, "#9c2229", s.line);
      stroke(ctx, [[52, 42], [76, 44]], 3);
      stroke(ctx, [[48, 54], [76, 54]], 3);
      break;
    }
    case "knife": {
      polygon(ctx, [[34, 34], [90, 40], [40, 54]], s.metal, s.line);
      stroke(ctx, [[40, 40], [78, 42]], 3, s.accent);
      box(ctx, s, 26, 30, 10, 30, s.accent);
      box(ctx, s, 6, 38, 24, 14, s.grip);
      ellipse(ctx, 6, 45, 5, 5, s.body, s.line - 1);
      break;
    }
    case "crossbow": {
      // Schaft, quer der Bogen mit Sehne, ein Bolzen aufgelegt
      polygon(ctx, [[4, 46], [24, 42], [26, 54], [8, 58]], s.grip, s.line);
      box(ctx, s, 20, 42, 52, 9, s.body, s.bodyDark);
      stroke(ctx, [[60, 22], [52, 46], [60, 72]], 6, "#14101c");
      stroke(ctx, [[60, 22], [52, 46], [60, 72]], 3, "#6b4228");
      stroke(ctx, [[60, 22], [40, 46], [60, 72]], 1.4, "#14101c");
      stroke(ctx, [[30, 46], [84, 46]], 2.4, "#14101c");
      polygon(ctx, [[84, 42], [92, 46], [84, 50]], s.metal, 2);
      break;
    }
    case "rocket": {
      // dickes Rohr mit Rakete vorne
      box(ctx, s, 10, 36, 64, 18, s.body, s.bodyDark, 6);
      box(ctx, s, 34, 54, 10, 14, s.grip);
      box(ctx, s, 24, 30, 12, 6, s.accent);
      polygon(ctx, [[74, 38], [88, 45], [74, 52]], "#b5532f", s.line);
      ellipse(ctx, 10, 45, 4, 9, "#2a2f3a", 2);
      rivets(ctx, s, [[20, 42], [62, 42]]);
      break;
    }
    case "flamer": {
      // Tank, Rohr und eine Stichflamme
      ellipse(ctx, 20, 52, 12, 12, "#b5532f", s.line);
      box(ctx, s, 26, 38, 38, 12, s.body, s.bodyDark);
      box(ctx, s, 62, 41, 14, 6, s.metal);
      polygon(ctx, [[76, 36], [94, 44], [76, 52], [82, 44]], "#e8862a", 2.5);
      polygon(ctx, [[78, 40], [88, 44], [78, 48]], "#f6d36b", 1.2);
      stroke(ctx, [[22, 41], [30, 41]], 3, "#14101c");
      break;
    }
    case "wand": {
      // Holzstab mit Kristall und Funken
      stroke(ctx, [[10, 72], [64, 26]], 8, "#14101c");
      stroke(ctx, [[10, 72], [64, 26]], 4.5, "#6b4228");
      polygon(ctx, [[62, 14], [76, 22], [70, 36], [56, 28]], "#9fd8e8", s.line);
      stroke(ctx, [[80, 12], [86, 6]], 2.4, s.accent);
      stroke(ctx, [[84, 26], [92, 26]], 2.4, s.accent);
      stroke(ctx, [[70, 6], [72, -1]], 2.4, s.accent);
      break;
    }
    case "hammer": {
      // langer Stiel, schwerer Kopf
      stroke(ctx, [[14, 74], [60, 30]], 8, "#14101c");
      stroke(ctx, [[14, 74], [60, 30]], 4.5, "#6b4228");
      box(ctx, s, 46, 12, 30, 30, s.body, s.bodyDark, 4);
      box(ctx, s, 44, 22, 34, 8, s.accent, undefined, 2);
      rivets(ctx, s, [[52, 17], [70, 17], [52, 36], [70, 36]]);
      break;
    }
    case "frost": {
      // heller Stab mit Eiskristall
      stroke(ctx, [[10, 72], [62, 28]], 8, "#14101c");
      stroke(ctx, [[10, 72], [62, 28]], 4.5, "#9fb8b3");
      for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
        stroke(ctx, [[68 - Math.cos(a) * 14, 22 - Math.sin(a) * 14], [68 + Math.cos(a) * 14, 22 + Math.sin(a) * 14]], 6, "#14101c");
        stroke(ctx, [[68 - Math.cos(a) * 14, 22 - Math.sin(a) * 14], [68 + Math.cos(a) * 14, 22 + Math.sin(a) * 14]], 3, "#bfe4f0");
      }
      ellipse(ctx, 68, 22, 4, 4, "#ffffff", 2);
      break;
    }
    case "spear": {
      stroke(ctx, [[6, 54], [74, 42]], 9, "#14101c");
      stroke(ctx, [[6, 54], [74, 42]], 4.5, s.grip);
      polygon(ctx, [[70, 32], [94, 40], [72, 54]], s.metal, s.line);
      stroke(ctx, [[74, 40], [86, 41]], 3, s.accent);
      polygon(ctx, [[22, 49], [14, 38], [34, 46]], s.accent, s.line - 2);
      break;
    }
  }
}

/** Malt eine Waffe in ein 96 x 96 grosses Feld, mit Stil und leichter Schraeglage. */
export function drawWeapon(ctx: Ctx, id: WeaponId, s: WeaponStyle = WEAPON_STYLE): void {
  if (s.burst) {
    star(ctx, 48, 48, 46, 31, 12, "#ff7a3c", 4);
    star(ctx, 48, 48, 36, 25, 12, "#fff27a", 0.1);
  }
  ctx.save();
  ctx.translate(48, 48);
  ctx.rotate(-0.38);
  ctx.translate(-48, -48);
  drawShape(ctx, id, s);
  ctx.restore();
  if (s.sparkle) {
    star(ctx, 80, 18, 7, 2.4, 4, "#ffffff", 3);
    star(ctx, 14, 78, 5, 1.8, 4, "#ffffff", 2.5);
  }
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

/** Malt die sieben Waffensymbole als Texturen. Mehrfach aufrufen ist harmlos. */
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
    ctx.translate(48, 48);
    ctx.scale(0.88, 0.88);
    ctx.translate(-48, -48);
    drawWeapon(ctx, id);
    scene.textures.addCanvas(key, inkify(canvas, key, false, 1.8))?.setFilter(1);
  }
}
