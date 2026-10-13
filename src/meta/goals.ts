/**
 * Ziele ueber viele Laeufe: Kristalle je Lauf, Helden freischalten, Erfolge,
 * Schmiede-Kaeufe. Alles reine Rechnung auf einem `Profile` - gespeichert wird
 * in `profile.ts`.
 */

import { CHARACTER_IDS } from "../game/data/characters";
import { FINAL_WAVE } from "../game/data/enemies";
import type { CharacterId, StatMods } from "../game/types";
import { forgeBonus, forgeCost, forgeTotal, type ForgeId } from "./forge";
import type { Profile, RunResult } from "./profile";

// --- Kristalle ------------------------------------------------------------------------

/**
 * Kristalle fuer einen Lauf. Jede geschaffte Welle zaehlt, spaete Wellen viel
 * mehr als fruehe (quadratisch) - wer weiter kommt, verdient deutlich besser.
 */
export function crystalsForRun(run: RunResult): { total: number; parts: [string, number][] } {
  const cleared = run.won ? FINAL_WAVE : Math.max(0, run.wave - 1);
  const waves = cleared * 3 + Math.floor((cleared * cleared) / 3);
  const kills = Math.floor(run.kills / 20);
  const victory = run.won ? 60 : 0;
  const parts: [string, number][] = [
    [`${cleared} Wellen geschafft`, waves],
    [`${run.kills} Monster besiegt`, kills],
  ];
  if (victory > 0) {
    parts.push(["Sieg über den Lich", victory]);
  }
  return { total: waves + kills + victory, parts };
}

// --- Helden freischalten ------------------------------------------------------------

export interface UnlockRule {
  /** Wie man den Helden freischaltet (fuer die Anzeige). */
  text: string;
  done: (profile: Profile) => boolean;
}

export const HERO_UNLOCKS: Record<CharacterId, UnlockRule> = {
  ritter: { text: "Von Anfang an dabei.", done: () => true },
  elfe: { text: "Erreiche Welle 5.", done: (p) => p.best.wave >= 5 },
  zwerg: { text: "Besiege insgesamt 600 Monster.", done: (p) => p.totals.kills >= 600 },
  magierin: { text: "Erreiche Welle 8.", done: (p) => p.best.wave >= 8 },
  schurke: { text: "Sammle insgesamt 3000 Gold.", done: (p) => p.totals.gold >= 3000 },
  zauberer: { text: "Erreiche Welle 12.", done: (p) => p.best.wave >= 12 },
};

export function isUnlocked(profile: Profile, id: CharacterId): boolean {
  return profile.unlocked.includes(id);
}

// --- Erfolge ----------------------------------------------------------------------------

export interface Achievement {
  id: string;
  name: string;
  text: string;
  /** Kristalle als Belohnung. */
  reward: number;
  done: (profile: Profile) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "erster-lauf", name: "Erster Schritt", text: "Spiele deinen ersten Lauf.", reward: 10, done: (p) => p.totals.runs >= 1 },
  { id: "welle-5", name: "Torwache", text: "Erreiche Welle 5.", reward: 15, done: (p) => p.best.wave >= 5 },
  { id: "welle-10", name: "Mauerwächter", text: "Erreiche Welle 10.", reward: 40, done: (p) => p.best.wave >= 10 },
  { id: "welle-15", name: "Turmhüter", text: "Erreiche Welle 15.", reward: 80, done: (p) => p.best.wave >= 15 },
  { id: "welle-20", name: "Letzte Bastion", text: "Erreiche Welle 20.", reward: 120, done: (p) => p.best.wave >= FINAL_WAVE },
  { id: "sieg", name: "Lichbezwinger", text: "Besiege den Lich und gewinne einen Lauf.", reward: 250, done: (p) => p.totals.wins >= 1 },
  { id: "kills-250", name: "Monsterjäger", text: "Besiege insgesamt 250 Monster.", reward: 15, done: (p) => p.totals.kills >= 250 },
  { id: "kills-2000", name: "Monsterschreck", text: "Besiege insgesamt 2000 Monster.", reward: 50, done: (p) => p.totals.kills >= 2000 },
  { id: "kills-10000", name: "Legende der Feste", text: "Besiege insgesamt 10 000 Monster.", reward: 150, done: (p) => p.totals.kills >= 10000 },
  { id: "gold-2000", name: "Sparfuchs", text: "Sammle insgesamt 2000 Gold.", reward: 20, done: (p) => p.totals.gold >= 2000 },
  { id: "gold-20000", name: "Schatzmeister", text: "Sammle insgesamt 20 000 Gold.", reward: 80, done: (p) => p.totals.gold >= 20000 },
  { id: "stufe-10", name: "Erfahren", text: "Erreiche Stufe 10 in einem Lauf.", reward: 25, done: (p) => p.best.level >= 10 },
  { id: "stufe-4", name: "Meisterschmied", text: "Bringe eine Waffe auf Stufe IV.", reward: 40, done: (p) => p.best.tier >= 4 },
  { id: "arsenal", name: "Waffenkammer", text: "Trage sechs Waffen gleichzeitig.", reward: 20, done: (p) => p.best.weapons >= 6 },
  { id: "koop", name: "Gemeinsam stark", text: "Spiele einen Lauf im Koop.", reward: 20, done: (p) => p.totals.coopRuns >= 1 },
  { id: "schmiede-10", name: "Ausgebaut", text: "Kaufe 10 Stufen in der Schmiede.", reward: 20, done: (p) => forgeTotal(p.forge) >= 10 },
  { id: "schmiede-40", name: "Festungsbaumeister", text: "Kaufe 40 Stufen in der Schmiede.", reward: 80, done: (p) => forgeTotal(p.forge) >= 40 },
  { id: "alle-helden", name: "Heldenrunde", text: "Schalte alle Helden frei.", reward: 60, done: (p) => CHARACTER_IDS.every((id) => p.unlocked.includes(id)) },
  { id: "laeufe-25", name: "Unermüdlich", text: "Spiele 25 Läufe.", reward: 50, done: (p) => p.totals.runs >= 25 },
  {
    id: "jeder-held",
    name: "Vielseitig",
    text: "Erreiche mit jedem Helden Welle 10.",
    reward: 150,
    done: (p) => CHARACTER_IDS.every((id) => (p.best.byHero[id] ?? 0) >= 10),
  },
];

// --- Auswerten ---------------------------------------------------------------------------

export interface Progress {
  /** Neu erreichte Erfolge (ihre Kristalle sind schon gutgeschrieben). */
  achievements: Achievement[];
  /** Neu freigeschaltete Helden. */
  unlocked: CharacterId[];
}

/**
 * Prueft Freischaltungen und Erfolge, bis sich nichts mehr aendert (ein
 * freigeschalteter Held kann z. B. "Alle Helden" ausloesen). Veraendert `profile`.
 */
export function settle(profile: Profile): Progress {
  const progress: Progress = { achievements: [], unlocked: [] };
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of CHARACTER_IDS) {
      if (!profile.unlocked.includes(id) && HERO_UNLOCKS[id].done(profile)) {
        profile.unlocked.push(id);
        progress.unlocked.push(id);
        changed = true;
      }
    }
    for (const achievement of ACHIEVEMENTS) {
      if (!profile.achievements.includes(achievement.id) && achievement.done(profile)) {
        profile.achievements.push(achievement.id);
        profile.crystals += achievement.reward;
        progress.achievements.push(achievement);
        changed = true;
      }
    }
  }
  return progress;
}

export interface RunReport extends Progress {
  crystals: number;
  parts: [string, number][];
}

/** Traegt einen beendeten Lauf ein: Summen, Bestwerte, Kristalle, Erfolge. Veraendert `profile`. */
export function applyRun(profile: Profile, run: RunResult): RunReport {
  profile.totals.runs += 1;
  profile.totals.kills += run.kills;
  profile.totals.gold += run.gold;
  if (run.won) {
    profile.totals.wins += 1;
  }
  if (run.coop) {
    profile.totals.coopRuns += 1;
  }
  profile.best.wave = Math.max(profile.best.wave, run.wave);
  profile.best.level = Math.max(profile.best.level, run.level);
  profile.best.tier = Math.max(profile.best.tier, run.maxTier);
  profile.best.weapons = Math.max(profile.best.weapons, run.weaponCount);
  profile.best.byHero[run.character] = Math.max(profile.best.byHero[run.character] ?? 0, run.wave);

  const earned = crystalsForRun(run);
  profile.crystals += earned.total;
  return { crystals: earned.total, parts: earned.parts, ...settle(profile) };
}

/** Kauft die naechste Stufe in der Schmiede, wenn genug Kristalle da sind. Veraendert `profile`. */
export function buyForge(profile: Profile, id: ForgeId): Progress | null {
  const level = profile.forge[id] ?? 0;
  const cost = forgeCost(id, level);
  if (cost === null || profile.crystals < cost) {
    return null;
  }
  profile.crystals -= cost;
  profile.forge[id] = level + 1;
  return settle(profile);
}

/** Die Schmiede-Boni dieses Geraets - fuer den Start eines Laufs (solo und Koop). */
export function startBonus(profile: Profile): { bonus: StatMods; startGold: number } {
  const { mods, startGold } = forgeBonus(profile.forge);
  return { bonus: mods, startGold };
}
