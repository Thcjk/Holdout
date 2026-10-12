/**
 * Zeichnet App-Icon und Splash im Poster-Stil. Laeuft im Browser (siehe
 * `tools/generate-brand.mjs`) und benutzt dasselbe Logo und dieselben Figuren
 * wie das Spiel - das Icon ist das Gesicht des Soeldners auf Creme-Papier.
 */

import { createComicTextures } from "../../src/ui/comic";
import { renderHero } from "../../src/ui/comicFigures";
import { grain, seeded } from "../../src/ui/paper";

const captured = new Map<string, HTMLCanvasElement>();

function make(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d") as CanvasRenderingContext2D];
}

function paper(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = "#f1e5c9";
  ctx.fillRect(0, 0, width, height);
  // Blasse Berge unten
  const random = seeded(3);
  for (const [base, color, amp] of [[0.78, "#d9d6bd", 0.12], [0.86, "#b8c4b0", 0.08]] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += width / 12) {
      ctx.lineTo(x, height * base - random() * height * amp);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }
  grain(ctx, width, height, 0.4, random);
  const age = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.75);
  age.addColorStop(0, "rgba(120,90,50,0)");
  age.addColorStop(1, "rgba(120,90,50,0.3)");
  ctx.fillStyle = age;
  ctx.fillRect(0, 0, width, height);
}

/** Icon: der Soeldner gross auf Papier. `scale` = Anteil der Kantenlaenge. */
export function icon(size: number, scale: number, transparent: boolean): string {
  const [canvas, ctx] = make(size, size);
  if (!transparent) {
    paper(ctx, size, size);
  }
  const s = size * scale * 1.18;
  const hero = renderHero("soeldner", Math.round(s));
  if (hero) {
    // Der Kopf soll in der Mitte sitzen, also die Figur etwas nach unten schieben.
    ctx.drawImage(hero, (size - s) / 2 - s * 0.03, (size - s) / 2 + s * 0.14, s, s);
  }
  return canvas.toDataURL("image/png");
}

export function splash(width: number, height: number): string {
  const [canvas, ctx] = make(width, height);
  paper(ctx, width, height);
  const logo = captured.get("logo");
  const portrait = height > width;
  const logoW = Math.min(width * 0.86, portrait ? width * 0.86 : height * 1.5);
  const logoH = logoW * (300 / 900);
  const heroes = ["soeldner", "raufbold", "jaeger", "panzer", "glueckspilz", "schatten"];
  const heroSize = Math.min(logoW / 5.2, height * 0.2);
  const blockH = logoH + heroSize * 1.1;
  const top = (height - blockH) / 2;
  if (logo) {
    ctx.drawImage(logo, (width - logoW) / 2, top, logoW, logoH);
  }
  heroes.forEach((id, index) => {
    const hero = captured.get(`ch-${id}`);
    if (hero) {
      const x = width / 2 - (heroes.length * heroSize * 0.82) / 2 + index * heroSize * 0.82 - heroSize * 0.09;
      ctx.drawImage(hero, x, top + logoH + heroSize * 0.05, heroSize, heroSize);
    }
  });
  return canvas.toDataURL("image/png");
}

/** Erst die Schriften laden, dann malen - das Logo braucht sie. */
async function prepare(): Promise<void> {
  await Promise.all([
    document.fonts.load(`900 48px "Londrina Solid"`),
    document.fonts.load(`20px "Patrick Hand SC"`),
  ]);
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
