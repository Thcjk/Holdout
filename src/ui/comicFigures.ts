/**
 * Die Comic-Figuren: alle Spieler und Gegner werden hier von Hand gezeichnet.
 *
 * Maerchenbuch-Stil: Helden sind kleine Wanderer mit Kapuze, Schal und einem grossen
 * Auge; Gegner sind dunkle Schattenwesen mit hellen Augen. Duenne Konturen, flache
 * Farben, ein dunklerer Streifen unten - wie ausgeschnittenes, bemaltes Papier.
 *
 * Gezeichnet wird in einem 78er-Raster auf einer groesseren Leinwand. Jede Figur schaut nach RECHTS
 * (das Spiel spiegelt sie, wenn sie nach links laeuft).
 */

import type Phaser from "phaser";
import { characterKey, enemyKey } from "../config/assets";
import { CHARACTER_IDS } from "../game/data/characters";
import type { CharacterId, EnemyType } from "../game/types";
import { NOIR } from "./noir";

const SIZE = 136;
const INK: string = NOIR.ink;

type Ctx = CanvasRenderingContext2D;

// --- Zeichenhilfen -----------------------------------------------------------------

/** Fuellt eine Form und zieht die dicke Kontur darum (Kontur zuerst, Flaeche darueber). */
export function shape(ctx: Ctx, build: () => void, fill: string, lineWidth = 6): void {
  ctx.beginPath();
  build();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = lineWidth * 0.55;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, lineWidth = 6): void {
  shape(ctx, () => ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), fill, lineWidth);
}

export function polygon(ctx: Ctx, points: readonly (readonly [number, number])[], fill: string, lineWidth = 6): void {
  shape(
    ctx,
    () => {
      points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    },
    fill,
    lineWidth,
  );
}

/** Heller Glanzfleck oben links. */
export function shine(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.4, y - ry * 0.55, rx * 0.32, ry * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
}

/** Dicke schwarze Linie - Augenbraue, Mund, Riss. */
export function stroke(ctx: Ctx, points: readonly (readonly [number, number])[], width = 4, color = INK): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function star(ctx: Ctx, cx: number, cy: number, outer: number, inner: number, points: number, fill: string, lineWidth = 4): void {
  shape(
    ctx,
    () => {
      for (let i = 0; i < points * 2; i += 1) {
        const radius = i % 2 === 0 ? outer : inner;
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
    },
    fill,
    lineWidth,
  );
}

// --- Bausteine im Maerchenbuch-Stil ---------------------------------------------------

const PAPER = NOIR.bone;
const SHADOW_CREATURE = "#25302f";
const SHADOW_RIM = "#3f5352";

/** Runde Flaeche mit flacher dunklerer Unterseite - wie ausgeschnittenes, bemaltes Papier. */
function body(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, dark: string, line = 3): void {
  ellipse(ctx, x, y, rx, ry, fill, line);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.12, y - ry * 0.34, rx * 1.05, ry * 0.95, 0, 0, Math.PI * 2);
  ctx.rect(x - rx - 3, y - ry - 3, rx * 2 + 6, ry * 2 + 6);
  ctx.fillStyle = dark;
  ctx.fill("evenodd");
  ctx.restore();
}

/** Flache Form aus Punkten, duenn umrandet. */
function flat(ctx: Ctx, points: readonly (readonly [number, number])[], fill: string, line = 3): void {
  polygon(ctx, points, fill, line);
}

/** Halbkreis-Kappe. */
function dome(ctx: Ctx, x: number, y: number, r: number, from: number, to: number, fill: string, lineWidth = 3.4): void {
  shape(
    ctx,
    () => {
      ctx.arc(x, y, r, Math.PI * from, Math.PI * to);
      ctx.closePath();
    },
    fill,
    lineWidth,
  );
}

/** Ein grosses rundes Auge, das nach rechts schaut. */
function eyeBig(ctx: Ctx, x: number, y: number, r: number, look = 0.4, white = PAPER): void {
  ellipse(ctx, x, y, r, r * 1.05, white, 2.5);
  ctx.beginPath();
  ctx.arc(x + r * look, y + r * 0.05, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = NOIR.ink;
  ctx.fill();
}

/** Ein kleines leuchtendes Auge in der Dunkelheit (ohne Rand). */
function lamp(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Dunkles Schattenwesen: fast schwarze Flaeche mit hellem Rand oben links. */
function shadowBlob(ctx: Ctx, build: () => void): void {
  ctx.beginPath();
  build();
  ctx.fillStyle = SHADOW_CREATURE;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineWidth = 6;
  ctx.strokeStyle = SHADOW_RIM;
  ctx.translate(-2.2, -2.2);
  ctx.beginPath();
  build();
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  build();
  ctx.lineWidth = 2;
  ctx.strokeStyle = NOIR.ink;
  ctx.stroke();
}

/** Zackiger Dornenring wie ein Heiligenschein. */
function thornRing(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  for (let i = 0; i <= 40; i += 1) {
    const a = (i / 40) * Math.PI * 2;
    const spike = i % 2 === 0 ? 1.12 : 1;
    const x = cx + Math.cos(a) * rx * spike;
    const y = cy + Math.sin(a) * ry * spike;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = NOIR.ink;
  ctx.stroke();
}

// --- Spieler -------------------------------------------------------------------------

interface Wanderer {
  coat: string;
  coatDark: string;
  legs?: string;
  wide?: number;
}

/** Duenne Beine, Fuesse und ein glockenfoermiger Kittel - die Grundform aller Helden. */
function wanderer(ctx: Ctx, look: Wanderer): void {
  const w = look.wide ?? 0;
  const legs = look.legs ?? NOIR.ink;
  // Beine und Fuesse
  flat(ctx, [[33, 58], [37, 58], [37, 70], [33, 70]], legs, 1.6);
  flat(ctx, [[43, 58], [47, 58], [47, 70], [43, 70]], legs, 1.6);
  ellipse(ctx, 33.5, 71, 4.6, 2.6, legs, 2);
  ellipse(ctx, 47.5, 71, 4.6, 2.6, legs, 2);
  // Kittel: oben schmal, unten weit, Saum leicht gewellt
  shape(
    ctx,
    () => {
      ctx.moveTo(28 - w * 0.4, 42);
      ctx.quadraticCurveTo(20 - w, 54, 21 - w, 62);
      ctx.quadraticCurveTo(30, 65, 40, 62.5);
      ctx.quadraticCurveTo(50, 65, 59 + w, 62);
      ctx.quadraticCurveTo(60 + w, 54, 52 + w * 0.4, 42);
      ctx.closePath();
    },
    look.coat,
    4,
  );
  // dunklere rechte Seite
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(44, 42);
  ctx.lineTo(53 + w * 0.4, 42);
  ctx.quadraticCurveTo(60 + w, 54, 59 + w, 62);
  ctx.quadraticCurveTo(52, 64.5, 46, 63);
  ctx.closePath();
  ctx.fillStyle = look.coatDark;
  ctx.fill();
  ctx.restore();
  // Saumnaht
  ctx.setLineDash([2, 2.5]);
  stroke(ctx, [[23 - w, 59], [40, 60], [57 + w, 59]], 1, "rgba(29,28,25,0.55)");
  ctx.setLineDash([]);
  // Aermchen
  ellipse(ctx, 23 - w, 51, 4.4, 6.5, look.coat, 3);
  ellipse(ctx, 57 + w, 51, 4.4, 6.5, look.coatDark, 3);
}

/** Runde Kapuze mit Gesichtsoeffnung und einem grossen Auge. */
function hoodHead(ctx: Ctx, hood: string, hoodDark: string, face = "#efd9b4", eye = true): void {
  body(ctx, 40, 25, 20, 19, hood, hoodDark, 3.6);
  ellipse(ctx, 45, 27, 12.5, 12, face, 2.4);
  if (eye) {
    ellipse(ctx, 46, 26.5, 7.2, 8.6, "#fbf6ea", 2.4);
    ctx.beginPath();
    ctx.ellipse(48.6, 27.5, 3.6, 4.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = NOIR.ink;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(49.8, 25.6, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "#fbf6ea";
    ctx.fill();
  }
}

/** Gewickelter Schal mit Streifen und wehendem Ende. */
function wrapScarf(ctx: Ctx, color: string, dark: string): void {
  flat(ctx, [[25, 39], [10, 44], [5, 54], [12, 51], [9, 60], [20, 52], [27, 46]], dark, 2.2);
  shape(ctx, () => ctx.roundRect(24, 38, 33, 8, 4), color, 3.2);
  stroke(ctx, [[31, 38.5], [30, 45.5]], 1.4, dark);
  stroke(ctx, [[45, 38.5], [44, 45.5]], 1.4, dark);
}

function drawHero(ctx: Ctx, id: CharacterId): void {
  switch (id) {
    case "soeldner": {
      wanderer(ctx, { coat: "#3c6a78", coatDark: "#2c5260" });
      // Guertel mit Schnalle
      stroke(ctx, [[22, 53], [58, 53]], 2.6, "#5a3e24");
      flat(ctx, [[37, 51], [42, 51], [42, 55.5], [37, 55.5]], NOIR.amber, 1.4);
      hoodHead(ctx, "#4f8a9a", "#3b6d7b");
      // Knoten oben wie ein Kopftuch
      flat(ctx, [[26, 11], [17, 4], [19, 13]], "#4f8a9a", 2.4);
      flat(ctx, [[27, 13], [15, 15], [22, 19]], "#3b6d7b", 2.4);
      wrapScarf(ctx, "#d8a23a", "#a87a1c");
      break;
    }
    case "raufbold": {
      wanderer(ctx, { coat: "#a9542e", coatDark: "#82401f", wide: 3 });
      // runder Kopf mit Bart und Kopftuch
      body(ctx, 40, 26, 18, 17, "#e2b98d", "#c49a6e", 3.4);
      shape(
        ctx,
        () => {
          ctx.moveTo(26, 30);
          ctx.quadraticCurveTo(28, 46, 40, 46);
          ctx.quadraticCurveTo(54, 46, 56, 30);
          ctx.quadraticCurveTo(48, 36, 40, 35);
          ctx.quadraticCurveTo(32, 36, 26, 30);
        },
        "#6b4228",
        3,
      );
      dome(ctx, 40, 24, 18.5, 1.0, 2.0, "#b5532f");
      flat(ctx, [[23, 18], [11, 13], [13, 22], [22, 23]], "#8f3f22", 2.2);
      ellipse(ctx, 36, 27, 2.6, 3, NOIR.ink, 0.1);
      ellipse(ctx, 47, 27, 2.6, 3, NOIR.ink, 0.1);
      stroke(ctx, [[32, 22.5], [39, 24.5]], 2.4);
      stroke(ctx, [[51, 22.5], [44, 24.5]], 2.4);
      // dick bandagierte Faeuste
      body(ctx, 15, 54, 8, 8, "#f1e5c9", "#d8c9a5", 3);
      body(ctx, 65, 54, 8, 8, "#f1e5c9", "#d8c9a5", 3);
      stroke(ctx, [[10, 52], [20, 55]], 1.2, "rgba(29,28,25,0.5)");
      stroke(ctx, [[60, 52], [70, 55]], 1.2, "rgba(29,28,25,0.5)");
      break;
    }
    case "jaeger": {
      // Koecher mit Pfeilen hinter dem Ruecken
      flat(ctx, [[18, 30], [26, 26], [32, 52], [24, 55]], "#6b4228", 2.4);
      stroke(ctx, [[20, 28], [14, 14]], 2);
      stroke(ctx, [[24, 26], [21, 11]], 2);
      flat(ctx, [[12, 14], [14, 9], [17, 15]], "#f1e5c9", 1.4);
      flat(ctx, [[19, 11], [21, 6], [24, 12]], "#f1e5c9", 1.4);
      wanderer(ctx, { coat: "#5d7d43", coatDark: "#465f31" });
      stroke(ctx, [[54, 42], [28, 60]], 2.6, "#6b4228");
      // spitze Kapuze
      flat(ctx, [[22, 30], [28, 6], [40, -2], [58, 14], [60, 30]], "#4d6c38", 3.2);
      hoodHead(ctx, "#4d6c38", "#3a5329");
      flat(ctx, [[52, 6], [70, -4], [62, 10], [56, 14]], "#b5532f", 2);
      wrapScarf(ctx, "#cdbf9b", "#a89a76");
      break;
    }
    case "panzer": {
      wanderer(ctx, { coat: "#7f9c98", coatDark: "#5f7c78", wide: 5 });
      // Brustplatte mit Nieten
      shape(ctx, () => ctx.roundRect(29, 44, 22, 13, 4), "#a9c0bb", 2.6);
      for (const x of [32, 48]) {
        ellipse(ctx, x, 47, 1.2, 1.2, NOIR.ink, 0.1);
      }
      // Topfhelm mit Sehschlitz und Federbusch
      flat(ctx, [[36, 6], [44, 6], [48, -4], [42, 2], [38, -4]], "#b5532f", 2);
      shape(ctx, () => ctx.roundRect(21, 6, 38, 36, 12), "#9fb8b3", 3.6);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(21, 6, 38, 36, 12);
      ctx.clip();
      ctx.fillStyle = "#7f9c98";
      ctx.fillRect(44, 4, 18, 40);
      ctx.restore();
      shape(ctx, () => ctx.roundRect(25, 21, 33, 7, 3), NOIR.ink, 1);
      lamp(ctx, 47, 24.5, 2.6, "#f6d36b");
      stroke(ctx, [[40, 30], [40, 40]], 2, "rgba(29,28,25,0.6)");
      for (const y of [32, 36]) {
        stroke(ctx, [[44, y], [52, y]], 1.6, "rgba(29,28,25,0.6)");
      }
      break;
    }
    case "glueckspilz": {
      wanderer(ctx, { coat: "#4f9aa0", coatDark: "#3a7a80" });
      // Kleeblatt-Anstecker
      for (const [x, y] of [[33, 50], [36, 50], [33, 53], [36, 53]] as const) {
        ellipse(ctx, x, y, 1.9, 1.9, "#6e8f3a", 1);
      }
      // rundes Gesicht unter dem Pilzhut
      body(ctx, 40, 29, 15, 14, "#efd9b4", "#d6bd94", 3.2);
      ellipse(ctx, 36, 31, 2.3, 2.8, NOIR.ink, 0.1);
      ellipse(ctx, 46, 31, 2.3, 2.8, NOIR.ink, 0.1);
      ellipse(ctx, 32.5, 35.5, 2.6, 1.5, "rgba(181,83,47,0.45)", 0.1);
      ellipse(ctx, 49.5, 35.5, 2.6, 1.5, "rgba(181,83,47,0.45)", 0.1);
      stroke(ctx, [[38, 37], [41, 38.5], [44, 37]], 1.8);
      shape(
        ctx,
        () => {
          ctx.ellipse(40, 21, 27, 16, 0, Math.PI, 0);
          ctx.quadraticCurveTo(40, 27, 13, 21);
          ctx.closePath();
        },
        "#b5532f",
        3.6,
      );
      for (const [x, y, r] of [[27, 15, 3.6], [40, 9, 4.2], [53, 15, 3.2], [33, 20, 2]] as const) {
        ellipse(ctx, x, y, r, r * 0.85, "#f1e5c9", 1.4);
      }
      wrapScarf(ctx, "#d8a23a", "#a87a1c");
      break;
    }
    case "schatten": {
      wanderer(ctx, { coat: "#2c3a3c", coatDark: "#1f2a2c" });
      // lange Kapuzenspitze nach hinten
      flat(ctx, [[24, 18], [6, 26], [2, 38], [14, 30], [24, 32]], "#33474a", 3);
      body(ctx, 40, 25, 20, 19, "#33474a", "#243436", 3.6);
      ellipse(ctx, 45, 27, 12.5, 12, "#101616", 2);
      lamp(ctx, 47, 26, 3.6, "#f6e7b8");
      wrapScarf(ctx, "#b5532f", "#7d3519");
      break;
    }
  }
}

// --- Gegner: dunkle Schattenwesen -----------------------------------------------------

function drawEnemy(ctx: Ctx, type: EnemyType): void {
  switch (type) {
    case "grunt": {
      // Kriecher: flacher Klumpen mit Buckeln und zwei hellen Augen
      shadowBlob(ctx, () => {
        ctx.moveTo(8, 62);
        ctx.quadraticCurveTo(4, 40, 20, 34);
        ctx.quadraticCurveTo(26, 24, 38, 30);
        ctx.quadraticCurveTo(52, 20, 62, 34);
        ctx.quadraticCurveTo(78, 42, 72, 62);
        ctx.quadraticCurveTo(66, 70, 56, 66);
        ctx.quadraticCurveTo(50, 72, 44, 66);
        ctx.quadraticCurveTo(36, 72, 30, 66);
        ctx.quadraticCurveTo(20, 72, 8, 62);
      });
      eyeBig(ctx, 50, 46, 6, 0.4);
      eyeBig(ctx, 63, 48, 4.6, 0.4);
      break;
    }
    case "swarmer": {
      // Russwesen: kleine Kugel mit Fransen und einem grossen Auge
      shadowBlob(ctx, () => {
        for (let i = 0; i <= 24; i += 1) {
          const a = (i / 24) * Math.PI * 2;
          const r = i % 2 === 0 ? 30 : 23;
          const x = 40 + Math.cos(a) * r;
          const y = 42 + Math.sin(a) * r * 0.92;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
      });
      eyeBig(ctx, 44, 42, 10, 0.45);
      break;
    }
    case "charger": {
      // Hoerner-Bulle
      flat(ctx, [[18, 30], [8, 8], [30, 22]], PAPER, 2.5);
      flat(ctx, [[62, 30], [72, 8], [50, 22]], PAPER, 2.5);
      shadowBlob(ctx, () => {
        ctx.moveTo(8, 56);
        ctx.quadraticCurveTo(6, 30, 26, 26);
        ctx.quadraticCurveTo(40, 20, 54, 26);
        ctx.quadraticCurveTo(74, 30, 72, 56);
        ctx.quadraticCurveTo(66, 74, 40, 72);
        ctx.quadraticCurveTo(14, 74, 8, 56);
      });
      lamp(ctx, 29, 44, 5, "#f08a3c");
      lamp(ctx, 51, 44, 5, "#f08a3c");
      stroke(ctx, [[22, 36], [34, 41]], 3.5, "#0f1719");
      stroke(ctx, [[58, 36], [46, 41]], 3.5, "#0f1719");
      flat(ctx, [[30, 62], [34, 54], [38, 62]], PAPER, 2);
      flat(ctx, [[42, 62], [46, 54], [50, 62]], PAPER, 2);
      break;
    }
    case "spitter": {
      // Gifthuester: Blase mit leuchtendem Schlund
      shadowBlob(ctx, () => {
        ctx.moveTo(10, 50);
        ctx.quadraticCurveTo(8, 22, 40, 16);
        ctx.quadraticCurveTo(72, 22, 70, 50);
        ctx.quadraticCurveTo(66, 72, 40, 72);
        ctx.quadraticCurveTo(14, 72, 10, 50);
      });
      eyeBig(ctx, 30, 32, 5.2, 0.4);
      eyeBig(ctx, 46, 30, 4.6, 0.4);
      ctx.beginPath();
      ctx.ellipse(44, 54, 14, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#0f1719";
      ctx.fill();
      lamp(ctx, 44, 56, 6, NOIR.toxic);
      flat(ctx, [[38, 62], [42, 62], [42, 75], [38, 75]], NOIR.toxic, 1.5);
      break;
    }
    case "bruiser": {
      // Moos-Koloss
      shadowBlob(ctx, () => {
        ctx.moveTo(8, 60);
        ctx.lineTo(6, 36);
        ctx.lineTo(18, 14);
        ctx.lineTo(40, 8);
        ctx.lineTo(62, 14);
        ctx.lineTo(74, 36);
        ctx.lineTo(72, 62);
        ctx.lineTo(58, 72);
        ctx.lineTo(22, 72);
        ctx.closePath();
      });
      // Moosflecken
      for (const [x, y, rx, ry] of [[20, 20, 10, 5], [58, 18, 9, 4.5], [30, 66, 11, 4]] as const) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, -0.3, 0, Math.PI * 2);
        ctx.fillStyle = "#5d6a2f";
        ctx.fill();
      }
      // Glutrisse
      stroke(ctx, [[22, 30], [30, 40], [26, 52]], 2.5, NOIR.amber);
      stroke(ctx, [[60, 34], [52, 46], [58, 58]], 2.5, NOIR.amber);
      lamp(ctx, 33, 36, 4.6, NOIR.amber);
      lamp(ctx, 47, 36, 4.6, NOIR.amber);
      break;
    }
    case "elite": {
      // Hoher Geist mit Dornenring
      thornRing(ctx, 40, 12, 20, 6);
      shadowBlob(ctx, () => {
        ctx.moveTo(14, 72);
        ctx.quadraticCurveTo(10, 34, 28, 22);
        ctx.quadraticCurveTo(40, 14, 52, 22);
        ctx.quadraticCurveTo(70, 34, 66, 72);
        ctx.quadraticCurveTo(58, 66, 52, 72);
        ctx.quadraticCurveTo(46, 66, 40, 72);
        ctx.quadraticCurveTo(34, 66, 28, 72);
        ctx.quadraticCurveTo(20, 66, 14, 72);
      });
      lamp(ctx, 32, 42, 5, "#f6e7b8");
      lamp(ctx, 48, 42, 5, "#f6e7b8");
      stroke(ctx, [[24, 34], [36, 39]], 3, "#0f1719");
      stroke(ctx, [[56, 34], [44, 39]], 3, "#0f1719");
      break;
    }
    case "boss": {
      // Der Wächter: Spitzturm-Silhouette mit Dornenring und vielen Augen
      thornRing(ctx, 40, 9, 24, 7);
      shadowBlob(ctx, () => {
        ctx.moveTo(6, 74);
        ctx.lineTo(14, 46);
        ctx.lineTo(24, 40);
        ctx.lineTo(28, 22);
        ctx.lineTo(36, 22);
        ctx.lineTo(40, 6);
        ctx.lineTo(44, 22);
        ctx.lineTo(52, 22);
        ctx.lineTo(56, 40);
        ctx.lineTo(66, 46);
        ctx.lineTo(74, 74);
        ctx.closePath();
      });
      for (const [x, y, r] of [[40, 30, 4.2], [28, 52, 3.6], [52, 52, 3.6], [40, 58, 4.6]] as const) {
        lamp(ctx, x, y, r, "#f08a3c");
      }
      stroke(ctx, [[22, 66], [58, 66]], 2, SHADOW_RIM);
      break;
    }
  }
}

// --- Einstieg ----------------------------------------------------------------------

/** Gezeichnet wird in einem 78er-Raster; die Textur ist groesser, damit sie scharf bleibt. */
const DESIGN = 78;
const PAD = 11;
/** Wie viele Texturpixel eine Rastereinheit hat - Szenen teilen ihre Groesse dadurch. */
export const FIGURE_UNIT = (SIZE - PAD * 2) / DESIGN;

/** Rechnet einen alten Massstab (bezogen auf das 78er-Raster) in den Texturmassstab um. */
export function figureScale(designScale: number): number {
  return designScale / FIGURE_UNIT;
}

function canvas2d(size: number, height = size): [HTMLCanvasElement, Ctx] | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  return ctx ? [canvas, ctx] : null;
}

/**
 * Malt eine Figur und gibt ihr den gedruckten Poster-Look:
 * Papierkorn und Schraffur auf der Schattenseite, dann ein ungleichmaessiger
 * Tusche-Umriss um die ganze Silhouette.
 */
function paint(scene: Phaser.Scene, key: string, draw: (ctx: Ctx) => void, dark = false): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const art = canvas2d(SIZE);
  if (!art) {
    return;
  }
  const [artCanvas, ctx] = art;
  ctx.save();
  ctx.translate(PAD, PAD);
  ctx.scale(FIGURE_UNIT, FIGURE_UNIT);
  draw(ctx);
  ctx.restore();

  scene.textures.addCanvas(key, inkify(artCanvas, key, dark))?.setFilter(1);
}

/**
 * Gibt einer gemalten Leinwand den gedruckten Poster-Look: Papierkorn und
 * Schraffur auf der Schattenseite, dann ein ungleichmaessiger Tusche-Umriss
 * um die ganze Silhouette. Liefert eine neue Leinwand gleicher Groesse.
 */
export function inkify(artCanvas: HTMLCanvasElement, key: string, dark = false, outline = 2.2): HTMLCanvasElement {
  const size = artCanvas.width;
  const tall = artCanvas.height;
  const ctx = artCanvas.getContext("2d") as Ctx;
  const random = seededFigure(key.length * 977 + key.charCodeAt(key.length - 1));
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  for (let i = 0; i < size * tall * 0.22; i += 1) {
    ctx.fillStyle = random() < 0.5 ? "rgba(29,28,25,0.10)" : dark ? "rgba(140,170,165,0.10)" : "rgba(255,250,232,0.16)";
    const s = 0.8 + random() * 1.6;
    ctx.fillRect(random() * size, random() * tall, s, s);
  }
  ctx.strokeStyle = dark ? "rgba(140,170,165,0.16)" : "rgba(29,28,25,0.14)";
  ctx.lineWidth = 1.1;
  for (let x = size * 0.55; x < size * 1.6; x += 4.2) {
    ctx.beginPath();
    ctx.moveTo(x, tall * 0.35);
    ctx.lineTo(x - tall * 0.65, tall);
    ctx.stroke();
  }
  ctx.restore();

  const silhouette = canvas2d(size, tall);
  const out = canvas2d(size, tall);
  if (!silhouette || !out) {
    return artCanvas;
  }
  const [silCanvas, sctx] = silhouette;
  sctx.drawImage(artCanvas, 0, 0);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = INK;
  sctx.fillRect(0, 0, size, tall);
  const [outCanvas, octx] = out;
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2;
    const r = outline + random() * outline * 0.6 + (Math.sin(a) > 0.3 ? outline * 0.35 : 0);
    octx.drawImage(silCanvas, Math.cos(a) * r, Math.sin(a) * r);
  }
  octx.drawImage(artCanvas, 0, 0);
  return outCanvas;
}

function seededFigure(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Malt einen Helden in beliebiger Groesse (fuer App-Icon und Splash). */
export function renderHero(id: CharacterId, size: number): HTMLCanvasElement | null {
  const art = canvas2d(size);
  if (!art) {
    return null;
  }
  const [canvas, ctx] = art;
  const unit = (size - (PAD * size) / SIZE * 2) / DESIGN;
  ctx.save();
  ctx.translate((PAD * size) / SIZE, (PAD * size) / SIZE);
  ctx.scale(unit, unit);
  drawHero(ctx, id);
  ctx.restore();
  return inkify(canvas, `hero-${id}-${size}`, false, (2.2 * size) / SIZE);
}

/** Malt alle Spieler- und Gegnerfiguren. Mehrfach aufrufen ist harmlos. */
export function createFigureTextures(scene: Phaser.Scene): void {
  for (const id of CHARACTER_IDS) {
    paint(scene, characterKey(id), (ctx) => drawHero(ctx, id));
  }
  const types: EnemyType[] = ["grunt", "swarmer", "charger", "spitter", "bruiser", "elite", "boss"];
  for (const type of types) {
    paint(scene, enemyKey(type), (ctx) => drawEnemy(ctx, type), true);
  }
}
