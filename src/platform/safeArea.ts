/**
 * Die Sicherheitsabstaende des Geraets - Notch, Home-Indikator, runde Ecken.
 *
 * WARUM DAS NOETIG IST: Seit `viewport-fit=cover` zeichnet die Seite bis in
 * die letzte Ecke des Bildschirms. Das ist gewollt (sonst blieben Balken), hat
 * aber eine Kehrseite: Auf einem iPhone liegt im Querformat auf einer Seite die
 * Notch, unten der Home-Indikator, und alle vier Ecken sind rund. Was dort
 * steht, ist verdeckt oder abgeschnitten - genau das ist mit Punktzahl,
 * Lebensbalken und Knoepfen passiert.
 *
 * Diese Werte darf man NICHT raten. Jedes Geraet hat andere: Ein iPhone 13 quer
 * meldet links oder rechts rund 47 Pixel, ein Handy ohne Notch meldet ueberall
 * null, und ein Klapphandy meldet wieder etwas anderes. Deshalb wird gefragt
 * statt geschaetzt - der Browser kennt die Zahlen und gibt sie ueber
 * `env(safe-area-inset-*)` heraus.
 *
 * Gemessen wird ueber ein unsichtbares Hilfselement: Ein `env()`-Wert laesst
 * sich nicht direkt auslesen, wohl aber das daraus berechnete Polster.
 */

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NONE: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function forcedSafeArea(): SafeAreaInsets | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("safe");
    if (!raw) {
      return null;
    }
    const parts = raw.split(",").map((entry) => Number.parseFloat(entry.trim()));
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value) || value < 0)) {
      return null;
    }
    return {
      top: parts[0] as number,
      right: parts[1] as number,
      bottom: parts[2] as number,
      left: parts[3] as number,
    };
  } catch {
    return null;
  }
}

/**
 * Liest die Sicherheitsabstaende in CSS-Pixeln.
 *
 * Kennt der Browser `env()` nicht, kommt ueberall null heraus - dann gibt es
 * auch nichts zu umgehen, und das Spiel sieht aus wie bisher.
 */
export function readSafeArea(): SafeAreaInsets {
  // Zum Pruefen: `?safe=oben,rechts,unten,links` in Bildschirmpixeln gibt die
  // Werte vor, statt sie zu messen. Gebraucht wird das, weil Emulatoren am
  // Rechner immer null melden - ein Layout fuer ein Geraet mit Notch liesse
  // sich sonst nur auf dem Geraet selbst pruefen.
  // Beispiel iPhone quer: ?safe=0,47,21,47
  const forced = forcedSafeArea();
  if (forced) {
    return forced;
  }

  try {
    const probe = document.createElement("div");
    probe.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:0",
      "height:0",
      "visibility:hidden",
      "pointer-events:none",
      // Der Umweg: Das Polster uebernimmt den env()-Wert, und Polster kann man
      // auslesen.
      "padding-top:env(safe-area-inset-top,0px)",
      "padding-right:env(safe-area-inset-right,0px)",
      "padding-bottom:env(safe-area-inset-bottom,0px)",
      "padding-left:env(safe-area-inset-left,0px)",
    ].join(";");
    document.body.appendChild(probe);

    const style = window.getComputedStyle(probe);
    const value = (raw: string): number => {
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };
    const insets: SafeAreaInsets = {
      top: value(style.paddingTop),
      right: value(style.paddingRight),
      bottom: value(style.paddingBottom),
      left: value(style.paddingLeft),
    };

    probe.remove();
    return insets;
  } catch {
    return { ...NONE };
  }
}
