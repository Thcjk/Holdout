/**
 * Lebensbalken ueber den Koepfen der Gegner (2026-09-26, Rueckmeldung
 * "Gegner brauchen ueber dem Kopf eine kleine Anzeige fuer Leben").
 *
 * ================================================================
 * ZWEI ZEICHENAUFRUFE FUER ALLE BALKEN
 * ================================================================
 *
 * Je Balken ein eigenes Objekt waeren bei 40 Gegnern 80 Zeichenaufrufe -
 * mehr als die Haelfte des Budgets (120, siehe CLAUDE.md "Leistung"). Alle
 * Hintergruende sind deshalb EINE Instanzliste, alle Fuellungen eine zweite.
 * Die Farbe der Fuellung ist eine Instanzfarbe: Gegner rot (wie in Brawl
 * Stars - rot heisst Feind), Mitspieler gruen -> gelb -> rot nach Leben.
 *
 * Die Balken schauen immer in die Kamera (gleiche Drehung wie sie) und
 * werden ohne Tiefentest gezeichnet: Ein Baum vor dem Gegner soll den
 * Balken nicht verschlucken - er ist eine Anzeige, kein Teil der Welt.
 */

import {
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import type { Camera, Scene } from "three";

/** Ein Balken, wie ihn die EntityView meldet. */
export interface BarRequest {
  /** Mitte ueber dem Kopf, in Three-Metern. */
  x: number;
  y: number;
  z: number;
  /** Anteil des Lebens, 0 bis 1. */
  fraction: number;
  /** Breite in Metern (Boss breiter). */
  width: number;
  /** Feste Farbe (Gegner rot); ohne Angabe gruen -> gelb -> rot nach Leben. */
  color?: number;
}

/** Hoechstzahl gleichzeitiger Balken (Gegner-Obergrenze plus Reserve). */
const MAX_BARS = 64;
/** Hoehe des Balkens in Metern - bei 30 m Abstand rund 5 Bildpunkte. */
const BAR_HEIGHT = 0.18;
/** Rand des Hintergrunds um die Fuellung. */
const BORDER = 0.05;

const FULL = new Color(0x7fb069);
const HALF = new Color(0xf2c14e);
const LOW = new Color(0xe4572e);

export class HealthBars {
  private readonly backGeometry = new PlaneGeometry(1, 1);
  /** Linke Kante im Ursprung: Die Fuellung schrumpft nach links. */
  private readonly fillGeometry = new PlaneGeometry(1, 1).translate(0.5, 0, 0);
  private readonly backMaterial = new MeshBasicMaterial({
    color: 0x10131a,
    transparent: true,
    opacity: 0.8,
    depthTest: false,
    depthWrite: false,
  });
  /*
   * Auch die Fuellung ist "durchsichtig" (bei voller Deckkraft): Three.js
   * zeichnet erst alles Undurchsichtige, dann das Durchsichtige - die
   * Reihenfolge `renderOrder` gilt nur innerhalb eines Durchgangs. Ohne das
   * lag der halbdurchsichtige Hintergrund UEBER der Fuellung, und man sah
   * nur schwarze Balken (im Emulator gesehen).
   */
  private readonly fillMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
  private readonly back = new InstancedMesh(this.backGeometry, this.backMaterial, MAX_BARS);
  private readonly fill = new InstancedMesh(this.fillGeometry, this.fillMaterial, MAX_BARS);

  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly scale = new Vector3();
  private readonly right = new Vector3();
  private readonly quaternion = new Quaternion();
  private readonly color = new Color();

  constructor(scene: Scene) {
    for (const mesh of [this.back, this.fill]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    // Instanzfarben gleich anlegen: Kommen sie erst nach dem ersten Bild
    // dazu, ist der Shader schon ohne sie gebaut.
    for (let index = 0; index < MAX_BARS; index += 1) this.fill.setColorAt(index, FULL);
    // Ueber allem anderen, die Fuellung ueber ihrem Hintergrund.
    this.back.renderOrder = 20;
    this.fill.renderOrder = 21;
  }

  /** Alle Balken dieses Bildes setzen. */
  update(bars: readonly BarRequest[], camera: Camera): void {
    camera.getWorldQuaternion(this.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.quaternion);
    const count = Math.min(bars.length, MAX_BARS);
    for (let index = 0; index < count; index += 1) {
      const bar = bars[index]!;
      const fraction = Math.max(0, Math.min(1, bar.fraction));

      this.position.set(bar.x, bar.y, bar.z);
      this.scale.set(bar.width + 2 * BORDER, BAR_HEIGHT + 2 * BORDER, 1);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.back.setMatrixAt(index, this.matrix);

      // Die Fuellung beginnt an der linken Kante des Balkens.
      this.position.addScaledVector(this.right, -bar.width / 2);
      this.scale.set(Math.max(0.001, bar.width * fraction), BAR_HEIGHT, 1);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      this.fill.setMatrixAt(index, this.matrix);
      this.fill.setColorAt(
        index,
        bar.color !== undefined ? this.color.setHex(bar.color) : colorFor(fraction, this.color),
      );
    }
    this.back.count = count;
    this.fill.count = count;
    this.back.instanceMatrix.needsUpdate = true;
    this.fill.instanceMatrix.needsUpdate = true;
    if (this.fill.instanceColor) this.fill.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    for (const mesh of [this.back, this.fill]) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    this.backGeometry.dispose();
    this.fillGeometry.dispose();
    this.backMaterial.dispose();
    this.fillMaterial.dispose();
  }
}

/** Gruen bei vollem Leben, gelb bei der Haelfte, rot kurz vor dem Ende. */
function colorFor(fraction: number, target: Color): Color {
  return fraction > 0.5
    ? target.copy(HALF).lerp(FULL, (fraction - 0.5) * 2)
    : target.copy(LOW).lerp(HALF, fraction * 2);
}
