/**
 * Die Massstab-Regel (Etappe 6) auch in 3D: Die eigene Figur soll mit der
 * Standardkamera 5-7 % der Bildhoehe einnehmen.
 *
 * In 2D war das eine Multiplikation (Koerperhoehe x Zoom / 540). In 3D haengt
 * es an Abstand, Bildwinkel und Neigung zugleich - deshalb wird es hier mit
 * der echten Kamera gemessen: jeden Eckpunkt der Platzhalter-Kapsel auf den
 * Bildschirm projizieren und die senkrechte Ausdehnung ablesen. (Ein Quader
 * um die Kapsel waere einfacher, ueberschaetzt aber um rund ein Viertel -
 * die runden Enden fuellen seine Ecken nicht.) Das
 * Seitenverhaeltnis spielt dabei keine Rolle, weil der Bildwinkel senkrecht
 * gilt.
 *
 * Wer die Kamera per `?tune=view3d.*` verstellt, verlaesst die Regel
 * vielleicht - das ist dann Absicht. Wer aber die Voreinstellung aendert,
 * merkt hier, ob die Figur noch im Rahmen liegt.
 */

import { CapsuleGeometry, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { FollowCamera } from "../../src/render/FollowCamera";
import { PLAYER_SHAPE } from "../../src/render/placeholders";
import { toThree } from "../../src/render/space3d";

export function figureShare(): number {
  const at = { x: 8000, y: 8000 };
  const follow = new FollowCamera();
  follow.follow(at, 16, 1184 / 540);

  const base = toThree(at, 0);
  const r = PLAYER_SHAPE.radius;
  // Dieselbe Form wie in `EntityView`, mit dem Fuss auf dem Boden.
  const capsule = new CapsuleGeometry(r, PLAYER_SHAPE.height - 2 * r, 6, 14);
  const vertices = capsule.getAttribute("position");
  const point = new Vector3();
  let top = -Infinity;
  let bottom = Infinity;
  for (let index = 0; index < vertices.count; index += 1) {
    point
      .fromBufferAttribute(vertices, index)
      .add(base)
      .setY(vertices.getY(index) + PLAYER_SHAPE.height / 2)
      .project(follow.camera);
    top = Math.max(top, point.y);
    bottom = Math.min(bottom, point.y);
  }
  capsule.dispose();
  // NDC reicht von -1 bis 1, also ist die ganze Bildhoehe 2.
  return (top - bottom) / 2;
}

describe("Massstab der Figur in 3D", () => {
  it("nimmt mit der Standardkamera 5-7 % der Bildhoehe ein", () => {
    const share = figureShare();
    expect(share).toBeGreaterThanOrEqual(0.05);
    expect(share).toBeLessThanOrEqual(0.07);
  });
});
