/**
 * Aeltere Grundlagen des Looks (Farben, Linien, Zufall). Der aktuelle Look
 * "Zeitriss" steht in `theme.ts`; Schriften werden von dort weitergereicht.
 * (Der Dateiname stammt aus der Papier-Fassung.)
 */

/** Schriften kommen jetzt aus `theme.ts` (Pixelschriften); hier nur weitergereicht. */
export { FONT_BODY as FONT_HAND, FONT_TITLE, waitForFonts } from "./theme";

/** Die Kontur: sehr dunkles Braun statt Schwarz - wirkt weicher, wie gezeichnet. */
export const INK = 0x2b2320;
/** Pergament fuer Tafeln und Einlagen. */
export const PAPER = 0xf4e4c1;
export const PAPER_DARK = 0xe2cc9c;
/** Rot fuer Leben und Gefahr. (Name aus der Papier-Fassung.) */
export const RUST = 0xd9473b;
export const GOLD = 0xf0b23e;
export const WOOD = 0x8a5a33;
export const WOOD_DARK = 0x5e3b22;
export const SLATE = 0x4d5b6b;


/** Zufallsstrom mit festem Startwert - dieselbe Linie wackelt bei jedem Zeichnen gleich. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Punkte eines Rechtecks mit runden Ecken, dessen Rand leicht wackelt -
 * wie mit der Feder gezogen. `jitter` ist die groesste Abweichung in Pixeln.
 */
export function wobblyRect(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  seed: number,
  jitter = 1.4,
): Point[] {
  // Im Chibi-Look sind die Kanten sauber: Startwert und Zittern bleiben nur fuer die Schnittstelle.
  void seed;
  void jitter;
  const r = Math.min(radius, w / 2, h / 2);
  const points: Point[] = [];
  const push = (px: number, py: number): void => {
    points.push({ x: px, y: py });
  };
  const edge = (x0: number, y0: number, x1: number, y1: number): void => {
    const length = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.round(length / 16));
    for (let i = 0; i < steps; i += 1) {
      push(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    }
  };
  const corner = (cx: number, cy: number, from: number): void => {
    for (let i = 0; i < 6; i += 1) {
      const a = from + (i / 6) * (Math.PI / 2);
      push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  };
  edge(x + r, y, x + w - r, y);
  corner(x + w - r, y + r, -Math.PI / 2);
  edge(x + w, y + r, x + w, y + h - r);
  corner(x + w - r, y + h - r, 0);
  edge(x + w - r, y + h, x + r, y + h);
  corner(x + r, y + h - r, Math.PI / 2);
  edge(x, y + h - r, x, y + r);
  corner(x + r, y + r, Math.PI);
  return points;
}

/** Feines Papierkorn auf eine Leinwand streuen. */
export function grain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  density: number,
  random: () => number,
): void {
  const count = Math.round(width * height * density);
  for (let i = 0; i < count; i += 1) {
    context.fillStyle = random() < 0.55 ? "rgba(70,52,30,0.07)" : "rgba(255,250,232,0.12)";
    const size = 0.8 + random() * 1.8;
    context.fillRect(random() * width, random() * height, size, size);
  }
}

/** Eine dunkle Linie (frueher: wackelnde Tuschelinie). */
export function inkLine(
  context: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  width: number,
  random: () => number,
  color = "#1d1c19",
): void {
  context.beginPath();
  points.forEach(([x, y], index) => {
    const jx = x + (random() - 0.5) * width * 0.6;
    const jy = y + (random() - 0.5) * width * 0.6;
    if (index === 0) {
      context.moveTo(jx, jy);
    } else {
      context.lineTo(jx, jy);
    }
  });
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = width;
  context.strokeStyle = color;
  context.stroke();
}
