/**
 * Technische Konstanten: Bildschirm, Arena, Zeittakt, Zeichenebenen, Farben.
 *
 * Abgrenzung zu `balance.ts`: Hier steht, wie das Spiel technisch aufgebaut ist.
 * Dort steht, wie es sich anfuehlt.
 */

/**
 * Notfallgroesse des Spielfelds.
 *
 * Seit Phase 8 entsteht die Welt pro Run aus einem Seed, und ihre echte Groesse
 * steht in `WORLD.size` (`config/balance.ts`) beziehungsweise im Weltzustand
 * unter `bounds`. Diese Konstante bleibt nur als Rueckfall fuer Code, der eine
 * Groesse braucht, bevor eine Welt existiert.
 *
 * WER HIER LIEST, LIEST WAHRSCHEINLICH FALSCH: Kamera, Boden und Kollision
 * muessen `state.bounds` verwenden - sonst zeigen sie die Welt eines anderen
 * Seeds an als die, in der gespielt wird.
 */
export const ARENA = {
  width: 1600,
  height: 1200,
} as const;

/**
 * Aufloesung der Zeichenflaeche. Phaser skaliert diese Groesse per "Scale Manager"
 * auf den echten Bildschirm (Modus FIT), deshalb ist sie unabhaengig vom Geraet.
 * Querformat, weil das Spiel auf dem Handy quer gespielt wird.
 */
export const VIEWPORT = {
  width: 960,
  height: 540,
};

/**
 * Passt die Entwurfsaufloesung an das Seitenverhaeltnis des Geraets an.
 *
 * WARUM UEBERHAUPT: Die feste Aufloesung 960x540 ist 16:9. Ein iPhone im
 * Querformat ist eher 19,5:9 - im Modus FIT blieben links und rechts je rund
 * 75 Pixel schwarz. Das Spiel sass in einem Briefkasten mitten auf dem
 * Bildschirm.
 *
 * Die Hoehe bleibt fest bei 540, die Breite folgt dem Bildschirm. Damit passt
 * FIT genau auf, ohne Balken - und ohne etwas abzuschneiden.
 *
 * Die Grenzen sind eine Notbremse gegen absurde Werte, kein enges Korsett:
 * Waeren sie zu eng, entstuenden genau wieder die Balken, die der ganze Umbau
 * beseitigen soll. 1600 entspricht 2,96:1 - breiter ist kein Handy. Zum
 * Vergleich: 16:9 ergibt 960, das uebliche 19,5:9 ergibt 1170, und selbst
 * Safari im Querformat mit eingeblendeter Adressleiste (rund 2,6:1) bleibt mit
 * 1424 darunter.
 *
 * MUSS VOR DEM ERSTEN `new Phaser.Game` LAUFEN: Szenen und Bedienelemente
 * lesen diese Werte, wenn sie gebaut werden.
 */
/**
 * Sicherheitsabstaende in ENTWURFSEINHEITEN, nicht in Bildschirmpixeln.
 *
 * Das ist der Unterschied, auf den es ankommt: Das Geraet meldet seine
 * Abstaende in echten Pixeln (iPhone 13 quer: rund 47 an der Notch-Seite),
 * gezeichnet wird aber auf einer Flaeche von 540 Einheiten Hoehe, die auf den
 * Bildschirm skaliert wird. Ohne Umrechnung waere der Abstand auf einem
 * grossen Geraet zu klein und auf einem kleinen zu gross.
 *
 * Alles, was am Bildschirmrand klebt - Punktzahl, Lebensbalken, FEUER, SUPER -
 * rechnet diese Werte auf seinen Randabstand drauf.
 */
export const SAFE = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

/**
 * Uebernimmt die gemessenen Abstaende und rechnet sie in Entwurfseinheiten um.
 *
 * MUSS NACH `fitViewportToScreen` LAUFEN: Der Umrechnungsfaktor haengt an der
 * Entwurfsbreite, die dort erst festgelegt wird.
 */
export function setSafeAreaFromScreen(
  insets: { top: number; right: number; bottom: number; left: number },
  screenWidth: number,
): void {
  if (screenWidth <= 0) {
    return;
  }
  // Die Flaeche wird gleichmaessig skaliert (Modus FIT), deshalb genuegt ein
  // Faktor fuer beide Richtungen.
  const scale = VIEWPORT.width / screenWidth;
  SAFE.top = Math.round(insets.top * scale);
  SAFE.right = Math.round(insets.right * scale);
  SAFE.bottom = Math.round(insets.bottom * scale);
  SAFE.left = Math.round(insets.left * scale);
}

/**
 * Welche Entwurfsbreite passt zu diesem Bildschirm?
 *
 * Eigene Funktion, weil sie zweimal gebraucht wird: beim Start und bei jeder
 * Groessenaenderung, um zu erkennen, ob sich ueberhaupt etwas geaendert hat.
 *
 * `null` heisst "nicht umstellen" - im Hochformat waere die abgeleitete Breite
 * winzig und das Spiel unspielbar schmal.
 */
export function designWidthFor(screenWidth: number, screenHeight: number): number | null {
  if (screenWidth <= 0 || screenHeight <= 0 || screenHeight > screenWidth) {
    return null;
  }
  const aspect = screenWidth / screenHeight;
  const width = Math.round(VIEWPORT.height * aspect);
  return Math.min(1600, Math.max(960, width));
}

export function fitViewportToScreen(screenWidth: number, screenHeight: number): void {
  const width = designWidthFor(screenWidth, screenHeight);
  if (width !== null) {
    VIEWPORT.width = width;
  }
}

/**
 * Fester Zeitschritt der Simulation: 30 Ticks pro Sekunde.
 *
 * Warum fest? Bei variablem Zeitschritt rechnet ein schnelles Handy andere
 * Ergebnisse als ein langsames. Im Koop wuerden die Spielstaende auseinanderdriften.
 */
export const TICK_RATE = 30;
export const TICK_SECONDS = 1 / TICK_RATE;
export const TICK_MS = 1000 / TICK_RATE;

/**
 * Obergrenze an Simulationsschritten pro gezeichnetem Bild. Verhindert die
 * "Todesspirale": Nach einem langen Haenger wuerde das Spiel sonst hunderte
 * Ticks am Stueck nachrechnen und noch laenger haengen.
 */
export const MAX_TICKS_PER_FRAME = 5;

/** Zeichenreihenfolge. Hoehere Zahl liegt weiter vorne. */
export const DEPTH = {
  floor: 0,
  bushesBelow: 5,
  walls: 10,
  spawnWarning: 12,
  projectiles: 20,
  enemies: 25,
  players: 30,
  bushesAbove: 35,
  particles: 40,
  damageNumbers: 50,
  hud: 100,
} as const;

/**
 * Kamera: folgt allen lebenden Spielern und zoomt je nach Abstand heraus.
 *
 * ================================================================
 * WARUM DER ZOOM NACH PHASE 9 WEITER GEWORDEN IST
 * ================================================================
 *
 * In der festen Arena (1600x1200) war Zoom 1.0 richtig: Man sah rund ein
 * Drittel der Karte auf einmal. In der offenen Welt (16000x16000) zeigt
 * derselbe Wert nur noch rund 1169x540 Weltpixel - das sind 0,5 Prozent der
 * Flaeche, und rundherum ist alles unbekannt.
 *
 * Gemeldet wurde das als "zu leer und zu unuebersichtlich, Extraktionspunkte
 * findet man nicht". Nachgerechnet stimmt das: Eine Ausstiegszone hat 220 px
 * Radius, die naechste liegt 1200 px vom Start entfernt - bei Zoom 1.0 sieht
 * man aber nur 585 px nach jeder Seite. Man musste also fast draufstehen.
 *
 * 1.0 -> 0.80 zeigt 1461x675 statt 1169x540, also gut die Haelfte mehr
 * Flaeche. Die Figur wird dabei von 48 auf 38 Bildpunkte kleiner - immer noch
 * groesser als bei dem Zoom, den der Koop-Fall (0.62) ohnehin schon erzeugt.
 * Weiter hinaus waere moeglich, aber das ist ein Gefuehlswert: erst spielen,
 * dann feinjustieren. Ohne Neubau probieren mit
 * `?tune=camera.maxZoom=0.7`.
 */
export const CAMERA = {
  /** Zoom bei einem einzelnen Spieler. */
  maxZoom: 0.8,
  /**
   * Weitester Zoom, wenn die Gruppe auseinanderlaeuft.
   *
   * Zieht mit `maxZoom` mit (0.62 -> 0.55): Der Abstand zwischen beiden ist
   * der Spielraum, den eine auseinanderlaufende Gruppe hat. Bliebe die
   * Untergrenze stehen, waere dieser Spielraum halbiert.
   */
  minZoom: 0.55,
  /** Rand um die Spielergruppe in Pixeln, damit niemand am Bildschirmrand klebt. */
  padding: 260,
  /** Wie schnell der Zoom nachzieht (0 bis 1 pro Bild). */
  zoomLerp: 0.06,
  /** Traegheit der Kamerafolge. 1 waere hart angeheftet. */
  followLerp: 0.12,
} as const;

/**
 * Touch-Steuerung.
 *
 * Links ein schwebender Joystick - er erscheint dort, wo der Daumen die linke
 * Bildschirmhaelfte beruehrt. Rechts dagegen alles an FESTER Stelle: Der
 * Schussknopf muss blind zu finden sein, und ein Knopf, der jedes Mal woanders
 * auftaucht, ist genau das nicht.
 */
export const TOUCH = {
  /**
   * Radius des Bewegungs-Joysticks in Bildschirmpixeln.
   *
   * 78 -> 64: Mit der Reaktionskurve unten muss der Daumen bis an den Rand
   * ziehen, um volles Tempo zu bekommen. Bei 78 war das eine unbequem weite
   * Strecke; bei 64 liegt der Rand im natuerlichen Schwenkbereich des Daumens.
   */
  stickRadius: 64,
  /** Radius des Daumenknopfs. */
  knobRadius: 32,
  /**
   * Tote Zone in Pixeln - 10 -> 6.
   *
   * Sie ist nur noch gegen das Zittern eines aufliegenden Daumens da. Die
   * Feinsteuerung uebernimmt jetzt die Reaktionskurve, nicht mehr ein breiter
   * toter Bereich.
   */
  deadZone: 6,
  /**
   * Form der Reaktionskurve des Bewegungs-Joysticks.
   *
   * 1 = geradlinig: Halber Ausschlag ist halbes Tempo. Klingt richtig, fuehlt
   * sich aber grob an - schon eine kleine Bewegung schiebt die Figur spuerbar
   * los, und langsames Schleichen ist kaum zu treffen.
   *
   * 2 = quadratisch: Halber Ausschlag ist ein Viertel Tempo. Der Bereich um die
   * Mitte wird fein, ohne dass es oben an Tempo fehlt - volles Tempo gibt es
   * weiterhin am Rand.
   *
   * Zum Ausprobieren ohne Neubau: ?tune=touch.responseCurve=1.5
   */
  responseCurve: 2,

  /**
   * Die drei Knoepfe unten rechts, im Bogen angeordnet - wie in Wild Rift.
   *
   * FEUER liegt innen in der Ecke und ist der groesste: Er wird am haeufigsten
   * gebraucht und muss blind zu treffen sein. FAEHIGKEIT und SUPER liegen auf
   * demselben Bogen weiter aussen, links davon und darueber. Der Daumen
   * schwenkt so auf einem Kreisbogen, statt zwischen weit auseinander
   * liegenden Punkten zu springen.
   *
   * `hitRadius` ist grosszuegiger als der sichtbare Radius - Daumen sind
   * ungenau, und ein knapp verfehlter Knopf kostet im Gefecht eine Runde.
   */
  fireButton: {
    /** Abstand des Mittelpunkts von der rechten unteren Ecke. */
    marginX: 104,
    marginY: 100,
    radius: 60,
    hitRadius: 82,
  },

  /** Zweite aktive Faehigkeit - links vom Schussknopf auf dem Bogen. */
  abilityButton: {
    marginX: 232,
    marginY: 86,
    radius: 40,
    hitRadius: 58,
  },

  /** Super - ueber dem Schussknopf, groesser als die Faehigkeit. */
  superButton: {
    marginX: 96,
    marginY: 228,
    radius: 46,
    hitRadius: 64,
  },

  /** Gemeinsam fuer Faehigkeit und Super: Ziehen richtet aus. */
  aim: {
    /** Ab dieser Zugstrecke gilt die Beruehrung als Zielen statt als Antippen. */
    deadZone: 14,
    /** Bis zu dieser Dauer gilt sie als Antippen. */
    tapMaxMs: 150,
    /** Bis zu dieser Strecke gilt sie als Antippen. */
    tapMaxMove: 15,
  },
} as const;

/** Farbpalette. Lesbarkeit auf kleinem Bildschirm geht vor Schoenheit. */
export const COLORS = {
  background: 0x11161f,
  floor: 0x1e2734,
  floorGrid: 0x263243,
  wall: 0x46536b,
  wallEdge: 0x5f7191,
  bush: 0x2f6b46,
  bushEdge: 0x47935f,
  player: 0x4cc2ff,
  playerOutline: 0xe8f6ff,
  playerDown: 0x4a5a70,
  mate: 0x7ee08a,
  playerBullet: 0xfff2a8,
  enemyBullet: 0xff7a5c,
  runner: 0xff6b4a,
  brute: 0xc94f7c,
  shooter: 0xffa62b,
  enemyOutline: 0x2a1720,
  marked: 0xffe066,
  damageText: 0xfff2a8,
  critText: 0xffd166,
  hudText: 0xdce8f7,
  hudDim: 0x8ea6c4,
  /**
   * Warnung und Gefahr: warmes Rot-Orange aus der Palette des
   * Arbeitsdokuments. Vorher 0xff5470 - ein Pink, das auf dem Sandboden
   * grell wirkte und die "pinke Linie" quer durchs Bild ausmachte.
   */
  danger: 0xe4572e,
  superReady: 0xffd166,
} as const;
