/**
 * Die Comic-Figuren: alle Spieler und Gegner werden hier von Hand gezeichnet.
 *
 * Maerchenbuch-Stil: Helden sind kleine Wanderer mit Kapuze, Schal und einem grossen
 * Auge; Gegner sind dunkle Schattenwesen mit hellen Augen. Duenne Konturen, flache
 * Farben, ein dunklerer Streifen unten - wie ausgeschnittenes, bemaltes Papier.
 *
 * Jede Figur steht auf einer Leinwand von 78 x 78 Pixeln und schaut nach RECHTS
 * (das Spiel spiegelt sie, wenn sie nach links laeuft).
 */

import type Phaser from "phaser";
import { characterKey, enemyKey } from "../config/assets";
import { CHARACTER_IDS } from "../game/data/characters";
import type { CharacterId, EnemyType } from "../game/types";
import { NOIR } from "./noir";

const SIZE = 78;
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

/** Beine und Rumpf: kleine Wanderer mit rundem Koerper. */
function walker(ctx: Ctx, coat: string, coatDark: string, wide = 0): void {
  // Beine
  flat(ctx, [[31 - wide, 64], [37, 64], [37, 73], [30 - wide, 73]], NOIR.ink, 2);
  flat(ctx, [[43, 64], [49 + wide, 64], [50 + wide, 73], [43, 73]], NOIR.ink, 2);
  // Rumpf
  body(ctx, 40, 55, 17 + wide, 15, coat, coatDark);
}

/** Schal mit wehendem Ende. */
function scarf(ctx: Ctx, color: string, dark: string): void {
  flat(ctx, [[24, 41], [56, 41], [55, 49], [25, 49]], color, 2.5);
  flat(ctx, [[26, 45], [12, 50], [8, 59], [16, 56], [22, 60], [27, 51]], dark, 2.5);
}

function drawHero(ctx: Ctx, id: CharacterId): void {
  switch (id) {
    case "soeldner": {
      walker(ctx, "#6b7a4a", "#4a5733");
      // Gurt
      stroke(ctx, [[27, 48], [53, 63]], 4, NOIR.ink);
      stroke(ctx, [[27, 48], [53, 63]], 1.8, NOIR.amber);
      // Kopf mit Kappe
      body(ctx, 40, 31, 19, 18, "#4d6a75", "#34505a");
      ellipse(ctx, 43, 32, 13, 11, NOIR.night, 1.5);
      eyeBig(ctx, 44, 32, 7.5, 0.42);
      // Kappenzipfel
      flat(ctx, [[24, 21], [14, 12], [18, 25]], "#4d6a75", 2.5);
      scarf(ctx, NOIR.amber, NOIR.amberDark);
      break;
    }
    case "raufbold": {
      walker(ctx, "#b5632f", "#8a4521", 2);
      // Stirnband und Faeuste
      body(ctx, 40, 31, 19, 18, "#d9b88f", "#b08f66");
      flat(ctx, [[22, 25], [58, 25], [58, 32], [22, 32]], NOIR.blood, 2.5);
      flat(ctx, [[22, 26], [10, 21], [13, 30], [22, 32]], NOIR.bloodDark, 2.5);
      eyeBig(ctx, 36, 36, 4.2, 0.4);
      eyeBig(ctx, 48, 36, 4.2, 0.4);
      stroke(ctx, [[31, 31], [39, 33]], 3);
      stroke(ctx, [[53, 31], [46, 33]], 3);
      ellipse(ctx, 12, 60, 9, 9, PAPER, 2.5);
      ellipse(ctx, 68, 60, 9, 9, PAPER, 2.5);
      stroke(ctx, [[8, 58], [16, 62]], 2, NOIR.blood);
      stroke(ctx, [[64, 58], [72, 62]], 2, NOIR.blood);
      break;
    }
    case "jaeger": {
      walker(ctx, "#4f7a55", "#355a3d");
      stroke(ctx, [[54, 42], [28, 64]], 3.5, "#5a4128");
      // spitze Kapuze mit Feder
      flat(ctx, [[22, 36], [26, 14], [40, 2], [54, 14], [58, 36]], "#3f6a4a", 2.5);
      body(ctx, 40, 31, 18, 17, "#3f6a4a", "#2b4a34");
      ellipse(ctx, 43, 32, 12, 10.5, NOIR.night, 1.5);
      eyeBig(ctx, 41, 32, 5, 0.4);
      eyeBig(ctx, 50, 32, 4.2, 0.4);
      flat(ctx, [[48, 8], [64, -2], [58, 12], [52, 16]], NOIR.blood, 2);
      scarf(ctx, "#cdbf9b", "#a89a76");
      break;
    }
    case "panzer": {
      walker(ctx, "#6a8a8c", "#4a6668", 5);
      // Schulterplatten und Brustschild
      flat(ctx, [[10, 40], [28, 38], [29, 50], [12, 52]], "#8aa7a4", 2.5);
      flat(ctx, [[52, 38], [70, 40], [68, 52], [51, 50]], "#8aa7a4", 2.5);
      ellipse(ctx, 40, 54, 6, 6, NOIR.amber, 2);
      // Rundhelm mit Sehschlitz
      body(ctx, 40, 29, 21, 20, "#9db8b4", "#6a8a8c");
      flat(ctx, [[26, 26], [54, 26], [54, 34], [26, 34]], NOIR.night, 2);
      lamp(ctx, 46, 30, 3.8, NOIR.amber);
      lamp(ctx, 35, 30, 3.2, NOIR.amber);
      for (const x of [27, 53]) {
        ellipse(ctx, x, 20, 1.8, 1.8, NOIR.ink, 1);
      }
      break;
    }
    case "glueckspilz": {
      walker(ctx, "#4f9aa0", "#357479");
      // Pilzhut
      body(ctx, 40, 31, 17, 16, "#e0cfa8", "#bda97e");
      ctx.beginPath();
      ctx.ellipse(40, 21, 30, 17, 0, Math.PI, 0);
      ctx.quadraticCurveTo(40, 27, 10, 21);
      ctx.closePath();
      ctx.fillStyle = NOIR.blood;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = NOIR.ink;
      ctx.stroke();
      for (const [x, y, r] of [[26, 14, 4], [41, 8, 4.5], [54, 15, 3.6]] as const) {
        ellipse(ctx, x, y, r, r, PAPER, 1.5);
      }
      eyeBig(ctx, 35, 33, 4.5, 0.4);
      eyeBig(ctx, 47, 33, 4.5, 0.4);
      stroke(ctx, [[37, 41], [42, 43], [47, 41]], 2.5);
      scarf(ctx, NOIR.amber, NOIR.amberDark);
      break;
    }
    case "schatten": {
      walker(ctx, "#2b3d44", "#1b2a30");
      // tiefe Kapuze mit einem hellen Auge
      body(ctx, 40, 30, 20, 19, "#2f4650", "#1b2d35");
      ellipse(ctx, 43, 31, 13, 11.5, "#0f1719", 1.5);
      lamp(ctx, 45, 31, 4.6, "#f6e7b8");
      flat(ctx, [[22, 22], [8, 14], [14, 28]], "#2f4650", 2.5);
      scarf(ctx, NOIR.blood, NOIR.bloodDark);
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

function paint(scene: Phaser.Scene, key: string, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  draw(ctx);
  const texture = scene.textures.addCanvas(key, canvas);
  // Gemalte Flaechen sollen weich skalieren, nicht in harte Pixel zerfallen.
  texture?.setFilter(1);
}

/** Malt alle Spieler- und Gegnerfiguren. Mehrfach aufrufen ist harmlos. */
export function createFigureTextures(scene: Phaser.Scene): void {
  for (const id of CHARACTER_IDS) {
    paint(scene, characterKey(id), (ctx) => drawHero(ctx, id));
  }
  const types: EnemyType[] = ["grunt", "swarmer", "charger", "spitter", "bruiser", "elite", "boss"];
  for (const type of types) {
    paint(scene, enemyKey(type), (ctx) => drawEnemy(ctx, type));
  }
}
