/**
 * Kleinteile in Pixel-Art: Waffen (32 x 32, waagerecht nach rechts),
 * Geschosse, Muenze, Kristall, Herz, Schloss, Riss-Markierung und die Symbole
 * fuer Gegenstaende (Medaillon mit Bild je Hauptwert).
 *
 * Die Waffen der Helden sind Zukunftstechnik: Energieklingen, Blaster,
 * Railgun ... Leuchtteile sind Cyan, Orange oder Violett.
 */

import type { StatKey, WeaponId } from "../../game/types";
import { BRONZE, CYAN, CYAN_HOT, FIRE, GOLD, GREEN, HAZARD, MAGENTA, MECH, MECH_DARK, MECH_PALE, ORANGE_GLOW, ORANGE_HOT, OUT, RED, STEEL, VIOLET } from "./palette";
import { oval, Pix, poly, rect, thick, union } from "./pix";

export const WEAPON_SIZE = 32;

/** Energieklinge: dunkler Griff, leuchtende Klinge. */
function energyBlade(p: Pix, x0: number, x1: number, y: number, h: number, glow: string, hot: string): void {
  p.shape(rect(x0 - 7, y - 1, 7, 3), MECH_DARK, { shade: 1 });
  p.shape(rect(x0 - 1, y - 3, 2, 7), MECH, { shade: 0 });
  p.fill(poly(x0 + 1, y - h, x1 - 2, y - h, x1, y, x1 - 2, y + h, x0 + 1, y + h), glow);
  p.line(x0 + 1, y, x1 - 1, y, hot);
}

function gunBody(p: Pix, x0: number, x1: number, y: number, h: number): void {
  p.shape(rect(x0, y, x1 - x0, h), MECH, { shade: 1 });
  // Griff
  p.shape(poly(x0 + 3, y + h, x0 + 8, y + h, x0 + 6, y + h + 6, x0 + 2, y + h + 6), MECH_DARK, { shade: 1 });
}

function drawWeapon(p: Pix, id: WeaponId): void {
  switch (id) {
    case "spear": {
      // Laserschwert
      energyBlade(p, 10, 31, 16, 1, CYAN, CYAN_HOT);
      break;
    }
    case "twin": {
      // Doppelklingen: zwei kurze Klingen uebereinander
      energyBlade(p, 10, 27, 11, 1, CYAN, CYAN_HOT);
      energyBlade(p, 12, 29, 21, 1, MAGENTA, "#ffd0ea");
      break;
    }
    case "fist": {
      // Plasmaaxt: Stiel, leuchtende Klinge
      p.shape(thick(2, 22, 24, 13, 3), MECH_DARK, { shade: 1 });
      p.shape(poly(19, 6, 27, 4, 31, 10, 29, 20, 22, 18, 21, 12), MECH_PALE, { shade: 1 });
      p.fill(poly(26, 6, 30, 10, 28, 18, 25, 16), ORANGE_GLOW);
      p.line(29, 10, 27, 17, ORANGE_HOT);
      break;
    }
    case "knife": {
      // Energiedolch
      energyBlade(p, 13, 26, 16, 1, VIOLET[2], VIOLET[3]);
      break;
    }
    case "hammer": {
      // Gravhammer: Stiel und schwerer Kopf mit Kern
      p.shape(thick(2, 24, 20, 14, 3), MECH_DARK, { shade: 1 });
      p.shape(rect(16, 4, 14, 14), MECH, { shade: 2 });
      p.shape(rect(18, 8, 10, 6), MECH_DARK, { shade: 0, light: 0 });
      p.fill(rect(21, 9, 4, 4), CYAN);
      p.px(22, 10, CYAN_HOT);
      break;
    }
    case "pistol": {
      // Blaster
      gunBody(p, 8, 24, 12, 5);
      p.shape(rect(24, 13, 5, 3), MECH_DARK, { shade: 0 });
      p.line(10, 13, 20, 13, CYAN);
      p.px(29, 14, CYAN_HOT);
      break;
    }
    case "smg": {
      // Minigun: Laufbuendel
      p.shape(rect(4, 10, 12, 9), MECH, { shade: 2 });
      for (const y of [11, 14, 17]) {
        p.shape(rect(16, y, 14, 2), STEEL, { shade: 0 });
      }
      p.shape(rect(15, 10, 3, 9), MECH_DARK, { shade: 0 });
      p.shape(rect(6, 19, 5, 6), MECH_DARK, { shade: 1 });
      p.px(8, 13, ORANGE_GLOW);
      break;
    }
    case "shotgun": {
      // Streublaster: kurzer, breiter Lauf mit Trichter
      gunBody(p, 6, 22, 11, 6);
      p.shape(poly(22, 10, 29, 7, 29, 21, 22, 18), MECH_PALE, { shade: 1 });
      p.line(24, 12, 24, 16, ORANGE_GLOW);
      p.line(26, 11, 26, 17, ORANGE_GLOW);
      break;
    }
    case "sniper": {
      // Railgun: langer Doppellauf mit Spulen
      gunBody(p, 2, 16, 12, 5);
      p.shape(rect(16, 12, 15, 2), STEEL, { shade: 0 });
      p.shape(rect(16, 15, 15, 2), STEEL, { shade: 0 });
      for (const x of [18, 22, 26]) {
        p.shape(rect(x, 11, 2, 7), MECH_DARK, { shade: 0 });
        p.px(x, 14, CYAN);
      }
      p.shape(rect(6, 9, 6, 3), MECH_DARK, { shade: 0 });
      p.px(11, 10, GREEN);
      break;
    }
    case "crossbow": {
      // Nadelgewehr: schlank, Nadeln vorn
      gunBody(p, 4, 22, 13, 4);
      p.shape(rect(22, 14, 6, 2), MECH_PALE, { shade: 0 });
      p.line(26, 12, 31, 12, GREEN);
      p.line(27, 17, 31, 17, GREEN);
      p.line(8, 14, 18, 14, GREEN);
      break;
    }
    case "rocket": {
      // Raketenwerfer: dicke Roehre mit Rakete
      p.shape(rect(3, 10, 22, 8), MECH, { shade: 2 });
      p.shape(rect(3, 10, 3, 8), MECH_DARK, { shade: 0 });
      p.shape(poly(25, 11, 29, 11, 31, 14, 29, 17, 25, 17), RED, { shade: 1 });
      p.shape(rect(9, 18, 4, 6), MECH_DARK, { shade: 1 });
      p.line(8, 11, 20, 11, HAZARD[2]);
      break;
    }
    case "flamer": {
      // Flammenwerfer: Tank unten, Duese mit Flamme
      p.shape(rect(4, 12, 18, 5), MECH, { shade: 1 });
      p.shape(union(oval(8, 21, 3.5, 3.5), oval(13, 21, 3.5, 3.5)), RED, { shade: 1 });
      p.shape(rect(22, 13, 3, 3), MECH_DARK, { shade: 0 });
      p.fill(poly(25, 14, 28, 10, 31, 14, 28, 18), FIRE[2]);
      p.px(27, 14, FIRE[3]);
      p.px(28, 14, FIRE[3]);
      break;
    }
    case "wand": {
      // Teslawerfer: Spule mit Blitz
      gunBody(p, 4, 18, 13, 5);
      for (const x of [18, 21, 24]) {
        p.shape(oval(x + 1, 15, 1.5, 4), GOLD, { shade: 0 });
      }
      p.line(27, 15, 29, 11, CYAN_HOT);
      p.line(29, 11, 28, 15, CYAN);
      p.line(28, 15, 31, 19, CYAN_HOT);
      break;
    }
    case "frost": {
      // Stasiswerfer: Kugel aus violettem Zeitlicht
      gunBody(p, 4, 18, 13, 5);
      p.shape(rect(18, 14, 4, 3), MECH_DARK, { shade: 0 });
      p.shape(oval(26, 15, 5, 5), VIOLET, { shade: 1 });
      p.px(25, 13, VIOLET[3]);
      p.px(24, 14, "#ffffff");
      break;
    }
  }
}

export function drawWeaponPixels(id: WeaponId): Pix {
  const p = new Pix(WEAPON_SIZE, WEAPON_SIZE, 5);
  drawWeapon(p, id);
  p.outline(OUT);
  return p;
}

// --- Geschosse -----------------------------------------------------------------------

/**
 * Geschossbilder (`shot-<n>`): 1 Blasterbolzen, 2 Rakete, 3 Flamme, 4 Blitzkugel,
 * 5 Stasiskugel, 6 Napalmgranate, 7 Minigun-Kugel, 8 Streukugel, 9 Railgun-Strahl,
 * 10 Nadel. Alle zeigen nach rechts.
 */
export function drawShotPixels(look: number): Pix {
  const sizes: Record<number, [number, number]> = { 1: [12, 5], 2: [12, 7], 3: [9, 9], 4: [9, 9], 5: [9, 9], 6: [10, 10], 7: [6, 4], 8: [6, 6], 9: [18, 5], 10: [12, 3] };
  const [w, h] = sizes[look] ?? [8, 8];
  const p = new Pix(w, h, look);
  switch (look) {
    case 1:
      p.fill(rect(1, 1, 10, 3), CYAN);
      p.line(3, 2, 11, 2, CYAN_HOT);
      break;
    case 2:
      p.shape(rect(2, 2, 7, 3), MECH_PALE, { shade: 0, rim: true });
      p.fill(poly(9, 1, 12, 3.5, 9, 6), RED[2]);
      p.fill(rect(0, 2, 2, 3), ORANGE_GLOW);
      break;
    case 3:
      p.fill(oval(4.5, 4.5, 4.5, 4), FIRE[2]);
      p.fill(oval(5, 4.5, 2.5, 2), FIRE[3]);
      break;
    case 4:
      p.fill(oval(4.5, 4.5, 4, 4), CYAN);
      p.fill(oval(4.5, 4.5, 2, 2), CYAN_HOT);
      p.px(0, 4, CYAN);
      p.px(8, 4, CYAN);
      break;
    case 5:
      p.fill(oval(4.5, 4.5, 4, 4), VIOLET[2]);
      p.fill(oval(4.5, 4.5, 2, 2), VIOLET[3]);
      break;
    case 6:
      p.shape(oval(5, 5, 4.5, 4.5), MECH_DARK, { shade: 1, rim: true });
      p.px(5, 1, ORANGE_HOT);
      p.px(4, 3, ORANGE_GLOW);
      break;
    case 7:
      p.fill(rect(0, 1, 6, 2), HAZARD[3]);
      break;
    case 8:
      p.fill(oval(3, 3, 3, 3), ORANGE_GLOW);
      p.px(3, 2, ORANGE_HOT);
      break;
    case 9:
      p.fill(rect(0, 1, 18, 3), CYAN);
      p.line(2, 2, 17, 2, "#ffffff");
      break;
    case 10:
      p.fill(rect(0, 1, 12, 1), GREEN);
      p.px(11, 1, "#e0ffe6");
      break;
  }
  if (look === 2 || look === 6) {
    p.outline(OUT);
  }
  return p;
}

/** Gegnergeschoss: violette Zeitkugel mit hellem Kern (wird im Spiel eingefaerbt). */
export function drawEnemyBullet(): Pix {
  const p = new Pix(10, 10, 3);
  p.fill(oval(5, 5, 5, 5), "#ffffff");
  p.fill(oval(5, 5, 3, 3), "#e8e8e8");
  return p;
}

// --- Muenze, Kristall, Herz, Schloss, Riss-Markierung -----------------------------------

/** Goldmuenze (Aureus) mit Kopfbild. */
export function drawCoin(): Pix {
  const p = new Pix(12, 12, 9);
  p.shape(oval(6, 6, 5.5, 5.5), GOLD, { shade: 1 });
  p.shape(oval(6, 6, 3.5, 3.5), GOLD, { shade: 0, light: 0 });
  p.px(5, 4, GOLD[0]);
  p.px(6, 4, GOLD[0]);
  p.px(6, 5, GOLD[0]);
  p.px(5, 6, GOLD[0]);
  p.px(4, 3, "#ffffff");
  p.outline(OUT);
  return p;
}

/** Zeitkristall (Waehrung der Schmiede). */
export function drawCrystal(): Pix {
  const p = new Pix(14, 16, 4);
  p.shape(poly(7, 0, 13, 6, 7, 16, 1, 6), VIOLET, { shade: 2 });
  p.line(7, 1, 7, 14, VIOLET[3]);
  p.line(2, 6, 12, 6, VIOLET[1]);
  p.px(5, 4, "#ffffff");
  p.outline(OUT);
  return p;
}

export function drawHeart(): Pix {
  const p = new Pix(14, 13, 4);
  p.shape(union(oval(4, 4, 3.6, 3.6), oval(10, 4, 3.6, 3.6), poly(0.6, 5, 13.4, 5, 7, 12.5)), RED, { shade: 1 });
  p.px(3, 3, "#ffffff");
  p.outline(OUT);
  return p;
}

export function drawLock(): Pix {
  const p = new Pix(14, 16, 4);
  p.shape(union(rect(3, 2, 2, 6), rect(9, 2, 2, 6), rect(4, 1, 6, 2)), STEEL, { shade: 0 });
  p.shape(rect(1, 7, 12, 8), GOLD, { shade: 1 });
  p.px(6, 9, OUT);
  p.px(7, 9, OUT);
  p.line(6, 10, 6, 12, OUT);
  p.line(7, 10, 7, 12, OUT);
  p.outline(OUT);
  return p;
}

/** Kleiner Zeitriss am Boden, aus dem ein Gegner kommt. */
export function drawRiftMarker(): Pix {
  const p = new Pix(24, 16, 8);
  p.fill(oval(12, 8, 11, 6), VIOLET[1]);
  p.fill(oval(12, 8, 7, 4), VIOLET[2]);
  p.line(4, 8, 8, 6, VIOLET[3]);
  p.line(8, 6, 12, 10, VIOLET[3]);
  p.line(12, 10, 16, 6, VIOLET[3]);
  p.line(16, 6, 20, 8, VIOLET[3]);
  p.px(12, 8, "#ffffff");
  return p;
}

// --- Gegenstandssymbole ----------------------------------------------------------------

const STAT_RAMP: Record<StatKey, typeof GOLD> = {
  damage: RED,
  melee: RED,
  ranged: HAZARD,
  attackSpeed: HAZARD,
  crit: GOLD,
  range: MECH_PALE,
  maxHp: RED,
  regen: [OUT, "#3e7a3a", "#5eb04e", "#a6e08a"],
  lifesteal: RED,
  armor: STEEL,
  dodge: MECH_PALE,
  speed: MECH,
  luck: [OUT, "#3e7a3a", "#5eb04e", "#a6e08a"],
  harvesting: GOLD,
  ability: VIOLET,
};

/** Medaillon (24 x 24): Bronzering, dunkle Mitte, Bild je Wert. */
export function drawStatIcon(stat: StatKey): Pix {
  const p = new Pix(24, 24, 13);
  p.shape(oval(12, 12, 11.5, 11.5), BRONZE, { shade: 1 });
  p.shape(oval(12, 12, 9, 9), MECH_DARK, { shade: 0, light: 0 });
  const r = STAT_RAMP[stat];
  switch (stat) {
    case "damage":
    case "melee":
      p.shape(thick(7, 17, 16, 7, 2), STEEL, { shade: 0 });
      p.shape(thick(6, 13, 11, 18, 2), GOLD, { shade: 0 });
      break;
    case "ranged":
    case "range":
      p.fill(oval(12, 12, 6, 6), r[2]);
      p.fill(oval(12, 12, 4, 4), MECH_DARK[2]);
      p.fill(oval(12, 12, 2, 2), r[2]);
      break;
    case "attackSpeed":
    case "speed":
    case "ability":
      p.fill(poly(13, 4, 7, 13, 11, 13, 9, 20, 16, 10, 12, 10, 14, 4), r[2]);
      p.line(13, 5, 9, 12, r[3]);
      break;
    case "crit":
      p.fill(poly(12, 5, 14, 10, 19, 12, 14, 14, 12, 19, 10, 14, 5, 12, 10, 10), r[2]);
      p.px(12, 12, "#ffffff");
      break;
    case "maxHp":
    case "regen":
      p.fill(union(oval(9, 10, 3, 3), oval(15, 10, 3, 3), poly(6, 11, 18, 11, 12, 18)), r[2]);
      p.px(8, 9, r[3]);
      if (stat === "regen") {
        p.fill(rect(11, 9, 2, 6), "#ffffff");
        p.fill(rect(9, 11, 6, 2), "#ffffff");
      }
      break;
    case "lifesteal":
      p.fill(union(oval(12, 14, 4, 4), poly(12, 5, 16, 13, 8, 13)), r[2]);
      p.px(11, 12, r[3]);
      break;
    case "armor":
      p.fill(poly(7, 6, 17, 6, 17, 12, 12, 18, 7, 12), r[2]);
      p.line(12, 7, 12, 16, r[1]);
      p.line(8, 7, 16, 7, r[3]);
      break;
    case "dodge":
      p.fill(poly(16, 5, 18, 7, 9, 18, 6, 18, 6, 15), r[2]);
      p.line(15, 7, 8, 16, r[3]);
      break;
    case "luck":
      for (const [dx, dy] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]] as const) {
        p.fill(oval(12 + dx, 11 + dy, 2.8, 2.8), r[2]);
      }
      p.line(12, 14, 14, 19, r[1]);
      break;
    case "harvesting":
      for (const y of [15, 12, 9]) {
        p.fill(oval(12, y, 5, 2), GOLD[2]);
        p.line(8, y + 1, 16, y + 1, GOLD[1]);
      }
      break;
  }
  p.outline(OUT);
  return p;
}

