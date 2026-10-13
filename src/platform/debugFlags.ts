/**
 * Schalter zum Nachmessen, ueber die Adresszeile.
 *
 * Auf dem Handy gibt es keine Entwicklerwerkzeuge und keine Tastatur. Der
 * einzige Weg, im echten Spiel auf dem echten Geraet etwas sichtbar zu machen,
 * fuehrt deshalb ueber die Adresse der Seite:
 *
 *   .../Holdout/?debug=netz          Protokoll des Koop-Verbindungsaufbaus
 *   .../Holdout/?debug=werte         Bildrate und Gegnerzahl
 *   .../Holdout/?debug=kurz          Maersche nur ein Zehntel so lang (zum Testen)
 *   .../Holdout/?debug=reich         999 Schrott zum Start (Module ausprobieren)
 *   .../Holdout/?seed=4242           immer dieselbe Runde (nur solo)
 *
 * Mehrere Schalter werden mit Komma getrennt. Ohne `?debug=` ist alles aus -
 * es kostet also niemanden etwas, der einfach spielt.
 */

function activeFlags(): Set<string> {
  try {
    const raw = new URLSearchParams(window.location.search).get("debug");
    if (!raw) {
      return new Set();
    }
    return new Set(
      raw
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    );
  } catch {
    // Kein window, kein Suchteil - dann eben keine Schalter.
    return new Set();
  }
}

// Einmal beim Laden auswerten: Die Adresse aendert sich im Spiel nicht mehr,
// und pro Bild neu zu zerlegen waere Arbeit fuer nichts.
const FLAGS = activeFlags();

/** Kurze Maersche: Rast und Ziel schnell erreichen, zum Ausprobieren. */
export const SHORT_ROUTE = FLAGS.has("kurz") || FLAGS.has("short");

/** Viel Schrott zum Start, um alle Module auszuprobieren. */
export const RICH_START = FLAGS.has("reich") || FLAGS.has("rich");

/** Zahlenanzeige: Bildrate und Gegnerzahl. */
export const SHOW_VALUES = FLAGS.has("werte") || FLAGS.has("values") || FLAGS.has("all");

/**
 * Protokoll des Verbindungsaufbaus im Koop, direkt auf dem Bildschirm.
 *
 * Auf dem Handy gibt es keine Konsole - ohne diese Anzeige laesst sich ein
 * Fehler, der nur zwischen zwei echten Geraeten auftritt, gar nicht ansehen.
 */
export const SHOW_NET_LOG = FLAGS.has("netz") || FLAGS.has("net") || FLAGS.has("all");

/**
 * Fester Seed aus der Adresse, oder `null` fuer eine zufaellige Runde.
 *
 * Mit `?seed=` laesst sich ein Fehler nachstellen: gleiche Zahl, gleicher
 * Wellenplan und gleiche Angebote im Shop. Nur solo - im Koop gibt der Host
 * den Seed vor.
 */
export const FORCED_SEED: number | null = (() => {
  try {
    const raw = new URLSearchParams(window.location.search).get("seed");
    if (!raw) {
      return null;
    }
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value | 0 : null;
  } catch {
    return null;
  }
})();

/**
 * Auch am Desktop starten (`?desktop=1`) - nur zum Entwickeln und fuer
 * Bildschirmfotos. Normalen Spielern zeigt der Desktop weiter den QR-Code.
 */
export const FORCE_DESKTOP: boolean = (() => {
  try {
    return new URLSearchParams(window.location.search).has("desktop");
  } catch {
    return false;
  }
})();

/**
 * Koop ueber zwei Tabs desselben Browsers statt ueber das Internet (`?debug=lokal`).
 *
 * Zum Ausprobieren des Koops ohne zweites Handy: Tab 1 erstellt einen Raum,
 * Tab 2 tritt mit demselben Code bei. Kein Server, keine Wartezeit.
 */
export const LOCAL_NET = FLAGS.has("lokal") || FLAGS.has("local");
