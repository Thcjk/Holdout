/**
 * Die beiden Angriffsmuster des Bosses.
 *
 * Geprueft wird die Wirkung, nicht die Darstellung - und vor allem die eine
 * Zusicherung, an der die Fairness haengt: DER SCHADEN KOMMT ERST NACH DER
 * VORWARNUNG. Ein Boss, der sofort zuschlaegt, waere kein schwerer Gegner,
 * sondern ein unlesbarer.
 */

import { describe, expect, it } from "vitest";
import { BOSS } from "../../src/config/balance";
import { TICK_SECONDS } from "../../src/config/constants";
import { stepBoss } from "../../src/systems/boss";
import { createEnemy } from "../../src/systems/enemies";
import { createWorld } from "../../src/systems/world";
import { soloSetup } from "../helpers";
import type { EnemyState, WorldState } from "../../src/systems/types";

/** Eine Welt mit einem Boss und einem Spieler in gegebener Entfernung. */
function setup(distance: number): { state: WorldState; boss: EnemyState } {
  const state = createWorld(soloSetup(), 4242);
  state.enemies.length = 0;
  state.projectiles.forEach((projectile) => (projectile.active = false));
  /*
   * Freies Feld - und das ist kein Weichspuelen des Tests, sondern seine
   * Voraussetzung.
   *
   * Geprueft werden hier die ANGRIFFSMUSTER, nicht die Karte. Steht zufaellig
   * eine Wand zwischen Boss und Spieler, schiesst er zu Recht nicht - der Test
   * wuerde dann melden "die Salve ist kaputt", obwohl alles richtig ist.
   *
   * Genau das ist beim Einbau der Gebaeude passiert: Der Test fiel durch, weil
   * eine Hauswand des Seeds 4242 in die Schusslinie geriet. Dass Waende
   * wirken, prueft der Test "schiesst nicht durch eine Wand" weiter unten -
   * mit einer Wand, die er selbst hinstellt und deren Lage damit feststeht.
   */
  state.walls = [];

  const player = state.players[0];
  if (!player) throw new Error("Testaufbau");
  player.position.x = 5000;
  player.position.y = 5000;
  // Unverwundbarkeit aus: Sie wuerde den zweiten Treffer schlucken.
  player.invulnerable = 0;

  const boss = createEnemy(1, "boss", { x: 5000 + distance, y: 5000 }, 1, 1, false);
  state.enemies.push(boss);

  return { state, boss };
}

/** Laesst nur die Boss-Logik laufen, ohne Bewegung und ohne Gegner-KI. */
function runBoss(state: WorldState, boss: EnemyState, seconds: number): void {
  const player = state.players[0] ?? null;
  const ticks = Math.round(seconds / TICK_SECONDS);
  for (let i = 0; i < ticks; i += 1) {
    state.events.length = 0;
    stepBoss(state, boss, player, TICK_SECONDS);
  }
}

describe("Boss: Schockwelle", () => {
  it("kuendigt an, bevor sie wehtut", () => {
    const { state, boss } = setup(100);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    const before = player.health;

    // Bis kurz vor dem Einschlag: Es gab eine Warnung, aber noch keinen Schaden.
    runBoss(state, boss, BOSS.slam.windupSeconds + 1.4);
    expect(boss.boss?.slamWindup).toBeGreaterThan(0);
    expect(player.health).toBe(before);

    // Und jetzt.
    runBoss(state, boss, BOSS.slam.windupSeconds);
    expect(player.health).toBeLessThan(before);
  });

  it("trifft nur, wer im angezeigten Kreis steht", () => {
    // Knapp ausserhalb des Radius - der Kreis auf dem Boden ist genau dieser
    // Radius, also darf hier nichts passieren. Eine Wirkung, die weiter reicht
    // als die Anzeige, waere schlimmer als gar keine Anzeige.
    const { state, boss } = setup(BOSS.slam.radius + 60);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");
    // Nah genug zum Ausloesen, zu weit zum Getroffenwerden gibt es nicht -
    // deshalb von Hand ausloesen und danach wegstellen.
    boss.position.x = player.position.x + 100;
    runBoss(state, boss, 1.6);
    expect(boss.boss?.slamWindup).toBeGreaterThan(0);

    boss.position.x = player.position.x + BOSS.slam.radius + 60;
    const before = player.health;
    runBoss(state, boss, BOSS.slam.windupSeconds + 0.1);

    expect(player.health).toBe(before);
  });

  it("stoesst den Getroffenen aus der Flaeche", () => {
    const { state, boss } = setup(100);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    runBoss(state, boss, 1.5 + BOSS.slam.windupSeconds + 0.1);

    // Der Boss steht rechts, der Spieler muss also nach links geschoben werden.
    expect(player.velocity.x).toBeLessThan(0);
  });

  it("bricht eine begonnene Schockwelle ab, wenn der Boss betaeubt wird", () => {
    const { state, boss } = setup(100);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    runBoss(state, boss, 1.6);
    expect(boss.boss?.slamWindup).toBeGreaterThan(0);

    // Betaeubt (Tank-Super). Der Warnkreis waere weg - der Schaden darf dann
    // nicht trotzdem kommen.
    boss.stunned = 2;
    const before = player.health;
    runBoss(state, boss, BOSS.slam.windupSeconds + 0.2);

    expect(boss.boss?.slamWindup).toBe(0);
    expect(player.health).toBe(before);
  });
});

describe("Boss: Salve", () => {
  it("schiesst auf Distanz statt zu stampfen", () => {
    const { state, boss } = setup(BOSS.slam.triggerRange + 300);

    runBoss(state, boss, 2.0);

    const active = state.projectiles.filter((projectile) => projectile.active);
    expect(active.length).toBe(BOSS.salvo.bullets);
    expect(active.every((projectile) => projectile.owner === "enemy")).toBe(true);
    // Kein Stampfen: Dafuer ist niemand nah genug.
    expect(boss.boss?.slamWindup).toBe(0);
  });

  it("schiesst nicht durch eine Wand", () => {
    const { state, boss } = setup(BOSS.slam.triggerRange + 300);
    const player = state.players[0];
    if (!player) throw new Error("Testaufbau");

    // Eine Wand genau dazwischen.
    state.walls = [
      { x: (player.position.x + boss.position.x) / 2 - 30, y: player.position.y - 200, width: 60, height: 400 },
    ];

    runBoss(state, boss, 2.0);

    expect(state.projectiles.filter((projectile) => projectile.active).length).toBe(0);
  });
});

describe("Boss: Staerke", () => {
  it("gibt dem Ende-Boss mehr Leben als einem Mini-Boss", () => {
    const mini = createEnemy(1, "boss", { x: 0, y: 0 }, 1, 1, false);
    const final = createEnemy(2, "boss", { x: 0, y: 0 }, 1, 1, true);

    expect(final.maxHealth).toBeGreaterThan(mini.maxHealth);
    expect(final.radius).toBeGreaterThan(mini.radius);
  });

  it("schiesst NICHT mit fuenffachem Schaden, nur weil er fuenffaches Leben hat", () => {
    /*
     * Die Falle, die das hier abfaengt: Der Schadensfaktor wurde frueher als
     * `maxHealth / Grundleben` ausgerechnet. Beim Ende-Boss steckt darin die
     * Verfuenffachung des Lebens - er haette also auch fuenffachen Schaden
     * gemacht, ohne dass das irgendwo stuende.
     */
    const final = createEnemy(2, "boss", { x: 0, y: 0 }, 1, 1, true);
    expect(final.damageMultiplier).toBe(1);
  });
});
