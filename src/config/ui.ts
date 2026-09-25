/**
 * ALLE Grafiken der Bedienoberflaeche an einer Stelle: Knoepfe, Panels,
 * Balken aus dem Kenney "UI Pack RPG" (CC0, `public/Spritesheet/`).
 *
 * Wie `config/assets.ts` fuer das Pixel-Sheet und `config/models.ts` fuer die
 * 3D-Modelle: Im Spielcode steht nur `UI.button.primary`, nie ein Dateiname.
 * Wer das Paket tauscht, aendert diese Datei und sonst nichts.
 *
 * ================================================================
 * EIN ATLAS, NICHT 87 EINZELDATEIEN
 * ================================================================
 *
 * Anders als das Pixel-Sheet bringt dieses Paket eine KOORDINATENDATEI mit
 * (`uipack_rpg_sheet.xml`, Format "Starling/Sparrow"). Phaser liest sie mit
 * `load.atlasXML`: ein Bild, eine Datei mit Namen und Rechtecken, danach ist
 * jedes Teil ueber seinen Namen abrufbar ("buttonLong_brown.png"). Ein Bild
 * statt 87 heisst ein Download und eine Textur.
 *
 * ================================================================
 * NEUNERTEILUNG (9-SLICE)
 * ================================================================
 *
 * Ein Knopf ist 190 x 49 Pixel gross, gebraucht werden aber Knoepfe von
 * 80 x 30 bis 300 x 56. Einfach strecken hiesse: Die Ecken und der Rand werden
 * mitgestreckt und sehen verzerrt aus. Bei der Neunerteilung wird das Bild in
 * drei mal drei Stuecke geschnitten - Ecken bleiben, wie sie sind, Kanten
 * strecken sich nur in eine Richtung, die Mitte in beide.
 *
 * Die Zahlen unten (`slice`) sagen, wie breit der Rand ist, der NICHT
 * gestreckt werden darf - abgelesen an den Pixeln der Bilder, nicht
 * geschaetzt: Panels haben 4 px Rahmen plus Zierkerben bis 10 px, Knoepfe
 * einen 4-px-Rahmen und unten zusaetzlich 4 px "Lippe" (der Schatten, der den
 * Knopf erhaben wirken laesst).
 *
 * Phasers eigenes `NineSlice` scheidet aus: Es zeichnet nur mit WebGL, und in
 * der 3D-Ansicht laeuft Phaser mit dem Canvas-Renderer (ein WebGL-Kontext
 * gehoert der Welt, siehe CLAUDE.md "3D-Umbau"). Deshalb `ui/UiNineSlice.ts`.
 *
 * ================================================================
 * KEINE SCHRIFT IM PAKET
 * ================================================================
 *
 * Das Paket enthaelt keine Schriftdatei (gesucht nach .ttf/.otf/.woff/.fnt).
 * Die Schrift bleibt deshalb `system-ui` - gesetzt an EINER Stelle
 * (`UI.font`), damit ein nachgeliefertes Paket ein Tausch hier ist.
 */

/** Schluessel des Atlas in Phasers Texturverwaltung. */
export const UI_ATLAS = "ui-rpg";

/**
 * Pfade. `BASE_URL`, weil das Spiel auf GitHub Pages unter `/Holdout/` liegt
 * - ein Pfad mit fuehrendem `/` zeigte dort ins Leere (CLAUDE.md, "Pixel Art").
 */
export const UI_ATLAS_IMAGE = `${import.meta.env.BASE_URL}Spritesheet/uipack_rpg_sheet.png`;
export const UI_ATLAS_XML = `${import.meta.env.BASE_URL}Spritesheet/uipack_rpg_sheet.xml`;

/** Randbreiten einer Neunerteilung in Pixeln des Bildes. */
export interface SliceInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Ein Knopf: Ruhe- und Druckbild, Randbreiten, Schriftfarbe. */
export interface ButtonLook {
  frame: string;
  pressed: string;
  slice: SliceInsets;
  /** Die gedrueckte Fassung hat keine Lippe - andere Randbreite unten. */
  pressedSlice: SliceInsets;
  /** Wie weit die Beschriftung beim Druecken nach unten rutscht. */
  pressOffset: number;
  textColor: string;
}

const BUTTON_SLICE: SliceInsets = { left: 8, right: 8, top: 6, bottom: 10 };
const BUTTON_PRESSED_SLICE: SliceInsets = { left: 8, right: 8, top: 6, bottom: 6 };

export const UI = {
  /** Schriftfamilie fuer alles Gezeichnete - kein Paket, also Systemschrift. */
  font: "system-ui, sans-serif",

  button: {
    /**
     * Hauptknoepfe ("Run starten", "Weiter"): hell, dunkle Schrift. Hell
     * hebt sich auf dem dunklen Hintergrund und auf dem Sand am meisten ab -
     * der Knopf, den man als naechstes druecken soll, faellt zuerst auf.
     */
    primary: {
      frame: "buttonLong_beige.png",
      pressed: "buttonLong_beige_pressed.png",
      slice: BUTTON_SLICE,
      pressedSlice: BUTTON_PRESSED_SLICE,
      pressOffset: 2,
      textColor: "#3b2a1a",
    } satisfies ButtonLook,
    /** Nebenknoepfe ("Zurück", Pause/Ton/Rucksack im HUD): dunkler, heller Text. */
    secondary: {
      frame: "buttonLong_brown.png",
      pressed: "buttonLong_brown_pressed.png",
      slice: BUTTON_SLICE,
      pressedSlice: BUTTON_PRESSED_SLICE,
      pressOffset: 2,
      textColor: "#f6ead2",
    } satisfies ButtonLook,
  },

  /**
   * Schriftfarben ausserhalb des Gefechts (Menue, Lobby, Ergebnis, Packen,
   * Karte). Warm statt des frueheren Blaugraus - passend zu Holz und Sand der
   * Welt und zu den Paket-Tafeln (Rueckmeldung 2026-09-25: "passt so gar
   * nicht zum In-Game").
   */
  text: {
    title: "#fff4dc",
    body: "#f6ead2",
    muted: "#d9c7a3",
    accent: "#ffd166",
    /** Auf hellen Flaechen (beige Einlage). */
    dark: "#3b2a1a",
    shadow: "#00000088",
  },

  /** Einlage auf einer Tafel: Raumcode, Spielerliste, Portraet. */
  inset: {
    frame: "panelInset_beige.png",
    slice: { left: 8, right: 8, top: 8, bottom: 8 } satisfies SliceInsets,
  },

  panel: {
    /** Rahmen um Rucksack und Lager, Fenster im Run. */
    frame: "panel_brown.png",
    slice: { left: 10, right: 10, top: 10, bottom: 10 } satisfies SliceInsets,
    /** Zellen im Gitter: vertieft, dunkler als der Rahmen. */
    cellColor: 0x5b4128,
    cellAlpha: 1,
  },

  /**
   * Balken: je ein linkes Endstueck, ein streckbares Mittelstueck und ein
   * rechtes Endstueck (Dreierteilung - die Hoehe bleibt, nur die Breite
   * waechst). Der Hintergrund (`back`) ist halbdurchsichtig schwarz, die
   * Fuellungen liegen passgenau darauf.
   */
  bar: {
    back: bar("barBack", "horizontalMid"),
    green: bar("barGreen", "horizontalMid"),
    red: bar("barRed", "horizontalMid"),
    yellow: bar("barYellow", "horizontalMid"),
    // Im Paket heisst das blaue Mittelstueck tatsaechlich "horizontalBlue" -
    // ein Tippfehler bei Kenney, den man hier ausbuegeln muss.
    blue: bar("barBlue", "horizontalBlue"),
    /** Breite der Endstuecke und Hoehe im Bild (Pixel). */
    capWidth: 9,
    height: 18,
  },
} as const;

export interface BarLook {
  left: string;
  mid: string;
  right: string;
}

function bar(prefix: string, mid: string): BarLook {
  return {
    left: `${prefix}_horizontalLeft.png`,
    mid: `${prefix}_${mid}.png`,
    right: `${prefix}_horizontalRight.png`,
  };
}
