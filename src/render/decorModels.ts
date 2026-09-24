/**
 * Selbst gebaute Low-Poly-Formen fuer die Umgebung.
 *
 * ================================================================
 * WARUM SELBST GEBAUT
 * ================================================================
 *
 * Das hochgeladene Kenney-Paket hat Figuren, Kisten und Waffen - aber keine
 * Baeume, Felsen, Pflanzen oder Zaeune in 3D. Ohne sie wirkte ein
 * Knoten-Gebiet leer (Rueckmeldung: "ziemlich leer so"). Diese Formen
 * entstehen aus wenigen Grundkoerpern (Kegel, Zylinder, Ikosaeder) mit harten
 * Kanten und flachen Farben - derselbe Low-Poly-Stil wie die Figuren und die
 * Referenz "Deadly Days". Kommt spaeter ein Umgebungspaket (z. B. Kenney
 * Nature Kit), ersetzt es diese Datei.
 *
 * ================================================================
 * EINE GEOMETRIE JE FORM, FARBEN IN DEN ECKPUNKTEN
 * ================================================================
 *
 * Ein Baum besteht aus Stamm und Krone in zwei Farben. Statt zwei Objekten
 * mit zwei Materialien wird alles zu EINER Geometrie verschmolzen, die Farbe
 * steht in jedem Eckpunkt (`vertexColors`). So ist jeder Baum eine einzige
 * Instanz - und alle Baeume zusammen ein einziger Zeichenaufruf.
 *
 * Alle Masse in Metern, der Fuss steht auf y = 0.
 */

import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  BoxGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ArenaPropKind } from "../systems/types";

/** Ein Teil einer Form: Geometrie, Farbe, Lage. */
interface Part {
  geometry: BufferGeometry;
  color: number;
  x?: number;
  y?: number;
  z?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotateX?: number;
  rotateZ?: number;
}

/**
 * Teile zu einer Geometrie verschmelzen. Ohne Index, damit jede Flaeche ihre
 * eigene Normale bekommt - das ergibt die harten Low-Poly-Kanten.
 */
function build(parts: Part[]): BufferGeometry {
  const pieces = parts.map((part) => {
    const geometry = part.geometry.toNonIndexed();
    geometry.deleteAttribute("uv");
    geometry.scale(part.scaleX ?? 1, part.scaleY ?? 1, part.scaleZ ?? 1);
    if (part.rotateX) geometry.rotateX(part.rotateX);
    if (part.rotateZ) geometry.rotateZ(part.rotateZ);
    geometry.translate(part.x ?? 0, part.y ?? 0, part.z ?? 0);
    const color = new Color(part.color);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    part.geometry.dispose();
    return geometry;
  });
  const merged = mergeGeometries(pieces) ?? new BufferGeometry();
  for (const piece of pieces) piece.dispose();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Eckpunkte leicht verschieben - aus einem Ikosaeder wird ein Felsbrocken.
 * Mit festem Startwert, damit jeder Stein bei jedem Start gleich aussieht.
 */
function lumpy(geometry: BufferGeometry, amount: number, seed: number): BufferGeometry {
  const position = geometry.getAttribute("position");
  let state = seed;
  const random = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  // Gleiche Eckpunkte gleich verschieben, sonst reisst die Form auf.
  const offsets = new Map<string, number>();
  for (let i = 0; i < position.count; i += 1) {
    const key = `${position.getX(i).toFixed(3)},${position.getY(i).toFixed(3)},${position.getZ(i).toFixed(3)}`;
    let factor = offsets.get(key);
    if (factor === undefined) {
      factor = 1 + (random() - 0.5) * 2 * amount;
      offsets.set(key, factor);
    }
    position.setXYZ(i, position.getX(i) * factor, position.getY(i) * factor, position.getZ(i) * factor);
  }
  return geometry;
}

// Farbpalette: warm und leicht entsaettigt, damit Figuren und Beute davor
// hervorstechen. Gruen bleibt "hier kann man sich verstecken" vorbehalten -
// Baeume sind dunkler als Buesche.
const TRUNK = 0x6b4a2f;
const LEAVES = [0x4f7d3a, 0x5c8c42, 0x6a8f3b];
const PINE = [0x2f5d3a, 0x3b6b40, 0x2d5236];
const ROCK = [0x8a8a86, 0x7c7a72, 0x96918a];
const BUSH = [0x5aa34a, 0x4e9a45, 0x68ad4e];
const GRASS = [0x7aa84a, 0x6d9c42, 0x8fb357];
const FLOWER = [0xf3d34a, 0xf0f0e6, 0xe4572e];
const BARREL = [0xb0402f, 0x3f6fa8, 0x6d7a3a];
const WOOD = 0x8b6a45;
// Kein Gruen: Gruen heisst "Versteck" (Buesche). Flecken sind Erde,
// trockener Sand und Kies.
const PATCH = [0xbfa47a, 0xa98f66, 0xb7ab98];

function tree(variant: number): BufferGeometry {
  const leaves = LEAVES[variant % LEAVES.length] as number;
  return build([
    { geometry: new CylinderGeometry(0.16, 0.24, 1.7, 6), color: TRUNK, y: 0.85 },
    { geometry: lumpy(new IcosahedronGeometry(1.15, 0), 0.12, 11 + variant), color: leaves, y: 2.4, scaleY: 0.85 },
    {
      geometry: lumpy(new IcosahedronGeometry(0.75, 0), 0.12, 23 + variant),
      color: leaves,
      x: 0.55,
      y: 2.0,
      z: 0.3,
    },
  ]);
}

function pine(variant: number): BufferGeometry {
  const needles = PINE[variant % PINE.length] as number;
  return build([
    { geometry: new CylinderGeometry(0.14, 0.2, 1.0, 6), color: TRUNK, y: 0.5 },
    { geometry: new ConeGeometry(1.2, 1.5, 7), color: needles, y: 1.4 },
    { geometry: new ConeGeometry(0.95, 1.3, 7), color: needles, y: 2.2 },
    { geometry: new ConeGeometry(0.65, 1.1, 7), color: needles, y: 2.9 },
  ]);
}

function rock(variant: number): BufferGeometry {
  const color = ROCK[variant % ROCK.length] as number;
  return build([
    { geometry: lumpy(new IcosahedronGeometry(0.55, 0), 0.25, 101 + variant * 7), color, y: 0.3, scaleY: 0.7 },
    {
      geometry: lumpy(new IcosahedronGeometry(0.3, 0), 0.25, 131 + variant * 7),
      color,
      x: 0.4,
      y: 0.15,
      z: 0.2,
      scaleY: 0.7,
    },
  ]);
}

function barrels(variant: number): BufferGeometry {
  const color = BARREL[variant % BARREL.length] as number;
  const barrel = (x: number, z: number): Part[] => [
    { geometry: new CylinderGeometry(0.27, 0.27, 0.9, 8), color, x, y: 0.45, z },
    { geometry: new CylinderGeometry(0.29, 0.29, 0.08, 8), color: 0x3a3a3a, x, y: 0.62, z },
    { geometry: new CylinderGeometry(0.29, 0.29, 0.08, 8), color: 0x3a3a3a, x, y: 0.25, z },
  ];
  return build([...barrel(-0.22, -0.15), ...barrel(0.22, -0.15), ...barrel(0, 0.25)]);
}

/** Ein Zaunfeld von einem Meter, laengs der x-Achse. */
function fence(): BufferGeometry {
  return build([
    { geometry: new BoxGeometry(0.12, 1.0, 0.12), color: WOOD, x: -0.44, y: 0.5 },
    { geometry: new BoxGeometry(0.12, 1.0, 0.12), color: WOOD, x: 0.44, y: 0.5 },
    { geometry: new BoxGeometry(1.0, 0.1, 0.06), color: WOOD, y: 0.45 },
    { geometry: new BoxGeometry(1.0, 0.1, 0.06), color: WOOD, y: 0.8 },
  ]);
}

function shrub(variant: number): BufferGeometry {
  const color = BUSH[variant % BUSH.length] as number;
  return build([
    { geometry: lumpy(new IcosahedronGeometry(0.5, 0), 0.15, 201 + variant), color, y: 0.42, scaleY: 0.85 },
    { geometry: lumpy(new IcosahedronGeometry(0.32, 0), 0.15, 211 + variant), color, x: 0.3, y: 0.3, z: 0.15 },
  ]);
}

function grass(variant: number): BufferGeometry {
  const color = GRASS[variant % GRASS.length] as number;
  const blade = (x: number, z: number, height: number, tilt: number): Part => ({
    geometry: new ConeGeometry(0.05, height, 3),
    color,
    x,
    y: height / 2,
    z,
    rotateZ: tilt,
  });
  return build([
    blade(0, 0, 0.45, 0.1),
    blade(0.08, 0.05, 0.35, -0.3),
    blade(-0.07, 0.04, 0.38, 0.35),
    blade(0.02, -0.08, 0.3, -0.15),
  ]);
}

function stone(variant: number): BufferGeometry {
  const color = ROCK[variant % ROCK.length] as number;
  return build([
    { geometry: lumpy(new IcosahedronGeometry(0.14, 0), 0.3, 301 + variant), color, y: 0.06, scaleY: 0.6 },
  ]);
}

function flower(variant: number): BufferGeometry {
  const color = FLOWER[variant % FLOWER.length] as number;
  return build([
    { geometry: new CylinderGeometry(0.015, 0.015, 0.32, 3), color: 0x5c8c42, y: 0.16 },
    { geometry: new OctahedronGeometry(0.07, 0), color, y: 0.34 },
    { geometry: new CylinderGeometry(0.015, 0.015, 0.26, 3), color: 0x5c8c42, x: 0.1, y: 0.13 },
    { geometry: new OctahedronGeometry(0.06, 0), color, x: 0.1, y: 0.27 },
  ]);
}

/** Schutt: Bretter und Brocken - je gefaehrlicher der Knoten, desto mehr. */
function debris(variant: number): BufferGeometry {
  const tone = [0x6b5a44, 0x5f5f5f, 0x7a6248][variant % 3] as number;
  return build([
    { geometry: new BoxGeometry(0.9, 0.06, 0.16), color: tone, y: 0.05, rotateZ: 0.08 },
    { geometry: new BoxGeometry(0.7, 0.06, 0.14), color: tone, x: 0.1, y: 0.1, z: 0.18, rotateZ: -0.12 },
    { geometry: lumpy(new IcosahedronGeometry(0.12, 0), 0.3, 401 + variant), color: 0x6f6f6a, x: -0.35, y: 0.06, z: 0.2 },
  ]);
}

/** Ein flacher, unregelmaessiger Fleck am Boden: Erde, Gras, trockener Sand. */
function patch(variant: number): BufferGeometry {
  const circle = new CircleGeometry(1.1, 16);
  const position = circle.getAttribute("position");
  let state = 501 + variant;
  for (let i = 1; i < position.count; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const factor = 0.8 + (state / 4294967296) * 0.35;
    position.setXY(i, position.getX(i) * factor, position.getY(i) * factor);
  }
  return build([
    { geometry: circle, color: PATCH[variant % PATCH.length] as number, y: 0.012, rotateX: -Math.PI / 2 },
  ]);
}

/** Welche Arten hier gebaut werden, und wie viele Spielarten sie haben. */
export const DECOR_BUILDERS: Partial<Record<ArenaPropKind, (variant: number) => BufferGeometry>> = {
  tree,
  pine,
  rock,
  barrels,
  fence: () => fence(),
  shrub,
  grass,
  stone,
  flower,
  debris,
  patch,
};

/**
 * Farbtoenung je Spielart, als Faktor auf die Grundfarben. Alle Spielarten
 * einer Form teilen sich so EINE Geometrie und EINEN Zeichenaufruf - die
 * Abwechslung steckt in der Instanzfarbe (`InstancedMesh.setColorAt`).
 */
export const VARIANT_TINTS: readonly number[][] = [
  [1, 1, 1],
  [0.86, 0.92, 0.86],
  [1.1, 1.06, 0.95],
];

/** Diese Arten wiegen sich leicht im Wind. */
export const SWAYING: ReadonlySet<ArenaPropKind> = new Set(["tree", "pine", "shrub", "grass", "flower"]);
