/**
 * Comic-Waffen: alle sieben Waffen als gezeichnete Symbole (96 x 96).
 *
 * Es gibt drei Stile zur Auswahl (`WEAPON_STYLES`). Die Waffen zeigen nach
 * rechts und werden leicht schraeg gestellt, wie ein Symbol im Comic.
 */

import type { WeaponId } from "../game/types";
import { ellipse, polygon, shape, shine, star, stroke } from "./comicFigures";

type Ctx = CanvasRenderingContext2D;

export interface WeaponStyle {
  name: string;
  body: string;
  bodyDark: string;
  accent: string;
  grip: string;
  metal: string;
  /** Rundung der Ecken. */
  round: number;
  /** Dicke der Kontur. */
  line: number;
  /** Zeichnet hinter die Waffe einen Knall-Stern. */
  burst: boolean;
  /** Nietenpunkte und Kerben. */
  rivets: boolean;
  sparkle: boolean;
}

export const WEAPON_STYLES: Record<string, WeaponStyle> = {
  spielzeug: {
    name: "A  Spielzeug",
    body: "#ff6fb0",
    bodyDark: "#d0407f",
    accent: "#35e6c8",
    grip: "#ffd23f",
    metal: "#ffffff",
    round: 8,
    line: 5,
    burst: false,
    rivets: false,
    sparkle: true,
  },
  stahl: {
    name: "B  Stahl-Cartoon",
    body: "#9aa6b8",
    bodyDark: "#5f6b7d",
    accent: "#ff9f1c",
    grip: "#8a5a2b",
    metal: "#d7dee9",
    round: 3,
    line: 5,
    burst: false,
    rivets: true,
    sparkle: false,
  },
  knall: {
    name: "C  Knall",
    body: "#ffc21f",
    bodyDark: "#e08a00",
    accent: "#e63946",
    grip: "#6a45d0",
    metal: "#fff4c2",
    round: 5,
    line: 6,
    burst: true,
    rivets: false,
    sparkle: false,
  },
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
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x + 2, y + 2, w - 4, Math.max(2, h * 0.16));
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
      ellipse(ctx, 50, 48, 28, 24, s.body);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(50, 48, 28, 24, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = s.bodyDark;
      ctx.fillRect(20, 58, 70, 30);
      ctx.restore();
      shine(ctx, 50, 48, 28, 24);
      ellipse(ctx, 52, 30, 12, 9, s.body, s.line);
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
export function drawWeapon(ctx: Ctx, id: WeaponId, s: WeaponStyle): void {
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

export const WEAPON_ORDER: readonly WeaponId[] = ["pistol", "smg", "shotgun", "sniper", "fist", "knife", "spear"];
