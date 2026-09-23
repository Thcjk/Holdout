/**
 * Lokaler Highscore im Browser-Speicher (localStorage).
 *
 * Bewusst lokal: Eine Online-Rangliste steht auf der Nicht-Liste des Briefings.
 *
 * Jeder Zugriff steckt in try/catch, weil localStorage in einem privaten Fenster
 * oder bei blockierten Website-Daten eine Ausnahme wirft statt einfach leer zu
 * sein. Ein abgestuerztes Spiel wegen eines Highscores waere absurd.
 */

const STORAGE_KEY = "arena-shooter.highscore";

export interface HighscoreEntry {
  score: number;
  /**
   * Tiefste erreichte Distanzzone.
   *
   * OPTIONAL, und das ist keine Schlamperei: Rekorde aus der Zeit vor Phase 8
   * liegen im selben Speicher und haben stattdessen ein Feld `wave`. Der
   * Speicherschluessel darf sich nicht aendern (sonst waere der Rekord weg -
   * siehe CLAUDE.md, "Der Name"), also liegen beide Formen nebeneinander.
   * Eine alte Wellennummer als Zone auszugeben waere gelogen - Welle 10 und
   * Zone 10 bedeuten voellig Verschiedenes. Deshalb fehlt sie dort lieber.
   */
  zone?: number;
  date: string;
}

export function loadHighscore(): HighscoreEntry | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as HighscoreEntry).score === "number"
    ) {
      return parsed as HighscoreEntry;
    }
    return null;
  } catch {
    return null;
  }
}

/** Speichert nur, wenn der neue Wert besser ist. Gibt zurueck, ob es ein Rekord war. */
export function saveHighscore(score: number, zone: number): boolean {
  const current = loadHighscore();
  // Null Punkte sind kein Rekord - auch nicht beim allerersten Versuch.
  if (score <= (current?.score ?? 0)) {
    return false;
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ score, zone, date: new Date().toISOString() }),
    );
  } catch {
    // Kein Speicher verfuegbar - der Punktestand der Runde gilt trotzdem.
  }

  return true;
}
