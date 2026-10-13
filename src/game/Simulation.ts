/**
 * Der Spielkern der Wanderfestung: rechnet mit festem Takt (60 Hz), kennt weder
 * Phaser noch Netz. Eingaben rein (`advance`), Zustand und Ereignisse raus.
 *
 * Ein Lauf: Rast am Start (bauen) → Marsch → Rast an der Station → Marsch … → Ziel.
 *
 * Ablauf eines Rechenschritts im Marsch:
 *   1. Die Festung laeuft, die Beine setzen auf und stampfen.
 *   2. Mechs bewegen sich auf dem Deck oder am Boden, springen ab, klettern hoch,
 *      werden von der Seilwinde geholt, schiessen und sammeln Schrott.
 *   3. Module auf dem Deck schiessen, blitzen, giessen Oel, ziehen Schrott heran.
 *   4. Trupps der goldenen Armee kuendigen sich am Bildrand an und greifen von
 *      allen Seiten an.
 *   5. Geschosse und Granaten fliegen, Schrott bleibt liegen (und bleibt zurueck).
 *   6. Ziel erreicht? Rumpf zerstoert?
 */

import {
  AHEAD,
  BEHIND,
  CLIMB_TIME,
  DECK_COLS,
  DECK_H,
  DECK_ROWS,
  DECK_W,
  EDGE_HOLD,
  ELEVATION,
  FORT_SPEED,
  FRONT_SPAWN,
  GROUND_BOTTOM,
  GROUND_TOP,
  HULL_MAX,
  JUMP_TIME,
  LADDER,
  LADDER_TOP,
  MAX_ENEMIES,
  OFFER_SIZE,
  REPAIR_AMOUNT,
  REPAIR_COST,
  REROLL_COST,
  REROLL_STEP,
  RESPAWN_SPOT,
  RESPAWN_TIME,
  SCRAP_LOST_BEHIND,
  SCRAP_MAGNET,
  SCRAP_PICKUP,
  START_SCRAP,
  STATION_BONUS,
  STOMP_DAMAGE,
  STOMP_RADIUS,
  TICK,
  TILE_H,
  TILE_W,
  WARNING_TIME,
  WINCH_COST,
  WINCH_LANDING,
  WINCH_TIME,
} from "./constants";
import { CREW, type CrewSpec } from "./data/crew";
import { ENEMIES } from "./data/enemies";
import { MODULE_IDS, MODULES, sellValue, stat, upgradeCost } from "./data/modules";
import { PROBE_ROUTE, START_STATION, type MarchSpec } from "./data/route";
import { canPlace, generatorBonus, moduleCenter } from "./deck";
import {
  ATTACK_SLOTS,
  BLIND_SPOT,
  DECK_OBSTACLES,
  DECK_WALK,
  LEGS,
  STRIDE,
  insideRect,
  legPhase,
} from "./fortress";
import { createRng, type Rng } from "./rng";
import type {
  Anchor,
  Command,
  EnemyState,
  GameEvent,
  GameState,
  MarchState,
  ModuleState,
  PlayerInput,
  PlayerSetup,
  PlayerState,
  ShotState,
  Side,
  Transition,
} from "./types";

const IDLE: PlayerInput = { mx: 0, my: 0 };

/** Wie oft Trupps aus welcher Richtung kommen. */
const SIDE_WEIGHTS: readonly [Side, number][] = [
  ["hinten", 0.32],
  ["vorn", 0.24],
  ["oben", 0.22],
  ["unten", 0.22],
];

export interface SimulationOptions {
  route?: readonly MarchSpec[];
  /** Schrott zum Start (Standard: START_SCRAP). */
  startScrap?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class Simulation {
  readonly state: GameState;
  /** Was im letzten `advance` passiert ist. */
  events: GameEvent[] = [];

  private accumulator = 0;
  /** Ereignisse aus Befehlen zwischen zwei Bildern - gehen mit dem naechsten `advance` raus. */
  private pending: GameEvent[] = [];
  private readonly rng: Rng;
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
      fort: { x: 0, y: 0, hull: HULL_MAX, hullMax: HULL_MAX, gait: 0, moving: false, speed: 1 },
      players: setups.map((setup, index) => this.newPlayer(setup, index)),
      enemies: [],
      shots: [],
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
    this.state.offer = this.rollOffer();
  }

  /** Rechnet `deltaMs` Millisekunden in festen Schritten weiter. */
  advance(deltaMs: number, inputs: ReadonlyMap<string, PlayerInput>): void {
    this.events = this.pending;
    this.pending = [];
    // Nach einer Pause (Tab im Hintergrund) nicht Sekunden auf einmal nachholen.
    this.accumulator += Math.min(deltaMs, 250) / 1000;
    while (this.accumulator >= TICK) {
      this.tick(inputs);
      this.accumulator -= TICK;
    }
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
          this.pending.push({ kind: "repair", amount: s.fort.hull - before });
        }
        return;
      case "depart":
        s.phase = "march";
        s.warnings = [];
        this.pending.push({ kind: "depart", index: s.march.index });
        return;
      case "build":
        this.build(command.module, command.col, command.row);
        return;
      case "upgrade":
        this.upgrade(command.uid);
        return;
      case "sell":
        this.sell(command.uid);
        return;
      case "reroll": {
        const cost = this.rerollCost();
        if (s.bank >= cost) {
          s.bank -= cost;
          s.rerolls += 1;
          s.offer = this.rollOffer();
          this.pending.push({ kind: "reroll" });
        }
        return;
      }
    }
  }

  /** Was Neu-Wuerfeln gerade kostet. */
  rerollCost(): number {
    return REROLL_COST + REROLL_STEP * this.state.rerolls;
  }

  private build(type: ModuleState["type"], col: number, row: number): void {
    const s = this.state;
    const spec = MODULES[type];
    if (!s.offer.includes(type) || s.bank < spec.cost || !canPlace(s.modules, type, col, row)) {
      return;
    }
    s.bank -= spec.cost;
    // Jedes Angebot gibt es nur einmal.
    s.offer.splice(s.offer.indexOf(type), 1);
    const module: ModuleState = {
      uid: s.nextId++,
      type,
      col,
      row,
      level: 1,
      cooldown: 0.6,
      facing: -1,
    };
    s.modules.push(module);
    this.refreshFortress();
    this.pending.push({ kind: "built", uid: module.uid, type });
  }

  private upgrade(uid: number): void {
    const s = this.state;
    const module = s.modules.find((m) => m.uid === uid);
    const cost = module ? upgradeCost(module.type, module.level) : null;
    if (!module || cost === null || s.bank < cost) {
      return;
    }
    s.bank -= cost;
    module.level += 1;
    this.refreshFortress();
    this.pending.push({ kind: "upgraded", uid, type: module.type });
  }

  private sell(uid: number): void {
    const s = this.state;
    const module = s.modules.find((m) => m.uid === uid);
    if (!module) {
      return;
    }
    s.bank += sellValue(module.type, module.level);
    s.modules = s.modules.filter((m) => m.uid !== uid);
    this.refreshFortress();
    this.pending.push({ kind: "sold", uid, type: module.type });
  }

  /** Tempo und Rumpf-Hoechstwert aus den Modulen neu berechnen. */
  private refreshFortress(): void {
    const s = this.state;
    let speed = 1;
    let hullMax = HULL_MAX;
    for (const m of s.modules) {
      if (m.type === "motor") {
        speed += stat(MODULES.motor.power, m.level);
      } else if (m.type === "platte") {
        hullMax += stat(MODULES.platte.power, m.level);
      }
    }
    s.fort.speed = speed;
    // Mehr Hoechstwert: Der Zuwachs kommt sofort dazu. Weniger: kappen.
    const gained = hullMax - s.fort.hullMax;
    s.fort.hullMax = hullMax;
    s.fort.hull = clamp(s.fort.hull + Math.max(0, gained), 0, hullMax);
  }

  /** Zufaelliges Angebot: verschiedene Module. */
  private rollOffer(): ModuleState["type"][] {
    const pool = [...MODULE_IDS];
    const offer: ModuleState["type"][] = [];
    while (offer.length < OFFER_SIZE && pool.length > 0) {
      const index = Math.floor(this.rng() * pool.length);
      offer.push(pool.splice(index, 1)[0]!);
    }
    return offer;
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
    const fortDx = marching ? FORT_SPEED * s.fort.speed * TICK : 0;
    s.fort.moving = marching;
    if (marching) {
      const before = s.fort.gait;
      s.fort.x += fortDx;
      // Schnellere Festung = schnellere Schritte; die Schrittlaenge bleibt, die Fuesse rutschen nicht.
      s.fort.gait += TICK * s.fort.speed;
      s.march.done += fortDx;
      this.stomp(before, s.fort.gait);
    }
    for (const player of s.players) {
      this.updatePlayer(player, inputs.get(player.id) ?? IDLE, fortDx);
    }
    if (marching) {
      this.updateModules();
      this.spawn();
    }
    this.updateEnemies(fortDx);
    this.updateShots();
    this.updateShells();
    if (marching) {
      const lostAt = s.fort.x - SCRAP_LOST_BEHIND;
      s.scrap = s.scrap.filter((piece) => piece.x > lostAt || piece.z > 0);
    }
    this.checkProgress();
  }

  // --- Festung -------------------------------------------------------------------------------

  /** Setzt ein Fuss auf, trifft er alles, was darunter steht. */
  private stomp(before: number, after: number): void {
    const f = this.state.fort;
    for (const leg of LEGS) {
      if (legPhase(after, leg) < legPhase(before, leg)) {
        const x = f.x + leg.footX + STRIDE / 2;
        const y = f.y + leg.footY;
        this.events.push({ kind: "stomp", x, y });
        for (const enemy of this.state.enemies) {
          if (enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) < STOMP_RADIUS) {
            this.damageEnemy(enemy, STOMP_DAMAGE, x, y, null);
          }
        }
      }
    }
  }

  private damageHull(amount: number, x: number, y: number): void {
    this.state.fort.hull = Math.max(0, this.state.fort.hull - amount);
    this.events.push({ kind: "hullHit", x, y, amount });
  }

  /** Liegt der Bodenpunkt im toten Winkel unter dem Deck? */
  private underDeck(x: number, y: number): boolean {
    const f = this.state.fort;
    return insideRect(BLIND_SPOT, x - f.x, y - f.y);
  }

  // --- Mechs ---------------------------------------------------------------------------------

  private newPlayer(setup: PlayerSetup, index: number): PlayerState {
    const spec = CREW[setup.crew];
    return {
      id: setup.id,
      name: setup.name,
      crew: setup.crew,
      layer: "deck",
      x: RESPAWN_SPOT.x - 40 + index * 28,
      y: RESPAWN_SPOT.y,
      z: ELEVATION,
      facing: -1,
      moving: false,
      hp: spec.hp,
      hpMax: spec.hp,
      alive: true,
      respawn: 0,
      transition: null,
      edgeTime: 0,
      cooldown: 0.5,
      abilityCd: 0,
      abilityAck: 0,
      kills: 0,
      scrap: 0,
    };
  }

  private updatePlayer(p: PlayerState, input: PlayerInput, fortDx: number): void {
    const spec = CREW[p.crew];
    // Den Faehigkeits-Zaehler immer quittieren, auch wenn gerade nichts geht -
    // sonst loeste ein alter Druck spaeter ueberraschend aus.
    if (input.ability !== undefined && input.ability > p.abilityAck) {
      p.abilityAck = input.ability;
      if (p.alive && p.abilityCd <= 0) {
        this.useAbility(p, spec);
      }
    }
    p.abilityCd = Math.max(0, p.abilityCd - TICK);

    if (!p.alive) {
      p.respawn -= TICK;
      if (p.respawn <= 0) {
        this.respawn(p);
      }
      return;
    }
    if (p.transition) {
      this.advanceTransition(p, p.transition);
      return;
    }

    const length = Math.hypot(input.mx, input.my);
    const scale = length > 1 ? 1 / length : 1;
    const mx = input.mx * scale;
    const my = input.my * scale;
    p.moving = length > 0.05;
    if (Math.abs(mx) > 0.1) {
      p.facing = mx > 0 ? 1 : -1;
    }
    const step = spec.speed * TICK;
    if (p.layer === "deck") {
      p.x += fortDx;
      this.moveOnDeck(p, mx, my, step);
    } else {
      this.moveOnGround(p, mx, my, step);
    }
    if (p.transition) {
      return;
    }
    this.shoot(p, spec);
    if (p.layer === "ground") {
      this.collectScrap(p);
    }
  }

  private blockedOnDeck(x: number, y: number): boolean {
    return DECK_OBSTACLES.some((r) => insideRect(r, x, y));
  }

  private moveOnDeck(p: PlayerState, mx: number, my: number, step: number): void {
    const f = this.state.fort;
    let lx = p.x - f.x;
    let ly = p.y - f.y;
    // Achsen getrennt: So gleitet man an Aufbauten entlang, statt haengen zu bleiben.
    const nx = lx + mx * step;
    if (!this.blockedOnDeck(nx, ly)) {
      lx = nx;
    }
    const ny = ly + my * step;
    if (!this.blockedOnDeck(lx, ny)) {
      ly = ny;
    }
    lx = clamp(lx, DECK_WALK.x0, DECK_WALK.x1);
    ly = clamp(ly, DECK_WALK.y0, DECK_WALK.y1);
    p.x = f.x + lx;
    p.y = f.y + ly;

    // Gegen eine Kante druecken (hinten ist ein Gelaender): kurz halten, dann abspringen.
    let edge: "left" | "right" | "front" | null = null;
    if (lx <= DECK_WALK.x0 + 0.5 && mx < -0.4) {
      edge = "left";
    } else if (lx >= DECK_WALK.x1 - 0.5 && mx > 0.4) {
      edge = "right";
    } else if (ly >= DECK_WALK.y1 - 0.5 && my > 0.4) {
      edge = "front";
    }
    if (!edge) {
      p.edgeTime = 0;
      return;
    }
    p.edgeTime += TICK;
    if (p.edgeTime >= EDGE_HOLD) {
      this.jumpOff(p, edge, lx, ly);
    }
  }

  private jumpOff(p: PlayerState, edge: "left" | "right" | "front", lx: number, ly: number): void {
    const f = this.state.fort;
    let x = f.x + lx;
    let y = f.y + ly;
    if (edge === "left") {
      x = f.x - 34;
    } else if (edge === "right") {
      x = f.x + DECK_W + 34;
    } else {
      y = f.y + DECK_H + 30;
    }
    this.startTransition(
      p,
      "jump",
      JUMP_TIME,
      { x: lx, y: ly, z: ELEVATION, onFort: true },
      { x, y: clamp(y, GROUND_TOP, GROUND_BOTTOM), z: 0, onFort: false },
      "ground",
    );
  }

  private moveOnGround(p: PlayerState, mx: number, my: number, step: number): void {
    const f = this.state.fort;
    p.x = Math.min(p.x + mx * step, f.x + DECK_W + AHEAD);
    p.y = clamp(p.y + my * step, GROUND_TOP, GROUND_BOTTOM);
    if (p.x < f.x - BEHIND) {
      // Zu weit zurueckgefallen: Die Seilwinde holt den Mech aufs Deck, das kostet Rumpf.
      this.damageHull(WINCH_COST, p.x, p.y);
      this.startTransition(
        p,
        "winch",
        WINCH_TIME,
        { x: p.x, y: p.y, z: 0, onFort: false },
        { x: WINCH_LANDING.x, y: WINCH_LANDING.y, z: ELEVATION, onFort: true },
        "deck",
      );
      return;
    }
    const lx = p.x - f.x;
    const ly = p.y - f.y;
    // An der Strickleiter: hochklettern (ausser man laeuft gerade von ihr weg nach vorn).
    if (lx >= LADDER.x0 && lx <= LADDER.x1 && ly >= LADDER.y0 && ly <= LADDER.y1 && my < 0.3) {
      this.startTransition(
        p,
        "climb",
        CLIMB_TIME,
        { x: lx, y: ly, z: 0, onFort: true },
        { x: LADDER_TOP.x, y: LADDER_TOP.y, z: ELEVATION, onFort: true },
        "deck",
      );
    }
  }

  private startTransition(
    p: PlayerState,
    kind: Transition["kind"],
    duration: number,
    from: Anchor,
    to: Anchor,
    toLayer: PlayerState["layer"],
  ): void {
    p.transition = { kind, t: 0, duration, from, to, toLayer };
    p.edgeTime = 0;
    p.moving = false;
    this.events.push({ kind, id: p.id });
  }

  private resolve(anchor: Anchor): { x: number; y: number; z: number } {
    if (!anchor.onFort) {
      return anchor;
    }
    const f = this.state.fort;
    return { x: f.x + anchor.x, y: f.y + anchor.y, z: anchor.z };
  }

  private advanceTransition(p: PlayerState, tr: Transition): void {
    tr.t += TICK;
    const u = Math.min(1, tr.t / tr.duration);
    const a = this.resolve(tr.from);
    const b = this.resolve(tr.to);
    p.x = a.x + (b.x - a.x) * u;
    p.y = a.y + (b.y - a.y) * u;
    const arc = tr.kind === "jump" ? 18 : tr.kind === "winch" ? 46 : 0;
    p.z = a.z + (b.z - a.z) * u + Math.sin(u * Math.PI) * arc;
    if (b.x !== a.x) {
      p.facing = b.x > a.x ? 1 : -1;
    }
    if (u >= 1) {
      p.layer = tr.toLayer;
      p.z = b.z;
      p.transition = null;
    }
  }

  private shoot(p: PlayerState, spec: CrewSpec): void {
    p.cooldown -= TICK;
    if (p.cooldown > 0) {
      return;
    }
    const weapon = spec.weapon;
    const target = this.findTarget(p.x, p.y, weapon.range, p.layer === "deck");
    if (!target) {
      p.cooldown = 0;
      return;
    }
    p.cooldown = weapon.cooldown;
    p.facing = target.x >= p.x ? 1 : -1;
    this.fire(p.id, p.x, p.y, p.z + 26, target, weapon.speed, weapon.damage, "rivet", 0);
  }

  /** Ein Geschoss von (x, y, z) auf ein Ziel abfeuern. */
  private fire(
    owner: string,
    x: number,
    y: number,
    z: number,
    target: EnemyState,
    speed: number,
    damage: number,
    look: ShotState["look"],
    pull: number,
  ): void {
    const dx = target.x - x;
    const dy = target.y - y;
    const distance = Math.hypot(dx, dy) || 1;
    const ux = dx / distance;
    const uy = dy / distance;
    const flight = distance / speed;
    this.state.shots.push({
      id: this.state.nextId++,
      owner,
      look,
      pull,
      x: x + ux * 12,
      y: y + uy * 4,
      z,
      vx: ux * speed,
      vy: uy * speed,
      vz: (14 - z) / flight,
      damage,
      life: flight + 0.3,
    });
    this.events.push({ kind: "shot", owner, x: x + ux * 12, y, z, look });
  }

  /** Naechster Gegner in Reichweite. Von oben (Deck) nicht die unter dem Deck. */
  private findTarget(
    x: number,
    y: number,
    range: number,
    fromDeck: boolean,
    minimum = 0,
  ): EnemyState | null {
    let best: EnemyState | null = null;
    let bestDistance = range;
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0 || (fromDeck && this.underDeck(enemy.x, enemy.y))) {
        continue;
      }
      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      if (distance < bestDistance && distance >= minimum) {
        best = enemy;
        bestDistance = distance;
      }
    }
    return best;
  }

  private collectScrap(p: PlayerState): void {
    const s = this.state;
    const taken = new Set<number>();
    for (const piece of s.scrap) {
      if (piece.z > 0) {
        continue;
      }
      const dx = p.x - piece.x;
      const dy = p.y - piece.y;
      const distance = Math.hypot(dx, dy);
      if (distance < SCRAP_PICKUP) {
        taken.add(piece.id);
        s.bank += piece.value;
        p.scrap += piece.value;
        this.events.push({
          kind: "pickup",
          player: p.id,
          x: piece.x,
          y: piece.y,
          value: piece.value,
        });
      } else if (distance < SCRAP_MAGNET) {
        // Die letzten Meter fliegt Schrott von selbst heran.
        const pull = Math.min(distance, 300 * TICK);
        piece.x += (dx / distance) * pull;
        piece.y += (dy / distance) * pull;
      }
    }
    if (taken.size > 0) {
      s.scrap = s.scrap.filter((piece) => !taken.has(piece.id));
    }
  }

  private useAbility(p: PlayerState, spec: CrewSpec): void {
    const ability = spec.ability;
    p.abilityCd = ability.cooldown;
    this.events.push({ kind: "ability", id: p.id });
    const f = this.state.fort;
    if (ability.hull) {
      const before = f.hull;
      f.hull = Math.min(f.hullMax, f.hull + ability.hull);
      this.events.push({ kind: "repair", amount: f.hull - before });
    }
    if (ability.heal) {
      p.hp = Math.min(p.hpMax, p.hp + ability.heal);
    }
  }

  private hurtPlayer(p: PlayerState, amount: number): void {
    if (!p.alive || p.transition) {
      return;
    }
    p.hp -= amount;
    this.events.push({ kind: "playerHit", id: p.id });
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      p.respawn = RESPAWN_TIME;
      p.moving = false;
      this.events.push({ kind: "playerDown", id: p.id });
    }
  }

  private respawn(p: PlayerState): void {
    const f = this.state.fort;
    p.alive = true;
    p.hp = p.hpMax;
    p.layer = "deck";
    p.x = f.x + RESPAWN_SPOT.x;
    p.y = f.y + RESPAWN_SPOT.y;
    p.z = ELEVATION;
    p.transition = null;
    p.edgeTime = 0;
    this.events.push({ kind: "respawn", id: p.id });
  }

  // --- Module ----------------------------------------------------------------------------------

  private updateModules(): void {
    const s = this.state;
    const f = s.fort;
    for (const m of s.modules) {
      const spec = MODULES[m.type];
      const c = moduleCenter(m);
      const x = f.x + c.x;
      const y = f.y + c.y;
      const z = ELEVATION + 18;
      if (spec.weapon) {
        m.cooldown -= TICK;
        if (m.cooldown > 0) {
          continue;
        }
        const fired = this.fireModule(m, x, y, z);
        // Ohne Ziel gleich wieder bereit; mit Ziel: Generatoren auf Nachbarfeldern machen schneller.
        m.cooldown = fired ? stat(spec.cooldown, m.level) / (1 + generatorBonus(s.modules, m)) : 0;
        continue;
      }
      if (m.type === "oel") {
        this.pourOil(m);
      } else if (m.type === "magnet") {
        this.pullScrap(x, y, stat(spec.power, m.level));
      } else if (m.type === "werkstatt") {
        f.hull = Math.min(f.hullMax, f.hull + stat(spec.power, m.level) * TICK);
      }
    }
  }

  /** Waffenmodul feuert. `true`, wenn es ein Ziel hatte. */
  private fireModule(m: ModuleState, x: number, y: number, z: number): boolean {
    const spec = MODULES[m.type];
    const range = stat(spec.range, m.level);
    const damage = stat(spec.damage, m.level);
    const owner = `m${m.uid}`;
    if (m.type === "geschuetz") {
      const target = this.findTarget(x, y, range, true);
      if (!target) {
        return false;
      }
      m.facing = target.x >= x ? 1 : -1;
      this.fire(owner, x, y, z, target, 560, damage, "bolt", 0);
      return true;
    }
    if (m.type === "harpune") {
      // Der staerkste Gegner in Reichweite.
      let target: EnemyState | null = null;
      for (const e of this.state.enemies) {
        if (
          e.hp > 0 &&
          !this.underDeck(e.x, e.y) &&
          Math.hypot(e.x - x, e.y - y) < range &&
          (!target || e.hp > target.hp)
        ) {
          target = e;
        }
      }
      if (!target) {
        return false;
      }
      m.facing = target.x >= x ? 1 : -1;
      this.fire(owner, x, y, z, target, 700, damage, "harpoon", 600);
      return true;
    }
    if (m.type === "moerser") {
      return this.fireMortar(m, x, y, z, range, damage, stat(spec.area, m.level));
    }
    if (m.type === "spule") {
      return this.zap(m, x, y, z, range, damage, stat(spec.area, m.level));
    }
    return false;
  }

  /** Moerser: zielt dorthin, wo die meisten Gegner beieinanderstehen (nicht zu nah). */
  private fireMortar(
    m: ModuleState,
    x: number,
    y: number,
    z: number,
    range: number,
    damage: number,
    radius: number,
  ): boolean {
    let best: EnemyState | null = null;
    let bestCount = 0;
    for (const e of this.state.enemies) {
      const distance = Math.hypot(e.x - x, e.y - y);
      if (e.hp <= 0 || distance > range || distance < 100 || this.underDeck(e.x, e.y)) {
        continue;
      }
      let count = 0;
      for (const other of this.state.enemies) {
        if (other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) < radius) {
          count += 1;
        }
      }
      if (count > bestCount) {
        best = e;
        bestCount = count;
      }
    }
    if (!best) {
      return false;
    }
    m.facing = best.x >= x ? 1 : -1;
    this.state.shells.push({
      id: this.state.nextId++,
      x0: x,
      y0: y,
      z0: z,
      x1: best.x,
      y1: best.y,
      t: 0,
      duration: 1,
      damage,
      radius,
    });
    this.events.push({ kind: "mortar", uid: m.uid });
    return true;
  }

  /** Funkenspule: Blitz springt von Gegner zu Gegner, auch unter das Deck. */
  private zap(
    m: ModuleState,
    x: number,
    y: number,
    z: number,
    range: number,
    damage: number,
    targets: number,
  ): boolean {
    const first = this.findTarget(x, y, range, false);
    if (!first) {
      return false;
    }
    const hit = new Set<number>();
    const points: [number, number, number][] = [[x, y, z + 10]];
    let current: EnemyState | null = first;
    while (current && hit.size < targets) {
      hit.add(current.id);
      points.push([current.x, current.y, 16]);
      this.damageEnemy(current, damage, x, y, `m${m.uid}`);
      const from: EnemyState = current;
      current = null;
      let bestDistance = 80;
      for (const e of this.state.enemies) {
        const distance = Math.hypot(e.x - from.x, e.y - from.y);
        if (e.hp > 0 && !hit.has(e.id) && distance < bestDistance) {
          current = e;
          bestDistance = distance;
        }
      }
    }
    this.events.push({ kind: "zap", points });
    return true;
  }

  /** Bereich am Boden unter einem Oelkessel (relativ zur Festung). */
  static oilZone(m: Pick<ModuleState, "col" | "row">): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } {
    const x = m.col * TILE_W;
    const y = m.row * TILE_H;
    if (m.row === DECK_ROWS - 1) {
      return { x0: x - 8, y0: DECK_H - 50, x1: x + TILE_W + 8, y1: DECK_H + 24 };
    }
    if (m.row === 0) {
      return { x0: x - 8, y0: -34, x1: x + TILE_W + 8, y1: 22 };
    }
    if (m.col === 0) {
      return { x0: -62, y0: y - 8, x1: 20, y1: y + TILE_H + 8 };
    }
    if (m.col === DECK_COLS - 1) {
      return { x0: DECK_W - 20, y0: y - 8, x1: DECK_W + 62, y1: y + TILE_H + 8 };
    }
    return { x0: 0, y0: 0, x1: 0, y1: 0 };
  }

  private pourOil(m: ModuleState): void {
    const f = this.state.fort;
    const zone = Simulation.oilZone(m);
    const damage = stat(MODULES.oel.power, m.level) * TICK;
    for (const e of this.state.enemies) {
      if (e.hp > 0 && insideRect(zone, e.x - f.x, e.y - f.y)) {
        // Brennt leise: ohne Rueckstoss, nur Schaden.
        e.hp -= damage;
        if (e.hp <= 0) {
          this.killEnemy(e, `m${m.uid}`);
        }
      }
    }
  }

  /** Schrottmagnet: hebt Schrott in Reichweite aufs Deck und legt ihn in die Kasse. */
  private pullScrap(x: number, y: number, radius: number): void {
    const s = this.state;
    const taken = new Set<number>();
    for (const piece of s.scrap) {
      const dx = x - piece.x;
      const dy = y - piece.y;
      const distance = Math.hypot(dx, dy);
      if (distance > radius) {
        continue;
      }
      const step = Math.min(distance, 220 * TICK);
      piece.x += (dx / (distance || 1)) * step;
      piece.y += (dy / (distance || 1)) * step;
      // Je naeher am Magneten, desto hoeher schwebt das Stueck.
      piece.z = Math.max(piece.z, ELEVATION * (1 - Math.min(1, distance / radius)));
      if (distance < 14) {
        taken.add(piece.id);
        s.bank += piece.value;
        this.events.push({
          kind: "pickup",
          player: "magnet",
          x: piece.x,
          y: piece.y - ELEVATION,
          value: piece.value,
        });
      }
    }
    if (taken.size > 0) {
      s.scrap = s.scrap.filter((piece) => !taken.has(piece.id));
    }
  }

  private updateShells(): void {
    const s = this.state;
    for (const shell of s.shells) {
      shell.t += TICK;
      if (shell.t < shell.duration) {
        continue;
      }
      this.events.push({ kind: "boom", x: shell.x1, y: shell.y1, radius: shell.radius });
      for (const e of s.enemies) {
        if (e.hp > 0 && Math.hypot(e.x - shell.x1, e.y - shell.y1) < shell.radius) {
          this.damageEnemy(e, shell.damage, shell.x1, shell.y1, null);
        }
      }
    }
    s.shells = s.shells.filter((shell) => shell.t < shell.duration);
  }

  // --- Gegner ----------------------------------------------------------------------------------

  /** Trupps planen, ankuendigen und auftauchen lassen. */
  private spawn(): void {
    const s = this.state;
    const spec = this.route[s.march.index];
    if (!spec) {
      return;
    }
    // Angekuendigte Trupps tauchen auf.
    for (const warning of s.warnings) {
      warning.eta -= TICK;
      if (warning.eta <= 0) {
        this.spawnGroup(warning.side, warning.at, warning.count, spec.hp);
      }
    }
    s.warnings = s.warnings.filter((w) => w.eta > 0);

    s.march.spawnTimer -= TICK;
    if (s.march.spawnTimer > 0) {
      return;
    }
    const progress = Math.min(1, s.march.done / s.march.length);
    const rate = spec.spawnStart + (spec.spawnEnd - spec.spawnStart) * progress;
    if (rate <= 0) {
      s.march.spawnTimer = 1;
      return;
    }
    // Einzelgaenger oder ein Trupp; Trupps werden im Lauf des Marschs groesser.
    const count = this.rng() < 0.3 ? 1 : 2 + Math.floor(this.rng() * (2 + progress * 5));
    // Im Mittel kommt `rate` Gegner pro Sekunde.
    s.march.spawnTimer = (count / rate) * (0.75 + this.rng() * 0.5);
    const side = this.pickSide();
    const at = this.pickEdgeSpot(side);
    if (count === 1) {
      this.spawnGroup(side, at, 1, spec.hp);
      return;
    }
    s.warnings.push({ id: s.nextId++, side, at, eta: WARNING_TIME, count });
  }

  private pickSide(): Side {
    let roll = this.rng();
    for (const [side, weight] of SIDE_WEIGHTS) {
      roll -= weight;
      if (roll <= 0) {
        return side;
      }
    }
    return "hinten";
  }

  /** Stelle am Rand: y fuer hinten/vorn, x relativ zur Festung fuer oben/unten. */
  private pickEdgeSpot(side: Side): number {
    if (side === "hinten" || side === "vorn") {
      return GROUND_TOP + 20 + this.rng() * (GROUND_BOTTOM - GROUND_TOP - 40);
    }
    return -BEHIND + 30 + this.rng() * (BEHIND + DECK_W + AHEAD - 60);
  }

  /** Wo ein Trupp von dieser Seite auftaucht (Welt). */
  edgePoint(side: Side, at: number): { x: number; y: number } {
    const f = this.state.fort;
    switch (side) {
      case "hinten":
        return { x: f.x - BEHIND - 40, y: at };
      case "vorn":
        return { x: f.x + FRONT_SPAWN, y: at };
      case "oben":
        return { x: f.x + at, y: GROUND_TOP - 110 };
      case "unten":
        return { x: f.x + at, y: GROUND_BOTTOM + 40 };
    }
  }

  private spawnGroup(side: Side, at: number, count: number, hpFactor: number): void {
    const s = this.state;
    const origin = this.edgePoint(side, at);
    const along = side === "hinten" || side === "vorn" ? { x: 0, y: 1 } : { x: 1, y: 0 };
    for (let i = 0; i < count && s.enemies.length < MAX_ENEMIES; i += 1) {
      const spread = (i - (count - 1) / 2) * 18 + (this.rng() - 0.5) * 8;
      const depth = (this.rng() - 0.5) * 24;
      this.addEnemy(
        origin.x + along.x * spread + along.y * depth,
        origin.y + along.y * spread + along.x * depth,
        hpFactor,
      );
    }
    if (count > 1) {
      this.events.push({ kind: "trupp", side, count });
    }
  }

  private addEnemy(x: number, y: number, hpFactor: number): void {
    const spec = ENEMIES.laeufer;
    const f = this.state.fort;
    // Angriffspunkt: einer der vier, die von hier aus am naechsten liegen.
    const near = [...ATTACK_SLOTS]
      .sort(
        (a, b) =>
          Math.hypot(f.x + a.x - x, f.y + a.y - y) - Math.hypot(f.x + b.x - x, f.y + b.y - y),
      )
      .slice(0, 4);
    const slot = near[Math.floor(this.rng() * near.length)] ?? ATTACK_SLOTS[0]!;
    const hp = Math.round(spec.hp * hpFactor);
    this.state.enemies.push({
      id: this.state.nextId++,
      type: "laeufer",
      x,
      y,
      hp,
      hpMax: hp,
      speed: spec.speed * (0.9 + this.rng() * 0.2),
      facing: x > f.x + DECK_W / 2 ? -1 : 1,
      slotX: slot.x + (this.rng() - 0.5) * 12,
      slotY: slot.y + (this.rng() - 0.5) * 10,
      attacking: false,
      attackCd: 0.5,
      pushX: 0,
      pushY: 0,
    });
  }

  private updateEnemies(fortDx: number): void {
    const s = this.state;
    const f = s.fort;
    for (const e of s.enemies) {
      if (e.hp <= 0) {
        continue;
      }
      const spec = ENEMIES[e.type];
      e.attackCd = Math.max(0, e.attackCd - TICK);
      e.x += e.pushX * TICK;
      e.y += e.pushY * TICK;
      e.pushX *= 0.88;
      e.pushY *= 0.88;
      const step = e.speed * TICK;

      // Ein Mech am Boden in der Naehe? Dann auf ihn los.
      const prey = this.nearestGroundPlayer(e.x, e.y, spec.aggro);
      if (prey) {
        e.attacking = false;
        const dx = prey.x - e.x;
        const dy = prey.y - e.y;
        const distance = Math.hypot(dx, dy) || 1;
        e.facing = dx >= 0 ? 1 : -1;
        if (distance > spec.radius + 10) {
          e.x += (dx / distance) * step;
          e.y += (dy / distance) * step;
        } else if (e.attackCd <= 0) {
          e.attackCd = spec.attackCooldown;
          this.hurtPlayer(prey, spec.touchDamage);
        }
        continue;
      }

      // Sonst zur Festung: an einen Fuss oder unter den Bauch.
      const tx = f.x + e.slotX;
      const ty = f.y + e.slotY;
      if (e.attacking) {
        e.x += fortDx;
      }
      const dx = tx - e.x;
      const dy = ty - e.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 2) {
        const move = Math.min(distance, step);
        e.x += (dx / distance) * move;
        e.y += (dy / distance) * move;
        e.facing = dx >= 0 ? 1 : -1;
      }
      if (!e.attacking && distance < 8) {
        e.attacking = true;
      } else if (e.attacking && distance > 24) {
        e.attacking = false;
      }
      if (e.attacking && e.attackCd <= 0) {
        e.attackCd = spec.attackCooldown;
        this.damageHull(spec.hullDamage, e.x, e.y);
      }
    }
    // Nicht alle auf einem Haufen: sanft auseinanderschieben.
    const list = s.enemies;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j += 1) {
        const b = list[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minimum = 16;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < minimum * minimum) {
          const d = Math.sqrt(d2);
          const push = (minimum - d) * 0.25;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }
    s.enemies = s.enemies.filter((e) => e.hp > 0);
  }

  private nearestGroundPlayer(x: number, y: number, range: number): PlayerState | null {
    let best: PlayerState | null = null;
    let bestDistance = range;
    for (const p of this.state.players) {
      if (!p.alive || p.layer !== "ground" || p.transition) {
        continue;
      }
      const distance = Math.hypot(p.x - x, p.y - y);
      if (distance < bestDistance) {
        best = p;
        bestDistance = distance;
      }
    }
    return best;
  }

  private damageEnemy(
    e: EnemyState,
    amount: number,
    fromX: number,
    fromY: number,
    owner: string | null,
  ): void {
    if (e.hp <= 0) {
      return;
    }
    e.hp -= amount;
    const dx = e.x - fromX;
    const dy = e.y - fromY;
    const distance = Math.hypot(dx, dy) || 1;
    e.pushX += (dx / distance) * 70;
    e.pushY += (dy / distance) * 70;
    this.events.push({ kind: "hit", id: e.id, x: e.x, y: e.y });
    if (e.hp <= 0) {
      this.killEnemy(e, owner);
    }
  }

  private killEnemy(e: EnemyState, owner: string | null): void {
    const s = this.state;
    e.hp = 0;
    s.kills += 1;
    const killer = owner ? s.players.find((p) => p.id === owner) : undefined;
    if (killer) {
      killer.kills += 1;
    }
    s.scrap.push({ id: s.nextId++, x: e.x, y: e.y, z: 0, value: ENEMIES[e.type].scrap });
    this.events.push({ kind: "kill", x: e.x, y: e.y, type: e.type });
  }

  /** Harpune: reisst den Getroffenen zur Aufsetzstelle des naechsten Fusses. */
  private pullToFoot(e: EnemyState, strength: number): void {
    const f = this.state.fort;
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (const leg of LEGS) {
      const x = f.x + leg.footX + STRIDE / 2;
      const y = f.y + leg.footY;
      const distance = Math.hypot(x - e.x, y - e.y);
      if (distance < bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
    if (best && bestDistance > 1) {
      e.pushX = ((best.x - e.x) / bestDistance) * strength;
      e.pushY = ((best.y - e.y) / bestDistance) * strength;
    }
  }

  // --- Geschosse -------------------------------------------------------------------------------

  private updateShots(): void {
    const s = this.state;
    for (const shot of s.shots) {
      shot.x += shot.vx * TICK;
      shot.y += shot.vy * TICK;
      shot.z += shot.vz * TICK;
      shot.life -= TICK;
      for (const e of s.enemies) {
        if (e.hp <= 0) {
          continue;
        }
        // Hoch ueber dem Deck fliegt ein Schuss ueber die Gegner darunter hinweg.
        if (shot.z > 40 && this.underDeck(e.x, e.y)) {
          continue;
        }
        if (Math.hypot(e.x - shot.x, e.y - shot.y) < ENEMIES[e.type].radius + 5) {
          this.damageEnemy(
            e,
            shot.damage,
            shot.x - shot.vx * 0.05,
            shot.y - shot.vy * 0.05,
            shot.owner,
          );
          if (shot.pull > 0 && e.hp > 0) {
            this.pullToFoot(e, shot.pull);
          }
          shot.life = 0;
          break;
        }
      }
    }
    s.shots = s.shots.filter((shot) => shot.life > 0);
  }

  // --- Fortschritt -----------------------------------------------------------------------------

  private checkProgress(): void {
    const s = this.state;
    if (s.fort.hull <= 0) {
      s.phase = "lost";
      this.events.push({ kind: "lost" });
      return;
    }
    if (s.phase !== "march" || s.march.done < s.march.length) {
      return;
    }
    this.events.push({ kind: "arrived", index: s.march.index });
    // Die Armee bleibt zurueck: An der Station ist Ruhe.
    s.enemies = [];
    s.shots = [];
    s.shells = [];
    s.warnings = [];
    if (s.march.index + 1 >= s.march.count) {
      s.phase = "won";
      this.events.push({ kind: "won" });
      return;
    }
    s.phase = "rest";
    s.restAt = s.march.station;
    s.march = this.marchFor(s.march.index + 1);
    // Fundstuecke an der Station und ein neues Angebot.
    s.bank += STATION_BONUS;
    s.rerolls = 0;
    s.offer = this.rollOffer();
  }
}
