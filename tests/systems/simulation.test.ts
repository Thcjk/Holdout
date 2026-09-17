import { describe, expect, it } from "vitest";
import { MAX_TICKS_PER_FRAME, TICK_MS, TICK_RATE } from "../../src/config/constants";
import { Simulation } from "../../src/systems/Simulation";
import { makeInput, soloSetup } from "../helpers";

const PLAYER_ID = "p1";

function inputs(x: number, y: number) {
  return new Map([[PLAYER_ID, makeInput({ x, y })]]);
}

describe("Simulation", () => {
  it("rechnet in einer Sekunde Spielzeit genau so viele Ticks wie eingestellt", () => {
    const simulation = new Simulation(soloSetup(PLAYER_ID));

    // Eine Sekunde in normalen 60-fps-Bildern, nicht in einem Sprung:
    // ein einzelner Sprung ueber eine Sekunde ist ein Haenger und wird gedeckelt.
    for (let i = 0; i < 60; i += 1) {
      simulation.advance(1000 / 60, inputs(0, 0));
    }

    expect(simulation.state.tick).toBe(TICK_RATE);
  });

  it("rechnet keinen Tick, solange noch keine volle Tickdauer vergangen ist", () => {
    const simulation = new Simulation(soloSetup(PLAYER_ID));

    expect(simulation.advance(TICK_MS / 2, inputs(0, 0))).toBe(0);
    expect(simulation.state.tick).toBe(0);
    expect(simulation.alpha).toBeCloseTo(0.5, 6);
  });

  it("holt nach einem langen Hänger nicht beliebig viele Ticks nach", () => {
    const simulation = new Simulation(soloSetup(PLAYER_ID));

    const ticks = simulation.advance(10_000, inputs(0, 0));

    expect(ticks).toBe(MAX_TICKS_PER_FRAME);
    expect(simulation.alpha).toBe(0);
  });

  it("liefert unabhaengig von der Bildrate denselben Zustand", () => {
    // Derselbe Zeitraum, einmal in 60-fps-Schritten, einmal in 30-fps-Schritten.
    const fast = new Simulation(soloSetup(PLAYER_ID));
    const slow = new Simulation(soloSetup(PLAYER_ID));

    for (let i = 0; i < 120; i += 1) {
      fast.advance(1000 / 60, inputs(1, 0));
    }
    for (let i = 0; i < 60; i += 1) {
      slow.advance(1000 / 30, inputs(1, 0));
    }

    expect(fast.state.tick).toBe(slow.state.tick);
    expect(fast.state.players[0]?.position.x).toBeCloseTo(
      slow.state.players[0]?.position.x ?? 0,
      6,
    );
  });

  it("interpoliert die gezeichnete Position zwischen zwei Ticks", () => {
    const simulation = new Simulation(soloSetup(PLAYER_ID));
    for (let i = 0; i < 20; i += 1) {
      simulation.advance(TICK_MS, inputs(1, 0));
    }

    const player = simulation.state.players[0];
    expect(player).toBeDefined();

    // Direkt nach einem vollen Tick ist alpha 0, also entspricht die
    // Zeichenposition der Position vor dem letzten Tick.
    expect(simulation.alpha).toBeCloseTo(0, 6);
    const atTick = simulation.renderPlayerPosition(PLAYER_ID);
    expect(atTick.x).toBeLessThan(player?.position.x ?? 0);

    // Ein halber Tick weiter: noch kein neuer Schritt, aber die gezeichnete
    // Position ist auf halbem Weg - genau das verhindert das 30-Hz-Ruckeln.
    expect(simulation.advance(TICK_MS / 2, inputs(1, 0))).toBe(0);
    expect(simulation.alpha).toBeCloseTo(0.5, 6);
    const halfway = simulation.renderPlayerPosition(PLAYER_ID);
    expect(halfway.x).toBeGreaterThan(atTick.x);
    expect(halfway.x).toBeLessThan(player?.position.x ?? 0);
  });

  it("haelt den Spieler innerhalb der Arena, egal wie lange er gegen die Wand laeuft", () => {
    const simulation = new Simulation(soloSetup(PLAYER_ID));

    for (let i = 0; i < 600; i += 1) {
      simulation.advance(TICK_MS, inputs(-1, -1));
    }

    const player = simulation.state.players[0];
    expect(player).toBeDefined();
    expect(player?.position.x).toBeGreaterThan(simulation.state.bounds.x);
    expect(player?.position.y).toBeGreaterThan(simulation.state.bounds.y);
  });
});
