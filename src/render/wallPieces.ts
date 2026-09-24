/**
 * Zerlegt ein Wandrechteck in Stuecke aus dem Sheet: Ecken, Kanten, Mitte -
 * oder bei einer duennen Wand zwei Endkappen und ein Mittelstueck.
 *
 * ================================================================
 * WARUM DAS NICHT EINFACH EIN `tileSprite` IST
 * ================================================================
 *
 * Bis Etappe 5 war jede Wand eine einzige wiederholte Kachel (Ziegel oder
 * Stein) mit einem gezeichneten Umriss darum. Eine Wand hatte damit keinen
 * Anfang und kein Ende - sie hoerte einfach auf, wie aus einer Tapete
 * geschnitten. Das Kenney-Paket hat dafuer eigene Stuecke: Ecken, Kanten und
 * Endkappen, genau wie im Beispielbild `public/assets/Sample.png`. Das
 * Arbeitsdokument verlangt sie ("Waende mit Ecken/Endstuecken").
 *
 * Die Stuecke passen nur, wenn eine Wand ein ganzes Vielfaches einer Kachel
 * ist. Deshalb liegt seit Etappe 5 jede Wand auf dem Kachelraster
 * (`WORLD.grid` in `config/balance.ts`). Einzige Ausnahme ist die LAENGE der
 * Aussenmauer (16000 ist kein Vielfaches von 48) - dort streckt sich nur das
 * Mittelstueck, und ein durchgehender Strich sieht angeschnitten genauso aus
 * wie ganz.
 *
 * Bewusst ohne Phaser, damit sich die Zerlegung im Test nachrechnen laesst.
 */

import type { Rect } from "../systems/types";

/** Welche Rolle ein Stueck spielt - daraus folgt die Kachel im Sheet. */
export type WallPieceRole =
  | "single"
  | "hLeft"
  | "hMid"
  | "hRight"
  | "vTop"
  | "vMid"
  | "vBottom"
  | "topLeft"
  | "top"
  | "topRight"
  | "left"
  | "center"
  | "right"
  | "bottomLeft"
  | "bottom"
  | "bottomRight"
  | "cornerTopLeft"
  | "cornerTopRight"
  | "cornerBottomLeft"
  | "cornerBottomRight";

export interface WallPiece extends Rect {
  role: WallPieceRole;
}

/**
 * @param wall Das Rechteck aus der Simulation.
 * @param size Kantenlaenge einer Kachel in Weltpixeln (16 x WORLD_SCALE).
 */
export function wallPieces(wall: Rect, size: number): WallPiece[] {
  const { x, y, width, height } = wall;
  // Toleranz fuer Rundung: "eine Kachel dick" heisst hoechstens eine Kachel.
  const thinX = width <= size + 0.5;
  const thinY = height <= size + 0.5;

  if (thinX && thinY) {
    return [{ x, y, width, height, role: "single" }];
  }

  if (thinY) {
    // Waagerecht, eine Kachel dick: Kappe - Mitte - Kappe.
    return compact([
      { x, y, width: size, height, role: "hLeft" },
      { x: x + size, y, width: width - 2 * size, height, role: "hMid" },
      { x: x + width - size, y, width: size, height, role: "hRight" },
    ]);
  }

  if (thinX) {
    // Senkrecht, eine Kachel dick.
    return compact([
      { x, y, width, height: size, role: "vTop" },
      { x, y: y + size, width, height: height - 2 * size, role: "vMid" },
      { x, y: y + height - size, width, height: size, role: "vBottom" },
    ]);
  }

  // Dicker Block: Neunerteilung.
  const innerWidth = width - 2 * size;
  const innerHeight = height - 2 * size;
  const columns = [
    { offset: 0, length: size, name: "Left" },
    { offset: size, length: innerWidth, name: "" },
    { offset: size + innerWidth, length: size, name: "Right" },
  ];
  const rows = [
    { offset: 0, length: size, name: "top" },
    { offset: size, length: innerHeight, name: "" },
    { offset: size + innerHeight, length: size, name: "bottom" },
  ];

  const pieces: WallPiece[] = [];
  for (const row of rows) {
    for (const column of columns) {
      pieces.push({
        x: x + column.offset,
        y: y + row.offset,
        width: column.length,
        height: row.length,
        role: nineSliceRole(row.name, column.name),
      });
    }
  }
  return compact(pieces);
}

function nineSliceRole(row: string, column: string): WallPieceRole {
  if (row === "" && column === "") return "center";
  if (row === "") return column === "Left" ? "left" : "right";
  if (column === "") return row === "top" ? "top" : "bottom";
  return `${row}${column}` as WallPieceRole;
}

/** Stuecke ohne Flaeche weglassen - Phaser stuerzt bei 0 Pixeln ab. */
function compact(pieces: WallPiece[]): WallPiece[] {
  return pieces.filter((piece) => piece.width >= 1 && piece.height >= 1);
}

/**
 * Legt zusammenhaengende duenne Waende ZELLENWEISE aus - fuer Gebaeude.
 *
 * `wallPieces` behandelt jedes Rechteck fuer sich und gibt ihm an beiden
 * Enden eine Kappe. Bei einem Haus aus vier Wandstuecken sass dadurch an
 * jeder Ecke eine Kappe neben einer Kappe - im Emulator sah das Haus aus wie
 * aus Einzelteilen zusammengeschoben. Das Paket hat fuer duenne Waende eigene
 * ECKSTUECKE; welches passt, haengt davon ab, in welche Richtungen die Wand
 * weiterlaeuft. Genau das wird hier je Zelle nachgesehen:
 *
 *   rechts + links -> Mitte waagerecht     oben + unten -> Mitte senkrecht
 *   nur rechts     -> Kappe links          nur unten    -> Kappe oben  (usw.)
 *   rechts + unten -> Ecke oben links      links + oben -> Ecke unten rechts
 *
 * Eine Kappe steht damit nur noch dort, wo die Wand wirklich endet: an der
 * Tuer.
 *
 * Setzt voraus, dass alle Rechtecke auf dem Raster liegen.
 */
export function joinedWallCells(walls: readonly Rect[], size: number): WallPiece[] {
  const key = (column: number, row: number): string => `${column},${row}`;
  const cells = new Set<string>();
  for (const wall of walls) {
    const x0 = Math.round(wall.x / size);
    const y0 = Math.round(wall.y / size);
    const columns = Math.round(wall.width / size);
    const rows = Math.round(wall.height / size);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        cells.add(key(x0 + column, y0 + row));
      }
    }
  }

  const pieces: WallPiece[] = [];
  for (const cell of cells) {
    const [column = 0, row = 0] = cell.split(",").map(Number);
    const up = cells.has(key(column, row - 1));
    const down = cells.has(key(column, row + 1));
    const left = cells.has(key(column - 1, row));
    const right = cells.has(key(column + 1, row));
    pieces.push({
      x: column * size,
      y: row * size,
      width: size,
      height: size,
      role: roleFromNeighbours(up, down, left, right),
    });
  }
  return pieces;
}

function roleFromNeighbours(up: boolean, down: boolean, left: boolean, right: boolean): WallPieceRole {
  if (right && down && !left && !up) return "cornerTopLeft";
  if (left && down && !right && !up) return "cornerTopRight";
  if (right && up && !left && !down) return "cornerBottomLeft";
  if (left && up && !right && !down) return "cornerBottomRight";
  if ((left || right) && !up && !down) {
    if (left && right) return "hMid";
    return right ? "hLeft" : "hRight";
  }
  if ((up || down) && !left && !right) {
    if (up && down) return "vMid";
    return down ? "vTop" : "vBottom";
  }
  if (!up && !down && !left && !right) return "single";
  // Kreuzungen und T-Stuecke kommen bei Gebaeuden aus vier Seiten nicht vor.
  // Faellt doch einmal eine an, ist die Mitte die harmloseste Wahl.
  return up || down ? "vMid" : "hMid";
}

