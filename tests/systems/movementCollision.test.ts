import { describe, it } from "vitest";
import { TICK_SECONDS } from "../../src/config/constants";
import { CHARACTERS } from "../../src/config/balance";
import { stepPlayerMovement } from "../../src/systems/movement";
import { createWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";
import type { Rect } from "../../src/systems/types";

import { createArenaWalls } from "../../src/config/arena";

describe("Gleiten an Waenden", () => {
  it("laeuft einmal um einen Deckungsblock herum", () => {
    const block: Rect[] = [{ x: 400, y: 400, width: 200, height: 60 }];
    const state = createWorld(soloSetup());
    const player = state.players[0]!;
    player.position.x = 300;
    player.position.y = 480;
    player.velocity.x = 0;
    player.velocity.y = 0;

    // Gegen den Block druecken und einmal aussen herum: rechts, hoch, links.
    const legs: [string, { x: number; y: number }, number][] = [
      ["an die Unterkante", { x: 0, y: -1 }, 20],
      ["nach rechts entlang", { x: 1, y: -0.6 }, 60],
      ["um die rechte Ecke hoch", { x: 0.3, y: -1 }, 40],
      ["nach links entlang", { x: -1, y: -0.6 }, 60],
    ];
    let worst = Infinity;
    let stalls = 0;
    for (const [name, dir, ticks] of legs) {
      let legWorst = Infinity;
      for (let i = 0; i < ticks; i += 1) {
        const bx = player.position.x;
        const by = player.position.y;
        stepPlayerMovement(player, makeInput(dir), block, TICK_SECONDS);
        const step = Math.hypot(player.position.x - bx, player.position.y - by);
        if (i > 8) {
          legWorst = Math.min(legWorst, step);
          if (step < 0.5) stalls += 1;
        }
      }
      console.log(`  ${name.padEnd(24)} schlechtester Tick ${legWorst.toFixed(2)} px`);
      worst = Math.min(worst, legWorst);
    }
    console.log(`Block-Umrundung: schlechtester Tick ${worst.toFixed(2)} px, Stillstaende ${stalls}`);
  });

  it("kommt um eine Innenecke und um einen Block herum", () => {
    // Innenecke: zwei Waende, die ein L bilden.
    const inner: Rect[] = [
      { x: 0, y: 0, width: 800, height: 100 },
      { x: 0, y: 0, width: 100, height: 800 },
    ];
    const state = createWorld(soloSetup());
    const player = state.players[0]!;
    player.position.x = 130;
    player.position.y = 130;
    player.velocity.x = 0;
    player.velocity.y = 0;
    // Voll in die Ecke druecken, dann nach rechts wegziehen.
    for (let i = 0; i < 20; i += 1) {
      stepPlayerMovement(player, makeInput({ x: -1, y: -1 }), inner, TICK_SECONDS);
    }
    const cornerX = player.position.x;
    for (let i = 0; i < 20; i += 1) {
      stepPlayerMovement(player, makeInput({ x: 1, y: 0 }), inner, TICK_SECONDS);
    }
    console.log(
      `Innenecke: aus der Ecke heraus ${(player.position.x - cornerX).toFixed(0)} px ` +
        `(ideal ${(CHARACTERS.scout.speed * (20 / 30)).toFixed(0)} px)`,
    );
  });

  it("laeuft an der echten Arena entlang, ohne haengenzubleiben", () => {
    const walls = createArenaWalls();
    const speed = CHARACTERS.scout.speed;

    // Acht Richtungen, jeweils aus der Mitte der Arena heraus bis an den Rand
    // und dann quer weiter. Gemessen wird der schlechteste Tick.
    for (const [name, push, slide] of [
      ["oben", { x: 0, y: -1 }, { x: 1, y: -1 }],
      ["unten", { x: 0, y: 1 }, { x: 1, y: 1 }],
      ["links", { x: -1, y: 0 }, { x: -1, y: 1 }],
      ["rechts", { x: 1, y: 0 }, { x: 1, y: 1 }],
    ] as [string, { x: number; y: number }, { x: number; y: number }][]) {
      const state = createWorld(soloSetup());
      const player = state.players[0]!;
      // Erst an die Wand fahren.
      for (let i = 0; i < 200; i += 1) {
        stepPlayerMovement(player, makeInput(push), walls, TICK_SECONDS);
      }
      // Dann 60 Ticks schraeg daran entlang; den kleinsten Fortschritt merken.
      let worst = Infinity;
      let total = 0;
      for (let i = 0; i < 60; i += 1) {
        const bx = player.position.x;
        const by = player.position.y;
        stepPlayerMovement(player, makeInput(slide), walls, TICK_SECONDS);
        const step = Math.hypot(player.position.x - bx, player.position.y - by);
        total += step;
        if (i > 5) worst = Math.min(worst, step);
      }
      const idealStep = speed * TICK_SECONDS * 0.707;
      console.log(
        `Arena ${name.padEnd(7)} Schnitt ${(total / 60).toFixed(2)} px/Tick, ` +
          `schlechtester ${worst.toFixed(2)} px/Tick (ideal ${idealStep.toFixed(2)})`,
      );
    }
  });

  it("misst, wie viel Weg entlang der Wand ankommt", () => {
    const cases: [string, Rect, { x: number; y: number }, { x: number; y: number }][] = [
      // Waagerechte Wand oberhalb, Spieler drueckt schraeg nach oben-rechts
      ["waagerechte Wand", { x: 0, y: 0, width: 1200, height: 100 }, { x: 600, y: 130 }, { x: 0.707, y: -0.707 }],
      // Senkrechte Wand links, Spieler drueckt schraeg nach links-unten
      ["senkrechte Wand", { x: 0, y: 0, width: 100, height: 1200 }, { x: 130, y: 400 }, { x: -0.707, y: 0.707 }],
      // Kleiner Block: entlang der Kante und ueber die Ecke hinaus
      ["Block-Kante", { x: 300, y: 300, width: 200, height: 60 }, { x: 400, y: 340 }, { x: 0.707, y: -0.707 }],
    ];

    for (const [name, wall, start, dir] of cases) {
      const state = createWorld(soloSetup());
      const player = state.players[0]!;
      player.position.x = start.x;
      player.position.y = start.y;
      player.velocity.x = 0;
      player.velocity.y = 0;
      const walls: Rect[] = [wall];

      const speed = CHARACTERS.scout.speed;
      const TICKS = 30; // eine Sekunde
      const before = { x: player.position.x, y: player.position.y };
      for (let i = 0; i < TICKS; i += 1) {
        stepPlayerMovement(player, makeInput(dir), walls, TICK_SECONDS);
      }
      const moved = Math.hypot(player.position.x - before.x, player.position.y - before.y);
      // Ideal: die Komponente laengs der Wand, also speed * 0.707 * 1 Sekunde,
      // minus die Beschleunigungszeit.
      const ideal = speed * 0.707;
      console.log(
        `${name.padEnd(18)} Weg ${moved.toFixed(0).padStart(4)} px von ideal ${ideal.toFixed(0)} px ` +
          `= ${((moved / ideal) * 100).toFixed(0)} %`,
      );
    }
  });
});
