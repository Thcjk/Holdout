/**
 * Pixel-Kit: Figuren, Waffen und Welt werden Pixel fuer Pixel per Code gemalt.
 *
 * Es gibt KEINE Kantenglaettung: Jede Form (Ellipse, Vieleck, Rechteck) wird
 * auf ganze Pixel gerastert. Jede Form bekommt eine Farbrampe aus vier Toenen
 *   [Kante, Schatten, Grundton, Licht]
 * und wird automatisch schattiert wie in handgemalter Pixel-Art:
 *   - Licht von oben links: ein heller Pixelrand oben/links,
 *   - Schatten unten rechts: ein dunkles Band (Breite `shade`),
 *   - Kante: Wo die Form an schon Gemaltes grenzt, wird ihr Rand dunkel -
 *     so trennen sich Helm, Gesicht und Ruestung voneinander.
 * Zum Schluss legt `outline()` einen 1-Pixel-Umriss um die ganze Figur.
 *
 * Koordinaten: x nach rechts, y nach unten, (0,0) ist das Pixel oben links.
 * Masken pruefen die Pixelmitte (x + 0.5, y + 0.5).
 */

export type Ramp = readonly [edge: string, dark: string, base: string, light: string];

/** Eine Form als Frage "liegt dieses Pixel drin?" plus ein Rahmen, in dem gesucht wird. */
export interface Mask {
  test(x: number, y: number): boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ShadeOptions {
  /** Breite des Schattenbands unten rechts (0 = keins). */
  shade?: number;
  /** Breite des Lichtrands oben links (0 = keiner). */
  light?: number;
  /** Dunkle Kante, wo die Form an schon Gemaltes grenzt (Standard: an). */
  edge?: boolean;
  /** Schachbrett-Uebergang zwischen Schatten und Grundton. */
  dither?: boolean;
  /** Anteil zufaelliger heller/dunkler Pixel (Textur fuer Bronze, Stein ...). */
  noise?: number;
  /** Nur in der Grundfarbe, ohne Licht und Schatten. */
  flat?: boolean;
  /** Heller Rand oben links auch bei kleinen Formen (wie `light: 1`). */
  rim?: boolean;
}

// --- Masken -------------------------------------------------------------------------

export function ellipse(cx: number, cy: number, rx: number, ry: number): Mask {
  return {
    test: (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1,
    x0: Math.floor(cx - rx - 1),
    y0: Math.floor(cy - ry - 1),
    x1: Math.ceil(cx + rx + 1),
    y1: Math.ceil(cy + ry + 1),
  };
}

export function rect(x: number, y: number, w: number, h: number): Mask {
  return {
    test: (px, py) => px >= x && px < x + w && py >= y && py < y + h,
    x0: Math.floor(x),
    y0: Math.floor(y),
    x1: Math.ceil(x + w),
    y1: Math.ceil(y + h),
  };
}

/** Vieleck aus Punkten [x, y, x, y, ...] (gerade/ungerade-Regel). */
export function poly(...points: number[]): Mask {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    xs.push(points[i] ?? 0);
    ys.push(points[i + 1] ?? 0);
  }
  const n = xs.length;
  return {
    test: (px, py) => {
      const x = px + 0.5;
      const y = py + 0.5;
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
        const xi = xs[i] ?? 0;
        const yi = ys[i] ?? 0;
        const xj = xs[j] ?? 0;
        const yj = ys[j] ?? 0;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    },
    x0: Math.floor(Math.min(...xs)) - 1,
    y0: Math.floor(Math.min(...ys)) - 1,
    x1: Math.ceil(Math.max(...xs)) + 1,
    y1: Math.ceil(Math.max(...ys)) + 1,
  };
}

/** Andere Schreibweise fuer `ellipse`. */
export const oval = ellipse;

/** Dicke Linie von (x0,y0) nach (x1,y1) mit Breite `w` - fuer Stangen, Knochen, Arme. */
export function thick(x0: number, y0: number, x1: number, y1: number, w: number): Mask {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * (w / 2);
  const ny = (dx / length) * (w / 2);
  return poly(x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny);
}

/** Pixel, die in einer der Masken liegen. */
export function union(...masks: Mask[]): Mask {
  return {
    test: (x, y) => masks.some((mask) => mask.test(x, y)),
    x0: Math.min(...masks.map((m) => m.x0)),
    y0: Math.min(...masks.map((m) => m.y0)),
    x1: Math.max(...masks.map((m) => m.x1)),
    y1: Math.max(...masks.map((m) => m.y1)),
  };
}

/** Pixel aus `a`, die nicht in `b` liegen. */
export function minus(a: Mask, b: Mask): Mask {
  return { ...a, test: (x, y) => a.test(x, y) && !b.test(x, y) };
}

/** Pixel, die in `a` UND `b` liegen. */
export function clip(a: Mask, b: Mask): Mask {
  return { ...a, test: (x, y) => a.test(x, y) && b.test(x, y) };
}

// --- Farben ---------------------------------------------------------------------------

const colorCache = new Map<string, [number, number, number, number]>();

export function rgba(hex: string): [number, number, number, number] {
  let cached = colorCache.get(hex);
  if (!cached) {
    const h = hex.replace("#", "");
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    const a = h.length >= 8 ? Number.parseInt(h.slice(6, 8), 16) : 255;
    cached = [r, g, b, a];
    colorCache.set(hex, cached);
  }
  return cached;
}

/** Mischt zwei Farben (t = 0: a, t = 1: b). */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = rgba(a);
  const [br, bg, bb] = rgba(b);
  const h = (v: number): string => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(ar + (br - ar) * t)}${h(ag + (bg - ag) * t)}${h(ab + (bb - ab) * t)}`;
}

// --- Leinwand -----------------------------------------------------------------------------

export class Pix {
  readonly w: number;
  readonly h: number;
  private readonly data: Uint8ClampedArray;
  private seed: number;

  constructor(w: number, h: number, seed = 7) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
    this.seed = seed;
  }

  /** Fester Zufall (gleiches Bild bei jedem Start). */
  random(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  painted(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) {
      return false;
    }
    return (this.data[(y * this.w + x) * 4 + 3] ?? 0) > 0;
  }

  /** Ein Pixel setzen. Halbdurchsichtige Farben werden ueber das Vorhandene gemischt. */
  px(x: number, y: number, color: string): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) {
      return;
    }
    const [r, g, b, a] = rgba(color);
    const i = (iy * this.w + ix) * 4;
    if (a >= 255 || (this.data[i + 3] ?? 0) === 0) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = a;
      return;
    }
    const k = a / 255;
    this.data[i] = (this.data[i] ?? 0) * (1 - k) + r * k;
    this.data[i + 1] = (this.data[i + 1] ?? 0) * (1 - k) + g * k;
    this.data[i + 2] = (this.data[i + 2] ?? 0) * (1 - k) + b * k;
  }

  /** Waagerechte Reihe. */
  hline(x0: number, x1: number, y: number, color: string): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      this.px(x, y, color);
    }
  }

  /** Gerade Linie (Bresenham) - fuer Klingen, Stangen, Risse. */
  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x, y, color);
      if (x === tx && y === ty) {
        break;
      }
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Eine Reihe Pixel aus einem Text-Muster: '.' leer, sonst Zeichen -> Farbe. */
  pattern(x: number, y: number, rows: readonly string[], colors: Record<string, string>): void {
    rows.forEach((row, dy) => {
      [...row].forEach((ch, dx) => {
        const color = colors[ch];
        if (color) {
          this.px(x + dx, y + dy, color);
        }
      });
    });
  }

  /** Flaeche in EINER Farbe, ohne Schattierung und ohne Kante. */
  fill(mask: Mask, color: string): void {
    for (let y = Math.max(0, mask.y0); y <= Math.min(this.h - 1, mask.y1); y += 1) {
      for (let x = Math.max(0, mask.x0); x <= Math.min(this.w - 1, mask.x1); x += 1) {
        if (mask.test(x, y)) {
          this.px(x, y, color);
        }
      }
    }
  }

  /** Ein Pixel nur dort setzen, wo schon etwas gemalt ist (Muster auf Flaechen). */
  pxOn(x: number, y: number, color: string): void {
    if (this.painted(Math.round(x), Math.round(y))) {
      this.px(x, y, color);
    }
  }

  /** Malt eine Form mit Rampe und automatischer Schattierung (siehe Dateikopf). */
  shape(mask: Mask, ramp: Ramp, options: ShadeOptions = {}): void {
    const shade = options.shade ?? 1;
    const light = options.light ?? 1;
    const edge = options.edge ?? true;
    const x0 = Math.max(0, mask.x0);
    const y0 = Math.max(0, mask.y0);
    const x1 = Math.min(this.w - 1, mask.x1);
    const y1 = Math.min(this.h - 1, mask.y1);
    const m = (x: number, y: number): boolean => mask.test(x, y);
    // Erst entscheiden, dann malen - sonst saehe die Form ihre eigenen Pixel als "schon gemalt".
    const out: [number, number, string][] = [];
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (!m(x, y)) {
          continue;
        }
        let color = ramp[2];
        if (!options.flat) {
          const atEdge =
            edge &&
            ((!m(x - 1, y) && this.painted(x - 1, y)) ||
              (!m(x + 1, y) && this.painted(x + 1, y)) ||
              (!m(x, y - 1) && this.painted(x, y - 1)) ||
              (!m(x, y + 1) && this.painted(x, y + 1)));
          // Abstand zum Rand unten rechts: 1 = ganz am Rand (Schatten), 2.. = Halbschatten.
          let shadowDistance = 0;
          for (let k = 1; k <= shade; k += 1) {
            if (!m(x + k, y) || !m(x, y + k) || !m(x + k, y + k)) {
              shadowDistance = k;
              break;
            }
          }
          const inLight = light > 0 && (!m(x - light, y) || !m(x, y - light));
          if (atEdge) {
            color = ramp[0];
          } else if (shadowDistance === 1) {
            color = ramp[1];
          } else if (shadowDistance > 1) {
            color = mix(ramp[1], ramp[2], 0.5);
          } else if (inLight) {
            color = ramp[3];
          } else if (options.dither && (x + y) % 2 === 0 && (!m(x + shade + 1, y) || !m(x, y + shade + 1))) {
            color = mix(ramp[1], ramp[2], 0.5);
          }
          if (options.noise && color === ramp[2]) {
            const r = this.random();
            if (r < options.noise / 2) {
              color = ramp[1];
            } else if (r < options.noise) {
              color = ramp[3];
            }
          }
        }
        out.push([x, y, color]);
      }
    }
    for (const [x, y, color] of out) {
      this.px(x, y, color);
    }
  }

  /** Nur der Rand einer Form (1 Pixel) - fuer Ringe, Rahmen, Konturlinien. */
  ring(mask: Mask, color: string): void {
    const m = (x: number, y: number): boolean => mask.test(x, y);
    const out: [number, number][] = [];
    for (let y = Math.max(0, mask.y0); y <= Math.min(this.h - 1, mask.y1); y += 1) {
      for (let x = Math.max(0, mask.x0); x <= Math.min(this.w - 1, mask.x1); x += 1) {
        if (m(x, y) && (!m(x - 1, y) || !m(x + 1, y) || !m(x, y - 1) || !m(x, y + 1))) {
          out.push([x, y]);
        }
      }
    }
    for (const [x, y] of out) {
      this.px(x, y, color);
    }
  }

  /** 1-Pixel-Umriss um alles Gemalte (nur waagerecht/senkrecht benachbart). */
  outline(color: string): void {
    const out: [number, number][] = [];
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        if (!this.painted(x, y) && (this.painted(x - 1, y) || this.painted(x + 1, y) || this.painted(x, y - 1) || this.painted(x, y + 1))) {
          out.push([x, y]);
        }
      }
    }
    for (const [x, y] of out) {
      this.px(x, y, color);
    }
  }

  /** Spiegelt das ganze Bild waagerecht. */
  mirror(): void {
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w / 2; x += 1) {
        const a = (y * this.w + x) * 4;
        const b = (y * this.w + (this.w - 1 - x)) * 4;
        for (let k = 0; k < 4; k += 1) {
          const t = this.data[a + k] ?? 0;
          this.data[a + k] = this.data[b + k] ?? 0;
          this.data[b + k] = t;
        }
      }
    }
  }

  /** Als Leinwand (1 Pixel = 1 Leinwandpixel); vergroessert wird beim Anzeigen. */
  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const image = ctx.createImageData(this.w, this.h);
      image.data.set(this.data);
      ctx.putImageData(image, 0, 0);
    }
    return canvas;
  }

  /** Vergroessert mit harten Pixeln (fuer Vorschauen, Icon, Splash). */
  toCanvasScaled(scale: number): HTMLCanvasElement {
    const small = this.toCanvas();
    const canvas = document.createElement("canvas");
    canvas.width = this.w * scale;
    canvas.height = this.h * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    }
    return canvas;
  }
}
