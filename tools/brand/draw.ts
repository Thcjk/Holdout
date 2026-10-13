/**
 * Zeichnet App-Icon und Splash im Stil des Spiels. Laeuft im Browser (siehe
 * `tools/generate-brand.mjs`) und benutzt dasselbe Logo, dieselben Figuren und
 * dieselbe Landschaft wie das Spiel. Das Icon ist der Ritter vor schieferblauem
 * Nachthimmel.
 */

import { createComicTextures } from "../../src/ui/comic";
import { renderHero } from "../../src/ui/comicFigures";
import { paintLandscape } from "../../src/ui/landscape";
import { seeded } from "../../src/ui/paper";

const captured = new Map<string, HTMLCanvasElement>();

function make(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d") as CanvasRenderingContext2D];
}

/** Schieferblauer Nachthimmel mit Sternen - Hintergrund des Icons. */
function night(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const sky = ctx.createRadialGradient(width / 2, height * 0.4, width * 0.1, width / 2, height * 0.5, width * 0.75);
  sky.addColorStop(0, "#5d6d88");
  sky.addColorStop(1, "#2e3850");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const random = seeded(5);
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `rgba(255,248,220,${0.3 + random() * 0.5})`;
    ctx.beginPath();
    ctx.arc(random() * width, random() * height * 0.6, (0.6 + random()) * (width / 192), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Icon: der Ritter gross, der Kopf in der Mitte. `scale` = Anteil der Kantenlaenge. */
export function icon(size: number, scale: number, transparent: boolean): string {
  const [canvas, ctx] = make(size, size);
  if (!transparent) {
    night(ctx, size, size);
  }
  // Die Figur so gross malen, dass der Kopf (Raster 50/42) das Icon fuellt.
  const s = size * scale * 1.55;
  const hero = renderHero("ritter", Math.round(s));
  if (hero) {
    const unit = (s * (1 - 12 / 208)) / 100;
    const pad = (s * 6) / 208;
    const x = size / 2 - (pad + 50 * unit);
    const y = size * 0.5 - (pad + 44 * unit);
    ctx.drawImage(hero, x, y, s, s);
  }
  return canvas.toDataURL("image/png");
}

export function splash(width: number, height: number): string {
  const [canvas, ctx] = make(width, height);
  // Landschaft so skaliert, dass sie die Flaeche fuellt (wie "cover").
  const scale = Math.max(width / 1600, height / 540);
  ctx.save();
  ctx.translate((width - 1600 * scale) / 2, height - 540 * scale);
  ctx.scale(scale, scale);
  paintLandscape(ctx, 1600, 540);
  ctx.restore();
  if (height > 540 * scale) {
    ctx.fillStyle = "#2e3850";
    ctx.fillRect(0, 0, width, height - 540 * scale);
  }
  const logo = captured.get("logo");
  const portrait = height > width;
  const logoW = Math.min(width * 0.86, portrait ? width * 0.86 : height * 1.4);
  const logoH = logoW * (360 / 900);
  const heroes = ["ritter", "magierin", "schurke", "elfe", "zwerg", "zauberer"];
  const heroSize = Math.min(logoW / 4.6, height * 0.24);
  const blockH = logoH + heroSize * 1.05;
  const top = (height - blockH) / 2;
  if (logo) {
    ctx.drawImage(logo, (width - logoW) / 2, top, logoW, logoH);
  }
  heroes.forEach((id, index) => {
    const hero = captured.get(`ch-${id}`);
    if (hero) {
      const x = width / 2 - (heroes.length * heroSize * 0.78) / 2 + index * heroSize * 0.78 - heroSize * 0.11;
      ctx.drawImage(hero, x, top + logoH, heroSize, heroSize);
    }
  });
  return canvas.toDataURL("image/png");
}

/** Erst die Schriften laden, dann malen - das Logo braucht sie. */
async function prepare(): Promise<void> {
  await Promise.all([document.fonts.load(`48px "Lilita One"`), document.fonts.load(`500 20px "Fredoka"`)]);
  const scene = {
    textures: {
      exists: () => false,
      addCanvas: (key: string, canvas: HTMLCanvasElement) => {
        captured.set(key, canvas);
        return { setFilter() {} };
      },
    },
  };
  createComicTextures(scene as never);
}

(window as unknown as Record<string, unknown>).brand = { icon, splash, ready: prepare() };
