/**
 * Das Profil (Altgold, Werft, Erfolge) im Speicher des Browsers.
 *
 * Jeder Zugriff ist abgesichert: Im privaten Fenster oder mit gesperrtem
 * Speicher wirft localStorage Fehler - dann spielt man eben ohne Fortschritt,
 * aber das Spiel laeuft.
 */

import { newProfile, sanitizeProfile, type Profile } from "../game/meta";

const KEY = "holdout.wf.profile";

let cached: Profile | null = null;

export function loadProfile(): Profile {
  if (cached) {
    return cached;
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? sanitizeProfile(JSON.parse(raw)) : newProfile();
  } catch {
    cached = newProfile();
  }
  return cached;
}

export function saveProfile(profile: Profile): void {
  cached = profile;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Kein Speicher - der Fortschritt gilt nur bis zum Neuladen.
  }
}
