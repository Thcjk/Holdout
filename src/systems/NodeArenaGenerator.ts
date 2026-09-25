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

import { ENCOUNTERS, LOOT, NODE_ARENA, NODE_MAP, WORLD } from "../config/balance";
import { regionOfLayer } from "../config/story";
import type { RegionTheme } from "../config/story";
import { PLACES_BY_THEME, footprint } from "./arenaPlaces";
import type { Frame, PlaceContext, PlaceDef } from "./arenaPlaces";
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
  /** Region: bestimmt Boden und Orte. */
  theme: RegionTheme;
  /** Strassen und befestigte Flaechen - nur zum Zeichnen. */
  roads: Rect[];
  lots: Rect[];
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
  const theme = regionOfLayer(node.layer, NODE_MAP.depth).theme;

  /*
   * ================================================================
   * DIE FORM: LAENGLICH, MIT EINER STRASSE HINDURCH
   * ================================================================
   *
   * Rueckmeldung 2026-09-25: groesser, und so, dass man erkunden will. Das
   * Gebiet ist jetzt ein Streifen laengs einer Strasse (Vorbild "Deadly
   * Days: ROADTRIP"): Start am westlichen Ende, Ausgang am oestlichen, an
   * der Strasse die Orte. Wer nur durchrennt, schafft es - wer die Orte
   * abklappert, findet die Beute.
   */
  const [lengthTiles, widthTiles] = NODE_ARENA.sizeTiles[node.arenaSize - 1] ?? [88, 48];
  const width = lengthTiles * grid;
  const height = widthTiles * grid;
  const t = WORLD.wallThickness;
  const gap = NODE_ARENA.minGap;

  // Die Aussenmauer bleibt als Kollision (und fuer Sichtlinien), wird aber
  // NICHT mehr gezeichnet - der Rand ist dichter Wald bzw. Fels (siehe unten).
  const walls = rectWalls(width, height);
  const bounds: Rect = { x: 0, y: 0, width, height };
  const area: Area = { x0: t + gap, y0: t + gap, x1: width - t - gap, y1: height - t - gap };

  // --- Die Strasse -------------------------------------------------------
  const roadTiles = NODE_ARENA.roadTiles;
  const roadY = Math.round((height / 2 - (roadTiles * grid) / 2) / grid) * grid;
  const road: Rect = { x: 0, y: roadY, width, height: roadTiles * grid };
  const roadCenter = roadY + (roadTiles * grid) / 2;
  // Zum Zeichnen laeuft sie ueber den Rand hinaus weiter - die Welt endet
  // nicht an der Gebietsgrenze.
  const roads: Rect[] = [
    {
      x: -NODE_ARENA.outskirtsDepth - 900,
      y: roadY,
      width: width + 2 * (NODE_ARENA.outskirtsDepth + 900),
      height: roadTiles * grid,
    },
  ];
  const lots: Rect[] = [];

  // --- Wegmarken: Start im Westen, Ausgang im Osten, Boss dazwischen -----
  // So weit vom Rand, dass der Startplatz ganz frei bleibt (`spawnClear`).
  const spawnPoint: Vec2 = { x: t + 8 * grid, y: roadCenter };
  const exitPoint: Vec2 = { x: width - t - 8 * grid, y: roadCenter };
  const hasBoss = node.type === "elite" || node.type === "boss";
  const bossSide = nextRandom(rng) < 0.5 ? -1 : 1;
  const bossPoint: Vec2 = {
    x: Math.round(width * 0.72),
    y: Math.round(roadCenter + bossSide * height * 0.26),
  };

  const reserved: Circle[] = [
    { ...spawnPoint, r: NODE_ARENA.spawnClear },
    { ...exitPoint, r: ENCOUNTERS.extractionRadius + grid },
  ];
  if (hasBoss) {
    reserved.push({ ...bossPoint, r: 240 });
  }

  // Die Strasse ist frei zu halten wie ein Hindernis - nur liegengebliebene
  // Autos stehen darauf (weiter unten, bewusst).
  const obstacles: Rect[] = [road];
  const fits = (rect: Rect, clearance: number = gap): boolean =>
    rect.x >= area.x0 &&
    rect.y >= area.y0 &&
    rect.x + rect.width <= area.x1 &&
    rect.y + rect.height <= area.y1 &&
    obstacles.every((other) => hasGap(rect, other, clearance)) &&
    reserved.every((circle) => distanceToRect(rect, circle) >= circle.r);

  const props: ArenaProp[] = [];
  const buildings: Rect[] = [];
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
  const ctx: PlaceContext = { rng, walls, props, buildings, lots, addLoot };

  // --- Orte an der Strasse --------------------------------------------------
  /*
   * Von West nach Ost, abwechselnd auf beiden Seiten, mit Luecken dazwischen.
   * Welche Orte, bestimmt die Region (Stadtrand: Tankstelle, Wohnhaeuser ...).
   * Passt ein Ort nicht (Start, Ausgang, Boss im Weg), wird der naechste
   * versucht - die Reihenfolge der Zufallszuege bleibt fest.
   */
  const catalog = PLACES_BY_THEME[theme];
  const placeCount = Math.min(
    NODE_ARENA.places.max,
    Math.round(NODE_ARENA.places.base + NODE_ARENA.places.perSize * node.arenaSize),
  );
  let cursor = t + 12 * grid;
  let side: -1 | 1 = nextRandom(rng) < 0.5 ? -1 : 1;
  for (let placed = 0; placed < placeCount && cursor < width - t - 12 * grid; ) {
    const def = catalog[Math.floor(nextRandom(rng) * catalog.length)] as PlaceDef;
    const distance = Math.floor(nextRandom(rng) * 3) * grid; // 0-2 Kacheln weiter weg
    const frame: Frame = {
      x0: cursor,
      yNear: side > 0 ? road.y + road.height + gap + distance : road.y - gap - distance,
      side,
    };
    const rect = placeFootprint(def, frame);
    if (fits(rect)) {
      def.build(ctx, frame);
      obstacles.push(rect);
      placed += 1;
      side = side > 0 ? -1 : 1;
      // Naechster Ort: auf der anderen Seite darf er ueberlappend beginnen,
      // auf derselben Seite braucht es Abstand.
      cursor += Math.round((def.w * grid) / 2 / grid) * grid + Math.floor(randomRange(rng, 2, 7)) * grid;
    } else {
      cursor += 4 * grid;
    }
  }

  // --- Liegengebliebene Autos auf der Strasse (Deckung) ----------------------
  const wrecks = densityCount(NODE_ARENA.roadCars, g);
  const onRoad: Rect[] = [];
  for (let i = 0; i < wrecks; i += 1) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const lane = nextRandom(rng) < 0.5 ? 0 : roadTiles - 2;
      const x = Math.round(randomRange(rng, area.x0, area.x1 - 4 * grid) / grid) * grid;
      const car: Rect = { x, y: road.y + lane * grid, width: 4 * grid, height: 2 * grid };
      const clear =
        onRoad.every((other) => hasGap(car, other, 5 * grid)) &&
        reserved.every((circle) => distanceToRect(car, circle) >= circle.r) &&
        obstacles.every((other) => other === road || hasGap(car, other, gap));
      if (!clear) continue;
      onRoad.push(car);
      walls.push(car);
      props.push({
        kind: "car",
        x: car.x + car.width / 2,
        y: car.y + car.height / 2,
        rotation: randomRange(rng, -0.12, 0.12) + (nextRandom(rng) < 0.5 ? 0 : Math.PI),
        level: 0,
        lootable: false,
        scale: 1,
        variant: 4 + Math.floor(nextRandom(rng) * 2), // ausgebrannt: grau/rostig
      });
      break;
    }
  }
  obstacles.push(...onRoad);

  // --- Kistenreihen (Deckung) -------------------------------------------
  let crates = 0;
  const coverCount = densityCount(NODE_ARENA.cover, g);
  // Laengere Reihen erst bei hoeherer Gefahr: g 1-2 nur kurze.
  const lengthChoices = Math.min(NODE_ARENA.coverTiles.length, 1 + Math.floor(g / 3));
  for (let i = 0; i < coverCount && crates < NODE_ARENA.maxCrates; i += 1) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const lengthTilesCover =
        NODE_ARENA.coverTiles[Math.floor(nextRandom(rng) * lengthChoices)] ?? 2;
      const horizontal = nextRandom(rng) < 0.5;
      const rect = randomRect(
        rng,
        area,
        (horizontal ? lengthTilesCover : 1) * grid,
        (horizontal ? 1 : lengthTilesCover) * grid,
      );
      if (!rect || !fits(rect)) {
        continue;
      }
      walls.push(rect);
      obstacles.push(rect);
      for (let k = 0; k < lengthTilesCover / 2 && crates < NODE_ARENA.maxCrates; k += 1) {
        const along = (k * 2 + 1) * grid;
        const x = horizontal ? rect.x + along : rect.x + grid / 2;
        const y = horizontal ? rect.y + grid / 2 : rect.y + along;
        const rotation = (horizontal ? Math.PI / 2 : 0) + randomRange(rng, -0.08, 0.08);
        props.push({ kind: "crateMedium", x, y, rotation, level: 0, lootable: false, scale: 1, variant: 0 });
        crates += 1;
        if (nextRandom(rng) < NODE_ARENA.stackChance && crates < NODE_ARENA.maxCrates) {
          props.push({
            kind: "crateMedium",
            x,
            y,
            rotation: rotation + randomRange(rng, -0.25, 0.25),
            level: 1,
            lootable: false,
            scale: 1,
            variant: 0,
          });
          crates += 1;
        }
      }
      break;
    }
  }

  // --- Einzelne Haeuser abseits der Strasse --------------------------------
  const extraHouses = densityCount(NODE_ARENA.buildings, g);
  const maxSide = Math.min(
    NODE_ARENA.buildingTiles.maxCap,
    Math.round(NODE_ARENA.buildingTiles.max + NODE_ARENA.buildingTiles.maxPerDanger * g),
  );
  for (let i = 0; i < extraHouses; i += 1) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const w = randomRange(rng, NODE_ARENA.buildingTiles.min, maxSide + 1) * grid;
      const h = randomRange(rng, NODE_ARENA.buildingTiles.min, maxSide + 1) * grid;
      const door = Math.floor(randomRange(rng, 0, 4)) % 4;
      const along = randomRange(rng, 0.25, 0.75);
      const rect = randomRect(rng, area, w, h);
      if (!rect || !fits(rect)) {
        continue;
      }
      walls.push(...buildingWalls(rect, door, along));
      buildings.push(rect);
      obstacles.push(rect);
      const count = Math.floor(randomRange(rng, LOOT.spotsPerBuildingMin, LOOT.spotsPerBuildingMax + 1));
      const pad = WORLD.buildingWall + 36;
      for (let k = 0; k < count; k += 1) {
        addLoot(
          randomRange(rng, rect.x + pad, rect.x + rect.width - pad),
          randomRange(rng, rect.y + pad, rect.y + rect.height - pad),
        );
      }
      break;
    }
  }

  // --- Beutekisten ---------------------------------------------------------
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
        scale: 1,
        variant: 0,
      });
      crates += 1;
      // Die Beute liegt VOR der Kiste - die Kiste markiert, wo es etwas gibt.
      const sideOffset = nextRandom(rng) < 0.5 ? -1 : 1;
      const offset = grid / 2 + 40;
      addLoot(horizontal ? cx : cx + sideOffset * offset, horizontal ? cy + sideOffset * offset : cy);
      break;
    }
  }

  // --- Umgebung, die blockiert: Baeume, Felsen, Fassgruppen, Zaeune --------
  const decor = (
    kind: ArenaProp["kind"],
    x: number,
    y: number,
    rotation: number,
    scale: number,
    variant: number,
  ): void => {
    props.push({ kind, x, y, rotation, level: 0, lootable: false, scale, variant });
  };
  const placeSolid = (tiles: number, onPlace: (rect: Rect) => void): void => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const rect = randomRect(rng, area, tiles * grid, tiles * grid);
      if (!rect || !fits(rect)) {
        continue;
      }
      walls.push(rect);
      obstacles.push(rect);
      onPlace(rect);
      return;
    }
  };

  const areaFactor = (width * height) / (48 * 48 * grid * grid);
  const scaled = (rule: { base: number; perDanger: number; max: number }): number =>
    Math.round(densityCount(rule, g) * areaFactor);
  // Im Wald mehr Baeume, an der Kueste mehr Felsen, im Industriegebiet Faesser.
  const bias = THEME_BIAS[theme];

  for (let i = 0; i < scaled(NODE_ARENA.trees) * bias.trees; i += 1) {
    const kind = nextRandom(rng) < bias.pineShare ? "pine" : "tree";
    const scale = randomRange(rng, 0.85, 1.3);
    const variant = Math.floor(nextRandom(rng) * 3);
    const rotation = randomRange(rng, 0, Math.PI * 2);
    placeSolid(1, (rect) => decor(kind, rect.x + grid / 2, rect.y + grid / 2, rotation, scale, variant));
  }
  for (let i = 0; i < scaled(NODE_ARENA.rocks) * bias.rocks; i += 1) {
    const big = nextRandom(rng) < 0.4;
    const variant = Math.floor(nextRandom(rng) * 3);
    const rotation = randomRange(rng, 0, Math.PI * 2);
    const tiles = big ? 2 : 1;
    placeSolid(tiles, (rect) =>
      decor("rock", rect.x + rect.width / 2, rect.y + rect.height / 2, rotation, tiles * 0.95, variant),
    );
  }
  for (let i = 0; i < scaled(NODE_ARENA.barrels) * bias.barrels; i += 1) {
    const variant = Math.floor(nextRandom(rng) * 3);
    const rotation = randomRange(rng, 0, Math.PI * 2);
    placeSolid(1, (rect) => decor("barrels", rect.x + grid / 2, rect.y + grid / 2, rotation, 1, variant));
  }
  for (let i = 0; i < densityCount(NODE_ARENA.fences, g); i += 1) {
    const length =
      NODE_ARENA.fenceTiles[Math.floor(nextRandom(rng) * NODE_ARENA.fenceTiles.length)] ?? 3;
    const horizontal = nextRandom(rng) < 0.5;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const rect = randomRect(
        rng,
        area,
        (horizontal ? length : 1) * grid,
        (horizontal ? 1 : length) * grid,
      );
      if (!rect || !fits(rect)) {
        continue;
      }
      walls.push(rect);
      obstacles.push(rect);
      for (let k = 0; k < length; k += 1) {
        const along = k * grid + grid / 2;
        decor(
          "fence",
          horizontal ? rect.x + along : rect.x + grid / 2,
          horizontal ? rect.y + grid / 2 : rect.y + along,
          horizontal ? 0 : Math.PI / 2,
          1,
          0,
        );
      }
      break;
    }
  }

  // --- Buesche ------------------------------------------------------------
  const bushes: Rect[] = [];
  const bushCount = Math.round(NODE_ARENA.bushes * areaFactor);
  for (let i = 0; i < bushCount; i += 1) {
    const w = randomRange(rng, 4, 8) * grid;
    const h = randomRange(rng, 4, 8) * grid;
    const bites = [0, 1, 2, 3].map(() => ({
      columns: randomRange(rng, 0, WORLD.bushCornerBite),
      rows: randomRange(rng, 0, WORLD.bushCornerBite),
    }));
    const field = randomRect(rng, area, w, h);
    // Buesche blockieren nicht - sie duerfen nah an Hindernisse, aber nicht
    // hinein, nicht auf die Strasse und nicht auf die Wegmarken.
    if (!field || obstacles.some((other) => overlaps(field, other))) {
      continue;
    }
    if (reserved.some((circle) => distanceToRect(field, circle) < circle.r * 0.6)) {
      continue;
    }
    const pieces = bushCluster(field, bites);
    bushes.push(...pieces);
    const step = NODE_ARENA.shrubSpacing;
    for (const piece of pieces) {
      for (let y = piece.y + step / 2; y < piece.y + piece.height; y += step) {
        for (let x = piece.x + step / 2; x < piece.x + piece.width; x += step) {
          props.push({
            kind: "shrub",
            x: x + randomRange(rng, -10, 10),
            y: y + randomRange(rng, -10, 10),
            rotation: randomRange(rng, 0, Math.PI * 2),
            level: 0,
            lootable: false,
            scale: randomRange(rng, 0.85, 1.25),
            variant: Math.floor(nextRandom(rng) * 3),
          });
        }
      }
    }
  }

  // --- Rauch ueber einzelnen Daechern ------------------------------------
  const smokeCount = Math.min(buildings.length, densityCount(NODE_ARENA.deco, g));
  for (let i = 0; i < smokeCount; i += 1) {
    const house = buildings[i] as Rect;
    decor(
      "smoke",
      randomRange(rng, house.x + grid, house.x + house.width - grid),
      randomRange(rng, house.y + grid, house.y + house.height - grid),
      randomRange(rng, 0, Math.PI * 2),
      1,
      0,
    );
  }

  // --- Kleinkram ohne Kollision -------------------------------------------
  const free = (x: number, y: number): boolean =>
    obstacles.every(
      (rect) =>
        rect === road ||
        x < rect.x - 16 ||
        x > rect.x + rect.width + 16 ||
        y < rect.y - 16 ||
        y > rect.y + rect.height + 16,
    ) &&
    walls.every(
      (rect) => x < rect.x - 8 || x > rect.x + rect.width + 8 || y < rect.y - 8 || y > rect.y + rect.height + 8,
    ) &&
    (y < road.y - 8 || y > road.y + road.height + 8);
  const scatter = (kind: ArenaProp["kind"], count: number, variants: number, scaleMin: number, scaleMax: number): void => {
    for (let i = 0; i < count; i += 1) {
      const x = randomRange(rng, t + 24, width - t - 24);
      const y = randomRange(rng, t + 24, height - t - 24);
      const rotation = randomRange(rng, 0, Math.PI * 2);
      const scale = randomRange(rng, scaleMin, scaleMax);
      const variant = Math.floor(nextRandom(rng) * variants);
      if (free(x, y)) {
        decor(kind, Math.round(x), Math.round(y), rotation, scale, variant);
      }
    }
  };
  scatter("patch", Math.round(NODE_ARENA.patches * areaFactor), 3, 0.7, 1.4);
  scatter("grass", Math.round(NODE_ARENA.grass * areaFactor * bias.grass), 3, 0.8, 1.4);
  scatter("stone", Math.round(NODE_ARENA.stones * areaFactor), 3, 0.6, 1.5);
  scatter("flower", Math.round(NODE_ARENA.flowers * areaFactor * bias.grass), 3, 0.8, 1.2);
  scatter("debris", densityCount(NODE_ARENA.debris, g), 3, 0.8, 1.3);

  // --- Der Rand: dichter Wald (bzw. Fels), keine Mauer ---------------------
  /*
   * Rueckmeldung: "Eine Mauer und danach Wald macht keinen Sinn, es ist ja
   * eh schon draussen." Die Mauer ist deshalb unsichtbar. Man sieht einen
   * DICHTEN Streifen Baeume und Felsen direkt an der Grenze, nach aussen
   * lichter - die Welt geht weiter, man kommt nur nicht durch. Wo die
   * Strasse das Gebiet verlaesst, stehen stattdessen Strassensperren.
   */
  const depth = NODE_ARENA.outskirtsDepth;
  for (let y = -depth; y < height + depth; y += 1) {
    const rowSpacing = NODE_ARENA.outskirtsSpacing;
    if ((y + depth) % rowSpacing !== 0) continue;
    for (let x = -depth; x < width + depth; x += rowSpacing) {
      const outside = Math.max(-x, x - width, -y, y - height);
      // Direkt an der Grenze doppelt so dicht: ein zweiter, versetzter Punkt.
      const points = outside < 220 ? 2 : 1;
      for (let k = 0; k < points; k += 1) {
        const px = x + randomRange(rng, -rowSpacing * 0.45, rowSpacing * 0.45);
        const py = y + randomRange(rng, -rowSpacing * 0.45, rowSpacing * 0.45);
        const roll = nextRandom(rng);
        const rotation = randomRange(rng, 0, Math.PI * 2);
        const scale = randomRange(rng, 0.9, 1.5);
        const variant = Math.floor(nextRandom(rng) * 3);
        if (px > -30 && px < width + 30 && py > -30 && py < height + 30) continue;
        if (props.length >= NODE_ARENA.maxProps) continue;
        // Auf der Strasse keine Baeume - dort stehen Sperren.
        if (py > road.y - 30 && py < road.y + road.height + 30) continue;
        const kind =
          roll < bias.edgePine ? "pine" : roll < bias.edgePine + bias.edgeTree ? "tree" : roll < 0.93 ? "rock" : "shrub";
        decor(kind, Math.round(px), Math.round(py), rotation, kind === "rock" ? scale * 1.4 : scale, variant);
      }
    }
  }
  // Strassensperren an beiden Enden, knapp ausserhalb.
  for (const x of [-2 * grid, width + 2 * grid]) {
    for (let lane = 0; lane < roadTiles; lane += 2) {
      decor("roadblock", x, road.y + (lane + 1) * grid, Math.PI / 2, 1, 0);
    }
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
    spawnPoint,
    encounters,
    extractions,
    props,
    fixedZone: g,
    safeRadius: 0,
    node,
    theme,
    roads,
    lots,
  };
}

/** Wie stark jede Region ihre Umgebung gewichtet (1 = wie bisher). */
const THEME_BIAS: Record<
  RegionTheme,
  { trees: number; pineShare: number; rocks: number; barrels: number; grass: number; edgePine: number; edgeTree: number }
> = {
  suburb: { trees: 1, pineShare: 0.3, rocks: 0.6, barrels: 0.6, grass: 1.2, edgePine: 0.25, edgeTree: 0.55 },
  industry: { trees: 0.4, pineShare: 0.4, rocks: 0.8, barrels: 2, grass: 0.5, edgePine: 0.35, edgeTree: 0.3 },
  forest: { trees: 2.2, pineShare: 0.65, rocks: 1, barrels: 0.3, grass: 1, edgePine: 0.6, edgeTree: 0.25 },
  coast: { trees: 0.5, pineShare: 0.4, rocks: 1.6, barrels: 0.7, grass: 0.7, edgePine: 0.2, edgeTree: 0.2 },
};

/** Die Grundflaeche eines Orts (Kacheln -> Weltpixel). */
function placeFootprint(def: PlaceDef, frame: Frame): Rect {
  return footprint(def, frame);
}

/** Unsichtbare Aussenmauer eines rechteckigen Gebiets. */
function rectWalls(width: number, height: number): Rect[] {
  const t = WORLD.wallThickness;
  return [
    { x: 0, y: 0, width, height: t },
    { x: 0, y: height - t, width, height: t },
    { x: 0, y: 0, width: t, height },
    { x: width - t, y: 0, width: t, height },
  ];
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
