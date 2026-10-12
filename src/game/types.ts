/**
 * Alle Datentypen des Spielkerns an einer Stelle.
 *
 * Der Spielkern (`src/game/`) kennt weder Phaser noch das Netz. Er rechnet nur:
 * Eingaben rein, Zustand raus. Genau deshalb laeuft derselbe Code solo auf dem
 * eigenen Handy und im Koop auf dem Host - und laesst sich ohne Browser testen.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Die Werte eines Spielers. Jeder Gegenstand und jedes Level-Up schiebt daran. */
export type StatKey =
  | "maxHp"
  | "regen"
  | "lifesteal"
  | "damage"
  | "melee"
  | "ranged"
  | "attackSpeed"
  | "crit"
  | "range"
  | "armor"
  | "dodge"
  | "speed"
  | "luck"
  | "harvesting";

export type Stats = Record<StatKey, number>;

export type StatMods = Partial<Record<StatKey, number>>;

export type WeaponId = "pistol" | "smg" | "shotgun" | "sniper" | "fist" | "knife" | "spear";

export type CharacterId = "soeldner" | "raufbold" | "jaeger" | "panzer" | "glueckspilz" | "schatten";

export type EnemyType = "grunt" | "swarmer" | "charger" | "spitter" | "bruiser" | "elite" | "boss";

/**
 * Wo die Runde steht.
 *   wave  - es wird gekaempft, die Uhr laeuft
 *   shop  - Pause: Level-Ups waehlen, einkaufen, auf alle warten
 *   won   - Welle 20 geschafft
 *   lost  - alle Spieler am Boden
 */
export type Phase = "wave" | "shop" | "won" | "lost";

/** Eine Waffe im Besitz eines Spielers. `cd` ist die Restzeit bis zum naechsten Schuss. */
export interface OwnedWeapon {
  id: WeaponId;
  /** Stufe 1 bis 4. Zwei gleiche Waffen derselben Stufe werden zu einer hoeheren. */
  tier: number;
  cd: number;
}

export interface Offer {
  kind: "item" | "weapon";
  /** Waffen-ID oder Gegenstands-ID. */
  id: string;
  tier: number;
  price: number;
}

export interface ShopState {
  /** Vier Plaetze. `null` heisst: gekauft, der Platz ist leer. */
  offers: (Offer | null)[];
  locked: boolean[];
  /** Wie oft in dieser Pause schon neu gewuerfelt wurde (macht es teurer). */
  rerolls: number;
  /** Auswahl fuer das aelteste offene Level-Up (IDs aus `UPGRADES`), sonst `null`. */
  upgradeChoices: string[] | null;
}

export interface PlayerState {
  id: string;
  name: string;
  character: CharacterId;
  x: number;
  y: number;
  hp: number;
  alive: boolean;
  /** Restzeit der Unverwundbarkeit nach einem Treffer. */
  iframes: number;
  /** Blickrichtung in Bogenmass - nur fuer die Darstellung der Waffen. */
  facing: number;
  weapons: OwnedWeapon[];
  /** Anzahl je Gegenstand, Index wie in `ITEMS`. */
  items: number[];
  /** Anzahl je Level-Up-Auswahl, Index wie in `UPGRADES`. */
  upgrades: number[];
  gold: number;
  xp: number;
  level: number;
  /** Level-Ups, die noch nicht ausgewaehlt wurden. */
  pendingLevels: number;
  shop: ShopState;
  ready: boolean;
  /** Nummer des letzten verarbeiteten Befehls - der Client weiss damit, was angekommen ist. */
  lastCmd: number;
  kills: number;
  /** Zwischengespeicherte Werte, neu berechnet bei jeder Aenderung. */
  stats: Stats;
  regenCarry: number;
}

export type EnemyMode = "move" | "windup" | "dash" | "recover";

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Zustand fuer Gegner mit Angriffsablauf (Sturmlaeufer, Boss). */
  mode: EnemyMode;
  timer: number;
  /** Zweiter Zeitgeber, z. B. bis zum naechsten Schuss. */
  timer2: number;
  dirX: number;
  dirY: number;
  /** Rueckstoss, klingt von selbst ab. */
  kx: number;
  ky: number;
  /** Kurz nach einem Treffer > 0, die Darstellung blitzt dann auf. */
  flash: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  /** Wie viele Gegner es noch durchschlagen darf. */
  pierce: number;
  life: number;
  /** `true` = vom Spieler, sonst vom Gegner. */
  friendly: boolean;
  ownerId: string;
  crit: boolean;
  radius: number;
  /** Gegner, die dieses Geschoss schon getroffen hat (damit Durchschlag nicht doppelt trifft). */
  hit: number[];
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
  value: number;
  /** Wird gerade von einem Spieler angezogen. */
  magnet: boolean;
}

/** Das Kreuz am Boden, bevor ein Gegner erscheint. */
export interface SpawnMarker {
  x: number;
  y: number;
  /** Restzeit bis zum Erscheinen. */
  t: number;
  type: EnemyType;
}

export interface GameState {
  phase: Phase;
  wave: number;
  /** Restzeit der Welle in Sekunden. */
  timeLeft: number;
  /** Gesamtdauer der Welle - fuer die Anzeige. */
  waveLength: number;
  players: PlayerState[];
  enemies: Enemy[];
  shots: Projectile[];
  pickups: Pickup[];
  markers: SpawnMarker[];
  tick: number;
}

/** Ereignisse fuer Ton und Effekte. Sie aendern nichts am Spiel. */
export type GameEvent =
  | { t: "hit"; x: number; y: number; dmg: number; crit: boolean; enemy: boolean }
  | { t: "kill"; x: number; y: number; big: boolean }
  | { t: "shot"; pid: string; kind: "ranged" | "melee"; x: number; y: number; angle: number }
  | { t: "pickup"; pid: string; x: number; y: number }
  | { t: "heal"; pid: string; x: number; y: number; amount: number }
  | { t: "dodge"; pid: string; x: number; y: number }
  | { t: "down"; pid: string; x: number; y: number }
  | { t: "revive"; pid: string }
  | { t: "waveStart"; wave: number }
  | { t: "waveEnd"; wave: number }
  | { t: "levelUp"; pid: string }
  | { t: "bought"; pid: string }
  | { t: "enemyShot"; x: number; y: number };

/** Bewegungswunsch eines Spielers, Betrag hoechstens 1. */
export interface PlayerInput {
  mx: number;
  my: number;
}

/** Befehle in der Pause zwischen den Wellen. */
export type Command =
  | { k: "buy"; slot: number }
  | { k: "reroll" }
  | { k: "lock"; slot: number }
  | { k: "sell"; index: number }
  | { k: "merge"; index: number }
  | { k: "upgrade"; pick: number }
  | { k: "ready"; value: boolean };

/** Was die Lobby ueber einen Spieler weiss, bevor die Runde beginnt. */
export interface PlayerSetup {
  id: string;
  name: string;
  character: CharacterId;
  startWeapon: WeaponId;
}
