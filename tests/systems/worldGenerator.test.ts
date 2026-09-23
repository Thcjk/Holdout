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
import { WORLD } from "../../src/config/balance";
import { PLAYER } from "../../src/config/balance";
import { generateWorld, gameplaySeed } from "../../src/systems/WorldGenerator";
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
