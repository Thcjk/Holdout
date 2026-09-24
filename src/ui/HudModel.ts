/**
 * Die Daten, die das HUD anzeigt.
 *
 * Warum ein eigenes Objekt statt eines Zugriffs auf den Weltzustand? Weil HUD und
 * Spiel in zwei getrennten Phaser-Szenen laufen (Begruendung in HudScene.ts) und
 * ein schmales, klar benanntes Objekt die einzige Verbindung zwischen ihnen ist.
 * Die Szene fuellt es jedes Bild neu; das HUD liest es nur.
 */

import type { RoundPhase } from "../systems/types";

import type { PackedItem } from "../systems/types";

export interface HudMate {
  name: string;
  healthFraction: number;
  down: boolean;
}

/**
 * Was die Uebersichtskarte braucht - und nur das.
 *
 * Eigenes Objekt statt eines Durchgriffs auf den Weltzustand: Die HUD-Szene
 * kennt den Weltzustand nicht (Begruendung in `HudScene.ts`), und ein schmales
 * Modell macht sichtbar, wie wenig die Karte wirklich wissen muss.
 */
export interface MinimapModel {
  /** Kantenlaenge der Welt in Weltpixeln. Die Welt ist quadratisch. */
  worldSize: number;
  startX: number;
  startY: number;
  safeRadius: number;
  selfX: number;
  selfY: number;
  mates: { x: number; y: number; down: boolean }[];
  /** Nur die schon aufgedeckten. */
  extractions: { x: number; y: number }[];
  encounters: { x: number; y: number; isFinal: boolean; cleared: boolean }[];
}

export function emptyMinimap(): MinimapModel {
  return {
    worldSize: 1,
    startX: 0,
    startY: 0,
    safeRadius: 0,
    selfX: 0,
    selfY: 0,
    mates: [],
    extractions: [],
    encounters: [],
  };
}

export interface HudModel {
  characterName: string;
  health: number;
  maxHealth: number;
  /** Je Ladung: 1 = voll, sonst der Nachladefortschritt von 0 bis 1. */
  ammo: number[];
  superCharge: number;
  /** Restliche Abklingzeit der zweiten Faehigkeit in Sekunden. 0 = bereit. */
  abilityCooldown: number;
  /** Volle Abklingzeit dieses Charakters - daraus entsteht der Abklingring. */
  abilityCooldownMax: number;
  /** Kurzname der Faehigkeit fuer die Beschriftung des Knopfs. */
  abilityLabel: string;
  /** Distanzzone, in der das Team gerade unterwegs ist. 0 = sicherer Start. */
  zone: number;
  /** Tiefste je erreichte Zone. */
  deepestZone: number;
  score: number;
  highscore: number;
  phase: RoundPhase;
  /** Laufzeit des Runs in Sekunden. */
  runTime: number;
  /**
   * Steht der eigene Spieler in der sicheren Zone um den Startpunkt?
   *
   * Dort heilt man. Frueher war das an die Pause zwischen zwei Wellen
   * gebunden - die gibt es nicht mehr.
   */
  inSafeZone: boolean;
  /**
   * Fortschritt der Extraktion von 0 bis 1, oder -1 wenn gerade keine laeuft.
   *
   * Eine Zahl statt zweier Felder: "laeuft gerade" und "wie weit" sind
   * dieselbe Information, und zwei Felder koennen sich widersprechen.
   */
  extraction: number;
  /**
   * Richtung und Entfernung zum naechsten BEKANNTEN Ausstieg, oder `null`.
   *
   * `null` heisst "noch keinen entdeckt" - dann zeigt der Kompass nichts an,
   * statt in eine beliebige Richtung zu raten. Ein Pfeil, der auf etwas zeigt,
   * von dem man nichts weiss, waere keine Hilfe, sondern eine Behauptung.
   *
   * Der Winkel ist im Bogenmass, die Entfernung in Weltpixeln.
   */
  extractionCompass: { angle: number; distance: number } | null;
  /** Stand fuer die Uebersichtskarte. */
  minimap: MinimapModel;
  /** Wie viele Gegenstaende man im Run schon eingesammelt hat. */
  carriedItems: number;
  /** Der eigene Rucksack, wie ihn die Simulation gerade hat (Etappe 9). */
  backpack: PackedItem[];
  enemiesLeft: number;
  down: boolean;
  reviveProgress: number;
  mates: HudMate[];
  /** Gesetzt, wenn die Verbindung abgerissen ist - wird gross eingeblendet. */
  connectionMessage: string | null;
}

export function createHudModel(): HudModel {
  return {
    characterName: "",
    health: 0,
    maxHealth: 1,
    ammo: [],
    superCharge: 0,
    abilityCooldown: 0,
    abilityCooldownMax: 1,
    abilityLabel: "",
    zone: 0,
    deepestZone: 0,
    score: 0,
    highscore: 0,
    extractionCompass: null,
    minimap: emptyMinimap(),
    carriedItems: 0,
    backpack: [],
    phase: "running",
    runTime: 0,
    inSafeZone: true,
    extraction: -1,
    enemiesLeft: 0,
    down: false,
    reviveProgress: 0,
    mates: [],
    connectionMessage: null,
  };
}
