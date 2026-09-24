/**
 * Der Weltzustand und sein Fortschreiten um genau einen Tick.
 *
 * Das ist das Herz der Architektur-Grundregel: Alles, was passiert, passiert hier
 * auf reinen Datenobjekten. Die Szene liest diesen Zustand nur aus und zeichnet ihn.
 *
 * Die Reihenfolge der Schritte ist bewusst gewaehlt: erst bewegen sich die
 * Spieler, dann schiessen sie, dann handeln die Gegner, dann fliegen die
 * Projektile. So trifft ein Schuss die Gegnerposition dieses Ticks und nicht die
 * des letzten.
 */

import { CHARACTERS, PLAYER } from "../config/balance";
import { stepReload, stepRevive, tryShoot } from "./combat";
import { stepEnemies } from "./enemies";
import { clampToArena, stepPlayerMovement } from "./movement";
import { stepProjectiles } from "./projectiles";
import { stepAbilities, stepHealFields, tryAbility } from "./abilities";
import { stepDashDamage, trySuper } from "./supers";
import { stepEncounters } from "./encounters";
import { applyInventoryCommand, stepLoot } from "./loot";
import { createGrid, findFreeSpot, place } from "./InventoryGridSystem";
import { stepRound } from "./spawning";
import { gameplaySeed, generateWorld } from "./WorldGenerator";
import { generateNodeArena } from "./NodeArenaGenerator";
import { settleEquipped } from "./weapons";
import { emptyInput } from "./types";
import type {
  CharacterId,
  InputState,
  InventoryGrid,
  ItemInstance,
  PackedItem,
  PlayerState,
  Vec2,
  WorldState,
} from "./types";

export interface PlayerSetup {
  id: string;
  name: string;
  character: CharacterId;
  /**
   * Was dieser Spieler vor dem Run eingepackt hat.
   *
   * Reist den ganzen Weg mit: Loadout-Bildschirm -> Sitzung -> `createWorld`.
   * Im Koop geht die Liste im `hello` des Clients an den Host und von dort im
   * `start` an alle - so baut jedes Geraet denselben Rucksack auf, ohne dass
   * waehrend des Runs Inhalte uebertragen werden muessten.
   *
   * Fehlt sie, startet man mit leerem Rucksack. Das ist kein Fehlerfall: Wer
   * direkt ins Spiel springt (etwa aus dem Ergebnisbildschirm), soll nicht
   * daran scheitern.
   */
  backpack?: readonly PackedItem[];
}

/**
 * Startpositionen im Kreis um den Startpunkt, damit mehrere Spieler nicht
 * uebereinander stehen.
 *
 * Der Startpunkt wird uebergeben statt importiert: Seit Phase 8 steht er nicht
 * mehr fest in einer Konstanten, sondern kommt aus der generierten Welt.
 */
function spawnPosition(index: number, total: number, origin: Vec2): Vec2 {
  if (total <= 1) {
    return { x: origin.x, y: origin.y };
  }
  const angle = (index / total) * Math.PI * 2;
  const offset = 70;
  return {
    x: origin.x + Math.cos(angle) * offset,
    y: origin.y + Math.sin(angle) * offset,
  };
}

/**
 * Baut den Rucksack aus dem, was vor dem Run gepackt wurde.
 *
 * Die ANORDNUNG wird uebernommen, nicht neu gesucht: Der Spieler hat sie
 * gerade von Hand gelegt, und ein Rucksack, der sich beim Start selbst
 * umsortiert, waere eine kleine Unverschaemtheit.
 *
 * Passt ein Eintrag trotzdem nicht - etwa weil sich die Gittergroesse oder
 * eine Itemform geaendert hat -, sucht `findFreeSpot` einen Platz. Erst wenn
 * auch das scheitert, faellt er weg. Lieber ein Gegenstand weniger als ein
 * Rucksack, der nicht aufgebaut werden kann.
 */
function buildBackpack(packed: readonly PackedItem[] | undefined): InventoryGrid {
  const grid = createGrid();
  if (!packed) {
    return grid;
  }

  let nextId = 1;
  for (const entry of packed) {
    const item: ItemInstance = {
      id: nextId++,
      def: entry.def,
      starter: entry.starter === true,
      equipped: entry.equipped === true,
    };
    if (place(grid, item, entry.x, entry.y, entry.rotated)) {
      continue;
    }
    const spot = findFreeSpot(grid, entry.def);
    if (spot) {
      place(grid, item, spot.x, spot.y, spot.rotated);
    }
  }

  // Eingepackte Waffe ohne Haken (aeltere Clients, Tests): die erste nehmen.
  settleEquipped(grid);
  return grid;
}

export function createPlayer(
  setup: PlayerSetup,
  index: number,
  total: number,
  origin: Vec2,
): PlayerState {
  const definition = CHARACTERS[setup.character];
  const position = spawnPosition(index, total, origin);

  return {
    id: setup.id,
    name: setup.name,
    character: setup.character,
    position,
    velocity: { x: 0, y: 0 },
    radius: PLAYER.radius,
    facing: { x: 0, y: 1 },
    health: definition.health,
    maxHealth: definition.health,
    reloadTimers: new Array<number>(PLAYER.ammoCharges).fill(0),
    superCharge: 0,
    superWasReady: false,
    down: false,
    reviveProgress: 0,
    invulnerable: 0,
    dashTime: 0,
    dashDirection: { x: 0, y: 0 },
    dashHits: [],
    inBush: false,
    shootCooldown: 0,
    abilityCooldown: 0,
    healField: 0,
    healFieldPending: {},
    backpack: buildBackpack(setup.backpack),
  };
}

/**
 * Wo ein Run spielt.
 *
 *   "open"                   die offene Welt (Phase 8/9) - in Tests und
 *                            ueber `?welt=offen` (nur solo)
 *   { nodeId: number|null }  das Gebiet eines Knotens der Knoten-Karte zu
 *                            diesem Seed; `null` = der erste Kampfknoten
 *
 * Host und Clients muessen hier dasselbe angeben, sonst bauen sie
 * verschiedene Karten. Deshalb nimmt der Koop immer `{ nodeId: null }`.
 */
export type WorldPlace = "open" | { nodeId: number | null };

/**
 * Baut eine frische Welt aus einem Seed.
 *
 * WICHTIG FUER DEN KOOP: Host und Client rufen das mit DERSELBEN Zahl auf und
 * bekommen dadurch dieselbe Karte. Uebertragen wird die Karte nie - dafuer
 * waere sie viel zu gross. Wer diesen Aufruf ohne Seed macht, bekommt die Welt
 * zu Seed 1 und damit eine andere als alle anderen.
 */
export function createWorld(
  setups: readonly PlayerSetup[],
  seed = 1,
  where: WorldPlace = "open",
): WorldState {
  // Offene Welt oder Gebiet eines Knotens - beide im selben Format, die
  // Simulation darunter ist dieselbe.
  const arena = where === "open" ? null : generateNodeArena(seed, where.nodeId ?? undefined);
  const world = arena ?? generateWorld(seed);

  return {
    tick: 0,
    // Es gibt keinen Countdown mehr: Der Start liegt in einer sicheren Zone,
    // man kann also sofort losgehen, ohne ins Gefecht zu fallen.
    phase: "running",
    seed: seed | 0,
    runTime: 0,
    zone: 0,
    deepestZone: 0,
    outcome: null,
    score: 0,
    players: setups.map((setup, index) =>
      createPlayer(setup, index, setups.length, world.spawnPoint),
    ),
    enemies: [],
    projectiles: [],
    pendingSpawns: [],
    groundItems: [...world.lootSpots],
    nextItemId: world.nextItemId,
    walls: world.walls,
    bushes: world.bushes,
    buildings: world.buildings,
    bounds: world.bounds,
    fixedZone: arena?.fixedZone,
    safeRadius: arena?.safeRadius,
    props: arena?.props ?? [],
    encounters: world.encounters,
    extractions: world.extractions,
    extractionIndex: -1,
    extractionProgress: 0,
    events: [],
    // Eigener Strom, getrennt von dem der Weltgenerierung - siehe
    // `WorldGenerator.ts`, Abschnitt "Zwei Zufallsstroeme aus einem Seed".
    rngState: gameplaySeed(seed),
    nextEnemyId: 1,
    nextProjectileId: 1,
  };
}

/** Steht ein Punkt in einem der Buschfelder? */
export function isInBush(state: WorldState, position: Vec2): boolean {
  for (const bush of state.bushes) {
    if (
      position.x >= bush.x &&
      position.x <= bush.x + bush.width &&
      position.y >= bush.y &&
      position.y <= bush.y + bush.height
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Ein Simulationsschritt. `dt` ist immer derselbe feste Wert (TICK_SECONDS) -
 * das ist der ganze Punkt am festen Zeitschritt.
 */
export function stepWorld(
  state: WorldState,
  inputs: ReadonlyMap<string, InputState>,
  dt: number,
): void {
  // Ereignisse des vorherigen Ticks sind ausgewertet.
  state.events.length = 0;

  // Nach dem Rundenende steht die Welt still; nur der Tickzaehler laeuft weiter,
  // damit die Darstellung ihre Effekte zu Ende spielen kann.
  if (state.phase === "ended") {
    state.tick += 1;
    return;
  }

  for (const player of state.players) {
    const input = inputs.get(player.id) ?? emptyInput();


    stepReload(player, dt);
    stepPlayerMovement(player, input, state.walls, dt);
    // Notbremse gegen das Durchschlagen der Aussenmauer bei hohem Tempo.
    clampToArena(player.position, player.radius, state.bounds);
    updateFacing(player, input);
    player.inBush = isInBush(state, player.position);
    trySuper(state, player, input);
    tryAbility(state, player, input);
    stepDashDamage(state, player);
    tryShoot(state, player, input);
    // Rucksack-Befehle gehen auch am Boden: Umraeumen braucht keine Haende,
    // die gerade schiessen koennen, und wer liegt, hat Zeit dafuer.
    if (input.inventory) {
      applyInventoryCommand(state, player, input.inventory);
    }
  }

  stepAbilities(state, dt);
  stepHealFields(state, dt);
  stepEnemies(state, dt);
  stepProjectiles(state, dt);
  stepRevive(state, dt);
  /*
   * Loot NACH den Projektilen und VOR dem Rundenablauf.
   *
   * Nach den Projektilen, weil ein Gegner, der in diesem Tick stirbt, sein
   * Loot sofort fallen laesst - es liegt dann schon da, wenn man einen
   * Schritt weiter geht.
   *
   * Vor `stepRound`, weil dort `despawnDistant` laeuft: Die Reihenfolge ist
   * nur der Ordnung halber so, Bodenfunde sind vom Despawn ohnehin nicht
   * betroffen.
   */
  stepLoot(state, dt);
  stepRound(state, dt);
  // Nach dem Rundenablauf: Ein Team, das gerade zu Boden gegangen ist, soll
  // nicht im selben Tick noch extrahieren.
  stepEncounters(state, dt);

  state.tick += 1;
}

/**
 * Blickrichtung: Wer zielt, schaut dorthin. Wer nur laeuft, schaut in
 * Laufrichtung. Wer steht, behaelt die letzte Richtung - sonst wuerde die Figur
 * beim Stehenbleiben nach Norden schnappen.
 */
function updateFacing(player: PlayerState, input: InputState): void {
  if (input.aim) {
    const length = Math.hypot(input.aim.x, input.aim.y);
    if (length > 1e-6) {
      player.facing.x = input.aim.x / length;
      player.facing.y = input.aim.y / length;
      return;
    }
  }

  const moveLength = Math.hypot(input.move.x, input.move.y);
  if (moveLength > 1e-6) {
    player.facing.x = input.move.x / moveLength;
    player.facing.y = input.move.y / moveLength;
  }
}
