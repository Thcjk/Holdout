/**
 * Zeichnet Icon und Splash im Comic-Stil. Laeuft im Browser (siehe
 * `tools/generate-brand.mjs`), nutzt dasselbe Logo und dieselben Figuren wie das Spiel.
 */

import { createComicTextures } from "../../src/ui/comic";

const INK = "#14101c";
const captured = new Map<string, HTMLCanvasElement>();
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

function make(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext("2d") as CanvasRenderingContext2D];
}

function background(ctx: CanvasRenderingContext2D, width: number, height: number, cy: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#4a2f95");
  gradient.addColorStop(1, "#1b1233");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const reach = Math.hypot(width, height);
  const rays = 24;
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let i = 0; i < rays; i += 2) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = ((i + 1) / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(width / 2, cy);
    ctx.lineTo(width / 2 + Math.cos(a0) * reach, cy + Math.sin(a0) * reach);
    ctx.lineTo(width / 2 + Math.cos(a1) * reach, cy + Math.sin(a1) * reach);
    ctx.closePath();
    ctx.fill();
  }
  const step = Math.max(14, Math.min(width, height) / 22);
  ctx.fillStyle = "rgba(255,120,200,0.14)";
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2 + (Math.floor(y / step) % 2) * (step / 2); x < width; x += step) {
      const radius = (y / height) * step * 0.24;
      if (radius > 0.8) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function burst(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, spikes: number): void {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2 + 0.1;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

const H_POINTS: [number, number][] = [
  [-0.3, -0.36], [-0.12, -0.36], [-0.12, -0.09], [0.12, -0.09], [0.12, -0.36], [0.3, -0.36],
  [0.3, 0.36], [0.12, 0.36], [0.12, 0.09], [-0.12, 0.09], [-0.12, 0.36], [-0.3, 0.36],
];

function hPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.beginPath();
  H_POINTS.forEach(([x, y], index) => {
    const px = cx + (x - y * 0.14) * s;
    const py = cy + y * s;
    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.closePath();
}

/** Knall-Stern mit grossem gelbem H. `size` = Kantenlaenge, `scale` = Anteil davon. */
function motif(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, scale: number): void {
  const R = size * 0.5 * scale;
  ctx.lineJoin = "round";
  // Stern
  burst(ctx, cx, cy, R, R * 0.7, 14);
  ctx.lineWidth = size * 0.035 * scale * 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#e4572e";
  ctx.fill();
  burst(ctx, cx, cy, R * 0.82, R * 0.58, 14);
  ctx.fillStyle = "#ff9f1c";
  ctx.fill();
  // H
  const s = size * 0.92 * scale;
  hPath(ctx, cx + s * 0.035, cy + s * 0.045, s);
  ctx.lineWidth = s * 0.1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fill();
  hPath(ctx, cx, cy, s);
  ctx.lineWidth = s * 0.1;
  ctx.stroke();
  ctx.strokeStyle = "#fffaf0";
  ctx.lineWidth = s * 0.05;
  ctx.stroke();
  const fill = ctx.createLinearGradient(0, cy - s * 0.36, 0, cy + s * 0.36);
  fill.addColorStop(0, "#fff27a");
  fill.addColorStop(0.5, "#ffc21f");
  fill.addColorStop(1, "#ff7a1a");
  ctx.fillStyle = fill;
  ctx.fill();
}

export function icon(size: number, scale: number, transparent: boolean): string {
  const [canvas, ctx] = make(size, size);
  if (!transparent) {
    background(ctx, size, size, size / 2);
  }
  motif(ctx, size / 2, size / 2, size, scale);
  return canvas.toDataURL("image/png");
}

export function splash(width: number, height: number): string {
  const [canvas, ctx] = make(width, height);
  const logo = captured.get("logo");
  const portrait = height > width;
  const logoW = Math.min(width * 0.86, portrait ? width * 0.86 : height * 1.6);
  const logoH = logoW * (320 / 900);
  const heroes = ["soeldner", "raufbold", "jaeger", "panzer", "glueckspilz", "schatten"];
  const heroSize = Math.min(logoW / 6.4, height * 0.16);
  const blockH = logoH + heroSize * 1.4;
  const top = (height - blockH) / 2;
  background(ctx, width, height, top + logoH / 2);
  if (logo) {
    ctx.drawImage(logo, (width - logoW) / 2, top, logoW, logoH);
  }
  heroes.forEach((id, index) => {
    const canvas = captured.get(`ch-${id}`);
    if (canvas) {
      const x = width / 2 - (heroes.length * heroSize) / 2 + index * heroSize;
      ctx.drawImage(canvas, x, top + logoH + heroSize * 0.25, heroSize, heroSize);
    }
  });
  return canvas.toDataURL("image/png");
}

(window as unknown as Record<string, unknown>).brand = { icon, splash };
