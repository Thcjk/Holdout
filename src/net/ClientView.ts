/**
 * Die Sicht eines Clients auf die Welt des Hosts.
 *
 * Zwei Dinge machen den Unterschied zwischen "spielbar" und "unspielbar"
 * (Briefing, Abschnitt 6):
 *
 * 1. INTERPOLATION fuer alles, was der Host schickt. Zustaende kommen 15x pro
 *    Sekunde, gezeichnet wird 60x. Ohne Zwischenrechnung wuerden Gegner springen.
 *    Der Trick: absichtlich 100 ms in der Vergangenheit zeichnen - dann liegen
 *    immer zwei bekannte Zustaende vor, zwischen denen ueberblendet werden kann.
 *
 * 2. VORHERSAGE (Prediction) fuer die eigene Figur. Auf die Antwort des Hosts zu
 *    warten, wuerde sich wie ein Gummiband anfuehlen. Stattdessen bewegt sich die
 *    eigene Figur sofort - mit demselben Bewegungscode wie beim Host. Weicht der
 *    Host ab, wird sanft korrigiert statt hart gesetzt.
 */

import { unflattenPacked } from "../systems/backpackCodec";
import { reloadTimeOf } from "../systems/weapons";
import { TICK_MS, TICK_SECONDS } from "../config/constants";
import { stepPlayerMovement } from "../systems/movement";
import { createPlayer, createWorld, isInBush } from "../systems/world";
import type { PlayerSetup } from "../systems/world";
import type {
  EnemyState,
  GameEvent,
  InputState,
  PlayerState,
  ProjectileState,
  Vec2,
  WorldState,
} from "../systems/types";
import type { WorldView } from "./GameSession";
import { ENCOUNTER_STATUS_ORDER, ENEMY_TYPE_ORDER, INTERPOLATION_DELAY_MS } from "./protocol";
import type { NetEnemy, NetPlayer, StateMessage } from "./protocol";

/** Ab dieser Abweichung wird hart gesetzt statt sanft korrigiert. */
const SNAP_DISTANCE = 160;

/** Anteil des Fehlers, der pro Bild ausgeglichen wird. */
const CORRECTION_RATE = 0.18;

/** So viele Zustaende werden aufbewahrt - mehr als eine Sekunde braucht niemand. */
const MAX_SNAPSHOTS = 24;

interface Snapshot {
  receivedAt: number;
  message: StateMessage;
}

export class ClientView implements WorldView {
  readonly state: WorldState;
  readonly alpha = 0;
  pendingCount = 0;

  private readonly snapshots: Snapshot[] = [];
  /** Ereignisse, die zwischen zwei Bildern eingetroffen sind. */
  private readonly pendingEvents: GameEvent[] = [];
  /** Die Ereignisse des aktuellen Bildes - erst die Darstellung leert sie. */
  private frameEvents: GameEvent[] = [];
  private readonly playerById = new Map<string, PlayerState>();
  private readonly enemyById = new Map<number, EnemyState>();
  private readonly projectileById = new Map<number, ProjectileState>();

  /** Die selbst vorhergesagte eigene Figur. */
  private predicted: PlayerState;
  private accumulator = 0;

  constructor(
    private readonly selfId: string,
    setups: readonly PlayerSetup[],
    seed: number,
  ) {
    /*
     * DER SEED MUSS HIER ANKOMMEN - sonst baut der Client eine andere Welt.
     *
     * Hier stand frueher `createWorld(setups)`, also der Standardwert 1. Das
     * war harmlos, solange die Arena eine Konstante war: Jeder hatte dieselben
     * zwoelf Rechtecke, egal welcher Seed. Seit Phase 8 entsteht die Karte aus
     * dem Seed - mit dem falschen Wert liefe dieser Spieler gegen unsichtbare
     * Waende, waehrend die anderen ihn durch Deckung laufen saehen. Uebertragen
     * wird die Karte nie, nur diese eine Zahl.
     */
    // Dasselbe Gebiet wie der Host (`HostSession`): erster Kampfknoten.
    this.state = createWorld(setups, seed, { nodeId: null });
    for (const player of this.state.players) {
      this.playerById.set(player.id, player);
    }

    const own = this.state.players.find((entry) => entry.id === selfId);
    const index = setups.findIndex((entry) => entry.id === selfId);
    this.predicted =
      own ??
      createPlayer(
        setups[Math.max(0, index)] as PlayerSetup,
        0,
        setups.length,
        this.spawnOrigin(),
      );
  }

  get events(): readonly GameEvent[] {
    return this.frameEvents;
  }

  /** Ein Zustandspaket des Hosts einsortieren. */
  pushState(message: StateMessage): void {
    const last = this.snapshots[this.snapshots.length - 1];
    if (last && message.tick <= last.message.tick) {
      // Veraltetes Paket - bei unzuverlaessigem Versand kommt das vor.
      return;
    }

    this.snapshots.push({ receivedAt: performance.now(), message });
    while (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots.shift();
    }
  }

  pushEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      this.pendingEvents.push(event);
    }
  }

  /** Ein Bild weiterdrehen: vorhersagen, dann die empfangene Welt aufbauen. */
  advance(deltaMs: number, input: InputState): boolean {
    // Alles, was seit dem letzten Bild eingetroffen ist, gilt jetzt. Erst hier
    // umzuhaengen verhindert, dass ein Ereignis zwischen zwei Bildern verloren geht.
    this.frameEvents = this.pendingEvents.splice(0, this.pendingEvents.length);

    const ticks = this.predict(deltaMs, input);
    this.rebuild();
    return ticks > 0;
  }

  renderPlayerPosition(playerId: string): Vec2 {
    const player = this.playerById.get(playerId);
    return player ? { ...player.position } : { x: 0, y: 0 };
  }

  renderEnemyPosition(_enemyId: number, current: Vec2): Vec2 {
    // Die Zwischenrechnung ist bereits passiert - hier steht schon die Position,
    // die gezeichnet werden soll.
    return current;
  }

  renderProjectilePosition(position: Vec2): Vec2 {
    return position;
  }

  /**
   * Vorhersage der eigenen Figur mit demselben festen Zeitschritt wie beim Host.
   * Derselbe Code, dieselben Werte - deshalb liegt das Ergebnis meistens richtig.
   */
  private predict(deltaMs: number, input: InputState): number {
    this.accumulator += deltaMs;
    let ticks = 0;

    while (this.accumulator >= TICK_MS && ticks < 5) {
      stepPlayerMovement(this.predicted, input, this.state.walls, TICK_SECONDS);
      this.predicted.inBush = isInBush(this.state, this.predicted.position);
      if (input.aim) {
        this.predicted.facing = { ...input.aim };
      } else if (Math.hypot(input.move.x, input.move.y) > 1e-6) {
        const length = Math.hypot(input.move.x, input.move.y);
        this.predicted.facing = { x: input.move.x / length, y: input.move.y / length };
      }
      this.accumulator -= TICK_MS;
      ticks += 1;
    }

    if (this.accumulator < 0) {
      this.accumulator = 0;
    }

    this.reconcile();
    return ticks;
  }

  /** Abgleich mit der Wahrheit des Hosts. */
  private reconcile(): void {
    const latest = this.snapshots[this.snapshots.length - 1];
    const authoritative = latest?.message.players.find((entry) => entry.id === this.selfId);
    if (!authoritative) {
      return;
    }

    const dx = authoritative.x - this.predicted.position.x;
    const dy = authoritative.y - this.predicted.position.y;
    const error = Math.hypot(dx, dy);

    if (error > SNAP_DISTANCE || authoritative.down) {
      // So weit auseinander heisst: Der Host weiss etwas, das wir nicht wussten
      // (Rueckstoss, Dash, Tod). Dann ist ein Sprung ehrlicher als ein Nachziehen.
      this.predicted.position.x = authoritative.x;
      this.predicted.position.y = authoritative.y;
      this.predicted.velocity.x = 0;
      this.predicted.velocity.y = 0;
      return;
    }

    this.predicted.position.x += dx * CORRECTION_RATE;
    this.predicted.position.y += dy * CORRECTION_RATE;
  }

  /** Baut aus zwei Zustandspaketen das Bild, das gezeichnet wird. */
  private rebuild(): void {
    const pair = this.findSnapshotPair();
    if (!pair) {
      return;
    }

    const { from, to, t } = pair;

    this.state.tick = to.tick;
    this.state.zone = to.zone;
    this.state.deepestZone = to.deepestZone;
    this.state.score = to.score;
    this.state.phase = to.phase;
    this.state.runTime = to.runTime;
    this.state.extractionIndex = to.extractionIndex;
    this.state.extractionProgress = to.extractionProgress;
    // Die Positionen der Encounter stehen schon aus dem Seed fest; vom Host
    // kommt nur, was daraus geworden ist.
    to.encounters.forEach((status, index) => {
      const spot = this.state.encounters[index];
      if (spot) {
        spot.status = ENCOUNTER_STATUS_ORDER[status] ?? "sleeping";
      }
    });
    // Entdeckte Ausstiege: Der Host sagt, welche bekannt sind. Nur setzen,
    // nie zuruecksetzen - ein Kompass, der wieder vergisst, waere schlimmer
    // als keiner, und ein verlorenes Paket duerfte das nicht ausloesen.
    for (const index of to.found) {
      const zone = this.state.extractions[index];
      if (zone) {
        zone.discovered = true;
      }
    }
    for (const index of to.seen) {
      const spot = this.state.encounters[index];
      if (spot) {
        spot.discovered = true;
      }
    }
    /*
     * Bodenfunde: Der Host sagt, was daliegt - der Client rechnet NICHTS
     * voraus. Ein Gegenstand, der aufploppt und wieder verschwindet, weil
     * jemand anderes schneller war, saehe nach einem Fehler aus.
     *
     * Die Liste wird komplett neu aufgebaut statt abgeglichen: Bodenfunde
     * bewegen sich nicht, es gibt also nichts zu interpolieren, und bei
     * hoechstens ein paar Dutzend Eintraegen ist das billiger als ein
     * Vergleich Eintrag fuer Eintrag.
     */
    this.state.groundItems.length = 0;
    for (const item of to.items) {
      this.state.groundItems.push({
        id: item.id,
        def: item.def,
        position: { x: item.x, y: item.y },
        lifetime: Number.POSITIVE_INFINITY,
        fromWorld: false,
      });
    }

    this.pendingCount = to.pending;

    this.rebuildPlayers(from, to, t);
    this.rebuildEnemies(from, to, t);
    this.rebuildProjectiles(to, t);
  }

  /**
   * Sucht die beiden Zustaende, zwischen denen die Darstellungszeit liegt.
   * Die Darstellungszeit ist absichtlich 100 ms alt - siehe Kommentar oben.
   */
  private findSnapshotPair(): { from: StateMessage; to: StateMessage; t: number } | null {
    if (this.snapshots.length === 0) {
      return null;
    }
    const newest = this.snapshots[this.snapshots.length - 1];
    if (!newest) {
      return null;
    }
    if (this.snapshots.length === 1) {
      return { from: newest.message, to: newest.message, t: 0 };
    }

    const renderTime = performance.now() - INTERPOLATION_DELAY_MS;

    for (let i = this.snapshots.length - 1; i > 0; i -= 1) {
      const later = this.snapshots[i];
      const earlier = this.snapshots[i - 1];
      if (!later || !earlier) {
        continue;
      }
      if (earlier.receivedAt <= renderTime && renderTime <= later.receivedAt) {
        const span = later.receivedAt - earlier.receivedAt;
        const t = span > 0 ? (renderTime - earlier.receivedAt) / span : 1;
        return { from: earlier.message, to: later.message, t };
      }
    }

    // Die Darstellungszeit liegt hinter allen Paketen (Verbindung stockt) -
    // dann lieber den letzten bekannten Zustand zeigen als zu raten.
    return { from: newest.message, to: newest.message, t: 0 };
  }

  private rebuildPlayers(from: StateMessage, to: StateMessage, t: number): void {
    const players: PlayerState[] = [];

    for (const netPlayer of to.players) {
      const player = this.ensurePlayer(netPlayer);
      const previous = from.players.find((entry) => entry.id === netPlayer.id);

      if (netPlayer.id === this.selfId) {
        // Eigene Figur: die Vorhersage, nicht der verzoegerte Zustand.
        player.position.x = this.predicted.position.x;
        player.position.y = this.predicted.position.y;
        player.facing = { ...this.predicted.facing };
      } else {
        player.position.x = lerp(previous?.x ?? netPlayer.x, netPlayer.x, t);
        player.position.y = lerp(previous?.y ?? netPlayer.y, netPlayer.y, t);
        player.facing.x = netPlayer.fx;
        player.facing.y = netPlayer.fy;
      }

      player.health = netPlayer.hp;
      player.maxHealth = netPlayer.maxHp;
      player.superCharge = netPlayer.superCharge;
      player.down = netPlayer.down;
      player.reviveProgress = netPlayer.revive;
      player.invulnerable = netPlayer.inv;
      player.healField = netPlayer.hf ?? 0;

      /*
       * Der Rucksack kommt vollstaendig vom Host und wird hier neu aufgebaut.
       *
       * NEU AUFGEBAUT statt abgeglichen: Ein Rucksack aendert sich selten und
       * hat hoechstens ein paar Dutzend Eintraege - ein Vergleich Eintrag fuer
       * Eintrag waere mehr Code fuer weniger Verlaesslichkeit. Und vorhergesagt
       * wird hier nichts: Ob etwas hineinpasst, entscheidet der Host.
       */
      player.backpack.items.length = 0;
      unflattenPacked(netPlayer.bp).forEach((entry, index) => {
        player.backpack.items.push({
          item: { id: index + 1, def: entry.def, starter: entry.starter, equipped: entry.equipped },
          x: entry.x,
          y: entry.y,
          rotated: entry.rotated,
        });
      });

      // Nachladeuhren gibt es auf dem Client nicht - nur die Anzahl voller
      // Ladungen. Das HUD braucht nicht mehr.
      // Die Nachladezeit haengt an der Waffe - der Rucksack steht oben schon.
      const reloadTime = reloadTimeOf(player) || 1;
      for (let i = 0; i < player.reloadTimers.length; i += 1) {
        player.reloadTimers[i] = i < netPlayer.ammo ? 0 : reloadTime * 0.5;
      }

      players.push(player);
    }

    this.state.players = players;
  }

  /**
   * Der Startpunkt der generierten Welt - die Mitte der Karte.
   *
   * Nur ein Platzhalter fuer neu auftauchende Figuren: Ihre echte Position
   * kommt im naechsten Zustandspaket vom Host.
   */
  private spawnOrigin(): Vec2 {
    return { x: this.state.bounds.width / 2, y: this.state.bounds.height / 2 };
  }

  private ensurePlayer(netPlayer: NetPlayer): PlayerState {
    const existing = this.playerById.get(netPlayer.id);
    if (existing) {
      return existing;
    }

    const created = createPlayer(
      { id: netPlayer.id, name: netPlayer.name, character: netPlayer.character },
      0,
      1,
      this.spawnOrigin(),
    );
    this.playerById.set(netPlayer.id, created);
    return created;
  }

  private rebuildEnemies(from: StateMessage, to: StateMessage, t: number): void {
    const enemies: EnemyState[] = [];
    const seen = new Set<number>();

    for (const netEnemy of to.enemies) {
      const enemy = this.ensureEnemy(netEnemy);
      const previous = from.enemies.find((entry) => entry.id === netEnemy.id);

      enemy.position.x = lerp(previous?.x ?? netEnemy.x, netEnemy.x, t);
      enemy.position.y = lerp(previous?.y ?? netEnemy.y, netEnemy.y, t);
      enemy.velocity.x = netEnemy.vx;
      enemy.velocity.y = netEnemy.vy;
      enemy.health = netEnemy.hp;
      enemy.maxHealth = netEnemy.maxHp;
      enemy.radius = netEnemy.radius;
      enemy.isBoss = netEnemy.boss;
      enemy.marked = netEnemy.marked ? 1 : 0;
      enemy.stunned = netEnemy.stunned ? 1 : 0;

      seen.add(netEnemy.id);
      enemies.push(enemy);
    }

    for (const id of [...this.enemyById.keys()]) {
      if (!seen.has(id)) {
        this.enemyById.delete(id);
      }
    }

    this.state.enemies = enemies;
  }

  private ensureEnemy(netEnemy: NetEnemy): EnemyState {
    const existing = this.enemyById.get(netEnemy.id);
    if (existing) {
      return existing;
    }

    const created: EnemyState = {
      id: netEnemy.id,
      type: ENEMY_TYPE_ORDER[netEnemy.type] ?? "runner",
      rooted: 0,
      position: { x: netEnemy.x, y: netEnemy.y },
      velocity: { x: netEnemy.vx, y: netEnemy.vy },
      radius: netEnemy.radius,
      health: netEnemy.hp,
      maxHealth: netEnemy.maxHp,
      speed: 0,
      contactDamage: 0,
      // Der Client rechnet keinen Schaden - das macht der Host. Der Wert ist
      // nur da, damit das Datenobjekt vollstaendig ist.
      damageMultiplier: 1,
      scoreValue: 0,
      isBoss: netEnemy.boss,
      scale: netEnemy.boss ? 2 : 1,
      stunned: 0,
      marked: 0,
      shootCooldown: 0,
      contactCooldown: 0,
      stuckTime: 0,
    };

    this.enemyById.set(netEnemy.id, created);
    return created;
  }

  /**
   * Projektile werden nicht zwischen zwei Paketen gemittelt, sondern aus der
   * letzten bekannten Position weitergerechnet: Sie fliegen geradlinig, und ein
   * Nachlaufen waere deutlicher zu sehen als ein kleiner Vorlauf.
   */
  private rebuildProjectiles(to: StateMessage, t: number): void {
    const projectiles: ProjectileState[] = [];
    const seen = new Set<number>();

    for (const netProjectile of to.projectiles) {
      const existing = this.projectileById.get(netProjectile.id) ?? {
        id: netProjectile.id,
        active: true,
        owner: netProjectile.enemy ? ("enemy" as const) : ("player" as const),
        ownerId: "",
        position: { x: netProjectile.x, y: netProjectile.y },
        velocity: { x: netProjectile.vx, y: netProjectile.vy },
        radius: netProjectile.radius,
        damage: 0,
        rangeLeft: 1,
        piercing: false,
        effect: "none" as const,
        blastRadius: 0,
        blastDamage: 0,
        hitEnemies: [],
      };

      existing.active = true;
      existing.owner = netProjectile.enemy ? "enemy" : "player";
      existing.radius = netProjectile.radius;
      existing.velocity.x = netProjectile.vx;
      existing.velocity.y = netProjectile.vy;
      existing.position.x = netProjectile.x + netProjectile.vx * t * TICK_SECONDS;
      existing.position.y = netProjectile.y + netProjectile.vy * t * TICK_SECONDS;

      this.projectileById.set(netProjectile.id, existing);
      seen.add(netProjectile.id);
      projectiles.push(existing);
    }

    for (const id of [...this.projectileById.keys()]) {
      if (!seen.has(id)) {
        this.projectileById.delete(id);
      }
    }

    this.state.projectiles = projectiles;
  }
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.max(0, Math.min(1, t));
}

/** Nur fuer Tests: wie weit die Vorhersage vom Host abweichen darf. */
export const PREDICTION_SNAP_DISTANCE = SNAP_DISTANCE;
