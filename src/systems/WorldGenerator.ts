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

import { DIFFICULTY, ENCOUNTERS, WORLD } from "../config/balance";
import { randomRange, type RngHolder } from "./rng";
import type { EncounterSpot, ExtractionZone, Rect, Vec2 } from "./types";

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
  /** Die Boss-Stellen: Mini-Bosse und der eine Ende-Boss. */
  encounters: EncounterSpot[];
  /** Die Zonen, in denen das Team den Run beenden kann. */
  extractions: ExtractionZone[];
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

  /*
   * Encounter und Extraktion kommen NACH Waenden und Bueschen, und diese
   * Reihenfolge ist Teil der Zusicherung: Host und Clients ziehen dieselben
   * Zufallszahlen in derselben Folge und bekommen dadurch dieselben Stellen,
   * ohne dass eine einzige Koordinate uebers Netz geht. Wer hier etwas
   * DAVOR einfuegt, verschiebt jede spaetere Position.
   */
  const encounters = placeEncounters(rng, spawnPoint, walls, size);
  const extractions = placeExtractions(rng, spawnPoint, walls, size);

  return { bounds, walls, bushes, spawnPoint, encounters, extractions };
}

/** Die aeusserste Zone, die auf dieser Karte ueberhaupt Platz hat. */
export function maxZone(size: number): number {
  const usable = size / 2 - WORLD.wallThickness - ENCOUNTERS.triggerRadius;
  return Math.max(1, Math.floor(usable / DIFFICULTY.zoneSize));
}

/**
 * Sucht eine freie Stelle auf einem Ring um den Startpunkt.
 *
 * Auf einem RING und nicht irgendwo: Die Schwierigkeit haengt an der Entfernung
 * zum Start, also bestimmt der Radius, wie stark der Boss dort ist. Ein Punkt
 * "irgendwo im Rechteck" haette keine verlaessliche Zone.
 */
function findSpotOnRing(
  rng: RngHolder,
  spawnPoint: Vec2,
  walls: readonly Rect[],
  size: number,
  radius: number,
  clearance: number,
): Vec2 | null {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const angle = randomRange(rng, 0, Math.PI * 2);
    const point = {
      x: Math.round(spawnPoint.x + Math.cos(angle) * radius),
      y: Math.round(spawnPoint.y + Math.sin(angle) * radius),
    };

    const margin = WORLD.wallThickness + clearance;
    if (
      point.x < margin ||
      point.y < margin ||
      point.x > size - margin ||
      point.y > size - margin
    ) {
      continue;
    }

    // Genug Platz drumherum: Ein Boss von 68 Pixeln Durchmesser soll sich
    // bewegen koennen, und der Warnring soll nicht halb in einer Wand liegen.
    if (walls.some((wall) => distanceToRect(wall, point.x, point.y) < clearance)) {
      continue;
    }

    return point;
  }

  return null;
}

/**
 * Die Boss-Stellen: je eine Zone ab `miniFromZone`, dazu der Ende-Boss.
 *
 * Der Mini-Boss einer Zone sitzt in deren MITTE (Zone 3 also bei 2,5 x
 * Zonenbreite). Damit liegt er verlaesslich in der Zone, nach der seine Staerke
 * berechnet wird - an der Kante koennte ein Pixel darueber entscheiden.
 */
function placeEncounters(
  rng: RngHolder,
  spawnPoint: Vec2,
  walls: readonly Rect[],
  size: number,
): EncounterSpot[] {
  const spots: EncounterSpot[] = [];
  const clearance = 140;
  const outermost = maxZone(size);

  /*
   * Die Mini-Bosse hoeren EINE Zone vor dem Rand auf - die aeusserste gehoert
   * dem Ende-Boss.
   *
   * Der erste Versuch setzte ihn stattdessen auf 85 % des Maximalradius. Ein
   * Test hat gezeigt, warum das falsch war: Die Mini-Bosse reichten bis 95 %,
   * der Ende-Boss sass also NAEHER am Start als seine eigenen Vorstufen. Wer
   * nach aussen laeuft, soll ihn zuletzt treffen, nicht zwischendurch.
   */
  for (let zone = ENCOUNTERS.miniFromZone; zone < outermost; zone += 1) {
    const radius = (zone + 0.5) * DIFFICULTY.zoneSize;
    const point = findSpotOnRing(rng, spawnPoint, walls, size, radius, clearance);
    if (point) {
      spots.push({ position: point, isFinal: false, zone, status: "sleeping", enemyId: null });
    }
  }

  // Der Ende-Boss auf dem aeussersten Ring, den die Karte hergibt.
  const finalRadius = (outermost + 0.5) * DIFFICULTY.zoneSize;
  const finalPoint = findSpotOnRing(rng, spawnPoint, walls, size, finalRadius, clearance);
  if (finalPoint) {
    spots.push({
      position: finalPoint,
      isFinal: true,
      zone: outermost,
      status: "sleeping",
      enemyId: null,
    });
  }

  return spots;
}

/**
 * Die Ausstiegszonen, verteilt ueber die Distanzbaender.
 *
 * Der Startpunkt ist bewusst KEINE Extraktion. Sonst waere die Entscheidung,
 * um die sich der ganze Run dreht, geschenkt: hinauslaufen, umdrehen, raus.
 */
function placeExtractions(
  rng: RngHolder,
  spawnPoint: Vec2,
  walls: readonly Rect[],
  size: number,
): ExtractionZone[] {
  const zones: ExtractionZone[] = [];
  const clearance = ENCOUNTERS.extractionRadius * 0.6;
  const outermost = Math.min(ENCOUNTERS.extractionToZone, maxZone(size));
  const span = Math.max(1, outermost - ENCOUNTERS.extractionFromZone);

  for (let i = 0; i < ENCOUNTERS.extractionCount; i += 1) {
    const zone = ENCOUNTERS.extractionFromZone + (span * i) / (ENCOUNTERS.extractionCount - 1);
    const radius = (zone + 0.5) * DIFFICULTY.zoneSize;
    const point = findSpotOnRing(rng, spawnPoint, walls, size, radius, clearance);
    if (point) {
      zones.push({ position: point, radius: ENCOUNTERS.extractionRadius });
    }
  }

  return zones;
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
