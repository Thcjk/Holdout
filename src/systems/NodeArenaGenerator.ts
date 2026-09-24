/**
 * Das Gebiet eines Knotens - aus dem Karten-Seed, deterministisch.
 *
 * ================================================================
 * WAS EIN KNOTEN-GEBIET IST
 * ================================================================
 *
 * Nach BRIEFING Abschnitt 4 ist ein Knoten eine kurze Kampfbegegnung in
 * einem BEGRENZTEN Gebiet - deutlich kleiner als die fruehere offene Welt
 * (40 bis 56 m Kante statt 333 m). Dieses Modul baut dieses Gebiet:
 *
 *   Aussenmauer     haelt alle im Feld
 *   Haeuser         Deckung und Sichtschutz, mit Beute darin
 *   Kistenreihen    niedrige Deckung (Blaster-Kit-Kisten)
 *   Beutekisten     einzelne Kisten mit Beute davor, markiert
 *   Buesche         Verstecke
 *   Deko            Zielscheiben, Rauch ueber den Daechern - nur zum Ansehen
 *   Ausstieg        eine Zone zum Beenden (Uebergang, siehe unten)
 *   Boss-Punkt      nur bei Elite- und Ende-Boss-Knoten
 *
 * Das Ergebnis hat DASSELBE Format wie die offene Welt (`GeneratedWorld`).
 * Die Simulation merkt keinen Unterschied: Kollision, Sichtlinien, Treffer,
 * Beute laufen unveraendert. Neu sind nur `fixedZone` (Gefahrenstufe g statt
 * Entfernung) und `safeRadius: 0` (keine Heilzone in einer Kampfbegegnung).
 *
 * ================================================================
 * DICHTE PROPORTIONAL ZU g
 * ================================================================
 *
 * Wie die Gegnerformel im Briefing: Anzahl = Grundwert + Faktor x g, mit
 * Obergrenze (`NODE_ARENA` in `balance.ts`). Auch die GROESSE waechst: Haeuser
 * werden groesser, Kistenreihen laenger, Stapel haeufiger.
 *
 * ================================================================
 * WARUM ALLES ERREICHBAR IST
 * ================================================================
 *
 * Dieselbe Idee wie in `WorldGenerator.ts`: Jedes Hindernis haelt zu jedem
 * anderen und zur Aussenmauer mindestens `minGap` (zwei Kacheln) Abstand.
 * Zwischen zwei Hindernissen bleibt also immer eine Gasse, durch die ein
 * Spieler (36 px) passt - einschliessen kann nichts etwas. Haeuser haben eine
 * Tuer. Der Test prueft es trotzdem mit einer Flutfuellung.
 *
 * ================================================================
 * DER AUSSTIEG IST EIN UEBERGANG
 * ================================================================
 *
 * Der Knoten-Ablauf (Timer, zurueck zur Karte) ist noch nicht gebaut. Damit
 * ein Run in einem Knoten trotzdem gut enden kann, bekommt jedes Gebiet eine
 * Ausstiegszone - mit der bestehenden Extraktions-Mechanik. Sobald es den
 * Ablauf gibt, bleibt sie nur in Extraktions-Knoten.
 */

import { ENCOUNTERS, LOOT, NODE_ARENA, WORLD } from "../config/balance";
import { ITEMS } from "../config/items";
import { generateNodeMap } from "./NodeMapGenerator";
import type { MapNode, NodeMap } from "./NodeMapGenerator";
import { nextRandom, randomRange } from "./rng";
import type { RngHolder } from "./rng";
import type {
  ArenaProp,
  EncounterSpot,
  ExtractionZone,
  GroundItem,
  Rect,
  Vec2,
} from "./types";
import {
  buildingWalls,
  bushCluster,
  hasGap,
  outerWalls,
  overlaps,
  randomRect,
} from "./WorldGenerator";
import type { Area, GeneratedWorld } from "./WorldGenerator";

export interface NodeArena extends GeneratedWorld {
  /** Kulisse - nur zum Zeichnen. */
  props: ArenaProp[];
  /** Gefahrenstufe g: gilt im ganzen Gebiet fuer Gegner und Beute. */
  fixedZone: number;
  /** Keine Heilzone im Knoten. */
  safeRadius: 0;
  /** Der Knoten, zu dem das Gebiet gehoert. */
  node: MapNode;
}

/** Ein eigener Seed je Knoten, abgeleitet aus Karten-Seed und Knotennummer. */
export function arenaSeed(mapSeed: number, nodeId: number): number {
  let h = Math.imul(mapSeed ^ 0x5bd1e995, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15) ^ Math.imul(nodeId + 1, 0x9e3779b1), 0x85ebca6b);
  return (h ^ (h >>> 13)) | 0;
}

/**
 * Der Knoten, in dem ein Run beginnt, solange es noch keine Kartenansicht
 * gibt: der erste Kampfknoten nach dem Start.
 */
export function defaultNodeId(map: NodeMap): number {
  return map.nodes[map.startId]?.next[0] ?? map.startId;
}

/**
 * Das Gebiet eines Knotens der Karte zu diesem Seed.
 *
 * @param nodeId Knotennummer; ohne (oder unbekannt) der erste Kampfknoten.
 */
export function generateNodeArena(mapSeed: number, nodeId?: number): NodeArena {
  const map = generateNodeMap(mapSeed);
  const fallback = defaultNodeId(map);
  const node = map.nodes[nodeId ?? fallback] ?? (map.nodes[fallback] as MapNode);
  // Start und Rast sind keine Kampfgebiete - fuer sie gibt es (noch) kein
  // eigenes Gebiet, also das des ersten Kampfknotens.
  const playable =
    node.type === "start" || node.type === "rest" ? (map.nodes[fallback] as MapNode) : node;
  return buildArena(arenaSeed(mapSeed, playable.id), playable);
}

/** Anzahl nach der Dichteformel: Grundwert + Faktor x g, begrenzt. */
export function densityCount(
  rule: { base: number; perDanger: number; max: number },
  danger: number,
): number {
  return Math.min(rule.max, Math.round(rule.base + rule.perDanger * danger));
}

interface Circle {
  x: number;
  y: number;
  r: number;
}

export function buildArena(seed: number, node: MapNode): NodeArena {
  const rng: RngHolder = { rngState: seed | 0 };
  const grid = WORLD.grid;
  const g = Math.max(1, node.danger);
  const tiles = NODE_ARENA.sizeTiles[node.arenaSize - 1] ?? 48;
  const size = tiles * grid;
  const t = WORLD.wallThickness;
  const gap = NODE_ARENA.minGap;

  const walls = outerWalls(size);
  const bounds: Rect = { x: 0, y: 0, width: size, height: size };
  const center: Vec2 = { x: size / 2, y: size / 2 };
  // Hindernisse haben Abstand `gap` zur Aussenmauer: Die Flaeche beginnt
  // dahinter.
  const area: Area = { x0: t + gap, y0: t + gap, x1: size - t - gap, y1: size - t - gap };

  // --- Wegmarken zuerst: Start, Ausstieg, Boss --------------------------
  const angle = randomRange(rng, 0, Math.PI * 2);
  const reach = size * NODE_ARENA.landmarkDistance;
  const exitPoint = {
    x: Math.round(center.x + Math.cos(angle) * reach),
    y: Math.round(center.y + Math.sin(angle) * reach),
  };
  const bossPoint = {
    x: Math.round(center.x - Math.cos(angle) * reach),
    y: Math.round(center.y - Math.sin(angle) * reach),
  };
  const hasBoss = node.type === "elite" || node.type === "boss";

  // Freizuhaltende Kreise: Hier steht nichts, damit man dort ankommt,
  // aussteigt oder kaempft, ohne gegen eine Kiste zu laufen.
  const reserved: Circle[] = [
    { ...center, r: NODE_ARENA.spawnClear },
    { ...exitPoint, r: ENCOUNTERS.extractionRadius + grid },
  ];
  if (hasBoss) {
    reserved.push({ ...bossPoint, r: 240 });
  }

  const obstacles: Rect[] = [];
  const fits = (rect: Rect, clearance: number = gap): boolean =>
    obstacles.every((other) => hasGap(rect, other, clearance)) &&
    reserved.every((circle) => distanceToRect(rect, circle) >= circle.r);

  // --- Haeuser ----------------------------------------------------------
  const buildings: Rect[] = [];
  const buildingCount = densityCount(NODE_ARENA.buildings, g);
  const maxSide = Math.min(
    NODE_ARENA.buildingTiles.maxCap,
    Math.round(NODE_ARENA.buildingTiles.max + NODE_ARENA.buildingTiles.maxPerDanger * g),
  );
  for (let i = 0; i < buildingCount; i += 1) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const width = randomRange(rng, NODE_ARENA.buildingTiles.min, maxSide + 1) * grid;
      const height = randomRange(rng, NODE_ARENA.buildingTiles.min, maxSide + 1) * grid;
      const door = Math.floor(randomRange(rng, 0, 4)) % 4;
      const along = randomRange(rng, 0.25, 0.75);
      const footprint = randomRect(rng, area, width, height);
      if (!footprint || !fits(footprint)) {
        continue;
      }
      walls.push(...buildingWalls(footprint, door, along));
      buildings.push(footprint);
      obstacles.push(footprint);
      break;
    }
  }

  // --- Kistenreihen (Deckung) -------------------------------------------
  const props: ArenaProp[] = [];
  let crates = 0;
  const coverCount = densityCount(NODE_ARENA.cover, g);
  // Laengere Reihen erst bei hoeherer Gefahr: g 1-2 nur kurze.
  const lengthChoices = Math.min(
    NODE_ARENA.coverTiles.length,
    1 + Math.floor(g / 3),
  );
  for (let i = 0; i < coverCount && crates < NODE_ARENA.maxCrates; i += 1) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const lengthTiles =
        NODE_ARENA.coverTiles[Math.floor(nextRandom(rng) * lengthChoices)] ?? 2;
      const horizontal = nextRandom(rng) < 0.5;
      const rect = randomRect(
        rng,
        area,
        (horizontal ? lengthTiles : 1) * grid,
        (horizontal ? 1 : lengthTiles) * grid,
      );
      if (!rect || !fits(rect)) {
        continue;
      }
      walls.push(rect);
      obstacles.push(rect);
      // Eine Kiste je zwei Kacheln, laengs der Reihe; manche mit einer
      // zweiten obendrauf.
      for (let k = 0; k < lengthTiles / 2 && crates < NODE_ARENA.maxCrates; k += 1) {
        const along = (k * 2 + 1) * grid;
        const x = horizontal ? rect.x + along : rect.x + grid / 2;
        const y = horizontal ? rect.y + grid / 2 : rect.y + along;
        const rotation = (horizontal ? Math.PI / 2 : 0) + randomRange(rng, -0.08, 0.08);
        props.push({ kind: "crateMedium", x, y, rotation, level: 0, lootable: false });
        crates += 1;
        if (nextRandom(rng) < NODE_ARENA.stackChance && crates < NODE_ARENA.maxCrates) {
          props.push({
            kind: "crateMedium",
            x,
            y,
            rotation: rotation + randomRange(rng, -0.25, 0.25),
            level: 1,
            lootable: false,
          });
          crates += 1;
        }
      }
      break;
    }
  }

  // --- Beute: in Haeusern und an Beutekisten ------------------------------
  const lootSpots: GroundItem[] = [];
  let nextItemId = 1;
  const addLoot = (x: number, y: number): void => {
    lootSpots.push({
      id: nextItemId++,
      def: rollItem(rng, g),
      position: { x: Math.round(x), y: Math.round(y) },
      lifetime: Number.POSITIVE_INFINITY,
      fromWorld: true,
    });
  };

  for (const house of buildings) {
    const count = Math.floor(
      randomRange(rng, LOOT.spotsPerBuildingMin, LOOT.spotsPerBuildingMax + 1),
    );
    const pad = WORLD.buildingWall + 24;
    for (let i = 0; i < count; i += 1) {
      addLoot(
        randomRange(rng, house.x + pad, house.x + house.width - pad),
        randomRange(rng, house.y + pad, house.y + house.height - pad),
      );
    }
  }

  const lootCrateCount = densityCount(NODE_ARENA.lootCrates, g);
  for (let i = 0; i < lootCrateCount && crates < NODE_ARENA.maxCrates; i += 1) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const horizontal = nextRandom(rng) < 0.5;
      const rect = randomRect(rng, area, (horizontal ? 2 : 1) * grid, (horizontal ? 1 : 2) * grid);
      if (!rect || !fits(rect)) {
        continue;
      }
      walls.push(rect);
      obstacles.push(rect);
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      props.push({
        kind: "crateWide",
        x: cx,
        y: cy,
        rotation: horizontal ? Math.PI / 2 : 0,
        level: 0,
        lootable: true,
      });
      crates += 1;
      // Die Beute liegt VOR der Kiste - eine Kiste zu oeffnen waere eine neue
      // Mechanik. Die Kiste markiert, wo es etwas gibt.
      const side = nextRandom(rng) < 0.5 ? -1 : 1;
      const offset = grid / 2 + 40;
      addLoot(horizontal ? cx : cx + side * offset, horizontal ? cy + side * offset : cy);
      break;
    }
  }

  // --- Buesche ------------------------------------------------------------
  const bushes: Rect[] = [];
  for (let i = 0; i < NODE_ARENA.bushes; i += 1) {
    const width = randomRange(rng, 4, 8) * grid;
    const height = randomRange(rng, 4, 8) * grid;
    const bites = [0, 1, 2, 3].map(() => ({
      columns: randomRange(rng, 0, WORLD.bushCornerBite),
      rows: randomRange(rng, 0, WORLD.bushCornerBite),
    }));
    const field = randomRect(rng, area, width, height);
    // Buesche blockieren nicht - sie duerfen nah an Hindernisse, aber nicht
    // hinein, und nicht auf die Wegmarken.
    if (!field || obstacles.some((other) => overlaps(field, other))) {
      continue;
    }
    if (reserved.some((circle) => distanceToRect(field, circle) < circle.r * 0.6)) {
      continue;
    }
    bushes.push(...bushCluster(field, bites));
  }

  // --- Deko: Rauch ueber den Daechern, Zielscheiben -----------------------
  const decoCount = densityCount(NODE_ARENA.deco, g);
  let deco = 0;
  for (const house of buildings) {
    if (deco >= decoCount) break;
    props.push({
      kind: "smoke",
      x: randomRange(rng, house.x + grid, house.x + house.width - grid),
      y: randomRange(rng, house.y + grid, house.y + house.height - grid),
      rotation: randomRange(rng, 0, Math.PI * 2),
      level: 0,
      lootable: false,
    });
    deco += 1;
  }
  for (let attempt = 0; deco < decoCount && attempt < decoCount * 4; attempt += 1) {
    const spot = randomRect(rng, area, grid, grid);
    if (!spot || !fits(spot, grid)) {
      continue;
    }
    props.push({
      kind: "target",
      x: spot.x + grid / 2,
      y: spot.y + grid / 2,
      rotation: randomRange(rng, 0, Math.PI * 2),
      level: 0,
      lootable: false,
    });
    deco += 1;
  }

  const extractions: ExtractionZone[] = [
    { position: exitPoint, radius: ENCOUNTERS.extractionRadius, discovered: true },
  ];
  const encounters: EncounterSpot[] = hasBoss
    ? [
        {
          position: bossPoint,
          isFinal: node.type === "boss",
          zone: g,
          status: "sleeping",
          enemyId: null,
          discovered: true,
        },
      ]
    : [];

  return {
    bounds,
    walls,
    bushes,
    buildings,
    lootSpots,
    nextItemId,
    spawnPoint: center,
    encounters,
    extractions,
    props,
    fixedZone: g,
    safeRadius: 0,
    node,
  };
}

/**
 * Welcher Gegenstand liegt hier? Hoehere Gefahr = seltenere Beute.
 * Erst die Seltenheit nach Gewicht, dann gleichverteilt innerhalb der Stufe.
 */
function rollItem(rng: RngHolder, danger: number): number {
  const weights = NODE_ARENA.lootRarityBase.map(
    (base, index) => base * (1 + index * danger * NODE_ARENA.lootRarityPerDanger),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = nextRandom(rng) * total;
  let rarity = weights.length;
  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll < 0) {
      rarity = index + 1;
      break;
    }
  }
  const candidates = ITEMS.map((item, index) => ({ item, index })).filter(
    (entry) => entry.item.rarity === rarity,
  );
  const pick = candidates[Math.floor(nextRandom(rng) * candidates.length)];
  return pick?.index ?? 0;
}

/** Abstand eines Kreismittelpunkts zum naechsten Punkt eines Rechtecks. */
function distanceToRect(rect: Rect, point: { x: number; y: number }): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}
