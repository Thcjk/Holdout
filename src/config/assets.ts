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
 * NUR NAHTLOSE KACHELN FUER FLAECHEN - DAS IST KEINE GESCHMACKSFRAGE
 * ================================================================
 *
 * Hier stand vorher eine gerahmte Holzkiste, und daraus wurde ein sichtbarer
 * Fehler: Neben jedem Deckungsblock lief ein duenner senkrechter Streifen.
 *
 * Die Ursache ist Arithmetik, kein Bluten aus dem Sheet. Ein Deckungsblock ist
 * 60 Pixel breit, eine Kachel erscheint mit 48 (16 x WORLD_SCALE):
 *
 *   60 / 48 = 1,25   ->   die letzte Kachel wird bei einem Viertel abgeschnitten
 *
 * Bei einer Kachel MIT RAHMEN sieht man diesen Schnitt sofort - der Rahmen ist
 * plötzlich weg und man blickt auf das nackte Innere. Bei einer NAHTLOSEN
 * Kachel faellt derselbe Schnitt gar nicht auf, weil ueberall dasselbe Muster
 * liegt.
 *
 * Die Bloecke einfach auf ein Vielfaches von 48 zu bringen waere der falsche
 * Weg: Das sind Spielwerte, die Kollision und Balance bestimmen, und die
 * wurden gemessen. Optik ist kein Grund, daran zu drehen.
 *
 * Was den Bloecken ihre Form gibt, ist deshalb ein GEZEICHNETER UMRISS
 * (`ArenaRenderer`) - eine Linie, die immer genau auf der Kollisionskante
 * liegt, unabhaengig davon, wo die Kachel gerade endet.
 */

/** Aussenmauer: kuehler Stein - hebt sich bewusst vom warmen Sandboden ab. */
export const WALL_TILE = tile(8, 0);

/** Deckungsbloecke: rote Ziegel, nahtlos. Klar anders als Boden und Mauer. */
export const COVER_TILE = tile(14, 2);

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
 * ================================================================
 * MUSIK
 * ================================================================
 *
 * Zwei Stuecke, vom Nutzer geliefert. Die Zuordnung ist Absicht:
 *
 *   Menue   ruhig und freundlich - man waehlt in Ruhe aus.
 *   Welle   getragen und angespannt - es geht los.
 *
 * WICHTIG FUERS SPIELGEFUEHL: In der Pause ZWISCHEN den Wellen laeuft
 * absichtlich NICHTS. Die Stille ist das Signal - wenn die Musik wieder
 * einsetzt, beginnt die naechste Welle. Das hoert man auch dann, wenn man
 * gerade nicht auf den Bildschirm schaut.
 */
export const MUSIC_MENU = `${import.meta.env.BASE_URL}assets/audio/menu.ogg`;
export const MUSIC_WAVE = `${import.meta.env.BASE_URL}assets/audio/wave.ogg`;
