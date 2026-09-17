/**
 * Die Nachrichten zwischen Host und Clients.
 *
 * Das Modell ist host-authoritative (Briefing, Abschnitt 6): Ein Geraet rechnet
 * die ganze Simulation, die anderen schicken nur ihre Eingaben und stellen dar,
 * was zurueckkommt. Im Koop ist das unproblematisch - alle spielen gegen die KI,
 * niemand hat vom Schummeln etwas.
 *
 * Datenmenge: Alle Zahlen werden vor dem Versand auf eine Nachkommastelle
 * gerundet (`round1`). Bei 20 Gegnern und 15 Paketen pro Sekunde macht das den
 * Unterschied zwischen ein paar KB/s und einem Vielfachen davon.
 */

import type {
  CharacterId,
  GameEvent,
  PlayerState,
  RoundPhase,
  Vec2,
  WorldState,
} from "../systems/types";

/** Eingaben gehen 30x pro Sekunde zum Host. */
export const INPUT_RATE = 30;

/** Weltzustaende gehen 15x pro Sekunde an alle Clients. */
export const STATE_RATE = 15;

/**
 * Wie weit der Client die Darstellung hinter dem Host zurueckhaelt.
 * Er zeichnet absichtlich die Vergangenheit: Nur so liegen immer zwei bekannte
 * Zustaende vor, zwischen denen weich ueberblendet werden kann.
 */
export const INTERPOLATION_DELAY_MS = 100;

export interface NetPlayerInfo {
  id: string;
  name: string;
  character: CharacterId;
  isHost: boolean;
}

export interface InputMessage {
  t: "input";
  /** Fortlaufende Nummer - der Host verwirft veraltete Pakete. */
  seq: number;
  move: Vec2;
  aim: Vec2 | null;
  fire: boolean;
  super: boolean;
}

export interface NetPlayer {
  id: string;
  x: number;
  y: number;
  fx: number;
  fy: number;
  hp: number;
  maxHp: number;
  ammo: number;
  superCharge: number;
  down: boolean;
  revive: number;
  inv: number;
  character: CharacterId;
  name: string;
}

export interface NetEnemy {
  id: number;
  /** Index in ENEMY_TYPE_ORDER - eine Zahl ist kuerzer als ein Wort. */
  type: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  boss: boolean;
  marked: boolean;
  stunned: boolean;
}

export interface NetProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  enemy: boolean;
}

export interface StateMessage {
  t: "state";
  tick: number;
  players: NetPlayer[];
  enemies: NetEnemy[];
  projectiles: NetProjectile[];
  wave: number;
  score: number;
  phase: RoundPhase;
  phaseTime: number;
  /** Noch nicht erschienene Gegner - damit das HUD bei allen dasselbe zeigt. */
  pending: number;
}

/** Ereignisse, die nicht in jeden Zustand gehoeren: Treffer, Tod, Wellenstart. */
export interface EventMessage {
  t: "events";
  events: GameEvent[];
}

export interface HelloMessage {
  t: "hello";
  name: string;
  character: CharacterId;
}

export interface LobbyMessage {
  t: "lobby";
  players: NetPlayerInfo[];
}

export interface StartMessage {
  t: "start";
  seed: number;
  players: NetPlayerInfo[];
}

/** Bestaetigung des Clients, damit der Host aufhoert, `start` zu wiederholen. */
export interface ReadyMessage {
  t: "ready";
}

export interface ByeMessage {
  t: "bye";
  reason: string;
}

export type NetMessage =
  | InputMessage
  | StateMessage
  | EventMessage
  | HelloMessage
  | LobbyMessage
  | StartMessage
  | ReadyMessage
  | ByeMessage;

export const ENEMY_TYPE_ORDER = ["runner", "brute", "shooter"] as const;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Packt den Weltzustand in die schlanke Fassung fuer das Netz. */
export function encodeState(state: WorldState): StateMessage {
  return {
    t: "state",
    tick: state.tick,
    wave: state.wave,
    score: state.score,
    phase: state.phase,
    phaseTime: round1(state.phaseTime),
    pending: state.pendingSpawns.length,
    players: state.players.map(encodePlayer),
    enemies: state.enemies.map((enemy) => ({
      id: enemy.id,
      type: ENEMY_TYPE_ORDER.indexOf(enemy.type),
      x: round1(enemy.position.x),
      y: round1(enemy.position.y),
      vx: round1(enemy.velocity.x),
      vy: round1(enemy.velocity.y),
      hp: Math.round(enemy.health),
      maxHp: Math.round(enemy.maxHealth),
      radius: round1(enemy.radius),
      boss: enemy.isBoss,
      marked: enemy.marked > 0,
      stunned: enemy.stunned > 0,
    })),
    projectiles: state.projectiles
      .filter((projectile) => projectile.active)
      .map((projectile) => ({
        id: projectile.id,
        x: round1(projectile.position.x),
        y: round1(projectile.position.y),
        vx: round1(projectile.velocity.x),
        vy: round1(projectile.velocity.y),
        radius: round1(projectile.radius),
        enemy: projectile.owner === "enemy",
      })),
  };
}

function encodePlayer(player: PlayerState): NetPlayer {
  return {
    id: player.id,
    name: player.name,
    character: player.character,
    x: round1(player.position.x),
    y: round1(player.position.y),
    fx: round1(player.facing.x),
    fy: round1(player.facing.y),
    hp: Math.round(player.health),
    maxHp: Math.round(player.maxHealth),
    ammo: player.reloadTimers.reduce((count, timer) => count + (timer <= 0 ? 1 : 0), 0),
    superCharge: Math.round(player.superCharge),
    down: player.down,
    revive: round1(player.reviveProgress),
    inv: round1(player.invulnerable),
  };
}
