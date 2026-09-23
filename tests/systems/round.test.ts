/**
 * Integrationstest: einen ganzen Run ohne Phaser durchspielen.
 *
 * Das geht nur, weil die Simulation ohne Darstellung laufen kann - genau dafuer
 * ist die Architektur-Grundregel da.
 *
 * Seit Phase 8 faengt der Test eine andere Fehlerart ab als frueher. Bei Wellen
 * war die Sorge "eine Welle endet nie, weil ein Gegner feststeckt". Jetzt ist
 * sie: "man kommt nicht vorwaerts" - weil die generierte Welt einen einschliesst
 * oder weil ueberhaupt keine Gegner mehr nachkommen.
 */

import { describe, expect, it } from "vitest";
import { TICK_RATE, TICK_SECONDS } from "../../src/config/constants";
import { nearestEnemy } from "../../src/systems/targeting";
import { createWorld, stepWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";
import type { InputState } from "../../src/systems/types";

/**
 * Ein Spieler, der nach aussen laeuft und dabei auf den naechsten Gegner feuert.
 *
 * Nach AUSSEN, weil dort die Schwierigkeit steigt: Wer stehen bleibt, erreicht
 * nie eine neue Zone - und genau das soll der Test messen.
 */
function autoInput(state: ReturnType<typeof createWorld>): Map<string, InputState> {
  const player = state.players[0];
  if (!player) {
    return new Map();
  }

  const center = { x: state.bounds.width / 2, y: state.bounds.height / 2 };
  const outward = {
    x: player.position.x - center.x,
    y: player.position.y - center.y,
  };
  const outLength = Math.hypot(outward.x, outward.y);
  // Am Startpunkt zeigt "nach aussen" nirgendwohin - dann einfach nach rechts.
  const move =
    outLength > 1 ? { x: outward.x / outLength, y: outward.y / outLength } : { x: 1, y: 0 };

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
        move,
        {
          aim: aim && length > 1e-6 ? { x: aim.x / length, y: aim.y / length } : null,
          fire: true,
        },
      ),
    ],
  ]);
}

describe("Ganze Runde", () => {
  it("laesst sich mindestens bis Zone 3 durchspielen, ohne haengen zu bleiben", () => {
    const state = createWorld(soloSetup(), 12345);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    // Unverwundbar machen: Hier wird geprueft, ob man vorwaerts kommt und ob
    // Gegner nachkommen - nicht, ob man das ueberlebt.
    player.maxHealth = 1e9;
    player.health = 1e9;

    let sawEnemies = false;
    const maxTicks = TICK_RATE * 180;
    for (let i = 0; i < maxTicks && state.deepestZone < 3; i += 1) {
      player.health = player.maxHealth;
      stepWorld(state, autoInput(state), TICK_SECONDS);
      if (state.enemies.length > 0) {
        sawEnemies = true;
      }
    }

    expect(state.deepestZone).toBeGreaterThanOrEqual(3);
    // Ohne diese Zeile wuerde der Test auch auf einer voellig leeren Welt
    // bestehen - man kann ja immer nach aussen laufen.
    expect(sawEnemies).toBe(true);
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
