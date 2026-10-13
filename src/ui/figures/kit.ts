/**
 * Zeichenkasten fuer die Figuren im Stil der Vorlage (Chibi-Fantasy, gemalt).
 *
 * Alle Figuren werden in einem 100er-Raster gezeichnet: x von links nach rechts,
 * y von oben nach unten, die Fuesse stehen bei y = 96. Formen werden als
 * SVG-Pfadtext geschrieben (`P("M 10 10 L 20 20 Z")`) - so kann man sie lesen
 * und mit jedem Vektorprogramm nachbauen.
 *
 * Jede Flaeche wird in drei Schritten gemalt:
 *   1. ganz in der Schattenfarbe,
 *   2. die Grundfarbe darueber - etwas nach oben links verschoben und auf die
 *      Form beschnitten; unten rechts bleibt ein Schattenstreifen stehen,
 *   3. auf Wunsch ein weicher Lichtfleck (`hi`), dann die dunkle Kontur.
 * Am Ende bekommt die ganze Figur ein feines Korn (`grainOver`), damit sie
 * gemalt und nicht wie Vektorgrafik aussieht.
 */

export type Ctx = CanvasRenderingContext2D;

/** Konturfarbe: fast schwarz, leicht braun - wie in der Vorlage. */
export const LINE = "#2a201b";
/** Normale Konturstaerke im 100er-Raster. */
export const LW = 1.35;

export const P = (d: string): Path2D => new Path2D(d);

export function ell(cx: number, cy: number, rx: number, ry: number, rotation = 0): Path2D {
  const path = new Path2D();
  path.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
  return path;
}

export function rect(x: number, y: number, w: number, h: number, r = 0): Path2D {
  const path = new Path2D();
  path.roundRect(x, y, w, h, r);
  return path;
}

export interface Paint {
  /** Grundfarbe. */
  base: string;
  /** Schattenfarbe (unten rechts). Ohne: nur flach. */
  shade?: string;
  /** Wie weit der Schatten hereinreicht (x, y). */
  dx?: number;
  dy?: number;
  /** Weicher Lichtfleck: Mitte x, y und Radius. */
  hi?: readonly [number, number, number];
  /** Staerke des Lichtflecks (Standard 0.35). */
  light?: number;
  /** Konturstaerke; 0 = keine Kontur. */
  line?: number;
}

/** Malt eine Flaeche mit Schatten, Licht und Kontur (siehe Dateikopf). */
export function part(ctx: Ctx, shape: Path2D, paint: Paint): void {
  const dx = paint.dx ?? 1.8;
  const dy = paint.dy ?? 2.2;
  ctx.fillStyle = paint.shade ?? paint.base;
  ctx.fill(shape);
  if (paint.shade) {
    ctx.save();
    ctx.clip(shape);
    ctx.translate(-dx, -dy);
    ctx.fillStyle = paint.base;
    ctx.fill(shape);
    ctx.restore();
  }
  if (paint.hi) {
    // Weicher Lichtfleck (Rundung), z. B. oben links auf Kopf oder Helm.
    const [hx, hy, hr] = paint.hi;
    const gradient = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    gradient.addColorStop(0, `rgba(255,250,235,${paint.light ?? 0.35})`);
    gradient.addColorStop(1, "rgba(255,250,235,0)");
    ctx.save();
    ctx.clip(shape);
    ctx.fillStyle = gradient;
    ctx.fill(shape);
    ctx.restore();
  }
  const width = paint.line ?? LW;
  if (width > 0) {
    outline(ctx, shape, width);
  }
}

export function outline(ctx: Ctx, shape: Path2D, width = LW, color = LINE): void {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke(shape);
}

/** Eine offene Linie (Falte, Naht, Mund ...). */
export function line(ctx: Ctx, d: string, width = 1, color = LINE): void {
  outline(ctx, P(d), width, color);
}

/** Flaeche ohne Kontur. */
export function fill(ctx: Ctx, shape: Path2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fill(shape);
}

/** Malt `paint` nur innerhalb von `inside` - fuer Schlagschatten (unter Haaren, Hut ...). */
export function within(ctx: Ctx, inside: Path2D, draw: () => void): void {
  ctx.save();
  ctx.clip(inside);
  draw();
  ctx.restore();
}

/** Glanzpunkt: weisser, weicher Fleck. */
export function gloss(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.55, rotation = -0.5): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  fill(ctx, ell(cx, cy, rx, ry, rotation), "#ffffff");
  ctx.restore();
}

/** Rote Baeckchen. */
export function blush(ctx: Ctx, cx: number, cy: number, gap: number, color = "rgba(232,112,96,0.35)"): void {
  fill(ctx, ell(cx - gap, cy, 3.6, 2.1), color);
  fill(ctx, ell(cx + gap, cy, 3.6, 2.1), color);
}

// --- Gesichter ----------------------------------------------------------------------

export interface EyeStyle {
  /** Halbe Breite und halbe Hoehe eines Auges. */
  w?: number;
  h?: number;
  /** Blickrichtung der Pupillen (x, y). */
  lookX?: number;
  lookY?: number;
  /** Brauen: Neigung (positiv = boese, innen tief; negativ = besorgt), undefined = keine. */
  brow?: number;
  /** Abstand der Brauen ueber dem Auge. */
  browLift?: number;
  browWidth?: number;
  /** Boese Monsteraugen: weiss ohne Pupille, oben schraeg abgeschnitten. */
  blank?: boolean;
  /** Halb geschlossen (gelangweilt, Schleim). */
  sleepy?: boolean;
  /** Pupillenfarbe. */
  iris?: string;
  /** Farbe des haengenden Oberlids (bei `sleepy`). */
  lid?: string;
  /** Pupillengroesse relativ zum Auge. */
  pupil?: number;
}

/**
 * Ein Augenpaar. `cx` ist die Mitte zwischen den Augen, `gap` der halbe Abstand.
 * Heldenaugen: grosses Weiss, dicke Oberlid-Linie, schwarze Pupille mit Glanz.
 */
export function eyes(ctx: Ctx, cx: number, cy: number, gap: number, style: EyeStyle = {}): void {
  const w = style.w ?? 4.4;
  const h = style.h ?? 5.6;
  for (const side of [-1, 1] as const) {
    const x = cx + side * gap;
    if (style.blank) {
      // Monsterauge: Mandel, innen nach unten gezogen (boese).
      const tilt = style.brow ?? 3;
      const inner = side === -1 ? x + w : x - w;
      const outer = side === -1 ? x - w : x + w;
      const shape = P(
        `M ${outer} ${cy - h * 0.55} L ${inner} ${cy - h * 0.55 + tilt} ` +
          `Q ${inner + side * -0.6} ${cy + h * 0.9} ${x} ${cy + h * 0.9} ` +
          `Q ${outer - side * -0.4} ${cy + h * 0.8} ${outer} ${cy - h * 0.55} Z`,
      );
      part(ctx, shape, { base: "#f6f1e4", shade: "#d8d0bf", dx: 0.6, dy: 0.9, line: 1.25 });
      if (style.iris) {
        fill(ctx, ell(x + (style.lookX ?? 0.6), cy + 1.2, w * 0.28, h * 0.32), style.iris);
      }
      // Dicke Braue, die direkt auf dem Auge liegt.
      line(ctx, `M ${outer - side * 0.8} ${cy - h * 0.75} L ${inner + side * 0.6} ${cy - h * 0.75 + tilt + 0.6}`, 2.4);
      continue;
    }
    const eye = ell(x, cy, w, h);
    fill(ctx, eye, "#fbf8f0");
    if (style.sleepy) {
      // Oberlid haengt bis zur Mitte.
      within(ctx, eye, () => {
        fill(ctx, ell(x + 0.6, cy + 1.6, w * 0.6, h * 0.55), style.iris ?? "#1e1814");
        fill(ctx, rect(x - w - 1, cy - h - 1, w * 2 + 2, h + 0.6), style.lid ?? "#c9c08a");
      });
      outline(ctx, eye, 1.2);
      line(ctx, `M ${x - w - 0.6} ${cy - 0.3} L ${x + w + 0.6} ${cy - 0.3}`, 1.8);
      continue;
    }
    const pupil = style.pupil ?? 0.66;
    const px = x + (style.lookX ?? 0.9);
    const py = cy + (style.lookY ?? 0.6);
    within(ctx, eye, () => {
      fill(ctx, ell(px, py, w * pupil, h * pupil * 1.02), style.iris ?? "#1e1814");
      if (style.iris) {
        fill(ctx, ell(px, py + 0.3, w * pupil * 0.55, h * pupil * 0.6), "#1e1814");
      }
      // Glanzpunkte: gross oben, klein unten.
      fill(ctx, ell(px + w * 0.25, py - h * 0.32, w * 0.24, h * 0.2), "#ffffff");
      fill(ctx, ell(px - w * 0.25, py + h * 0.35, w * 0.12, h * 0.1), "rgba(255,255,255,0.8)");
    });
    outline(ctx, eye, 1.05);
    // Oberlid: dicker Bogen ueber der oberen Augenhaelfte (Wimpernlinie).
    line(ctx, `M ${x - w - 0.4} ${cy - h * 0.15} Q ${x - w * 0.7} ${cy - h - 0.6} ${x + side * 0.4} ${cy - h - 0.4} Q ${x + w * 0.7} ${cy - h - 0.6} ${x + w + 0.4} ${cy - h * 0.15}`, 1.9);
    if (style.brow !== undefined) {
      brow(ctx, x, cy - h - (style.browLift ?? 2.6), side, style.brow, style.browWidth ?? w * 1.05);
    }
  }
}

/** Eine dicke, spitz zulaufende Augenbraue. `tilt` > 0 = boese (innen tief). */
export function brow(ctx: Ctx, x: number, y: number, side: -1 | 1, tilt: number, half = 4.5, color = LINE): void {
  const inner = x - side * half;
  const outer = x + side * half;
  const yi = y + tilt;
  const yo = y - tilt * 0.4;
  ctx.fillStyle = color;
  ctx.fill(P(`M ${outer} ${yo} Q ${x} ${y - 1.6 - tilt * 0.2} ${inner} ${yi - 0.9} L ${inner} ${yi + 1.1} Q ${x} ${y + 0.2} ${outer} ${yo} Z`));
}

/** Geschlossene, lachende Augen (^ ^) - der Zwerg. */
export function happyEyes(ctx: Ctx, cx: number, cy: number, gap: number, w = 4.2): void {
  for (const side of [-1, 1]) {
    const x = cx + side * gap;
    line(ctx, `M ${x - w} ${cy + 1.2} Q ${x} ${cy - 3.6} ${x + w} ${cy + 1.2}`, 1.9);
  }
}

/** Zugekniffene Augen (> <) - der Goblin. */
export function squintEyes(ctx: Ctx, cx: number, cy: number, gap: number, w = 4.2): void {
  line(ctx, `M ${cx - gap - w} ${cy - 2.6} L ${cx - gap + w} ${cy} L ${cx - gap - w} ${cy + 2.4}`, 1.9);
  line(ctx, `M ${cx + gap + w} ${cy - 2.6} L ${cx + gap - w} ${cy} L ${cx + gap + w} ${cy + 2.4}`, 1.9);
}

export type MouthKind = "grin" | "open" | "o" | "frown" | "grit" | "roar" | "smirk" | "wail";

/**
 * Mund. `w` ist die halbe Breite.
 * grin  = lachend offen mit Zahnreihe oben und Zunge
 * open  = erschrocken offen (rund)
 * o     = kleines o
 * frown = schmollend (Linie nach unten)
 * grit  = Zaehne zusammengebissen
 * roar  = Monster: weit offen, Fangzaehne oben und unten
 * smirk = schiefes Laecheln
 * wail  = Monster: offen mit Fangzaehnen oben, Unterlippe haengt
 */
export function mouth(ctx: Ctx, x: number, y: number, kind: MouthKind, w = 4.5): void {
  const inside = "#5b2220";
  const tongue = "#d7686a";
  switch (kind) {
    case "grin": {
      const shape = P(`M ${x - w} ${y - 1} Q ${x} ${y - 2} ${x + w} ${y - 1} Q ${x + w * 0.9} ${y + w * 1.15} ${x} ${y + w * 1.2} Q ${x - w * 0.9} ${y + w * 1.15} ${x - w} ${y - 1} Z`);
      fill(ctx, shape, inside);
      within(ctx, shape, () => {
        fill(ctx, ell(x + 0.6, y + w * 1.2, w * 0.75, w * 0.6), tongue);
        fill(ctx, rect(x - w, y - 2, w * 2, 2.6), "#fbf6ea");
      });
      outline(ctx, shape, 1.2);
      break;
    }
    case "open": {
      const shape = ell(x, y + w * 0.35, w * 0.75, w * 0.85);
      fill(ctx, shape, inside);
      within(ctx, shape, () => fill(ctx, ell(x + 0.3, y + w * 1.05, w * 0.55, w * 0.42), tongue));
      outline(ctx, shape, 1.2);
      break;
    }
    case "o": {
      const shape = ell(x, y, w * 0.5, w * 0.62);
      fill(ctx, shape, inside);
      within(ctx, shape, () => fill(ctx, ell(x, y + w * 0.5, w * 0.4, w * 0.3), tongue));
      outline(ctx, shape, 1.1);
      break;
    }
    case "frown":
      line(ctx, `M ${x - w} ${y + 1.2} Q ${x} ${y - 1.6} ${x + w} ${y + 1.2}`, 1.6);
      break;
    case "smirk":
      line(ctx, `M ${x - w} ${y} Q ${x} ${y + 2.2} ${x + w} ${y - 1.4}`, 1.5);
      break;
    case "grit": {
      const shape = rect(x - w, y - w * 0.45, w * 2, w * 0.95, w * 0.35);
      fill(ctx, shape, "#fbf6ea");
      within(ctx, shape, () => {
        line(ctx, `M ${x - w} ${y + 0.1} L ${x + w} ${y + 0.1}`, 0.8);
        for (let i = -1; i <= 1; i += 1) {
          line(ctx, `M ${x + i * w * 0.5} ${y - w} L ${x + i * w * 0.5} ${y + w}`, 0.7);
        }
      });
      outline(ctx, shape, 1.2);
      break;
    }
    case "roar":
    case "wail": {
      const deep = kind === "roar" ? 1.15 : 0.95;
      const shape = P(
        `M ${x - w} ${y - 1.2} Q ${x} ${y - 3} ${x + w} ${y - 1.2} ` +
          `Q ${x + w * 1.05} ${y + w * deep} ${x} ${y + w * deep * 1.05} Q ${x - w * 1.05} ${y + w * deep} ${x - w} ${y - 1.2} Z`,
      );
      fill(ctx, shape, "#3a1c1c");
      within(ctx, shape, () => {
        fill(ctx, ell(x + 0.4, y + w * deep * 1.05, w * 0.72, w * 0.5), kind === "roar" ? "#c85c5c" : "#b8606a");
        // Fangzaehne oben
        for (const side of [-1, 1]) {
          const fx = x + side * w * 0.55;
          fill(ctx, P(`M ${fx - 1.5} ${y - 2} L ${fx + 1.5} ${y - 2} L ${fx + 0.2} ${y + 3} Z`), "#fbf6ea");
        }
        if (kind === "roar") {
          for (const side of [-1, 1]) {
            const fx = x + side * w * 0.3;
            fill(ctx, P(`M ${fx - 1.2} ${y + w * deep + 2} L ${fx + 1.2} ${y + w * deep + 2} L ${fx} ${y + w * deep - 1.6} Z`), "#fbf6ea");
          }
        }
      });
      outline(ctx, shape, 1.25);
      break;
    }
  }
}

// --- Koerperteile -------------------------------------------------------------------

/** Faust (Faeustling) mit angedeuteten Fingern. `dir` = Richtung des Daumens (-1 links, 1 rechts). */
export function fist(ctx: Ctx, x: number, y: number, base: string, shade: string, dir: -1 | 1 = 1, size = 4.6): void {
  part(ctx, ell(x, y, size, size * 0.92), { base, shade, dx: 1, dy: 1.2 });
  line(ctx, `M ${x - size * 0.5} ${y - size * 0.25} L ${x + size * 0.45} ${y - size * 0.25}`, 0.8);
  line(ctx, `M ${x - size * 0.5} ${y + size * 0.2} L ${x + size * 0.45} ${y + size * 0.2}`, 0.8);
  // Daumen
  part(ctx, ell(x + dir * size * 0.62, y - size * 0.15, size * 0.38, size * 0.5, dir * 0.4), { base, shade, dx: 0.5, dy: 0.6, line: 1 });
}

/** Krallenhand eines Monsters (drei gespreizte Finger). */
export function claw(ctx: Ctx, x: number, y: number, base: string, shade: string, dir: -1 | 1, size = 5): void {
  const s = size;
  const d = dir;
  const shape = P(
    `M ${x - d * s * 0.6} ${y + s * 0.5} ` +
      `Q ${x - d * s * 0.9} ${y - s * 0.2} ${x - d * s * 0.4} ${y - s * 0.6} ` +
      `L ${x - d * s * 0.2} ${y - s * 1.4} L ${x + d * s * 0.05} ${y - s * 0.6} ` +
      `L ${x + d * s * 0.45} ${y - s * 1.35} L ${x + d * s * 0.5} ${y - s * 0.45} ` +
      `L ${x + d * s * 1.2} ${y - s * 0.95} L ${x + d * s * 0.9} ${y + s * 0.1} ` +
      `Q ${x + d * s * 0.7} ${y + s * 0.8} ${x - d * s * 0.6} ${y + s * 0.5} Z`,
  );
  part(ctx, shape, { base, shade, dx: 0.8, dy: 1 });
}

/** Stiefel; `dir` = Richtung der Spitze. */
export function boot(ctx: Ctx, x: number, y: number, base: string, shade: string, dir: -1 | 1, w = 8, h = 8): void {
  const toe = x + dir * w * 0.95;
  const heel = x - dir * w * 0.6;
  const shape = P(
    `M ${heel} ${y - h} L ${x + dir * w * 0.45} ${y - h} ` +
      `Q ${x + dir * w * 0.55} ${y - h * 0.4} ${toe - dir * 1.5} ${y - h * 0.38} ` +
      `Q ${toe + dir * 0.5} ${y - h * 0.3} ${toe} ${y - 1.2} ` +
      `Q ${toe} ${y + 0.4} ${toe - dir * 2} ${y + 0.4} L ${heel + dir * 0.5} ${y + 0.4} ` +
      `Q ${heel - dir * 0.6} ${y + 0.4} ${heel - dir * 0.6} ${y - 1.6} Z`,
  );
  part(ctx, shape, { base, shade, dx: dir * -0.8, dy: 1.2 });
  // Sohle
  line(ctx, `M ${heel} ${y - 1.4} L ${toe - dir * 1.4} ${y - 1.4}`, 0.8, "rgba(42,32,27,0.7)");
}

/** Guertel mit Schnalle quer ueber den Bauch. */
export function belt(ctx: Ctx, y: number, left: number, right: number, color = "#6b4428", shade = "#4e2f1a", buckle = "#c99a45", sag = 2.5): void {
  const mid = (left + right) / 2;
  const band = P(`M ${left} ${y} Q ${mid} ${y + sag} ${right} ${y} L ${right + 0.2} ${y + 4.6} Q ${mid} ${y + sag + 4.6} ${left - 0.2} ${y + 4.6} Z`);
  part(ctx, band, { base: color, shade, dx: 0.4, dy: 1.2, line: 1.15 });
  const bx = mid + 1;
  const by = y + sag * 0.75 + 2.3;
  part(ctx, rect(bx - 3.6, by - 3.1, 7.2, 6.2, 1), { base: buckle, shade: "#8f6a2a", dx: 0.6, dy: 0.8, line: 1.1 });
  part(ctx, rect(bx - 1.6, by - 1.3, 3.2, 2.6, 0.4), { base: color, line: 0.8 });
}

/** Faltenlinien in Schattenfarbe (keine Kontur, weich). */
export function folds(ctx: Ctx, lines: readonly string[], color: string, width = 1.1): void {
  for (const d of lines) {
    line(ctx, d, width, color);
  }
}

// --- Korn ---------------------------------------------------------------------------

let grainPattern: HTMLCanvasElement | null = null;

function grainCanvas(): HTMLCanvasElement | null {
  if (grainPattern) {
    return grainPattern;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  // Fester Zufall: jedes Mal das gleiche Korn.
  let seed = 1234567;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const image = ctx.createImageData(96, 96);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = random() < 0.5 ? 0 : 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = Math.floor(random() * 255);
  }
  ctx.putImageData(image, 0, 0);
  grainPattern = canvas;
  return canvas;
}

/**
 * Legt ein feines Korn und einen Hauch Licht/Schatten ueber alles, was schon
 * gemalt ist (Pixel ausserhalb der Figur bleiben durchsichtig).
 * Arbeitet in Leinwand-Pixeln, also ohne Transformation aufrufen.
 */
export function grainOver(ctx: Ctx, width: number, height: number, strength = 0.07): void {
  const noise = grainCanvas();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  if (noise) {
    const pattern = ctx.createPattern(noise, "repeat");
    if (pattern) {
      ctx.globalAlpha = strength;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  }
  // Licht von oben links, unten rechts etwas dunkler: gibt Rundung.
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(255,248,230,0.10)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(20,14,30,0.16)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Ein runder Schlauch entlang eines Pfades (Arm, Bein, Schwanz):
 * dunkle Kontur, Schattenfarbe, darin etwas nach oben links versetzt die Grundfarbe.
 */
export function tube(ctx: Ctx, d: string, width: number, base: string, shade: string, outlineWidth = LW): void {
  const path = P(d);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width + outlineWidth * 2;
  ctx.strokeStyle = LINE;
  ctx.stroke(path);
  ctx.lineWidth = width;
  ctx.strokeStyle = shade;
  ctx.stroke(path);
  ctx.translate(-width * 0.12, -width * 0.12);
  ctx.lineWidth = width * 0.6;
  ctx.strokeStyle = base;
  ctx.stroke(path);
  ctx.restore();
}
