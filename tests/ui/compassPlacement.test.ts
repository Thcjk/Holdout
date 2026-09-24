/**
 * Der Kompasspfeil sitzt am Rand - aber nie auf einer HUD-Anzeige.
 */

import { describe, expect, it } from "vitest";
import { placeOnEdge } from "../../src/ui/compassPlacement";
import type { Rect } from "../../src/ui/compassPlacement";

const FRAME: Rect = { x: 30, y: 30, width: 1109, height: 480 };

describe("Kompass am Bildschirmrand", () => {
  it("sitzt ohne Sperrflaechen genau auf der Kante in Zielrichtung", () => {
    const right = placeOnEdge(0, FRAME, []);
    expect(right.x).toBeCloseTo(FRAME.x + FRAME.width);
    expect(right.y).toBeCloseTo(FRAME.y + FRAME.height / 2);

    const up = placeOnEdge(-Math.PI / 2, FRAME, []);
    expect(up.y).toBeCloseTo(FRAME.y);
    expect(up.x).toBeCloseTo(FRAME.x + FRAME.width / 2);
  });

  it("weicht einer Sperrflaeche auf derselben Kante aus", () => {
    // Knopfbogen unten rechts.
    const buttons: Rect = { x: 860, y: 260, width: 309, height: 280 };
    // Leicht nach unten rechts: trifft die rechte Kante mitten im Bogen.
    const point = placeOnEdge(0.3, FRAME, [buttons], 22);

    expect(point.x).toBeCloseTo(FRAME.x + FRAME.width);
    expect(point.y).toBeCloseTo(buttons.y - 22);
  });

  it("landet nie in einer der vier Ecken-Anzeigen", () => {
    const keepOut: Rect[] = [
      { x: 0, y: 0, width: 300, height: 90 },
      { x: 880, y: 0, width: 289, height: 160 },
      { x: 0, y: 460, width: 260, height: 80 },
      { x: 880, y: 250, width: 289, height: 290 },
    ];

    for (let step = 0; step < 72; step += 1) {
      const angle = (step / 72) * Math.PI * 2;
      const point = placeOnEdge(angle, FRAME, keepOut, 22);
      for (const rect of keepOut) {
        const hit =
          point.x > rect.x &&
          point.x < rect.x + rect.width &&
          point.y > rect.y &&
          point.y < rect.y + rect.height;
        expect(hit, `Winkel ${step * 5} Grad`).toBe(false);
      }
    }
  });
});
