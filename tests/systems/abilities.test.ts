/**
 * Die zweite aktive Faehigkeit je Charakter.
 *
 * Geprueft wird die Wirkung, nicht die Darstellung: Blendet die Granate
 * wirklich im angegebenen Radius? Haelt die Schildwand gegnerische Schuesse
 * auf - und laesst sie die eigenen durch? Wurzelt der Laehmschuss?
 */

import { describe, expect, it } from "vitest";
import { ABILITIES, CHARACTERS } from "../../src/config/balance";
import { TICK_SECONDS } from "../../src/config/constants";
import { isAbilityReady, stepAbilities, tryAbility } from "../../src/systems/abilities";
import { createEnemy } from "../../src/systems/enemies";
import { spawnProjectile, stepProjectiles } from "../../src/systems/projectiles";
import { createWorld, stepWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";
import type { CharacterId } from "../../src/systems/types";

function world(character: CharacterId) {
  const state = createWorld([{ id: "p1", name: "Test", character }]);
  state.enemies.length = 0;
  state.walls.length = 0;
  const player = state.players[0];
  if (!player) {
    throw new Error("Testaufbau ohne Spieler");
  }
  return { state, player };
}

const useAbility = (aim?: { x: number; y: number }) =>
  makeInput({ x: 0, y: 0 }, { useAbility: true, abilityAim: aim ?? null });

describe("Abklingzeit", () => {
  it("startet bereit und ist nach dem Einsatz gesperrt", () => {
    const { state, player } = world("sniper");
    expect(isAbilityReady(player)).toBe(true);

    expect(tryAbility(state, player, useAbility({ x: 1, y: 0 }))).toBe(true);
    expect(isAbilityReady(player)).toBe(false);
    expect(player.abilityCooldown).toBeCloseTo(ABILITIES.sniper.cooldown, 5);

    // Ein zweiter Versuch prallt ab.
    expect(tryAbility(state, player, useAbility({ x: 1, y: 0 }))).toBe(false);
  });

  it("wird nach der vollen Abklingzeit wieder bereit", () => {
    const { state, player } = world("scout");
    tryAbility(state, player, useAbility({ x: 1, y: 0 }));

    const ticks = Math.ceil(ABILITIES.scout.cooldown / TICK_SECONDS) + 1;
    for (let i = 0; i < ticks; i += 1) {
      stepAbilities(state, TICK_SECONDS);
    }

    expect(isAbilityReady(player)).toBe(true);
  });

  it("nimmt ohne Zielrichtung die Blickrichtung der Figur", () => {
    const { state, player } = world("sniper");
    player.facing = { x: 0, y: -1 };

    tryAbility(state, player, useAbility());

    const shot = state.projectiles.find((entry) => entry.active);
    expect(shot?.velocity.y).toBeLessThan(0);
    expect(Math.abs(shot?.velocity.x ?? 99)).toBeLessThan(1);
  });
});

describe("Scout: Blendgranate", () => {
  it("blendet alle Gegner im Explosionsradius", () => {
    const { state, player } = world("scout");
    player.position.x = 100;
    player.position.y = 600;

    // Einer knapp im Radius, einer klar ausserhalb.
    const near = createEnemy(1, "runner", { x: 400, y: 600 }, 1, 1, false);
    const far = createEnemy(2, "runner", { x: 400, y: 900 }, 1, 1, false);
    state.enemies.push(near, far);

    tryAbility(state, player, useAbility({ x: 1, y: 0 }));
    // Fliegen lassen, bis die Wurfweite aufgebraucht ist.
    for (let i = 0; i < 40; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }

    expect(near.blinded).toBeGreaterThan(0);
    expect(far.blinded).toBe(0);
  });

  it("macht selbst keinen Schaden", () => {
    const { state, player } = world("scout");
    player.position.x = 100;
    player.position.y = 600;
    const enemy = createEnemy(1, "runner", { x: 300, y: 600 }, 1, 1, false);
    state.enemies.push(enemy);

    tryAbility(state, player, useAbility({ x: 1, y: 0 }));
    for (let i = 0; i < 40; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }

    expect(enemy.blinded).toBeGreaterThan(0);
    expect(enemy.health).toBe(enemy.maxHealth);
  });

  it("laesst einen geblendeten Schuetzen nicht mehr feuern", () => {
    const state = createWorld(soloSetup());
    state.enemies.length = 0;
    const player = state.players[0]!;
    const shooter = createEnemy(1, "shooter", { x: player.position.x + 250, y: player.position.y }, 1, 1, false);
    // Deutlich laenger als der Testlauf: Es geht darum, ob Blendung ueberhaupt
    // das Schiessen unterbindet - nicht darum, wann sie ausläuft.
    shooter.blinded = 10;
    state.enemies.push(shooter);

    const before = state.projectiles.filter((entry) => entry.active).length;
    for (let i = 0; i < 60; i += 1) {
      stepWorld(state, new Map(), TICK_SECONDS);
    }

    const enemyShots = state.projectiles.filter(
      (entry) => entry.active && entry.owner === "enemy",
    ).length;
    expect(enemyShots).toBe(before);
  });
});

describe("Tank: Schildwand", () => {
  it("stellt eine Wand in Blickrichtung auf, quer dazu", () => {
    const { state, player } = world("tank");
    player.position.x = 800;
    player.position.y = 600;

    tryAbility(state, player, useAbility({ x: 1, y: 0 }));

    expect(state.barriers).toHaveLength(1);
    const barrier = state.barriers[0]!;
    // Vor dem Spieler...
    expect(barrier.position.x).toBeCloseTo(800 + ABILITIES.tank.range, 5);
    expect(barrier.position.y).toBeCloseTo(600, 5);
    // ...und quer zur Blickrichtung, also senkrecht.
    expect(Math.abs(barrier.along.x)).toBeLessThan(1e-6);
    expect(Math.abs(barrier.along.y)).toBeCloseTo(1, 5);
  });

  it("verschwindet nach ihrer Standzeit", () => {
    const { state, player } = world("tank");
    tryAbility(state, player, useAbility({ x: 1, y: 0 }));

    const ticks = Math.ceil(ABILITIES.tank.duration / TICK_SECONDS) + 1;
    for (let i = 0; i < ticks; i += 1) {
      stepAbilities(state, TICK_SECONDS);
    }

    expect(state.barriers).toHaveLength(0);
  });

  it("blockt gegnerische Schuesse, laesst eigene durch", () => {
    const { state, player } = world("tank");
    player.position.x = 800;
    player.position.y = 600;
    tryAbility(state, player, useAbility({ x: 1, y: 0 }));

    const target = createEnemy(1, "runner", { x: 800 + ABILITIES.tank.range + 120, y: 600 }, 1, 1, false);
    state.enemies.push(target);

    // Gegnerischer Schuss von rechts auf den Spieler zu - die Wand liegt dazwischen.
    spawnProjectile(state, {
      owner: "enemy",
      ownerId: "e1",
      position: { x: 800 + ABILITIES.tank.range + 60, y: 600 },
      direction: { x: -1, y: 0 },
      speed: 600,
      damage: 500,
      range: 900,
      radius: 9,
      piercing: false,
    });
    for (let i = 0; i < 10; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }
    expect(player.health).toBe(player.maxHealth);

    // Eigener Schuss vom Spieler nach rechts - er muss durch.
    spawnProjectile(state, {
      owner: "player",
      ownerId: player.id,
      position: { x: 800, y: 600 },
      direction: { x: 1, y: 0 },
      speed: 600,
      damage: 300,
      range: 900,
      radius: 7,
      piercing: false,
    });
    for (let i = 0; i < 20; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }
    expect(target.health).toBeLessThan(target.maxHealth);
  });
});

describe("Sniper: Laehmschuss", () => {
  it("wurzelt den Getroffenen fest und macht weniger Schaden als ein Schuss", () => {
    const { state, player } = world("sniper");
    player.position.x = 100;
    player.position.y = 600;
    const enemy = createEnemy(1, "runner", { x: 400, y: 600 }, 1, 1, false);
    state.enemies.push(enemy);

    tryAbility(state, player, useAbility({ x: 1, y: 0 }));
    for (let i = 0; i < 60; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }

    expect(enemy.rooted).toBeCloseTo(ABILITIES.sniper.rootDuration, 5);
    expect(enemy.maxHealth - enemy.health).toBe(ABILITIES.sniper.damage);
    expect(ABILITIES.sniper.damage).toBeLessThan(CHARACTERS.sniper.shot.damage);
  });

  it("haelt einen gewurzelten Gegner tatsaechlich auf der Stelle", () => {
    const state = createWorld(soloSetup());
    state.enemies.length = 0;
    const player = state.players[0]!;
    const enemy = createEnemy(1, "runner", { x: player.position.x + 300, y: player.position.y }, 1, 1, false);
    enemy.rooted = 2;
    state.enemies.push(enemy);

    const before = { x: enemy.position.x, y: enemy.position.y };
    for (let i = 0; i < 30; i += 1) {
      stepWorld(state, new Map(), TICK_SECONDS);
    }

    expect(Math.hypot(enemy.position.x - before.x, enemy.position.y - before.y)).toBeLessThan(1);
  });
});
