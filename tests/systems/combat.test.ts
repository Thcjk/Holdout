import { describe, expect, it } from "vitest";
import { CHARACTERS, LIMITS, PLAYER, SUPERS } from "../../src/config/balance";
import { TICK_SECONDS } from "../../src/config/constants";
import {
  ammoCount,
  damageEnemy,
  damagePlayer,
  stepReload,
  stepRevive,
  tryShoot,
} from "../../src/systems/combat";
import { createEnemy } from "../../src/systems/enemies";
import {
  activeProjectileCount,
  spawnProjectile,
  stepProjectiles,
} from "../../src/systems/projectiles";
import { createWorld } from "../../src/systems/world";
import { makeInput, soloSetup } from "../helpers";

function world() {
  const state = createWorld(soloSetup());
  state.enemies.length = 0;
  return state;
}

function firstPlayer(state: ReturnType<typeof world>) {
  const player = state.players[0];
  if (!player) {
    throw new Error("Testaufbau ohne Spieler");
  }
  return player;
}

describe("Munition", () => {
  it("startet mit allen Ladungen voll", () => {
    expect(ammoCount(firstPlayer(world()))).toBe(PLAYER.ammoCharges);
  });

  it("verbraucht pro Schuss genau eine Ladung", () => {
    const state = world();
    const player = firstPlayer(state);

    tryShoot(state, player, makeInput({ x: 0, y: 0 }, { aim: { x: 1, y: 0 }, fire: true }));

    expect(ammoCount(player)).toBe(PLAYER.ammoCharges - 1);
  });

  it("verweigert den Schuss ohne Munition", () => {
    const state = world();
    const player = firstPlayer(state);
    player.reloadTimers.fill(1);

    const fired = tryShoot(
      state,
      player,
      makeInput({ x: 0, y: 0 }, { aim: { x: 1, y: 0 }, fire: true }),
    );

    expect(fired).toBe(false);
  });

  it("laedt alle Ladungen gleichzeitig nach, nicht nacheinander", () => {
    const state = world();
    const player = firstPlayer(state);
    player.reloadTimers.fill(CHARACTERS.scout.reloadTime);

    // Etwas mehr als eine Nachladezeit vergehen lassen.
    const ticks = Math.ceil(CHARACTERS.scout.reloadTime / TICK_SECONDS) + 1;
    for (let i = 0; i < ticks; i += 1) {
      stepReload(player, TICK_SECONDS);
    }

    expect(ammoCount(player)).toBe(PLAYER.ammoCharges);
  });

  it("haelt den Schusstakt ein", () => {
    const state = world();
    const player = firstPlayer(state);
    const input = makeInput({ x: 0, y: 0 }, { aim: { x: 1, y: 0 }, fire: true });

    expect(tryShoot(state, player, input)).toBe(true);
    expect(tryShoot(state, player, input)).toBe(false);
  });
});

describe("Schuesse", () => {
  it("erzeugt so viele Projektile wie der Charakter Kugeln hat", () => {
    const state = world();
    tryShoot(
      state,
      firstPlayer(state),
      makeInput({ x: 0, y: 0 }, { aim: { x: 1, y: 0 }, fire: true }),
    );

    expect(activeProjectileCount(state)).toBe(CHARACTERS.scout.shot.bullets);
  });

  it("zielt ohne eigene Zielangabe automatisch auf den naechsten Gegner", () => {
    const state = world();
    const player = firstPlayer(state);
    player.facing = { x: 1, y: 0 };
    state.enemies.push(
      createEnemy(1, "runner", { x: player.position.x, y: player.position.y - 200 }, 1, 1, false),
    );

    tryShoot(state, player, makeInput({ x: 0, y: 0 }, { fire: true }));

    // Nach oben geschossen, obwohl die Figur nach rechts schaute.
    const shot = state.projectiles.find((entry) => entry.active);
    expect(shot?.velocity.y).toBeLessThan(0);
  });
});

describe("Automatische Zielsuche (Etappe 10)", () => {
  function shotAt(distanceFactor: number): { x: number; y: number } | undefined {
    const state = world();
    state.walls.length = 0;
    const player = firstPlayer(state);
    player.facing = { x: 1, y: 0 };
    const range = CHARACTERS[player.character].shot.range;
    state.enemies.push(
      createEnemy(
        1,
        "runner",
        { x: player.position.x, y: player.position.y - range * distanceFactor },
        1,
        1,
        false,
      ),
    );
    tryShoot(state, player, makeInput({ x: 0, y: 0 }, { fire: true }));
    return state.projectiles.find((entry) => entry.active)?.velocity;
  }

  it("nimmt Gegner im inneren Teil der Reichweite", () => {
    expect(shotAt(PLAYER.autoAimRangeFactor - 0.1)?.y).toBeLessThan(0);
  });

  it("laesst Gegner weiter draussen liegen und schiesst in Blickrichtung", () => {
    // Vorher reichte die Suche bis 115 % der Waffenreichweite - man traf ohne
    // hinzusehen, was irgendwo im Bild stand.
    const velocity = shotAt(PLAYER.autoAimRangeFactor + 0.15);
    expect(velocity?.x).toBeGreaterThan(0);
    expect(Math.abs(velocity?.y ?? 1)).toBeLessThan(Math.abs(velocity?.x ?? 0));
  });

  it("ist rund 40 % kuerzer als vorher (1,15 x Reichweite)", () => {
    expect(PLAYER.autoAimRangeFactor / 1.15).toBeCloseTo(0.6, 1);
  });
});

describe("Projektile", () => {
  it("ueberschreitet das harte Limit nicht", () => {
    const state = world();
    for (let i = 0; i < LIMITS.maxProjectiles * 3; i += 1) {
      spawnProjectile(state, {
        owner: "player",
        ownerId: "p1",
        position: { x: 800, y: 600 },
        direction: { x: 1, y: 0 },
        speed: 600,
        damage: 10,
        range: 400,
        radius: 7,
        piercing: false,
      });
    }

    expect(state.projectiles.length).toBeLessThanOrEqual(LIMITS.maxProjectiles);
  });

  it("verwendet freigewordene Plaetze wieder, statt neue anzulegen", () => {
    const state = world();
    spawnProjectile(state, {
      owner: "player",
      ownerId: "p1",
      position: { x: 800, y: 600 },
      direction: { x: 1, y: 0 },
      speed: 600,
      damage: 10,
      range: 1,
      radius: 7,
      piercing: false,
    });
    stepProjectiles(state, TICK_SECONDS);
    expect(activeProjectileCount(state)).toBe(0);

    spawnProjectile(state, {
      owner: "player",
      ownerId: "p1",
      position: { x: 800, y: 600 },
      direction: { x: 1, y: 0 },
      speed: 600,
      damage: 10,
      range: 400,
      radius: 7,
      piercing: false,
    });

    expect(state.projectiles.length).toBe(1);
  });

  it("wird von einer Wand gestoppt", () => {
    const state = world();
    spawnProjectile(state, {
      owner: "player",
      ownerId: "p1",
      position: { x: 200, y: 600 },
      direction: { x: -1, y: 0 },
      speed: 3000,
      damage: 10,
      range: 900,
      radius: 7,
      piercing: false,
    });

    for (let i = 0; i < 10; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }

    expect(activeProjectileCount(state)).toBe(0);
  });

  it("trifft einen Gegner und verschwindet", () => {
    const state = world();
    const enemy = createEnemy(1, "runner", { x: 900, y: 600 }, 1, 1, false);
    state.enemies.push(enemy);
    spawnProjectile(state, {
      owner: "player",
      ownerId: "p1",
      position: { x: 860, y: 600 },
      direction: { x: 1, y: 0 },
      speed: 600,
      damage: 100,
      range: 400,
      radius: 7,
      piercing: false,
    });

    stepProjectiles(state, TICK_SECONDS);

    expect(enemy.health).toBe(enemy.maxHealth - 100);
    expect(activeProjectileCount(state)).toBe(0);
  });

  it("durchdringt mit dem Sniper mehrere Gegner, aber jeden nur einmal", () => {
    const state = world();
    const front = createEnemy(1, "runner", { x: 880, y: 600 }, 1, 1, false);
    const back = createEnemy(2, "runner", { x: 940, y: 600 }, 1, 1, false);
    state.enemies.push(front, back);

    spawnProjectile(state, {
      owner: "player",
      ownerId: "p1",
      position: { x: 820, y: 600 },
      direction: { x: 1, y: 0 },
      speed: 900,
      damage: 100,
      range: 600,
      radius: 7,
      piercing: true,
    });

    for (let i = 0; i < 6; i += 1) {
      stepProjectiles(state, TICK_SECONDS);
    }

    expect(front.health).toBe(front.maxHealth - 100);
    expect(back.health).toBe(back.maxHealth - 100);
  });
});

describe("Schaden", () => {
  it("gibt auf aufgedeckte Gegner 50 % mehr Schaden - fuer das ganze Team", () => {
    const state = world();
    const enemy = createEnemy(1, "runner", { x: 900, y: 600 }, 1, 1, false);
    enemy.marked = SUPERS.sniper.revealDuration;
    state.enemies.push(enemy);

    damageEnemy(state, enemy, 100, "irgendwer");

    expect(enemy.health).toBe(enemy.maxHealth - 150);
  });

  it("zaehlt beim Tod den Score hoch und meldet das Ereignis", () => {
    const state = world();
    const enemy = createEnemy(1, "runner", { x: 900, y: 600 }, 1, 1, false);
    state.enemies.push(enemy);

    damageEnemy(state, enemy, enemy.maxHealth, "p1");

    expect(state.enemies).toHaveLength(0);
    expect(state.score).toBe(10);
    expect(state.events.some((event) => event.type === "enemyDied")).toBe(true);
  });

  it("laedt den Super am ausgeteilten Schaden auf, nicht an der Trefferzahl", () => {
    const state = world();
    const player = firstPlayer(state);
    const enemy = createEnemy(1, "runner", { x: 900, y: 600 }, 1, 1, false);
    enemy.health = 1e9;
    enemy.maxHealth = 1e9;
    state.enemies.push(enemy);

    // Ein einzelner grosser Treffer laedt genauso viel wie viele kleine mit
    // derselben Summe - genau das ist der Punkt an der Umstellung.
    damageEnemy(state, enemy, 1000, player.id);
    const afterOneBig = player.superCharge;
    expect(afterOneBig).toBeCloseTo(PLAYER.superChargePerDamage, 5);

    player.superCharge = 0;
    for (let i = 0; i < 10; i += 1) {
      damageEnemy(state, enemy, 100, player.id);
    }
    expect(player.superCharge).toBeCloseTo(afterOneBig, 5);
  });

  it("meldet, wenn der Super bereit ist", () => {
    const state = world();
    const player = firstPlayer(state);
    const enemy = createEnemy(1, "runner", { x: 900, y: 600 }, 1, 1, false);
    enemy.health = 1e9;
    enemy.maxHealth = 1e9;
    state.enemies.push(enemy);

    // Genug Schaden fuer eine volle Aufladung, in einem Rutsch.
    damageEnemy(state, enemy, Math.ceil(100_000 / PLAYER.superChargePerDamage), player.id);

    expect(player.superCharge).toBe(100);
    expect(state.events.some((event) => event.type === "superReady")).toBe(true);
  });

  it("schuetzt den Spieler nach einem Treffer kurz vor weiterem Schaden", () => {
    const state = world();
    const player = firstPlayer(state);

    damagePlayer(state, player, 100);
    damagePlayer(state, player, 100);

    expect(player.health).toBe(player.maxHealth - 100);
  });

  it("legt den Spieler bei 0 Leben an den Boden, statt ihn zu entfernen", () => {
    const state = world();
    const player = firstPlayer(state);

    damagePlayer(state, player, player.maxHealth);

    expect(player.down).toBe(true);
    expect(player.health).toBe(0);
    expect(state.players).toHaveLength(1);
  });
});

describe("Wiederbelebung", () => {
  it("belebt nach der vollen Dauer wieder, wenn jemand danebensteht", () => {
    const state = createWorld([
      { id: "a", name: "A", character: "scout" },
      { id: "b", name: "B", character: "tank" },
    ]);
    state.enemies.length = 0;
    const [down, helper] = state.players;
    if (!down || !helper) {
      throw new Error("Testaufbau");
    }
    damagePlayer(state, down, down.maxHealth);
    helper.position = { x: down.position.x + 40, y: down.position.y };

    const ticks = Math.ceil(PLAYER.reviveTime / TICK_SECONDS) + 1;
    for (let i = 0; i < ticks; i += 1) {
      stepRevive(state, TICK_SECONDS);
    }

    expect(down.down).toBe(false);
    expect(down.health).toBeGreaterThan(0);
  });

  it("laesst den Fortschritt zuruecklaufen, wenn der Helfer weggeht", () => {
    const state = createWorld([
      { id: "a", name: "A", character: "scout" },
      { id: "b", name: "B", character: "tank" },
    ]);
    state.enemies.length = 0;
    const [down, helper] = state.players;
    if (!down || !helper) {
      throw new Error("Testaufbau");
    }
    damagePlayer(state, down, down.maxHealth);

    helper.position = { x: down.position.x + 40, y: down.position.y };
    stepRevive(state, 1.0);
    expect(down.reviveProgress).toBeCloseTo(1.0, 6);

    helper.position = { x: down.position.x + 900, y: down.position.y };
    stepRevive(state, 0.5);

    expect(down.reviveProgress).toBeCloseTo(0.5, 6);
    expect(down.down).toBe(true);
  });
});
