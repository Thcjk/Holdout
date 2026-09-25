/**
 * Orte an der Strasse: Tankstelle, Bushaltestelle, Lagerhalle, Zeltlager ...
 *
 * ================================================================
 * WARUM ORTE STATT ZUFAELLIGER KISTEN
 * ================================================================
 *
 * Rueckmeldung vom 2026-09-25: "Es sollen nicht einfach Gebaeude sein,
 * sondern Sinn geben - an einer Strasse zum Beispiel eine Tankstelle."
 * Ein Ort ist eine kleine, zusammengehoerende Anordnung: Zapfsaeulen VOR dem
 * Shop, der Shop mit der Tuer zur Strasse, ein Auto am Rand. Man erkennt ihn
 * aus der Ferne und weiss, dass dort etwas zu holen ist - das ist das Gefuehl
 * "ich will das erkunden".
 *
 * ================================================================
 * WIE EIN ORT GEBAUT WIRD
 * ================================================================
 *
 * Jeder Ort hat eine Grundflaeche in Kacheln (1 m) und wird in LOKALEN
 * Koordinaten beschrieben: x laengs der Strasse, y von der Strasse weg. Der
 * `Frame` rechnet das in Weltpixel um - fuer beide Strassenseiten gleich. So
 * steht jede Tuer zur Strasse, egal auf welcher Seite der Ort liegt.
 *
 * ERREICHBARKEIT: Alle Teile eines Orts halten untereinander mindestens zwei
 * Kacheln Abstand, und die Grundflaeche haelt zu allem anderen zwei Kacheln
 * (`fits` im Generator). Damit kann ein Ort nichts einschliessen - der
 * Flutfuellungs-Test in `nodeArena.test.ts` prueft es trotzdem.
 *
 * Phaserfrei wie alles unter `systems/`.
 */

import { WORLD } from "../config/balance";
import type { RegionTheme } from "../config/story";
import { buildingWalls } from "./WorldGenerator";
import { nextRandom } from "./rng";
import type { RngHolder } from "./rng";
import type { ArenaProp, ArenaPropKind, Rect } from "./types";

/** Was ein Ort beim Bauen braucht - vom Generator gereicht. */
export interface PlaceContext {
  rng: RngHolder;
  walls: Rect[];
  props: ArenaProp[];
  buildings: Rect[];
  /** Befestigte Flaechen (Beton, Parkplatz) - nur zum Zeichnen. */
  lots: Rect[];
  addLoot(x: number, y: number): void;
}

/** Lage eines Orts: wo er beginnt und auf welcher Strassenseite. */
export interface Frame {
  /** Linker Rand der Grundflaeche in Weltpixeln. */
  x0: number;
  /** Rand der Grundflaeche, der zur Strasse zeigt (Weltpixel). */
  yNear: number;
  /** -1 = noerdlich der Strasse (kleineres y), +1 = suedlich. */
  side: -1 | 1;
}

export interface PlaceDef {
  /** Name fuer Tests und Anzeige. */
  id: string;
  /** Grundflaeche in Kacheln: laengs und quer zur Strasse. */
  w: number;
  h: number;
  build(ctx: PlaceContext, frame: Frame): void;
}

const G = WORLD.grid;

/** Lokales Rechteck (Kacheln) in Weltpixel. */
export function local(frame: Frame, lx: number, ly: number, w: number, h: number): Rect {
  const y = frame.side > 0 ? frame.yNear + ly * G : frame.yNear - (ly + h) * G;
  return { x: frame.x0 + lx * G, y, width: w * G, height: h * G };
}

/** Die ganze Grundflaeche eines Orts in Weltpixeln. */
export function footprint(def: PlaceDef, frame: Frame): Rect {
  return local(frame, 0, 0, def.w, def.h);
}

function center(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Ein Teil, das blockiert: Wand in `walls` plus Modell mittig darauf. */
function solid(
  ctx: PlaceContext,
  rect: Rect,
  kind: ArenaPropKind,
  variant = 0,
  scale = 1,
): void {
  ctx.walls.push(rect);
  // Modelle sind laengs x gebaut; ein hochkantes Rechteck dreht sie.
  const rotation = rect.height > rect.width ? Math.PI / 2 : 0;
  const { x, y } = center(rect);
  ctx.props.push({ kind, x, y, rotation, level: 0, lootable: false, scale, variant });
}

/** Etwas ohne Kollision (Schild, Bank, Feuerstelle). */
function decor(ctx: PlaceContext, x: number, y: number, kind: ArenaPropKind, rotation = 0, variant = 0): void {
  ctx.props.push({ kind, x, y, rotation, level: 0, lootable: false, scale: 1, variant });
}

/** Ein Haus mit der Tuer zur Strasse. */
function house(ctx: PlaceContext, frame: Frame, rect: Rect): void {
  // Tuer: 0 oben, 2 unten (siehe `buildingWalls`). Die Strasse liegt bei
  // Suedseite oben, bei Nordseite unten.
  const door = frame.side > 0 ? 0 : 2;
  ctx.walls.push(...buildingWalls(rect, door, 0.5));
  ctx.buildings.push(rect);
}

/** Beute an zufaelligen Stellen innerhalb eines Rechtecks (mit Rand). */
function lootIn(ctx: PlaceContext, rect: Rect, count: number): void {
  const pad = WORLD.buildingWall + 36;
  for (let i = 0; i < count; i += 1) {
    const x = rect.x + pad + nextRandom(ctx.rng) * Math.max(1, rect.width - 2 * pad);
    const y = rect.y + pad + nextRandom(ctx.rng) * Math.max(1, rect.height - 2 * pad);
    ctx.addLoot(x, y);
  }
}

/** Eine Stelle in Kachelkoordinaten als Weltpunkt (Kachelmitte). */
function at(frame: Frame, lx: number, ly: number): { x: number; y: number } {
  return center(local(frame, lx, ly, 1, 1));
}

const carColor = (ctx: PlaceContext): number => Math.floor(nextRandom(ctx.rng) * 4);

// ------------------------------------------------------------------
// Die Orte
// ------------------------------------------------------------------

const gasStation: PlaceDef = {
  id: "tankstelle",
  w: 16,
  h: 11,
  build(ctx, f) {
    ctx.lots.push(local(f, 0, 0, 16, 11));
    // Zwei Zapfsaeulen vorn, dahinter der Shop, am Rand ein Auto.
    solid(ctx, local(f, 4, 2, 1, 1), "pump");
    solid(ctx, local(f, 8, 2, 1, 1), "pump");
    solid(ctx, local(f, 11, 1, 4, 2), "car", carColor(ctx));
    const shop = local(f, 3, 6, 9, 5);
    house(ctx, f, shop);
    lootIn(ctx, shop, 2);
    const sign = at(f, 0, 0);
    decor(ctx, sign.x, sign.y, "sign", 0, 0);
    const near = at(f, 6, 2);
    ctx.addLoot(near.x, near.y);
  },
};

const homestead: PlaceDef = {
  id: "wohnhaus",
  w: 12,
  h: 11,
  build(ctx, f) {
    const home = local(f, 1, 1, 7, 6);
    house(ctx, f, home);
    lootIn(ctx, home, 2);
    // Gartenzaun hinten, zwei Baeume daneben.
    for (let k = 0; k < 8; k += 1) {
      const rect = local(f, k, 9, 1, 1);
      ctx.walls.push(rect);
      const { x, y } = center(rect);
      ctx.props.push({ kind: "fence", x, y, rotation: 0, level: 0, lootable: false, scale: 1, variant: 0 });
    }
    solid(ctx, local(f, 10, 2, 1, 1), "tree", 1, 1.1);
    solid(ctx, local(f, 10, 6, 1, 1), "tree", 2, 1.2);
  },
};

const busStop: PlaceDef = {
  id: "bushaltestelle",
  w: 7,
  h: 4,
  build(ctx, f) {
    solid(ctx, local(f, 1, 1, 4, 1), "busStop");
    const sign = at(f, 6, 0);
    decor(ctx, sign.x, sign.y, "sign", 0, 1);
    const bag = at(f, 3, 3);
    ctx.addLoot(bag.x, bag.y);
  },
};

const supermarket: PlaceDef = {
  id: "supermarkt",
  w: 18,
  h: 13,
  build(ctx, f) {
    ctx.lots.push(local(f, 0, 0, 18, 5));
    solid(ctx, local(f, 1, 1, 4, 2), "car", carColor(ctx));
    solid(ctx, local(f, 7, 1, 4, 2), "car", carColor(ctx));
    solid(ctx, local(f, 13, 1, 4, 2), "car", carColor(ctx));
    const store = local(f, 2, 6, 14, 7);
    house(ctx, f, store);
    lootIn(ctx, store, 3);
  },
};

const warehouse: PlaceDef = {
  id: "lagerhalle",
  w: 16,
  h: 12,
  build(ctx, f) {
    ctx.lots.push(local(f, 0, 0, 16, 3));
    const hall = local(f, 1, 3, 14, 9);
    house(ctx, f, hall);
    lootIn(ctx, hall, 3);
  },
};

const containerYard: PlaceDef = {
  id: "containerlager",
  w: 16,
  h: 8,
  build(ctx, f) {
    ctx.lots.push(local(f, 0, 0, 16, 8));
    solid(ctx, local(f, 1, 1, 6, 2), "container", 0);
    solid(ctx, local(f, 9, 1, 6, 2), "container", 1);
    solid(ctx, local(f, 1, 5, 6, 2), "container", 2);
    solid(ctx, local(f, 9, 5, 6, 2), "container", 3);
    // Genau in die Mitte der Gasse (Kacheln 7 und 8) - eine Kachel daneben
    // laege sie so nah am Container, dass man sie nicht erreicht.
    const between = at(f, 7.5, 3.5);
    ctx.addLoot(between.x, between.y);
    const corner = at(f, 15, 7);
    ctx.addLoot(corner.x, corner.y);
  },
};

const truckStop: PlaceDef = {
  id: "fernfahrerparkplatz",
  w: 14,
  h: 8,
  build(ctx, f) {
    ctx.lots.push(local(f, 0, 0, 14, 8));
    solid(ctx, local(f, 1, 1, 6, 2), "container", 1);
    solid(ctx, local(f, 9, 1, 4, 2), "car", carColor(ctx));
    solid(ctx, local(f, 2, 5, 1, 1), "barrels", 0);
    solid(ctx, local(f, 9, 5, 1, 1), "barrels", 1);
    const spot = at(f, 6, 5);
    ctx.addLoot(spot.x, spot.y);
  },
};

const camp: PlaceDef = {
  id: "zeltlager",
  w: 12,
  h: 9,
  build(ctx, f) {
    solid(ctx, local(f, 1, 1, 2, 2), "tent", 0);
    solid(ctx, local(f, 5, 1, 2, 2), "tent", 1);
    solid(ctx, local(f, 9, 1, 2, 2), "tent", 2);
    solid(ctx, local(f, 1, 6, 3, 1), "logs");
    solid(ctx, local(f, 8, 6, 3, 1), "logs");
    const fire = at(f, 6, 6);
    decor(ctx, fire.x, fire.y, "campfire");
    for (const [lx, ly] of [
      [4, 4],
      [8, 4],
    ] as const) {
      const spot = at(f, lx, ly);
      ctx.addLoot(spot.x, spot.y);
    }
  },
};

const cabin: PlaceDef = {
  id: "holzhuette",
  w: 12,
  h: 8,
  build(ctx, f) {
    const hut = local(f, 1, 1, 6, 5);
    house(ctx, f, hut);
    lootIn(ctx, hut, 2);
    solid(ctx, local(f, 9, 1, 1, 3), "logs");
    solid(ctx, local(f, 9, 6, 1, 1), "barrels", 2);
  },
};

const restArea: PlaceDef = {
  id: "rastplatz",
  w: 12,
  h: 7,
  build(ctx, f) {
    ctx.lots.push(local(f, 0, 0, 12, 4));
    solid(ctx, local(f, 1, 1, 4, 2), "car", carColor(ctx));
    const bench = at(f, 8, 5);
    decor(ctx, bench.x, bench.y, "bench");
    const sign = at(f, 11, 0);
    decor(ctx, sign.x, sign.y, "sign", 0, 1);
    const spot = at(f, 7, 2);
    ctx.addLoot(spot.x, spot.y);
  },
};

const fishHut: PlaceDef = {
  id: "fischerhuette",
  w: 15,
  h: 9,
  build(ctx, f) {
    const hut = local(f, 1, 3, 6, 5);
    house(ctx, f, hut);
    lootIn(ctx, hut, 2);
    solid(ctx, local(f, 9, 1, 4, 2), "boat", 0);
    solid(ctx, local(f, 9, 5, 4, 2), "boat", 1);
  },
};

const lighthouse: PlaceDef = {
  id: "leuchtturm",
  w: 13,
  h: 7,
  build(ctx, f) {
    solid(ctx, local(f, 1, 2, 3, 3), "lighthouse");
    const keeper = local(f, 6, 1, 6, 5);
    house(ctx, f, keeper);
    lootIn(ctx, keeper, 2);
  },
};

const beach: PlaceDef = {
  id: "strand",
  w: 14,
  h: 8,
  build(ctx, f) {
    solid(ctx, local(f, 1, 1, 4, 2), "boat", 2);
    solid(ctx, local(f, 8, 1, 4, 2), "boat", 0);
    solid(ctx, local(f, 4, 5, 4, 2), "boat", 1);
    const spot = at(f, 10, 5);
    ctx.addLoot(spot.x, spot.y);
  },
};

/** Welche Orte in welcher Region vorkommen - in dieser Reihenfolge gewichtet. */
export const PLACES_BY_THEME: Record<RegionTheme, readonly PlaceDef[]> = {
  suburb: [gasStation, homestead, busStop, supermarket, homestead],
  industry: [warehouse, containerYard, truckStop, gasStation],
  forest: [camp, cabin, restArea, gasStation],
  coast: [fishHut, lighthouse, beach, homestead],
};

/** Fuer Tests: alle Orte einmal. */
export const ALL_PLACES: readonly PlaceDef[] = [
  gasStation,
  homestead,
  busStop,
  supermarket,
  warehouse,
  containerYard,
  truckStop,
  camp,
  cabin,
  restArea,
  fishHut,
  lighthouse,
  beach,
];
