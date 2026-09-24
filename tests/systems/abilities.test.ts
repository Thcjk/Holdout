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
import {
  isAbilityReady,
  stepAbilities,
  stepHealFields,
  tryAbility,
} from "../../src/systems/abilities";
import { createEnemy } from "../../src/systems/enemies";
import { stepProjectiles } from "../../src/systems/projectiles";
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

describe("Scout: Splittergranate", () => {
  it("macht Schaden an allen Gegnern im Radius - und an keinem ausserhalb", () => {
    const { state, player } = world("scout");
    player.position.x = 100;
    player.position.y = 600;

    // Drei Gegner dicht beieinander am Einschlagsort, einer klar ausserhalb.
    const treffer = [
      createEnemy(1, "runner", { x: 500, y: 600 }, 1, 1, false),
      createEnemy(2, "runner", { x: 500, y: 660 }, 1, 1, false),
      createEnemy(3, "runner", { x: 500, y: 540 }, 1, 1, false),
    ];
    const daneben = createEnemy(4, "runner", { x: 500, y: 1000 }, 1, 1, false);
    state.enemies.push(...treffer, daneben);
    const vorher = treffer.map((enemy) => enemy.health);

    tryAbility(state, player, useAbility({ x: 1, y: 0 }));
    for (let i = 0; i < 40; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }

    /*
     * Jeder im Radius muss Schaden bekommen haben - auch die spaeteren in der
     * Liste. Genau hier schlaegt der Fehler zu, wenn `detonate` waehrend des
     * Durchlaufens toetet: Dann ruecken die Eintraege nach und jeder zweite
     * bliebe unversehrt.
     */
    treffer.forEach((enemy, index) => {
      expect(enemy.health).toBeLessThan(vorher[index]!);
    });
    expect(daneben.health).toBe(daneben.maxHealth);
  });

  it("toetet schwache Gegner wirklich, statt sie mit 0 Leben weiterlaufen zu lassen", () => {
    const { state, player } = world("scout");
    player.position.x = 100;
    player.position.y = 600;

    const enemy = createEnemy(1, "runner", { x: 500, y: 600 }, 1, 1, false);
    enemy.health = 50;
    state.enemies.push(enemy);

    tryAbility(state, player, useAbility({ x: 1, y: 0 }));
    for (let i = 0; i < 40; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }

    // Aus der Liste entfernt heisst: ueber `damageEnemy` gestorben, mit Punkten
    // und Todesmeldung - nicht bloss auf null Leben gesetzt.
    expect(state.enemies).toHaveLength(0);
    expect(state.score).toBeGreaterThan(0);
  });

  it("explodiert auch, wenn der Wurf ins Leere geht", () => {
    const { state, player } = world("scout");
    player.position.x = 100;
    player.position.y = 600;

    // Der Gegner steht seitlich am Ende der Wurfweite - die Granate trifft ihn
    // nicht direkt, muss ihn aber am Ende der Flugbahn noch erwischen.
    const enemy = createEnemy(1, "runner", { x: 100 + ABILITIES.scout.range, y: 680 }, 1, 1, false);
    state.enemies.push(enemy);

    tryAbility(state, player, useAbility({ x: 1, y: 0 }));
    for (let i = 0; i < 60; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }

    expect(enemy.health).toBeLessThan(enemy.maxHealth);
  });
});

describe("Tank: Heilfeld (Etappe 10)", () => {
  function team() {
    const state = createWorld([
      { id: "tank", name: "T", character: "tank" },
      { id: "near", name: "N", character: "scout" },
      { id: "far", name: "F", character: "sniper" },
      { id: "down", name: "D", character: "scout" },
    ]);
    state.enemies.length = 0;
    state.walls.length = 0;
    const [tank, near, far, down] = state.players;
    if (!tank || !near || !far || !down) throw new Error("Testaufbau");
    tank.position = { x: 1000, y: 1000 };
    near.position = { x: 1000 + ABILITIES.tank.radius - 20, y: 1000 };
    far.position = { x: 1000 + ABILITIES.tank.radius + 60, y: 1000 };
    down.position = { x: 1000, y: 1060 };
    for (const player of state.players) {
      player.health = player.maxHealth - 1000;
    }
    down.down = true;
    return { state, tank, near, far, down };
  }

  it("heilt alle Stehenden im Radius um 80 je Sekunde, drei Sekunden lang", () => {
    const { state, tank, near } = team();
    const start = near.health;
    tryAbility(state, tank, useAbility());

    for (let i = 0; i < Math.round(4 / TICK_SECONDS); i += 1) {
      stepHealFields(state, TICK_SECONDS);
    }

    const expected = ABILITIES.tank.healPerSecond * ABILITIES.tank.duration;
    expect(near.health - start).toBeCloseTo(expected, 0);
    // Auch der Tank selbst steht im Feld.
    expect(tank.health - (tank.maxHealth - 1000)).toBeCloseTo(expected, 0);
    // Nach Ablauf ist das Feld weg.
    expect(tank.healField).toBe(0);
  });

  it("heilt niemanden ausserhalb des Radius und niemanden am Boden", () => {
    const { state, tank, far, down } = team();
    const farBefore = far.health;
    const downBefore = down.health;
    tryAbility(state, tank, useAbility());
    for (let i = 0; i < Math.round(4 / TICK_SECONDS); i += 1) {
      stepHealFields(state, TICK_SECONDS);
    }
    expect(far.health).toBe(farBefore);
    expect(down.health).toBe(downBefore);
  });

  it("meldet die Heilung gesammelt je Sekunde, nicht dreissigmal", () => {
    const { state, tank } = team();
    tryAbility(state, tank, useAbility());
    state.events.length = 0;
    const events: number[] = [];
    for (let i = 0; i < Math.round(4 / TICK_SECONDS); i += 1) {
      stepHealFields(state, TICK_SECONDS);
      for (const event of state.events) {
        if (event.type === "healed" && event.playerId === "tank") events.push(event.amount);
      }
      state.events.length = 0;
    }
    // Drei Sekunden -> drei Meldungen (plus hoechstens eine fuer den Rest).
    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events.length).toBeLessThanOrEqual(4);
  });

  it("dreht die Blickrichtung nicht - sie wirkt um einen selbst", () => {
    const { state, player } = world("tank");
    player.facing = { x: 0, y: -1 };

    tryAbility(state, player, useAbility({ x: 1, y: 0 }));

    expect(player.facing.x).toBe(0);
    expect(player.facing.y).toBe(-1);
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
