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
  BIG_BUSH_TILES,
  BUILDING_FLOOR_TILE,
  BUSH_TILE,
  ENEMY_TILES,
  EXTRACTION_PAD_TILES,
  FLOOR_TILES,
  SPRITE_BODY_RADIUS,
  TILE,
  SHEET_KEY,
  WORLD_SCALE,
  wallFrame,
} from "../config/assets";
import type { WallMaterial } from "../config/assets";
import { ENCOUNTERS, ENEMIES } from "../config/balance";
import { COLORS, DEPTH } from "../config/constants";
import type { Rect, WorldState } from "../systems/types";
import { joinedWallCells, wallPieces } from "./wallPieces";

/** Kantenlaenge einer Kachel in der Welt. */
const TILE_SIZE = TILE * WORLD_SCALE;

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
  object: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image;
  rect: Rect;
}

export class ArenaRenderer {
  /** Alles, was beim Verlassen der Szene wieder wegmuss. */
  private readonly parts: Phaser.GameObjects.GameObject[] = [];

  /** Was nach Kamerasicht ein- und ausgeblendet wird. */
  private readonly cullable: CullablePart[] = [];

  /** Die Ringe von Encounter- und Ausstiegszonen, je Bild neu gezeichnet. */
  private readonly markers: Phaser.GameObjects.Graphics;

  /**
   * Der schlafende Boss je Encounter - gleicher Index wie `state.encounters`.
   *
   * Solange niemand den Ring betritt, gibt es den Boss in der Simulation noch
   * gar nicht (warum, steht oben in `systems/encounters.ts`). Gezeichnet wird
   * er trotzdem: Man soll sehen, WAS dort wartet, bevor man sich entscheidet
   * hineinzugehen. Beim Erwachen verschwindet dieses Bild, und an derselben
   * Stelle steht der echte Gegner aus `EntityRenderer`.
   */
  private readonly sleepers: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly state: WorldState,
  ) {
    // UNTER den Figuren, aber ueber dem Boden: Die Ringe liegen auf dem Boden
    // und duerfen niemanden verdecken, den man gerade bekaempft.
    this.markers = scene.add.graphics().setDepth(DEPTH.floor + 1);
    this.parts.push(this.markers);

    this.drawFloor(state);
    this.drawBuildingFloors(state);
    this.drawWalls(state);
    this.drawBushes(state);
    this.drawExtractionPads(state);
    this.createSleepers(state);
    this.update();
  }

  destroy(): void {
    for (const part of this.parts) {
      part.destroy();
    }
    this.parts.length = 0;
    this.cullable.length = 0;
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

    this.state.encounters.forEach((spot, index) => {
      const { x, y } = spot.position;
      // Der Ende-Boss bekommt einen groesseren Ring - man soll von weitem
      // sehen, dass dort etwas anderes wartet als an den acht davor.
      // Genau der Radius, bei dem der Boss erwacht. Wer den Ring ueberschreitet,
      // hat sich entschieden - vorher passiert nichts.
      const radius = ENCOUNTERS.triggerRadius * (spot.isFinal ? 1.35 : 1);
      const inView = visible(x, y, radius);
      this.sleepers[index]?.setVisible(inView && spot.status === "sleeping");
      if (!inView) {
        return;
      }

      const cleared = spot.status === "cleared";

      /*
       * ================================================================
       * DAS WAR DIE "GRELLE PINKE LINIE QUER UEBER DEN BILDSCHIRM"
       * ================================================================
       *
       * Vorher: durchgezogen, 4 Pixel, in 0xff5470, dazu eine leichte
       * Fuellung. Der Ring hat 420 Pixel Radius (Ende-Boss 567) - bei Zoom
       * 0,8 ist das mehr als die halbe Bildhoehe. Im Bild war also nie ein
       * Kreis zu sehen, sondern ein pinker Bogen, der das ganze Bild
       * durchschnitt.
       *
       * Jetzt: GESTRICHELT, 2 Pixel, im Warnton #E4572E aus der Palette, ohne
       * Fuellung. Eine gestrichelte Linie liest man als Grenze, nicht als
       * Objekt - genau das ist der Ring: die Stelle, ab der der Boss erwacht.
       *
       * Der Radius bleibt EXAKT der Ausloeseradius. Eine dezentere Linie ist
       * gut, eine, die woanders liegt als die Wirkung, waere schlimmer als gar
       * keine.
       */
      strokeDashedCircle(
        this.markers,
        x,
        y,
        radius,
        2,
        COLORS.danger,
        cleared ? 0.25 : 0.8,
      );
    });

    /*
     * Die Ausstiegszonen: ueber dem Teppich aus dem Sheet
     * (`drawExtractionPads`) liegen zwei Ringe.
     *
     *   1. Die GRENZE, genau auf dem Radius, der zaehlt. Der Teppich ist
     *      quadratisch und liegt innerhalb des Kreises - wer am Rand des
     *      Kreises steht, ist schon drin, auch wenn er neben dem Teppich
     *      steht. Der Ring sagt, wo es wirklich anfaengt.
     *   2. Der LEUCHT-PULS: ein Ring, der ueber den Kreis hinaus nach aussen
     *      laeuft und verblasst. Bewegung faellt im Augenwinkel auf, eine
     *      ruhende Flaeche nicht - so ist die Zone schon zu erkennen, wenn nur
     *      ihr Rand ins Bild ragt.
     *
     * Bis 2026-09-24 waren es gefuellte Kreise (Hof, Zone). Die sind
     * weggefallen: Farbflaechen sind im fertigen Spiel nicht mehr erlaubt, und
     * der Teppich erfuellt ihren Zweck besser - er sieht aus wie ein Ort, nicht
     * wie eine Markierung.
     *
     * Der Puls laeuft ueber die Weltzeit und nicht ueber einen eigenen
     * Zaehler: So pulsieren alle Zonen im Gleichtakt, und im Koop sehen alle
     * Geraete dasselbe.
     */
    const pulse = (this.scene.time.now % 1600) / 1600;

    for (const zone of this.state.extractions) {
      const { x, y } = zone.position;
      const glowReach = zone.radius * 1.6;
      if (!visible(x, y, glowReach)) {
        continue;
      }

      this.markers.lineStyle(4, COLORS.mate, 0.95);
      this.markers.strokeCircle(x, y, zone.radius);

      // Zwei Pulse im Abstand einer halben Periode: Einer allein laesst eine
      // Luecke, in der gar nichts leuchtet.
      for (const phase of [pulse, (pulse + 0.5) % 1]) {
        const radius = zone.radius * (0.35 + 1.25 * phase);
        this.markers.lineStyle(6 - 4 * phase, COLORS.mate, 0.7 * (1 - phase));
        this.markers.strokeCircle(x, y, radius);
      }
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
    // Gebaeudewaende gesammelt, weil ihre Ecken von den Nachbarn abhaengen
    // (`joinedWallCells`). Alles andere steht fuer sich.
    const buildingWalls: Rect[] = [];

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
      const material: WallMaterial = outer ? "outer" : inBuilding ? "building" : "cover";
      if (inBuilding) {
        buildingWalls.push(wall);
        continue;
      }

      /*
       * Jede Wand aus Stuecken: Ecken, Kanten, Endkappen (`wallPieces`).
       * Ein Stueck von genau einer Kachel wird ein einfaches Bild, nur was
       * sich wiederholt, ein `tileSprite` - ein `tileSprite` ist teurer, und
       * es gibt jetzt drei- bis neunmal so viele Teile wie Waende.
       */
      for (const piece of wallPieces(wall, TILE_SIZE)) {
        const frame = wallFrame(material, piece.role);
        const single =
          Math.abs(piece.width - TILE_SIZE) < 0.5 && Math.abs(piece.height - TILE_SIZE) < 0.5;
        const sprite = single
          ? this.scene.add
              .image(piece.x, piece.y, SHEET_KEY, frame)
              .setOrigin(0)
              .setScale(WORLD_SCALE)
              .setDepth(DEPTH.walls)
          : this.scene.add
              .tileSprite(piece.x, piece.y, piece.width, piece.height, SHEET_KEY, frame)
              .setOrigin(0)
              .setTileScale(WORLD_SCALE, WORLD_SCALE)
              .setDepth(DEPTH.walls);
        this.addCullable(sprite, piece);
      }
    }

    for (const cell of joinedWallCells(buildingWalls, TILE_SIZE)) {
      const sprite = this.scene.add
        .image(cell.x, cell.y, SHEET_KEY, wallFrame("building", cell.role))
        .setOrigin(0)
        .setScale(WORLD_SCALE)
        .setDepth(DEPTH.walls);
      this.addCullable(sprite, cell);
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

  /**
   * Der Landeplatz jeder Ausstiegszone, aus neun Teilen des Sheets.
   *
   * Die Seitenlaenge ist ein ganzes Vielfaches der Kachel und so gewaehlt,
   * dass auch die Ecken noch im Kreis liegen (Diagonale <= Durchmesser).
   * Sonst stuende man auf dem Teppich und waere trotzdem nicht in der Zone.
   */
  private drawExtractionPads(state: WorldState): void {
    const size = TILE * WORLD_SCALE;

    for (const zone of state.extractions) {
      const tiles = Math.max(3, Math.floor((zone.radius * Math.SQRT2) / size));
      const side = tiles * size;
      const left = zone.position.x - side / 2;
      const top = zone.position.y - side / 2;
      const inner = side - size * 2;

      // Spalten und Zeilen der Neunerteilung: Rand, Mitte, Rand.
      const spans = [
        { offset: 0, length: size },
        { offset: size, length: inner },
        { offset: size + inner, length: size },
      ];

      spans.forEach((row, rowIndex) => {
        spans.forEach((column, columnIndex) => {
          const frame = EXTRACTION_PAD_TILES[rowIndex * 3 + columnIndex];
          if (frame === undefined || row.length <= 0 || column.length <= 0) {
            return;
          }
          const rect = {
            x: left + column.offset,
            y: top + row.offset,
            width: column.length,
            height: row.length,
          };
          const sprite = this.scene.add
            .tileSprite(rect.x, rect.y, rect.width, rect.height, SHEET_KEY, frame)
            .setOrigin(0)
            .setTileScale(WORLD_SCALE, WORLD_SCALE)
            .setDepth(DEPTH.floor + 0.5);
          this.addCullable(sprite, rect);
        });
      });
    }
  }

  /**
   * Die schlafenden Bosse. Groesse genau wie beim echten Gegner
   * (`createEnemy`: Ende-Boss doppelt so gross), leicht abgedunkelt - er
   * schlaeft. Ein Sprite aus dem Sheet, kein Platzhalter.
   */
  private createSleepers(state: WorldState): void {
    for (const spot of state.encounters) {
      const radius = ENEMIES.boss.radius * (spot.isFinal ? 2 : 1);
      const sprite = this.scene.add
        .image(spot.position.x, spot.position.y, SHEET_KEY, ENEMY_TILES.boss)
        .setScale(radius / SPRITE_BODY_RADIUS)
        .setRotation(Math.PI / 2)
        .setTint(0x9a9a9a)
        .setDepth(DEPTH.enemies)
        .setVisible(false);
      this.sleepers.push(sprite);
      this.parts.push(sprite);
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
      this.decorateBush(bush);
    }
  }

  /**
   * Runde Buesche aus dem Sheet auf dem Gras - je 2 x 2 Kacheln einer, aber
   * nicht ueberall: Welche Stelle einen bekommt, entscheidet ein Hash der
   * Lage. Kein Zufall aus der Simulation - die Darstellung darf deren
   * Zufallsstrom nicht anfassen, sonst liefen Host und Client auseinander.
   * Der Hash ergibt auf jedem Geraet dasselbe Bild, ohne etwas zu ziehen.
   */
  private decorateBush(bush: Rect): void {
    const big = TILE_SIZE * 2;
    for (let y = bush.y; y + big <= bush.y + bush.height + 0.5; y += big) {
      for (let x = bush.x; x + big <= bush.x + bush.width + 0.5; x += big) {
        if (positionHash(x, y) % 3 === 0) {
          continue;
        }
        BIG_BUSH_TILES.forEach((frame, index) => {
          const px = x + (index % 2) * TILE_SIZE;
          const py = y + Math.floor(index / 2) * TILE_SIZE;
          const sprite = this.scene.add
            .image(px, py, SHEET_KEY, frame)
            .setOrigin(0)
            .setScale(WORLD_SCALE)
            .setAlpha(0.9)
            .setDepth(DEPTH.bushesAbove + 1);
          this.addCullable(sprite, { x: px, y: py, width: TILE_SIZE, height: TILE_SIZE });
        });
      }
    }
  }

  private addCullable(
    object: Phaser.GameObjects.TileSprite | Phaser.GameObjects.Image,
    rect: Rect,
  ): void {
    this.parts.push(object);
    this.cullable.push({ object, rect });
  }
}

/**
 * Ein gestrichelter Kreis.
 *
 * Phaser kann Linien nicht selbst stricheln, also wird der Umfang in kurze
 * Bogenstuecke zerlegt. Die Zahl der Striche haengt am Umfang, nicht an einer
 * festen Anzahl: Sonst waeren die Striche am grossen Ende-Boss-Ring dreimal so
 * lang wie am kleinen, und die beiden saehen nicht mehr aus wie dieselbe Art
 * Grenze.
 *
 * Strich 22, Luecke 14 Weltpixel - bei Zoom 0,8 rund 18 und 11 Bildpunkte:
 * lang genug, um als Linie gelesen zu werden, kurz genug, um nie wie eine
 * durchgezogene zu wirken.
 */
function strokeDashedCircle(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  width: number,
  color: number,
  alpha: number,
): void {
  const dash = 22;
  const gap = 14;
  const circumference = 2 * Math.PI * radius;
  const count = Math.max(8, Math.floor(circumference / (dash + gap)));
  const step = (Math.PI * 2) / count;
  const dashAngle = step * (dash / (dash + gap));

  graphics.lineStyle(width, color, alpha);
  for (let i = 0; i < count; i += 1) {
    const start = i * step;
    graphics.beginPath();
    graphics.arc(x, y, radius, start, start + dashAngle, false);
    graphics.strokePath();
  }
}

/** Eine feste Zahl aus einer Weltposition - gleich auf jedem Geraet. */
function positionHash(x: number, y: number): number {
  let h = (Math.round(x) * 73856093) ^ (Math.round(y) * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}
