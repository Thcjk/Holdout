/**
 * Zeichnet die unbewegliche Welt: Boden, Waende, Deckung und Buesche.
 *
 * WARUM `tileSprite` UND NICHT VIELE EINZELBILDER: Eine Kachel ist 16 Pixel
 * gross. Ein `tileSprite` ist EIN Objekt, das seine Kachel selbst wiederholt,
 * und es passt auf beliebige Masse - es schneidet die letzte Kachel einfach ab,
 * statt ueber den Rand zu stehen.
 *
 * ================================================================
 * SEIT PHASE 8: DIE WELT IST 48-MAL SO GROSS
 * ================================================================
 *
 * Frueher war die Arena 1600 x 1200 und der Boden bestand aus vier
 * `tileSprite`. Jetzt ist die Welt 9600 x 9600 - dieselbe Bauweise haette eine
 * einzelne Zeichenflaeche von 92 Millionen Pixeln ergeben.
 *
 * Deshalb wird alles Unbewegliche in KACHELFELDER zerlegt und nach Kamerasicht
 * ein- und ausgeblendet (`update()`). Sichtbar ist immer nur, was auch wirklich
 * im Bild liegt - die Kosten haengen damit an der Bildschirmgroesse und nicht
 * mehr an der Weltgroesse. Genau deshalb darf die Welt ueberhaupt so gross
 * sein, ohne die Grenzen aus dem Briefing (Abschnitt 7) zu verletzen: Die
 * beziehen sich auf die Anzahl gleichzeitig aktiver Objekte, und die bleibt
 * gleich.
 */

import Phaser from "phaser";
import {
  BUILDING_FLOOR_TILE,
  BUILDING_WALL_TILE,
  BUSH_TILE,
  COVER_TILE,
  FLOOR_TILES,
  SHEET_KEY,
  WALL_TILE,
  WORLD_SCALE,
} from "../config/assets";
import { ENCOUNTERS } from "../config/balance";
import { COLORS, DEPTH } from "../config/constants";
import type { Rect, WorldState } from "../systems/types";

/**
 * Kantenlaenge eines Bodenfelds in Weltpixeln.
 *
 * Kompromiss: Kleine Felder heissen viele Objekte (9600/600 = 16x16 = 256),
 * grosse Felder heissen, dass man mehr zeichnet, als man sieht. 1200 ergibt
 * 8x8 = 64 Felder, von denen je nach Zoom zwei bis sechs sichtbar sind.
 */
const FLOOR_CHUNK = 1200;

/** Sicherheitsrand um das Sichtfeld, damit am Bildrand nichts aufpoppt. */
const CULL_MARGIN = 300;

interface CullablePart {
  object: Phaser.GameObjects.TileSprite;
  rect: Rect;
}

export class ArenaRenderer {
  /** Alles, was beim Verlassen der Szene wieder wegmuss. */
  private readonly parts: Phaser.GameObjects.GameObject[] = [];

  /** Was nach Kamerasicht ein- und ausgeblendet wird. */
  private readonly cullable: CullablePart[] = [];

  /** Die Deckungsbloecke mit ihrem Umriss - der wird je Bild neu gezeichnet. */
  private readonly coverBlocks: Rect[] = [];
  private readonly outline: Phaser.GameObjects.Graphics;

  /** Die Ringe von Encounter- und Ausstiegszonen, je Bild neu gezeichnet. */
  private readonly markers: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: WorldState,
  ) {
    this.outline = scene.add.graphics().setDepth(DEPTH.walls + 1);
    this.parts.push(this.outline);

    // UNTER den Figuren, aber ueber dem Boden: Die Ringe liegen auf dem Boden
    // und duerfen niemanden verdecken, den man gerade bekaempft.
    this.markers = scene.add.graphics().setDepth(DEPTH.floor + 1);
    this.parts.push(this.markers);

    this.drawFloor(state);
    this.drawBuildingFloors(state);
    this.drawWalls(state);
    this.drawBushes(state);
    this.update();
  }

  destroy(): void {
    for (const part of this.parts) {
      part.destroy();
    }
    this.parts.length = 0;
    this.cullable.length = 0;
    this.coverBlocks.length = 0;
  }

  /**
   * Blendet ein, was im Bild liegt, und den Rest aus.
   *
   * Wird jedes Bild aus der Spielszene gerufen. Der Vergleich ist eine reine
   * Rechteckpruefung je Teil - bei rund 300 Teilen kostet das nichts, spart
   * aber das Zeichnen von fast allem.
   */
  update(): void {
    const view = this.scene.cameras.main.worldView;
    const left = view.x - CULL_MARGIN;
    const top = view.y - CULL_MARGIN;
    const right = view.right + CULL_MARGIN;
    const bottom = view.bottom + CULL_MARGIN;

    for (const part of this.cullable) {
      const { rect } = part;
      const visible =
        rect.x < right &&
        rect.x + rect.width > left &&
        rect.y < bottom &&
        rect.y + rect.height > top;
      part.object.setVisible(visible);
    }

    this.drawOutlines(left, top, right, bottom);
    this.drawMarkers(left, top, right, bottom);
  }

  /**
   * Die Ringe auf dem Boden: rot fuer einen Boss, gruen fuer einen Ausstieg.
   *
   * SIE SIND DIE WARNUNG, DIE DEN ENCOUNTER FAIR MACHT. Der Boss schlaeft, bis
   * jemand seinen Radius betritt - ohne sichtbaren Ring liefe man ahnungslos
   * hinein und haette sich nicht entschieden, sondern waere gestolpert.
   *
   * Ein geschaffter Encounter wird blass statt zu verschwinden: So sieht man
   * beim Zurueckkommen, wo man schon war.
   */
  private drawMarkers(left: number, top: number, right: number, bottom: number): void {
    this.markers.clear();

    const visible = (x: number, y: number, radius: number): boolean =>
      x + radius > left && x - radius < right && y + radius > top && y - radius < bottom;

    for (const spot of this.state.encounters) {
      const { x, y } = spot.position;
      if (!visible(x, y, ENCOUNTERS.triggerRadius)) {
        continue;
      }

      const cleared = spot.status === "cleared";
      // Der Ende-Boss bekommt einen groesseren Ring - man soll von weitem
      // sehen, dass dort etwas anderes wartet als an den acht davor.
      // Genau der Radius, bei dem der Boss erwacht. Wer den Ring ueberschreitet,
      // hat sich entschieden - vorher passiert nichts.
      const radius = ENCOUNTERS.triggerRadius * (spot.isFinal ? 1.35 : 1);

      this.markers.lineStyle(cleared ? 2 : 4, COLORS.danger, cleared ? 0.25 : 0.75);
      this.markers.strokeCircle(x, y, radius);

      if (!cleared) {
        this.markers.fillStyle(COLORS.danger, 0.06);
        this.markers.fillCircle(x, y, radius);
      }
    }

    /*
     * Die Ausstiegszonen - und die haben nach dem Spieltest deutlich
     * zugelegt.
     *
     * Vorher waren sie ein duenner gruener Kreis mit 10 % Fuellung. Auf einem
     * Bild voller Sand, Ziegel und Gras ist das genau dann zu sehen, wenn man
     * schon davorsteht - zurueckgemeldet als "Extraktionspunkte findet man
     * gar nicht". Jetzt sind es DREI Dinge uebereinander, weil ein einzelnes
     * im Getuemmel untergeht:
     *
     *   1. ein kraeftig gefuellter Kreis (die Zone selbst),
     *   2. ein PULSIERENDER Ring darueber - Bewegung faellt im Augenwinkel
     *      auf, eine ruhende Flaeche nicht,
     *   3. ein doppelt so grosser, blasser Hof - er ist im Bild, bevor die
     *      Zone selbst es ist.
     *
     * Der Puls laeuft ueber die Weltzeit und nicht ueber einen eigenen
     * Zaehler: So pulsieren alle Zonen im Gleichtakt, und im Koop sehen alle
     * Geraete dasselbe.
     */
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now / 420);

    for (const zone of this.state.extractions) {
      const { x, y } = zone.position;
      const halo = zone.radius * 2;
      if (!visible(x, y, halo)) {
        continue;
      }

      // Der Hof: gross und blass, damit er von weitem als gruener Fleck
      // auffaellt, ohne die Sicht auf Gegner darin zu nehmen.
      this.markers.fillStyle(COLORS.mate, 0.05);
      this.markers.fillCircle(x, y, halo);

      this.markers.fillStyle(COLORS.mate, 0.22);
      this.markers.fillCircle(x, y, zone.radius);
      this.markers.lineStyle(5, COLORS.mate, 0.95);
      this.markers.strokeCircle(x, y, zone.radius);

      // Der Puls: ein Ring, der nach aussen laeuft und dabei verblasst.
      this.markers.lineStyle(3, COLORS.mate, 0.5 * (1 - pulse));
      this.markers.strokeCircle(x, y, zone.radius * (0.55 + 0.45 * pulse));
    }
  }

  /**
   * Der Umriss um jeden Deckungsblock - und der ist nicht Zierde, sondern die
   * Loesung eines sichtbaren Fehlers.
   *
   * Eine Kachel erscheint mit 48 Pixeln (16 x WORLD_SCALE), ein Deckungsblock
   * ist aber beliebig breit - die letzte Kachel wird also fast immer
   * angeschnitten. Bei einer nahtlosen Textur faellt der Schnitt nicht auf, und
   * der Umriss gibt dem Block seine Kante zurueck. Er liegt IMMER genau auf der
   * Kollisionsgrenze: Was man sieht, ist auch das, wogegen man laeuft.
   *
   * Neu gezeichnet statt einmal gefuellt: Bei 150 Bloecken in der ganzen Welt
   * waeren das 150 Rechtecke je Bild, obwohl hoechstens ein Dutzend sichtbar
   * ist. Loeschen und neu zeichnen ist hier billiger als alles zu behalten.
   */
  private drawOutlines(left: number, top: number, right: number, bottom: number): void {
    this.outline.clear();
    this.outline.lineStyle(3, 0x1b2430, 0.9);

    for (const block of this.coverBlocks) {
      if (
        block.x >= right ||
        block.x + block.width <= left ||
        block.y >= bottom ||
        block.y + block.height <= top
      ) {
        continue;
      }
      this.outline.strokeRect(block.x, block.y, block.width, block.height);
    }
  }

  /**
   * Der Boden, in Feldern.
   *
   * Die Kachel wechselt je Feld zwischen den verfuegbaren Bodenkacheln. Eine
   * einzige Kachel ueber 9600 Pixel wiederholt ergibt ein sichtbares
   * Streifenmuster, weil das Auge die Wiederholung findet; der Wechsel bricht
   * das auf, ohne dass es unruhig wird.
   */
  private drawFloor(state: WorldState): void {
    const { width, height } = state.bounds;
    const columns = Math.ceil(width / FLOOR_CHUNK);
    const rows = Math.ceil(height / FLOOR_CHUNK);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column * FLOOR_CHUNK;
        const y = row * FLOOR_CHUNK;
        const chunkWidth = Math.min(FLOOR_CHUNK, width - x);
        const chunkHeight = Math.min(FLOOR_CHUNK, height - y);
        const tile = FLOOR_TILES[(row + column) % FLOOR_TILES.length];

        const sprite = this.scene.add
          .tileSprite(x, y, chunkWidth, chunkHeight, SHEET_KEY, tile)
          .setOrigin(0)
          // Die Kachel selbst vergroessern, nicht das Sprite: `setScale` wuerde
          // auch die Flaeche strecken und ueber die Welt hinausragen.
          .setTileScale(WORLD_SCALE, WORLD_SCALE)
          .setDepth(DEPTH.floor);

        this.addCullable(sprite, { x, y, width: chunkWidth, height: chunkHeight });
      }
    }
  }

  /**
   * Waende - und zwar zweierlei.
   *
   * Die Aussenmauer haelt die Welt zusammen und bekommt die Steinwand aus dem
   * Sheet. Die Deckungsbloecke stehen im Feld und bekommen Ziegel: Sie sollen
   * sich vom Rand abheben, weil sie taktisch etwas ganz anderes bedeuten -
   * hinter der Aussenmauer steht nie jemand, hinter einem Block staendig.
   *
   * WORAN DER UNTERSCHIED ERKANNT WIRD: Frueher gab es dafuer die feste Liste
   * `COVER_BLOCKS` aus `config/arena.ts`. Die ist mit der Weltgenerierung
   * verschwunden - jetzt entscheidet die Lage: Was die Aussenkante der Welt
   * beruehrt, ist Mauer, alles andere ist Deckung. Das braucht keine
   * zusaetzlichen Daten und kann deshalb auch nicht mit ihnen auseinanderlaufen.
   *
   * Die Simulation kennt diesen Unterschied weiterhin nicht; fuer sie ist
   * beides dasselbe Rechteck. Das ist Absicht - er ist rein optisch.
   */
  private drawWalls(state: WorldState): void {
    for (const wall of state.walls) {
      /*
       * Drei Materialien aus einer einzigen Liste von Rechtecken.
       *
       * Die Simulation kennt nur "blockiert". Welches Bild dazugehoert, liest
       * die Darstellung aus der LAGE ab, nicht aus einem zusaetzlichen Feld:
       *
       *   beruehrt den Kartenrand   -> Aussenmauer
       *   liegt in einem Grundriss  -> Gebaeudewand
       *   sonst                     -> Deckungsblock
       *
       * Ein Feld "material" am Rechteck waere eine zweite Wahrheit ueber
       * dieselbe Mauer, und zwei Wahrheiten laufen frueher oder spaeter
       * auseinander. Abgelesen kann das nicht passieren.
       */
      const outer = this.touchesBorder(wall, state);
      const inBuilding = !outer && this.insideBuilding(wall, state);
      const deckung = !outer && !inBuilding;

      const texture = outer
        ? WALL_TILE
        : inBuilding
          ? BUILDING_WALL_TILE
          : COVER_TILE;

      const sprite = this.scene.add
        .tileSprite(wall.x, wall.y, wall.width, wall.height, SHEET_KEY, texture)
        .setOrigin(0)
        .setTileScale(WORLD_SCALE, WORLD_SCALE)
        .setDepth(DEPTH.walls);

      this.addCullable(sprite, wall);

      // Den Umriss bekommen Deckung UND Gebaeudewand: Er liegt genau auf der
      // Kollisionskante und ist der Grund, warum eine angeschnittene Kachel
      // nicht als fehlendes Stueck auffaellt (siehe `drawOutlines`).
      if (deckung || inBuilding) {
        this.coverBlocks.push(wall);
      }
    }
  }

  /** Liegt dieses Wandstueck innerhalb eines Gebaeudegrundrisses? */
  private insideBuilding(wall: Rect, state: WorldState): boolean {
    return state.buildings.some(
      (house) =>
        wall.x >= house.x - 1 &&
        wall.y >= house.y - 1 &&
        wall.x + wall.width <= house.x + house.width + 1 &&
        wall.y + wall.height <= house.y + house.height + 1,
    );
  }

  /**
   * Der Innenboden der Gebaeude.
   *
   * ================================================================
   * DER BODEN IST DAS, WAS EIN GEBAEUDE ERKENNBAR MACHT - NICHT DIE WAND
   * ================================================================
   *
   * Zurueckgemeldet wurde "die Welt ist zu leer und zu unuebersichtlich". Vier
   * Wandstuecke mehr haetten daran nichts geaendert - sie saehen aus wie
   * Deckung. Was einen ORT ausmacht, ist, dass er innen anders aussieht als
   * aussen: dunkles Grau (74,74,74) im hellen Sand (186,127,67). Das liest man
   * ohne Erklaerung und aus jeder Entfernung, in der das Haus ueberhaupt im
   * Bild ist.
   *
   * Gezeichnet wird der Boden UEBER dem Aussenboden und UNTER den Waenden:
   * So deckt er den Sand ab, und die Mauern liegen sauber darauf.
   */
  private drawBuildingFloors(state: WorldState): void {
    for (const house of state.buildings) {
      const sprite = this.scene.add
        .tileSprite(
          house.x,
          house.y,
          house.width,
          house.height,
          SHEET_KEY,
          BUILDING_FLOOR_TILE,
        )
        .setOrigin(0)
        .setTileScale(WORLD_SCALE, WORLD_SCALE)
        .setDepth(DEPTH.floor + 2);

      this.addCullable(sprite, house);
    }
  }

  /** Beruehrt dieses Rechteck den Rand der Welt? Dann ist es Aussenmauer. */
  private touchesBorder(wall: Rect, state: WorldState): boolean {
    return (
      wall.x <= state.bounds.x ||
      wall.y <= state.bounds.y ||
      wall.x + wall.width >= state.bounds.x + state.bounds.width ||
      wall.y + wall.height >= state.bounds.y + state.bounds.height
    );
  }

  /**
   * Buesche liegen UEBER den Figuren: Wer drinsteht, ist halb verdeckt - genau
   * das ist ja der Sinn eines Verstecks.
   *
   * Warum GRAS und nicht die Buschkacheln des Pakets, steht bei `BUSH_TILE` in
   * `config/assets.ts` - die sind Viertelstuecke und decken einzeln nur 54 %.
   */
  private drawBushes(state: WorldState): void {
    for (const bush of state.bushes) {
      const sprite = this.scene.add
        .tileSprite(bush.x, bush.y, bush.width, bush.height, SHEET_KEY, BUSH_TILE)
        .setOrigin(0)
        .setTileScale(WORLD_SCALE, WORLD_SCALE)
        // Leicht durchscheinend: Man soll erkennen, dass da jemand drin steht,
        // ohne ihn genau zu sehen.
        .setAlpha(0.85)
        .setDepth(DEPTH.bushesAbove);

      this.addCullable(sprite, bush);
    }
  }

  private addCullable(object: Phaser.GameObjects.TileSprite, rect: Rect): void {
    this.parts.push(object);
    this.cullable.push({ object, rect });
  }
}
