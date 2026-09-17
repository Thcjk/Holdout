import { describe, expect, it } from "vitest";
import { CHARACTERS, SKILLS, SKILL_POINTS_PER_WAVE } from "../../src/config/balance";
import { TICK_SECONDS } from "../../src/config/constants";
import { tryShoot } from "../../src/systems/combat";
import { stepPlayerMovement } from "../../src/systems/movement";
import {
  applyLevelUp,
  canLevelUp,
  damageFactor,
  maxHealthFor,
  speedFor,
} from "../../src/systems/skills";
import { startWave, stepRound } from "../../src/systems/waves";
import { createWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";

function world() {
  const state = createWorld(soloSetup());
  state.enemies.length = 0;
  const player = state.players[0];
  if (!player) throw new Error("Testaufbau");
  return { state, player };
}

describe("Skillpunkte", () => {
  it("gibt pro geschaffter Welle einen Punkt", () => {
    const { state, player } = world();
    startWave(state, 1);
    state.pendingSpawns.length = 0;

    stepRound(state, TICK_SECONDS);

    expect(player.skillPoints).toBe(SKILL_POINTS_PER_WAVE);
  });

  it("verteilt ohne Punkt nichts", () => {
    const { state, player } = world();

    expect(canLevelUp(player, "weapon")).toBe(false);
    expect(applyLevelUp(state, player, "weapon")).toBe(false);
    expect(player.skills.weapon).toBe(0);
  });

  it("verbraucht genau einen Punkt pro Stufe und meldet das Ereignis", () => {
    const { state, player } = world();
    player.skillPoints = 2;

    expect(applyLevelUp(state, player, "weapon")).toBe(true);

    expect(player.skills.weapon).toBe(1);
    expect(player.skillPoints).toBe(1);
    expect(state.events.some((event) => event.type === "levelUp")).toBe(true);
  });

  it("hört bei der Höchststufe auf", () => {
    const { state, player } = world();
    player.skillPoints = 99;

    for (let i = 0; i < SKILLS.weapon.maxLevel + 3; i += 1) {
      applyLevelUp(state, player, "weapon");
    }

    expect(player.skills.weapon).toBe(SKILLS.weapon.maxLevel);
    expect(canLevelUp(player, "weapon")).toBe(false);
  });
});

describe("Wirkung der Fähigkeiten", () => {
  it("erhöht mit der Panzerung Höchstleben UND aktuelles Leben", () => {
    const { state, player } = world();
    player.skillPoints = 1;
    player.health = player.maxHealth;
    const before = player.maxHealth;

    applyLevelUp(state, player, "armor");

    expect(player.maxHealth).toBeGreaterThan(before);
    expect(player.health).toBe(player.maxHealth);
    expect(player.maxHealth).toBe(maxHealthFor(player));
  });

  it("lässt den Lebensbalken beim Aufwerten nicht leerer aussehen", () => {
    const { state, player } = world();
    player.skillPoints = 1;
    player.health = Math.round(player.maxHealth * 0.5);
    const fractionBefore = player.health / player.maxHealth;

    applyLevelUp(state, player, "armor");

    expect(player.health / player.maxHealth).toBeGreaterThanOrEqual(fractionBefore);
  });

  it("macht die Figur mit Tempo schneller", () => {
    const { state, player } = world();
    const base = speedFor(player);
    player.skillPoints = 2;

    applyLevelUp(state, player, "speed");
    applyLevelUp(state, player, "speed");

    expect(speedFor(player)).toBeCloseTo(base * (1 + 2 * SKILLS.speed.perLevel), 6);
  });

  it("beschleunigt mit Tempo auch die tatsächliche Bewegung", () => {
    const plain = world();
    const fast = world();
    fast.player.skillPoints = 5;
    for (let i = 0; i < 5; i += 1) {
      applyLevelUp(fast.state, fast.player, "speed");
    }

    for (let i = 0; i < 30; i += 1) {
      stepPlayerMovement(plain.player, makeInput({ x: 1, y: 0 }), [], TICK_SECONDS);
      stepPlayerMovement(fast.player, makeInput({ x: 1, y: 0 }), [], TICK_SECONDS);
    }

    expect(fast.player.position.x).toBeGreaterThan(plain.player.position.x);
  });

  it("erhöht mit der Waffe den Schaden der Projektile", () => {
    const { state, player } = world();
    player.skillPoints = 3;
    for (let i = 0; i < 3; i += 1) {
      applyLevelUp(state, player, "weapon");
    }

    tryShoot(state, player, makeInput({ x: 0, y: 0 }, { aim: { x: 1, y: 0 }, fire: true }));

    const shot = state.projectiles.find((entry) => entry.active);
    const expected = Math.round(CHARACTERS.scout.shot.damage * damageFactor(player));
    expect(shot?.damage).toBe(expected);
  });

  it("lädt den Super mit der Super-Fähigkeit schneller auf", () => {
    const { state, player } = world();
    player.skillPoints = 4;
    for (let i = 0; i < 4; i += 1) {
      applyLevelUp(state, player, "super");
    }

    expect(damageFactor(player)).toBe(1);
    expect(player.skills.super).toBe(4);
  });
});
