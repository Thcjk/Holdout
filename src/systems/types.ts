/**
 * Reine Datentypen der Simulation.
 *
 * Wichtig: In dieser Datei - und in allen anderen Dateien unter `systems/` -
 * darf nichts aus Phaser vorkommen. Die Simulation muss ohne Bildschirm laufen
 * koennen, weil im Koop der Host sie fuer alle rechnet und weil sie sich sonst
 * nicht testen laesst.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Achsenparalleles Rechteck. `x`/`y` ist die linke obere Ecke. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Eingabe eines Spielers fuer einen Tick - bewusst geraeteunabhaengig.
 * Tastatur, Touch-Joystick und (ab Phase 6) das Netzwerk liefern alle dieses
 * eine Format, damit die Simulation nicht wissen muss, woher die Eingabe kommt.
 */
export interface InputState {
  /** Richtungsvektor der Bewegung, Laenge 0 bis 1 (Teilausschlag ist erlaubt). */
  move: Vec2;
  /**
   * Zielrichtung als Einheitsvektor, oder `null` fuer "zielt nicht selbst".
   * Bei `null` sucht die Simulation automatisch den naechsten Gegner.
   */
  aim: Vec2 | null;
  /** Einmaliger Schusswunsch fuer diesen Tick. */
  fire: boolean;
  /** Einmaliger Wunsch, die Super-Faehigkeit auszuloesen. */
  useSuper: boolean;
}

export function emptyInput(): InputState {
  return { move: { x: 0, y: 0 }, aim: null, fire: false, useSuper: false };
}

export type CharacterId = "scout" | "tank" | "sniper";
export type EnemyType = "runner" | "brute" | "shooter";

export interface PlayerState {
  id: string;
  name: string;
  character: CharacterId;
  /** Mittelpunkt. */
  position: Vec2;
  velocity: Vec2;
  radius: number;
  /** Blickrichtung als Einheitsvektor - auch ohne aktives Zielen immer gesetzt. */
  facing: Vec2;
  health: number;
  maxHealth: number;
  /**
   * Restliche Nachladezeit je Munitionsladung, in Sekunden.
   * 0 heisst "Ladung ist voll". Alle Ladungen laden gleichzeitig nach.
   */
  reloadTimers: number[];
  /** Aufladung der Super-Faehigkeit, 0 bis 100. */
  superCharge: number;
  /** War der Super im letzten Tick schon voll? Fuer den "Super bereit"-Ton. */
  superWasReady: boolean;
  /** Am Boden: nicht tot, aber bewegungsunfaehig, bis jemand wiederbelebt. */
  down: boolean;
  /** Fortschritt der Wiederbelebung in Sekunden. */
  reviveProgress: number;
  /** Restliche Unverwundbarkeit nach einem Treffer, in Sekunden. */
  invulnerable: number;
  /** Restdauer des Scout-Dashs in Sekunden (0 = kein Dash). */
  dashTime: number;
  dashDirection: Vec2;
  /** Steht der Spieler in einem Busch? Gegner sehen ihn dann nicht. */
  inBush: boolean;
  /** Restlicher Schusstakt in Sekunden - verhindert Dauerfeuer pro Tick. */
  shootCooldown: number;
}

export interface EnemyState {
  id: number;
  type: EnemyType;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  health: number;
  maxHealth: number;
  speed: number;
  contactDamage: number;
  scoreValue: number;
  isBoss: boolean;
  /** Groessenfaktor fuer die Darstellung (Boss ist doppelt so gross). */
  scale: number;
  /** Restliche Betaeubung in Sekunden (Tank-Super). */
  stunned: number;
  /** Restzeit der Sniper-Markierung in Sekunden: doppelter Schaden. */
  marked: number;
  /** Restzeit bis zum naechsten Schuss (nur Schuetze). */
  shootCooldown: number;
  /** Restliche Abklingzeit des Beruehrungsschadens in Sekunden. */
  contactCooldown: number;
}

export type ProjectileOwner = "player" | "enemy";

export interface ProjectileState {
  id: number;
  /** Inaktive Projektile bleiben im Array liegen und werden wiederverwendet (Pooling). */
  active: boolean;
  owner: ProjectileOwner;
  ownerId: string;
  position: Vec2;
  velocity: Vec2;
  radius: number;
  damage: number;
  /** Restliche Flugstrecke in Pixeln - daraus ergibt sich die Waffenreichweite. */
  rangeLeft: number;
  /** Durchdringt Gegner (Sniper). */
  piercing: boolean;
  /** Bereits getroffene Gegner, damit ein Durchschuss nicht mehrfach zaehlt. */
  hitEnemies: number[];
}

/** Ablaufphase einer Runde. */
export type RoundPhase = "preparing" | "wave" | "break" | "gameover";

/**
 * Ereignisse eines Ticks. Die Simulation beschreibt damit, was passiert ist;
 * die Darstellung macht daraus Effekte und Toene, und ab Phase 6 werden genau
 * diese Ereignisse ueber das Netz an die Clients geschickt.
 */
export type GameEvent =
  | { type: "shot"; x: number; y: number; dx: number; dy: number; owner: ProjectileOwner }
  | { type: "hit"; x: number; y: number; damage: number; enemyId: number }
  | { type: "enemyDied"; x: number; y: number; enemyType: EnemyType; isBoss: boolean }
  | { type: "playerHit"; playerId: string; x: number; y: number; damage: number }
  | { type: "playerDown"; playerId: string; x: number; y: number }
  | { type: "playerRevived"; playerId: string; x: number; y: number }
  | { type: "superReady"; playerId: string }
  | { type: "superUsed"; playerId: string; character: CharacterId; x: number; y: number }
  | { type: "spawnWarning"; x: number; y: number }
  | { type: "waveStart"; wave: number }
  | { type: "gameOver"; score: number; wave: number };

export interface SpawnOrder {
  type: EnemyType;
  isBoss: boolean;
  /** Tick, an dem der Gegner erscheinen soll. */
  atTick: number;
  position: Vec2;
}

export interface WorldState {
  /** Fortlaufende Nummer des Simulationsschritts. */
  tick: number;
  phase: RoundPhase;
  /** Restzeit der aktuellen Phase in Sekunden. */
  phaseTime: number;
  wave: number;
  score: number;
  players: PlayerState[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  /** Noch nicht erschienene Gegner der laufenden Welle. */
  pendingSpawns: SpawnOrder[];
  /** Alles, was Bewegung blockiert: Aussenmauern und Deckungsbloecke. */
  walls: Rect[];
  /** Buschfelder: Gegner sehen Spieler darin nicht. */
  bushes: Rect[];
  bounds: Rect;
  /** Ereignisse dieses Ticks. Die Darstellung leert die Liste nach dem Auswerten. */
  events: GameEvent[];
  /** Zustand des Zufallsgenerators - damit Host und Client gleich rechnen. */
  rngState: number;
  nextEnemyId: number;
  nextProjectileId: number;
}
