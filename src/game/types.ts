/**
 * Alle Zustandstypen des Spielkerns. Der Zustand ist reines JSON (keine Klassen),
 * damit er spaeter im Koop als Schnappschuss uebers Netz gehen kann.
 */

export type CrewId = "schrauber" | "kanonier" | "brecher" | "bergung" | "funkerin" | "springer";
export type EnemyType =
  | "laeufer"
  | "enterer"
  | "phalanx"
  | "skarabaeus"
  | "priester"
  | "streitwagen"
  | "ballista"
  | "turm"
  | "koloss";
/** Wo ein Gegner gerade ist: am Boden, an der Rumpfwand (klettert), auf dem Deck, in der Luft. */
export type EnemyLayer = "ground" | "climb" | "deck" | "air";
/** Was ein Gegner gerade tut (jede Art benutzt nur einen Teil davon). */
export type EnemyMode =
  | "approach"
  | "climb"
  | "deck"
  | "fly"
  | "charge"
  | "retreat"
  | "standoff"
  | "dock"
  | "walk"
  | "slam";
/** Zusammensetzung eines Trupps. */
export type TruppKind =
  "laeufer" | "enterer" | "phalanx" | "schwarm" | "wagen" | "ballista" | "turm";
/** Module, die man aufs Deck bauen kann. */
export type ModuleId =
  | "geschuetz"
  | "harpune"
  | "moerser"
  | "spule"
  | "platte"
  | "oel"
  | "generator"
  | "magnet"
  | "motor"
  | "werkstatt";
/** Aus welcher Richtung ein Trupp kommt (hinten = links, vorn = rechts in Laufrichtung). */
export type Side = "hinten" | "vorn" | "oben" | "unten";
export type Layer = "deck" | "ground";
/** Marsch = unterwegs, Pluendern = in einer Ruine (die Festung steht), Rast = Pause an einer Station. */
export type Phase = "march" | "loot" | "rest" | "won" | "lost";
/** Arten von Stationen auf der Routenkarte. `station` = fester Probelauf ohne Besonderheit. */
export type NodeType =
  "start" | "ruine" | "oase" | "haendler" | "schrott" | "sturm" | "ereignis" | "boss" | "station";

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
  /** Auf dem Deck und an der Rumpfwand: der Punkt darunter auf der Bodenebene. */
  x: number;
  y: number;
  z: number;
  layer: EnemyLayer;
  mode: EnemyMode;
  /** Zeitgeber der aktuellen Taetigkeit (Klettern, Nachladen, Ausholen ...). */
  timer: number;
  hp: number;
  hpMax: number;
  speed: number;
  facing: 1 | -1;
  /** Ziel relativ zur Festung: Angriffs-, Kletter-, Halte- oder Andockpunkt. */
  slotX: number;
  slotY: number;
  /** Zweites Ziel relativ zur Festung (z. B. wohin der Koloss schlaegt). */
  tx: number;
  ty: number;
  /** `true`, solange er zuschlaegt (fuer die Hack-Bewegung im Bild). */
  attacking: boolean;
  attackCd: number;
  /** Zweiter Zeitgeber (Stampfen des Koloss, Ausladen am Turm). */
  cd2: number;
  /** Schutzschild des Sandpriesters: faengt so viel Schaden ab. */
  shield: number;
  /** Rueckstoss, klingt ab. */
  pushX: number;
  pushY: number;
}

/** Bolzen der Ballista im Flug - trifft ein Modul (uid) oder den Rumpf (0). */
export interface EnemyShotState {
  id: number;
  x0: number;
  y0: number;
  z0: number;
  /** Ziel relativ zur Festung (sie laeuft weiter, der Bolzen folgt). */
  x1: number;
  y1: number;
  t: number;
  duration: number;
  damage: number;
  target: number;
}

export interface ShotState {
  id: number;
  /** Spieler-ID oder "m" + Modulnummer. */
  owner: string;
  look: "rivet" | "bolt" | "harpoon";
  /** Harpune: zieht den Getroffenen zu einem Fuss der Festung. */
  pull: number;
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
  /** Hoehe - der Schrottmagnet hebt Stuecke aufs Deck. */
  z: number;
  value: number;
}

/** Ein gebautes Modul auf dem Deck. */
export interface ModuleState {
  uid: number;
  type: ModuleId;
  /** Linkes Feld (breite Module belegen zwei). */
  col: number;
  row: number;
  level: number;
  cooldown: number;
  facing: 1 | -1;
  hp: number;
  hpMax: number;
  /** Kaputt: tut nichts, bis es wieder zur Haelfte repariert ist. */
  broken: boolean;
}

/** Granate des Moersers im Flug. */
export interface ShellState {
  id: number;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  t: number;
  duration: number;
  damage: number;
  radius: number;
}

/** Ein Trupp ist im Anmarsch - am Bildrand blinkt vorher eine Warnung. */
export interface WarningState {
  id: number;
  side: Side;
  /** Lage entlang des Rands: y fuer hinten/vorn, x (Welt) fuer oben/unten. */
  at: number;
  /** Sekunden bis der Trupp auftaucht. */
  eta: number;
  count: number;
  trupp: TruppKind;
  /** Wer im Trupp mitlaeuft (steht schon bei der Warnung fest). */
  members: EnemyType[];
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
  /** Tempo als Vielfaches (Dampfmotoren machen sie schneller). */
  speed: number;
  /** Sekunden, die sie noch gebremst ist (Streitwagen hat ein Bein gerammt). */
  slow: number;
  /** Rumpf ohne Panzerplatten (Ereignisse und Werft machen ihn groesser). */
  baseHull: number;
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
  /** Endgegner: keiner, kommt noch, ist da, besiegt. */
  boss: "none" | "waiting" | "alive" | "down";
  /** Zielstation auf der Karte. */
  node: number;
  /** Die Armee hat aufgeholt: viel mehr Gegner. */
  horde: boolean;
  /** Sandsturm: man sieht wenig, es kommen weniger. */
  storm: boolean;
}

/** Eine Station auf der Routenkarte eines Akts. */
export interface MapNode {
  id: number;
  /** Spalte: 0 = Start, die letzte = Endgegner. */
  layer: number;
  /** Lage in der Spalte, 0 (oben) bis 1 (unten). */
  y: number;
  type: NodeType;
  name: string;
  /** Wohin es von hier weitergeht. */
  next: number[];
  /** Fester Probelauf: Nummer des Marschs in der Route. */
  route?: number;
}

export interface ActMap {
  act: number;
  name: string;
  layers: number;
  nodes: MapNode[];
}

/** Truhe in einer Ruine: daneben stehen oeffnet sie. */
export interface ChestState {
  id: number;
  x: number;
  y: number;
  /** 0 bis 1 - bei 1 springt sie auf. */
  progress: number;
  value: number;
  opened: boolean;
}

/** Ein Ereignis an der Station wartet auf eine Entscheidung. */
export interface EventState {
  id: string;
}

export interface GameState {
  phase: Phase;
  time: number;
  /** Wo die Festung gerade rastet (in der Rast) bzw. zuletzt gerastet hat. */
  restAt: string;
  /** Die naechste bzw. laufende Etappe. */
  march: MarchState;
  /** Routenkarte des Akts und wo die Festung steht. */
  map: ActMap;
  at: number;
  /** Besuchte Stationen der Reihe nach. */
  path: number[];
  /** Vorsprung vor der Armee (0 = eingeholt, dann kommt eine Heerschar). */
  lead: number;
  /** Ereignis, das auf eine Wahl wartet. */
  event: EventState | null;
  /** Schon gesehene Ereignisse (keins doppelt pro Lauf). */
  seenEvents: string[];
  /** Pluendern in der Ruine: Restzeit. */
  loot: { timer: number; duration: number } | null;
  chests: ChestState[];
  fort: FortState;
  players: PlayerState[];
  enemies: EnemyState[];
  shots: ShotState[];
  enemyShots: EnemyShotState[];
  scrap: ScrapState[];
  modules: ModuleState[];
  shells: ShellState[];
  warnings: WarningState[];
  /** Angebot der Rast: zufaellige Module, jedes einmal kaufbar. */
  offer: ModuleId[];
  /** Wie oft in dieser Rast schon neu gewuerfelt wurde (macht es teurer). */
  rerolls: number;
  /** Gemeinsamer Schrott der Crew. */
  bank: number;
  kills: number;
  nextId: number;
}

export type GameEvent =
  | { kind: "shot"; owner: string; x: number; y: number; z: number; look: ShotState["look"] }
  | { kind: "hit"; id: number; x: number; y: number }
  | { kind: "kill"; x: number; y: number; type: EnemyType }
  | { kind: "stomp"; x: number; y: number }
  | { kind: "pickup"; player: string; x: number; y: number; value: number }
  | { kind: "hullHit"; x: number; y: number; amount: number; source?: EnemyType }
  | { kind: "playerHit"; id: string }
  | { kind: "playerDown"; id: string }
  | { kind: "respawn"; id: string }
  | { kind: "jump" | "climb" | "winch"; id: string }
  | { kind: "ability"; id: string }
  | { kind: "arrived"; index: number }
  | { kind: "depart"; index: number }
  | { kind: "repair"; amount: number }
  | { kind: "built" | "upgraded" | "sold"; uid: number; type: ModuleId }
  | { kind: "reroll" }
  | { kind: "zap"; points: [number, number, number][] }
  | { kind: "boom"; x: number; y: number; radius: number }
  | { kind: "mortar"; uid: number }
  | { kind: "trupp"; side: Side; count: number; trupp: TruppKind }
  | {
      kind: "enemyClimb" | "land" | "ram" | "bridge" | "slamWarn" | "slam" | "shield";
      x: number;
      y: number;
    }
  | { kind: "ballista"; x: number; y: number }
  | { kind: "moduleHit" | "moduleBroken"; uid: number }
  | { kind: "boss" | "bossDown"; type: EnemyType }
  | { kind: "chest"; x: number; y: number; value: number }
  | { kind: "horde" }
  | { kind: "lead"; amount: number }
  | { kind: "loot" }
  | { kind: "bonus"; text: string }
  | { kind: "choice"; text: string }
  | { kind: "won" | "lost" };

/** Befehle aus der Rast. */
export type Command =
  | { kind: "repair" }
  | { kind: "depart"; node?: number }
  | { kind: "choose"; option: number }
  | { kind: "build"; module: ModuleId; col: number; row: number }
  | { kind: "upgrade"; uid: number }
  | { kind: "sell"; uid: number }
  | { kind: "reroll" };
