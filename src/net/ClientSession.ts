/**
 * Client: schickt Eingaben und Befehle, zeigt, was der Host meldet.
 *
 * Zwei Kniffe, damit es sich nicht nach Netz anfuehlt:
 *
 * 1. GLAETTEN: Der Host schickt 12 Zustaende pro Sekunde. Sie direkt zu zeigen
 *    ruckelt. Die Szene sieht deshalb immer eine Mischung aus den beiden
 *    letzten Zustaenden - Festung, Gegner, Mitspieler, Geschosse gleiten von
 *    einem zum naechsten. Dafuer ist das Bild eine Paketlaenge (~80 ms) hinterher.
 *
 * 2. VORAUSRECHNEN: Die eigene Figur darf nicht hinterherhinken - sonst fuehlt
 *    sich der Stick zaeh an. Sie bewegt sich sofort mit der Eingabe und wird
 *    nur sanft zur Position des Hosts gezogen. Auf dem Deck geschieht das
 *    relativ zur Festung, damit die Figur auf dem laufenden Deck stehen bleibt.
 */

import { AHEAD, BEHIND, DECK_W, GROUND_BOTTOM, GROUND_TOP } from "../game/constants";
import { DECK_WALK } from "../game/fortress";
import { statsOf } from "../game/systems/players";
import type { Command, GameEvent, GameState, PlayerInput, PlayerState } from "../game/types";
import type { GameSession } from "./GameSession";
import {
  INPUT_RATE,
  STATE_RATE,
  decodeState,
  type NetMessage,
  type NumberedCommand,
} from "./protocol";
import type { Transport } from "./Transport";

const INPUT_INTERVAL_MS = 1000 / INPUT_RATE;
const STATE_INTERVAL_MS = 1000 / STATE_RATE;
/** So lange darf der Host schweigen, bevor die Verbindung als verloren gilt. */
const SILENCE_LIMIT_MS = 6000;

interface Snapshot {
  state: GameState;
  /** Wann er ankam (Uhr dieser Sitzung). */
  at: number;
}

export class ClientSession implements GameSession {
  readonly canPause = false;
  readonly isHost = false;
  readonly isMultiplayer = true;
  connectionLost: string | null = null;
  /** Wird wahr, sobald der erste Zustand des Hosts da ist. */
  isReady = false;

  private previous: Snapshot | null = null;
  private latest: Snapshot;
  private view: GameState;
  private clock = 0;
  private eventsNow: GameEvent[] = [];
  private pendingEvents: GameEvent[] = [];
  private seq = 0;
  private cmdId = 0;
  private pendingCommands: NumberedCommand[] = [];
  private sinceInput = INPUT_INTERVAL_MS;
  private sinceState = 0;
  private lastInput: PlayerInput = { mx: 0, my: 0 };
  /** Vorausgerechnete eigene Lage: auf dem Deck relativ zur Festung, am Boden in der Welt. */
  private predicted: { layer: PlayerState["layer"]; x: number; y: number } | null = null;

  constructor(
    private readonly transport: Transport,
    readonly selfId: string,
    initial: GameState,
  ) {
    this.latest = { state: initial, at: 0 };
    this.view = initial;
    transport.onMessage((_from, message) => this.receive(message));
    transport.onPeerLeave(() => {
      this.connectionLost ??= "Die Verbindung zum Host ist abgerissen.";
    });
    transport.onError((message) => {
      this.connectionLost ??= message;
    });
  }

  get state(): GameState {
    return this.view;
  }

  get events(): readonly GameEvent[] {
    return this.eventsNow;
  }

  update(deltaMs: number, input: PlayerInput): void {
    this.clock += deltaMs;
    this.eventsNow = this.pendingEvents;
    this.pendingEvents = [];
    this.lastInput = input;

    this.sinceState += deltaMs;
    if (this.sinceState > SILENCE_LIMIT_MS) {
      this.connectionLost ??= "Keine Daten mehr vom Host.";
    }
    this.view = this.blend();
    this.predict(deltaMs, input);

    this.sinceInput += deltaMs;
    if (this.sinceInput >= INPUT_INTERVAL_MS) {
      this.sinceInput = 0;
      this.sendInput();
    }
  }

  send(command: Command): void {
    this.cmdId += 1;
    this.pendingCommands.push({ id: this.cmdId, c: command });
    // Nicht erst auf das naechste Paket warten - ein Tipp soll sofort losgehen.
    this.sendInput();
  }

  destroy(): void {
    this.transport.close();
  }

  private sendInput(): void {
    this.seq += 1;
    this.transport.broadcast({
      t: "input",
      seq: this.seq,
      mx: Math.round(this.lastInput.mx * 100) / 100,
      my: Math.round(this.lastInput.my * 100) / 100,
      ab: this.lastInput.ability ?? 0,
      cmds: this.pendingCommands,
    });
  }

  private receive(message: NetMessage): void {
    switch (message.t) {
      case "state": {
        const state = decodeState(message.s, this.latest.state.map);
        // Gleiche oder aeltere Staende ueberspringen - der Kanal darf umsortieren.
        if (this.isReady && state.time <= this.latest.state.time) {
          return;
        }
        this.previous = this.isReady ? this.latest : null;
        this.latest = { state, at: this.clock };
        this.isReady = true;
        this.sinceState = 0;
        const me = state.players.find((p) => p.id === this.selfId);
        if (me) {
          // Bestaetigte Befehle muessen nicht mehr mitgeschickt werden.
          this.pendingCommands = this.pendingCommands.filter((cmd) => cmd.id > me.lastCmd);
          this.reconcile(me, state);
        }
        break;
      }
      case "events":
        this.pendingEvents.push(...message.e);
        break;
      case "bye":
        this.connectionLost ??= message.reason;
        break;
      default:
        break;
    }
  }

  /** Zwischen den zwei letzten Zustaenden mischen (eine Paketlaenge hinterher). */
  private blend(): GameState {
    const next = this.latest.state;
    const prev = this.previous?.state;
    if (!prev) {
      // Eigene Kopie der Spielerliste: Das Vorausrechnen ersetzt darin die eigene Figur.
      return { ...next, players: [...next.players] };
    }
    const span = Math.max(1, this.latest.at - (this.previous?.at ?? 0));
    const u = Math.min(1, (this.clock - this.latest.at) / Math.max(span, STATE_INTERVAL_MS));
    const lerp = (a: number, b: number): number => a + (b - a) * u;
    const byId = <T extends { id: number | string }>(list: readonly T[]): Map<number | string, T> =>
      new Map(list.map((item) => [item.id, item]));

    const prevEnemies = byId(prev.enemies);
    const prevPlayers = byId(prev.players);
    const prevShots = byId(prev.shots);
    const prevScrap = byId(prev.scrap);
    return {
      ...next,
      time: lerp(prev.time, next.time),
      fort: {
        ...next.fort,
        x: lerp(prev.fort.x, next.fort.x),
        gait: lerp(prev.fort.gait, next.fort.gait),
      },
      march: { ...next.march, done: lerp(prev.march.done, next.march.done) },
      enemies: next.enemies.map((e) => {
        const old = prevEnemies.get(e.id);
        return old ? { ...e, x: lerp(old.x, e.x), y: lerp(old.y, e.y), z: lerp(old.z, e.z) } : e;
      }),
      players: next.players.map((p) => {
        const old = prevPlayers.get(p.id);
        return old ? { ...p, x: lerp(old.x, p.x), y: lerp(old.y, p.y), z: lerp(old.z, p.z) } : p;
      }),
      shots: next.shots.map((s) => {
        const old = prevShots.get(s.id);
        return old ? { ...s, x: lerp(old.x, s.x), y: lerp(old.y, s.y), z: lerp(old.z, s.z) } : s;
      }),
      scrap: next.scrap.map((s) => {
        const old = prevScrap.get(s.id);
        return old ? { ...s, x: lerp(old.x, s.x), y: lerp(old.y, s.y), z: lerp(old.z, s.z) } : s;
      }),
    };
  }

  /** Eigene Figur sofort bewegen und in die Ansicht setzen. */
  private predict(deltaMs: number, input: PlayerInput): void {
    const index = this.view.players.findIndex((p) => p.id === this.selfId);
    const me = this.view.players[index];
    const host = this.latest.state.players.find((p) => p.id === this.selfId);
    if (!me || !host || !this.predicted) {
      return;
    }
    // Waehrend Spruengen, Klettern und Seilwinde zeigt der Host, wo es langgeht.
    if (!host.alive || host.transition || host.dash || this.predicted.layer !== host.layer) {
      return;
    }
    let { mx, my } = input;
    const length = Math.hypot(mx, my);
    if (length > 1) {
      mx /= length;
      my /= length;
    }
    const step = statsOf(host).speed * (deltaMs / 1000);
    const p = this.predicted;
    if (length > 0.05) {
      p.x += mx * step;
      p.y += my * step;
    }
    const f = this.view.fort;
    if (p.layer === "deck") {
      p.x = clamp(p.x, DECK_WALK.x0, DECK_WALK.x1);
      p.y = clamp(p.y, DECK_WALK.y0, DECK_WALK.y1);
      this.view.players[index] = { ...me, x: f.x + p.x, y: f.y + p.y, moving: length > 0.05 };
    } else {
      p.x = clamp(p.x, f.x - BEHIND, f.x + DECK_W + AHEAD);
      p.y = clamp(p.y, GROUND_TOP, GROUND_BOTTOM);
      this.view.players[index] = { ...me, x: p.x, y: p.y, moving: length > 0.05 };
    }
    if (Math.abs(mx) > 0.1) {
      this.view.players[index]!.facing = mx > 0 ? 1 : -1;
    }
  }

  /** Vorausgerechnete Lage sanft zur Lage des Hosts ziehen. */
  private reconcile(me: PlayerState, state: GameState): void {
    const f = state.fort;
    const x = me.layer === "deck" ? me.x - f.x : me.x;
    const y = me.layer === "deck" ? me.y - f.y : me.y;
    const p = this.predicted;
    if (
      !p ||
      p.layer !== me.layer ||
      me.transition ||
      !me.alive ||
      Math.hypot(x - p.x, y - p.y) > 60
    ) {
      this.predicted = { layer: me.layer, x, y };
      return;
    }
    p.x += (x - p.x) * 0.25;
    p.y += (y - p.y) * 0.25;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
