/**
 * Bilder fuer die Routenkarte und die Ruinen: Symbole der Stationen (24 x 24),
 * die kleine Festung als Standort-Marke, Truhen (zu und offen).
 */

import type { NodeType } from "../../game/types";
import { BRONZE, FIRE, GOLD, GRAY, OUTLINE, STEEL, YELLOW } from "./palette";
import { Pix, ellipse, poly, rect, thick, union, type Ramp } from "./pix";

const WATER: Ramp = ["#0e1a24", "#1f4a5a", "#2e6e7e", "#5aa4b0"];
const LEAF: Ramp = ["#0e1e10", "#2a5a2a", "#3e7e36", "#6aa850"];
const CLOTH: Ramp = ["#2e0a10", "#6e1a24", "#a02c32", "#cc4c48"];
const IRON: Ramp = ["#16171c", "#3a3d46", "#5a5e6a", "#868b98"];
const TRUNK: Ramp = ["#1e140c", "#5a3e24", "#7e5a36", "#a07a4e"];
const MYSTERY: Ramp = ["#1c1028", "#3a2a5a", "#5a4a8a", "#8a7ac0"];
const WOOD: Ramp = ["#22140a", "#5a3a1e", "#86582c", "#b08048"];

/** Symbol einer Station. */
export function paintNodeIcon(type: NodeType): Pix {
  const p = new Pix(24, 24, 3);
  switch (type) {
    case "start":
    case "ruine":
      p.shape(rect(3, 18, 18, 4), BRONZE, { shade: 1 });
      p.shape(poly(5, 18, 5, 6, 8, 4, 10, 8, 10, 18), GOLD, { shade: 1 });
      p.shape(poly(14, 18, 14, 10, 17, 12, 19, 9, 19, 18), GOLD, { shade: 1 });
      p.shape(rect(3, 2, 9, 3), BRONZE, { shade: 0 });
      break;
    case "oase":
      p.shape(ellipse(12, 19, 10, 4), WATER, { shade: 1 });
      p.shape(thick(9, 18, 11, 7, 2), TRUNK, { shade: 0 });
      for (const [dx, dy] of [
        [-8, 2],
        [-6, -4],
        [6, -3],
        [8, 3],
        [0, -6],
      ] as const) {
        p.shape(thick(11, 7, 11 + dx, 7 + dy, 3), LEAF, { shade: 0 });
      }
      break;
    case "haendler":
      p.shape(poly(2, 20, 12, 4, 22, 20), CLOTH, { shade: 1 });
      p.fill(poly(9, 20, 12, 12, 15, 20), OUTLINE);
      p.line(12, 4, 12, 1, STEEL[2]);
      p.px(13, 1, YELLOW[2]);
      for (let x = 4; x < 21; x += 4) {
        p.pxOn(x, 17, YELLOW[2]);
      }
      break;
    case "schrott":
      p.shape(poly(2, 21, 6, 12, 12, 9, 19, 12, 22, 21), IRON, { shade: 1 });
      p.shape(ellipse(9, 11, 4, 4), STEEL, { shade: 1 });
      p.fill(ellipse(9, 11, 1.5, 1.5), OUTLINE);
      p.shape(rect(13, 6, 3, 9), ["#3a1606", "#a8481a", "#e8822e", "#ffc070"], { shade: 0 });
      break;
    case "sturm":
      for (let i = 0; i < 46; i += 1) {
        const a = i * 0.42;
        const r = 1 + i * 0.22;
        p.px(12 + Math.cos(a) * r, 12 + Math.sin(a) * r * 0.8, i % 3 ? "#c8b49a" : "#8a7460");
        p.px(13 + Math.cos(a) * r, 12 + Math.sin(a) * r * 0.8, "#5a4a3a");
      }
      break;
    case "ereignis":
      p.shape(ellipse(12, 12, 9, 9), MYSTERY, { shade: 1 });
      p.fill(rect(10, 6, 4, 2), "#f6f1e2");
      p.fill(rect(13, 8, 2, 3), "#f6f1e2");
      p.fill(rect(11, 11, 2, 3), "#f6f1e2");
      p.fill(rect(11, 16, 2, 2), "#f6f1e2");
      break;
    case "boss":
      p.shape(union(ellipse(12, 12, 9, 8), rect(4, 12, 16, 9)), GOLD, { shade: 2 });
      p.shape(poly(3, 21, 3, 9, 7, 5, 17, 5, 21, 9, 21, 21, 17, 21, 16, 12, 8, 12, 7, 21), BRONZE, {
        shade: 1,
      });
      p.fill(rect(8, 12, 3, 2), "#ff6a2a");
      p.fill(rect(13, 12, 3, 2), "#ff6a2a");
      break;
    case "station":
      p.shape(rect(5, 6, 14, 14), BRONZE, { shade: 1 });
      p.fill(rect(9, 12, 6, 8), OUTLINE);
      break;
  }
  p.outline(OUTLINE);
  return p;
}

/** Kleine Festung als Standort-Marke auf der Karte. */
export function paintFortIcon(): Pix {
  const p = new Pix(30, 22, 4);
  for (const [ax, kx, fx] of [
    [8, 2, 0],
    [22, 28, 30],
  ] as const) {
    for (const dy of [0, 5]) {
      p.line(ax, 9 + dy, kx, 3 + dy, GRAY[2]);
      p.line(kx, 3 + dy, fx, 14 + dy, GRAY[2]);
    }
  }
  p.shape(rect(7, 6, 16, 9), IRON, { shade: 1 });
  p.fill(rect(13, 8, 4, 4), FIRE[2]);
  p.px(14, 9, "#fff6c0");
  p.fill(rect(7, 15, 16, 2), YELLOW[2]);
  p.outline(OUTLINE);
  return p;
}

/** Truhe in einer Ruine: Holz mit Goldbeschlag. Offen: Deckel hoch, leer. */
export function paintChest(open: boolean): Pix {
  const p = new Pix(22, 20, 6);
  p.shape(rect(2, 9, 18, 9), WOOD, { shade: 1 });
  p.fill(rect(2, 12, 18, 1), GOLD[1]);
  if (open) {
    p.shape(poly(2, 9, 4, 1, 20, 1, 20, 9), WOOD, { shade: 1 });
    p.fill(rect(4, 9, 14, 2), OUTLINE);
    p.fill(rect(5, 3, 13, 1), GOLD[2]);
  } else {
    p.shape(union(rect(2, 4, 18, 6), ellipse(11, 5, 9, 3)), WOOD, { shade: 1 });
    p.fill(rect(2, 8, 18, 1), GOLD[1]);
    p.shape(rect(9, 7, 4, 5), GOLD, { shade: 0 });
    p.px(11, 9, OUTLINE);
  }
  p.fill(rect(4, 9, 2, 9), GOLD[2]);
  p.fill(rect(16, 9, 2, 9), GOLD[2]);
  p.outline(OUTLINE);
  return p;
}
