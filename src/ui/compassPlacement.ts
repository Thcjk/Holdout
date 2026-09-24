/**
 * Wo am Bildschirmrand sitzt der Kompasspfeil?
 *
 * Das Arbeitsdokument verlangt den Pfeil AM RAND: Dort erwartet man einen
 * Hinweis auf etwas ausserhalb des Bildes, und er verdeckt nichts vom
 * Geschehen in der Mitte. Der Rand ist aber schon besetzt - oben links die
 * Zone, oben rechts Punktzahl und Knoepfe, unten links Leben und Super, unten
 * rechts der Knopfbogen. Ein Pfeil, der auf "Ton an" sitzt, war genau der
 * Grund, warum er vorher nach innen gerueckt war.
 *
 * Die Loesung: Der Pfeil laeuft auf einem Rahmen knapp innerhalb des Bildes.
 * Faellt die Stelle in eine Sperrflaeche, rutscht er AUF DERSELBEN KANTE bis
 * hinter die Flaeche. Er zeigt dann weiterhin in die echte Richtung - nur sein
 * Sitz weicht ein Stueck aus.
 *
 * Bewusst ohne Phaser, damit es sich im Test nachrechnen laesst.
 */

import type { Vec2 } from "../systems/types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * @param angle   Richtung zum Ziel im Bogenmass, 0 = rechts, wie `Math.atan2`.
 * @param frame   Der Rahmen, auf dem der Pfeil laeuft (schon um den Rand
 *                eingerueckt).
 * @param keepOut Flaechen, die der Pfeil nicht betreten darf.
 * @param gap     Abstand, den der Pfeil zu einer Sperrflaeche haelt.
 */
export function placeOnEdge(
  angle: number,
  frame: Rect,
  keepOut: readonly Rect[],
  gap = 22,
): Vec2 {
  const halfWidth = frame.width / 2;
  const halfHeight = frame.height / 2;
  const centerX = frame.x + halfWidth;
  const centerY = frame.y + halfHeight;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // Wie weit laeuft der Strahl aus der Mitte, bis er eine senkrechte bzw.
  // waagrechte Kante trifft? Die kleinere Zahl ist die Kante, die er zuerst
  // erreicht.
  const toVertical = Math.abs(dx) < 1e-9 ? Infinity : halfWidth / Math.abs(dx);
  const toHorizontal = Math.abs(dy) < 1e-9 ? Infinity : halfHeight / Math.abs(dy);
  const onVerticalEdge = toVertical < toHorizontal;
  const reach = Math.min(toVertical, toHorizontal);

  const point = { x: centerX + dx * reach, y: centerY + dy * reach };

  // Mehrere Durchgaenge: Wer aus einer Flaeche herausrutscht, kann in der
  // naechsten landen. Vier reichen fuer vier Ecken.
  for (let pass = 0; pass < 4; pass += 1) {
    const blocker = keepOut.find((rect) => inside(point, rect, gap));
    if (!blocker) {
      break;
    }

    if (onVerticalEdge) {
      point.y = slide(point.y, blocker.y - gap, blocker.y + blocker.height + gap, frame.y, frame.y + frame.height);
    } else {
      point.x = slide(point.x, blocker.x - gap, blocker.x + blocker.width + gap, frame.x, frame.x + frame.width);
    }
  }

  return point;
}

/** Liegt der Punkt in der Flaeche, samt Abstand drumherum? */
function inside(point: Vec2, rect: Rect, gap: number): boolean {
  return (
    point.x > rect.x - gap &&
    point.x < rect.x + rect.width + gap &&
    point.y > rect.y - gap &&
    point.y < rect.y + rect.height + gap
  );
}

/**
 * Schiebt einen Wert an das naehere Ende einer Sperrstrecke - aber nur, wenn
 * dieses Ende noch auf der Kante liegt. Liegt keines darauf, bleibt der Wert,
 * wie er ist: lieber ein Pfeil, der etwas ueberdeckt, als gar keiner.
 */
function slide(value: number, before: number, after: number, min: number, max: number): number {
  const options = [before, after].filter((option) => option >= min && option <= max);
  if (options.length === 0) {
    return value;
  }
  return options.reduce((best, option) =>
    Math.abs(option - value) < Math.abs(best - value) ? option : best,
  );
}
