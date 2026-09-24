/**
 * Die Kulisse eines Knoten-Gebiets: Kisten, Zielscheiben, Rauch, Beute-Marker.
 *
 * ================================================================
 * EIN ZEICHENAUFRUF JE MODELL, NICHT JE KISTE
 * ================================================================
 *
 * Ein Knoten mit g = 9 hat ueber 40 Kisten. Als einzelne Objekte waeren das
 * 80 Zeichenaufrufe (eine Kiste besteht aus Kasten und Deckel) - auf dem
 * Handy der teuerste Posten. `InstancedMesh` zeichnet alle Kisten eines
 * Modells in EINEM Aufruf; jede Kiste ist nur eine Zeile in einer
 * Matrixliste. Das ist Object Pooling in seiner billigsten Form: Die
 * Geometrie gibt es einmal, die Kisten sind nur Positionen.
 *
 * ================================================================
 * BEUTE SICHTBAR MACHEN (BRIEFING: "MARKIERTE GEBAEUDE")
 * ================================================================
 *
 *   Beutekisten    leuchten golden und haben einen pulsierenden Ring am
 *                  Boden - bis ihre Beute aufgehoben ist
 *   Haeuser        ueber jedem Haus, in dem noch Beute liegt, schwebt eine
 *                  goldene Raute - von weitem sichtbar, wie die markierten
 *                  Gebaeude im Vorbild "Deadly Days"
 *
 * Ob noch Beute da ist, wird jedes Bild aus dem Weltzustand abgelesen
 * (`groundItems`), nicht gemerkt - so stimmt es auch im Koop, wenn ein
 * Mitspieler sie aufhebt.
 *
 * ================================================================
 * LEBENDIGE WELT: RAUCH
 * ================================================================
 *
 * Ueber manchen Daechern steigt Rauch auf: drei Wolken je Schornstein, die
 * nach oben treiben, wachsen und verschwinden. Reine Darstellung, je Bild
 * ein paar Matrizen - kein Einfluss auf die Simulation.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  Box3,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  OctahedronGeometry,
  Quaternion,
  RingGeometry,
  Vector3,
} from "three";
import type { BufferGeometry, Material, Object3D, Scene } from "three";
import { PROP_URLS } from "../config/models";
import type { PropId } from "../config/models";
import type { ArenaProp, Rect, WorldState } from "../systems/types";
import { toonFrom } from "./FigureModel";
import { modelLoader } from "./ModelLoader";
import { meters, toThree } from "./space3d";

/** Kistenlaenge in Metern: zwei Kacheln, knapp. */
const CRATE_LENGTH = 1.9;
/** Hoehe einer Zielscheibe samt Staender. */
const TARGET_HEIGHT = 1.3;
/** Wolken je Rauchsaeule. */
const PUFFS = 3;
/** Ab hier steigt der Rauch auf (Meter) - knapp ueber dem Dach. */
const SMOKE_BASE = 2.6;
const GLOW = 0xffc94a;

/**
 * Ein Modell, auf eine Zielgroesse gebracht und fuer viele Kopien vorbereitet.
 * Die Normierung (Skalieren, Fuss auf den Boden, Mitte auf die Achse) wird
 * einmal ausgerechnet und in jede Kopie hineinmultipliziert.
 */
interface FittedModel {
  parts: Array<{ geometry: BufferGeometry; material: MeshToonMaterial; local: Matrix4 }>;
  /** Hoehe nach dem Einpassen, in Metern. */
  height: number;
}

function fitModel(template: Object3D, fit: { length?: number; height?: number }): FittedModel {
  template.updateMatrixWorld(true);
  const box = new Box3().setFromObject(template);
  const size = box.getSize(new Vector3());
  const scale = fit.length
    ? fit.length / Math.max(size.x, size.z)
    : (fit.height ?? 1) / Math.max(size.y, 1e-6);
  const center = box.getCenter(new Vector3());
  const normalize = new Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));

  const parts: FittedModel["parts"] = [];
  template.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.isMesh) {
      parts.push({
        geometry: mesh.geometry,
        material: toonFrom(mesh.material as Material),
        local: normalize.clone().multiply(mesh.matrixWorld),
      });
    }
  });
  return { parts, height: size.y * scale };
}

/** Viele Kopien eines eingepassten Modells, ein Zeichenaufruf je Teil. */
class ModelInstances {
  readonly meshes: InstancedMesh[];
  private readonly matrix = new Matrix4();
  private readonly place = new Matrix4();
  private readonly rotation = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly size = new Vector3();

  constructor(
    private readonly model: FittedModel,
    count: number,
    scene: Scene,
  ) {
    this.meshes = model.parts.map((part) => {
      const mesh = new InstancedMesh(part.geometry, part.material, Math.max(1, count));
      mesh.count = count;
      scene.add(mesh);
      return mesh;
    });
  }

  set(index: number, position: Vector3, rotationY: number, scale = 1): void {
    this.rotation.setFromAxisAngle(this.up, rotationY);
    this.place.compose(position, this.rotation, this.size.set(scale, scale, scale));
    this.model.parts.forEach((part, partIndex) => {
      const mesh = this.meshes[partIndex] as InstancedMesh;
      mesh.setMatrixAt(index, this.matrix.multiplyMatrices(this.place, part.local));
    });
  }

  commit(): void {
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    // Geometrie gehoert der Vorlage; die Toon-Materialien sind eigene.
    for (const part of this.model.parts) {
      part.material.dispose();
    }
  }
}

interface LootCrate {
  prop: ArenaProp;
  meshes: Mesh[];
  materials: MeshToonMaterial[];
  ring: Mesh;
}

export class PropView {
  private readonly instances: ModelInstances[] = [];
  private readonly lootCrates: LootCrate[] = [];
  private readonly markers: Array<{ building: Rect; mesh: Mesh }> = [];
  private smoke: ModelInstances | null = null;
  private readonly smokeProps: ArenaProp[];
  private readonly placeholders: Mesh[] = [];
  private readonly markerGeometry = new OctahedronGeometry(0.35);
  private readonly markerMaterial = new MeshBasicMaterial({ color: GLOW });
  private readonly ringGeometry: RingGeometry;
  private built = false;
  private time = 0;
  private readonly scratch = new Vector3();

  constructor(
    private readonly scene: Scene,
    private readonly props: readonly ArenaProp[],
    buildings: readonly Rect[],
  ) {
    this.smokeProps = props.filter((prop) => prop.kind === "smoke");
    this.ringGeometry = new RingGeometry(1.25, 1.45, 40);
    this.ringGeometry.rotateX(-Math.PI / 2);

    for (const building of buildings) {
      const mesh = new Mesh(this.markerGeometry, this.markerMaterial);
      mesh.visible = false;
      scene.add(mesh);
      this.markers.push({ building, mesh });
    }

    this.tryBuild();
    if (!this.built) {
      this.buildPlaceholders();
    }
  }

  /** Kisten, die gerade noch Beute markieren - fuer Tests und Anzeige. */
  get glowingCrates(): number {
    return this.lootCrates.filter((crate) => crate.ring.visible).length;
  }

  update(state: WorldState, seconds: number): void {
    this.time += seconds;
    if (!this.built) {
      this.tryBuild();
      if (this.built) {
        this.clearPlaceholders();
      }
    }

    // Beutekisten: Glanz, solange Beute davor liegt.
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    for (const crate of this.lootCrates) {
      const full = hasLootNear(state, crate.prop.x, crate.prop.y, 110);
      crate.ring.visible = full;
      for (const material of crate.materials) {
        material.emissiveIntensity = full ? 0.25 + 0.35 * pulse : 0;
      }
      if (full) {
        crate.ring.scale.setScalar(1 + 0.08 * pulse);
      }
    }

    // Haeuser mit Beute: schwebende Raute.
    for (const { building, mesh } of this.markers) {
      const full = state.groundItems.some(
        (item) => item.fromWorld && insideRect(item.position, building),
      );
      mesh.visible = full;
      if (full) {
        toThree(
          { x: building.x + building.width / 2, y: building.y + building.height / 2 },
          3.4 + Math.sin(this.time * 2.2) * 0.25,
          mesh.position,
        );
        mesh.rotation.y = this.time * 1.5;
      }
    }

    this.updateSmoke();
  }

  dispose(): void {
    for (const instance of this.instances) instance.dispose();
    this.instances.length = 0;
    this.smoke?.dispose();
    for (const crate of this.lootCrates) {
      for (const mesh of crate.meshes) mesh.removeFromParent();
      for (const material of crate.materials) material.dispose();
      crate.ring.removeFromParent();
      (crate.ring.material as Material).dispose();
    }
    for (const { mesh } of this.markers) mesh.removeFromParent();
    this.clearPlaceholders();
    this.markerGeometry.dispose();
    this.markerMaterial.dispose();
    this.ringGeometry.dispose();
  }

  /** Alles aufbauen, sobald die Modelle geladen sind. */
  private tryBuild(): void {
    const templates: Partial<Record<PropId, Object3D>> = {};
    for (const id of Object.keys(PROP_URLS) as PropId[]) {
      const gltf = modelLoader.model(PROP_URLS[id]);
      if (!gltf) {
        return;
      }
      templates[id] = gltf.scene;
    }

    const crate = fitModel(templates.crateMedium as Object3D, { length: CRATE_LENGTH });
    const wide = fitModel(templates.crateWide as Object3D, { length: CRATE_LENGTH });
    const target = fitModel(templates.target as Object3D, { height: TARGET_HEIGHT });
    const smoke = fitModel(templates.smoke as Object3D, { length: 1.2 });

    // Gewoehnliche Kisten: alle in einer Instanzliste.
    const crates = this.props.filter((prop) => prop.kind === "crateMedium");
    const crateInstances = new ModelInstances(crate, crates.length, this.scene);
    crates.forEach((prop, index) => {
      toThree(prop, prop.level * crate.height, this.scratch);
      crateInstances.set(index, this.scratch, prop.rotation);
    });
    crateInstances.commit();
    this.instances.push(crateInstances);

    // Zielscheiben.
    const targets = this.props.filter((prop) => prop.kind === "target");
    const targetInstances = new ModelInstances(target, targets.length, this.scene);
    targets.forEach((prop, index) => {
      toThree(prop, 0, this.scratch);
      targetInstances.set(index, this.scratch, prop.rotation);
    });
    targetInstances.commit();
    this.instances.push(targetInstances);

    // Beutekisten: einzeln, jede mit eigenem Material - sie leuchten und
    // erloeschen unabhaengig voneinander.
    for (const prop of this.props.filter((entry) => entry.lootable)) {
      const meshes: Mesh[] = [];
      const materials: MeshToonMaterial[] = [];
      const place = new Matrix4().compose(
        toThree(prop, 0, new Vector3()),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), prop.rotation),
        new Vector3(1, 1, 1),
      );
      for (const part of wide.parts) {
        const material = part.material.clone();
        material.emissive.setHex(GLOW);
        const mesh = new Mesh(part.geometry, material);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.multiplyMatrices(place, part.local);
        this.scene.add(mesh);
        meshes.push(mesh);
        materials.push(material);
      }
      const ring = new Mesh(
        this.ringGeometry,
        new MeshBasicMaterial({
          color: GLOW,
          transparent: true,
          opacity: 0.8,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      toThree(prop, 0.05, ring.position);
      this.scene.add(ring);
      this.lootCrates.push({ prop, meshes, materials, ring });
    }
    // Die Vorlage der breiten Kiste wurde nur geklont - ihre Toon-Materialien
    // selbst werden nicht gebraucht.
    for (const part of wide.parts) part.material.dispose();

    // Rauch: drei Wolken je Saeule, jedes Bild neu gesetzt.
    this.smoke = new ModelInstances(smoke, this.smokeProps.length * PUFFS, this.scene);
    for (const mesh of this.smoke.meshes) {
      const material = mesh.material as MeshToonMaterial;
      material.transparent = true;
      material.opacity = 0.75;
      material.depthWrite = false;
    }
    this.built = true;
  }

  private updateSmoke(): void {
    if (!this.smoke) {
      return;
    }
    this.smokeProps.forEach((prop, column) => {
      for (let puff = 0; puff < PUFFS; puff += 1) {
        // Jede Wolke in einer anderen Phase, jede Saeule versetzt.
        const phase = (this.time / 3.2 + puff / PUFFS + column * 0.37) % 1;
        toThree(prop, SMOKE_BASE + phase * 2.4, this.scratch);
        this.scratch.x += Math.sin(phase * 3 + column) * 0.25;
        // Wachsen, dann schrumpfen bis weg - Ausblenden ueber die Groesse,
        // weil alle Wolken ein Material teilen.
        const scale = Math.sin(phase * Math.PI) * (0.6 + phase * 0.8);
        this.smoke?.set(column * PUFFS + puff, this.scratch, prop.rotation + phase * 2, scale);
      }
    });
    this.smoke.commit();
  }

  /**
   * Solange die Modelle laden: schlichte Kisten-Quader, damit man nicht
   * gegen Unsichtbares laeuft.
   */
  private buildPlaceholders(): void {
    const geometry = new BoxGeometry(meters(96) * 0.95, 0.7, meters(48) * 0.95);
    const material = new MeshToonMaterial({ color: 0x9a6b3f });
    for (const prop of this.props) {
      if (!prop.kind.startsWith("crate")) continue;
      const mesh = new Mesh(geometry, material);
      toThree(prop, 0.35 + prop.level * 0.7, mesh.position);
      mesh.rotation.y = prop.rotation + Math.PI / 2;
      this.scene.add(mesh);
      this.placeholders.push(mesh);
    }
  }

  private clearPlaceholders(): void {
    const first = this.placeholders[0];
    for (const mesh of this.placeholders) mesh.removeFromParent();
    if (first) {
      first.geometry.dispose();
      (first.material as Material).dispose();
    }
    this.placeholders.length = 0;
  }
}

function hasLootNear(state: WorldState, x: number, y: number, radius: number): boolean {
  return state.groundItems.some(
    (item) => item.fromWorld && Math.hypot(item.position.x - x, item.position.y - y) < radius,
  );
}

function insideRect(point: { x: number; y: number }, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}
