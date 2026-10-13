/**
 * Die wirklich sichtbare Bildschirmflaeche - und die Seite genau so gross machen.
 *
 * DER FEHLER, DEN DAS BEHEBT (Screenshot des Nutzers, 2026-10-13): Als App vom
 * Home-Bildschirm eines iPhones lag unter dem Spiel ein leerer, blauer Streifen
 * von rund 47 Pixeln. iOS meldet einer solchen App im Querformat eine Fensterhoehe,
 * die um die Statusleiste des HOCHFORMATS zu klein ist (bekannter WebKit-Fehler).
 * Die Seite war deshalb kuerzer als der Bildschirm, das Spiel passte sich dieser
 * kurzen Seite an, und darunter schien der Seitenhintergrund durch.
 *
 * Jetzt gilt: Laeuft das Spiel als iOS-App und liegt das Handy quer, nehmen wir
 * die Bildschirmmasse (`screen`) statt der Fenstermasse - aber nur, wenn sie
 * hoechstens um eine Statusleiste abweichen (auf dem iPad mit geteiltem
 * Bildschirm waeren die Bildschirmmasse falsch). Die Seite bekommt dann genau
 * diese Groesse, damit Phaser sie auch ausfuellt.
 */

/** Groesste Abweichung, die wir als "Statusleisten-Fehler" werten (CSS-Pixel). */
const MAX_FIX = 80;

export interface Area {
  width: number;
  height: number;
}

function isIosHomeScreenApp(): boolean {
  // Nur Safari auf iPhone/iPad kennt `navigator.standalone`; true = vom Home-Bildschirm gestartet.
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

/** Breite und Hoehe der Flaeche, die das Spiel fuellen soll (CSS-Pixel). */
export function screenArea(): Area {
  let width = window.innerWidth;
  let height = window.innerHeight;
  if (isIosHomeScreenApp() && width > height) {
    const long = Math.max(window.screen.width, window.screen.height);
    const short = Math.min(window.screen.width, window.screen.height);
    if (short > height && short - height <= MAX_FIX) {
      height = short;
    }
    if (long > width && long - width <= MAX_FIX) {
      width = long;
    }
  }
  return { width, height };
}

/**
 * Macht Seite und Spielbehaelter genau so gross wie `screenArea()`, wenn die
 * Fenstermasse falsch sind. Sonst bleiben die normalen 100 % aus dem CSS.
 */
export function fitPageToScreen(): Area {
  const area = screenArea();
  // Als iOS-App im Querformat immer feste Masse setzen: Auch wenn das Fenster
  // richtig meldet, kann die Seite selbst (100 %) zu kurz sein.
  const iosLandscape = isIosHomeScreenApp() && window.innerWidth > window.innerHeight;
  const corrected = iosLandscape || area.width !== window.innerWidth || area.height !== window.innerHeight;
  const elements = [document.documentElement, document.body, document.getElementById("game-root")];
  for (const element of elements) {
    if (!element) {
      continue;
    }
    element.style.width = corrected ? `${area.width}px` : "";
    element.style.height = corrected ? `${area.height}px` : "";
  }
  return area;
}
