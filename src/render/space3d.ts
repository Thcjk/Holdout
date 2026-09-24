/**
 * Simulation -> 3D-Raum. Die EINZIGE Stelle, an der umgerechnet wird.
 *
 * Die Simulation rechnet auf einer flachen Ebene in Pixeln: x nach rechts,
 * y nach "unten" (Sueden). Three.js hat die Hoehe auf y. Die Bodenebene ist
 * dort x/z:
 *
 *   Sim (x, y) in Pixeln  ->  Three (x / 48, hoehe, y / 48) in Metern
 *
 * Sim-y wird zu Three-z, ohne Vorzeichenwechsel. Mit der Kamera im Sueden
 * (yaw 0) liegt Sim-"oben" damit auch auf dem Bildschirm oben - genau wie in
 * der alten 2D-Ansicht. Wer hier ein Minus einfuegt, spiegelt die Welt, und
 * der Joystick liefe nach unten, wenn man ihn nach oben drueckt.
 */

import { Vector3 } from "three";
import { VIEW3D } from "../config/constants";
import type { Vec2 } from "../systems/types";

/** Eine Laenge aus der Simulation (Pixel) in Metern. */
export function meters(pixels: number): number {
  return pixels / VIEW3D.pixelsPerMeter;
}

/** Ein Punkt der Simulation als 3D-Punkt, auf der angegebenen Hoehe (Meter). */
export function toThree(position: Vec2, height = 0, out = new Vector3()): Vector3 {
  return out.set(meters(position.x), height, meters(position.y));
}

/** Grad -> Bogenmass. Die Kamerawerte stehen in Grad, weil man sie so tunt. */
export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
