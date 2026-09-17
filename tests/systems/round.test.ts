/**
 * Integrationstest: eine ganze Runde ohne Phaser durchspielen.
 *
 * Das geht nur, weil die Simulation ohne Darstellung laufen kann - genau dafuer
 * ist die Architektur-Grundregel da. Der Test faengt die unangenehmste Fehlerart
 * bei Wellenspielen ab: eine Welle, die nie endet, weil ein Gegner irgendwo
 * feststeckt.
 */

import { describe, expect, it } from "vitest";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { nearestEnemy } from "../../src/systems/targeting";
import { createWorld, stepWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";
import type { InputState } from "../../src/systems/types";

/** Ein Spieler, der immer auf den naechsten Gegner feuert und stehen bleibt. */
function autoInput(state: ReturnType<typeof createWorld>): Map<string, InputState> {
  const player = state.players[0];
  if (!player) {
    return new Map();
  }

  const target = nearestEnemy(state, player.position, 4000);
  const aim = target
    ? {
        x: target.position.x - player.position.x,
        y: target.position.y - player.position.y,
      }
    : null;

  const length = aim ? Math.hypot(aim.x, aim.y) : 0;

  return new Map([
    [
      player.id,
      makeInput(
        { x: 0, y: 0 },
        {
          aim: aim && length > 1e-6 ? { x: aim.x / length, y: aim.y / length } : null,
          fire: true,
        },
      ),
    ],
  ]);
}

describe("Ganze Runde", () => {
  it("laesst sich mindestens bis Welle 3 durchspielen, ohne haengen zu bleiben", () => {
    const state = createWorld(soloSetup(), 12345);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    // Unverwundbar machen: Hier wird geprueft, ob Wellen enden, nicht ob man
    // sie ueberlebt.
    player.maxHealth = 1e9;
    player.health = 1e9;

    const maxTicks = TICK_RATE * 180;
    for (let i = 0; i < maxTicks && state.wave < 3; i += 1) {
      player.health = player.maxHealth;
      stepWorld(state, autoInput(state), TICK_SECONDS);
    }

    expect(state.wave).toBeGreaterThanOrEqual(3);
    expect(state.score).toBeGreaterThan(0);
  });

  it("endet mit Game Over, wenn der Spieler nichts tut", () => {
    const state = createWorld(soloSetup(), 999);
    const idle = new Map<string, InputState>();

    const maxTicks = TICK_RATE * 240;
    for (let i = 0; i < maxTicks && state.phase !== "gameover"; i += 1) {
      stepWorld(state, idle, TICK_SECONDS);
    }

    expect(state.phase).toBe("gameover");
  });

  it("haelt die Gegnerzahl unter dem harten Limit", () => {
    const state = createWorld(soloSetup(), 7);
    const idle = new Map<string, InputState>();
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    let peak = 0;
    for (let i = 0; i < TICK_RATE * 120; i += 1) {
      player.health = player.maxHealth;
      stepWorld(state, idle, TICK_SECONDS);
      peak = Math.max(peak, state.enemies.length);
    }

    expect(peak).toBeLessThanOrEqual(40);
  });
});
