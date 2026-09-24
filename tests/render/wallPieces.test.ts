/**
 * Die Zerlegung einer Wand in Stuecke aus dem Sheet.
 *
 * Was hier schiefgehen kann, sieht man im Spiel sofort - aber nur an einer
 * Stelle, an der man gerade vorbeilaeuft: eine Ecke mitten in der Wand, eine
 * Luecke, ein Stueck doppelt. Der Test prueft es fuer alle Formen auf einmal.
 */

import { describe, expect, it } from "vitest";
import { joinedWallCells, wallPieces } from "../../src/render/wallPieces";
import { buildingWalls } from "../../src/systems/WorldGenerator";
import type { Rect } from "../../src/systems/types";

const S = 48;

/** Decken die Stuecke das Rechteck genau ab - ohne Luecke, ohne Doppel? */
function coversExactly(wall: Rect, pieces: Rect[]): boolean {
  const area = pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0);
  if (Math.abs(area - wall.width * wall.height) > 0.001) return false;
  return pieces.every(
    (piece) =>
      piece.x >= wall.x &&
      piece.y >= wall.y &&
      piece.x + piece.width <= wall.x + wall.width &&
      piece.y + piece.height <= wall.y + wall.height,
  );
}

describe("Wandstuecke", () => {
  it("nimmt fuer einen einzelnen Block das Einzelstueck", () => {
    const pieces = wallPieces({ x: 0, y: 0, width: S, height: S }, S);
    expect(pieces.map((piece) => piece.role)).toEqual(["single"]);
  });

  it("gibt einer duennen waagerechten Wand zwei Endkappen", () => {
    const wall = { x: 96, y: 48, width: 5 * S, height: S };
    const pieces = wallPieces(wall, S);
    expect(pieces.map((piece) => piece.role)).toEqual(["hLeft", "hMid", "hRight"]);
    expect(coversExactly(wall, pieces)).toBe(true);
  });

  it("gibt einer duennen senkrechten Wand zwei Endkappen", () => {
    const wall = { x: 0, y: 0, width: S, height: 4 * S };
    const pieces = wallPieces(wall, S);
    expect(pieces.map((piece) => piece.role)).toEqual(["vTop", "vMid", "vBottom"]);
    expect(coversExactly(wall, pieces)).toBe(true);
  });

  it("laesst bei zwei Kacheln Laenge das Mittelstueck weg", () => {
    const pieces = wallPieces({ x: 0, y: 0, width: 2 * S, height: S }, S);
    expect(pieces.map((piece) => piece.role)).toEqual(["hLeft", "hRight"]);
  });

  it("zerlegt einen dicken Block in neun Teile mit Ecken", () => {
    const wall = { x: 0, y: 0, width: 4 * S, height: 3 * S };
    const pieces = wallPieces(wall, S);
    expect(pieces).toHaveLength(9);
    expect(pieces[0]?.role).toBe("topLeft");
    expect(pieces[8]?.role).toBe("bottomRight");
    expect(coversExactly(wall, pieces)).toBe(true);
  });

  it("streckt bei der Aussenmauer nur die Mitte", () => {
    // 16000 ist kein Vielfaches von 48 - die Kappen bleiben trotzdem ganz.
    const wall = { x: 0, y: 0, width: 16000, height: S };
    const pieces = wallPieces(wall, S);
    expect(pieces[0]?.width).toBe(S);
    expect(pieces[2]?.width).toBe(S);
    expect(coversExactly(wall, pieces)).toBe(true);
  });
});

describe("Gebaeudewaende mit Eckstuecken", () => {
  it("setzt Ecken an die Ecken und Kappen nur an die Tuer", () => {
    // Ein Haus aus dem echten Generator: 8 x 6 Kacheln, Tuer unten in der
    // Mitte. (Bei 6 Kacheln Breite rueckt die Tuer bis an die Ecke - dort ist
    // eine Kappe statt einer Ecke richtig.)
    const walls = buildingWalls({ x: 0, y: 0, width: 8 * S, height: 6 * S }, 2, 0.5);
    const cells = joinedWallCells(walls, S);
    const at = (column: number, row: number): string | undefined =>
      cells.find((cell) => cell.x === column * S && cell.y === row * S)?.role;

    expect(at(0, 0)).toBe("cornerTopLeft");
    expect(at(7, 0)).toBe("cornerTopRight");
    expect(at(0, 5)).toBe("cornerBottomLeft");
    expect(at(7, 5)).toBe("cornerBottomRight");
    expect(at(2, 0)).toBe("hMid");
    expect(at(0, 2)).toBe("vMid");

    // Unten sitzt die Tuer (3 Kacheln breit): davor und dahinter je eine Kappe.
    const caps = cells.filter((cell) => cell.role === "hLeft" || cell.role === "hRight");
    expect(caps).toHaveLength(2);
    // Keine andere Kappe am ganzen Haus.
    expect(cells.some((cell) => cell.role === "vTop" || cell.role === "vBottom")).toBe(false);
  });
});

