/**
 * Fähigkeiten aufwerten - wie in einem MOBA, aber auf vier Werte eingedampft.
 *
 * Für jede geschaffte Welle gibt es einen Punkt, und jeder Punkt geht in genau
 * eine Fähigkeit. Der Reiz liegt im Verzicht: Wer die Waffe hochzieht, hat
 * weniger Leben, und umgekehrt.
 *
 * Wichtig für die Umsetzung: Die Stufen werden NICHT in die Grundwerte
 * hineingerechnet, sondern bei jeder Benutzung frisch angewendet. Sonst
 * bekäme man Rundungsfehler, die sich über eine Runde aufschaukeln - und im
 * Koop würden Host und Client auseinanderlaufen.
 */

import { CHARACTERS, PLAYER, SKILLS } from "../config/balance";
import type { PlayerState, SkillId, WorldState } from "./types";

/** Alle Fähigkeiten auf Stufe 0. */
export function emptySkills(): Record<SkillId, number> {
  return { weapon: 0, armor: 0, speed: 0, super: 0 };
}

function level(player: PlayerState, skill: SkillId): number {
  return player.skills[skill] ?? 0;
}

/** Faktor einer Fähigkeit: Stufe 0 ergibt 1, jede Stufe legt `perLevel` drauf. */
function factor(player: PlayerState, skill: SkillId): number {
  return 1 + SKILLS[skill].perLevel * level(player, skill);
}

/** Schadensfaktor der Waffe. */
export function damageFactor(player: PlayerState): number {
  return factor(player, "weapon");
}

/** Laufgeschwindigkeit in Pixeln pro Sekunde. */
export function speedFor(player: PlayerState): number {
  return CHARACTERS[player.character].speed * factor(player, "speed");
}

/** Höchstleben, abhängig von der Panzerung. */
export function maxHealthFor(player: PlayerState): number {
  return Math.round(CHARACTERS[player.character].health * factor(player, "armor"));
}

/**
 * Super-Aufladung in Prozent fuer einen Treffer mit `damage` Schaden.
 *
 * Bewusst am Schaden statt an der Trefferzahl: Sonst laedt ein Charakter mit
 * fuenf Kugeln je Schuss fuenfmal so schnell wie einer mit einer Kugel, ganz
 * unabhaengig davon, wie viel er tatsaechlich anrichtet.
 */
export function superChargeFor(player: PlayerState, damage: number): number {
  return (PLAYER.superChargePerDamage * damage * factor(player, "super")) / 1000;
}

/** Lässt sich in diese Fähigkeit noch ein Punkt stecken? */
export function canLevelUp(player: PlayerState, skill: SkillId): boolean {
  return player.skillPoints > 0 && level(player, skill) < SKILLS[skill].maxLevel;
}

/**
 * Steckt einen Punkt in eine Fähigkeit.
 *
 * Bei der Panzerung wächst das Höchstleben - und das aktuelle Leben wächst um
 * denselben Betrag mit. Sonst wäre eine Stufe in Panzerung mitten in der Welle
 * eine gefühlte Verschlechterung, weil der Lebensbalken plötzlich leerer aussieht.
 */
export function applyLevelUp(state: WorldState, player: PlayerState, skill: SkillId): boolean {
  if (!canLevelUp(player, skill)) {
    return false;
  }

  const healthBefore = maxHealthFor(player);
  player.skills[skill] = level(player, skill) + 1;
  player.skillPoints -= 1;

  if (skill === "armor") {
    const gained = maxHealthFor(player) - healthBefore;
    player.maxHealth = maxHealthFor(player);
    player.health = Math.min(player.maxHealth, player.health + gained);
  }

  state.events.push({
    type: "levelUp",
    playerId: player.id,
    skill,
    level: player.skills[skill],
  });

  return true;
}
