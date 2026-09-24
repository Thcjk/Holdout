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
  /**
   * Wird gerade gefeuert? Ein GEHALTENER Zustand, kein einmaliger Wunsch: Der
   * Spieler haelt den Schussknopf, und die Simulation feuert so schnell, wie
   * Munition und Schusstakt es zulassen.
   */
  fire: boolean;
  /** Einmaliger Wunsch, die Super-Faehigkeit auszuloesen. */
  useSuper: boolean;
  /** Einmaliger Wunsch, die zweite Faehigkeit auszuloesen. */
  useAbility: boolean;
  /**
   * Zielrichtung NUR fuer die zweite Faehigkeit, als Einheitsvektor.
   *
   * Eigenes Feld statt `aim`: Man zielt die Faehigkeit oft woandershin, als man
   * gerade schiesst. `null` heisst "in Blickrichtung" - das ist der Fall beim
   * kurzen Antippen ohne Ziehen.
   */
  abilityAim: Vec2 | null;
  /**
   * Einmaliger Wunsch, im Rucksack etwas umzuraeumen oder wegzuwerfen
   * (Etappe 9). Wie Super und Faehigkeit: Die Anzeige aendert den Rucksack
   * NICHT selbst - im Koop gehoert er dem Host, und zwei Stellen, die ihn
   * aendern, liefen auseinander.
   */
  inventory: InventoryCommand | null;
}

/**
 * Ein Befehl an den Rucksack.
 *
 * Der Gegenstand wird ueber seine LAGE (linke obere Zelle) benannt, nicht
 * ueber seine Nummer in der Liste: Auf dem Client entsteht die Liste bei
 * jedem Zustandspaket neu, und eine Nummer koennte zwischen Tippen und
 * Ankommen auf einen anderen Gegenstand zeigen. Eine Zelle nicht - dort liegt
 * entweder genau dieser Gegenstand, oder der Befehl geht ins Leere.
 */
export type InventoryCommand =
  | { op: "move"; fromX: number; fromY: number; x: number; y: number; rotated: boolean }
  | { op: "drop"; fromX: number; fromY: number };

export function emptyInput(): InputState {
  return {
    move: { x: 0, y: 0 },
    aim: null,
    fire: false,
    useSuper: false,
    useAbility: false,
    abilityAim: null,
    inventory: null,
  };
}

export type CharacterId = "scout" | "tank" | "sniper";

/**
 * Die Gegnertypen.
 *
 * "boss" deckt Mini-Boss UND Ende-Boss ab - unterschieden werden sie ueber das
 * Feld `isBoss` in `EnemyState`, das ohnehin schon funffaches Leben und
 * doppelte Groesse bedeutet. Siehe `ENEMIES.boss` in `config/balance.ts`.
 */
export type EnemyType = "runner" | "brute" | "shooter" | "boss";

/**
 * Ein Gegenstand, wie ihn ein Spieler mit sich traegt.
 *
 * Bewusst duenn: eine laufende Nummer und der Index im Katalog
 * (`config/items.ts`). Alles Weitere - Name, Typ, Form, Seltenheit - steht
 * dort und wird nachgeschlagen.
 *
 * WARUM NICHT DIE GANZE DEFINITION KOPIEREN: Dann gaebe es zwei Wahrheiten
 * ueber dasselbe Item. Aendert sich eine Groesse im Katalog, traegt ein
 * Spieler sonst weiterhin die alte mit sich herum - und ab Phase 11 haette
 * sein Rucksack dann eine andere Belegung, als das Gitter berechnet.
 */
export interface ItemInstance {
  id: number;
  /** Index in `ITEMS` aus `config/items.ts`. */
  def: number;
  /**
   * Gehoert zum Starter-Set? Dann ist er geschuetzt: Er geht bei einem Wipe
   * nicht verloren und wird bei einem Erfolg nicht zusaetzlich gesichert -
   * er steht im naechsten Packen ohnehin wieder bereit (Etappe 9).
   */
  starter?: boolean;
}

/**
 * Ein Gegenstand an seinem Platz im Rucksackgitter.
 *
 * Steht HIER und nicht in `InventoryGridSystem.ts`, obwohl die Logik dort
 * liegt: In dieser Datei stehen alle Datentypen der Simulation, und
 * `PlayerState` braucht das Gitter. Andersherum entstuende ein Import-Zyklus
 * (types -> InventoryGridSystem -> types), den man nur mit `import type`
 * entschaerfen koennte - eine Falle, die beim naechsten Umbau zuschnappt.
 */
export interface PlacedItem {
  item: ItemInstance;
  /** Linke obere Ecke in Zellen. */
  x: number;
  y: number;
  /** Um 90 Grad gedreht? Vertauscht Breite und Hoehe. */
  rotated: boolean;
}

/** Ein Rucksackgitter: Groesse plus was darin liegt. */
export interface InventoryGrid {
  width: number;
  height: number;
  items: PlacedItem[];
}

/**
 * Ein gepackter Gegenstand, wie er vom Loadout-Bildschirm in den Run geht.
 *
 * Bewusst OHNE laufende Nummer: Die vergibt die Simulation beim Aufbau des
 * Runs. Und bewusst MIT Position und Drehung - sonst ginge die Anordnung
 * verloren, die der Spieler gerade von Hand gelegt hat, und der Rucksack
 * saehe beim Start anders aus als beim Packen.
 */
export interface PackedItem {
  def: number;
  x: number;
  y: number;
  rotated: boolean;
  /** Starter-Set, siehe `ItemInstance.starter`. */
  starter?: boolean;
}

/**
 * Ein Gegenstand, der in der Welt liegt.
 *
 * `fromWorld` unterscheidet zwei Herkuenfte mit unterschiedlichen Regeln:
 * Ein Fundort aus der Weltgenerierung gehoert zum ORT und verfaellt nie; was
 * ein Gegner fallen laesst, verschwindet nach einer Weile wieder, damit sich
 * die Karte nicht mit Kleinkram zusetzt.
 */
export interface GroundItem {
  id: number;
  def: number;
  position: Vec2;
  /** Restliche Liegezeit in Sekunden. Unendlich fuer Fundorte der Karte. */
  lifetime: number;
  fromWorld: boolean;
  /**
   * Wurde fuer diesen Gegenstand schon "Rucksack voll" gemeldet?
   *
   * Ohne dieses Merkmal kaeme die Meldung dreissigmal je Sekunde, solange man
   * danebensteht - aus einem Hinweis wuerde ein Alarm.
   */
  refused?: boolean;
}

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
  /** Gegner, die dieser Dash schon erwischt hat - jeder wird nur einmal getroffen. */
  dashHits: number[];
  /** Steht der Spieler in einem Busch? Gegner sehen ihn dann nicht. */
  inBush: boolean;
  /** Restlicher Schusstakt in Sekunden - verhindert Dauerfeuer pro Tick. */
  shootCooldown: number;
  /** Restliche Abklingzeit der zweiten Faehigkeit in Sekunden. 0 = bereit. */
  abilityCooldown: number;
  /**
   * Der Rucksack dieses Spielers.
   *
   * JEDER HAT SEINEN EIGENEN, nicht das Team einen gemeinsamen. So steht es
   * im Briefing - und es macht das Aufheben zu einer Entscheidung: Wer zuerst
   * da ist, bekommt es.
   *
   * Ein GITTER und keine flache Liste. Das war bis Phase 10 anders, und die
   * flache Liste hatte einen stillen Haken: Sie war unbegrenzt. Damit gab es
   * beim Aufsammeln nichts zu entscheiden, und der Loadout-Bildschirm war
   * folgenlos - man konnte packen, was man wollte, und im Run passte ohnehin
   * alles hinein.
   */
  backpack: InventoryGrid;
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
  /**
   * Restzeit der Wurzelung in Sekunden (Sniper-Laehmschuss).
   * Ein gewurzelter Gegner kann sich nicht bewegen, greift aber weiter an.
   */
  rooted: number;
  /** Restzeit bis zum naechsten Schuss (nur Schuetze). */
  shootCooldown: number;
  /** Restliche Abklingzeit des Beruehrungsschadens in Sekunden. */
  contactCooldown: number;
  /**
   * Schadensfaktor aus der Distanzzone, in der dieser Gegner erschienen ist.
   *
   * STEHT HIER, STATT AUS DEM LEBEN ABGELEITET ZU WERDEN. Frueher rechnete
   * `damageScale()` ihn als `maxHealth / Grundleben` aus. Das ging gut, solange
   * beide Faktoren dasselbe waren - war aber schon damals falsch (das Leben
   * waechst 8 % je Zone, der Schaden laut Briefing nur 4 %) und waere beim Boss
   * richtig schiefgegangen: Dessen Leben ist zusaetzlich verfuenffacht, er
   * haette also mit fuenffachem Schaden geschossen.
   */
  damageMultiplier: number;
  /**
   * Nur beim Boss: Zustand seiner beiden Angriffe.
   *
   * Steht direkt am Gegner statt in einer Nebentabelle, damit ein Boss beim
   * Sterben nichts hinterlaesst, was jemand aufraeumen muesste.
   */
  boss?: BossState;
  /**
   * Zu welchem Encounter-Punkt dieser Gegner gehoert (Index in `encounters`).
   *
   * Daran erkennt die Simulation beim Tod, welcher Punkt als geschafft gilt.
   */
  encounterIndex?: number;
  /**
   * Wie lange dieser Gegner schon laufen will, aber nicht vom Fleck kommt.
   * Daraus entsteht das seitliche Ausweichen - ohne diesen Zaehler bleiben
   * Gegner an Deckungsbloecken dauerhaft kleben und die Welle endet nie.
   */
  stuckTime: number;
}

export type ProjectileOwner = "player" | "enemy";

/** Zusatzwirkung eines Projektils - normale Schuesse haben "none". */
export type ProjectileEffect = "none" | "blast" | "root";

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
  /**
   * Was beim Treffer zusaetzlich passiert.
   * "blast" explodiert im Umkreis, "root" wurzelt den Getroffenen fest.
   */
  effect: ProjectileEffect;
  /** Wirkradius fuer "blast", sonst 0. */
  blastRadius: number;
  /** Schaden der Explosion an jedem Gegner im Radius. Nur fuer "blast". */
  blastDamage: number;
  /** Bereits getroffene Gegner, damit ein Durchschuss nicht mehrfach zaehlt. */
  hitEnemies: number[];
}

/**
 * Ablaufphase eines Runs.
 *
 * Frueher gab es hier vier Phasen (Vorbereitung, Welle, Pause, Ende). Mit dem
 * Wegfall der Wellen bleiben zwei: Man spielt, oder der Run ist vorbei. Eine
 * Pause gibt es nicht mehr - die Verschnaufpause holt man sich, indem man in
 * Richtung Startpunkt zurueckgeht, wo weniger und schwaechere Gegner stehen.
 *
 * "ended" hiess bis Phase 9 "gameover". Umbenannt, weil ein Run seitdem auch
 * gut ausgehen kann - wie, steht in `WorldState.outcome`.
 */
export type RoundPhase = "running" | "ended";

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
  | { type: "abilityUsed"; playerId: string; character: CharacterId; x: number; y: number }
  | { type: "blast"; x: number; y: number; radius: number }
  | { type: "healed"; playerId: string; amount: number; x: number; y: number }
  | { type: "spawnWarning"; x: number; y: number }
  /**
   * Das Team hat zum ersten Mal eine neue Distanzzone erreicht.
   *
   * Nachfolger von "waveStart"/"waveCleared": Der Fortschritt haengt jetzt an
   * der Entfernung zum Start, nicht mehr an der Zeit. Daran haengen Klang
   * und Anzeige.
   */
  | { type: "zoneReached"; zone: number }
  /** Ein Boss ist erwacht - jemand hat seinen Encounter betreten. */
  | { type: "encounterStarted"; index: number; isFinal: boolean; x: number; y: number }
  /** Der Boss dieses Encounters ist besiegt. */
  | { type: "encounterCleared"; index: number; isFinal: boolean }
  /** Ein Ausstieg ist zum ersten Mal in Sichtweite gekommen. */
  | { type: "extractionFound"; x: number; y: number }
  /** Jemand hat etwas aufgehoben. */
  | { type: "itemPicked"; playerId: string; def: number; x: number; y: number }
  /**
   * Jemand konnte NICHT aufheben, weil kein Platz mehr ist.
   *
   * Ein eigenes Ereignis, damit die Darstellung es sagen kann. Ohne diese
   * Meldung laeuft man ueber einen Gegenstand und nichts passiert - das
   * sieht nach einem Fehler aus, nicht nach einer vollen Tasche.
   */
  | { type: "backpackFull"; playerId: string; def: number; x: number; y: number }
  /** Der Boss holt aus: Warnkreis an dieser Stelle, mit diesem Radius. */
  | { type: "bossWindup"; x: number; y: number; radius: number; seconds: number }
  | { type: "runEnded"; outcome: RunOutcome; score: number; zone: number };

export interface SpawnOrder {
  type: EnemyType;
  isBoss: boolean;
  /** Tick, an dem der Gegner erscheinen soll. */
  atTick: number;
  position: Vec2;
}

/** Der Zustand der beiden Boss-Angriffe. */
export interface BossState {
  /** Restzeit bis zur naechsten Schockwelle. */
  slamCooldown: number;
  /** Restliche Vorwarnzeit. Groesser 0 heisst: Der Warnkreis steht gerade. */
  slamWindup: number;
  /** Restzeit bis zur naechsten Salve. */
  salvoCooldown: number;
}

/** Was aus einem Encounter-Punkt geworden ist. */
export type EncounterStatus = "sleeping" | "active" | "cleared";

/**
 * Ein Encounter-Punkt: die Stelle, an der ein Boss wartet.
 *
 * Position und Art kommen aus dem Seed und sind auf allen Geraeten gleich -
 * uebertragen wird nur der `status` und die Id des erweckten Gegners.
 */
export interface EncounterSpot {
  position: Vec2;
  /** Der Ende-Boss ist `true`, jeder Mini-Boss `false`. */
  isFinal: boolean;
  /** Distanzzone, in der der Punkt liegt - bestimmt die Staerke des Bosses. */
  zone: number;
  status: EncounterStatus;
  /** Id des aktiven Gegners, solange gekaempft wird. */
  enemyId: number | null;
  /**
   * Ist dieser Punkt schon aufgedeckt?
   *
   * Dasselbe Prinzip wie bei den Ausstiegen: Die Karte zeigt nur, wo jemand
   * schon war. Eine Minimap, die von Anfang an jeden Mini-Boss und den
   * Ende-Boss anzeigt, nimmt dem Erkunden seinen Sinn - man liefe die Punkte
   * ab wie eine Liste.
   */
  discovered: boolean;
}

/** Eine Zone, in der das Team den Run beenden kann. */
export interface ExtractionZone {
  position: Vec2;
  radius: number;
  /**
   * War schon einmal jemand nah genug dran, um sie zu sehen?
   *
   * DAS IST DIE ANTWORT AUF "AUSSTIEGE FINDET MAN NICHT". Ein Punkt, von dem
   * man nichts weiss, ist kein Angebot - er ist eine Falle, in die man
   * zufaellig hineinlaeuft oder eben nicht. Einmal entdeckt, zeigt der
   * Kompass am Bildschirmrand dorthin und die Karte merkt ihn sich.
   *
   * Nicht von Anfang an alle zeigen: Dann waere die Karte sofort geloest und
   * das Erkunden bedeutungslos. Entdecken ist der Fortschritt.
   *
   * Gehoert in die Simulation und nicht in die Darstellung, weil es im Koop
   * fuer ALLE gilt: Wer einen Ausstieg findet, findet ihn fuer das Team.
   */
  discovered: boolean;
}

/**
 * Wie ein Run ausgegangen ist.
 *
 * Frueher gab es nur "Game Over". Seit Phase 9 kann ein Run auch GUT enden,
 * und der Ergebnisbildschirm muss den Unterschied sagen koennen.
 */
export type RunOutcome = "wipe" | "extracted" | "bossDefeated";

export interface WorldState {
  /** Fortlaufende Nummer des Simulationsschritts. */
  tick: number;
  phase: RoundPhase;
  /**
   * Der Seed, aus dem die Karte entstanden ist.
   *
   * Steht im Weltzustand, damit man beim Nachstellen eines Fehlers dieselbe
   * Welt wiederbekommt - und damit ab Phase 15 ein gespeicherter Run die Karte
   * nicht mitspeichern muss, sondern neu erzeugen kann.
   */
  seed: number;
  /** Laufzeit des Runs in Sekunden. */
  runTime: number;
  /** Distanzzone, in der das Team gerade unterwegs ist (0 = sicherer Start). */
  zone: number;
  /** Tiefste je erreichte Zone. Daran haengt das Ergebnis. */
  deepestZone: number;
  /** Wie der Run ausgegangen ist. `null`, solange er laeuft. */
  outcome: RunOutcome | null;
  /** Die Boss-Stellen der Karte, aus dem Seed erzeugt. */
  encounters: EncounterSpot[];
  /** Die Ausstiegszonen der Karte, aus dem Seed erzeugt. */
  extractions: ExtractionZone[];
  /**
   * Index der Zone, in der das Team gerade gemeinsam steht, oder -1.
   * Dazu die schon abgelaufene Zeit in Sekunden.
   */
  extractionIndex: number;
  extractionProgress: number;
  score: number;
  players: PlayerState[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  /** Angekuendigte, aber noch nicht erschienene Gegner. */
  pendingSpawns: SpawnOrder[];
  /** Alles, was gerade in der Welt herumliegt und aufgehoben werden kann. */
  groundItems: GroundItem[];
  /** Fortlaufende Nummern fuer Bodenfunde und getragene Gegenstaende. */
  nextItemId: number;
  /** Alles, was Bewegung blockiert: Aussenmauern und Deckungsbloecke. */
  walls: Rect[];
  /** Buschfelder: Gegner sehen Spieler darin nicht. */
  bushes: Rect[];
  /**
   * Die Grundrisse der Gebaeude.
   *
   * Reine Anzeige- und Platzierungsinformation: Was wirklich blockiert, steht
   * als Wandsegmente in `walls`. Die Simulation liest diese Liste nicht -
   * saehe sie hier eine zweite Wahrheit ueber dieselben Mauern, wuerden beide
   * frueher oder spaeter auseinanderlaufen.
   */
  buildings: Rect[];
  bounds: Rect;
  /** Ereignisse dieses Ticks. Die Darstellung leert die Liste nach dem Auswerten. */
  events: GameEvent[];
  /** Zustand des Zufallsgenerators - damit Host und Client gleich rechnen. */
  rngState: number;
  nextEnemyId: number;
  nextProjectileId: number;
}
