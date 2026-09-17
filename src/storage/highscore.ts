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
  wave: number;
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
export function saveHighscore(score: number, wave: number): boolean {
  const current = loadHighscore();
  // Null Punkte sind kein Rekord - auch nicht beim allerersten Versuch.
  if (score <= (current?.score ?? 0)) {
    return false;
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ score, wave, date: new Date().toISOString() }),
    );
  } catch {
    // Kein Speicher verfuegbar - der Punktestand der Runde gilt trotzdem.
  }

  return true;
}
