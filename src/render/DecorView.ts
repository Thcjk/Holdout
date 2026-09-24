/**
 * Die selbst gebaute Umgebung eines Knoten-Gebiets: Baeume, Felsen,
 * Straeucher, Gras, Blumen, Schutt, Flecken am Boden, das Umland.
 *
 * ================================================================
 * EIN ZEICHENAUFRUF JE FORM
 * ================================================================
 *
 * Ein Gebiet hat mehrere hundert dieser Teile. Jede Form (Tanne, Fels, Gras
 * ...) ist EIN `InstancedMesh`: die Geometrie einmal, die Teile nur als
 * Positionen. Die Spielarten unterscheiden sich nur in der Toenung, und die
 * steht je Instanz (`setColorAt`) - so bleibt es bei rund elf
 * Zeichenaufrufen, egal wie viel Gras herumsteht. (Die erste Fassung hatte
 * je Spielart einen eigenen Aufruf; mit Gegnern waere das Budget von 120
 * Aufrufen gerissen worden.)
 *
 * ================================================================
 * LEBENDIGE WELT: WIND
 * ================================================================
 *
 * Baeume, Straeucher, Gras und Blumen wiegen sich leicht. Gerechnet wird das
 * auf der Grafikkarte: Ein kleiner Zusatz im Shader verschiebt jeden
 * Eckpunkt abhaengig von seiner Hoehe (der Fuss bleibt stehen) und der Lage
 * der Instanz (nicht alle im Gleichtakt). Der Hauptprozessor merkt davon
 * nichts - es muss je Bild nur eine Zahl (die Zeit) weitergegeben werden.
 */

import { Color, InstancedMesh, Matrix4, MeshToonMaterial, Quaternion, Vector3 } from "three";
import type { BufferGeometry, Scene } from "three";
import type { ArenaProp } from "../systems/types";
import { DECOR_BUILDERS, SWAYING, VARIANT_TINTS } from "./decorModels";
import { TOON_STEPS } from "./FigureModel";
import { toThree } from "./space3d";

export class DecorView {
  private readonly meshes: InstancedMesh[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: MeshToonMaterial[] = [];
  /** Die Zeit fuer den Wind - geteilt von allen wiegenden Materialien. */
  private readonly time = { value: 0 };

  constructor(scene: Scene, props: readonly ArenaProp[]) {
    // Nach Form und Spielart gruppieren.
    const groups = new Map<string, ArenaProp[]>();
    for (const prop of props) {
      if (!DECOR_BUILDERS[prop.kind]) {
        continue;
      }
      const key = prop.kind;
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(prop);
    }

    const steady = this.material(false);
    const swaying = this.material(true);
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);
    const color = new Color();

    for (const [key, list] of groups) {
      const first = list[0] as ArenaProp;
      const geometry = (DECOR_BUILDERS[first.kind] as (variant: number) => BufferGeometry)(0);
      this.geometries.push(geometry);
      const mesh = new InstancedMesh(
        geometry,
        SWAYING.has(first.kind) ? swaying : steady,
        list.length,
      );
      mesh.name = key;
      list.forEach((prop, index) => {
        toThree(prop, 0, position);
        rotation.setFromAxisAngle(up, prop.rotation);
        scale.setScalar(prop.scale);
        mesh.setMatrixAt(index, matrix.compose(position, rotation, scale));
        const tint = VARIANT_TINTS[prop.variant % VARIANT_TINTS.length] as number[];
        mesh.setColorAt(index, color.setRGB(tint[0] ?? 1, tint[1] ?? 1, tint[2] ?? 1));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      // Flecken liegen flach am Boden: zuerst zeichnen, nichts ueberdecken.
      if (first.kind === "patch") {
        mesh.renderOrder = -1;
      }
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  /** Wie viele Teile gezeichnet werden - fuer Tests und Anzeige. */
  get count(): number {
    return this.meshes.reduce((sum, mesh) => sum + mesh.count, 0);
  }

  update(seconds: number): void {
    this.time.value += seconds;
  }

  dispose(): void {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }

  private material(sway: boolean): MeshToonMaterial {
    const material = new MeshToonMaterial({ vertexColors: true, gradientMap: TOON_STEPS });
    if (sway) {
      const time = this.time;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = time;
        shader.vertexShader = `uniform float uWindTime;\n${shader.vertexShader}`.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            // Phase aus der Lage der Instanz - nicht alle im Gleichtakt.
            float windPhase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.5;
          #else
            float windPhase = 0.0;
          #endif
          // Nur was hoeher als der Fuss ist, bewegt sich - und oben mehr.
          float windAmount = max(transformed.y - 0.15, 0.0) * 0.045;
          transformed.x += sin(uWindTime * 1.7 + windPhase) * windAmount;
          transformed.z += cos(uWindTime * 1.3 + windPhase) * windAmount * 0.6;`,
        );
      };
      // Eigener Programm-Schluessel, damit Three.js den geaenderten Shader
      // nicht mit dem des ruhigen Materials verwechselt.
      material.customProgramCacheKey = () => "decor-sway";
    }
    this.materials.push(material);
    return material;
  }
}
