/**
 * Der Spielstand ueber alle Laeufe hinweg: Kristalle, Schmiede-Stufen,
 * freigeschaltete Helden, Erfolge und ein paar Summen.
 *
 * Gespeichert wird im `localStorage` des Geraets (also pro Browser bzw. pro
 * App). Jeder Zugriff steht in try/catch: In manchen Umgebungen (privates
 * Fenster, gesperrte Website-Daten) wirft der Speicher - dann spielt man eben
 * ohne Fortschritt weiter, statt dass das Spiel abstuerzt.
 */

import type { CharacterId } from "../game/types";
import type { ForgeId } from "./forge";

const STORAGE_KEY = "holdout.profile";

export interface Profile {
  version: 1;
  crystals: number;
  forge: Partial<Record<ForgeId, number>>;
  unlocked: CharacterId[];
  achievements: string[];
  totals: {
    runs: number;
    kills: number;
    gold: number;
    wins: number;
    coopRuns: number;
  };
  best: {
    wave: number;
    level: number;
    tier: number;
    weapons: number;
    byHero: Partial<Record<CharacterId, number>>;
  };
  /** Zuletzt gewaehlter Held (die Auswahl startet dort). */
  lastHero: CharacterId;
}

/** Was ein beendeter Lauf zum Spielstand beitraegt. */
export interface RunResult {
  character: CharacterId;
  /** Welle, in der der Lauf endete (gewonnen: die letzte). */
  wave: number;
  won: boolean;
  kills: number;
  gold: number;
  level: number;
  /** Hoechste Waffenstufe am Ende (1-4). */
  maxTier: number;
  weaponCount: number;
  coop: boolean;
}

export function newProfile(): Profile {
  return {
    version: 1,
    crystals: 0,
    forge: {},
    unlocked: ["ritter"],
    achievements: [],
    totals: { runs: 0, kills: 0, gold: 0, wins: 0, coopRuns: 0 },
    best: { wave: 0, level: 0, tier: 0, weapons: 0, byHero: {} },
    lastHero: "ritter",
  };
}

/** Liest einen gespeicherten Stand und fuellt fehlende Felder auf (aeltere Fassungen). */
export function parseProfile(text: string | null): Profile {
  const fresh = newProfile();
  if (!text) {
    return fresh;
  }
  try {
    const data = JSON.parse(text) as Partial<Profile>;
    return {
      version: 1,
      crystals: Math.max(0, Math.floor(Number(data.crystals) || 0)),
      forge: { ...(data.forge ?? {}) },
      unlocked: Array.from(new Set<CharacterId>(["ritter", ...(data.unlocked ?? [])])),
      achievements: [...(data.achievements ?? [])],
      totals: { ...fresh.totals, ...(data.totals ?? {}) },
      best: { ...fresh.best, ...(data.best ?? {}), byHero: { ...(data.best?.byHero ?? {}) } },
      lastHero: data.lastHero ?? "ritter",
    };
  } catch {
    return fresh;
  }
}

let cached: Profile | null = null;

export function loadProfile(): Profile {
  if (cached) {
    return cached;
  }
  let text: string | null = null;
  try {
    text = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    text = null;
  }
  cached = parseProfile(text);
  return cached;
}

export function saveProfile(profile: Profile): void {
  cached = profile;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Kein Speicher verfuegbar: Fortschritt gilt nur bis zum Neuladen.
  }
}
