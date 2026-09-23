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

/**
 * Bewegt einen Kreis um `velocity * dt` - aber GETRENNT NACH ACHSEN.
 *
 * Erst X bewegen und gegen die Waende pruefen, dann Y. Das ist das uebliche
 * Muster aus Arcade-Physik, und es hat einen konkreten Vorteil gegenueber
 * "beides auf einmal, danach herausschieben":
 *
 *   Wird schraeg gegen eine Wand gedrueckt, ist nur EINE Achse blockiert. Bei
 *   getrennter Aufloesung kommt die andere Achse im SELBEN Tick durch - die
 *   Figur gleitet ohne Stocken. Loest man beides zusammen auf, wird zuerst
 *   diagonal verschoben und danach auf die Wand zurueckgesetzt; der Anteil
 *   laengs der Wand kann dabei verloren gehen, je nachdem, wo der naechste
 *   Punkt der Wand liegt.
 *
 * Warum nicht Phaser Arcade Physics, wo es das fertig gibt? Weil die Simulation
 * ohne Phaser laufen muss (CLAUDE.md, Architektur-Grundregel): Der Host rechnet
 * die Runde fuer alle Mitspieler, und die Tests spielen ganze Runden ohne
 * Browser durch. Das Muster laesst sich aber genauso hier umsetzen.
 *
 * Die Rechnung je Achse ist exakt, nicht geraten: Fuer einen Kreis neben einem
 * achsenparallelen Rechteck laesst sich der erlaubte Abstand geschlossen
 * angeben (Satz des Pythagoras, siehe unten).
 */
export function moveAndCollide(
  position: Vec2,
  velocity: Vec2,
  radius: number,
  walls: readonly Rect[],
  dt: number,
): void {
  position.x += velocity.x * dt;
  if (velocity.x !== 0) {
    resolveAxisX(position, velocity, radius, walls);
  }

  position.y += velocity.y * dt;
  if (velocity.y !== 0) {
    resolveAxisY(position, velocity, radius, walls);
  }

  // Nachlauf fuer den Sonderfall, dass die Figur in einer Innenecke zwischen
  // zwei Waenden steckt: Dort kann die Aufloesung der einen Achse die andere
  // wieder verletzen.
  resolveAgainstWalls(position, velocity, radius, walls);
}

function resolveAxisX(
  position: Vec2,
  velocity: Vec2,
  radius: number,
  walls: readonly Rect[],
): void {
  for (const wall of walls) {
    const top = wall.y;
    const bottom = wall.y + wall.height;
    const nearestY = clamp(position.y, top, bottom);
    const gapY = position.y - nearestY;
    const gapYSquared = gapY * gapY;
    if (gapYSquared >= radius * radius) {
      // Auf dieser Hoehe kann die Wand gar nicht im Weg sein.
      continue;
    }

    // Wie weit der Mittelpunkt in X von der Wandkante wegbleiben muss, damit
    // sich Kreis und Rechteck auf dieser Hoehe nicht mehr beruehren.
    const halfSpan = Math.sqrt(radius * radius - gapYSquared);
    const left = wall.x;
    const right = wall.x + wall.width;

    if (position.x > left - halfSpan && position.x < right + halfSpan) {
      if (velocity.x > 0) {
        position.x = left - halfSpan;
      } else {
        position.x = right + halfSpan;
      }
      velocity.x = 0;
    }
  }
}

function resolveAxisY(
  position: Vec2,
  velocity: Vec2,
  radius: number,
  walls: readonly Rect[],
): void {
  for (const wall of walls) {
    const left = wall.x;
    const right = wall.x + wall.width;
    const nearestX = clamp(position.x, left, right);
    const gapX = position.x - nearestX;
    const gapXSquared = gapX * gapX;
    if (gapXSquared >= radius * radius) {
      continue;
    }

    const halfSpan = Math.sqrt(radius * radius - gapXSquared);
    const top = wall.y;
    const bottom = wall.y + wall.height;

    if (position.y > top - halfSpan && position.y < bottom + halfSpan) {
      if (velocity.y > 0) {
        position.y = top - halfSpan;
      } else {
        position.y = bottom + halfSpan;
      }
      velocity.y = 0;
    }
  }
}

/**
 * Sichtlinie: Niemand schiesst durch Waende. Statt einer exakten
 * Schnittrechnung wird die Linie in Schritten abgetastet - kurz, lesbar und
 * bei dieser Kartengroesse genau genug.
 *
 * STAND BIS PHASE 9 IN `enemies.ts`. Umgezogen, weil sie dort einen Import-
 * Zyklus erzwungen haette: `boss.ts` braucht sie, und `enemies.ts` braucht
 * `boss.ts`. Sie ist ohnehin reine Geometrie und gehoert damit hierher.
 */
export function hasLineOfSight(walls: readonly Rect[], from: Vec2, to: Vec2): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const steps = Math.ceil(distance / 24);

  for (let i = 1; i < steps; i += 1) {
    const x = from.x + (dx * i) / steps;
    const y = from.y + (dy * i) / steps;
    for (const wall of walls) {
      if (x >= wall.x && x <= wall.x + wall.width && y >= wall.y && y <= wall.y + wall.height) {
        return false;
      }
    }
  }

  return true;
}
