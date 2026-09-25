/**
 * Boden, Waende, Hausboeden und (in der offenen Welt) Buesche.
 *
 * ================================================================
 * BODEN
 * ================================================================
 *
 * Sand mit Koernung und hellen/dunklen Flecken, gekachelt alle 8 m - statt
 * des Schachbretts aus der Grundlagen-Phase. Die Koernung ist nicht nur
 * Schmuck: Auf einer einfarbigen Flaeche saehe man nicht, dass man sich
 * bewegt. Um das Knoten-Gebiet herum liegt ein zweiter, groesserer Boden in
 * Gras-Toenen fuer das Umland (Wald und Felsen aus `DecorView`).
 *
 * Die Texturen werden hier im Code gemalt (Canvas), mit festem Startwert -
 * kein Bild zum Laden, und auf jedem Geraet gleich.
 *
 * ================================================================
 * WAENDE
 * ================================================================
 *
 * Hauswaende in hellem Putz mit ziegelroter Mauerkrone, die Aussenmauer in
 * Stein. Die Krone ist ein flacher, etwas breiterer Quader obendrauf - der
 * einfachste Weg, einem Kasten eine Oberkante zu geben, an der man ihn als
 * Mauer erkennt. Innen haben Haeuser einen Holzboden: Von oben sieht man
 * sofort, was drinnen und was draussen ist.
 *
 * Wo Kulisse eine Wand ausmacht (Kisten, Baeume, Felsen, Faesser, Zaeune),
 * wird die Wand hier NICHT gezeichnet - das Aussehen kommt dann aus
 * `PropView` bzw. `DecorView`, die Kollision bleibt dieselbe.
 *
 * ================================================================
 * EIN ZEICHENAUFRUF JE WANDART, NICHT EINER JE WAND
 * ================================================================
 *
 * `InstancedMesh` zeichnet alle Quader derselben Art in EINEM Aufruf; jede
 * Wand ist nur eine Zeile in einer Matrixliste.
 */

import {
  BoxGeometry,
  CanvasTexture,
  InstancedMesh,
  LinearMipmapLinearFilter,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshToonMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { Scene, Texture, WebGLRenderer } from "three";
import { NODE_ARENA } from "../config/balance";
import type { RegionTheme } from "../config/story";
import { SOLID_PROP_KINDS } from "../systems/types";
import type { Rect, WorldState } from "../systems/types";
import { TOON_STEPS } from "./FigureModel";
import { WALL_CAP_COLORS, WALL_COLORS, WALL_HEIGHT } from "./placeholders";
import { meters } from "./space3d";

type WallKind = "outer" | "building" | "cover" | "bush";

/** Eine Kachel der Bodentextur deckt so viele Meter. */
const GROUND_TILE_METERS = 8;

export class GroundView {
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly objects: Array<Mesh | InstancedMesh> = [];

  constructor(scene: Scene, renderer: WebGLRenderer, state: WorldState) {
    const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const isArena = (state.props?.length ?? 0) > 0;

    if (isArena) {
      /*
       * Seit 2026-09-25 EIN Boden fuer drinnen und draussen, in der Farbe der
       * Region: Die Welt geht ueber die Gebietsgrenze hinaus weiter, statt an
       * einer Mauer in eine andere Landschaft zu kippen (Rueckmeldung: "eine
       * Mauer und danach Wald macht keinen Sinn").
       */
      const margin = NODE_ARENA.outskirtsDepth + 900;
      const outer = {
        x: state.bounds.x - margin,
        y: state.bounds.y - margin,
        width: state.bounds.width + margin * 2,
        height: state.bounds.height + margin * 2,
      };
      const palette = THEME_GROUND[state.theme ?? "suburb"];
      this.buildFloor(scene, outer, groundTexture(palette, 7, anisotropy), 0);
      this.buildLots(scene, state.lots ?? [], anisotropy);
      this.buildRoads(scene, state.roads ?? [], anisotropy);
    } else {
      this.buildFloor(scene, state.bounds, groundTexture(SAND, 7, anisotropy), 0);
    }
    this.buildHouseFloors(scene, state.buildings, anisotropy);

    const groups: Record<WallKind, Rect[]> = { outer: [], building: [], cover: [], bush: [] };
    for (const wall of state.walls) {
      if (carriesProp(wall, state)) {
        continue;
      }
      const kind = wallKind(wall, state);
      // Im Knoten-Gebiet ist die Aussenmauer unsichtbar - den Rand bildet
      // dichter Wald (`NodeArenaGenerator`). Kollision hat sie weiterhin.
      if (kind === "outer" && isArena) {
        continue;
      }
      groups[kind].push(wall);
    }
    // Buesche als gruene Quader nur noch in der offenen Welt - im Knoten-
    // Gebiet stehen dort echte Straeucher (`DecorView`).
    const hasShrubs = (state.props ?? []).some((prop) => prop.kind === "shrub");
    groups.bush = hasShrubs ? [] : state.bushes;

    for (const kind of Object.keys(groups) as WallKind[]) {
      this.buildBlocks(scene, kind, groups[kind]);
    }
  }

  private buildFloor(scene: Scene, rect: Rect, texture: Texture, height: number): void {
    const width = meters(rect.width);
    const depth = meters(rect.height);
    texture.repeat.set(width / GROUND_TILE_METERS, depth / GROUND_TILE_METERS);

    const geometry = new PlaneGeometry(width, depth);
    // PlaneGeometry steht aufrecht (x/y). Flach auf den Boden (x/z) legen.
    geometry.rotateX(-Math.PI / 2);
    const material = new MeshLambertMaterial({ map: texture });
    const floor = new Mesh(geometry, material);
    floor.position.set(meters(rect.x) + width / 2, height, meters(rect.y) + depth / 2);

    scene.add(floor);
    this.objects.push(floor);
    this.disposables.push(texture, geometry, material);
  }

  /** Beton- und Parkplatzflaechen der Orte (Tankstelle, Lagerhalle ...). */
  private buildLots(scene: Scene, lots: readonly Rect[], anisotropy: number): void {
    if (lots.length === 0) return;
    const texture = groundTexture(CONCRETE, 17, anisotropy);
    const material = new MeshLambertMaterial({ map: texture });
    this.disposables.push(texture, material);
    lots.forEach((lot, index) => {
      this.flatRect(scene, lot, material, 0.006 + index * 0.0005, 6);
    });
  }

  /**
   * Die Strasse: Asphalt, Randlinien, gestrichelte Mittellinie. Die Linien
   * sind flache Instanzen - alle Striche ein Zeichenaufruf.
   */
  private buildRoads(scene: Scene, roads: readonly Rect[], anisotropy: number): void {
    if (roads.length === 0) return;
    const texture = groundTexture(ASPHALT, 23, anisotropy);
    const material = new MeshLambertMaterial({ map: texture });
    this.disposables.push(texture, material);

    const marks: Rect[] = [];
    for (const road of roads) {
      this.flatRect(scene, road, material, 0.012, 6);
      const horizontal = road.width >= road.height;
      const length = horizontal ? road.width : road.height;
      const middle = horizontal ? road.y + road.height / 2 : road.x + road.width / 2;
      // Randlinien (6 px) und Mittelstriche (96 px Strich, 96 px Luecke).
      if (horizontal) {
        marks.push({ x: road.x, y: road.y + 8, width: length, height: 5 });
        marks.push({ x: road.x, y: road.y + road.height - 13, width: length, height: 5 });
        for (let x = road.x; x < road.x + length; x += 192) {
          marks.push({ x, y: middle - 3, width: 96, height: 6 });
        }
      } else {
        marks.push({ x: road.x + 8, y: road.y, width: 5, height: length });
        marks.push({ x: road.x + road.width - 13, y: road.y, width: 5, height: length });
        for (let y = road.y; y < road.y + length; y += 192) {
          marks.push({ x: middle - 3, y, width: 6, height: 96 });
        }
      }
    }
    const lineGeometry = new PlaneGeometry(1, 1);
    lineGeometry.rotateX(-Math.PI / 2);
    const lineMaterial = new MeshLambertMaterial({ color: 0xece6d6 });
    const mesh = new InstancedMesh(lineGeometry, lineMaterial, marks.length);
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    marks.forEach((mark, index) => {
      scale.set(meters(mark.width), 1, meters(mark.height));
      position.set(meters(mark.x + mark.width / 2), 0.016, meters(mark.y + mark.height / 2));
      mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    this.objects.push(mesh);
    this.disposables.push(lineGeometry, lineMaterial);
  }

  /** Ein flaches Rechteck am Boden, Textur alle `tileMeters` wiederholt. */
  private flatRect(scene: Scene, rect: Rect, material: MeshLambertMaterial, height: number, tileMeters: number): void {
    const width = meters(rect.width);
    const depth = meters(rect.height);
    const geometry = new PlaneGeometry(width, depth);
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, (uv.getX(i) * width) / tileMeters, (uv.getY(i) * depth) / tileMeters);
    }
    geometry.rotateX(-Math.PI / 2);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(meters(rect.x) + width / 2, height, meters(rect.y) + depth / 2);
    scene.add(mesh);
    this.objects.push(mesh);
    this.disposables.push(geometry);
  }

  /** Holzboden in jedem Haus - innen und aussen auf einen Blick getrennt. */
  private buildHouseFloors(scene: Scene, buildings: readonly Rect[], anisotropy: number): void {
    if (buildings.length === 0) {
      return;
    }
    const texture = planksTexture(anisotropy);
    const material = new MeshLambertMaterial({ map: texture });
    const geometry = new PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.disposables.push(texture, material, geometry);
    for (const house of buildings) {
      // Eigene Textur-Wiederholung je Haus: Bretter sollen gleich breit sein.
      const floorGeometry = geometry.clone();
      const width = meters(house.width);
      const depth = meters(house.height);
      const uv = floorGeometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i += 1) {
        uv.setXY(i, uv.getX(i) * width * 0.5, uv.getY(i) * depth * 0.5);
      }
      floorGeometry.scale(width, 1, depth);
      const floor = new Mesh(floorGeometry, material);
      floor.position.set(meters(house.x) + width / 2, 0.02, meters(house.y) + depth / 2);
      scene.add(floor);
      this.objects.push(floor);
      this.disposables.push(floorGeometry);
    }
  }

  private buildBlocks(scene: Scene, kind: WallKind, rects: readonly Rect[]): void {
    if (rects.length === 0) {
      return;
    }

    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshToonMaterial({ color: WALL_COLORS[kind], gradientMap: TOON_STEPS });
    if (kind === "bush") {
      // Halb durchsichtig: Wer sich darin versteckt, soll sich selbst noch
      // sehen. (Die Simulation entscheidet, ob GEGNER einen sehen.)
      material.transparent = true;
      material.opacity = 0.7;
      material.depthWrite = false;
    }
    const height = WALL_HEIGHT[kind];
    this.placeBoxes(scene, geometry, material, rects, height, 0, 0);

    // Mauerkrone fuer Haus- und Aussenwaende.
    const capColor = WALL_CAP_COLORS[kind];
    if (capColor !== undefined) {
      const capMaterial = new MeshToonMaterial({ color: capColor, gradientMap: TOON_STEPS });
      this.placeBoxes(scene, geometry, capMaterial, rects, 0.16, height, 0.12);
      this.disposables.push(capMaterial);
    }
    this.disposables.push(geometry, material);
  }

  /** Quader fuer alle Rechtecke, als eine Instanzliste. */
  private placeBoxes(
    scene: Scene,
    geometry: BoxGeometry,
    material: MeshToonMaterial,
    rects: readonly Rect[],
    height: number,
    base: number,
    overhang: number,
  ): void {
    const mesh = new InstancedMesh(geometry, material, rects.length);
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();
    rects.forEach((rect, index) => {
      scale.set(meters(rect.width) + overhang, height, meters(rect.height) + overhang);
      position.set(meters(rect.x + rect.width / 2), base + height / 2, meters(rect.y + rect.height / 2));
      mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    this.objects.push(mesh);
  }

  dispose(): void {
    for (const object of this.objects) {
      object.removeFromParent();
    }
    for (const entry of this.disposables) {
      entry.dispose();
    }
  }
}

/** Sand: Grundton, zwei Flecktoene, Koernung. */
const SAND = { base: "#d8c29a", blotches: ["#cfb68a", "#e0cca6"], grains: ["#b99f74", "#eadbbd"] };
/** Umland: Wiese mit Erdstellen. */
const MEADOW = { base: "#7c9a52", blotches: ["#6f8e49", "#8aa65c", "#8f8558"], grains: ["#5f7f40", "#9bb56a"] };
/** Asphalt und Beton fuer Strasse und Plaetze. */
const ASPHALT = { base: "#55575a", blotches: ["#4d4f52", "#5e6063"], grains: ["#46484b", "#696b6e"] };
const CONCRETE = { base: "#a7a59e", blotches: ["#9d9b94", "#b2b0a8"], grains: ["#8f8d87", "#bdbbb3"] };

/**
 * Boden je Region. Bewusst gedaempft: Gruen heisst "Versteck" (die hellen
 * Buesche), der Boden darf ihnen die Bedeutung nicht nehmen.
 */
const THEME_GROUND: Record<RegionTheme, typeof SAND> = {
  suburb: { base: "#94a067", blotches: ["#88955e", "#a0a872", "#a3966a"], grains: ["#7c8a55", "#aab47c"] },
  industry: { base: "#a49e8f", blotches: ["#999384", "#b0aa9a", "#8f8a7c"], grains: ["#86806f", "#bbb5a5"] },
  forest: { base: MEADOW.base, blotches: MEADOW.blotches, grains: MEADOW.grains },
  coast: SAND,
};

/**
 * Eine Bodentextur, im Code gemalt: weiche Flecken, dann Koernung. Mit
 * festem Startwert - jeder Start sieht gleich aus.
 */
function groundTexture(
  palette: { base: string; blotches: string[]; grains: string[] },
  seed: number,
  anisotropy: number,
): Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  let state = seed;
  const random = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  if (context) {
    context.fillStyle = palette.base;
    context.fillRect(0, 0, size, size);
    // Weiche Flecken - auch ueber den Rand gespiegelt, damit die Kachel
    // nahtlos wiederholt.
    for (let i = 0; i < 26; i += 1) {
      const x = random() * size;
      const y = random() * size;
      const radius = 12 + random() * 34;
      context.fillStyle = palette.blotches[i % palette.blotches.length] as string;
      context.globalAlpha = 0.35 + random() * 0.3;
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          context.beginPath();
          context.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    // Koernung.
    context.globalAlpha = 0.55;
    for (let i = 0; i < 900; i += 1) {
      context.fillStyle = palette.grains[i % palette.grains.length] as string;
      context.fillRect(Math.floor(random() * size), Math.floor(random() * size), 2, 2);
    }
    context.globalAlpha = 1;
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = anisotropy;
  return texture;
}

/** Holzdielen: Streifen mit leicht wechselnden Toenen und Fugen. */
function planksTexture(anisotropy: number): Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const tones = ["#9b7650", "#8f6c48", "#a47f57", "#957049"];
  if (context) {
    const plank = size / 4;
    for (let i = 0; i < 4; i += 1) {
      context.fillStyle = tones[i] as string;
      context.fillRect(0, i * plank, size, plank);
      context.fillStyle = "#6e5236";
      context.fillRect(0, i * plank, size, 2);
      // Versetzte Stossfuge je Diele.
      context.fillRect(((i * 37) % size) + 10, i * plank, 2, plank);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = anisotropy;
  return texture;
}

/**
 * Macht Kulisse diese Wand aus (Kiste, Baum, Fels, Faesser, Zaun)? Dann
 * zeichnet die Kulisse sie - hier kein Quader darunter.
 */
function carriesProp(wall: Rect, state: WorldState): boolean {
  return (state.props ?? []).some(
    (prop) =>
      SOLID_PROP_KINDS.has(prop.kind) &&
      prop.level === 0 &&
      prop.x > wall.x &&
      prop.x < wall.x + wall.width &&
      prop.y > wall.y &&
      prop.y < wall.y + wall.height,
  );
}

/**
 * Welche Art Wand? Dieselbe Unterscheidung wie in der 2D-Darstellung: Was
 * den Kartenrand beruehrt, ist Aussenmauer; was in einem Gebaeude liegt,
 * Hauswand; alles andere Deckung. Die Simulation selbst kennt nur Rechtecke.
 */
function wallKind(wall: Rect, state: WorldState): WallKind {
  const bounds = state.bounds;
  if (
    wall.x <= bounds.x ||
    wall.y <= bounds.y ||
    wall.x + wall.width >= bounds.x + bounds.width ||
    wall.y + wall.height >= bounds.y + bounds.height
  ) {
    return "outer";
  }
  // 1 px Toleranz wie in `ArenaRenderer.insideBuilding` - Rundung beim
  // Einrasten aufs Raster.
  const inBuilding = state.buildings.some(
    (house) =>
      wall.x >= house.x - 1 &&
      wall.y >= house.y - 1 &&
      wall.x + wall.width <= house.x + house.width + 1 &&
      wall.y + wall.height <= house.y + house.height + 1,
  );
  return inBuilding ? "building" : "cover";
}
