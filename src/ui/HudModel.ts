/**
 * Die Daten, die das HUD anzeigt.
 *
 * Warum ein eigenes Objekt statt eines Zugriffs auf den Weltzustand? Weil HUD und
 * Spiel in zwei getrennten Phaser-Szenen laufen (Begruendung in HudScene.ts) und
 * ein schmales, klar benanntes Objekt die einzige Verbindung zwischen ihnen ist.
 * Die Szene fuellt es jedes Bild neu; das HUD liest es nur.
 */

import type { RoundPhase, SkillId } from "../systems/types";

export interface HudMate {
  name: string;
  healthFraction: number;
  down: boolean;
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
   * Dort heilt man, und dort verteilt man Skillpunkte. Frueher war beides an
   * die Pause zwischen zwei Wellen gebunden - die gibt es nicht mehr.
   */
  inSafeZone: boolean;
  /**
   * Fortschritt der Extraktion von 0 bis 1, oder -1 wenn gerade keine laeuft.
   *
   * Eine Zahl statt zweier Felder: "laeuft gerade" und "wie weit" sind
   * dieselbe Information, und zwei Felder koennen sich widersprechen.
   */
  extraction: number;
  enemiesLeft: number;
  down: boolean;
  reviveProgress: number;
  mates: HudMate[];
  /** Gesetzt, wenn die Verbindung abgerissen ist - wird gross eingeblendet. */
  connectionMessage: string | null;
  /** Noch nicht verteilte Skillpunkte. */
  skillPoints: number;
  /** Stufe je Faehigkeit. */
  skillLevels: Record<SkillId, number>;
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
    phase: "running",
    runTime: 0,
    inSafeZone: true,
    extraction: -1,
    enemiesLeft: 0,
    down: false,
    reviveProgress: 0,
    mates: [],
    connectionMessage: null,
    skillPoints: 0,
    skillLevels: { weapon: 0, armor: 0, speed: 0, super: 0 },
  };
}
