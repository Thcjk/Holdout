/**
 * Die Weltgenerierung - zwei Zusicherungen, die man nicht behaupten darf.
 *
 * 1. DETERMINISMUS. Derselbe Seed muss exakt dieselbe Karte ergeben. Daran
 *    haengt der ganze Koop: Der Host schickt eine Zahl, jedes Geraet baut
 *    daraus seine eigene Welt. Weicht ein Geraet ab, laeuft dieser Spieler
 *    gegen unsichtbare Waende.
 *
 * 2. ZUSAMMENHANG. Von jedem erreichbaren Punkt muss man zu jedem anderen
 *    kommen. Zufaellig gestreute Rechtecke koennen eine Flaeche einschliessen -
 *    und ab Phase 10 laege dort Loot, an das niemand herankommt.
 *
 * Der Aufbau des Generators macht beides schon von sich aus richtig (fester
 * Zufallsstrom, Raster mit garantierten Gassen). Genau deshalb wird es hier
 * geprueft: Eine Zusicherung, die nur im Kopf des Autors steht, haelt genau bis
 * zur naechsten Aenderung.
 */

import { describe, expect, it } from "vitest";
import { PLAYER, WORLD } from "../../src/config/balance";
import { TILE, WORLD_SCALE } from "../../src/config/assets";
import { bushCluster, generateWorld, gameplaySeed } from "../../src/systems/WorldGenerator";
import type { Rect } from "../../src/systems/types";

const SEEDS = [1, 42, 4242, 20260918, 999999];

/** Liegt der Punkt in einem Rechteck, das um `pad` aufgeblasen ist? */
function blocked(x: number, y: number, walls: readonly Rect[], pad: number): boolean {
  for (const wall of walls) {
    if (
      x >= wall.x - pad &&
      x <= wall.x + wall.width + pad &&
      y >= wall.y - pad &&
      y <= wall.y + wall.height + pad
    ) {
      return true;
    }
  }
  return false;
}

describe("Weltgenerierung", () => {
  it("ergibt bei gleichem Seed exakt dieselbe Karte", () => {
    for (const seed of SEEDS) {
      const a = generateWorld(seed);
      const b = generateWorld(seed);

      // Tief vergleichen, nicht ueber eine Pruefsumme: Eine Pruefsumme sagt
      // "ungefaehr gleich", und "ungefaehr" reicht hier nicht - ein einziges
      // verschobenes Rechteck genuegt, um den Koop zu zerlegen.
      expect(b).toEqual(a);
    }
  });

  it("ergibt bei verschiedenen Seeds verschiedene Karten", () => {
    // Ohne diese Pruefung waere ein Generator, der den Seed ignoriert und
    // immer dieselbe Karte liefert, "deterministisch" und trotzdem kaputt.
    const first = JSON.stringify(generateWorld(SEEDS[0] as number).walls);
    const others = SEEDS.slice(1).map((seed) => JSON.stringify(generateWorld(seed).walls));

    for (const other of others) {
      expect(other).not.toBe(first);
    }
  });

  it("trennt den Strom der Welt vom Strom des Spiels", () => {
    // Waeren beide gleich, wuerde ein zusaetzlicher Deckungsblock jede spaetere
    // Zufallszahl im Spiel verschieben - Streuung, Spawnpositionen, alles.
    for (const seed of SEEDS) {
      expect(gameplaySeed(seed)).not.toBe(seed);
    }
  });

  it("haelt den Startpunkt und seine Umgebung frei", () => {
    for (const seed of SEEDS) {
      const world = generateWorld(seed);

      expect(world.spawnPoint.x).toBe(world.bounds.width / 2);
      expect(world.spawnPoint.y).toBe(world.bounds.height / 2);

      // Nichts Blockierendes im sicheren Ring: Man soll nicht zwischen Kisten
      // aufwachen, und in der sicheren Zone heilt man - das darf keine
      // Kletterpartie sein.
      for (const wall of world.walls) {
        const dx = Math.max(wall.x - world.spawnPoint.x, 0, world.spawnPoint.x - (wall.x + wall.width));
        const dy = Math.max(wall.y - world.spawnPoint.y, 0, world.spawnPoint.y - (wall.y + wall.height));
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(WORLD.safeRadius - 1);
      }
    }
  });

  it("laesst nichts ueber den Rand der Welt hinausragen", () => {
    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      for (const rect of [...world.walls, ...world.bushes]) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(world.bounds.width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(world.bounds.height);
      }
    }
  });

  /**
   * Die wichtigste Pruefung: Ist die Karte EIN zusammenhaengendes Gebiet?
   *
   * Verfahren: ein Raster ueber die Welt legen, jede Zelle als frei oder
   * blockiert markieren (Waende um den Spielerradius aufgeblasen, denn ein
   * Kreis von 18 Pixeln passt nicht durch eine Luecke von 10), dann vom
   * Startpunkt aus fluten. Besteht der Test, gibt es keine einzige freie Zelle,
   * die man vom Start aus nicht erreicht.
   *
   * Rasterweite 50 Pixel: Die schmalste Gasse ist `minGap` = 160 Pixel breit,
   * abzueglich zweimal Spielerradius bleiben 124 - da liegen immer mindestens
   * zwei Rasterpunkte drin.
   */
  /**
   * Kein Rechteck darf kleiner als ein Pixel sein.
   *
   * ================================================================
   * DAS IST KEINE SCHOENHEITSFRAGE, SONDERN EIN ABSTURZ
   * ================================================================
   *
   * Beim Einbau der Gebaeude entstanden Wandstuecke von 0,24 Pixeln Hoehe -
   * der Rest, der neben einer Tuer stehenbleibt, wenn sie fast am Ende der
   * Seite sitzt. In der Simulation war das harmlos. Im Bild nicht: Phaser
   * legt fuer jedes `tileSprite` eine Leinwand in Objektgroesse an und liest
   * sie mit `getImageData` aus. Bei Hoehe 0 wirft das "IndexSizeError", und
   * das Spiel startete gar nicht mehr.
   *
   * Der Test prueft deshalb ALLE Rechtecke der Welt, nicht nur die Gebaeude -
   * die naechste Quelle solcher Splitter waere sonst wieder unentdeckt.
   */
  it("erzeugt kein Rechteck, das kleiner als ein Pixel ist", () => {
    let smallest = Number.POSITIVE_INFINITY;

    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      for (const rect of [...world.walls, ...world.bushes, ...world.buildings]) {
        smallest = Math.min(smallest, rect.width, rect.height);
      }
    }

    console.log(`   kleinste Kante ueber alle Rechtecke: ${smallest.toFixed(2)} px`);
    expect(smallest).toBeGreaterThanOrEqual(1);
  });

  /**
   * Die Gegenprobe zur Flutfuellung - und sie ist noetig.
   *
   * "100 % erreichbar" klingt gut, sagt aber nichts, solange nicht feststeht,
   * dass die Pruefung ueberhaupt etwas merkt. Gebaeudewaende sind nur 36 Pixel
   * dick; springt das Raster darueber hinweg, bestuende der Test auch dann,
   * wenn jedes Haus zugemauert waere.
   *
   * Deshalb hier andersherum: Die Tuer wird zugemauert, und danach MUSS der
   * Innenraum unerreichbar sein. Faellt dieser Test durch, ist die Zahl oben
   * wertlos.
   */
  it("merkt es, wenn ein Gebaeude zugemauert ist", () => {
    const step = 50;
    const world = generateWorld(4242);
    const house = world.buildings[0];
    if (!house) throw new Error("kein Gebaeude erzeugt");

    /** Erreicht die Flutfuellung vom Start aus die Mitte dieses Hauses? */
    const interiorReachable = (walls: readonly typeof world.walls[number][]): boolean => {
      const cells = Math.floor(world.bounds.width / step);
      const free = new Uint8Array(cells * cells);
      for (let row = 0; row < cells; row += 1) {
        for (let column = 0; column < cells; column += 1) {
          const x = column * step + step / 2;
          const y = row * step + step / 2;
          if (!blocked(x, y, walls, PLAYER.radius)) {
            free[row * cells + column] = 1;
          }
        }
      }

      const seen = new Uint8Array(cells * cells);
      const start = Math.floor(world.spawnPoint.y / step) * cells + Math.floor(world.spawnPoint.x / step);
      const stack = [start];
      seen[start] = 1;
      while (stack.length > 0) {
        const index = stack.pop() as number;
        const row = Math.floor(index / cells);
        const column = index % cells;
        for (const [r, c] of [
          [row - 1, column],
          [row + 1, column],
          [row, column - 1],
          [row, column + 1],
        ] as [number, number][]) {
          if (r < 0 || c < 0 || r >= cells || c >= cells) continue;
          const next = r * cells + c;
          if (seen[next] === 1 || free[next] !== 1) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }

      const midColumn = Math.floor((house.x + house.width / 2) / step);
      const midRow = Math.floor((house.y + house.height / 2) / step);
      return seen[midRow * cells + midColumn] === 1;
    };

    // So, wie der Generator es gebaut hat: Die Tuer ist offen.
    expect(interiorReachable(world.walls)).toBe(true);

    // Und jetzt zugemauert - ein Rahmen ohne Luecke um denselben Grundriss.
    const sealed = [
      ...world.walls,
      { x: house.x, y: house.y, width: house.width, height: WORLD.buildingWall },
      {
        x: house.x,
        y: house.y + house.height - WORLD.buildingWall,
        width: house.width,
        height: WORLD.buildingWall,
      },
      { x: house.x, y: house.y, width: WORLD.buildingWall, height: house.height },
      {
        x: house.x + house.width - WORLD.buildingWall,
        y: house.y,
        width: WORLD.buildingWall,
        height: house.height,
      },
    ];
    expect(interiorReachable(sealed)).toBe(false);
  });

  it("erzeugt eine Karte ohne eingeschlossene Flaechen", () => {
    const step = 50;

    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      const cells = Math.floor(world.bounds.width / step);

      const free = new Uint8Array(cells * cells);
      let freeCount = 0;
      for (let row = 0; row < cells; row += 1) {
        for (let column = 0; column < cells; column += 1) {
          const x = column * step + step / 2;
          const y = row * step + step / 2;
          if (!blocked(x, y, world.walls, PLAYER.radius)) {
            free[row * cells + column] = 1;
            freeCount += 1;
          }
        }
      }

      // Flutfuellung vom Startpunkt aus.
      const startColumn = Math.floor(world.spawnPoint.x / step);
      const startRow = Math.floor(world.spawnPoint.y / step);
      const seen = new Uint8Array(cells * cells);
      const stack = [startRow * cells + startColumn];
      seen[stack[0] as number] = 1;
      let reached = 0;

      while (stack.length > 0) {
        const index = stack.pop() as number;
        reached += 1;
        const row = Math.floor(index / cells);
        const column = index % cells;

        const neighbours = [
          [row - 1, column],
          [row + 1, column],
          [row, column - 1],
          [row, column + 1],
        ];
        for (const [r, c] of neighbours as [number, number][]) {
          if (r < 0 || c < 0 || r >= cells || c >= cells) {
            continue;
          }
          const next = r * cells + c;
          if (seen[next] === 1 || free[next] !== 1) {
            continue;
          }
          seen[next] = 1;
          stack.push(next);
        }
      }

      const total = cells * cells;
      console.log(
        `   Seed ${String(seed).padStart(8)}: ${((freeCount / total) * 100).toFixed(1)} % ` +
          `der Karte begehbar, davon erreichbar ${((reached / freeCount) * 100).toFixed(1)} %`,
      );

      /*
       * Zwei Zusicherungen, und die erste ist gegen einen stillen Fehlschlag:
       * Waere fast alles blockiert, bestuende die zweite Pruefung trivial. Eine
       * Karte, auf der man sich nicht bewegen kann, ist kein bestandener Test.
       */
      expect(freeCount / total).toBeGreaterThan(0.5);
      expect(reached).toBe(freeCount);
    }
  });
});

describe("Kachelraster (Etappe 5)", () => {
  it("rechnet mit derselben Kachelgroesse wie die Darstellung", () => {
    // `systems/` darf `config/assets.ts` nicht benutzen - also steht die Zahl
    // zweimal da, und dieser Test haelt beide zusammen.
    expect(WORLD.grid).toBe(TILE * WORLD_SCALE);
  });

  it("legt jede Wand und jedes Buschstueck aufs Raster", () => {
    const g = WORLD.grid;
    for (const seed of SEEDS) {
      const world = generateWorld(seed);
      const outer = (rect: Rect): boolean =>
        rect.x === 0 || rect.y === 0 || rect.x + rect.width === WORLD.size || rect.y + rect.height === WORLD.size;

      for (const rect of [...world.walls, ...world.bushes]) {
        if (outer(rect)) {
          // Die Aussenmauer ist so lang wie die Welt (16000, kein Vielfaches
          // von 48) - aber genau eine Kachel dick.
          expect(Math.min(rect.width, rect.height)).toBe(g);
          continue;
        }
        expect(rect.x % g, `Seed ${seed}`).toBe(0);
        expect(rect.y % g, `Seed ${seed}`).toBe(0);
        expect(rect.width % g, `Seed ${seed}`).toBe(0);
        expect(rect.height % g, `Seed ${seed}`).toBe(0);
      }
    }
  });

  it("macht aus Buschfeldern Haufen ohne Ueberlappung, die zusammenhaengen", () => {
    const g = WORLD.grid;
    const field = { x: 0, y: 0, width: 8 * g, height: 6 * g };
    const pieces = bushCluster(field, [
      { columns: 0.4, rows: 0.4 },
      { columns: 0.2, rows: 0.3 },
      { columns: 0.3, rows: 0.1 },
      { columns: 0.44, rows: 0.44 },
    ]);

    // Kein Rechteck mehr, sondern mehrere Stuecke ...
    expect(pieces.length).toBeGreaterThan(1);
    // ... ohne Ueberlappung (sonst waere eine Stelle doppelt dunkel) ...
    for (let i = 0; i < pieces.length; i += 1) {
      for (let j = i + 1; j < pieces.length; j += 1) {
        const a = pieces[i];
        const b = pieces[j];
        if (!a || !b) continue;
        const overlap =
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlap).toBe(false);
      }
    }
    // ... und jedes Stueck beruehrt das naechste (das Kreuz in der Mitte bleibt).
    for (let i = 1; i < pieces.length; i += 1) {
      const a = pieces[i - 1];
      const b = pieces[i];
      if (!a || !b) continue;
      expect(a.y + a.height).toBe(b.y);
      expect(a.x < b.x + b.width && b.x < a.x + a.width).toBe(true);
    }
  });
});
