/**
 * Kollision zwischen einem Kreis (Spieler, spaeter Gegner) und achsenparallelen
 * Rechtecken (Waende).
 *
 * Warum eigene Kollision statt Phaser Arcade Physics? Weil die Simulation ohne
 * Phaser laufen muss (siehe CLAUDE.md, Architektur-Grundregel). Ein Kreis gegen
 * Rechtecke ist wenige Zeilen Code und reicht fuer dieses Spiel voellig aus.
 *
 * Warum ein Kreis und kein Rechteck fuer den Spieler? Ein Kreis gleitet an Waenden
 * und Ecken entlang, statt sich daran zu verhaken. Genau dieses Verhaken ist der
 * haeufigste Grund, warum sich Top-down-Steuerung "zaeh" anfuehlt.
 */

import type { Rect, Vec2 } from "./types";

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Schiebt einen ueberlappenden Kreis aus einem Rechteck heraus - auf dem
 * kuerzesten Weg. `position` wird dabei veraendert.
 *
 * @returns Die Richtung, in die geschoben wurde (Einheitsvektor), oder null,
 *          wenn keine Ueberlappung vorlag.
 */
export function resolveCircleRect(position: Vec2, radius: number, rect: Rect): Vec2 | null {
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  // Der Punkt des Rechtecks, der dem Kreismittelpunkt am naechsten liegt.
  const nearestX = clamp(position.x, left, right);
  const nearestY = clamp(position.y, top, bottom);

  const dx = position.x - nearestX;
  const dy = position.y - nearestY;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared > radius * radius) {
    return null;
  }

  if (distanceSquared > 1e-8) {
    // Normalfall: Mittelpunkt liegt ausserhalb, der Rand ueberlappt.
    // Entlang der Verbindungslinie genau um den Radius nach aussen setzen.
    const distance = Math.sqrt(distanceSquared);
    const normalX = dx / distance;
    const normalY = dy / distance;
    position.x = nearestX + normalX * radius;
    position.y = nearestY + normalY * radius;
    return { x: normalX, y: normalY };
  }

  // Sonderfall: Der Mittelpunkt steckt im Rechteck. Dann gibt es keine
  // Verbindungslinie, also ueber die kleinste der vier Eindringtiefen hinausschieben.
  const penetrationLeft = position.x - left + radius;
  const penetrationRight = right - position.x + radius;
  const penetrationTop = position.y - top + radius;
  const penetrationBottom = bottom - position.y + radius;
  const smallest = Math.min(penetrationLeft, penetrationRight, penetrationTop, penetrationBottom);

  if (smallest === penetrationLeft) {
    position.x = left - radius;
    return { x: -1, y: 0 };
  }
  if (smallest === penetrationRight) {
    position.x = right + radius;
    return { x: 1, y: 0 };
  }
  if (smallest === penetrationTop) {
    position.y = top - radius;
    return { x: 0, y: -1 };
  }
  position.y = bottom + radius;
  return { x: 0, y: 1 };
}

/**
 * Loest die Kollision eines Kreises mit allen Waenden auf und bremst dabei die
 * Geschwindigkeit in Wandrichtung ab.
 *
 * Die Geschwindigkeit muss mitkorrigiert werden: Sonst druecken die naechsten
 * Ticks den Spieler weiter in die Wand, und er zittert am Hindernis.
 *
 * Zwei Durchgaenge, damit ein Kreis, der in eine Innenecke geschoben wird, auch
 * aus der zweiten Wand herauskommt.
 */
export function resolveAgainstWalls(
  position: Vec2,
  velocity: Vec2,
  radius: number,
  walls: readonly Rect[],
): void {
  for (let pass = 0; pass < 2; pass += 1) {
    let touched = false;

    for (const wall of walls) {
      const normal = resolveCircleRect(position, radius, wall);
      if (!normal) {
        continue;
      }
      touched = true;

      // Anteil der Geschwindigkeit, der in die Wand hineinzeigt, entfernen.
      // Was uebrig bleibt, ist die Bewegung entlang der Wand - das Gleiten.
      const into = velocity.x * normal.x + velocity.y * normal.y;
      if (into < 0) {
        velocity.x -= into * normal.x;
        velocity.y -= into * normal.y;
      }
    }

    if (!touched) {
      return;
    }
  }
}
