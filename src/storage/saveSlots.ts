/**
 * Spielstaende: drei Plaetze im Browser-Speicher des Geraets (localStorage).
 *
 * ================================================================
 * WAS EIN SPIELSTAND ENTHAELT
 * ================================================================
 *
 *   Charakter     der zuletzt gewaehlte
 *   Lager         alles Gesicherte (ohne Starter-Set - das gibt es immer)
 *   Rucksack      was nach einem Erfolg drin war, samt Anordnung
 *   Run           nur solo: die Karte (aus dem Seed), der Weg, Tag, Rucksack,
 *                 Leben - gespeichert AUF DER KARTE, also zwischen zwei
 *                 Gebieten. Wer mitten im Gebiet die App schliesst, faengt
 *                 dieses Gebiet beim Laden neu an.
 *
 * Die Karte selbst wird nicht gespeichert, nur ihr Seed: `generateNodeMap`
 * baut aus derselben Zahl dieselbe Karte (dafuer gibt es Tests).
 *
 * ================================================================
 * KOOP
 * ================================================================
 *
 * Jeder Spieler bringt seinen eigenen Stand mit (Charakter, Lager). Den Run
 * haelt der Host; ein Koop-Run wird nicht gespeichert und laesst sich nicht
 * fortsetzen. Nach dem Run sichert jeder seine Beute in seinem Stand.
 *
 * ================================================================
 * AUFBAU
 * ================================================================
 *
 * Dieses Modul ist phaserfrei und bekommt den Speicher uebergeben (Vorgabe:
 * `localStorage`). So laesst es sich im Test mit einem nachgebauten Speicher
 * pruefen. Jeder Zugriff steckt in try/catch: Im privaten Fenster oder bei
 * vollem Speicher wirft `localStorage` - das Spiel soll dann weiterlaufen,
 * nur eben ohne Speichern.
 */

import type { CharacterId, PackedItem } from "../systems/types";
import type { PlayerSetup } from "../systems/world";
import { generateNodeMap } from "../systems/NodeMapGenerator";
import type { RunState } from "../systems/run";
import { backpackForNextRun, restoreCarried, stashItems } from "./carried";

/** Anzahl Speicherplaetze. */
export const SLOT_COUNT = 3;

/** Steigt, wenn sich das Format aendert; aeltere Staende werden umgebaut oder verworfen. */
const FORMAT_VERSION = 1;
const KEY_PREFIX = "holdout.save.";

/** Ein laufender Run, so knapp wie moeglich: die Karte kommt aus dem Seed. */
export interface SavedRun {
  seed: number;
  current: number;
  visited: number[];
  day: number;
  players: PlayerSetup[];
}

export interface SaveGame {
  version: number;
  character: CharacterId;
  stash: PackedItem[];
  backpack: PackedItem[];
  run: SavedRun | null;
  /** Zuletzt gespeichert (Millisekunden seit 1970) - fuer die Anzeige. */
  savedAt: number;
}

/** Was man vom Speicher braucht - `localStorage` hat das, der Test auch. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Der Platz, mit dem gerade gespielt wird (0 bis 2), oder `null`. */
let activeSlot: number | null = null;
let activeCharacter: CharacterId = "scout";

export function currentSlot(): number | null {
  return activeSlot;
}

export function readSlot(slot: number, store = defaultStore()): SaveGame | null {
  if (!store) return null;
  try {
    const raw = store.getItem(KEY_PREFIX + slot);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveGame>;
    if (data.version !== FORMAT_VERSION || !data.character) return null;
    return {
      version: FORMAT_VERSION,
      character: data.character,
      stash: Array.isArray(data.stash) ? data.stash : [],
      backpack: Array.isArray(data.backpack) ? data.backpack : [],
      run: data.run ?? null,
      savedAt: typeof data.savedAt === "number" ? data.savedAt : 0,
    };
  } catch {
    // Kaputter Eintrag (von Hand veraendert, halb geschrieben): wie leer.
    return null;
  }
}

/** Alle Plaetze, leere als `null`. */
export function listSlots(store = defaultStore()): Array<SaveGame | null> {
  return Array.from({ length: SLOT_COUNT }, (_, slot) => readSlot(slot, store));
}

export function deleteSlot(slot: number, store = defaultStore()): void {
  try {
    store?.removeItem(KEY_PREFIX + slot);
  } catch {
    // Nicht loeschbar - dann bleibt er eben stehen.
  }
  if (activeSlot === slot) activeSlot = null;
}

/**
 * Einen Platz neu belegen: leeres Lager, kein Run. Ein alter Stand dort wird
 * ueberschrieben - die Rueckfrage stellt die Oberflaeche.
 */
export function startNewSlot(slot: number, character: CharacterId, store = defaultStore()): void {
  activeSlot = slot;
  activeCharacter = character;
  restoreCarried([], []);
  writeActive(null, store);
}

/**
 * Einen Stand laden: Lager und Rucksack in den Arbeitsspeicher, und der
 * laufende Run (falls einer da ist) als fertiger `RunState`.
 */
export function loadSlot(slot: number, store = defaultStore()): { save: SaveGame; run: RunState | null } | null {
  const save = readSlot(slot, store);
  if (!save) return null;
  activeSlot = slot;
  activeCharacter = save.character;
  restoreCarried(save.backpack, save.stash);
  return { save, run: save.run ? runFromSave(save.run) : null };
}

export function runFromSave(saved: SavedRun): RunState {
  return {
    seed: saved.seed,
    map: generateNodeMap(saved.seed),
    current: saved.current,
    visited: [...saved.visited],
    day: saved.day,
    players: saved.players.map((player) => ({ ...player })),
  };
}

/** Den gewaehlten Charakter merken (fuer den naechsten Start). */
export function setActiveCharacter(character: CharacterId): void {
  activeCharacter = character;
}

export function activeCharacterOr(fallback: CharacterId): CharacterId {
  return activeSlot === null ? fallback : activeCharacter;
}

/**
 * Den aktiven Stand schreiben: Lager und Rucksack aus dem Arbeitsspeicher,
 * dazu der Run - oder `null`, wenn keiner laeuft bzw. im Koop.
 *
 * Ohne aktiven Platz (z. B. per `?knoten=` direkt ins Spiel) passiert nichts.
 */
export function saveActive(run: RunState | null, store = defaultStore()): void {
  writeActive(run, store);
}

function writeActive(run: RunState | null, store: KeyValueStore | null): void {
  if (activeSlot === null || !store) return;
  const save: SaveGame = {
    version: FORMAT_VERSION,
    character: activeCharacter,
    stash: stashItems().map((entry) => ({ ...entry })),
    backpack: backpackForNextRun().map((entry) => ({ ...entry })),
    run: run
      ? {
          seed: run.seed,
          current: run.current,
          visited: [...run.visited],
          day: run.day,
          players: run.players.map((player) => ({ ...player })),
        }
      : null,
    savedAt: Date.now(),
  };
  try {
    store.setItem(KEY_PREFIX + activeSlot, JSON.stringify(save));
  } catch {
    // Speicher voll oder gesperrt: weiterspielen, nur ohne Speichern.
  }
}

/** Nur fuer Tests: aktiven Platz vergessen. */
export function resetActiveSlot(): void {
  activeSlot = null;
  activeCharacter = "scout";
}
