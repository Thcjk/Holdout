/**
 * Was ueber einen Lauf hinaus bleibt: Altgold, freigeschaltete Mechs, Bauplaene,
 * Werft-Verbesserungen, Hitze-Stufen und Erfolge.
 *
 * Alles hier ist reine Rechnerei ohne Speicher - gespeichert wird das Profil
 * ausserhalb des Spielkerns (`platform/profileStore.ts`).
 */

import { START_SCRAP } from "./constants";
import { CREW, CREW_IDS } from "./data/crew";
import { MODULE_IDS } from "./data/modules";
import type { SimulationOptions } from "./Simulation";
import type { CrewId, GameState, ModuleId } from "./types";

// --- Werft -----------------------------------------------------------------------------------------

/** Diese Module kennt jede Crew von Anfang an. */
export const START_BLUEPRINTS: readonly ModuleId[] = [
  "geschuetz",
  "platte",
  "oel",
  "generator",
  "magnet",
  "werkstatt",
];

/** Bauplaene, die man in der Werft kaufen kann (Altgold). */
export const BLUEPRINT_COST: Partial<Record<ModuleId, number>> = {
  motor: 100,
  harpune: 120,
  spule: 140,
  moerser: 160,
};

export type UpgradeId = "rumpf" | "schrott" | "vorsprung";

export interface UpgradeSpec {
  id: UpgradeId;
  name: string;
  /** Was eine Stufe bringt. */
  text: string;
  max: number;
  /** Preis der naechsten Stufe (Stufe 1 = cost). */
  cost: number;
}

export const UPGRADES: Record<UpgradeId, UpgradeSpec> = {
  rumpf: { id: "rumpf", name: "Dickerer Rumpf", text: "+60 Rumpf", max: 5, cost: 60 },
  schrott: { id: "schrott", name: "Vorräte", text: "+15 Startschrott", max: 4, cost: 50 },
  vorsprung: {
    id: "vorsprung",
    name: "Kesseldruck",
    text: "+1 Vorsprung zum Start",
    max: 2,
    cost: 150,
  },
};

export const UPGRADE_IDS: readonly UpgradeId[] = ["rumpf", "schrott", "vorsprung"];

export function upgradePrice(id: UpgradeId, level: number): number | null {
  const spec = UPGRADES[id];
  return level >= spec.max ? null : spec.cost * (level + 1);
}

export const HEAT_MAX = 10;

// --- Profil ----------------------------------------------------------------------------------------

export interface Profile {
  version: 1;
  altgold: number;
  crew: CrewId[];
  blueprints: ModuleId[];
  upgrades: Record<UpgradeId, number>;
  /** Hoechste freigeschaltete Hitze (0 = noch keine). */
  heatUnlocked: number;
  /** Gewaehlte Hitze fuer den naechsten Lauf. */
  heat: number;
  selected: CrewId;
  achievements: string[];
  stats: { runs: number; wins: number; bestLayer: number; kills: number };
}

export function newProfile(): Profile {
  return {
    version: 1,
    altgold: 0,
    crew: ["schrauber"],
    blueprints: [],
    upgrades: { rumpf: 0, schrott: 0, vorsprung: 0 },
    heatUnlocked: 0,
    heat: 0,
    selected: "schrauber",
    achievements: [],
    stats: { runs: 0, wins: 0, bestLayer: 0, kills: 0 },
  };
}

/** Ein gelesenes Profil gegen Fehler absichern (alte Fassung, kaputte Werte). */
export function sanitizeProfile(raw: unknown): Profile {
  const base = newProfile();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const r = raw as Partial<Profile>;
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const crew = Array.isArray(r.crew) ? r.crew.filter((c) => CREW_IDS.includes(c)) : [];
  const blueprints = Array.isArray(r.blueprints)
    ? r.blueprints.filter((b) => MODULE_IDS.includes(b))
    : [];
  const profile: Profile = {
    version: 1,
    altgold: Math.max(0, Math.floor(num(r.altgold, 0))),
    crew: crew.includes("schrauber") ? crew : ["schrauber", ...crew],
    blueprints,
    upgrades: {
      rumpf: clampInt(num(r.upgrades?.rumpf, 0), 0, UPGRADES.rumpf.max),
      schrott: clampInt(num(r.upgrades?.schrott, 0), 0, UPGRADES.schrott.max),
      vorsprung: clampInt(num(r.upgrades?.vorsprung, 0), 0, UPGRADES.vorsprung.max),
    },
    heatUnlocked: clampInt(num(r.heatUnlocked, 0), 0, HEAT_MAX),
    heat: 0,
    selected: "schrauber",
    achievements: Array.isArray(r.achievements)
      ? r.achievements.filter((a): a is string => typeof a === "string")
      : [],
    stats: {
      runs: num(r.stats?.runs, 0),
      wins: num(r.stats?.wins, 0),
      bestLayer: num(r.stats?.bestLayer, 0),
      kills: num(r.stats?.kills, 0),
    },
  };
  profile.heat = clampInt(num(r.heat, 0), 0, profile.heatUnlocked);
  profile.selected = r.selected && profile.crew.includes(r.selected) ? r.selected : "schrauber";
  return profile;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/** Einstellungen fuer einen neuen Lauf aus dem Profil. */
export function runOptions(profile: Profile): SimulationOptions {
  return {
    modulePool: [...START_BLUEPRINTS, ...profile.blueprints],
    hullBonus: profile.upgrades.rumpf * 60,
    startScrap: START_SCRAP + profile.upgrades.schrott * 15,
    leadBonus: profile.upgrades.vorsprung,
    heat: profile.heat,
  };
}

// --- Werft: kaufen ---------------------------------------------------------------------------------

export function unlockCrew(profile: Profile, id: CrewId): boolean {
  const cost = CREW[id].unlock;
  if (profile.crew.includes(id) || profile.altgold < cost) {
    return false;
  }
  profile.altgold -= cost;
  profile.crew.push(id);
  return true;
}

export function unlockBlueprint(profile: Profile, id: ModuleId): boolean {
  const cost = BLUEPRINT_COST[id];
  if (cost === undefined || profile.blueprints.includes(id) || profile.altgold < cost) {
    return false;
  }
  profile.altgold -= cost;
  profile.blueprints.push(id);
  return true;
}

export function buyUpgrade(profile: Profile, id: UpgradeId): boolean {
  const price = upgradePrice(id, profile.upgrades[id]);
  if (price === null || profile.altgold < price) {
    return false;
  }
  profile.altgold -= price;
  profile.upgrades[id] += 1;
  return true;
}

// --- Nach dem Lauf ---------------------------------------------------------------------------------

export interface RunSummary {
  won: boolean;
  /** Erreichte Spalte der Karte (1 = erste Station). */
  layer: number;
  layers: number;
  kills: number;
  crew: CrewId;
  heat: number;
  chests: number;
  hordes: number;
  scrapEarned: number;
  winches: number;
  bossKills: number;
  events: number;
  modules: number;
  /** Module auf Stufe 3. */
  maxed: number;
  /** Hoechste Stufe eines Teils. */
  partLevel: number;
  lead: number;
  seconds: number;
}

export function summarize(state: GameState, crew: CrewId): RunSummary {
  const parts = state.players.flatMap((p) => [p.parts.arm, p.parts.back]);
  return {
    won: state.phase === "won",
    layer: state.path.length - 1,
    layers: state.map.layers - 1,
    kills: state.kills,
    crew,
    heat: state.heat,
    chests: state.stats.chests,
    hordes: state.stats.hordes,
    scrapEarned: state.stats.scrapEarned,
    winches: state.stats.winches,
    bossKills: state.stats.bossKills,
    events: state.stats.events,
    modules: state.modules.length,
    maxed: state.modules.filter((m) => m.level >= 3).length,
    partLevel: Math.max(0, ...parts.map((p) => p?.level ?? 0)),
    lead: state.lead,
    seconds: Math.round(state.time),
  };
}

/** Altgold fuer einen Lauf: Weg, Gegner, Endgegner, Sieg - mehr auf hoeherer Hitze. */
export function altgoldFor(run: RunSummary): number {
  const base =
    run.layer * 12 +
    Math.floor(run.kills / 8) +
    run.bossKills * 40 +
    run.chests * 2 +
    (run.won ? 80 : 0);
  return Math.round(base * (1 + 0.15 * run.heat));
}

export interface AchievementSpec {
  id: string;
  name: string;
  text: string;
  /** Altgold, wenn man ihn zum ersten Mal schafft. */
  reward: number;
  check: (run: RunSummary, profile: Profile) => boolean;
}

export const ACHIEVEMENTS: readonly AchievementSpec[] = [
  {
    id: "erster-schritt",
    name: "Erste Schritte",
    text: "Die erste Station erreichen.",
    reward: 10,
    check: (r) => r.layer >= 1,
  },
  {
    id: "koloss",
    name: "Riesentöter",
    text: "Den Goldenen Koloss stürzen.",
    reward: 60,
    check: (r) => r.bossKills > 0,
  },
  {
    id: "sieg",
    name: "Durch die Rostdünen",
    text: "Akt 1 schaffen.",
    reward: 100,
    check: (r) => r.won,
  },
  {
    id: "pluenderer",
    name: "Plünderer",
    text: "8 Truhen in einem Lauf öffnen.",
    reward: 40,
    check: (r) => r.chests >= 8,
  },
  {
    id: "baumeister",
    name: "Baumeister",
    text: "15 Module gleichzeitig auf dem Deck.",
    reward: 40,
    check: (r) => r.modules >= 15,
  },
  {
    id: "meister",
    name: "Meisterwerk",
    text: "3 Module auf Stufe 3.",
    reward: 40,
    check: (r) => r.maxed >= 3,
  },
  {
    id: "heerschar",
    name: "Der Flut getrotzt",
    text: "Eine Heerschar überstehen.",
    reward: 30,
    check: (r) => r.hordes >= 1,
  },
  {
    id: "jaeger",
    name: "Knochenbrecher",
    text: "300 Gegner in einem Lauf.",
    reward: 40,
    check: (r) => r.kills >= 300,
  },
  {
    id: "sammler",
    name: "Schrottkönig",
    text: "600 Schrott in einem Lauf einnehmen.",
    reward: 40,
    check: (r) => r.scrapEarned >= 600,
  },
  {
    id: "ohne-winde",
    name: "Nie zurückgefallen",
    text: "Akt 1 schaffen, ohne dass die Seilwinde einen Mech holt.",
    reward: 50,
    check: (r) => r.won && r.winches === 0,
  },
  {
    id: "vorsprung",
    name: "Uneinholbar",
    text: "Akt 1 mit vollem Vorsprung schaffen.",
    reward: 50,
    check: (r) => r.won && r.lead >= 5,
  },
  {
    id: "teil",
    name: "Feinmechanik",
    text: "Ein Teil auf Stufe 3 bringen.",
    reward: 30,
    check: (r) => r.partLevel >= 3,
  },
  {
    id: "hitze3",
    name: "Heißer Sand",
    text: "Akt 1 auf Hitze 3 schaffen.",
    reward: 80,
    check: (r) => r.won && r.heat >= 3,
  },
  {
    id: "hitze6",
    name: "Glühender Sand",
    text: "Akt 1 auf Hitze 6 schaffen.",
    reward: 120,
    check: (r) => r.won && r.heat >= 6,
  },
  {
    id: "hitze10",
    name: "Sonnenfeuer",
    text: "Akt 1 auf Hitze 10 schaffen.",
    reward: 200,
    check: (r) => r.won && r.heat >= 10,
  },
  {
    id: "crew",
    name: "Volle Mannschaft",
    text: "Alle sechs Mechs freischalten.",
    reward: 60,
    check: (_r, p) => p.crew.length >= CREW_IDS.length,
  },
];

export interface RunReward {
  altgold: number;
  achievements: AchievementSpec[];
  /** Eine neue Hitze-Stufe wurde freigeschaltet. */
  heatUnlocked: number | null;
}

/** Lauf ins Profil eintragen: Altgold, Statistik, Erfolge, Hitze. Aendert das Profil. */
export function applyRun(profile: Profile, run: RunSummary): RunReward {
  let gold = altgoldFor(run);
  profile.stats.runs += 1;
  profile.stats.kills += run.kills;
  profile.stats.bestLayer = Math.max(profile.stats.bestLayer, run.layer);
  let heatUnlocked: number | null = null;
  if (run.won) {
    profile.stats.wins += 1;
    // Ein Sieg schaltet die naechste Hitze-Stufe frei.
    const next = Math.min(HEAT_MAX, run.heat + 1);
    if (next > profile.heatUnlocked) {
      profile.heatUnlocked = next;
      heatUnlocked = next;
    }
  }
  const earned = ACHIEVEMENTS.filter(
    (a) => !profile.achievements.includes(a.id) && a.check(run, profile),
  );
  for (const a of earned) {
    profile.achievements.push(a.id);
    gold += a.reward;
  }
  profile.altgold += gold;
  return { altgold: gold, achievements: earned, heatUnlocked };
}

/** Erfolge, die nicht an einen Lauf gebunden sind (z. B. nach dem Freischalten in der Werft). */
export function checkProfileAchievements(profile: Profile): AchievementSpec[] {
  const dummy: RunSummary = {
    won: false,
    layer: 0,
    layers: 0,
    kills: 0,
    crew: profile.selected,
    heat: 0,
    chests: 0,
    hordes: 0,
    scrapEarned: 0,
    winches: 0,
    bossKills: 0,
    events: 0,
    modules: 0,
    maxed: 0,
    partLevel: 0,
    lead: 0,
    seconds: 0,
  };
  const earned = ACHIEVEMENTS.filter(
    (a) => !profile.achievements.includes(a.id) && a.check(dummy, profile),
  );
  for (const a of earned) {
    profile.achievements.push(a.id);
    profile.altgold += a.reward;
  }
  return earned;
}
