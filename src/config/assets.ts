/**
 * Alle Sprites an einer Stelle.
 *
 * Grundlage ist "Topdown Shooter Pixel" von Kenney (CC0, siehe
 * `public/assets/License.txt`). Im Spielcode steht nur `CHARACTER_TILES.scout`
 * - nie eine Zahl, nie eine Koordinate. Wer das Grafikpaket wechselt, aendert
 * diese Datei und sonst nichts.
 *
 * ================================================================
 * WARUM SPRITESHEET UND NICHT ATLAS
 * ================================================================
 *
 * Ein "Atlas" ist ein Bild PLUS eine Datei, die sagt, welcher Ausschnitt wie
 * heisst ("player_blue" liegt bei x=476, y=17). Das waere bequem - dieses
 * Paket bringt aber KEINE solche Datei mit. Im Ordner liegen nur die Lizenz,
 * zwei Vorschaubilder und die beiden Sheets.
 *
 * Also ein "Spritesheet": ein gleichmaessiges Raster, bei dem jeder Ausschnitt
 * nur eine Nummer hat. Das Raster wurde nachgerechnet, es geht genau auf:
 *
 *   577 = 34 * (16 + 1) - 1     339 = 20 * (16 + 1) - 1
 *
 * Also 16x16 Pixel je Kachel, 1 Pixel Abstand dazwischen, kein Rand aussen -
 * zusammen 34 x 20 = 680 Kacheln. Phaser nummeriert sie zeilenweise von links
 * oben; `tile(spalte, reihe)` rechnet das um, damit unten Koordinaten stehen
 * koennen statt Nummern wie 64.
 */

import type { WallPieceRole } from "../render/wallPieces";
import type { CharacterId, EnemyType } from "../systems/types";

/** Schluessel, unter dem Phaser das Sheet fuehrt. */
export const SHEET_KEY = "topdown-pixel";

/**
 * Pfad zum Sheet.
 *
 * `BASE_URL` MUSS davor: Auf GitHub Pages liegt das Spiel unter `/Holdout/`,
 * und ein Pfad, der mit `/assets/...` beginnt, zeigte dort ins Leere. Genau
 * dieser Fehler hat das Projekt schon einmal lahmgelegt (siehe CLAUDE.md,
 * "Umbenennen bricht den Basispfad") - er soll sich nicht wiederholen.
 *
 * Genommen wird `tilesheet_transparent.png`, NICHT `tilesheet_magenta.png`:
 * Letzteres hat einen rosa Hintergrund statt eines durchsichtigen, was im
 * Spiel als rosa Kasten um jede Figur sichtbar waere.
 */
export const SHEET_PATH = `${import.meta.env.BASE_URL}assets/Tilesheet/tilesheet_transparent.png`;

/** Kantenlaenge einer Kachel in Pixeln. */
export const TILE = 16;
/** Abstand zwischen zwei Kacheln. */
export const SPACING = 1;
/** Kacheln je Zeile - der Umrechnungsfaktor fuer `tile()`. */
export const COLUMNS = 34;

/** Rechnet Spalte und Reihe in die Kachelnummer um, die Phaser benutzt. */
export function tile(column: number, row: number): number {
  return row * COLUMNS + column;
}

/**
 * Halbe Koerperhoehe einer Figur, in Kachelpixeln.
 *
 * GEMESSEN, nicht geschaetzt: Bei allen Figuren des Pakets belegt der Koerper
 * senkrecht genau die Pixel 2 bis 13, also 12 Pixel. Die Breite schwankt (8
 * Pixel ohne Waffe, bis 15 mit langem Lauf) und taugt deshalb nicht als Mass.
 *
 * Der Spielcode skaliert jedes Sprite mit `radius / SPRITE_BODY_RADIUS`. Damit
 * entspricht die HOEHE der Figur genau dem Durchmesser des Trefferkreises -
 * was man sieht, ist also auch das, was getroffen wird. Fuer Spieler und
 * Schuetze (Radius 18) ergibt das glatt Faktor 3.
 */
export const SPRITE_BODY_RADIUS = 6;

/**
 * Wie stark Kacheln in der Welt vergroessert werden.
 *
 * DAS MUSS ZUR FIGURENGROESSE PASSEN, sonst sieht es falsch aus - und das war
 * beim ersten Versuch auch so: Die Figuren werden mit `radius /
 * SPRITE_BODY_RADIUS` skaliert, beim Spieler also 18/6 = DREIFACH. Boden,
 * Kisten und Buesche wurden dagegen 1:1 gezeichnet, mit 16 Pixeln je Kachel.
 * Ergebnis: Ein Buschfeld von 180 x 140 Pixeln bestand aus rund hundert
 * Miniaturstraeuchern und sah aus wie gemusterte Tapete, und die Figur war
 * mehr als doppelt so gross wie eine Bodenkachel.
 *
 * In der Vorlage von Kenney ist eine Figur etwa eine Kachel gross. Damit das
 * Verhaeltnis stimmt, muss die Welt denselben Faktor bekommen wie die Figuren.
 * Ganzzahlig, weil bei Pixel-Art krumme Faktoren flimmern.
 */
export const WORLD_SCALE = 3;


/**
 * Die drei Charaktere.
 *
 * Auf dem Sheet ist die SPALTE die Waffe und die REIHE das Outfit. Beides wird
 * genutzt, damit sich die drei auch im Getuemmel auf einen Blick trennen
 * lassen - Farbe allein reicht bei 16 Pixeln nicht.
 */
export const CHARACTER_TILES: Record<CharacterId, number> = {
  /** Blau, kurze Waffe - der Leichte und Schnelle. */
  scout: tile(30, 1),
  /** Orange, grosse quer gehaltene Waffe - wirkt am breitesten. */
  tank: tile(32, 2),
  /** Gruen, laengster Lauf - auf 16 Pixeln sofort als Distanzwaffe erkennbar. */
  sniper: tile(33, 3),
};

/**
 * Die drei Gegnertypen.
 *
 * WICHTIG ZU WISSEN: Das Paket enthaelt KEINE Monster. Alle 96 Figuren sind
 * derselbe Mensch in anderer Kleidung - keine Zombies, keine Kreaturen, keine
 * Groessenvarianten. Unterschieden wird deshalb ueber Farbe, Bewaffnung und
 * Groesse (die Skalierung kommt aus dem Trefferradius).
 *
 * Die Bewaffnung traegt dabei die Bedeutung: Wer keine Waffe hat, macht
 * Beruehrungsschaden und muss zu einem hin; wer eine hat, schiesst aus der
 * Ferne. Das ist auf einen Blick lesbar, ohne Erklaerung.
 */
export const ENEMY_TILES: Record<EnemyType, number> = {
  /** Braun-gruen gefleckt, ohne Waffe - wirkt verwildert, kommt im Nahkampf. */
  runner: tile(28, 7),
  /** Dunkel mit Gruen, Arme vor - hochskaliert der Brocken (Radius 28). */
  brute: tile(29, 15),
  /** Tarnfarben mit Gewehr - der einzige Gegner mit Waffe. */
  shooter: tile(31, 6),
  /**
   * Der Waechter: violett, schwerste Waffe.
   *
   * GEMESSEN STATT GERATEN, und beim ersten Versuch danebengegriffen: Dort
   * stand `tile(30, 16)`. Reihe 16 enthaelt aber keine Figuren, sondern Moebel
   * - im Spiel war der Boss ein dunkler Klotz. Die Figuren liegen
   * ausschliesslich in den SPALTEN 28 bis 33 und den REIHEN 0 bis 15.
   *
   * Violett, weil es die einzige Farbe im Paket ist, die weder ein Spieler
   * (blau, orange, gruen) noch ein Gegner (braun-gruen, tarnfarben, dunkel)
   * schon belegt. Bei 16 Pixeln und einem Dutzend Figuren im Bild ist die
   * Farbe das Erste, was man liest - ein Boss, der aussieht wie ein Laeufer,
   * geht darin unter. Spalte 32 traegt die breiteste Waffe.
   */
  boss: tile(32, 4),
};

/**
 * Bodenkacheln: warmer Sand.
 *
 * Vorher heller Stein - der war zu kuehl und blaeulich, das Spielfeld wirkte
 * kalt. Sand ist warm und ruhig: Er hat kein starkes Muster, das mit den
 * Figuren um Aufmerksamkeit kaempft.
 *
 * Gras kommt weiterhin NICHT als Boden in Frage: Gruen hat im Spiel eine feste
 * Bedeutung - "hier kann man sich verstecken" (siehe `BUSH_TILE`). Waere auch
 * der Boden gruen, ginge genau diese Bedeutung verloren.
 */
export const FLOOR_TILES: readonly number[] = [tile(4, 0), tile(5, 0)];

/**
 * ================================================================
 * WAENDE AUS STUECKEN - Ecken, Kanten, Endkappen (seit Etappe 5)
 * ================================================================
 *
 * Bis 2026-09-24 war jede Wand eine wiederholte nahtlose Kachel (Stein oder
 * Ziegel) mit einem gezeichneten Umriss. Der Umriss war die Loesung dafuer,
 * dass 60 px breite Bloecke die 48-px-Kachel anschnitten. Das Arbeitsdokument
 * verlangt aber Waende mit Ecken und Endstuecken - und das Paket hat sie: die
 * dunklen Bloecke mit farbigem Rand, mit denen Kenney im Beispielbild
 * (`public/assets/Sample.png`) seine Haeuser baut.
 *
 * Dafuer liegt jetzt jede Wand auf dem Kachelraster (`WORLD.grid`), und die
 * Zerlegung in Stuecke steht in `render/wallPieces.ts`. Der gezeichnete
 * Umriss ist weg - der Rand ist jetzt Teil der Kachel.
 *
 * Das Paket hat denselben Satz Stuecke dreimal, in drei Farben und immer im
 * selben Aufbau. Gemessen (Ausschnitt achtfach vergroessert angesehen):
 *
 *   orange  Spalten 0-8,  Reihen 4-9    -> Gebaeudewaende (wie im Beispielbild)
 *   braun   Spalten 9-17, Reihen 4-9    -> Aussenmauer
 *   grau    Spalten 0-8,  Reihen 10-15  -> Deckungsbloecke
 *
 * Zuerst war es andersherum (braune Deckung). Im Emulator verschwand der
 * braune Rand fast im Sandboden - Deckung, die man nicht sieht, ist keine.
 * Der kuehle graue Rand hebt sich vom warmen Sand ab; an der Aussenmauer
 * stoert der geringe Kontrast nicht, hinter ihr steht nie jemand.
 *
 * Innerhalb eines Satzes (Koordinaten fuer Orange):
 *
 *   Einzelblock (6,7)
 *   duenn waagerecht:  Kappe links (6,5), Mitte (2,4), Kappe rechts (5,4)
 *   duenn senkrecht:   Kappe oben (5,5),  Mitte (2,5), Kappe unten (6,4)
 *   dick: Ecken (7,4) (8,4) (7,5) (8,5), Kanten oben (4,7) unten (5,7)
 *         links (4,6) rechts (5,6), Mitte (6,6)
 *   Ecken duenner Waende: (0,4) (1,4) (0,5) (1,5)
 */
const WALL_PIECE_COORDS: Record<WallPieceRole, [number, number]> = {
  single: [6, 7],
  hLeft: [6, 5],
  hMid: [2, 4],
  hRight: [5, 4],
  vTop: [5, 5],
  vMid: [2, 5],
  vBottom: [6, 4],
  topLeft: [7, 4],
  top: [4, 7],
  topRight: [8, 4],
  left: [4, 6],
  center: [6, 6],
  right: [5, 6],
  bottomLeft: [7, 5],
  bottom: [5, 7],
  bottomRight: [8, 5],
  // Ecken DUENNER Waende - dort, wo zwei Gebaeudewaende zusammenstossen.
  cornerTopLeft: [0, 4],
  cornerTopRight: [1, 4],
  cornerBottomLeft: [0, 5],
  cornerBottomRight: [1, 5],
};

export type WallMaterial = "building" | "cover" | "outer";

/** Versatz jedes Farbsatzes gegenueber dem orangen. */
const WALL_SET_OFFSET: Record<WallMaterial, [number, number]> = {
  building: [0, 0],
  cover: [0, 6],
  outer: [9, 0],
};

/** Die Kachel fuer ein Wandstueck in einem Material. */
export function wallFrame(material: WallMaterial, role: WallPieceRole): number {
  const [column, row] = WALL_PIECE_COORDS[role];
  const [dc, dr] = WALL_SET_OFFSET[material];
  return tile(column + dc, row + dr);
}

/**
 * ================================================================
 * GEBAEUDE - Innenboden und Wand
 * ================================================================
 *
 * Ein Gebaeude muss man auf den ersten Blick von einem Deckungsblock
 * unterscheiden koennen, sonst laeuft man daran vorbei wie an allem anderen.
 * Was das traegt, ist der BODEN, nicht die Wand: Eine dunkle Flaeche mitten im
 * hellen Sand sagt ohne Erklaerung "hier ist innen".
 *
 * Beide Kacheln sind gemessen und nicht geraten - dieselbe Lehre wie bei der
 * Boss-Kachel, die sich als Moebelstueck entpuppte:
 *
 *   tile(4,3)  256/256 deckend, RGB 74,74,74,  Naht 0,0 / 0,0
 *   tile(8,0)  256/256 deckend, RGB 155,190,192, Naht 0,0 / 0,8
 *   Sandboden  RGB 186,127,67 - der Abstand zum Innenboden ist maximal
 *
 * Die braunen Ziegel des Pakets (tile(14..19,1), RGB 192,131,69) waeren die
 * naheliegende Wahl fuer eine Hauswand gewesen und sind genau deshalb
 * verworfen: Sie liegen farblich zwischen Sandboden und Deckungsziegel - ein
 * Haus daraus verschwaende im Hintergrund.
 */

/** Innenboden eines Gebaeudes: gleichmaessiges Dunkelgrau, voellig nahtlos. */
export const BUILDING_FLOOR_TILE = tile(4, 3);

/**
 * Buschfelder: GRAS, nicht die Buschkacheln des Pakets.
 *
 * Das klingt verkehrt und ist gemessen. Die Buschkacheln (18,6) und (19,6)
 * sind VIERTELSTUECKE eines grossen Busches - sie sollen zu viert zu einem
 * Busch zusammengesetzt werden. Einzeln nebeneinander gekachelt decken sie nur
 * 54 % ihrer Flaeche ab, und dazwischen klaffen Luecken: Das Feld sah aus wie
 * eine Reihe einzelner Toepfe, nicht wie ein Versteck.
 *
 * Die Grasskacheln decken 100 % und wirken als Flaeche wie hohes Gras - genau
 * das Bild, das man aus Brawl Stars kennt und das ohne Erklaerung sagt: "Da
 * kann man drin verschwinden."
 */
export const BUSH_TILE = tile(0, 0);

/**
 * Der grosse runde Busch des Pakets - vier Viertelstuecke, zusammengesetzt
 * 32 x 32 Sheetpixel (96 in der Welt). Oben links, oben rechts, unten links,
 * unten rechts.
 *
 * Einzeln gekachelt taugen die Stuecke nicht als Flaeche (siehe oben, 54 %
 * Deckung). Als SCHMUCK auf dem Gras aber schon: Sie brechen die Kanten des
 * Buschfelds auf und geben ihm die Form, die man aus Kenneys Beispielbild
 * kennt. Die Versteck-Wirkung haengt weiter nur am Gras-Rechteck darunter.
 */
/**
 * Geschoss: das laengste der drei Projektile des Pakets (30,16), 8 x 3
 * Sheetpixel, liegt waagerecht nach rechts. Im Paket ist es dunkelgrau - auf
 * dem dunklen Hausboden unsichtbar, und Freund und Feind waeren nicht zu
 * unterscheiden. Es wird deshalb in der Palettenfarbe EINGEFAERBT
 * (`setTintFill`): Die Form kommt aus dem Sheet, die Farbe aus der Palette.
 */
export const BULLET_TILE = tile(30, 16);

/** Partikel: Truemmer beim Tod, weisse Splitter beim Treffer. */
export const PARTICLE_TILES = {
  debris: tile(19, 9),
  spark: tile(20, 10),
} as const;

/**
 * ================================================================
 * GEGENSTAENDE AM BODEN (seit Etappe 5)
 * ================================================================
 *
 * Vorher lag Beute als farbiges Rechteck da - eine Farbflaeche, die das
 * Arbeitsdokument fuer alles Sichtbare verbietet. Jetzt ein Sprite aus dem
 * Sheet, darunter nur noch ein duenner Ring in der Seltenheitsfarbe.
 *
 * Ausgesucht auf Sandhintergrund (Spalten 18-26, Reihen 4-11). EHRLICH:
 * Das Paket hat KEINE einzelnen Waffen - die Figuren halten sie nur in der
 * Hand. Waffen liegen deshalb als Kiste da (Messer- bzw. Werkzeugkiste), die
 * Seltenheit sagt der Ring. Wer ein Paket mit Waffen-Symbolen findet, ersetzt
 * nur diese vier Zeilen.
 */
export const ITEM_TILES: Record<string, number> = {
  scrap: tile(18, 9), // zwei graue Metallstuecke
  wire: tile(25, 5), // gebogenes Kabel
  cell: tile(19, 10), // orange Kapsel
  circuit: tile(23, 8), // gruene Platine
  core: tile(25, 4), // gruener Stein im orangen Rahmen
  bandage: tile(24, 7), // weisse Rolle
  medkit: tile(24, 4), // helle Schachtel
  ammoBox: tile(18, 11), // orange Kiste
  pistol: tile(23, 9), // Kiste mit Messer
  smg: tile(24, 9), // Kiste mit Messer und Munition
  rifle: tile(21, 10), // Werkzeug auf Brett
  railgun: tile(22, 10), // Teile und Kristalle
  pouch: tile(24, 4), // helle Schachtel - eine Tasche hat das Sheet nicht
};

export const BIG_BUSH_TILES: readonly number[] = [
  tile(18, 6),
  tile(19, 6),
  tile(18, 7),
  tile(19, 7),
];

/**
 * Der Landeplatz einer Ausstiegszone: ein gruener Teppich mit hellem Rand,
 * als Neunerteilung (Ecken, Kanten, Mitte) aus Spalte 21 bis 23, Reihe 13
 * bis 15.
 *
 * Gruen, weil Gruen im ganzen Spiel "sicher" heisst - dieselbe Farbe wie der
 * Kompasspfeil und die Minimap-Markierung. Aus dem Sheet und nicht als
 * gefuellter Kreis: Das Arbeitsdokument vom 2026-09-24 verbietet
 * Farbflaechen fuer alles, was im fertigen Spiel sichtbar ist.
 *
 * Reihenfolge: oben links, oben, oben rechts, links, Mitte, rechts, unten
 * links, unten, unten rechts.
 */
export const EXTRACTION_PAD_TILES: readonly number[] = [
  tile(21, 13), tile(22, 13), tile(23, 13),
  tile(21, 14), tile(22, 14), tile(23, 14),
  tile(21, 15), tile(22, 15), tile(23, 15),
];


/**
 * ================================================================
 * MUSIK
 * ================================================================
 *
 * Zwei Stuecke, vom Nutzer geliefert. Die Zuordnung hat er festgelegt:
 *
 *   Menue   Retro Mystic  - getragen, man waehlt in Ruhe aus.
 *   Gefecht Retro Comedy  - treibend, waehrend gekaempft wird.
 *
 * (Ich hatte sie zuerst andersherum eingebaut - das war eine Annahme von mir,
 * keine Vorgabe.)
 *
 * WICHTIG FUERS SPIELGEFUEHL: Der WECHSEL ist das Signal, nicht die Stille.
 * Ist kein Gegner in der Naehe, laeuft das ruhige Stueck leise; kommt einer
 * heran, setzt das treibende in voller Lautstaerke ein. Das hoert man auch
 * dann, wenn man gerade nicht auf den Bildschirm schaut - in einer offenen
 * Welt sogar, BEVOR man den Gegner sieht.
 *
 * Die Regel hing bis Phase 8 an der Rundenphase ("leise in der Pause zwischen
 * zwei Wellen"). Mit den Wellen ist dieser Ausloeser verschwunden; die Schwellen
 * stehen jetzt in `GameScene` (COMBAT_ENTER_RANGE und CALM_MUSIC_VOLUME).
 *
 * Der Unterschied muss hoerbar bleiben - deshalb ein ANDERES Stueck UND eine
 * andere Lautstaerke, nicht nur eins von beidem.
 */
export const MUSIC_MENU = `${import.meta.env.BASE_URL}assets/audio/menu.ogg`;
export const MUSIC_WAVE = `${import.meta.env.BASE_URL}assets/audio/wave.ogg`;
