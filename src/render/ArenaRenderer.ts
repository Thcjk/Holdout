/**
 * Zeichnet die unbewegliche Arena: Boden, Waende, Deckung und Buesche.
 *
 * Alles hier wird einmal aufgebaut und danach nicht mehr angefasst - das ist
 * billiger, als jedes Bild neu zu zeichnen.
 *
 * WARUM `tileSprite` UND NICHT VIELE EINZELBILDER: Eine Kachel ist 16 Pixel
 * gross, die Arena 1600 x 1200 - das waeren 7500 einzelne Bilder, jedes mit
 * eigener Position und eigenem Zeichenaufruf. Ein `tileSprite` ist EIN Objekt,
 * das seine Kachel selbst wiederholt. Es passt ausserdem auf beliebige Masse:
 * Die Deckungsbloecke sind 200 x 60 Pixel gross, was kein glattes Vielfaches
 * von 16 ist - ein `tileSprite` schneidet die letzte Kachel einfach ab, statt
 * ueber den Rand zu stehen.
 */

import Phaser from "phaser";
import {
  BUSH_TILE,
  COVER_TILE,
  FLOOR_TILES,
  SHEET_KEY,
  WALL_TILE,
  WORLD_SCALE,
} from "../config/assets";
import { COVER_BLOCKS } from "../config/arena";
import { ARENA, DEPTH } from "../config/constants";
import type { Rect, WorldState } from "../systems/types";

export class ArenaRenderer {
  /** Alles, was beim Verlassen der Szene wieder wegmuss. */
  private readonly parts: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    state: WorldState,
  ) {
    this.drawFloor();
    this.drawWalls(state);
    this.drawBushes(state);
  }

  destroy(): void {
    for (const part of this.parts) {
      part.destroy();
    }
    this.parts.length = 0;
  }

  /**
   * Der Boden.
   *
   * Vier Steinkacheln in grossen Feldern statt einer einzigen ueber alles:
   * Eine einzelne Kachel ueber 1600 Pixel wiederholt ergibt ein sichtbares
   * Streifenmuster, weil das Auge die Wiederholung findet. Vier Felder
   * unterschiedlicher Kachel brechen das auf, ohne dass es unruhig wird.
   */
  private drawFloor(): void {
    const half = { w: ARENA.width / 2, h: ARENA.height / 2 };
    const felder: [number, number, number][] = [
      [0, 0, 0],
      [half.w, 0, 1],
      [0, half.h, 2],
      [half.w, half.h, 3],
    ];

    for (const [x, y, index] of felder) {
      this.add(
        this.scene.add
          .tileSprite(x, y, half.w, half.h, SHEET_KEY, FLOOR_TILES[index % FLOOR_TILES.length])
          .setOrigin(0)
          // Die Kachel selbst vergroessern, nicht das Sprite: `setScale` wuerde
          // auch die Flaeche strecken und ueber die Arena hinausragen.
          .setTileScale(WORLD_SCALE, WORLD_SCALE)
          .setDepth(DEPTH.floor),
      );
    }
  }

  /**
   * Waende - und zwar zweierlei.
   *
   * Die Aussenmauer haelt das Spielfeld zusammen und bekommt die Steinwand aus
   * dem Sheet. Die Deckungsbloecke stehen mitten im Feld und bekommen
   * Holzkisten: Sie sollen sich vom Rand abheben, weil sie taktisch etwas ganz
   * anderes bedeuten - hinter der Aussenmauer steht nie jemand, hinter einer
   * Kiste staendig.
   *
   * Die Simulation kennt diesen Unterschied nicht; fuer sie ist beides
   * dasselbe Rechteck. Das ist Absicht - es ist ein rein optischer
   * Unterschied, und die Spiellogik soll davon nichts wissen muessen.
   */
  private drawWalls(state: WorldState): void {
    /*
     * Ein Umriss um jeden Block - und der ist nicht Zierde, sondern die
     * Loesung eines sichtbaren Fehlers.
     *
     * Ein Deckungsblock ist 60 Pixel breit, eine Kachel erscheint mit 48:
     * 60/48 = 1,25, die letzte Kachel wird also angeschnitten. Frueher lag
     * dort eine gerahmte Holzkiste, und der Schnitt sah aus wie ein zufaelliger
     * Streifen neben dem Block. Jetzt liegen dort nahtlose Ziegel, bei denen
     * der Schnitt nicht auffaellt - und der Umriss gibt dem Block seine Kante
     * zurueck. Er liegt IMMER genau auf der Kollisionsgrenze, egal wo die
     * Kachel endet: Was man sieht, ist auch das, wogegen man laeuft.
     */
    const umriss = this.scene.add.graphics().setDepth(DEPTH.walls + 1);
    this.add(umriss);

    for (const wall of state.walls) {
      const deckung = this.istDeckung(wall);
      this.add(
        this.scene.add
          .tileSprite(wall.x, wall.y, wall.width, wall.height, SHEET_KEY, deckung ? COVER_TILE : WALL_TILE)
          .setOrigin(0)
          .setTileScale(WORLD_SCALE, WORLD_SCALE)
          .setDepth(DEPTH.walls),
      );

      umriss.lineStyle(3, 0x1b2430, deckung ? 0.9 : 0.55);
      umriss.strokeRect(wall.x, wall.y, wall.width, wall.height);
    }
  }

  /** Ist dieses Rechteck einer der Deckungsbloecke aus `config/arena.ts`? */
  private istDeckung(wall: Rect): boolean {
    return COVER_BLOCKS.some(
      (block) =>
        block.x === wall.x &&
        block.y === wall.y &&
        block.width === wall.width &&
        block.height === wall.height,
    );
  }

  /**
   * Buesche liegen UEBER den Figuren: Wer drinsteht, ist halb verdeckt - genau
   * das ist ja der Sinn eines Verstecks.
   *
   * Zwei Anlaeufe waren noetig, beide aus demselben Grund falsch - die Kacheln
   * waren zu klein und zu luecken­haft. Warum es jetzt GRAS ist und nicht die
   * Buschkacheln des Pakets, steht bei `BUSH_TILE` in `config/assets.ts`.
   */
  private drawBushes(state: WorldState): void {
    for (const bush of state.bushes) {
      this.add(
        this.scene.add
          .tileSprite(bush.x, bush.y, bush.width, bush.height, SHEET_KEY, BUSH_TILE)
          .setOrigin(0)
          .setTileScale(WORLD_SCALE, WORLD_SCALE)
          // Leicht durchscheinend: Man soll erkennen, dass da jemand drin
          // steht, ohne ihn genau zu sehen.
          .setAlpha(0.85)
          .setDepth(DEPTH.bushesAbove),
      );
    }
  }

  private add(part: Phaser.GameObjects.GameObject): void {
    this.parts.push(part);
  }
}
