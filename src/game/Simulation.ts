/**
 * Der Spielkern der Wanderfestung: rechnet mit festem Takt (60 Hz), kennt weder
 * Phaser noch Netz. Eingaben rein (`advance`), Zustand und Ereignisse raus.
 *
 * Ein Lauf: Rast am Start (bauen) → Karte: naechste Station waehlen → Marsch → Station
 * (Ruine: pluendern) → Rast → Karte → … → Endgegner.
 *
 * Diese Klasse ist nur der Dirigent. Die eigentlichen Regeln stehen in `systems/`:
 *   players.ts  - die Mechs (laufen, springen, klettern, schiessen, sammeln)
 *   modules.ts  - Module bauen und was sie im Marsch tun
 *   enemies.ts  - die goldene Armee (Trupps, Endgegner, jede Art mit ihrer Aufgabe)
 *   combat.ts   - Schaden, Zielwahl, Geschosse
 *   journey.ts  - Routenkarte: losziehen, ankommen, Stationen, Vorsprung, Ereignisse
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
  OFFER_SIZE,
  REPAIR_AMOUNT,
  REPAIR_COST,
  SCRAP_LOST_BEHIND,
  START_SCRAP,
  STOMP_DAMAGE,
  STOMP_RADIUS,
  TICK,
} from "./constants";
import { LEAD_START, marchFor } from "./data/acts";
import { MODULE_IDS } from "./data/modules";
import { START_STATION, type MarchSpec } from "./data/route";
import { LEGS, STRIDE, legPhase } from "./fortress";
import { generateMap, linearMap } from "./map";
import { createRng, type Rng } from "./rng";
import { damageEnemy, updateEnemyShots, updateShells, updateShots } from "./systems/combat";
import { spawn, updateEnemies } from "./systems/enemies";
import { TRADER_OFFER, arrive, choose, depart, marchTo, updateLoot } from "./systems/journey";
import {
  build,
  refreshFortress,
  rerollCost,
  rollOffer,
  sell,
  updateModules,
  upgrade,
} from "./systems/modules";
import { equipPart, newPlayer, updatePlayer } from "./systems/players";
import type {
  Command,
  GameEvent,
  GameState,
  MapNode,
  ModuleId,
  PlayerInput,
  PlayerSetup,
} from "./types";
import type { World } from "./world";

const IDLE: PlayerInput = { mx: 0, my: 0 };
/** So viel langsamer laeuft die Festung, wenn ein Streitwagen ein Bein gerammt hat. */
const SLOW_FACTOR = 0.6;

export interface SimulationOptions {
  /** Fester Probelauf statt einer zufaelligen Karte (Tests). */
  route?: readonly MarchSpec[];
  /** Schrott zum Start (Standard: START_SCRAP). */
  startScrap?: number;
  /** Maersche kuerzer machen (`?debug=kurz`: 0,1). */
  lengthFactor?: number;
  /** Module, die im Angebot auftauchen koennen (Bauplaene aus der Werft). */
  modulePool?: readonly ModuleId[];
  /** Werft-Verbesserungen: mehr Rumpf, mehr Vorsprung zum Start. */
  hullBonus?: number;
  leadBonus?: number;
  /** Hitze-Stufe 0 bis 10: zaehere und mehr Gegner, weniger Vorsprung. */
  heat?: number;
}

/** Was die Hitze-Stufe aendert (alles waechst mit der Stufe). */
export function heatEffects(heat: number): {
  hp: number;
  rate: number;
  lead: number;
  chests: number;
  startScrap: number;
} {
  return {
    hp: 1 + 0.08 * heat,
    rate: 1 + 0.05 * heat,
    lead: heat >= 3 ? -1 : 0,
    chests: heat >= 6 ? -2 : 0,
    startScrap: heat >= 9 ? -20 : 0,
  };
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
  private readonly route: readonly MarchSpec[] | null;
  private readonly lengthFactor: number;
  private readonly pool: readonly ModuleId[];

  constructor(setups: readonly PlayerSetup[], seed: number, options: SimulationOptions = {}) {
    this.rng = createRng(seed);
    this.route = options.route ?? null;
    this.lengthFactor = options.lengthFactor ?? 1;
    this.pool =
      options.modulePool && options.modulePool.length >= 4 ? options.modulePool : MODULE_IDS;
    const heat = options.heat ?? 0;
    const effects = heatEffects(heat);
    const hull = HULL_MAX + (options.hullBonus ?? 0);
    if (this.route && this.route.length === 0) {
      throw new Error("Die Route braucht mindestens einen Marsch.");
    }
    const map = this.route ? linearMap(this.route) : generateMap(this.rng, 0);
    this.state = {
      // Der Lauf beginnt mit einer Rast am Grab: erst ausbauen, dann losziehen.
      phase: "rest",
      time: 0,
      restAt: START_STATION,
      march: {
        index: 0,
        count: map.layers - 1,
        station: "",
        length: 1,
        done: 0,
        spawnTimer: 2.5,
        boss: "none",
        node: 0,
        horde: false,
        storm: false,
      },
      map,
      at: 0,
      path: [0],
      lead: Math.max(1, LEAD_START + (options.leadBonus ?? 0) + effects.lead),
      leadStart: Math.max(1, LEAD_START + (options.leadBonus ?? 0) + effects.lead),
      event: null,
      seenEvents: [],
      loot: null,
      chests: [],
      fort: {
        x: 0,
        y: 0,
        hull,
        hullMax: hull,
        gait: 0,
        moving: false,
        speed: 1,
        slow: 0,
        baseHull: hull,
      },
      partOffer: [],
      stats: { chests: 0, hordes: 0, scrapEarned: 0, winches: 0, bossKills: 0, events: 0 },
      heat,
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
      bank: Math.max(0, (options.startScrap ?? START_SCRAP) + effects.startScrap),
      kills: 0,
      nextId: 1,
    };
    this.state.offer = rollOffer(this, this.modulePool());
    // Vorschau auf die erste Station, bis man auf der Karte waehlt.
    const first = map.nodes[map.nodes[0]!.next[0]!];
    if (first) {
      this.state.march = marchTo(this, first, false);
    }
  }

  // --- World: was die Teile in systems/ brauchen ----------------------------------------------

  emit(event: GameEvent): void {
    (this.ticking ? this.events : this.pending).push(event);
  }

  march(): MarchSpec | undefined {
    const node = this.state.map.nodes[this.state.march.node];
    return node ? this.specFor(node, this.state.march.horde) : undefined;
  }

  specFor(node: MapNode, horde: boolean): MarchSpec {
    const spec =
      node.route !== undefined && this.route
        ? this.route[node.route]!
        : marchFor(this.state.map.act, node.type, node.layer, node.name, horde);
    const heat = heatEffects(this.state.heat);
    return {
      ...spec,
      length: Math.max(1, Math.round(spec.length * this.lengthFactor)),
      hp: spec.hp * heat.hp,
      spawnStart: spec.spawnStart * heat.rate,
      spawnEnd: spec.spawnEnd * heat.rate,
    };
  }

  modulePool(): readonly ModuleId[] {
    return this.pool;
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

  command(playerId: string, command: Command): void {
    const s = this.state;
    if (s.phase !== "rest") {
      return;
    }
    // Im Koop entscheidet der Host ueber den Weg und die Ereignisse.
    if ((command.kind === "depart" || command.kind === "choose") && playerId !== s.players[0]?.id) {
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
        depart(this, command.node);
        return;
      case "choose":
        choose(this, command.option);
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
      case "buyPart": {
        const offer = s.partOffer[command.index];
        const buyer = s.players.find((p) => p.id === playerId) ?? s.players[0];
        if (offer && buyer && s.bank >= offer.cost) {
          s.bank -= offer.cost;
          s.partOffer.splice(command.index, 1);
          equipPart(this, buyer, offer.id);
        }
        return;
      }
      case "reroll": {
        const cost = rerollCost(s);
        if (s.bank >= cost) {
          s.bank -= cost;
          s.rerolls += 1;
          const trader = s.map.nodes[s.at]?.type === "haendler";
          s.offer = rollOffer(this, this.modulePool(), trader ? TRADER_OFFER : OFFER_SIZE);
          this.emit({ kind: "reroll" });
        }
        return;
      }
    }
  }

  /** Koop: Ein Mitspieler ist gegangen - seine Figur verschwindet. */
  removePlayer(id: string): void {
    this.state.players = this.state.players.filter((p) => p.id !== id);
  }

  // --- Ein Rechenschritt ---------------------------------------------------------------------

  private tick(inputs: ReadonlyMap<string, PlayerInput>): void {
    const s = this.state;
    if (s.phase === "won" || s.phase === "lost") {
      return;
    }
    s.time += TICK;
    const marching = s.phase === "march";
    // Gekaempft wird im Marsch und beim Pluendern (dann steht die Festung).
    const fighting = marching || s.phase === "loot";
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
    if (fighting) {
      updateModules(this);
      spawn(this);
    }
    updateEnemies(this, fortDx);
    updateShots(this);
    updateShells(this);
    updateEnemyShots(this);
    if (s.phase === "loot") {
      updateLoot(this);
    }
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
    if (s.march.done >= s.march.length) {
      arrive(this);
    }
  }
}
