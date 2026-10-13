/**
 * Der Spielkern der Wanderfestung: rechnet mit festem Takt (60 Hz), kennt weder
 * Phaser noch Netz. Eingaben rein (`advance`), Zustand und Ereignisse raus.
 *
 * Ablauf eines Rechenschritts:
 *   1. Die Festung laeuft (nur im Marsch), die Beine setzen auf und stampfen.
 *   2. Mechs bewegen sich auf dem Deck oder am Boden, springen ab, klettern hoch,
 *      werden von der Seilwinde geholt, schiessen und sammeln Schrott.
 *   3. Gegner erscheinen, laufen der Festung nach und hacken auf sie ein.
 *   4. Geschosse fliegen, Schrott bleibt liegen (und bleibt zurueck).
 *   5. Ziel erreicht? Rumpf zerstoert?
 */

import {
  AHEAD,
  BEHIND,
  CLIMB_TIME,
  DECK_H,
  DECK_W,
  EDGE_HOLD,
  ELEVATION,
  FORT_SPEED,
  GROUND_BOTTOM,
  GROUND_TOP,
  HULL_MAX,
  JUMP_TIME,
  LADDER,
  LADDER_TOP,
  MAX_ENEMIES,
  REPAIR_AMOUNT,
  REPAIR_COST,
  RESPAWN_SPOT,
  RESPAWN_TIME,
  SCRAP_LOST_BEHIND,
  SCRAP_MAGNET,
  SCRAP_PICKUP,
  STOMP_DAMAGE,
  STOMP_RADIUS,
  TICK,
  WINCH_COST,
  WINCH_LANDING,
  WINCH_TIME,
} from "./constants";
import { CREW, type CrewSpec } from "./data/crew";
import { ENEMIES } from "./data/enemies";
import { PROBE_ROUTE, type MarchSpec } from "./data/route";
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
  PlayerInput,
  PlayerSetup,
  PlayerState,
  Transition,
} from "./types";

const IDLE: PlayerInput = { mx: 0, my: 0 };

export interface SimulationOptions {
  route?: readonly MarchSpec[];
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
    const first = this.route[0];
    if (!first) {
      throw new Error("Die Route braucht mindestens einen Marsch.");
    }
    this.state = {
      phase: "march",
      time: 0,
      march: {
        index: 0,
        count: this.route.length,
        station: first.station,
        length: first.length,
        done: 0,
        spawnTimer: 2,
      },
      fort: { x: 0, y: 0, hull: HULL_MAX, hullMax: HULL_MAX, gait: 0, moving: true },
      players: setups.map((setup, index) => this.newPlayer(setup, index)),
      enemies: [],
      shots: [],
      scrap: [],
      bank: 0,
      kills: 0,
      nextId: 1,
    };
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

  /** Befehle aus der Rast: reparieren, weiterziehen. */
  command(_playerId: string, command: Command): void {
    const s = this.state;
    if (s.phase !== "rest") {
      return;
    }
    if (command.kind === "repair") {
      if (s.bank >= REPAIR_COST && s.fort.hull < s.fort.hullMax) {
        s.bank -= REPAIR_COST;
        const before = s.fort.hull;
        s.fort.hull = Math.min(s.fort.hullMax, s.fort.hull + REPAIR_AMOUNT);
        this.pending.push({ kind: "repair", amount: s.fort.hull - before });
      }
      return;
    }
    const index = s.march.index + 1;
    const spec = this.route[index];
    if (!spec) {
      return;
    }
    s.march = {
      index,
      count: this.route.length,
      station: spec.station,
      length: spec.length,
      done: 0,
      spawnTimer: 2.5,
    };
    s.phase = "march";
    this.pending.push({ kind: "depart", index });
  }

  // --- Ein Rechenschritt ---------------------------------------------------------------------

  private tick(inputs: ReadonlyMap<string, PlayerInput>): void {
    const s = this.state;
    if (s.phase === "won" || s.phase === "lost") {
      return;
    }
    s.time += TICK;
    const marching = s.phase === "march";
    const fortDx = marching ? FORT_SPEED * TICK : 0;
    s.fort.moving = marching;
    if (marching) {
      const before = s.fort.gait;
      s.fort.x += fortDx;
      s.fort.gait += TICK;
      s.march.done += fortDx;
      this.stomp(before, s.fort.gait);
    }
    for (const player of s.players) {
      this.updatePlayer(player, inputs.get(player.id) ?? IDLE, fortDx);
    }
    if (marching) {
      this.spawn();
    }
    this.updateEnemies(fortDx);
    this.updateShots();
    if (marching) {
      const lostAt = s.fort.x - SCRAP_LOST_BEHIND;
      s.scrap = s.scrap.filter((piece) => piece.x > lostAt);
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
    const target = this.findTarget(p, weapon.range);
    if (!target) {
      p.cooldown = 0;
      return;
    }
    p.cooldown = weapon.cooldown;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const distance = Math.hypot(dx, dy) || 1;
    const ux = dx / distance;
    const uy = dy / distance;
    const z = p.z + 26;
    const flight = distance / weapon.speed;
    this.state.shots.push({
      id: this.state.nextId++,
      owner: p.id,
      x: p.x + ux * 12,
      y: p.y + uy * 4,
      z,
      vx: ux * weapon.speed,
      vy: uy * weapon.speed,
      vz: (14 - z) / flight,
      damage: weapon.damage,
      life: flight + 0.3,
    });
    p.facing = ux >= 0 ? 1 : -1;
    this.events.push({ kind: "shot", owner: p.id, x: p.x + ux * 12, y: p.y, z });
  }

  /** Naechster Gegner in Reichweite. Vom Deck aus nicht die unter dem Deck. */
  private findTarget(p: PlayerState, range: number): EnemyState | null {
    const f = this.state.fort;
    let best: EnemyState | null = null;
    let bestDistance = range;
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      if (p.layer === "deck" && insideRect(BLIND_SPOT, enemy.x - f.x, enemy.y - f.y)) {
        continue;
      }
      const distance = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (distance < bestDistance) {
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
        // Magnet: Schrott fliegt die letzten Meter von selbst heran.
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

  // --- Gegner ----------------------------------------------------------------------------------

  private spawn(): void {
    const s = this.state;
    const spec = this.route[s.march.index];
    if (!spec) {
      return;
    }
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
    const group = progress > 0.4 && this.rng() < 0.35 ? 2 + (this.rng() < 0.4 ? 1 : 0) : 1;
    // Im Mittel kommt `rate` Gegner pro Sekunde, egal ob einzeln oder in Gruppen.
    s.march.spawnTimer = (group * (0.6 + this.rng() * 0.8)) / rate;
    const f = s.fort;
    let x: number;
    let y: number;
    if (this.rng() < 0.6) {
      // Von hinten
      x = f.x - BEHIND - 30;
      y = GROUND_TOP + this.rng() * (GROUND_BOTTOM - GROUND_TOP);
    } else {
      // Von oben oder unten, eher aus der hinteren Haelfte
      x = f.x - BEHIND + this.rng() * (BEHIND + 160);
      y = this.rng() < 0.5 ? GROUND_TOP - 110 : GROUND_BOTTOM + 40;
    }
    for (let i = 0; i < group && s.enemies.length < MAX_ENEMIES; i += 1) {
      this.addEnemy(x + (this.rng() - 0.5) * 30, y + (this.rng() - 0.5) * 30, spec.hp);
    }
  }

  private addEnemy(x: number, y: number, hpFactor: number): void {
    const spec = ENEMIES.laeufer;
    const feet = ATTACK_SLOTS.filter((slot) => !slot.belly);
    const belly = ATTACK_SLOTS.filter((slot) => slot.belly);
    const pool = this.rng() < 0.4 ? feet : belly;
    const slot = pool[Math.floor(this.rng() * pool.length)] ?? ATTACK_SLOTS[0]!;
    const hp = Math.round(spec.hp * hpFactor);
    this.state.enemies.push({
      id: this.state.nextId++,
      type: "laeufer",
      x,
      y,
      hp,
      hpMax: hp,
      speed: spec.speed * (0.9 + this.rng() * 0.2),
      facing: 1,
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
    if (e.hp > 0) {
      return;
    }
    const s = this.state;
    s.kills += 1;
    const killer = owner ? s.players.find((p) => p.id === owner) : undefined;
    if (killer) {
      killer.kills += 1;
    }
    s.scrap.push({ id: s.nextId++, x: e.x, y: e.y, value: ENEMIES[e.type].scrap });
    this.events.push({ kind: "kill", x: e.x, y: e.y, type: e.type });
  }

  // --- Geschosse -------------------------------------------------------------------------------

  private updateShots(): void {
    const s = this.state;
    const f = s.fort;
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
        if (shot.z > 40 && insideRect(BLIND_SPOT, e.x - f.x, e.y - f.y)) {
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
    if (s.march.index + 1 >= s.march.count) {
      s.phase = "won";
      this.events.push({ kind: "won" });
    } else {
      s.phase = "rest";
    }
  }
}
