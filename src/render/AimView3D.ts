/**
 * Die Zielvorschau als flache Formen am Boden (3D-Fassung von `AimPainter`).
 *
 * Linien sind schmale Rechtecke, Kreise flache Ringe - beides knapp ueber dem
 * Boden. WebGL kann keine dicken Linien (`linewidth` ist fast ueberall fest
 * 1 Pixel), deshalb echte Flaechen.
 *
 * Die Vorschau wird ueber alles gezeichnet (`depthTest: false`): Sie ist eine
 * Anzeige, kein Gegenstand in der Welt. Hinter einer Wand verschwaende sonst
 * genau das Stueck Linie, das zeigt, dass der Wurf dort endet.
 *
 * Jedes Bild wird neu gezeichnet: `clear()` blendet alles aus, jeder Aufruf
 * holt sich eine Form aus einem Vorrat. So entsteht im laufenden Spiel kein
 * neues Objekt.
 */

import {
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
} from "three";
import type { BufferGeometry, Scene } from "three";
import type { Vec2 } from "../systems/types";
import type { AimPainter } from "./AimPainter";
import { meters, toThree } from "./space3d";

/** Knapp ueber dem Boden, damit nichts mit dem Schachbrett flimmert. */
const LIFT = 0.04;
/** Liegt ueber Welt und Figuren. */
const RENDER_ORDER = 10;
/**
 * Strichbreite: 2D-Pixel mal diesem Faktor, in Simulationspixeln. Bei der
 * 3D-Kamera erscheint ein Meter etwas kleiner als in 2D; ohne Faktor waeren
 * die Linien kaum zu sehen.
 */
const WIDTH_FACTOR = 1.6;

export class AimView3D implements AimPainter {
  private readonly lineGeometry: PlaneGeometry;
  private readonly lines: Mesh[] = [];
  private readonly rings: Mesh[] = [];
  /** Ringe gleicher Groesse teilen sich eine Geometrie. Es gibt nur wenige Radien. */
  private readonly ringGeometries = new Map<string, BufferGeometry>();
  private linesUsed = 0;
  private ringsUsed = 0;

  constructor(private readonly scene: Scene) {
    this.lineGeometry = new PlaneGeometry(1, 1);
    this.lineGeometry.rotateX(-Math.PI / 2);
  }

  clear(): void {
    for (const mesh of this.lines) mesh.visible = false;
    for (const mesh of this.rings) mesh.visible = false;
    this.linesUsed = 0;
    this.ringsUsed = 0;
  }

  line(from: Vec2, to: Vec2, width: number, color: number, alpha: number): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) {
      return;
    }

    const mesh = this.take(this.lines, this.linesUsed++, this.lineGeometry);
    paint(mesh, color, alpha);
    // Einheitsquadrat auf Laenge und Breite ziehen, in die Mitte setzen und
    // drehen: lokales +x soll auf (dx, dy) zeigen - Sim-y ist Three-z.
    mesh.scale.set(meters(length), 1, meters(width * WIDTH_FACTOR));
    toThree({ x: from.x + dx / 2, y: from.y + dy / 2 }, LIFT, mesh.position);
    mesh.rotation.set(0, Math.atan2(-dy, dx), 0);
  }

  circle(center: Vec2, radius: number, width: number, color: number, alpha: number): void {
    const stroke = width * WIDTH_FACTOR;
    const key = `${radius}|${stroke}`;
    let geometry = this.ringGeometries.get(key);
    if (!geometry) {
      geometry = new RingGeometry(
        meters(Math.max(0, radius - stroke / 2)),
        meters(radius + stroke / 2),
        64,
      );
      geometry.rotateX(-Math.PI / 2);
      this.ringGeometries.set(key, geometry);
    }

    const mesh = this.take(this.rings, this.ringsUsed++, geometry);
    mesh.geometry = geometry;
    paint(mesh, color, alpha);
    toThree(center, LIFT, mesh.position);
  }

  dispose(): void {
    for (const mesh of [...this.lines, ...this.rings]) {
      mesh.removeFromParent();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.lineGeometry.dispose();
    for (const geometry of this.ringGeometries.values()) {
      geometry.dispose();
    }
  }

  /** Form Nummer `index` aus dem Vorrat - bei Bedarf neu angelegt. */
  private take(pool: Mesh[], index: number, geometry: BufferGeometry): Mesh {
    let mesh = pool[index];
    if (!mesh) {
      mesh = new Mesh(
        geometry,
        new MeshBasicMaterial({
          transparent: true,
          depthTest: false,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      mesh.renderOrder = RENDER_ORDER;
      this.scene.add(mesh);
      pool[index] = mesh;
    }
    mesh.visible = true;
    return mesh;
  }
}

function paint(mesh: Mesh, color: number, alpha: number): void {
  const material = mesh.material as MeshBasicMaterial;
  material.color.setHex(color);
  material.opacity = alpha;
}
