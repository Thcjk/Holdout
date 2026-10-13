/**
 * Die Nachrichten zwischen Host und Clients.
 *
 * Das Modell ist "Host rechnet, alle anderen schauen zu und schicken Eingaben":
 * Nur ein Geraet fuehrt die Simulation aus (`HostSession`), die anderen
 * schicken ihre Bewegung und ihre Shop-Befehle und zeichnen, was zurueckkommt
 * (`ClientSession`). Im Koop spielen alle gegen die KI - Schummeln bringt
 * niemandem etwas, also braucht es keine Pruefung auf dem Host.
 *
 * DER DATENKANAL IST ABSICHTLICH UNZUVERLAESSIG (siehe `PeerTransport`,
 * `reliable: false`): Die neueste Spielposition ist wichtiger als die
 * vollstaendige Reihenfolge. Pakete koennen also fehlen oder doppelt kommen.
 * Deshalb gilt:
 *   - Der Weltzustand wird 15x pro Sekunde KOMPLETT gesendet (kein "Aenderungen
 *     seit eben") - ein verlorenes Paket heilt sich beim naechsten.
 *   - Shop-Befehle tragen eine Nummer und werden wiederholt, bis der Host sie
 *     im Zustand bestaetigt (`lastCmd`). Er fuehrt jeden nur einmal aus.
 *
 * Datenmenge: Zahlen werden gerundet, Gegner und Geschosse als kurze Reihen
 * statt als Objekte verschickt.
 */

import { computeStats } from "../game/data/stats";
import type {
  CharacterId,
  Command,
  Enemy,
  EnemyType,
  GameEvent,
  GameState,
  Offer,
  Phase,
  PlayerSetup,
  PlayerState,
  Projectile,
  StatMods,
  WeaponId,
} from "../game/types";

/** Eingaben (Bewegung und Befehle) gehen 30x pro Sekunde zum Host. */
export const INPUT_RATE = 30;

/** Weltzustaende gehen 15x pro Sekunde an alle Clients. */
export const STATE_RATE = 15;

export interface NetPlayerInfo {
  id: string;
  name: string;
  character: CharacterId;
  startWeapon: WeaponId;
  isHost: boolean;
  /** Schmiede-Boni und Startgold dieses Spielers. */
  bonus?: StatMods;
  startGold?: number;
}

/** Ein Befehl mit Nummer, damit der Host ihn nicht doppelt ausfuehrt. */
export interface NumberedCommand {
  id: number;
  c: Command;
}

/** `status`: Bits 1 Brand, 2 Frost, 4 Betaeubt, 8 holt aus (Ansturm/Zuender). */
export type WireEnemy = [id: number, type: number, x: number, y: number, hp: number, maxHp: number, flash: number, status: number];
export type WireShot = [id: number, x: number, y: number, vx: number, vy: number, friendly: number, radius: number, crit: number, look: number];
export type WirePickup = [id: number, x: number, y: number, value: number];
export type WireMarker = [x: number, y: number, t: number, type: number];

export interface WirePlayer {
  id: string;
  n: string;
  ch: CharacterId;
  x: number;
  y: number;
  hp: number;
  al: number;
  fc: number;
  w: [WeaponId, number][];
  it: number[];
  up: number[];
  g: number;
  xp: number;
  lv: number;
  pl: number;
  o: (Offer | null)[];
  lk: boolean[];
  rr: number;
  uc: string[] | null;
  rd: number;
  lc: number;
  k: number;
  /** Abklingzeit der Faehigkeit und Restzeit ihrer Wirkung. */
  ac: number;
  bf: number;
  /** Schmiede-Boni (der Client rechnet damit die Werte aus) und gesammeltes Gold. */
  bn?: StatMods;
  ge?: number;
}

export interface WireState {
  ph: Phase;
  w: number;
  tl: number;
  wl: number;
  tk: number;
  p: WirePlayer[];
  e: WireEnemy[];
  s: WireShot[];
  pu: WirePickup[];
  m: WireMarker[];
}

export type NetMessage =
  | { t: "hello"; name: string; character: CharacterId; weapon: WeaponId; bonus?: StatMods; gold?: number }
  | { t: "lobby"; players: NetPlayerInfo[] }
  | { t: "start"; seed: number; players: NetPlayerInfo[] }
  | { t: "ready" }
  | { t: "input"; seq: number; mx: number; my: number; ab: number; cmds: NumberedCommand[] }
  | { t: "state"; s: WireState }
  | { t: "events"; e: GameEvent[] }
  | { t: "bye"; reason: string };

/** Reihenfolge ist Protokoll: neue Gegner nur hinten anhaengen. */
const ENEMY_TYPES: readonly EnemyType[] = ["grunt", "swarmer", "charger", "spitter", "bruiser", "elite", "boss", "exploder", "splitter"];

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round0(value: number): number {
  return Math.round(value);
}

function encodePlayer(player: PlayerState): WirePlayer {
  return {
    id: player.id,
    n: player.name,
    ch: player.character,
    x: round1(player.x),
    y: round1(player.y),
    hp: round1(player.hp),
    al: player.alive ? 1 : 0,
    fc: Math.round(player.facing * 100) / 100,
    w: player.weapons.map((weapon) => [weapon.id, weapon.tier]),
    it: player.items,
    up: player.upgrades,
    g: player.gold,
    xp: player.xp,
    lv: player.level,
    pl: player.pendingLevels,
    o: player.shop.offers,
    lk: player.shop.locked,
    rr: player.shop.rerolls,
    uc: player.shop.upgradeChoices,
    rd: player.ready ? 1 : 0,
    lc: player.lastCmd,
    k: player.kills,
    ac: round1(player.abilityCd),
    bf: round1(player.buff),
    bn: player.bonus,
    ge: player.earned,
  };
}

export function encodeState(state: GameState): WireState {
  return {
    ph: state.phase,
    w: state.wave,
    tl: round1(state.timeLeft),
    wl: state.waveLength,
    tk: state.tick,
    p: state.players.map(encodePlayer),
    e: state.enemies.map((enemy) => [
      enemy.id,
      ENEMY_TYPES.indexOf(enemy.type),
      round0(enemy.x),
      round0(enemy.y),
      round0(enemy.hp),
      enemy.maxHp,
      enemy.flash > 0 ? 1 : 0,
      (enemy.burn > 0 ? 1 : 0) | (enemy.slow > 0 ? 2 : 0) | (enemy.stun > 0 ? 4 : 0) | (enemy.mode === "windup" ? 8 : 0),
    ]),
    s: state.shots.map((shot) => [
      shot.id,
      round0(shot.x),
      round0(shot.y),
      round0(shot.vx),
      round0(shot.vy),
      shot.friendly ? 1 : 0,
      shot.radius,
      shot.crit ? 1 : 0,
      shot.look,
    ]),
    pu: state.pickups.map((pickup) => [pickup.id, round0(pickup.x), round0(pickup.y), pickup.value]),
    m: state.markers.map((marker) => [round0(marker.x), round0(marker.y), round1(marker.t), ENEMY_TYPES.indexOf(marker.type)]),
  };
}

function decodePlayer(wire: WirePlayer): PlayerState {
  const player: PlayerState = {
    id: wire.id,
    name: wire.n,
    character: wire.ch,
    x: wire.x,
    y: wire.y,
    hp: wire.hp,
    alive: wire.al === 1,
    iframes: 0,
    facing: wire.fc,
    weapons: wire.w.map(([id, tier]) => ({ id, tier, cd: 0 })),
    items: wire.it,
    upgrades: wire.up,
    gold: wire.g,
    xp: wire.xp,
    level: wire.lv,
    pendingLevels: wire.pl,
    shop: { offers: wire.o, locked: wire.lk, rerolls: wire.rr, upgradeChoices: wire.uc },
    ready: wire.rd === 1,
    lastCmd: wire.lc,
    kills: wire.k,
    stats: computeStats(wire.ch, wire.it, wire.up, wire.bn ?? {}),
    regenCarry: 0,
    abilityCd: wire.ac ?? 0,
    buff: wire.bf ?? 0,
    abilityAck: 0,
    bonus: wire.bn ?? {},
    earned: wire.ge ?? 0,
  };
  return player;
}

function decodeEnemy(wire: WireEnemy): Enemy {
  return {
    id: wire[0],
    type: ENEMY_TYPES[wire[1]] ?? "grunt",
    x: wire[2],
    y: wire[3],
    hp: wire[4],
    maxHp: wire[5],
    mode: ((wire[7] ?? 0) & 8) !== 0 ? "windup" : "move",
    timer: 0,
    timer2: 0,
    dirX: 0,
    dirY: 0,
    kx: 0,
    ky: 0,
    flash: wire[6] === 1 ? 0.1 : 0,
    burn: ((wire[7] ?? 0) & 1) !== 0 ? 1 : 0,
    burnDps: 0,
    slow: ((wire[7] ?? 0) & 2) !== 0 ? 1 : 0,
    stun: ((wire[7] ?? 0) & 4) !== 0 ? 1 : 0,
  };
}

function decodeShot(wire: WireShot): Projectile {
  return {
    id: wire[0],
    x: wire[1],
    y: wire[2],
    vx: wire[3],
    vy: wire[4],
    damage: 0,
    pierce: 0,
    life: 1,
    friendly: wire[5] === 1,
    ownerId: "",
    crit: wire[7] === 1,
    radius: wire[6],
    hit: [],
    weapon: "",
    look: wire[8] ?? 0,
  };
}

export function decodeState(wire: WireState): GameState {
  return {
    phase: wire.ph,
    wave: wire.w,
    timeLeft: wire.tl,
    waveLength: wire.wl,
    tick: wire.tk,
    players: wire.p.map(decodePlayer),
    enemies: wire.e.map(decodeEnemy),
    shots: wire.s.map(decodeShot),
    pickups: wire.pu.map((pickup) => ({ id: pickup[0], x: pickup[1], y: pickup[2], value: pickup[3], magnet: false })),
    markers: wire.m.map((marker) => ({ x: marker[0], y: marker[1], t: marker[2], type: ENEMY_TYPES[marker[3]] ?? "grunt" })),
  };
}

/** Die Lobby-Liste als Startaufstellung der Simulation. */
export function toSetups(players: readonly NetPlayerInfo[]): PlayerSetup[] {
  return players.map((player) => ({
    id: player.id,
    name: player.name,
    character: player.character,
    startWeapon: player.startWeapon,
    bonus: player.bonus ?? {},
    startGold: player.startGold ?? 0,
  }));
}
