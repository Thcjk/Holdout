/**
 * Boden, Waende und Buesche als Platzhalter (3D-Umbau).
 *
 * Der Boden ist eine einzige Flaeche mit Schachbrettmuster: je Meter (= eine
 * Kachel, 48 px) ein Feld. Das Muster ist nicht Schmuck, sondern Werkzeug -
 * auf einer einfarbigen Flaeche sieht man nicht, ob und wohin man sich
 * bewegt, und genau das muss man beim Pruefen der Steuerung sehen.
 *
 * Waende und Buesche stehen nicht auf der Liste fuer diesen Schritt, sind
 * aber noetig: Die Simulation hat sie weiterhin. Ohne sie liefe man gegen
 * Unsichtbares und verschwaende in unsichtbarem Gebuesch. Sie sind schlichte
 * Quader und fliegen raus, sobald es Modelle gibt.
 *
 * ================================================================
 * EIN ZEICHENAUFRUF JE WANDART, NICHT EINER JE WAND
 * ================================================================
 *
 * Eine Welt hat ueber 500 Wandstuecke. Als einzelne Meshes waeren das 500
 * Zeichenaufrufe je Bild - auf dem Handy der teuerste Posten ueberhaupt.
 * `InstancedMesh` zeichnet alle Quader derselben Art in EINEM Aufruf; jede
 * Wand ist nur eine Zeile in einer Matrixliste.
 */

import {
  BoxGeometry,
  CanvasTexture,
  InstancedMesh,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  MeshToonMaterial,
  NearestFilter,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { Scene, WebGLRenderer } from "three";
import type { Rect, WorldState } from "../systems/types";
import { GROUND_COLORS, WALL_COLORS, WALL_HEIGHT } from "./placeholders";
import { meters } from "./space3d";

type WallKind = "outer" | "building" | "cover" | "bush";

export class GroundView {
  private readonly disposables: Array<{ dispose(): void }> = [];
  private readonly objects: Array<Mesh | InstancedMesh> = [];

  constructor(scene: Scene, renderer: WebGLRenderer, state: WorldState) {
    this.buildFloor(scene, renderer, state.bounds);

    const groups: Record<WallKind, Rect[]> = { outer: [], building: [], cover: [], bush: [] };
    for (const wall of state.walls) {
      // Deckung, auf der Kisten stehen (Knoten-Gebiet), zeichnet `PropView`
      // als echte Kisten - hier kein Quader darunter.
      if (carriesCrate(wall, state)) {
        continue;
      }
      groups[wallKind(wall, state)].push(wall);
    }
    groups.bush = state.bushes;

    for (const kind of Object.keys(groups) as WallKind[]) {
      this.buildBlocks(scene, kind, groups[kind]);
    }
  }

  private buildFloor(scene: Scene, renderer: WebGLRenderer, bounds: Rect): void {
    // 2 x 2 Pixel Schachbrett, gekachelt: ein Pixel = ein Meter am Boden.
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = GROUND_COLORS[0];
      context.fillRect(0, 0, 2, 2);
      context.fillStyle = GROUND_COLORS[1];
      context.fillRect(0, 0, 1, 1);
      context.fillRect(1, 1, 1, 1);
    }

    const width = meters(bounds.width);
    const depth = meters(bounds.height);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(width / 2, depth / 2);
    // Nah: harte Kanten. Fern: zu einer Mischfarbe verschwimmen lassen -
    // sonst flimmert das Muster zum Horizont hin (Moire).
    texture.magFilter = NearestFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const geometry = new PlaneGeometry(width, depth);
    // PlaneGeometry steht aufrecht (x/y). Flach auf den Boden (x/z) legen.
    geometry.rotateX(-Math.PI / 2);
    const material = new MeshLambertMaterial({ map: texture });
    const floor = new Mesh(geometry, material);
    floor.position.set(meters(bounds.x) + width / 2, 0, meters(bounds.y) + depth / 2);

    scene.add(floor);
    this.objects.push(floor);
    this.disposables.push(texture, geometry, material);
  }

  private buildBlocks(scene: Scene, kind: WallKind, rects: readonly Rect[]): void {
    if (rects.length === 0) {
      return;
    }

    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshToonMaterial({ color: WALL_COLORS[kind] });
    if (kind === "bush") {
      // Halb durchsichtig: Wer sich darin versteckt, soll sich selbst noch
      // sehen. (Die Simulation entscheidet, ob GEGNER einen sehen.)
      material.transparent = true;
      material.opacity = 0.7;
      material.depthWrite = false;
    }

    const mesh = new InstancedMesh(geometry, material, rects.length);
    const height = WALL_HEIGHT[kind];
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const position = new Vector3();
    const scale = new Vector3();

    rects.forEach((rect, index) => {
      scale.set(meters(rect.width), height, meters(rect.height));
      position.set(
        meters(rect.x + rect.width / 2),
        height / 2,
        meters(rect.y + rect.height / 2),
      );
      mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Die Box der ganzen Gruppe fuer das Wegschneiden ausserhalb des Bildes.
    mesh.computeBoundingSphere();

    scene.add(mesh);
    this.objects.push(mesh);
    this.disposables.push(geometry, material);
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

/** Steht auf dieser Wand eine Kiste der Kulisse? */
function carriesCrate(wall: Rect, state: WorldState): boolean {
  return (state.props ?? []).some(
    (prop) =>
      prop.kind.startsWith("crate") &&
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
