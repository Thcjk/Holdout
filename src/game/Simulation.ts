/**
 * Der Spielkern der Wanderfestung: rechnet mit festem Takt (60 Hz), kennt weder
 * Phaser noch Netz. Eingaben rein (`advance`), Zustand und Ereignisse raus.
 *
 * Ein Lauf: Rast am Start (bauen) → Marsch → Rast an der Station → Marsch … → Ziel.
 *
 * Diese Klasse ist nur der Dirigent. Die eigentlichen Regeln stehen in `systems/`:
 *   players.ts  - die Mechs (laufen, springen, klettern, schiessen, sammeln)
 *   modules.ts  - Module bauen und was sie im Marsch tun
 *   enemies.ts  - die goldene Armee (Trupps, Endgegner, jede Art mit ihrer Aufgabe)
 *   combat.ts   - Schaden, Zielwahl, Geschosse
 *
 * Ablauf eines Rechenschritts im Marsch:
 *   1. Die Festung laeuft, die Beine setzen auf und stampfen.
 *   2. Mechs bewegen sich, schiessen, sammeln Schrott.
 *   3. Module schiessen, blitzen, giessen Oel, ziehen Schrott heran.
 *   4. Trupps kuendigen sich an und tauchen auf; jeder Gegner tut seine Arbeit.
 *   5. Geschosse, Granaten und Bolzen fliegen.
 *   6. Ziel erreicht? Rumpf zerstoert?
 */

import {
  FORT_SPEED,
  HULL_MAX,
  REPAIR_AMOUNT,
  REPAIR_COST,
  SCRAP_LOST_BEHIND,
  START_SCRAP,
  STATION_BONUS,
  STOMP_DAMAGE,
  STOMP_RADIUS,
  TICK,
} from "./constants";
import { PROBE_ROUTE, START_STATION, type MarchSpec } from "./data/route";
import { LEGS, STRIDE, legPhase } from "./fortress";
import { createRng, type Rng } from "./rng";
import { damageEnemy, updateEnemyShots, updateShells, updateShots } from "./systems/combat";
import { spawn, updateEnemies } from "./systems/enemies";
import {
  build,
  refreshFortress,
  repairAllModules,
  rerollCost,
  rollOffer,
  sell,
  updateModules,
  upgrade,
} from "./systems/modules";
import { newPlayer, updatePlayer } from "./systems/players";
import type { Command, GameEvent, GameState, MarchState, PlayerInput, PlayerSetup } from "./types";
import type { World } from "./world";

const IDLE: PlayerInput = { mx: 0, my: 0 };
/** So viel langsamer laeuft die Festung, wenn ein Streitwagen ein Bein gerammt hat. */
const SLOW_FACTOR = 0.6;

export interface SimulationOptions {
  route?: readonly MarchSpec[];
  /** Schrott zum Start (Standard: START_SCRAP). */
  startScrap?: number;
}

export class Simulation implements World {
  readonly state: GameState;
  readonly rng: Rng;
  /** Was im letzten `advance` passiert ist. */
  events: GameEvent[] = [];

  private accumulator = 0;
  /** Ereignisse aus Befehlen zwischen zwei Bildern - gehen mit dem naechsten `advance` raus. */
  private pending: GameEvent[] = [];
  private ticking = false;
  private readonly route: readonly MarchSpec[];

  constructor(setups: readonly PlayerSetup[], seed: number, options: SimulationOptions = {}) {
    this.rng = createRng(seed);
    this.route = options.route ?? PROBE_ROUTE;
    if (this.route.length === 0) {
      throw new Error("Die Route braucht mindestens einen Marsch.");
    }
    this.state = {
      // Der Lauf beginnt mit einer Rast am Grab: erst ausbauen, dann losziehen.
      phase: "rest",
      time: 0,
      restAt: START_STATION,
      march: this.marchFor(0),
      fort: {
        x: 0,
        y: 0,
        hull: HULL_MAX,
        hullMax: HULL_MAX,
        gait: 0,
        moving: false,
        speed: 1,
        slow: 0,
      },
      players: setups.map((setup, index) => newPlayer(setup, index)),
      enemies: [],
      shots: [],
      enemyShots: [],
      scrap: [],
      modules: [],
      shells: [],
      warnings: [],
      offer: [],
      rerolls: 0,
      bank: options.startScrap ?? START_SCRAP,
      kills: 0,
      nextId: 1,
    };
    this.state.offer = rollOffer(this);
  }

  // --- World: was die Teile in systems/ brauchen ----------------------------------------------

  emit(event: GameEvent): void {
    (this.ticking ? this.events : this.pending).push(event);
  }

  march(): MarchSpec | undefined {
    return this.route[this.state.march.index];
  }

  refreshFortress(): void {
    refreshFortress(this.state);
  }

  /** Was Neu-Wuerfeln gerade kostet. */
  rerollCost(): number {
    return rerollCost(this.state);
  }

  // --- Takt ------------------------------------------------------------------------------------

  /** Rechnet `deltaMs` Millisekunden in festen Schritten weiter. */
  advance(deltaMs: number, inputs: ReadonlyMap<string, PlayerInput>): void {
    this.events = this.pending;
    this.pending = [];
    // Nach einer Pause (Tab im Hintergrund) nicht Sekunden auf einmal nachholen.
    this.accumulator += Math.min(deltaMs, 250) / 1000;
    this.ticking = true;
    while (this.accumulator >= TICK) {
      this.tick(inputs);
      this.accumulator -= TICK;
    }
    this.ticking = false;
  }

  // --- Befehle aus der Rast --------------------------------------------------------------------

  command(_playerId: string, command: Command): void {
    const s = this.state;
    if (s.phase !== "rest") {
      return;
    }
    switch (command.kind) {
      case "repair":
        if (s.bank >= REPAIR_COST && s.fort.hull < s.fort.hullMax) {
          s.bank -= REPAIR_COST;
          const before = s.fort.hull;
          s.fort.hull = Math.min(s.fort.hullMax, s.fort.hull + REPAIR_AMOUNT);
          this.emit({ kind: "repair", amount: s.fort.hull - before });
        }
        return;
      case "depart":
        s.phase = "march";
        s.warnings = [];
        this.emit({ kind: "depart", index: s.march.index });
        return;
      case "build":
        build(this, command.module, command.col, command.row);
        return;
      case "upgrade":
        upgrade(this, command.uid);
        return;
      case "sell":
        sell(this, command.uid);
        return;
      case "reroll": {
        const cost = rerollCost(s);
        if (s.bank >= cost) {
          s.bank -= cost;
          s.rerolls += 1;
          s.offer = rollOffer(this);
          this.emit({ kind: "reroll" });
        }
        return;
      }
    }
  }

  private marchFor(index: number): MarchState {
    const spec = this.route[index] ?? this.route[this.route.length - 1]!;
    return {
      index,
      count: this.route.length,
      station: spec.station,
      length: spec.length,
      done: 0,
      spawnTimer: 2.5,
      boss: spec.boss ? "waiting" : "none",
    };
  }

  // --- Ein Rechenschritt ---------------------------------------------------------------------

  private tick(inputs: ReadonlyMap<string, PlayerInput>): void {
    const s = this.state;
    if (s.phase === "won" || s.phase === "lost") {
      return;
    }
    s.time += TICK;
    const marching = s.phase === "march";
    const f = s.fort;
    const slowed = f.slow > 0 ? SLOW_FACTOR : 1;
    f.slow = Math.max(0, f.slow - TICK);
    const pace = f.speed * slowed;
    const fortDx = marching ? FORT_SPEED * pace * TICK : 0;
    f.moving = marching;
    if (marching) {
      const before = f.gait;
      f.x += fortDx;
      // Schnellere Festung = schnellere Schritte; die Schrittlaenge bleibt, die Fuesse rutschen nicht.
      f.gait += TICK * pace;
      s.march.done += fortDx;
      this.stomp(before, f.gait);
    }
    for (const player of s.players) {
      updatePlayer(this, player, inputs.get(player.id) ?? IDLE, fortDx);
    }
    if (marching) {
      updateModules(this);
      spawn(this);
    }
    updateEnemies(this, fortDx);
    updateShots(this);
    updateShells(this);
    updateEnemyShots(this);
    if (marching) {
      const lostAt = f.x - SCRAP_LOST_BEHIND;
      s.scrap = s.scrap.filter((piece) => piece.x > lostAt || piece.z > 0);
    }
    this.checkProgress();
  }

  /** Setzt ein Fuss auf, trifft er alles, was darunter am Boden steht. */
  private stomp(before: number, after: number): void {
    const f = this.state.fort;
    for (const leg of LEGS) {
      if (legPhase(after, leg) < legPhase(before, leg)) {
        const x = f.x + leg.footX + STRIDE / 2;
        const y = f.y + leg.footY;
        this.emit({ kind: "stomp", x, y });
        for (const enemy of this.state.enemies) {
          if (
            enemy.hp > 0 &&
            enemy.layer === "ground" &&
            Math.hypot(enemy.x - x, enemy.y - y) < STOMP_RADIUS
          ) {
            damageEnemy(this, enemy, STOMP_DAMAGE, x, y, null, { pierce: true });
          }
        }
      }
    }
  }

  // --- Fortschritt -----------------------------------------------------------------------------

  private checkProgress(): void {
    const s = this.state;
    if (s.fort.hull <= 0) {
      s.phase = "lost";
      this.emit({ kind: "lost" });
      return;
    }
    if (s.phase !== "march") {
      return;
    }
    // Solange der Endgegner lebt, kommt die Festung nicht an.
    if (s.march.boss === "waiting" || s.march.boss === "alive") {
      s.march.done = Math.min(s.march.done, s.march.length - 1);
    }
    if (s.march.done < s.march.length) {
      return;
    }
    this.emit({ kind: "arrived", index: s.march.index });
    // Die Armee bleibt zurueck: An der Station ist Ruhe.
    s.enemies = [];
    s.shots = [];
    s.shells = [];
    s.enemyShots = [];
    s.warnings = [];
    s.fort.slow = 0;
    if (s.march.index + 1 >= s.march.count) {
      s.phase = "won";
      this.emit({ kind: "won" });
      return;
    }
    s.phase = "rest";
    s.restAt = s.march.station;
    s.march = this.marchFor(s.march.index + 1);
    // Fundstuecke an der Station, alles wird heil, und ein neues Angebot.
    s.bank += STATION_BONUS;
    repairAllModules(this);
    s.rerolls = 0;
    s.offer = rollOffer(this);
  }
}
