/**
 * Technische Konstanten der Oberflaeche: Bildschirm, Sicherheitsabstaende, Farben.
 *
 * Abgrenzung: Hier steht, wie die Flaeche auf dem Handy aufgebaut ist. Die
 * Zahlen des Spiels selbst (Arena, Tempo, Werte) stehen in `src/game/`.
 */

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


/** Textfarben als "#rrggbb", fuer Phaser-Texte. */
export const PALETTE = {
  hudText: "#1d1c19",
  hudShadow: "#00000066",
  danger: "#a8321c",
  success: "#4e6b2a",
  gold: "#a87a1c",
} as const;

/** Farben der Spielwelt. Lesbarkeit auf kleinem Bildschirm geht vor Schoenheit. */
export const COLORS = {
  background: 0xf1e5c9,
  floor: 0xc9a46a,
  wall: 0x46536b,
  wallEdge: 0x2a1f14,
  hpBack: 0x1d1c19,
  hpPlayer: 0x4f9aa0,
  hpEnemy: 0xb5532f,
  danger: 0xff4a3a,
  material: 0xdba636,
  playerBullet: 0xffe9a0,
  enemyBullet: 0xff4a3a,
  marker: 0xb5532f,
} as const;
