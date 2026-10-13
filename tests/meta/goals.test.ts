import { describe, expect, it } from "vitest";
import { computeStats } from "../../src/game/data/stats";
import { FORGE, forgeBonus, forgeCost } from "../../src/meta/forge";
import { ACHIEVEMENTS, applyRun, buyForge, crystalsForRun, HERO_UNLOCKS, startBonus } from "../../src/meta/goals";
import { newProfile, parseProfile, type RunResult } from "../../src/meta/profile";
import { Simulation } from "../../src/game/Simulation";
import { decodeState, encodeState } from "../../src/net/protocol";

function run(overrides: Partial<RunResult> = {}): RunResult {
  return {
    character: "ritter",
    wave: 6,
    won: false,
    kills: 200,
    gold: 400,
    level: 5,
    maxTier: 2,
    weaponCount: 3,
    coop: false,
    ...overrides,
  };
}

describe("Fortschritt", () => {
  it("am Anfang ist nur der Ritter frei", () => {
    const profile = newProfile();
    expect(profile.unlocked).toEqual(["ritter"]);
    expect(profile.crystals).toBe(0);
  });

  it("spaetere Wellen bringen deutlich mehr Kristalle", () => {
    const early = crystalsForRun(run({ wave: 4, kills: 0 })).total;
    const late = crystalsForRun(run({ wave: 12, kills: 0 })).total;
    const won = crystalsForRun(run({ wave: 20, won: true, kills: 0 })).total;
    expect(late).toBeGreaterThan(early * 4);
    expect(won).toBeGreaterThan(late * 2);
  });

  it("ein Lauf traegt Summen ein, schaltet frei und vergibt Erfolge nur einmal", () => {
    const profile = newProfile();
    const first = applyRun(profile, run({ wave: 5 }));
    expect(profile.totals.runs).toBe(1);
    expect(first.unlocked).toContain("elfe");
    const ids = first.achievements.map((achievement) => achievement.id);
    expect(ids).toContain("erster-lauf");
    expect(ids).toContain("welle-5");
    const reward = first.achievements.reduce((sum, achievement) => sum + achievement.reward, 0);
    expect(profile.crystals).toBe(first.crystals + reward);

    const second = applyRun(profile, run({ wave: 5 }));
    expect(second.achievements.map((achievement) => achievement.id)).not.toContain("erster-lauf");
    expect(second.unlocked).toEqual([]);
  });

  it("jede Freischaltung hat eine erreichbare Bedingung", () => {
    const profile = newProfile();
    profile.best.wave = 20;
    profile.totals.kills = 1_000_000;
    profile.totals.gold = 1_000_000;
    for (const rule of Object.values(HERO_UNLOCKS)) {
      expect(rule.done(profile)).toBe(true);
    }
    expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("die Schmiede kostet steigend, hat ein Ende und braucht genug Kristalle", () => {
    const profile = newProfile();
    expect(buyForge(profile, "leben")).toBeNull();
    profile.crystals = 100_000;
    const def = FORGE.find((candidate) => candidate.id === "leben")!;
    let previous = 0;
    for (let level = 0; level < def.maxLevel; level += 1) {
      const cost = forgeCost("leben", level)!;
      expect(cost).toBeGreaterThan(previous);
      previous = cost;
      expect(buyForge(profile, "leben")).not.toBeNull();
    }
    expect(forgeCost("leben", def.maxLevel)).toBeNull();
    expect(buyForge(profile, "leben")).toBeNull();
    expect(profile.forge.leben).toBe(def.maxLevel);
  });

  it("Schmiede-Boni wirken in der Simulation (Leben, Startgold)", () => {
    const profile = newProfile();
    profile.forge = { leben: 2, kasse: 1 };
    const { bonus, startGold } = startBonus(profile);
    expect(forgeBonus(profile.forge).mods.maxHp).toBe(10);
    const plain = computeStats("ritter", [], []);
    const sim = new Simulation([{ id: "a", name: "A", character: "ritter", startWeapon: "spear", bonus, startGold }], 1);
    const player = sim.state.players[0]!;
    expect(player.stats.maxHp).toBe(plain.maxHp + 10);
    expect(player.gold).toBe(8);
    // Im Koop rechnet der Client die Werte selbst - die Boni muessen mit uebers Netz.
    const copy = decodeState(JSON.parse(JSON.stringify(encodeState(sim.state))));
    expect(copy.players[0]!.stats.maxHp).toBe(player.stats.maxHp);
  });

  it("ein kaputter oder alter Spielstand wird repariert statt abzustuerzen", () => {
    expect(parseProfile("kein json").unlocked).toEqual(["ritter"]);
    const old = parseProfile(JSON.stringify({ crystals: 42, unlocked: ["elfe"] }));
    expect(old.crystals).toBe(42);
    expect(old.unlocked).toContain("ritter");
    expect(old.unlocked).toContain("elfe");
    expect(old.totals.runs).toBe(0);
  });
});
