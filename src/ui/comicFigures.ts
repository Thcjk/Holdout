/**
 * Die Comic-Figuren: alle Spieler und Gegner werden hier von Hand gezeichnet.
 *
 * Statt der kleinen Pixelfiguren aus dem Kenney-Paket gibt es jetzt runde
 * Comic-Figuren mit dicker schwarzer Kontur, flachen Farben, einem Schattenrand
 * und einem Glanzpunkt - dieselbe Handschrift wie Logo, Arena und Oberflaeche.
 *
 * Jede Figur steht auf einer Leinwand von 78 x 78 Pixeln und schaut nach RECHTS
 * (das Spiel spiegelt sie, wenn sie nach links laeuft).
 */

import type Phaser from "phaser";
import { characterKey, enemyKey } from "../config/assets";
import { CHARACTER_IDS } from "../game/data/characters";
import type { CharacterId, EnemyType } from "../game/types";

const SIZE = 78;
const INK = "#14101c";

type Ctx = CanvasRenderingContext2D;

// --- Zeichenhilfen -----------------------------------------------------------------

/** Fuellt eine Form und zieht die dicke Kontur darum (Kontur zuerst, Flaeche darueber). */
function shape(ctx: Ctx, build: () => void, fill: string, lineWidth = 6): void {
  ctx.beginPath();
  build();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, lineWidth = 6): void {
  shape(ctx, () => ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), fill, lineWidth);
}

function polygon(ctx: Ctx, points: readonly (readonly [number, number])[], fill: string, lineWidth = 6): void {
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

/** Dunkler Schatten unten rechts, innerhalb der Ellipse - macht die Form rund. */
function shade(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(x - rx - 4, y - ry - 4, rx * 2 + 8, ry * 2 + 8);
  ctx.ellipse(x - rx * 0.22, y - ry * 0.28, rx * 0.95, ry * 0.95, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill("evenodd");
  ctx.restore();
}

/** Heller Glanzfleck oben links. */
function shine(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.4, y - ry * 0.55, rx * 0.32, ry * 0.2, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
}

/** Eine runde Koerperform mit Schatten und Glanz. */
function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, dark: string): void {
  ellipse(ctx, x, y, rx, ry, fill);
  shade(ctx, x, y, rx, ry, dark);
  shine(ctx, x, y, rx, ry);
}

/** Ein Auge: weiss, schwarze Pupille mit Lichtpunkt, schaut nach rechts. */
function eye(ctx: Ctx, x: number, y: number, r: number, look = 0.38): void {
  ellipse(ctx, x, y, r, r * 1.08, "#ffffff", 4);
  ctx.beginPath();
  ctx.arc(x + r * look, y + r * 0.05, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * look + r * 0.18, y - r * 0.2, r * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
}

/** Dicke schwarze Linie - Augenbraue, Mund, Riss. */
function stroke(ctx: Ctx, points: readonly (readonly [number, number])[], width = 4, color = INK): void {
  ctx.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
}

function star(ctx: Ctx, cx: number, cy: number, outer: number, inner: number, points: number, fill: string, lineWidth = 4): void {
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

function dome(ctx: Ctx, x: number, y: number, r: number, from: number, to: number, fill: string, lineWidth = 6): void {
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

// --- Spieler -------------------------------------------------------------------------

interface Hero {
  body: string;
  bodyDark: string;
  skin: string;
  skinDark: string;
  wide?: boolean;
}

/** Koerper, Haende, Fuesse, Kopf und Gesicht - alles, was jeder Held gemeinsam hat. */
function heroBase(ctx: Ctx, hero: Hero, face = true): void {
  const bodyRx = hero.wide ? 22 : 19;
  // Fuesse
  ellipse(ctx, 32, 69, 8, 5, "#3b2a1a", 5);
  ellipse(ctx, 48, 69, 8, 5, "#3b2a1a", 5);
  // Koerper
  blob(ctx, 40, 54, bodyRx, 16, hero.body, hero.bodyDark);
  // Haende
  ellipse(ctx, 40 - bodyRx - 1, 55, 6, 6, hero.skin, 5);
  ellipse(ctx, 40 + bodyRx + 1, 55, 6, 6, hero.skin, 5);
  // Kopf
  if (face) {
    blob(ctx, 40, 32, 19, 18, hero.skin, hero.skinDark);
    eye(ctx, 34, 33, 6.2);
    eye(ctx, 48, 33, 6.2);
    // kleiner Mund
    stroke(ctx, [[42, 44], [47, 45.5], [51, 43]], 3);
  }
}

function drawHero(ctx: Ctx, id: CharacterId): void {
  switch (id) {
    case "soeldner": {
      heroBase(ctx, { body: "#8a8f4a", bodyDark: "#5f6431", skin: "#f2c9a0", skinDark: "#d49e72" });
      // Brustgurt
      stroke(ctx, [[27, 47], [53, 62]], 4, "#3b2a1a");
      // Helm
      dome(ctx, 40, 31, 21.5, 1.0, 2.0, "#5b7a3a");
      ellipse(ctx, 40, 27, 24, 4.5, "#46602d", 5);
      star(ctx, 40, 17, 5.5, 2.4, 5, "#ffd23f", 3);
      // grimmige Brauen
      stroke(ctx, [[28, 27], [38, 30]], 4);
      stroke(ctx, [[52, 27], [44, 30]], 4);
      break;
    }
    case "raufbold": {
      heroBase(ctx, { body: "#ff8c42", bodyDark: "#d2601a", skin: "#f2c9a0", skinDark: "#d49e72" });
      // Knoten und Zipfel
      polygon(ctx, [[22, 24], [8, 16], [10, 30], [20, 32]], "#e4572e", 5);
      dome(ctx, 40, 30, 21, 1.02, 1.98, "#e4572e");
      stroke(ctx, [[20, 28], [60, 28]], 3, "#a83a1c");
      // wuetende Brauen
      stroke(ctx, [[27, 24], [39, 31]], 5);
      stroke(ctx, [[53, 24], [43, 31]], 5);
      // dicke Boxhandschuhe
      ellipse(ctx, 63, 54, 9, 9, "#e63946", 5);
      shine(ctx, 63, 54, 9, 9);
      ellipse(ctx, 17, 56, 9, 9, "#e63946", 5);
      shine(ctx, 17, 56, 9, 9);
      break;
    }
    case "jaeger": {
      heroBase(ctx, { body: "#4f9d4b", bodyDark: "#33692f", skin: "#f2c9a0", skinDark: "#d49e72" });
      // Feder (hinter dem Hut)
      polygon(ctx, [[50, 17], [66, 4], [62, 17], [56, 22]], "#e63946", 4);
      // Hut
      shape(
        ctx,
        () => {
          ctx.roundRect(28, 7, 24, 19, 6);
        },
        "#9a6a3a",
      );
      stroke(ctx, [[29, 20], [51, 20]], 5, "#3a7d36");
      ellipse(ctx, 40, 26, 26, 5.5, "#7a4e2d", 5);
      break;
    }
    case "panzer": {
      heroBase(ctx, { body: "#8c97a8", bodyDark: "#5d687a", skin: "#f2c9a0", skinDark: "#d49e72", wide: true }, false);
      // Helm ueber dem ganzen Kopf
      blob(ctx, 40, 31, 22, 20, "#a9b4c4", "#6e7a8c");
      // Sehschlitz
      shape(
        ctx,
        () => {
          ctx.roundRect(22, 26, 36, 12, 5);
        },
        "#1e1a2e",
        5,
      );
      ellipse(ctx, 33, 32, 3.5, 3, "#ffd23f", 2);
      ellipse(ctx, 47, 32, 3.5, 3, "#ffd23f", 2);
      // Kamm und Nieten
      stroke(ctx, [[40, 11], [40, 24]], 5, "#e63946");
      for (const x of [26, 54]) {
        ellipse(ctx, x, 20, 2.2, 2.2, "#ffffff", 2);
      }
      stroke(ctx, [[30, 46], [50, 46]], 3);
      break;
    }
    case "glueckspilz": {
      heroBase(ctx, { body: "#3a86ff", bodyDark: "#2559b5", skin: "#f2c9a0", skinDark: "#d49e72" });
      // Kleeblatt auf der Brust
      for (const [x, y] of [[36, 52], [44, 52], [36, 59], [44, 59]] as const) {
        ellipse(ctx, x, y, 4, 4, "#58cc4a", 3);
      }
      // Pilzhut
      shape(
        ctx,
        () => {
          ctx.ellipse(40, 22, 29, 17, 0, Math.PI, 0);
          ctx.quadraticCurveTo(40, 29, 11, 22);
          ctx.closePath();
        },
        "#e63946",
      );
      for (const [x, y, r] of [[27, 15, 4.5], [41, 9, 5], [53, 16, 4], [34, 22, 3]] as const) {
        ellipse(ctx, x, y, r, r, "#ffffff", 3);
      }
      break;
    }
    case "schatten": {
      heroBase(ctx, { body: "#3b2a66", bodyDark: "#25194a", skin: "#f2c9a0", skinDark: "#d49e72" }, false);
      // Kopftuch-Zipfel
      polygon(ctx, [[21, 28], [4, 20], [8, 33], [4, 40], [22, 36]], "#e63946", 4);
      // Kapuze
      blob(ctx, 40, 32, 20.5, 19, "#5b3f8f", "#3a2766");
      // Gesichtsstreifen
      shape(
        ctx,
        () => {
          ctx.roundRect(25, 26, 32, 13, 6);
        },
        "#f2c9a0",
        4,
      );
      eye(ctx, 34, 32, 4.8);
      eye(ctx, 48, 32, 4.8);
      stroke(ctx, [[27, 24], [37, 28]], 4);
      stroke(ctx, [[55, 24], [45, 28]], 4);
      // Schal
      shape(
        ctx,
        () => {
          ctx.roundRect(24, 44, 32, 8, 4);
        },
        "#e63946",
        4,
      );
      break;
    }
  }
}

// --- Gegner --------------------------------------------------------------------------

function larva(ctx: Ctx, body: string, dark: string, head: string): void {
  blob(ctx, 34, 48, 27, 17, body, dark);
  stroke(ctx, [[24, 36], [26, 60]], 4, dark);
  stroke(ctx, [[36, 33], [38, 63]], 4, dark);
  blob(ctx, 52, 38, 16, 15, head, dark);
  // Fuehler
  stroke(ctx, [[46, 25], [42, 12]], 4);
  stroke(ctx, [[58, 25], [64, 12]], 4);
  ellipse(ctx, 42, 11, 4, 4, "#ffd23f", 3);
  ellipse(ctx, 64, 11, 4, 4, "#ffd23f", 3);
  eye(ctx, 49, 36, 5.5);
  eye(ctx, 60, 36, 5.5);
  stroke(ctx, [[44, 30], [52, 34]], 3.5);
  stroke(ctx, [[65, 30], [58, 34]], 3.5);
  stroke(ctx, [[50, 46], [54, 48], [58, 46], [62, 48]], 3);
}

function drawEnemy(ctx: Ctx, type: EnemyType): void {
  switch (type) {
    case "grunt": {
      larva(ctx, "#7fcf5a", "#4d9a37", "#a0e070");
      break;
    }
    case "swarmer": {
      star(ctx, 39, 42, 31, 21, 11, "#d7ec4a", 5);
      ellipse(ctx, 41, 42, 15, 15, "#eef7a0", 4);
      eye(ctx, 43, 42, 10, 0.35);
      stroke(ctx, [[28, 28], [44, 35]], 4);
      break;
    }
    case "charger": {
      // Hoerner
      polygon(ctx, [[24, 26], [14, 4], [36, 20]], "#fff1d6", 5);
      polygon(ctx, [[54, 24], [64, 2], [44, 18]], "#fff1d6", 5);
      blob(ctx, 39, 46, 29, 23, "#ee5a36", "#b53317");
      // Wut-Augen
      ellipse(ctx, 30, 41, 7, 6, "#ffe066", 4);
      ellipse(ctx, 50, 41, 7, 6, "#ffe066", 4);
      ctx.beginPath();
      ctx.arc(32, 42, 2.8, 0, Math.PI * 2);
      ctx.arc(52, 42, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      stroke(ctx, [[20, 32], [36, 39]], 5);
      stroke(ctx, [[60, 32], [44, 39]], 5);
      // Hauer
      polygon(ctx, [[28, 56], [32, 49], [36, 57]], "#ffffff", 3);
      polygon(ctx, [[44, 57], [48, 49], [52, 56]], "#ffffff", 3);
      break;
    }
    case "spitter": {
      blob(ctx, 39, 42, 26, 25, "#a06be0", "#6c3fb0");
      eye(ctx, 31, 29, 6);
      eye(ctx, 46, 28, 6);
      // Maul mit Schleim
      ellipse(ctx, 49, 49, 14, 10, "#2a1240", 5);
      ellipse(ctx, 52, 53, 7, 4.5, "#ff7aa8", 2);
      shape(
        ctx,
        () => {
          ctx.moveTo(42, 55);
          ctx.lineTo(42, 70);
          ctx.arc(45, 70, 3, Math.PI, 0, true);
          ctx.lineTo(48, 56);
          ctx.closePath();
        },
        "#8be04a",
        3,
      );
      stroke(ctx, [[24, 24], [36, 29]], 4);
      stroke(ctx, [[54, 22], [42, 28]], 4);
      break;
    }
    case "bruiser": {
      polygon(
        ctx,
        [[12, 52], [8, 34], [20, 15], [42, 8], [62, 16], [70, 38], [64, 60], [42, 70], [20, 66]],
        "#9b7650",
        6,
      );
      // Schattenflaeche
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(42, 70);
      ctx.lineTo(64, 60);
      ctx.lineTo(70, 38);
      ctx.lineTo(56, 44);
      ctx.lineTo(46, 58);
      ctx.closePath();
      ctx.fillStyle = "rgba(60,30,10,0.35)";
      ctx.fill();
      ctx.restore();
      // Risse
      stroke(ctx, [[20, 24], [28, 30], [24, 40]], 3.5);
      stroke(ctx, [[60, 50], [52, 56], [56, 64]], 3.5);
      // Augen unter schwerer Stirn
      ellipse(ctx, 32, 38, 5.5, 4.5, "#ffe066", 3);
      ellipse(ctx, 50, 38, 5.5, 4.5, "#ffe066", 3);
      ctx.beginPath();
      ctx.arc(34, 38.5, 2.2, 0, Math.PI * 2);
      ctx.arc(52, 38.5, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      stroke(ctx, [[22, 30], [38, 35]], 6);
      stroke(ctx, [[60, 30], [44, 35]], 6);
      // Maul mit Zaehnen
      stroke(ctx, [[28, 54], [35, 51], [42, 55], [49, 51], [56, 54]], 4);
      break;
    }
    case "elite": {
      larva(ctx, "#3f9a3a", "#256b22", "#58b84e");
      // Krone
      polygon(ctx, [[42, 28], [43, 8], [50, 18], [57, 4], [64, 18], [71, 8], [71, 28]], "#ffd23f", 5);
      ellipse(ctx, 57, 21, 3, 3, "#e63946", 2);
      stroke(ctx, [[44, 27], [70, 27]], 3, "#c99a10");
      break;
    }
    case "boss": {
      // Fangarme
      for (const x of [16, 29, 49, 62]) {
        ellipse(ctx, x, 64, 8, 9, "#8a38b0", 5);
      }
      // Fuehler
      stroke(ctx, [[26, 14], [16, 3]], 4);
      stroke(ctx, [[54, 14], [64, 3]], 4);
      ellipse(ctx, 15, 3, 4, 4, "#7dff9a", 3);
      ellipse(ctx, 65, 3, 4, 4, "#7dff9a", 3);
      blob(ctx, 40, 36, 28, 27, "#9a45c4", "#6a2490");
      // drei Augen
      for (const [x, y, r] of [[27, 33, 7], [53, 33, 7], [40, 24, 8]] as const) {
        ellipse(ctx, x, y, r, r * 1.1, "#d6ff6a", 4);
        ellipse(ctx, x + 1.5, y + 1, r * 0.35, r * 0.75, INK, 2);
      }
      stroke(ctx, [[18, 24], [32, 30]], 4.5);
      stroke(ctx, [[62, 24], [48, 30]], 4.5);
      // Zahnreihe
      shape(
        ctx,
        () => {
          ctx.roundRect(24, 46, 32, 11, 4);
        },
        "#2a1240",
        4,
      );
      for (let x = 27; x < 54; x += 6) {
        polygon(ctx, [[x, 47], [x + 3, 53], [x + 6, 47]], "#ffffff", 1.5);
      }
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
