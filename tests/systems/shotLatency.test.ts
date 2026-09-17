/**
 * Messung: Wie lange dauert es vom Antippen bis zum Projektil?
 *
 * Der Weg ist: Finger -> TouchControls -> InputState -> ein Simulationsschritt
 * -> Projektil. Die Simulation rechnet 30 Mal pro Sekunde, der Bildschirm
 * zeichnet meist 60 Mal - es gibt also Bilder, in denen gar kein Schritt
 * gerechnet wird. Genau dort ging ein kurzes Antippen frueher verloren.
 *
 * Diese Tests halten zwei Dinge fest:
 * 1. Liegt Munition bereit, faellt der Schuss im allerersten Schritt - keine
 *    zusaetzliche Verzoegerung durch das Nachladen.
 * 2. Die Ladungen laden einzeln nach, nicht gemeinsam.
 */

import { describe, expect, it } from "vitest";
import { CHARACTERS, PLAYER } from "../../src/config/balance";
import { TICK_MS, TICK_SECONDS } from "../../src/config/constants";
import { ammoCount, stepReload, tryShoot } from "../../src/systems/combat";
import { activeProjectileCount } from "../../src/systems/projectiles";
import { createWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";

function setup() {
  const state = createWorld(soloSetup());
  state.enemies.length = 0;
  const player = state.players[0];
  if (!player) {
    throw new Error("Testaufbau ohne Spieler");
  }
  return { state, player };
}

describe("Verzoegerung vom Antippen bis zum Schuss", () => {
  it("schiesst im ersten Simulationsschritt nach dem Antippen", () => {
    const { state, player } = setup();

    const fired = tryShoot(state, player, makeInput({ x: 0, y: 0 }, { fire: true }));

    expect(fired).toBe(true);
    expect(activeProjectileCount(state)).toBeGreaterThan(0);
  });

  it("meldet die Verzoegerung in Millisekunden", () => {
    const { state, player } = setup();

    let ticks = 0;
    // Hoechstens eine Sekunde probieren - laenger darf es nie dauern.
    while (ticks < 30 && !tryShoot(state, player, makeInput({ x: 0, y: 0 }, { fire: true }))) {
      stepReload(player, TICK_SECONDS);
      ticks += 1;
    }

    const simulationMs = ticks * TICK_MS;
    // Dazu kommt die Wartezeit bis zum naechsten Tick: hoechstens eine volle
    // Tickdauer, im Schnitt die Haelfte.
    console.log(
      `Antippen bis Projektil: ${simulationMs.toFixed(1)} ms in der Simulation, ` +
        `plus 0 bis ${TICK_MS.toFixed(1)} ms Wartezeit auf den naechsten Tick ` +
        `(im Schnitt rund ${(simulationMs + TICK_MS / 2).toFixed(0)} ms).`,
    );

    expect(simulationMs).toBe(0);
  });

  it("laedt die Ladungen einzeln nach, nicht gemeinsam", () => {
    const { state, player } = setup();
    const reloadTime = CHARACTERS[player.character].reloadTime;

    // Alle Ladungen verschiessen, mit etwas Abstand dazwischen.
    for (let i = 0; i < PLAYER.ammoCharges; i += 1) {
      expect(tryShoot(state, player, makeInput({ x: 0, y: 0 }, { fire: true }))).toBe(true);
      for (let t = 0; t < 8; t += 1) {
        stepReload(player, TICK_SECONDS);
      }
    }
    expect(ammoCount(player)).toBe(0);

    // Nach der Nachladezeit der ERSTEN Ladung ist genau eine wieder da -
    // nicht alle drei. Waere es ein gemeinsamer Zaehler, kaemen alle auf einmal.
    let elapsed = 8 * PLAYER.ammoCharges * TICK_SECONDS;
    while (elapsed < reloadTime + TICK_SECONDS) {
      stepReload(player, TICK_SECONDS);
      elapsed += TICK_SECONDS;
    }

    expect(ammoCount(player)).toBe(1);
  });

  it("begrenzt die Schussfolge, laesst aber keine Ladung verfallen", () => {
    const { state, player } = setup();

    // Dauerfeuer: Der Schusstakt erlaubt hoechstens einen Schuss je
    // PLAYER.shootCooldown, auch wenn drei Ladungen bereitliegen.
    let shots = 0;
    for (let tick = 0; tick < 6; tick += 1) {
      stepReload(player, TICK_SECONDS);
      if (tryShoot(state, player, makeInput({ x: 0, y: 0 }, { fire: true }))) {
        shots += 1;
      }
    }

    const maxShots = Math.floor((6 * TICK_SECONDS) / PLAYER.shootCooldown) + 1;
    expect(shots).toBeGreaterThan(0);
    expect(shots).toBeLessThanOrEqual(maxShots);
  });
});
