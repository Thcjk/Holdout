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
  wave: number;
  score: number;
  highscore: number;
  phase: RoundPhase;
  /** Restzeit der Phase in Sekunden (nur bei Vorbereitung und Pause sinnvoll). */
  phaseTime: number;
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
    wave: 0,
    score: 0,
    highscore: 0,
    phase: "preparing",
    phaseTime: 0,
    enemiesLeft: 0,
    down: false,
    reviveProgress: 0,
    mates: [],
    connectionMessage: null,
    skillPoints: 0,
    skillLevels: { weapon: 0, armor: 0, speed: 0, super: 0 },
  };
}
