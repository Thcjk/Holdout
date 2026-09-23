/**
 * Die Welt eines Runs, erzeugt aus einer einzigen Zahl.
 *
 * Seit Phase 8 gibt es keine feste Arena mehr. Jeder Run bekommt einen Seed,
 * und aus dem entsteht die komplette Karte: Aussenmauern, Deckung, Buschfelder,
 * Startpunkt.
 *
 * ================================================================
 * DETERMINISMUS IST HIER PFLICHT, NICHT KUER
 * ================================================================
 *
 * Derselbe Seed MUSS immer exakt dieselbe Karte ergeben. Der Grund steht in
 * `net/Lobby.ts`: Der Host wuerfelt eine Zahl und schickt sie allen Mitspielern.
 * Jedes Geraet baut daraus seine eigene Welt - uebertragen wird die Karte NIE,
 * dafuer waere sie viel zu gross. Rechnet ein Geraet auch nur einen Block
 * anders, laeuft dieser Spieler gegen unsichtbare Waende, waehrend die anderen
 * ihn durch Deckung laufen sehen.
 *
 * Deshalb: kein `Math.random()` (nicht wiederholbar), keine Abhaengigkeit von
 * Zeit, Bildschirmgroesse oder Spielerzahl. Nur der Seed.
 *
 * ================================================================
 * ZWEI ZUFALLSSTROEME AUS EINEM SEED - UND WARUM DAS NOETIG IST
 * ================================================================
 *
 * Der Generator hat einen EIGENEN Zufallszustand und fasst den des Spiels
 * (`WorldState.rngState`) nicht an. Das ist kein Schoenheitsfehler, sondern
 * verhindert einen sehr unangenehmen Fehler:
 *
 * Wuerfelte die Weltgenerierung aus demselben Strom, dann wuerde EIN
 * zusaetzlicher Deckungsblock jede spaetere Zufallszahl im Spiel verschieben -
 * Streuung der Schuesse, Spawnpositionen, alles. Schlimmer noch: Host und
 * Client muessten dann fuer immer exakt gleich viele Zahlen ziehen, auch in
 * Code, der mit der Welt gar nichts zu tun hat.
 *
 * `gameplaySeed()` leitet deshalb einen zweiten, unabhaengigen Startwert ab.
 */

import { WORLD } from "../config/balance";
import { randomRange, type RngHolder } from "./rng";
import type { Rect, Vec2 } from "./types";

/** Das Ergebnis der Generierung - genau die Daten, die der Weltzustand braucht. */
export interface GeneratedWorld {
  /** Aussengrenzen der Karte. */
  bounds: Rect;
  /** Alles, was Bewegung blockiert: Aussenmauern und Deckungsbloecke. */
  walls: Rect[];
  /** Buschfelder: Gegner sehen Spieler darin nicht. */
  bushes: Rect[];
  /** Wo die Spieler starten. */
  spawnPoint: Vec2;
}

/**
 * Startwert des Spiel-Zufalls, abgeleitet vom Welt-Seed.
 *
 * Die Zahl 0x9e3779b9 ist der uebliche "goldene Schnitt" aus der Hashwelt. Sie
 * hat hier keine tiefere Bedeutung - sie sorgt nur dafuer, dass die beiden
 * Stroeme aus demselben Seed nicht dieselbe Folge liefern.
 */
export function gameplaySeed(seed: number): number {
  return (seed ^ 0x9e3779b9) | 0;
}

/** Abstand eines Punktes zum naechsten Punkt eines Rechtecks. */
function distanceToRect(rect: Rect, px: number, py: number): number {
  const dx = Math.max(rect.x - px, 0, px - (rect.x + rect.width));
  const dy = Math.max(rect.y - py, 0, py - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

/**
 * Liegen zwei Rechtecke weit genug auseinander, dass man dazwischen durchpasst?
 *
 * Geprueft wird je Achse getrennt und nicht ueber die Luftlinie: Zwei Bloecke
 * koennen diagonal nah beieinander liegen und trotzdem eine breite Gasse
 * zwischen sich lassen. Es reicht, wenn EINE Achse genug Platz hat.
 */
function hasGap(a: Rect, b: Rect, gap: number): boolean {
  const dx = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0);
  const dy = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0);
  return dx >= gap || dy >= gap;
}

/**
 * Baut die Welt.
 *
 * Reihenfolge und Schleifen sind bewusst starr: Die Zellen werden immer
 * zeilenweise durchlaufen, damit die Folge der Zufallszahlen bei gleichem Seed
 * identisch bleibt.
 */
export function generateWorld(seed: number): GeneratedWorld {
  // Eigener Zufallszustand - siehe Kopf der Datei.
  const rng: RngHolder = { rngState: seed | 0 };

  const size = WORLD.size;
  const bounds: Rect = { x: 0, y: 0, width: size, height: size };
  const spawnPoint: Vec2 = { x: size / 2, y: size / 2 };

  const walls: Rect[] = [...outerWalls(size)];
  const bushes: Rect[] = [];

  const half = WORLD.minGap / 2;
  // Innerhalb dieser Grenzen darf ueberhaupt etwas stehen: nicht in der
  // Aussenmauer und nicht so dicht davor, dass die Gasse daneben zu eng wird.
  const playableMin = WORLD.wallThickness + half;
  const playableMax = size - WORLD.wallThickness - half;

  const cells = Math.floor(size / WORLD.cellSize);

  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const cell: Rect = {
        x: column * WORLD.cellSize,
        y: row * WORLD.cellSize,
        width: WORLD.cellSize,
        height: WORLD.cellSize,
      };

      // Rund um den Start bleibt alles frei - man soll nicht zwischen Kisten
      // aufwachen, und Gegner erscheinen dort ohnehin nicht.
      if (distanceToRect(cell, spawnPoint.x, spawnPoint.y) < WORLD.safeRadius) {
        continue;
      }

      const area = {
        x0: Math.max(cell.x + half, playableMin),
        y0: Math.max(cell.y + half, playableMin),
        x1: Math.min(cell.x + cell.width - half, playableMax),
        y1: Math.min(cell.y + cell.height - half, playableMax),
      };

      placeCover(rng, area, walls);
      placeBush(rng, area, bushes);
    }
  }

  return { bounds, walls, bushes, spawnPoint };
}

/** Die vier Aussenmauern. Sie halten Spieler und Gegner im Feld. */
function outerWalls(size: number): Rect[] {
  const t = WORLD.wallThickness;
  return [
    { x: 0, y: 0, width: size, height: t },
    { x: 0, y: size - t, width: size, height: t },
    { x: 0, y: 0, width: t, height: size },
    { x: size - t, y: 0, width: t, height: size },
  ];
}

interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Deckungsbloecke einer Zelle.
 *
 * Laenglich statt quadratisch, wie in der alten Arena: Ein langer Block gibt
 * eine Seite zum Anlehnen und eine zum Umlaufen - ein Quadrat ist von ueberall
 * gleich langweilig.
 */
function placeCover(rng: RngHolder, area: Area, walls: Rect[]): void {
  if (randomRange(rng, 0, 1) > WORLD.coverChance) {
    return;
  }

  const placed: Rect[] = [];

  for (let i = 0; i < WORLD.coverPerCell; i += 1) {
    const long = randomRange(rng, WORLD.coverLongMin, WORLD.coverLongMax);
    const horizontal = randomRange(rng, 0, 1) < 0.5;
    const width = horizontal ? long : WORLD.coverShort;
    const height = horizontal ? WORLD.coverShort : long;

    const block = randomRect(rng, area, width, height);
    if (!block) {
      continue;
    }

    // Innerhalb einer Zelle koennen sich zwei Bloecke ins Gehege kommen.
    // Zwischen Zellen kann das nicht passieren - dafuer sorgt der Rand `half`.
    if (placed.every((other) => hasGap(block, other, WORLD.minGap))) {
      placed.push(block);
      walls.push(block);
    }
  }
}

/** Ein Buschfeld je Zelle. Buesche blockieren nichts, sie verstecken nur. */
function placeBush(rng: RngHolder, area: Area, bushes: Rect[]): void {
  if (randomRange(rng, 0, 1) > WORLD.bushChance) {
    return;
  }

  const width = randomRange(rng, WORLD.bushMin, WORLD.bushMax);
  const height = randomRange(rng, WORLD.bushMin, WORLD.bushMax);
  const field = randomRect(rng, area, width, height);
  if (field) {
    bushes.push(field);
  }
}

/**
 * Setzt ein Rechteck der gewuenschten Groesse zufaellig in die Flaeche.
 * Gibt `null` zurueck, wenn es nicht hineinpasst - am Kartenrand sind die
 * Flaechen beschnitten.
 */
function randomRect(rng: RngHolder, area: Area, width: number, height: number): Rect | null {
  const maxX = area.x1 - width;
  const maxY = area.y1 - height;
  if (maxX < area.x0 || maxY < area.y0) {
    return null;
  }

  return {
    x: Math.round(randomRange(rng, area.x0, maxX)),
    y: Math.round(randomRange(rng, area.y0, maxY)),
    width: Math.round(width),
    height: Math.round(height),
  };
}
