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


// ------------------------------------------------------------------
// Orte an der Strasse (2026-09-25, `systems/arenaPlaces.ts`)
// ------------------------------------------------------------------
//
// Alle laengs der x-Achse gebaut, Fuss auf y = 0, Mitte im Ursprung - so
// passen sie auf das Rechteck, das die Simulation als Wand kennt.
// Farbige Teile sind hell gebaut; die eigentliche Farbe kommt aus der
// Instanz-Toenung (`KIND_TINTS`), damit alle Autos EIN Zeichenaufruf sind.

const GLASS = 0x3d4f63;
const TIRE = 0x222222;
const METAL = 0x9aa0a6;

/** Auto, 4 x 2 m. Karosserie hell - die Farbe macht die Toenung. */
function car(): BufferGeometry {
  const wheel = (x: number, z: number): Part => ({
    geometry: new CylinderGeometry(0.34, 0.34, 0.26, 10),
    color: TIRE,
    x,
    y: 0.34,
    z,
    rotateX: Math.PI / 2,
  });
  return build([
    { geometry: new BoxGeometry(3.8, 0.62, 1.7), color: 0xf0f0f0, y: 0.62 },
    { geometry: new BoxGeometry(2.0, 0.55, 1.5), color: 0xf0f0f0, x: -0.2, y: 1.2 },
    { geometry: new BoxGeometry(2.04, 0.4, 1.36), color: GLASS, x: -0.2, y: 1.2 },
    { geometry: new BoxGeometry(0.1, 0.18, 1.2), color: 0xfff1b0, x: 1.91, y: 0.72 },
    wheel(1.2, 0.8),
    wheel(1.2, -0.8),
    wheel(-1.2, 0.8),
    wheel(-1.2, -0.8),
  ]);
}

/** Zapfsaeule, 1 x 1 m. */
function pump(): BufferGeometry {
  return build([
    { geometry: new BoxGeometry(0.9, 0.2, 0.9), color: 0x9a9a92, y: 0.1 },
    { geometry: new BoxGeometry(0.55, 1.5, 0.45), color: 0xd84a3a, y: 0.95 },
    { geometry: new BoxGeometry(0.4, 0.35, 0.47), color: 0xf2f2ec, y: 1.35 },
    { geometry: new BoxGeometry(0.08, 0.6, 0.08), color: TIRE, x: 0.32, y: 0.8 },
  ]);
}

/** Wartehaeuschen, 4 x 1 m. */
function busStop(): BufferGeometry {
  return build([
    { geometry: new BoxGeometry(4, 0.12, 1.3), color: 0x6f7a86, y: 2.35 },
    { geometry: new BoxGeometry(3.9, 1.9, 0.06), color: 0x9fc3d8, y: 1.3, z: -0.5 },
    { geometry: new BoxGeometry(0.1, 2.35, 0.1), color: METAL, x: -1.95, y: 1.17, z: -0.5 },
    { geometry: new BoxGeometry(0.1, 2.35, 0.1), color: METAL, x: 1.95, y: 1.17, z: -0.5 },
    { geometry: new BoxGeometry(0.1, 2.35, 0.1), color: METAL, x: -1.95, y: 1.17, z: 0.55 },
    { geometry: new BoxGeometry(0.1, 2.35, 0.1), color: METAL, x: 1.95, y: 1.17, z: 0.55 },
    { geometry: new BoxGeometry(2.4, 0.1, 0.45), color: 0x8b6a45, y: 0.5, z: -0.2 },
  ]);
}

/** Seecontainer, 6 x 2 m, mit Rippen. Farbe aus der Toenung. */
function container(): BufferGeometry {
  const parts: Part[] = [{ geometry: new BoxGeometry(5.9, 2.4, 2.3), color: 0xeeeeee, y: 1.2 }];
  for (let i = 0; i < 9; i += 1) {
    const x = -2.6 + i * 0.65;
    parts.push({ geometry: new BoxGeometry(0.08, 2.3, 2.36), color: 0xd0d0d0, x, y: 1.2 });
  }
  parts.push({ geometry: new BoxGeometry(0.06, 2.2, 2.2), color: 0x777777, x: 2.97, y: 1.2 });
  return build(parts);
}

/** Zelt, 2 x 2 m: eine vierseitige Pyramide. */
function tent(): BufferGeometry {
  return build([
    { geometry: new ConeGeometry(1.35, 1.6, 4), color: 0xf0f0f0, y: 0.8, rotateZ: 0 },
    { geometry: new BoxGeometry(0.5, 0.9, 0.05), color: 0x3b3027, x: 0.62, y: 0.45 },
  ]);
}

/** Holzstapel, 3 x 1 m: drei liegende Staemme. */
function logs(): BufferGeometry {
  const log = (y: number, z: number): Part => ({
    geometry: new CylinderGeometry(0.25, 0.25, 2.9, 7),
    color: 0x7a5534,
    y,
    z,
    rotateZ: Math.PI / 2,
  });
  return build([log(0.25, -0.26), log(0.25, 0.26), log(0.68, 0)]);
}

/** Ruderboot, 4 x 2 m, kieloben liegend nicht - einfach auf dem Sand. */
function boat(): BufferGeometry {
  return build([
    { geometry: new BoxGeometry(3.0, 0.55, 1.4), color: 0xf0f0f0, x: -0.3, y: 0.3 },
    { geometry: new ConeGeometry(0.72, 1.1, 4), color: 0xf0f0f0, x: 1.7, y: 0.3, rotateZ: -Math.PI / 2 },
    { geometry: new BoxGeometry(2.8, 0.08, 1.2), color: 0x8b6a45, x: -0.3, y: 0.55 },
    { geometry: new BoxGeometry(0.25, 0.1, 1.2), color: 0x8b6a45, x: -0.4, y: 0.62 },
  ]);
}

/** Leuchtturm, 3 x 3 m Grundflaeche, rot-weiss geringelt. */
function lighthouse(): BufferGeometry {
  const parts: Part[] = [{ geometry: new CylinderGeometry(1.5, 1.6, 0.4, 10), color: 0x8a8a86, y: 0.2 }];
  for (let i = 0; i < 5; i += 1) {
    const radius = 1.25 - i * 0.12;
    parts.push({
      geometry: new CylinderGeometry(radius - 0.12, radius, 1.4, 10),
      color: i % 2 === 0 ? 0xf2f2ec : 0xc8423a,
      y: 0.4 + i * 1.4 + 0.7,
    });
  }
  parts.push({ geometry: new CylinderGeometry(0.7, 0.7, 0.9, 8), color: 0xffe08a, y: 7.85 });
  parts.push({ geometry: new ConeGeometry(0.85, 0.8, 8), color: 0x3b3b3b, y: 8.7 });
  return build(parts);
}

/** Strassensperre: rot-weisse Bake. */
function roadblock(): BufferGeometry {
  return build([
    { geometry: new BoxGeometry(1.8, 0.35, 0.18), color: 0xd84a3a, y: 0.75 },
    { geometry: new BoxGeometry(0.5, 0.36, 0.2), color: 0xf2f2ec, x: -0.5, y: 0.75 },
    { geometry: new BoxGeometry(0.5, 0.36, 0.2), color: 0xf2f2ec, x: 0.5, y: 0.75 },
    { geometry: new BoxGeometry(0.1, 0.9, 0.1), color: METAL, x: -0.75, y: 0.45 },
    { geometry: new BoxGeometry(0.1, 0.9, 0.1), color: METAL, x: 0.75, y: 0.45 },
  ]);
}

/** Schild auf einem Mast (Tankstelle: rot, Haltestelle: gelb ueber Toenung). */
function sign(): BufferGeometry {
  return build([
    { geometry: new CylinderGeometry(0.07, 0.07, 3.2, 6), color: METAL, y: 1.6 },
    { geometry: new BoxGeometry(1.3, 0.9, 0.12), color: 0xf0f0f0, y: 3.1 },
    { geometry: new BoxGeometry(1.1, 0.7, 0.14), color: 0xd84a3a, y: 3.1 },
  ]);
}

function bench(): BufferGeometry {
  return build([
    { geometry: new BoxGeometry(1.6, 0.08, 0.45), color: WOOD, y: 0.45 },
    { geometry: new BoxGeometry(1.6, 0.35, 0.06), color: WOOD, y: 0.75, z: -0.22 },
    { geometry: new BoxGeometry(0.08, 0.45, 0.4), color: METAL, x: -0.7, y: 0.22 },
    { geometry: new BoxGeometry(0.08, 0.45, 0.4), color: METAL, x: 0.7, y: 0.22 },
  ]);
}

function campfire(): BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    parts.push({
      geometry: lumpy(new IcosahedronGeometry(0.16, 0), 0.3, 601 + i),
      color: ROCK[i % ROCK.length] as number,
      x: Math.cos(angle) * 0.55,
      y: 0.08,
      z: Math.sin(angle) * 0.55,
    });
  }
  parts.push({ geometry: new ConeGeometry(0.3, 0.7, 5), color: 0xf28c28, y: 0.35 });
  parts.push({ geometry: new ConeGeometry(0.16, 0.45, 5), color: 0xffd166, y: 0.3 });
  return build(parts);
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
  car: () => car(),
  pump: () => pump(),
  busStop: () => busStop(),
  container: () => container(),
  tent: () => tent(),
  logs: () => logs(),
  boat: () => boat(),
  lighthouse: () => lighthouse(),
  roadblock: () => roadblock(),
  sign: () => sign(),
  bench: () => bench(),
  campfire: () => campfire(),
};

/**
 * Eigene Farben je Spielart fuer die Orte. Anders als `VARIANT_TINTS` (leichte
 * Abwandlung) sind das hier echte Farben: rotes, blaues, gelbes Auto.
 */
export const KIND_TINTS: Partial<Record<ArenaPropKind, readonly number[][]>> = {
  car: [
    [0.85, 0.28, 0.22], // rot
    [0.3, 0.45, 0.8], // blau
    [0.95, 0.8, 0.3], // gelb
    [0.4, 0.66, 0.42], // gruen
    [0.42, 0.42, 0.42], // ausgebrannt
    [0.62, 0.4, 0.28], // rostig
  ],
  container: [
    [0.75, 0.28, 0.22],
    [0.28, 0.45, 0.7],
    [0.35, 0.58, 0.4],
    [0.9, 0.55, 0.2],
  ],
  tent: [
    [0.95, 0.55, 0.2],
    [0.35, 0.6, 0.4],
    [0.35, 0.5, 0.85],
  ],
  boat: [
    [0.95, 0.95, 0.95],
    [0.35, 0.5, 0.85],
    [0.85, 0.35, 0.28],
  ],
  // Schild: Tankstelle rot (Standard), Haltestelle gelblich.
  sign: [
    [1, 1, 1],
    [1, 1.2, 0.2],
  ],
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
