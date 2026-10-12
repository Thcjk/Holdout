/**
 * Die Simulation: das ganze Spiel als reine Rechnung.
 *
 * Eingaben rein (Bewegung je Spieler, Befehle im Shop), Zustand raus. Kein
 * Phaser, kein Netz, keine Uhr - die Zeit kommt als Zahl von aussen. Dadurch
 * rechnet derselbe Code solo auf dem Handy und im Koop auf dem Host, und die
 * Tests spielen ganze Runden in Millisekunden durch.
 *
 * Ablauf einer Runde:
 *   Welle 1 ... Pause (Level-Ups, Shop) ... Welle 2 ... Pause ... Welle 20
 * In einer Welle laeuft die Uhr herunter, Gegner erscheinen nach Plan, Waffen
 * schiessen von selbst. Faellt die Uhr auf null, verschwinden alle Gegner, das
 * Material wird eingesammelt, und die Pause beginnt.
 */

import {
  ARENA,
  MAGNET_RADIUS,
  MAX_ENEMIES,
  MAX_TICKS_PER_FRAME,
  PICKUP_RADIUS,
  PLAYER_IFRAMES,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SPAWN_MARKER_TIME,
  TICK,
  TICK_MS,
} from "./constants";
import {
  ENEMIES,
  FINAL_WAVE,
  damageScale,
  hpScale,
  planWave,
  playerCountHp,
  speedScale,
  waveLength,
} from "./data/enemies";
import type { SpawnPlan } from "./data/enemies";
import { abilityCooldown } from "./data/abilities";
import { armorFactor } from "./data/stats";
import { WEAPONS, weaponCooldown, weaponDamage, weaponReach } from "./data/weapons";
import { createPlayer, grantXp, startPosition } from "./player";
import { createRng } from "./rng";
import type { Rng } from "./rng";
import * as shop from "./shop";
import type {
  Command,
  Enemy,
  EnemyType,
  GameEvent,
  GameState,
  OwnedWeapon,
  PlayerInput,
  PlayerSetup,
  PlayerState,
  Projectile,
} from "./types";

const DEG = Math.PI / 180;

/** Rueckstoss klingt mit dieser Rate pro Sekunde ab. */
const KNOCKBACK_DECAY = 8;

/** Abstand zu allen Spielern, in dem kein Gegner erscheinen darf. */
const SPAWN_SAFE_DISTANCE = 150;

/** Geschoss-Aussehen der Granate (siehe `Projectile.look`). */
const LOOK_GRENADE = 6;
const GRENADE_RADIUS = 110;

/** So lange brennt ein Gegner nach einem Treffer mit dem Flammenwerfer. */
const BURN_TIME = 3;
/** Reichweite, in der ein Blitz zum naechsten Gegner springt. */
const CHAIN_REACH = 150;

export class Simulation {
  readonly state: GameState;
  /** Ereignisse des letzten `advance`-Aufrufs. */
  events: GameEvent[] = [];

  private readonly rng: Rng;
  private nextId = 1;
  private plan: SpawnPlan[] = [];
  private planIndex = 0;
  private waveClock = 0;
  private accumulator = 0;
  /** Letzte Laufrichtung je Spieler - fuer den Schattenschritt. */
  private readonly moveAngle = new Map<string, number>();

  constructor(setups: readonly PlayerSetup[], seed: number) {
    this.rng = createRng(seed);
    const players = setups.map((setup, index) => createPlayer(setup, index, setups.length));
    this.state = {
      phase: "wave",
      wave: 1,
      timeLeft: 0,
      waveLength: 0,
      players,
      enemies: [],
      shots: [],
      pickups: [],
      markers: [],
      tick: 0,
    };
    this.startWave(1);
  }

  /**
   * Rechnet so viele feste Schritte, wie in die vergangene Zeit passen.
   *
   * @returns Anzahl der Schritte
   */
  advance(deltaMs: number, inputs: ReadonlyMap<string, PlayerInput>): number {
    this.events = [];
    this.accumulator += Math.min(deltaMs, 250);
    let ticks = 0;
    while (this.accumulator >= TICK_MS && ticks < MAX_TICKS_PER_FRAME) {
      this.step(inputs);
      this.accumulator -= TICK_MS;
      ticks += 1;
    }
    if (ticks >= MAX_TICKS_PER_FRAME) {
      // Nach einem langen Haenger nicht alles nachholen wollen.
      this.accumulator = 0;
    }
    return ticks;
  }

  /** Ein einzelner Schritt - die Tests rufen ihn direkt auf. */
  step(inputs: ReadonlyMap<string, PlayerInput>): void {
    this.state.tick += 1;
    if (this.state.phase === "wave") {
      this.stepWave(inputs);
    } else if (this.state.phase === "shop") {
      this.stepShop();
    }
  }

  /** Ein Befehl aus der Pause. Alles ausserhalb der Pause wird ignoriert. */
  command(playerId: string, command: Command): boolean {
    if (this.state.phase !== "shop") {
      return false;
    }
    const player = this.state.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      return false;
    }
    const wave = this.state.wave;
    switch (command.k) {
      case "buy": {
        const ok = shop.buy(player, command.slot);
        if (ok) {
          this.events.push({ t: "bought", pid: player.id });
        }
        return ok;
      }
      case "reroll":
        return shop.reroll(player, wave, this.rng);
      case "lock":
        return shop.toggleLock(player, command.slot);
      case "sell":
        return shop.sell(player, command.index, wave);
      case "merge":
        return shop.merge(player, command.index);
      case "upgrade":
        return shop.chooseUpgrade(player, command.pick, this.rng);
      case "ready": {
        if (command.value && player.pendingLevels > 0) {
          return false;
        }
        player.ready = command.value;
        return true;
      }
      default:
        return false;
    }
  }

  removePlayer(id: string): void {
    const index = this.state.players.findIndex((player) => player.id === id);
    if (index >= 0) {
      this.state.players.splice(index, 1);
    }
  }

  // ---------------------------------------------------------------------------
  // Wellen
  // ---------------------------------------------------------------------------

  private startWave(wave: number): void {
    const state = this.state;
    state.phase = "wave";
    state.wave = wave;
    state.waveLength = waveLength(wave);
    state.timeLeft = state.waveLength;
    state.enemies = [];
    state.shots = [];
    state.pickups = [];
    state.markers = [];
    this.waveClock = 0;
    this.planIndex = 0;
    this.plan = planWave(wave, state.players.length, this.rng);

    state.players.forEach((player, index) => {
      const start = startPosition(index, state.players.length);
      player.x = start.x;
      player.y = start.y;
      player.hp = player.stats.maxHp;
      player.alive = true;
      player.iframes = 0.6;
      player.ready = false;
      player.shop.upgradeChoices = null;
      player.abilityCd = Math.min(player.abilityCd, 1.5);
      player.buff = 0;
      for (const weapon of player.weapons) {
        weapon.cd = 0.3;
      }
    });
    this.events.push({ t: "waveStart", wave });
  }

  private endWave(): void {
    const state = this.state;
    this.events.push({ t: "waveEnd", wave: state.wave });
    state.enemies = [];
    state.shots = [];
    state.markers = [];

    // Alles Material, das noch liegt, geht zum naechsten Spieler.
    for (const pickup of state.pickups) {
      const owner = this.nearestAlivePlayer(pickup.x, pickup.y);
      if (owner) {
        this.collect(owner, pickup.value, false);
      }
    }
    state.pickups = [];

    // Ernte: bringt jedem Spieler am Wellenende Material, auch wer am Boden liegt.
    for (const player of state.players) {
      const bonus = Math.round(player.stats.harvesting);
      if (bonus > 0) {
        player.gold += bonus;
        grantXp(player, bonus);
      }
    }

    if (state.wave >= FINAL_WAVE) {
      state.phase = "won";
      return;
    }

    state.phase = "shop";
    for (const player of state.players) {
      player.alive = true;
      player.hp = player.stats.maxHp;
      shop.openShop(player, state.wave, this.rng);
    }
  }

  private stepShop(): void {
    const players = this.state.players;
    if (players.length === 0) {
      return;
    }
    if (players.every((player) => player.ready && player.pendingLevels === 0)) {
      this.startWave(this.state.wave + 1);
    }
  }

  private stepWave(inputs: ReadonlyMap<string, PlayerInput>): void {
    const state = this.state;
    this.waveClock += TICK;
    state.timeLeft -= TICK;

    this.runSpawnPlan();
    this.updateMarkers();
    this.updatePlayers(inputs);
    this.updateEnemies();
    this.separateEnemies();
    this.updateProjectiles();
    this.updatePickups();

    if (state.players.length > 0 && state.players.every((player) => !player.alive)) {
      state.phase = "lost";
      return;
    }
    if (state.timeLeft <= 0) {
      this.endWave();
    }
  }

  // ---------------------------------------------------------------------------
  // Spawnen
  // ---------------------------------------------------------------------------

  private runSpawnPlan(): void {
    while (this.planIndex < this.plan.length) {
      const group = this.plan[this.planIndex];
      if (!group || group.at > this.waveClock) {
        break;
      }
      this.planIndex += 1;
      this.queueGroup(group);
    }
  }

  private queueGroup(group: SpawnPlan): void {
    // Eine Gruppe erscheint dicht beieinander, damit Wuselchen als Schwarm kommen.
    const center = this.spawnPosition();
    for (let i = 0; i < group.count; i += 1) {
      const spread = group.count > 1 ? 36 : 0;
      const x = clamp(center.x + (this.rng() - 0.5) * spread * 2, 20, ARENA.width - 20);
      const y = clamp(center.y + (this.rng() - 0.5) * spread * 2, 20, ARENA.height - 20);
      this.state.markers.push({ x, y, t: SPAWN_MARKER_TIME, type: group.type });
    }
  }

  private spawnPosition(): { x: number; y: number } {
    let best = { x: ARENA.width / 2, y: ARENA.height / 2 };
    let bestDistance = -1;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const x = 30 + this.rng() * (ARENA.width - 60);
      const y = 30 + this.rng() * (ARENA.height - 60);
      let nearest = Infinity;
      for (const player of this.state.players) {
        if (player.alive) {
          nearest = Math.min(nearest, Math.hypot(player.x - x, player.y - y));
        }
      }
      if (nearest >= SPAWN_SAFE_DISTANCE) {
        return { x, y };
      }
      if (nearest > bestDistance) {
        bestDistance = nearest;
        best = { x, y };
      }
    }
    return best;
  }

  private updateMarkers(): void {
    const state = this.state;
    for (const marker of state.markers) {
      marker.t -= TICK;
    }
    const due = state.markers.filter((marker) => marker.t <= 0);
    if (due.length === 0) {
      return;
    }
    state.markers = state.markers.filter((marker) => marker.t > 0);
    for (const marker of due) {
      if (state.enemies.length < MAX_ENEMIES) {
        this.spawnEnemy(marker.type, marker.x, marker.y);
      }
    }
  }

  private spawnEnemy(type: EnemyType, x: number, y: number): Enemy {
    const def = ENEMIES[type];
    const maxHp = Math.max(
      1,
      Math.round(def.hp * hpScale(this.state.wave) * playerCountHp(this.state.players.length)),
    );
    const enemy: Enemy = {
      id: this.nextId++,
      type,
      x,
      y,
      hp: maxHp,
      maxHp,
      mode: "move",
      timer: 1 + this.rng() * 2,
      timer2: type === "elite" ? 4 : type === "boss" ? 3 : 1 + this.rng() * 1.5,
      dirX: 0,
      dirY: 0,
      kx: 0,
      ky: 0,
      flash: 0,
      burn: 0,
      burnDps: 0,
      slow: 0,
      stun: 0,
    };
    this.state.enemies.push(enemy);
    return enemy;
  }

  // ---------------------------------------------------------------------------
  // Spieler
  // ---------------------------------------------------------------------------

  private updatePlayers(inputs: ReadonlyMap<string, PlayerInput>): void {
    for (const player of this.state.players) {
      if (!player.alive) {
        continue;
      }
      player.iframes = Math.max(0, player.iframes - TICK);
      player.abilityCd = Math.max(0, player.abilityCd - TICK);
      player.buff = Math.max(0, player.buff - TICK);

      const input = inputs.get(player.id);
      if (input) {
        let mx = input.mx;
        let my = input.my;
        const length = Math.hypot(mx, my);
        if (length > 1) {
          mx /= length;
          my /= length;
        }
        if (length > 0.05) {
          const speed = PLAYER_SPEED * (1 + player.stats.speed / 100);
          player.x = clamp(player.x + mx * speed * TICK, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
          player.y = clamp(player.y + my * speed * TICK, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
          player.facing = Math.atan2(my, mx);
          this.moveAngle.set(player.id, player.facing);
        }
        // Faehigkeit: Der Zaehler steigt mit jedem Knopfdruck. Nur ein neuer Wert loest aus,
        // damit ein im Netz doppelt angekommenes Paket nicht zweimal zuendet.
        if (input.ability !== undefined && input.ability > player.abilityAck) {
          player.abilityAck = input.ability;
          if (player.abilityCd <= 0) {
            this.useAbility(player);
          }
        }
      }

      if (player.stats.regen > 0 && player.hp < player.stats.maxHp) {
        player.hp = Math.min(player.stats.maxHp, player.hp + player.stats.regen * 0.5 * TICK);
      }

      for (const weapon of player.weapons) {
        weapon.cd -= TICK;
        if (weapon.cd <= 0) {
          this.tryFire(player, weapon);
        }
      }
    }
  }

  private nearestAlivePlayer(x: number, y: number): PlayerState | null {
    let best: PlayerState | null = null;
    let bestDistance = Infinity;
    for (const player of this.state.players) {
      if (!player.alive) {
        continue;
      }
      const distance = Math.hypot(player.x - x, player.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = player;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Waffen
  // ---------------------------------------------------------------------------

  private tryFire(player: PlayerState, weapon: OwnedWeapon): void {
    const def = WEAPONS[weapon.id];
    const stats = player.stats;
    const reach = weaponReach(weapon.id, stats);

    const target = this.nearestEnemy(player.x, player.y, reach);
    if (!target) {
      // Bereit, aber niemand in Reichweite: nicht ins Minus rutschen lassen,
      // sonst feuerte die Waffe beim ersten Gegner mehrfach hintereinander.
      weapon.cd = 0;
      return;
    }

    const angle = Math.atan2(target.y - player.y, target.x - player.x);
    player.facing = angle;

    const damage = weaponDamage(weapon.id, weapon.tier, stats);
    const lucky = player.character === "glueckspilz" && player.buff > 0 ? 40 : 0;
    const critChance = stats.crit + def.critBonus + lucky;

    weapon.cd += weaponCooldown(weapon.id, weapon.tier, stats);

    if (def.kind === "ranged") {
      this.fireRanged(player, weapon, angle, damage, critChance);
    } else {
      this.swing(player, weapon, angle, damage, critChance, reach);
    }
  }

  private fireRanged(
    player: PlayerState,
    weapon: OwnedWeapon,
    angle: number,
    damage: number,
    critChance: number,
  ): void {
    const def = WEAPONS[weapon.id];
    const reach = def.range + player.stats.range;
    for (let i = 0; i < def.count; i += 1) {
      // Schrot faechert gleichmaessig auf, Einzelschuesse streuen zufaellig.
      const offset =
        def.count > 1
          ? (i / (def.count - 1) - 0.5) * def.spread * DEG + (this.rng() - 0.5) * 4 * DEG
          : (this.rng() - 0.5) * def.spread * DEG;
      const crit = this.rng() * 100 < critChance;
      const shot: Projectile = {
        id: this.nextId++,
        x: player.x,
        y: player.y,
        vx: Math.cos(angle + offset) * def.speed,
        vy: Math.sin(angle + offset) * def.speed,
        damage: Math.max(1, Math.round(damage * (crit ? 2 : 1))),
        pierce: def.pierce[weapon.tier - 1] ?? 0,
        life: (reach + 60) / def.speed,
        friendly: true,
        ownerId: player.id,
        crit,
        radius: def.look === 2 ? 6 : def.look === 3 ? 7 : 4,
        hit: [],
        weapon: weapon.id,
        look: def.look ?? 0,
      };
      this.state.shots.push(shot);
    }
    this.events.push({ t: "shot", pid: player.id, kind: "ranged", x: player.x, y: player.y, angle, w: weapon.id });
  }

  private swing(
    player: PlayerState,
    weapon: OwnedWeapon,
    angle: number,
    damage: number,
    critChance: number,
    reach: number,
  ): void {
    const def = WEAPONS[weapon.id];
    const half = (def.spread / 2) * DEG;
    const candidates: { enemy: Enemy; distance: number }[] = [];
    for (const enemy of this.state.enemies) {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > reach + ENEMIES[enemy.type].radius) {
        continue;
      }
      const diff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - angle));
      // Je naeher ein Gegner, desto breiter darf der Winkel sein - sonst schlaegt
      // man an einem Gegner vorbei, der direkt neben einem steht.
      const allowed = half + Math.atan2(ENEMIES[enemy.type].radius, Math.max(1, distance));
      if (diff <= allowed) {
        candidates.push({ enemy, distance });
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    for (const { enemy } of candidates.slice(0, def.count)) {
      const crit = this.rng() * 100 < critChance;
      if (def.stun) {
        enemy.stun = Math.max(enemy.stun, def.stun);
      }
      this.damageEnemy(
        enemy,
        Math.max(1, Math.round(damage * (crit ? 2 : 1))),
        crit,
        player,
        def.knockback,
        player.x,
        player.y,
      );
    }
    this.events.push({ t: "shot", pid: player.id, kind: "melee", x: player.x, y: player.y, angle, w: weapon.id });
  }

  private nearestEnemy(x: number, y: number, reach: number): Enemy | null {
    let best: Enemy | null = null;
    let bestDistance = Infinity;
    for (const enemy of this.state.enemies) {
      const distance = Math.hypot(enemy.x - x, enemy.y - y) - ENEMIES[enemy.type].radius;
      if (distance <= reach && distance < bestDistance) {
        bestDistance = distance;
        best = enemy;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Schaden
  // ---------------------------------------------------------------------------

  private damageEnemy(
    enemy: Enemy,
    damage: number,
    crit: boolean,
    owner: PlayerState | null,
    knockback: number,
    fromX: number,
    fromY: number,
  ): void {
    if (enemy.hp <= 0) {
      return;
    }
    enemy.hp -= damage;
    enemy.flash = 0.1;
    this.events.push({ t: "hit", x: enemy.x, y: enemy.y - 10, dmg: damage, crit, enemy: true });

    const def = ENEMIES[enemy.type];
    const dx = enemy.x - fromX;
    const dy = enemy.y - fromY;
    const length = Math.hypot(dx, dy) || 1;
    enemy.kx += (dx / length) * knockback * def.knockback * 6;
    enemy.ky += (dy / length) * knockback * def.knockback * 6;

    if (owner && owner.alive && owner.stats.lifesteal > 0 && this.rng() * 100 < owner.stats.lifesteal) {
      if (owner.hp < owner.stats.maxHp) {
        owner.hp = Math.min(owner.stats.maxHp, owner.hp + 2);
        this.events.push({ t: "heal", pid: owner.id, x: owner.x, y: owner.y - 14, amount: 2 });
      }
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy, owner);
    }
  }

  private killEnemy(enemy: Enemy, owner: PlayerState | null): void {
    const state = this.state;
    const index = state.enemies.indexOf(enemy);
    if (index < 0) {
      return;
    }
    state.enemies.splice(index, 1);
    // Der Teiler zerfaellt in drei Wuselchen.
    if (enemy.type === "splitter") {
      for (let i = 0; i < 3; i += 1) {
        if (state.enemies.length < MAX_ENEMIES) {
          const angle = (i / 3) * Math.PI * 2 + this.rng();
          const child = this.spawnEnemy(
            "swarmer",
            clamp(enemy.x + Math.cos(angle) * 14, 10, ARENA.width - 10),
            clamp(enemy.y + Math.sin(angle) * 14, 10, ARENA.height - 10),
          );
          child.kx = Math.cos(angle) * 260;
          child.ky = Math.sin(angle) * 260;
        }
      }
    }
    if (owner) {
      owner.kills += 1;
    }
    const def = ENEMIES[enemy.type];
    const big = enemy.type === "bruiser" || enemy.type === "elite" || enemy.type === "boss" || enemy.type === "splitter";
    this.events.push({ t: "kill", x: enemy.x, y: enemy.y, big });

    const luck = owner?.stats.luck ?? 0;
    const chance = Math.min(1, def.dropChance + Math.max(0, luck) / 400);
    if (this.rng() < chance) {
      // Glueck kann den Fund verdoppeln.
      const lucky = luck > 0 && this.rng() < luck / 250;
      state.pickups.push({
        id: this.nextId++,
        x: clamp(enemy.x + (this.rng() - 0.5) * 14, 8, ARENA.width - 8),
        y: clamp(enemy.y + (this.rng() - 0.5) * 14, 8, ARENA.height - 8),
        value: def.drop * (lucky ? 2 : 1),
        magnet: false,
      });
    }

    // Faellt der Boss in der letzten Welle, ist die Runde gewonnen.
    if (enemy.type === "boss" && state.wave >= FINAL_WAVE) {
      this.endWave();
    }
  }

  private hurtPlayer(player: PlayerState, raw: number): void {
    if (!player.alive || player.iframes > 0) {
      return;
    }
    // Bollwerk und Schattenschritt machen unverwundbar.
    if (player.buff > 0 && (player.character === "panzer" || player.character === "schatten")) {
      return;
    }
    if (this.rng() * 100 < player.stats.dodge) {
      player.iframes = 0.25;
      this.events.push({ t: "dodge", pid: player.id, x: player.x, y: player.y - 16 });
      return;
    }
    const damage = Math.max(1, Math.round(raw * armorFactor(player.stats.armor)));
    player.hp -= damage;
    player.iframes = PLAYER_IFRAMES;
    this.events.push({ t: "hit", x: player.x, y: player.y - 16, dmg: damage, crit: false, enemy: false });
    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      this.events.push({ t: "down", pid: player.id, x: player.x, y: player.y });
    }
  }

  // ---------------------------------------------------------------------------
  // Gegner
  // ---------------------------------------------------------------------------

  private updateEnemies(): void {
    const wave = this.state.wave;
    const dmgScale = damageScale(wave);
    const spdScale = speedScale(wave);

    // Kopie, weil Gegner waehrend der Schleife neue Gegner (Schwarm) erzeugen koennen.
    for (const enemy of [...this.state.enemies]) {
      if (enemy.hp <= 0 || !this.state.enemies.includes(enemy)) {
        continue;
      }
      const def = ENEMIES[enemy.type];
      enemy.flash = Math.max(0, enemy.flash - TICK);
      enemy.slow = Math.max(0, enemy.slow - TICK);
      enemy.stun = Math.max(0, enemy.stun - TICK);

      // Brand: Schaden ueber Zeit, ohne Rueckstoss.
      if (enemy.burn > 0) {
        enemy.burn -= TICK;
        enemy.hp -= enemy.burnDps * TICK;
        if (enemy.hp <= 0) {
          this.killEnemy(enemy, this.nearestAlivePlayer(enemy.x, enemy.y));
          continue;
        }
      }

      const target = this.nearestAlivePlayer(enemy.x, enemy.y);
      if (target && enemy.stun <= 0) {
        this.runEnemyAi(enemy, target, spdScale * (enemy.slow > 0 ? 0.5 : 1), dmgScale);
        if (!this.state.enemies.includes(enemy)) {
          continue;
        }
      }

      // Rueckstoss
      enemy.x += enemy.kx * TICK;
      enemy.y += enemy.ky * TICK;
      const decay = Math.exp(-KNOCKBACK_DECAY * TICK);
      enemy.kx *= decay;
      enemy.ky *= decay;

      enemy.x = clamp(enemy.x, def.radius, ARENA.width - def.radius);
      enemy.y = clamp(enemy.y, def.radius, ARENA.height - def.radius);

      // Beruehrung
      for (const player of this.state.players) {
        if (!player.alive) {
          continue;
        }
        const reach = def.radius + PLAYER_RADIUS - 2;
        if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < reach) {
          this.hurtPlayer(player, def.damage * dmgScale);
        }
      }
    }
  }

  private runEnemyAi(enemy: Enemy, target: PlayerState, spdScale: number, dmgScale: number): void {
    const def = ENEMIES[enemy.type];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const speed = def.speed * spdScale;

    switch (enemy.type) {
      case "grunt":
      case "swarmer":
      case "bruiser":
      case "splitter":
        enemy.x += nx * speed * TICK;
        enemy.y += ny * speed * TICK;
        break;

      case "exploder": {
        // Rennt heran, bleibt kurz stehen und zischt - dann knallt es.
        if (enemy.mode === "windup") {
          enemy.timer -= TICK;
          if (enemy.timer <= 0) {
            this.enemyExplode(enemy, 85, def.damage * 4.5 * dmgScale);
          }
        } else {
          enemy.x += nx * speed * TICK;
          enemy.y += ny * speed * TICK;
          if (distance < 52) {
            enemy.mode = "windup";
            enemy.timer = 0.55;
          }
        }
        break;
      }

      case "spitter": {
        // Haelt Abstand: zu nah -> zurueck, zu weit -> heran.
        const wanted = 250;
        const dir = distance > wanted + 30 ? 1 : distance < wanted - 50 ? -1 : 0;
        enemy.x += nx * speed * TICK * dir;
        enemy.y += ny * speed * TICK * dir;
        enemy.timer2 -= TICK;
        if (enemy.timer2 <= 0 && distance < 480) {
          enemy.timer2 = 2.4;
          this.enemyShot(enemy, nx, ny, 190, def.damage * 1.4 * dmgScale);
        }
        break;
      }

      case "charger":
      case "boss":
        this.runChargerAi(enemy, nx, ny, distance, speed);
        if (enemy.type === "boss") {
          enemy.timer2 -= TICK;
          if (enemy.timer2 <= 0) {
            enemy.timer2 = 2.6;
            // Abwechselnd: Ring, gezielter Faecher, Ring - und dazwischen ruft er Zuender.
            const pattern = Math.floor(this.state.tick / 60) % 3;
            if (pattern === 1) {
              this.fanShot(enemy, nx, ny, 5, 0.5, 230, def.damage * 0.8 * dmgScale);
            } else {
              this.radialBurst(enemy, 14, 170, def.damage * 0.8 * dmgScale);
            }
            if (this.rng() < 0.45) {
              for (let i = 0; i < 2; i += 1) {
                if (this.state.enemies.length < MAX_ENEMIES) {
                  this.spawnEnemy(
                    "exploder",
                    clamp(enemy.x + (this.rng() - 0.5) * 120, 20, ARENA.width - 20),
                    clamp(enemy.y + (this.rng() - 0.5) * 120, 20, ARENA.height - 20),
                  );
                }
              }
            }
          }
        }
        break;

      case "elite": {
        enemy.x += nx * speed * TICK;
        enemy.y += ny * speed * TICK;
        // Spuckt alle drei Sekunden einen Faecher aus drei Kugeln.
        enemy.timer -= TICK;
        if (enemy.timer <= 0) {
          enemy.timer = 3;
          this.fanShot(enemy, nx, ny, 3, 0.35, 200, def.damage * 0.7 * dmgScale);
        }
        enemy.timer2 -= TICK;
        if (enemy.timer2 <= 0) {
          enemy.timer2 = 5;
          // Die Koenigslarve ruft Nachwuchs.
          for (let i = 0; i < 3; i += 1) {
            if (this.state.enemies.length < MAX_ENEMIES) {
              this.spawnEnemy(
                "swarmer",
                clamp(enemy.x + (this.rng() - 0.5) * 80, 20, ARENA.width - 20),
                clamp(enemy.y + (this.rng() - 0.5) * 80, 20, ARENA.height - 20),
              );
            }
          }
        }
        break;
      }
    }
  }

  /** Anlaufen, kurz ducken, losstuermen, verschnaufen - und wieder von vorn. */
  private runChargerAi(enemy: Enemy, nx: number, ny: number, distance: number, speed: number): void {
    switch (enemy.mode) {
      case "move":
        enemy.x += nx * speed * TICK;
        enemy.y += ny * speed * TICK;
        enemy.timer -= TICK;
        if (distance < 280 && enemy.timer <= 0) {
          enemy.mode = "windup";
          enemy.timer = 0.7;
          enemy.dirX = nx;
          enemy.dirY = ny;
        }
        break;
      case "windup":
        enemy.timer -= TICK;
        // Zielt bis kurz vor dem Start nach, danach ist die Richtung fest.
        if (enemy.timer > 0.2) {
          enemy.dirX = nx;
          enemy.dirY = ny;
        }
        if (enemy.timer <= 0) {
          enemy.mode = "dash";
          enemy.timer = 0.6;
        }
        break;
      case "dash":
        enemy.x += enemy.dirX * speed * 4.2 * TICK;
        enemy.y += enemy.dirY * speed * 4.2 * TICK;
        enemy.timer -= TICK;
        if (enemy.timer <= 0) {
          enemy.mode = "recover";
          enemy.timer = 0.6;
        }
        break;
      case "recover":
        enemy.timer -= TICK;
        if (enemy.timer <= 0) {
          enemy.mode = "move";
          enemy.timer = 2 + this.rng() * 1.5;
        }
        break;
    }
  }

  private enemyShot(enemy: Enemy, nx: number, ny: number, speed: number, damage: number): void {
    this.state.shots.push({
      id: this.nextId++,
      x: enemy.x,
      y: enemy.y,
      vx: nx * speed,
      vy: ny * speed,
      damage: Math.max(1, Math.round(damage)),
      pierce: 0,
      life: 4,
      friendly: false,
      ownerId: "",
      crit: false,
      radius: 5,
      hit: [],
      weapon: "",
      look: 0,
    });
    this.events.push({ t: "enemyShot", x: enemy.x, y: enemy.y });
  }

  /** Mehrere Kugeln im Faecher in Richtung (nx, ny). `spread` ist der halbe Winkel. */
  private fanShot(enemy: Enemy, nx: number, ny: number, count: number, spread: number, speed: number, damage: number): void {
    const base = Math.atan2(ny, nx);
    for (let i = 0; i < count; i += 1) {
      const angle = base + (count > 1 ? (i / (count - 1) - 0.5) * 2 * spread : 0);
      this.enemyShot(enemy, Math.cos(angle), Math.sin(angle), speed, damage);
    }
  }

  /** Ein Zuender explodiert: trifft alle Spieler im Umkreis, laesst nichts fallen. */
  private enemyExplode(enemy: Enemy, radius: number, damage: number): void {
    this.events.push({ t: "boom", x: enemy.x, y: enemy.y, r: radius, enemy: true });
    for (const player of this.state.players) {
      if (player.alive && Math.hypot(player.x - enemy.x, player.y - enemy.y) < radius + PLAYER_RADIUS) {
        this.hurtPlayer(player, damage);
      }
    }
    const index = this.state.enemies.indexOf(enemy);
    if (index >= 0) {
      this.state.enemies.splice(index, 1);
    }
  }

  private radialBurst(enemy: Enemy, count: number, speed: number, damage: number): void {
    const offset = this.rng() * Math.PI * 2;
    for (let i = 0; i < count; i += 1) {
      const angle = offset + (i / count) * Math.PI * 2;
      this.enemyShot(enemy, Math.cos(angle), Math.sin(angle), speed, damage);
    }
  }

  /** Schiebt ueberlappende Gegner auseinander, damit sie sich nicht zu einem Punkt stapeln. */
  private separateEnemies(): void {
    const enemies = this.state.enemies;
    for (let i = 0; i < enemies.length; i += 1) {
      const a = enemies[i];
      if (!a) {
        continue;
      }
      const ra = ENEMIES[a.type].radius;
      for (let j = i + 1; j < enemies.length; j += 1) {
        const b = enemies[j];
        if (!b) {
          continue;
        }
        const rb = ENEMIES[b.type].radius;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (ra + rb) * 0.85;
        if (Math.abs(dx) > min || Math.abs(dy) > min) {
          continue;
        }
        const distance = Math.hypot(dx, dy);
        if (distance >= min) {
          continue;
        }
        const push = (min - distance) * 0.5;
        const ux = distance > 0.001 ? dx / distance : 1;
        const uy = distance > 0.001 ? dy / distance : 0;
        a.x -= ux * push * 0.5;
        a.y -= uy * push * 0.5;
        b.x += ux * push * 0.5;
        b.y += uy * push * 0.5;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Geschosse und Material
  // ---------------------------------------------------------------------------

  private updateProjectiles(): void {
    const state = this.state;
    const remaining: Projectile[] = [];
    for (const shot of state.shots) {
      shot.x += shot.vx * TICK;
      shot.y += shot.vy * TICK;
      shot.life -= TICK;
      if (shot.look === LOOK_GRENADE && shot.life <= 0) {
        continue;
      }
      if (shot.life <= 0 || shot.x < -30 || shot.x > ARENA.width + 30 || shot.y < -30 || shot.y > ARENA.height + 30) {
        continue;
      }

      if (shot.friendly) {
        const owner = state.players.find((player) => player.id === shot.ownerId) ?? null;
        let alive = true;
        for (const enemy of [...state.enemies]) {
          if (shot.hit.includes(enemy.id)) {
            continue;
          }
          const reach = ENEMIES[enemy.type].radius + shot.radius;
          if (Math.hypot(enemy.x - shot.x, enemy.y - shot.y) < reach) {
            shot.hit.push(enemy.id);
            this.shotHits(shot, enemy, owner);
            if (shot.pierce <= 0) {
              alive = false;
              break;
            }
            shot.pierce -= 1;
          }
        }
        if (!alive) {
          continue;
        }
        // Die Granate fliegt bis zum Zielpunkt und explodiert dort.
        if (shot.look === LOOK_GRENADE && shot.life <= TICK * 1.5) {
          this.explode(shot.x, shot.y, GRENADE_RADIUS, shot.damage, shot.crit, owner);
          continue;
        }
      } else {
        let hit = false;
        for (const player of state.players) {
          if (player.alive && Math.hypot(player.x - shot.x, player.y - shot.y) < PLAYER_RADIUS + shot.radius) {
            this.hurtPlayer(player, shot.damage);
            hit = true;
            break;
          }
        }
        if (hit) {
          continue;
        }
      }
      remaining.push(shot);
    }
    state.shots = remaining;
  }

  /** Ein Spielergeschoss trifft: Schaden plus die Besonderheit der Waffe. */
  private shotHits(shot: Projectile, enemy: Enemy, owner: PlayerState | null): void {
    if (shot.look === LOOK_GRENADE) {
      this.explode(shot.x, shot.y, GRENADE_RADIUS, shot.damage, shot.crit, owner);
      shot.life = 0;
      return;
    }
    const def = shot.weapon ? WEAPONS[shot.weapon] : null;
    if (def?.explode) {
      this.explode(shot.x, shot.y, def.explode, shot.damage, shot.crit, owner);
      return;
    }
    this.damageEnemy(enemy, shot.damage, shot.crit, owner, def?.knockback ?? 40, shot.x - shot.vx * 0.05, shot.y - shot.vy * 0.05);
    if (!def) {
      return;
    }
    if (def.burn) {
      enemy.burn = BURN_TIME;
      enemy.burnDps = Math.max(enemy.burnDps * 0.6, shot.damage * def.burn * 3);
    }
    if (def.slow) {
      enemy.slow = Math.max(enemy.slow, def.slow);
    }
    if (def.chain) {
      const tier = owner?.weapons.find((weapon) => weapon.id === shot.weapon)?.tier ?? 1;
      this.chainLightning(enemy, Math.round(shot.damage * 0.7), def.chain + tier - 1, owner, shot.hit);
    }
  }

  /** Der Blitz springt von Gegner zu Gegner, jedes Mal zum naechsten noch nicht getroffenen. */
  private chainLightning(from: Enemy, damage: number, jumps: number, owner: PlayerState | null, hit: number[]): void {
    let current = { x: from.x, y: from.y };
    for (let i = 0; i < jumps; i += 1) {
      let best: Enemy | null = null;
      let bestDistance = CHAIN_REACH;
      for (const enemy of this.state.enemies) {
        if (hit.includes(enemy.id)) {
          continue;
        }
        const distance = Math.hypot(enemy.x - current.x, enemy.y - current.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = enemy;
        }
      }
      if (!best) {
        return;
      }
      hit.push(best.id);
      this.events.push({ t: "zap", x1: current.x, y1: current.y, x2: best.x, y2: best.y });
      current = { x: best.x, y: best.y };
      this.damageEnemy(best, damage, false, owner, 10, current.x, current.y);
    }
  }

  /** Explosion: voller Schaden in der Mitte, alle Gegner im Umkreis werden getroffen. */
  private explode(x: number, y: number, radius: number, damage: number, crit: boolean, owner: PlayerState | null): void {
    this.events.push({ t: "boom", x, y, r: radius, enemy: false });
    for (const enemy of [...this.state.enemies]) {
      const distance = Math.hypot(enemy.x - x, enemy.y - y);
      if (distance < radius + ENEMIES[enemy.type].radius) {
        this.damageEnemy(enemy, Math.max(1, Math.round(damage * (distance < radius * 0.4 ? 1 : 0.6))), crit, owner, 70, x, y);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Faehigkeiten
  // ---------------------------------------------------------------------------

  /** Grundstaerke einer Faehigkeit: waechst mit der Welle und dem Schadenswert. */
  private abilityPower(player: PlayerState): number {
    return (12 + this.state.wave * 3.5) * (1 + player.stats.damage / 100);
  }

  private useAbility(player: PlayerState): void {
    player.abilityCd = abilityCooldown(player.character, player.stats.ability);
    const power = this.abilityPower(player);
    const event = { t: "ability" as const, pid: player.id, kind: player.character, x: player.x, y: player.y, x2: player.x, y2: player.y };
    switch (player.character) {
      case "soeldner": {
        const target = this.nearestEnemy(player.x, player.y, 460);
        const tx = target ? target.x : clamp(player.x + Math.cos(player.facing) * 200, 10, ARENA.width - 10);
        const ty = target ? target.y : clamp(player.y + Math.sin(player.facing) * 200, 10, ARENA.height - 10);
        const distance = Math.max(30, Math.hypot(tx - player.x, ty - player.y));
        const speed = 520;
        this.state.shots.push({
          id: this.nextId++,
          x: player.x,
          y: player.y,
          vx: ((tx - player.x) / distance) * speed,
          vy: ((ty - player.y) / distance) * speed,
          damage: Math.round(power * 1.5),
          pierce: 0,
          life: distance / speed,
          friendly: true,
          ownerId: player.id,
          crit: false,
          radius: 7,
          hit: [],
          weapon: "",
          look: LOOK_GRENADE,
        });
        event.x2 = tx;
        event.y2 = ty;
        break;
      }
      case "raufbold": {
        for (const enemy of [...this.state.enemies]) {
          if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < 135 + ENEMIES[enemy.type].radius) {
            enemy.stun = Math.max(enemy.stun, 1.2);
            this.damageEnemy(enemy, Math.round(power * 1.1), false, player, 230, player.x, player.y);
          }
        }
        break;
      }
      case "jaeger": {
        for (let i = 0; i < 18; i += 1) {
          const angle = (i / 18) * Math.PI * 2;
          this.state.shots.push({
            id: this.nextId++,
            x: player.x,
            y: player.y,
            vx: Math.cos(angle) * 720,
            vy: Math.sin(angle) * 720,
            damage: Math.round(power * 0.75),
            pierce: 3,
            life: 0.75,
            friendly: true,
            ownerId: player.id,
            crit: false,
            radius: 5,
            hit: [],
            weapon: "crossbow",
            look: 1,
          });
        }
        break;
      }
      case "panzer": {
        player.buff = 3;
        player.hp = Math.min(player.stats.maxHp, player.hp + player.stats.maxHp * 0.2);
        for (const enemy of this.state.enemies) {
          const dx = enemy.x - player.x;
          const dy = enemy.y - player.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance < 120) {
            const push = 260 * ENEMIES[enemy.type].knockback;
            enemy.kx += (dx / distance) * push * 6;
            enemy.ky += (dy / distance) * push * 6;
          }
        }
        break;
      }
      case "glueckspilz": {
        player.buff = 5;
        for (const pickup of this.state.pickups) {
          pickup.magnet = true;
        }
        break;
      }
      case "schatten": {
        const angle = this.moveAngle.get(player.id) ?? player.facing;
        const startX = player.x;
        const startY = player.y;
        player.x = clamp(player.x + Math.cos(angle) * 170, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
        player.y = clamp(player.y + Math.sin(angle) * 170, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
        player.buff = 0.6;
        player.iframes = Math.max(player.iframes, 0.6);
        for (const enemy of [...this.state.enemies]) {
          if (distanceToSegment(enemy.x, enemy.y, startX, startY, player.x, player.y) < 26 + ENEMIES[enemy.type].radius) {
            this.damageEnemy(enemy, Math.round(power * 1.4), true, player, 60, startX, startY);
          }
        }
        event.x = startX;
        event.y = startY;
        event.x2 = player.x;
        event.y2 = player.y;
        break;
      }
    }
    this.events.push(event);
  }

  private collect(player: PlayerState, value: number, announce: boolean): void {
    player.gold += value;
    if (grantXp(player, value) > 0) {
      this.events.push({ t: "levelUp", pid: player.id });
    }
    if (announce) {
      this.events.push({ t: "pickup", pid: player.id, x: player.x, y: player.y });
    }
  }

  private updatePickups(): void {
    const state = this.state;
    if (state.pickups.length === 0) {
      return;
    }
    const remaining = state.pickups.filter((pickup) => {
      const player = this.nearestAlivePlayer(pickup.x, pickup.y);
      if (!player) {
        return true;
      }
      const dx = player.x - pickup.x;
      const dy = player.y - pickup.y;
      const distance = Math.hypot(dx, dy);
      if (distance < PICKUP_RADIUS) {
        this.collect(player, pickup.value, true);
        return false;
      }
      if (pickup.magnet || distance < MAGNET_RADIUS) {
        pickup.magnet = true;
        const pull = 420 * TICK;
        pickup.x += (dx / distance) * pull;
        pickup.y += (dy / distance) * pull;
      }
      return true;
    });
    state.pickups = remaining;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Abstand eines Punktes zu einer Strecke - fuer den Schattenschritt. */
function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / length, 0, 1) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function normalizeAngle(angle: number): number {
  let result = angle;
  while (result > Math.PI) {
    result -= Math.PI * 2;
  }
  while (result < -Math.PI) {
    result += Math.PI * 2;
  }
  return result;
}
