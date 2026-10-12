/**
 * Client: schickt seine Bewegung und seine Shop-Befehle, zeichnet, was der Host meldet.
 *
 * Eigene Bewegung wird VORAUSGERECHNET: Wer erst die Figur zeichnet, wenn der
 * Host die neue Position zurueckschickt, spuert jede Verzoegerung des Netzes
 * als zaehen Joystick. Der Client bewegt seine Figur deshalb sofort selbst und
 * zieht sie nur sanft zur Position des Hosts, falls beide auseinanderlaufen.
 */

import { ARENA, PLAYER_RADIUS, PLAYER_SPEED } from "../game/constants";
import type { Command, GameEvent, GameState, PlayerInput } from "../game/types";
import type { GameSession, GameView } from "./GameSession";
import { INPUT_RATE, decodeState } from "./protocol";
import type { NetMessage, NumberedCommand } from "./protocol";
import type { Transport } from "./Transport";

const INPUT_INTERVAL_MS = 1000 / INPUT_RATE;
/** So lange darf der Host schweigen, bevor die Verbindung als verloren gilt. */
const SILENCE_LIMIT_MS = 6000;

export class ClientSession implements GameSession {
  readonly canPause = false;
  readonly isMultiplayer = true;
  connectionLost: string | null = null;
  /** Wird wahr, sobald der erste Zustand des Hosts da ist. */
  isReady = false;

  private state: GameState;
  private events: GameEvent[] = [];
  private pendingEvents: GameEvent[] = [];
  private seq = 0;
  private cmdId = 0;
  private pendingCommands: NumberedCommand[] = [];
  private sinceInput = INPUT_INTERVAL_MS;
  private sinceState = 0;
  private lastInput: PlayerInput = { mx: 0, my: 0 };
  private predicted: { x: number; y: number } | null = null;

  constructor(
    private readonly transport: Transport,
    readonly selfId: string,
    initial: GameState,
  ) {
    this.state = initial;
    transport.onMessage((_from, message) => this.receive(message));
    transport.onPeerLeave(() => {
      this.connectionLost ??= "Die Verbindung zum Host ist abgerissen.";
    });
    transport.onError((message) => {
      this.connectionLost ??= message;
    });
  }

  get view(): GameView {
    return { state: this.state, events: this.events };
  }

  update(deltaMs: number, input: PlayerInput): void {
    this.events = this.pendingEvents;
    this.pendingEvents = [];
    this.lastInput = input;

    this.sinceState += deltaMs;
    if (this.sinceState > SILENCE_LIMIT_MS) {
      this.connectionLost ??= "Keine Daten mehr vom Host.";
    }

    this.advancePrediction(deltaMs, input);

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

  selfPosition(): { x: number; y: number } | null {
    return this.predicted;
  }

  destroy(): void {
    this.transport.close();
  }

  private sendInput(): void {
    this.seq += 1;
    this.transport.broadcast({
      t: "input",
      seq: this.seq,
      mx: round2(this.lastInput.mx),
      my: round2(this.lastInput.my),
      cmds: this.pendingCommands,
    });
  }

  private receive(message: NetMessage): void {
    switch (message.t) {
      case "state": {
        // Gleiche oder aeltere Staende ueberspringen - der Kanal darf umsortieren.
        if (message.s.tk <= this.state.tick && this.state.tick > 0) {
          return;
        }
        this.state = decodeState(message.s);
        this.isReady = true;
        this.sinceState = 0;

        const me = this.state.players.find((player) => player.id === this.selfId);
        if (me) {
          // Bestaetigte Befehle muessen nicht mehr mitgeschickt werden.
          this.pendingCommands = this.pendingCommands.filter((cmd) => cmd.id > me.lastCmd);
          this.reconcile(me.x, me.y, me.alive && this.state.phase === "wave");
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

  /** Eigene Figur sofort bewegen, genau wie die Simulation es taete. */
  private advancePrediction(deltaMs: number, input: PlayerInput): void {
    const me = this.state.players.find((player) => player.id === this.selfId);
    if (!me || !this.predicted) {
      return;
    }
    if (!me.alive || this.state.phase !== "wave") {
      this.predicted = { x: me.x, y: me.y };
      return;
    }
    let { mx, my } = input;
    const length = Math.hypot(mx, my);
    if (length > 1) {
      mx /= length;
      my /= length;
    }
    if (length > 0.05) {
      const speed = PLAYER_SPEED * (1 + me.stats.speed / 100);
      this.predicted.x = clamp(this.predicted.x + mx * speed * (deltaMs / 1000), PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      this.predicted.y = clamp(this.predicted.y + my * speed * (deltaMs / 1000), PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    }
  }

  /** Zieht die vorausgerechnete Position zur Position des Hosts. */
  private reconcile(serverX: number, serverY: number, moving: boolean): void {
    if (!this.predicted || !moving) {
      this.predicted = { x: serverX, y: serverY };
      return;
    }
    const dx = serverX - this.predicted.x;
    const dy = serverY - this.predicted.y;
    // Grosse Abweichung (Welle begann, Zeitsprung): sofort uebernehmen.
    if (Math.hypot(dx, dy) > 120) {
      this.predicted = { x: serverX, y: serverY };
      return;
    }
    this.predicted.x += dx * 0.2;
    this.predicted.y += dy * 0.2;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
