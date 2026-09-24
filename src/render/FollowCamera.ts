/**
 * Die feste, angewinkelte Kamera (3D-Umbau, BRIEFING Abschnitt 5).
 *
 * Sie FOLGT der eigenen Figur (Position), dreht sich aber NIE mit ihr. Wer
 * nach links laeuft, sieht die Welt nach rechts gleiten - der Horizont bleibt,
 * wo er ist. Eine mitdrehende Kamera waere fuer einen Twin-Stick-Shooter
 * falsch: "oben" auf dem Joystick hiesse dann jedes Mal etwas anderes.
 *
 * Aufbau: Die Kamera haengt an einem festen Arm (`VIEW3D.distance`) ueber und
 * hinter dem Blickpunkt, geneigt um `VIEW3D.pitch`, gedreht um `VIEW3D.yaw`.
 * Der Blickpunkt folgt der Figur mit leichter Traegheit.
 *
 * Die Werte werden JEDES BILD aus `VIEW3D` gelesen. So wirkt `?tune=view3d.*`
 * ohne Neubau, und spaeter liesse sich die Kamera auch im Spiel verstellen.
 */

import { PerspectiveCamera, Vector3 } from "three";
import { VIEW3D } from "../config/constants";
import type { ViewOrientation } from "../input/viewMapping";
import type { Vec2 } from "../systems/types";
import { radians, toThree } from "./space3d";

/** Knapp unter 90 Grad: Genau senkrecht weiss `lookAt` nicht, wo oben ist. */
const MAX_PITCH = 89;

export class FollowCamera {
  readonly camera = new PerspectiveCamera(VIEW3D.fov, 16 / 9, 0.5, 600);

  /** Der Punkt, auf den die Kamera schaut - folgt der Figur mit Traegheit. */
  private readonly focus = new Vector3();
  private readonly goal = new Vector3();
  private readonly scratch = new Vector3();
  private placed = false;

  /** Wie die Kamera gerade auf den Boden blickt - fuer die Joystick-Umrechnung. */
  get orientation(): ViewOrientation {
    return {
      yaw: radians(VIEW3D.yaw),
      pitch: radians(Math.min(VIEW3D.pitch, MAX_PITCH)),
    };
  }

  /**
   * Einen Schritt nachziehen.
   *
   * @param target  Position der eigenen Figur in Simulationspixeln.
   * @param deltaMs Zeit seit dem letzten Bild.
   * @param aspect  Seitenverhaeltnis des Canvas.
   */
  follow(target: Vec2, deltaMs: number, aspect: number): void {
    toThree(target, VIEW3D.lookHeight, this.goal);

    if (!this.placed) {
      // Beim ersten Bild direkt hin - sonst sieht man zu Beginn jedes Runs
      // die Kamera quer ueber die Karte fliegen.
      this.focus.copy(this.goal);
      this.placed = true;
    } else {
      // Traegheit unabhaengig von der Bildrate: Bei 30 Bildern je Sekunde
      // wird je Bild so weit nachgezogen wie bei 60 in zwei Bildern.
      const frames = Math.min(deltaMs, 100) / (1000 / 60);
      const keep = Math.pow(1 - VIEW3D.followLerp, frames);
      this.focus.lerp(this.goal, 1 - keep);
    }

    this.place(aspect);
  }

  /** Kamera an den Arm setzen und auf den Blickpunkt richten. */
  place(aspect: number): void {
    const { yaw, pitch } = this.orientation;
    const horizontal = VIEW3D.distance * Math.cos(pitch);

    /*
     * Der Arm zeigt vom Blickpunkt zur Kamera. Bei yaw 0 steht die Kamera im
     * Sueden (+z), schaut also nach Norden (-z) - "oben" auf dem Bildschirm
     * ist Norden, wie in der 2D-Ansicht. `input/viewMapping.ts` rechnet mit
     * genau dieser Lage; `tests/render/followCamera.test.ts` prueft, dass
     * beides zusammenpasst.
     */
    this.scratch.set(
      Math.sin(yaw) * horizontal,
      VIEW3D.distance * Math.sin(pitch),
      Math.cos(yaw) * horizontal,
    );

    this.camera.position.copy(this.focus).add(this.scratch);
    this.camera.lookAt(this.focus);

    if (this.camera.aspect !== aspect || this.camera.fov !== VIEW3D.fov) {
      this.camera.aspect = aspect;
      this.camera.fov = VIEW3D.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
  }

  /**
   * Liegt ein Bodenpunkt im Bild? `margin` ist der Rand als Anteil der halben
   * Bildbreite, der noch als "draussen" gilt.
   */
  isOnScreen(position: Vec2, margin = 0.1): boolean {
    toThree(position, 0, this.scratch).project(this.camera);
    const limit = 1 - margin;
    return (
      this.scratch.z < 1 &&
      Math.abs(this.scratch.x) < limit &&
      Math.abs(this.scratch.y) < limit
    );
  }
}
