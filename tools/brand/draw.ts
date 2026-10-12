/**
 * Zeichnet Icon und Splash im Comic-Stil. Laeuft im Browser (siehe
 * `tools/generate-brand.mjs`), nutzt dasselbe Logo und dieselben Figuren wie das Spiel.
 */

import { createComicTextures } from "../../src/ui/comic";

const INK = "#0a0910";
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
  gradient.addColorStop(0, "#222838");
  gradient.addColorStop(1, "#0a0910");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  const reach = Math.hypot(width, height);
  const rays = 24;
  ctx.fillStyle = "rgba(233,228,212,0.05)";
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
  ctx.fillStyle = "rgba(196,38,46,0.2)";
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

/** Rote Wunde mit grossem knochenweissem H. `size` = Kantenlaenge, `scale` = Anteil davon. */
function motif(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, scale: number): void {
  const R = size * 0.5 * scale;
  ctx.lineJoin = "round";
  // Schraeger Riss quer durchs Bild
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2);
  ctx.beginPath();
  ctx.moveTo(-R * 1.05, -R * 0.2);
  ctx.lineTo(-R * 0.5, -R * 0.42);
  ctx.lineTo(R * 0.1, -R * 0.3);
  ctx.lineTo(R * 0.7, -R * 0.46);
  ctx.lineTo(R * 1.05, -R * 0.24);
  ctx.lineTo(R * 0.9, R * 0.1);
  ctx.lineTo(R * 1.05, R * 0.34);
  ctx.lineTo(R * 0.4, R * 0.46);
  ctx.lineTo(-R * 0.2, R * 0.34);
  ctx.lineTo(-R * 0.8, R * 0.48);
  ctx.lineTo(-R * 1.0, R * 0.2);
  ctx.closePath();
  ctx.lineWidth = size * 0.05 * scale;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#c4262e";
  ctx.fill();
  ctx.fillStyle = "#7c1219";
  ctx.beginPath();
  ctx.moveTo(-R * 1.0, R * 0.2);
  ctx.lineTo(-R * 0.8, R * 0.48);
  ctx.lineTo(-R * 0.2, R * 0.34);
  ctx.lineTo(R * 0.4, R * 0.46);
  ctx.lineTo(R * 1.05, R * 0.34);
  ctx.lineTo(R * 0.9, R * 0.1);
  ctx.lineTo(R * 0.1, R * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // H
  const s = size * 0.92 * scale;
  hPath(ctx, cx + s * 0.03, cy + s * 0.04, s);
  ctx.lineWidth = s * 0.09;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fill();
  hPath(ctx, cx, cy, s);
  ctx.lineWidth = s * 0.09;
  ctx.stroke();
  const fill = ctx.createLinearGradient(0, cy - s * 0.36, 0, cy + s * 0.36);
  fill.addColorStop(0, "#e9e4d4");
  fill.addColorStop(0.55, "#e9e4d4");
  fill.addColorStop(0.56, "#b9b19b");
  fill.addColorStop(1, "#8d866f");
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
