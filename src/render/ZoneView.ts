/**
 * Ausstiegszonen und Boss-Punkte als Ringe am Boden (3D).
 *
 * Die 2D-Fassung hatte Teppich und Ringe; in 3D gab es bisher nichts - man
 * haette die Zone nur ueber den Kompass gefunden. Hier das Noetigste, damit
 * ein Knoten-Gebiet einen sichtbaren Ausgang hat:
 *
 *   Ausstieg   gruener Ring mit genau dem Wirkradius, innen eine
 *              pulsierende Flaeche; waehrend des Countdowns fuellt sie sich
 *   Boss       Ring in Gefahrenfarbe mit dem Ausloeseradius - wer ihn
 *              betritt, weckt den Boss; nach dem Sieg verschwindet er
 *
 * Die Radien kommen aus dem Weltzustand bzw. `ENCOUNTERS` - dieselben Zahlen,
 * mit denen die Simulation rechnet.
 */

import { CircleGeometry, DoubleSide, Mesh, MeshBasicMaterial, RingGeometry } from "three";
import type { Scene } from "three";
import { ENCOUNTERS } from "../config/balance";
import { COLORS } from "../config/constants";
import { extractionFraction } from "../systems/encounters";
import type { WorldState } from "../systems/types";
import { meters, toThree } from "./space3d";

const LIFT = 0.03;

export class ZoneView {
  private readonly exits: Array<{ ring: Mesh; fill: Mesh }> = [];
  private readonly bosses: Mesh[] = [];
  private readonly materials: MeshBasicMaterial[] = [];
  private readonly geometries: Array<RingGeometry | CircleGeometry> = [];
  private time = 0;

  constructor(scene: Scene, state: WorldState) {
    for (const zone of state.extractions) {
      const radius = meters(zone.radius);
      const ring = this.flat(new RingGeometry(radius - 0.12, radius, 64), COLORS.mate, 0.9);
      const fill = this.flat(new CircleGeometry(radius - 0.12, 64), COLORS.mate, 0.18);
      toThree(zone.position, LIFT, ring.position);
      toThree(zone.position, LIFT, fill.position);
      scene.add(ring, fill);
      this.exits.push({ ring, fill });
    }
    for (const spot of state.encounters) {
      const radius = meters(ENCOUNTERS.triggerRadius);
      const ring = this.flat(new RingGeometry(radius - 0.08, radius, 72), COLORS.danger, 0.7);
      toThree(spot.position, LIFT, ring.position);
      scene.add(ring);
      this.bosses.push(ring);
    }
  }

  update(state: WorldState, seconds: number): void {
    this.time += seconds;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    state.extractions.forEach((zone, index) => {
      const exit = this.exits[index];
      if (!exit) return;
      exit.ring.visible = zone.discovered;
      exit.fill.visible = zone.discovered;
      // Laeuft der Countdown hier, fuellt sich die Flaeche.
      const counting = state.extractionIndex === index ? extractionFraction(state) : 0;
      (exit.fill.material as MeshBasicMaterial).opacity = 0.12 + 0.1 * pulse + 0.5 * counting;
    });
    state.encounters.forEach((spot, index) => {
      const ring = this.bosses[index];
      if (ring) ring.visible = spot.status !== "cleared";
    });
  }

  dispose(): void {
    for (const { ring, fill } of this.exits) {
      ring.removeFromParent();
      fill.removeFromParent();
    }
    for (const ring of this.bosses) ring.removeFromParent();
    for (const material of this.materials) material.dispose();
    for (const geometry of this.geometries) geometry.dispose();
  }

  private flat(geometry: RingGeometry | CircleGeometry, color: number, opacity: number): Mesh {
    geometry.rotateX(-Math.PI / 2);
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: DoubleSide,
    });
    this.geometries.push(geometry);
    this.materials.push(material);
    return new Mesh(geometry, material);
  }
}
