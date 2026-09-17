import { describe, expect, it } from "vitest";
import { resolveAgainstWalls, resolveCircleRect } from "../../src/systems/collision";
import type { Rect } from "../../src/systems/types";

const WALL: Rect = { x: 100, y: 100, width: 200, height: 50 };

describe("resolveCircleRect", () => {
  it("laesst einen Kreis ausserhalb des Rechtecks unveraendert", () => {
    const position = { x: 50, y: 50 };
    expect(resolveCircleRect(position, 10, WALL)).toBeNull();
    expect(position).toEqual({ x: 50, y: 50 });
  });

  it("schiebt einen ueberlappenden Kreis genau bis an die Kante", () => {
    // Kreis steckt 5 px in der Oberkante der Wand.
    const position = { x: 200, y: 95 };
    const normal = resolveCircleRect(position, 20, WALL);

    expect(normal).toEqual({ x: 0, y: -1 });
    expect(position.x).toBe(200);
    expect(position.y).toBeCloseTo(80, 6);
  });

  it("schiebt einen Kreis, dessen Mittelpunkt in der Wand steckt, auf dem kuerzesten Weg heraus", () => {
    const position = { x: 200, y: 110 };
    const normal = resolveCircleRect(position, 10, WALL);

    expect(normal).toEqual({ x: 0, y: -1 });
    expect(position.y).toBeCloseTo(90, 6);
  });
});

describe("resolveAgainstWalls", () => {
  it("entfernt nur den Geschwindigkeitsanteil, der in die Wand zeigt (Gleiten)", () => {
    const position = { x: 200, y: 95 };
    const velocity = { x: 150, y: -200 };

    resolveAgainstWalls(position, velocity, 20, [WALL]);

    // Nach oben aus der Wand heraus: die Bewegung nach oben bleibt erhalten,
    // weil sie von der Wand wegzeigt.
    expect(velocity.x).toBe(150);
    expect(velocity.y).toBe(-200);
    expect(position.y).toBeCloseTo(80, 6);
  });

  it("bremst die Bewegung in die Wand hinein ab", () => {
    const position = { x: 200, y: 95 };
    const velocity = { x: 150, y: 200 };

    resolveAgainstWalls(position, velocity, 20, [WALL]);

    expect(velocity.x).toBe(150);
    expect(velocity.y).toBe(0);
  });

  it("loest auch eine Innenecke aus zwei Waenden auf", () => {
    const walls: Rect[] = [
      { x: 0, y: 0, width: 40, height: 400 },
      { x: 0, y: 0, width: 400, height: 40 },
    ];
    const position = { x: 45, y: 45 };
    const velocity = { x: -100, y: -100 };

    resolveAgainstWalls(position, velocity, 20, walls);

    expect(position.x).toBeGreaterThanOrEqual(60 - 1e-6);
    expect(position.y).toBeGreaterThanOrEqual(60 - 1e-6);
    expect(velocity.x).toBe(0);
    expect(velocity.y).toBe(0);
  });
});
