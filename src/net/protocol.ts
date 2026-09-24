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

import { flagsOf } from "../systems/backpackCodec";
import type {
  CharacterId,
  GameEvent,
  InventoryCommand,
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
  /**
   * Der vor dem Run gepackte Rucksack, flach als je vier Zahlen
   * (def, x, y, gedreht).
   *
   * Reist in der Spielerliste mit, also im `lobby`- und im `start`-Paket.
   * Damit baut jedes Geraet fuer jeden Spieler denselben Rucksack auf, bevor
   * die Runde beginnt - waehrend des Runs muss dafuer nichts mehr uebertragen
   * werden ausser dem, was sich aendert.
   */
  backpack?: number[];
}

export interface InputMessage {
  t: "input";
  /** Fortlaufende Nummer - der Host verwirft veraltete Pakete. */
  seq: number;
  move: Vec2;
  aim: Vec2 | null;
  fire: boolean;
  super: boolean;
  /** Einmaliger Wunsch, die zweite Faehigkeit auszuloesen. */
  ability: boolean;
  /**
   * Zielrichtung NUR fuer die zweite Faehigkeit, oder null fuer
   * "in Blickrichtung". Eigenes Feld, weil man die Faehigkeit oft woandershin
   * zielt als den Schuss.
   */
  abilityAim: Vec2 | null;
  /**
   * Einmaliger Rucksack-Befehl (Etappe 9), oder null. Optional, damit ein
   * Paket von einer aelteren Fassung weiterhin gueltig ist.
   */
  inventory?: InventoryCommand | null;
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
  /**
   * Der Rucksackinhalt, flach als je vier Zahlen: def, x, y, gedreht (0/1).
   *
   * ================================================================
   * WARUM JETZT DER GANZE INHALT UND NICHT MEHR NUR DIE ANZAHL
   * ================================================================
   *
   * Bis Phase 10 reichte eine Zahl fuer den HUD-Zaehler. Mit dem Gitter
   * reicht sie nicht mehr: Wer im Run seinen Rucksack oeffnet, muss sehen,
   * WAS und WO darin liegt - und diese Wahrheit hat nur der Host, weil er
   * das Aufsammeln entscheidet.
   *
   * Flach als Zahlenreihe statt als Objektliste: vier Zahlen je Gegenstand
   * statt vier benannter Felder. Bei bis zu 32 Gegenstaenden je Spieler ist
   * das spuerbar kuerzer, und die Reihenfolge steht fest.
   *
   * KOSTEN, ehrlich benannt: Das sind bei vier vollen Rucksaecken rund 500
   * Zahlen je Zustandspaket. Der Schnappschuss traegt ohnehin bis zu 40
   * Gegner mit je zwoelf Feldern, der Anteil bleibt also klein - aber er ist
   * nicht null. Sollte es je knapp werden, waere der naechste Schritt, den
   * Rucksack nur bei Aenderung zu schicken statt in jedem Paket.
   */
  bp: number[];
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
  /** Distanzzone, in der das Team gerade unterwegs ist. */
  zone: number;
  /** Tiefste je erreichte Zone - daran haengt das Ergebnis. */
  deepestZone: number;
  score: number;
  phase: RoundPhase;
  /** Laufzeit des Runs in Sekunden. */
  runTime: number;
  /**
   * Zustand der Encounter, einer je Eintrag: 0 schlafend, 1 aktiv, 2 geschafft.
   *
   * Die POSITIONEN fehlen hier mit Absicht - sie entstehen auf jedem Geraet aus
   * demselben Seed. Uebertragen wird nur, was sich im Spiel aendert.
   */
  encounters: number[];
  /**
   * Welche Ausstiege das Team schon entdeckt hat, als Liste ihrer Indizes.
   *
   * Als Indexliste statt als Ja/Nein je Zone: Entdeckt wird nach und nach,
   * am Anfang ist die Liste leer und am Ende hat sie sechs Eintraege - das
   * ist in jedem Fall kuerzer als sechs Wahrheitswerte. Und weil ein einmal
   * entdeckter Ausstieg nie wieder unbekannt wird, kann die Liste nur wachsen.
   */
  found: number[];
  /** Welche Encounter-Punkte aufgedeckt sind, ebenfalls als Indexliste. */
  seen: number[];
  /** In welcher Ausstiegszone das Team steht (-1 = in keiner) und wie weit. */
  extractionIndex: number;
  extractionProgress: number;
  /** Noch nicht erschienene Gegner - damit das HUD bei allen dasselbe zeigt. */
  pending: number;
  /**
   * Was gerade in der Welt liegt.
   *
   * Die POSITIONEN muessen mit, anders als bei Encountern und Ausstiegen: Die
   * Fundorte der Karte stehen zwar im Seed, aber was ein Gegner fallen laesst,
   * entsteht erst im Spiel. Und was schon aufgehoben wurde, weiss nur der Host.
   *
   * Ein gemeinsames Format fuer beide Herkuenfte statt zweier Listen: Fuer den
   * Client ist der Unterschied bedeutungslos - er zeichnet, was daliegt.
   */
  items: NetGroundItem[];
}

/** Ereignisse, die nicht in jeden Zustand gehoeren: Treffer, Tod, neue Zone. */
export interface EventMessage {
  t: "events";
  events: GameEvent[];
}

export interface HelloMessage {
  t: "hello";
  name: string;
  character: CharacterId;
  /** Was dieser Client eingepackt hat, flach wie in `NetPlayerInfo`. */
  backpack?: number[];
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

/**
 * Die Reihenfolge ist Teil des Protokolls: Uebertragen wird der INDEX, nicht
 * das Wort. Neue Typen kommen deshalb hinten an - wer einen dazwischenschiebt,
 * verschiebt die Bedeutung aller folgenden Zahlen.
 */
export const ENEMY_TYPE_ORDER = ["runner", "brute", "shooter", "boss"] as const;

/**
 * Ein Gegenstand am Boden, wie er uebers Netz geht.
 *
 * `def` ist der Index in `ITEMS` aus `config/items.ts` - dieselbe Regel wie
 * bei den Gegnertypen: Neue Eintraege gehoeren ans Ende der Liste, sonst
 * sieht ein Geraet mit aelterer Version etwas anderes als der Host.
 */
export interface NetGroundItem {
  id: number;
  def: number;
  x: number;
  y: number;
}

/** Gleiche Regel wie bei den Gegnertypen: Der Index wandert, nicht das Wort. */
export const ENCOUNTER_STATUS_ORDER = ["sleeping", "active", "cleared"] as const;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Packt den Weltzustand in die schlanke Fassung fuer das Netz. */
export function encodeState(state: WorldState): StateMessage {
  return {
    t: "state",
    tick: state.tick,
    zone: state.zone,
    deepestZone: state.deepestZone,
    score: state.score,
    phase: state.phase,
    runTime: round1(state.runTime),
    encounters: state.encounters.map((spot) => ENCOUNTER_STATUS_ORDER.indexOf(spot.status)),
    found: state.extractions.flatMap((zone, index) => (zone.discovered ? [index] : [])),
    seen: state.encounters.flatMap((spot, index) => (spot.discovered ? [index] : [])),
    extractionIndex: state.extractionIndex,
    extractionProgress: round1(state.extractionProgress),
    pending: state.pendingSpawns.length,
    items: state.groundItems.map((item) => ({
      id: item.id,
      def: item.def,
      x: round1(item.position.x),
      y: round1(item.position.y),
    })),
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
    // Vierter Wert je Gegenstand: Merkmale als Bits (gedreht, Starter) -
    // siehe `systems/backpackCodec.ts`.
    bp: player.backpack.items.flatMap((entry) => [
      entry.item.def,
      entry.x,
      entry.y,
      flagsOf(entry.rotated, entry.item.starter),
    ]),
  };
}
