/**
 * Der Look "Zeitriss": Schriften, Farben und kleine Hilfen fuer die Oberflaeche.
 *
 * Pixel-Art. Rahmen aus Bronze und dunklem Stein (die Antike), darin feine
 * leuchtende Linien in Violett und Cyan (der Zeitriss und die Technik der Mechs).
 */

/** Ueberschriften, grosse Zahlen: hohe, schmale Pixelschrift (Jersey 10, OFL). */
export const FONT_TITLE = '"Jersey 10", "Pixelify Sans", monospace';
/** Fliesstext, Knoepfe: gut lesbare Pixelschrift (Pixelify Sans, OFL). */
export const FONT_BODY = '"Pixelify Sans", "Trebuchet MS", monospace';

/** Farben als Zahl (fuer Phaser-Grafik). */
export const C = {
  outline: 0x120f1e,
  stone: 0x24202f,
  stoneMid: 0x342e44,
  stoneLight: 0x4a4260,
  inset: 0x18151f,
  bronzeDark: 0x6e4a22,
  bronze: 0xb8864a,
  bronzeLight: 0xe2bd7e,
  gold: 0xf0b23e,
  goldLight: 0xffe08a,
  goldDark: 0x9c6420,
  violet: 0x9a5ad8,
  violetLight: 0xd0a6ff,
  violetDark: 0x5e2a8c,
  cyan: 0x5ef2e6,
  tech: 0x2c2f52,
  techLight: 0x454c80,
  techDark: 0x1c1f3a,
  red: 0xd84a3e,
  green: 0x6cd26a,
} as const;

/** Textfarben (fuer Phaser-Text). */
export const T = {
  light: "#efe8f6",
  body: "#ddd4ea",
  muted: "#a99cc2",
  gold: "#f6c24c",
  violet: "#d0a6ff",
  cyan: "#7ff6ec",
  good: "#86e07e",
  bad: "#ff7a6a",
  dark: "#1d1308",
  outline: "#120f1e",
} as const;

/** Wartet, bis die Pixelschriften geladen sind (hoechstens drei Sekunden). */
export async function waitForFonts(): Promise<void> {
  if (!("fonts" in document)) {
    return;
  }
  const load = Promise.all([
    document.fonts.load(`40px "Jersey 10"`),
    document.fonts.load(`500 20px "Pixelify Sans"`),
    document.fonts.load(`700 20px "Pixelify Sans"`),
  ]);
  const timeout = new Promise((resolve) => window.setTimeout(resolve, 3000));
  await Promise.race([load.catch(() => undefined), timeout]);
}

/** Zufallsstrom mit festem Startwert - dasselbe Bild bei jedem Start. */
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
