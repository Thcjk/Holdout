/**
 * Alle Zustandstypen des Spielkerns. Der Zustand ist reines JSON (keine Klassen),
 * damit er spaeter im Koop als Schnappschuss uebers Netz gehen kann.
 */

export type CrewId = "schrauber" | "kanonier" | "brecher" | "bergung" | "funkerin" | "springer";
export type EnemyType = "laeufer";
export type Layer = "deck" | "ground";
/** Marsch = die Welle, Rast = Pause an einer Station. */
export type Phase = "march" | "rest" | "won" | "lost";

/** Was ein Spieler pro Bild schickt. */
export interface PlayerInput {
  /** Bewegung, Laenge 0 bis 1. */
  mx: number;
  my: number;
  /** Zaehler der Faehigkeits-Druecke; nur ein hoeherer Wert als zuletzt loest aus. */
  ability?: number;
}

export interface PlayerSetup {
  id: string;
  name: string;
  crew: CrewId;
}

/** Ein Punkt, der entweder fest am Boden liegt oder mit der Festung mitfaehrt. */
export interface Anchor {
  x: number;
  y: number;
  z: number;
  /** `true`: x/y sind relativ zur Festung und wandern mit ihr. */
  onFort: boolean;
}

/** Abspringen, Hochklettern oder von der Seilwinde geholt werden. */
export interface Transition {
  kind: "jump" | "climb" | "winch";
  t: number;
  duration: number;
  from: Anchor;
  to: Anchor;
  toLayer: Layer;
}

export interface PlayerState {
  id: string;
  name: string;
  crew: CrewId;
  layer: Layer;
  /** Position auf der Bodenebene (auch auf dem Deck: der Punkt darunter). */
  x: number;
  y: number;
  /** Hoehe ueber dem Boden (Deck = ELEVATION). */
  z: number;
  facing: 1 | -1;
  moving: boolean;
  hp: number;
  hpMax: number;
  alive: boolean;
  /** Sekunden bis zum Wiederaufstehen. */
  respawn: number;
  transition: Transition | null;
  /** So lange wird schon gegen eine Deckkante gedrueckt. */
  edgeTime: number;
  /** Sekunden bis zum naechsten Schuss. */
  cooldown: number;
  abilityCd: number;
  abilityAck: number;
  kills: number;
  scrap: number;
}

export interface EnemyState {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  speed: number;
  facing: 1 | -1;
  /** Angriffspunkt an der Festung (relativ zur Festung). */
  slotX: number;
  slotY: number;
  /** `true`, solange er an der Festung haengt und hackt. */
  attacking: boolean;
  attackCd: number;
  /** Rueckstoss, klingt ab. */
  pushX: number;
  pushY: number;
}

export interface ShotState {
  id: number;
  owner: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
}

export interface ScrapState {
  id: number;
  x: number;
  y: number;
  value: number;
}

export interface FortState {
  /** Linke hintere Ecke des Decks auf dem Boden. */
  x: number;
  y: number;
  hull: number;
  hullMax: number;
  /** Laufzeit der Beine (steht in der Rast still). */
  gait: number;
  moving: boolean;
}

export interface MarchState {
  /** 0-basiert: die wievielte Etappe. */
  index: number;
  count: number;
  /** Ziel dieser Etappe, z. B. "Oase". */
  station: string;
  length: number;
  done: number;
  spawnTimer: number;
}

export interface GameState {
  phase: Phase;
  time: number;
  march: MarchState;
  fort: FortState;
  players: PlayerState[];
  enemies: EnemyState[];
  shots: ShotState[];
  scrap: ScrapState[];
  /** Gemeinsamer Schrott der Crew. */
  bank: number;
  kills: number;
  nextId: number;
}

export type GameEvent =
  | { kind: "shot"; owner: string; x: number; y: number; z: number }
  | { kind: "hit"; id: number; x: number; y: number }
  | { kind: "kill"; x: number; y: number; type: EnemyType }
  | { kind: "stomp"; x: number; y: number }
  | { kind: "pickup"; player: string; x: number; y: number; value: number }
  | { kind: "hullHit"; x: number; y: number; amount: number }
  | { kind: "playerHit"; id: string }
  | { kind: "playerDown"; id: string }
  | { kind: "respawn"; id: string }
  | { kind: "jump" | "climb" | "winch"; id: string }
  | { kind: "ability"; id: string }
  | { kind: "arrived"; index: number }
  | { kind: "depart"; index: number }
  | { kind: "repair"; amount: number }
  | { kind: "won" | "lost" };

/** Befehle aus der Rast. */
export type Command = { kind: "repair" } | { kind: "depart" };
