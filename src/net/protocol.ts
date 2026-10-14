/**
 * Die Nachrichten zwischen Host und Clients im Koop.
 *
 * Das Modell: "Der Host rechnet, alle anderen schicken Eingaben und schauen zu."
 * Nur ein Geraet fuehrt die Simulation aus (`HostSession`), die anderen schicken
 * ihre Bewegung, ihre Faehigkeit und ihre Befehle (bauen, Teile kaufen ...) und
 * zeichnen, was zurueckkommt (`ClientSession`). Alle spielen gemeinsam gegen
 * die Armee - Schummeln bringt niemandem etwas, also prueft der Host nichts nach.
 *
 * DER DATENKANAL IST ABSICHTLICH UNZUVERLAESSIG (`PeerTransport`,
 * `reliable: false`): Die neueste Lage ist wichtiger als jede einzelne Nachricht.
 * Pakete koennen fehlen, doppelt oder in falscher Reihenfolge kommen. Deshalb:
 *   - Der Zustand geht 12x pro Sekunde KOMPLETT raus. Ein verlorenes Paket
 *     heilt sich mit dem naechsten.
 *   - Befehle tragen eine Nummer und werden wiederholt, bis der Host sie im
 *     Zustand bestaetigt (`PlayerState.lastCmd`). Er fuehrt jeden nur einmal aus.
 *   - Die Karte aendert sich selten und ist gross: Sie geht nur einmal pro
 *     Sekunde mit.
 *
 * Datenmenge: Zahlen werden auf eine Nachkommastelle gerundet, Gegner und
 * Geschosse als kurze Reihen statt als Objekte verschickt.
 */

import type { SimulationOptions } from "../game/Simulation";
import type {
  ActMap,
  Command,
  CrewId,
  EnemyLayer,
  EnemyMode,
  EnemyState,
  EnemyType,
  GameEvent,
  GameState,
  ShotState,
} from "../game/types";

/** Eingaben gehen 30x pro Sekunde zum Host. */
export const INPUT_RATE = 30;
/** Zustaende gehen 12x pro Sekunde an alle Clients. */
export const STATE_RATE = 12;
/** Hoechstens so viele Mechs pro Festung. */
export const MAX_PLAYERS = 4;

export interface NetPlayerInfo {
  id: string;
  name: string;
  crew: CrewId;
  isHost: boolean;
}

/** Ein Befehl mit Nummer, damit der Host ihn nicht doppelt ausfuehrt. */
export interface NumberedCommand {
  id: number;
  c: Command;
}

/** Was der Host fuer den Lauf vorgibt (aus seinem Profil: Hitze, Werft). */
export type RunOptions = Omit<SimulationOptions, "route">;

// --- Kompakte Reihen ---------------------------------------------------------------------------

const TYPES: readonly EnemyType[] = [
  "laeufer",
  "enterer",
  "phalanx",
  "skarabaeus",
  "priester",
  "streitwagen",
  "ballista",
  "turm",
  "koloss",
  "barke",
  "glaskoloss",
];
const LAYERS: readonly EnemyLayer[] = ["ground", "climb", "deck", "air"];
const MODES: readonly EnemyMode[] = [
  "approach",
  "climb",
  "deck",
  "fly",
  "charge",
  "retreat",
  "standoff",
  "dock",
  "walk",
  "slam",
];
const LOOKS: readonly ShotState["look"][] = ["rivet", "bolt", "harpoon"];

export type WireEnemy = [
  id: number,
  type: number,
  x: number,
  y: number,
  z: number,
  layer: number,
  mode: number,
  hp: number,
  hpMax: number,
  facing: number,
  attacking: number,
  shield: number,
  slotX: number,
  tx: number,
  ty: number,
  timer: number,
  attackCd: number,
];

export type WireShot = [
  id: number,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  look: number,
];

/** Der Zustand ohne Karte und mit kurzen Reihen fuer Gegner und Geschosse. */
export type WireState = Omit<GameState, "enemies" | "shots" | "map"> & {
  e: WireEnemy[];
  sh: WireShot[];
  /** Nur ab und zu dabei (siehe oben). */
  map?: ActMap;
  act: number;
};

export type NetMessage =
  | { t: "hello"; name: string; crew: CrewId }
  | { t: "lobby"; players: NetPlayerInfo[] }
  | { t: "start"; seed: number; players: NetPlayerInfo[]; options: RunOptions }
  | { t: "ready" }
  | { t: "input"; seq: number; mx: number; my: number; ab: number; cmds: NumberedCommand[] }
  | { t: "state"; s: WireState }
  | { t: "events"; e: GameEvent[] }
  | { t: "bye"; reason: string };

/** Zahl auf eine Nachkommastelle - fuer die Anzeige reicht das. */
function r1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Alle Zahlen eines Objekts (tief) runden. */
function roundDeep<T>(value: T): T {
  if (typeof value === "number") {
    return (Number.isInteger(value) ? value : r1(value)) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => roundDeep(v)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = roundDeep(v);
    }
    return out as T;
  }
  return value;
}

export function encodeState(state: GameState, withMap: boolean): WireState {
  const { enemies, shots, map, ...rest } = state;
  const wire: WireState = {
    ...roundDeep(rest),
    // Zeit und Gang genau lassen - davon haengen Animationen ab.
    time: state.time,
    fort: { ...roundDeep(state.fort), x: state.fort.x, gait: state.fort.gait },
    e: enemies.map((e) => [
      e.id,
      TYPES.indexOf(e.type),
      r1(e.x),
      r1(e.y),
      r1(e.z),
      LAYERS.indexOf(e.layer),
      MODES.indexOf(e.mode),
      Math.ceil(e.hp),
      e.hpMax,
      e.facing,
      e.attacking ? 1 : 0,
      Math.ceil(e.shield),
      r1(e.slotX),
      r1(e.tx),
      r1(e.ty),
      r1(e.timer),
      r1(e.attackCd),
    ]),
    sh: shots.map((s) => [
      s.id,
      r1(s.x),
      r1(s.y),
      r1(s.z),
      Math.round(s.vx),
      Math.round(s.vy),
      Math.round(s.vz),
      LOOKS.indexOf(s.look),
    ]),
    act: map.act,
  };
  if (withMap) {
    wire.map = map;
  }
  return wire;
}

/** Zurueck in einen vollstaendigen Zustand. Ohne Karte im Paket bleibt die alte. */
export function decodeState(wire: WireState, previousMap: ActMap): GameState {
  const { e, sh, map, act: _act, ...rest } = wire;
  const enemies: EnemyState[] = e.map((w) => ({
    id: w[0],
    type: TYPES[w[1]] ?? "laeufer",
    x: w[2],
    y: w[3],
    z: w[4],
    layer: LAYERS[w[5]] ?? "ground",
    mode: MODES[w[6]] ?? "approach",
    timer: w[15],
    hp: w[7],
    hpMax: w[8],
    speed: 0,
    facing: w[9] < 0 ? -1 : 1,
    slotX: w[12],
    slotY: 0,
    tx: w[13],
    ty: w[14],
    attacking: w[10] === 1,
    attackCd: w[16],
    cd2: 0,
    shield: w[11],
    pushX: 0,
    pushY: 0,
  }));
  const shots: ShotState[] = sh.map((w) => ({
    id: w[0],
    owner: "",
    look: LOOKS[w[7]] ?? "rivet",
    pull: 0,
    x: w[1],
    y: w[2],
    z: w[3],
    vx: w[4],
    vy: w[5],
    vz: w[6],
    damage: 0,
    life: 1,
    splash: 0,
    pierce: 0,
    hit: [],
  }));
  return { ...rest, enemies, shots, map: map ?? previousMap };
}
