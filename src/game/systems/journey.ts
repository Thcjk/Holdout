/**
 * Die Reise ueber die Routenkarte: losziehen zu einer gewaehlten Station,
 * ankommen, was jede Art von Station bringt (Ruine pluendern, Oase, Haendler,
 * Ereignis ...), und der Vorsprung vor der Armee.
 *
 * Ablauf an einer Station:
 *   Marsch → Ankunft → (Ruine: 25 s pluendern, die Festung steht) → Rast → Karte → Marsch …
 */

import { DECK_W, GROUND_BOTTOM, GROUND_TOP, OFFER_SIZE, STATION_BONUS, TICK } from "../constants";
import { ACTS, LEAD_AFTER_HORDE, LEAD_MAX, NODES } from "../data/acts";
import { generateMap } from "../map";
import { EVENTS, affordable } from "../data/events";
import { moduleHp } from "../data/modules";
import { BLIND_SPOT, insideRect } from "../fortress";
import { PART_IDS, PARTS } from "../data/parts";
import type { ChestState, MapNode, MarchState, PartId, PlayerState } from "../types";
import { clamp, earn, type World } from "../world";
import { repairAllModules, rollOffer } from "./modules";
import { equipPart } from "./players";

/** So lange dauert das Pluendern einer Ruine. */
export const LOOT_TIME = 20;
/** So lange muss man neben einer Truhe stehen, bis sie aufspringt. */
export const CHEST_TIME = 1;
export const CHEST_REACH = 28;
/** Was die Oase repariert und der Sturm an Fundstuecken bringt. */
export const OASIS_REPAIR = 150;
export const STORM_BONUS = 25;
/** Haendler: so viele Module im Angebot. */
export const TRADER_OFFER = 6;
/** So viele Truhen stehen in einer Ruine, und so oft liegt ein Teil darin. */
export const CHEST_COUNT = 5;
export const PART_CHANCE = 0.35;

/** Hitze: ab Stufe 6 weniger Truhen. */
function chestBonus(heat: number): number {
  return heat >= 6 ? -2 : 0;
}

/** Zufaellige verschiedene Teile; fuer einen Mech bevorzugt solche, die er schon hat (werden besser). */
function pickParts(w: World, count: number, owner?: PlayerState): PartId[] {
  const pool = [...PART_IDS];
  const result: PartId[] = [];
  while (result.length < count && pool.length > 0) {
    const index = Math.floor(w.rng() * pool.length);
    result.push(pool.splice(index, 1)[0]!);
  }
  if (owner && w.rng() < 0.3) {
    const own = owner.parts.arm?.id ?? owner.parts.back?.id;
    if (own && (owner.parts[PARTS[own].slot]?.level ?? 3) < 3) {
      result[0] = own;
    }
  }
  return result;
}

/** Marsch-Zustand fuer den Weg zu dieser Station. */
export function marchTo(w: World, node: MapNode, horde: boolean): MarchState {
  const spec = w.specFor(node, horde);
  return {
    index: node.layer - 1,
    count: w.state.map.layers - 1,
    station: node.name,
    length: spec.length,
    done: 0,
    spawnTimer: 2.5,
    boss: spec.boss ? "waiting" : "none",
    node: node.id,
    horde,
    storm: node.type === "sturm",
  };
}

/** Losziehen zur gewaehlten Station (ohne Wahl: die erste erreichbare). */
export function depart(w: World, nodeId?: number): void {
  const s = w.state;
  if (s.event) {
    return;
  }
  const here = s.map.nodes[s.at];
  if (!here || here.next.length === 0) {
    return;
  }
  const targetId = nodeId !== undefined && here.next.includes(nodeId) ? nodeId : here.next[0]!;
  const target = s.map.nodes[targetId]!;

  // Vorsprung: Ruinen, Haendler, Schrottfelder kosten Zeit, der Sturm haengt die Armee ab.
  const change = NODES[target.type].lead;
  if (change !== 0) {
    changeLead(w, change);
  }
  const horde = s.lead <= 0;
  if (horde) {
    // Die Armee hat aufgeholt: Dieser Marsch wird hart, danach ist man wieder etwas vorn.
    s.lead = LEAD_AFTER_HORDE;
    w.emit({ kind: "horde" });
  }
  s.march = marchTo(w, target, horde);
  s.phase = "march";
  s.warnings = [];
  if (target.type === "schrott") {
    scatterScrap(w);
  }
  w.emit({ kind: "depart", index: s.march.index });
}

export function changeLead(w: World, amount: number): void {
  const s = w.state;
  const before = s.lead;
  s.lead = clamp(s.lead + amount, 0, LEAD_MAX);
  if (s.lead !== before) {
    w.emit({ kind: "lead", amount: s.lead - before });
  }
}

/** Schrottfeld: Haufen liegen am Weg verteilt, man muss abspringen und sammeln. */
function scatterScrap(w: World): void {
  const s = w.state;
  const f = s.fort;
  const piles = 26;
  for (let i = 0; i < piles; i += 1) {
    const x = f.x + DECK_W + 200 + (i / piles) * s.march.length + (w.rng() - 0.5) * 60;
    let y = GROUND_TOP + 30 + w.rng() * (GROUND_BOTTOM - GROUND_TOP - 60);
    // Nicht unter das Deck - dort kaeme man schlecht heran.
    if (insideRect(BLIND_SPOT, DECK_W / 2, y - f.y)) {
      y = f.y + BLIND_SPOT.y1 + 20 + w.rng() * 60;
    }
    s.scrap.push({ id: s.nextId++, x, y, z: 0, value: 3 });
  }
}

/** Ziel erreicht. */
export function arrive(w: World): void {
  const s = w.state;
  const node = s.map.nodes[s.march.node]!;
  w.emit({ kind: "arrived", index: s.march.index });
  s.at = node.id;
  s.path.push(node.id);
  s.fort.slow = 0;
  s.restAt = node.name;
  if (s.march.horde) {
    s.stats.hordes += 1;
  }
  if (node.type === "boss" || node.next.length === 0) {
    clearField(w);
    // Naechster Akt? Dann beginnt eine neue Karte an diesem Ziel.
    const next = s.map.act + 1;
    if (node.type === "boss" && next < ACTS.length && !s.map.fixed) {
      startAct(w, next);
      return;
    }
    s.phase = "won";
    w.emit({ kind: "won" });
    return;
  }
  if (node.type === "ruine") {
    // Die Festung haelt an, die Armee laeuft weiter auf sie zu.
    s.phase = "loot";
    s.loot = { timer: LOOT_TIME, duration: LOOT_TIME };
    s.chests = makeChests(w, node.layer);
    w.emit({ kind: "loot" });
    return;
  }
  toRest(w);
}

/** Neuer Akt: neue Karte, Vorsprung wie am Anfang, Rast am Start (dem Ziel des alten Akts). */
function startAct(w: World, act: number): void {
  const s = w.state;
  const goal = s.map.nodes[s.at]?.name ?? "";
  s.map = generateMap(w.rng, act, goal);
  s.at = 0;
  s.path = [0];
  s.lead = Math.max(s.lead, s.leadStart);
  s.restAt = s.map.nodes[0]!.name;
  w.emit({ kind: "act", act });
  toRest(w);
}

/** Die Armee bleibt zurueck: alles vom Feld raeumen, was noch kaempft. */
function clearField(w: World): void {
  const s = w.state;
  s.enemies = [];
  s.shots = [];
  s.shells = [];
  s.enemyShots = [];
  s.warnings = [];
}

function toRest(w: World): void {
  const s = w.state;
  const node = s.map.nodes[s.at]!;
  clearField(w);
  s.phase = "rest";
  s.loot = null;
  s.chests = [];
  // Fundstuecke an der Station, alles wird heil, und ein neues Angebot.
  earn(s, STATION_BONUS);
  s.partOffer = [];
  repairAllModules(w);
  s.rerolls = 0;
  s.offer = rollOffer(w, w.modulePool(), node.type === "haendler" ? TRADER_OFFER : OFFER_SIZE);
  // Vorschau auf die erste moegliche Station (gewaehlt wird auf der Karte).
  const preview = s.map.nodes[node.next[0] ?? -1];
  if (preview) {
    s.march = marchTo(w, preview, false);
  }
  switch (node.type) {
    case "oase": {
      const before = s.fort.hull;
      s.fort.hull = Math.min(s.fort.hullMax, s.fort.hull + OASIS_REPAIR);
      w.emit({ kind: "repair", amount: s.fort.hull - before });
      break;
    }
    case "haendler":
      // Dazu zwei Teile fuer die Mechs.
      s.partOffer = pickParts(w, 2).map((id) => ({ id, cost: PARTS[id].cost }));
      break;
    case "sturm":
      earn(s, STORM_BONUS);
      w.emit({ kind: "bonus", text: `+${STORM_BONUS} Schrott aus dem Sturm` });
      break;
    case "ereignis": {
      const open = EVENTS.filter((e) => !s.seenEvents.includes(e.id));
      const pool = open.length > 0 ? open : EVENTS;
      const event = pool[Math.floor(w.rng() * pool.length)]!;
      s.seenEvents.push(event.id);
      s.event = { id: event.id };
      break;
    }
    default:
      break;
  }
}

// --- Ruine pluendern ---------------------------------------------------------------------------------

function makeChests(w: World, depth: number): ChestState[] {
  const s = w.state;
  const f = s.fort;
  const chests: ChestState[] = [];
  const count = Math.max(2, CHEST_COUNT + chestBonus(s.heat));
  for (let i = 0; i < count; i += 1) {
    // Rund um die Festung verteilt, nie unter dem Deck.
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 20; tries += 1) {
      x = f.x - 220 + w.rng() * (DECK_W + 440);
      y = GROUND_TOP + 40 + w.rng() * (GROUND_BOTTOM - GROUND_TOP - 80);
      const blocked =
        insideRect({ x0: -40, y0: -30, x1: DECK_W + 40, y1: 150 }, x - f.x, y - f.y) ||
        chests.some((c) => Math.hypot(c.x - x, c.y - y) < 90);
      if (!blocked) {
        break;
      }
    }
    chests.push({
      id: s.nextId++,
      x,
      y,
      progress: 0,
      value: 14 + Math.floor(w.rng() * 12) + depth * 2,
      opened: false,
    });
  }
  return chests;
}

export function updateLoot(w: World): void {
  const s = w.state;
  if (!s.loot) {
    return;
  }
  for (const chest of s.chests) {
    if (chest.opened) {
      continue;
    }
    const opener = s.players.find(
      (p) =>
        p.alive &&
        p.layer === "ground" &&
        !p.transition &&
        Math.hypot(p.x - chest.x, p.y - chest.y) < CHEST_REACH,
    );
    if (opener) {
      chest.progress = Math.min(1, chest.progress + TICK / CHEST_TIME);
      if (chest.progress >= 1) {
        openChest(w, chest, opener);
      }
    }
  }
  s.loot.timer -= TICK;
  if (s.loot.timer <= 0) {
    toRest(w);
  }
}

function openChest(w: World, chest: ChestState, opener: PlayerState | undefined): void {
  const s = w.state;
  chest.opened = true;
  s.stats.chests += 1;
  // Manchmal liegt ein Teil fuer den Mech darin (dann weniger Schrott).
  let value = chest.value;
  if (opener && w.rng() < PART_CHANCE) {
    const part = pickParts(w, 1, opener)[0];
    if (part) {
      equipPart(w, opener, part);
      value = Math.round(value / 2);
    }
  }
  // Der Inhalt springt heraus und muss noch aufgesammelt werden.
  const pieces = 3;
  for (let i = 0; i < pieces; i += 1) {
    const angle = (i / pieces) * Math.PI * 2 + w.rng();
    s.scrap.push({
      id: s.nextId++,
      x: chest.x + Math.cos(angle) * 16,
      y: chest.y + Math.sin(angle) * 10 + 6,
      z: 0,
      value: Math.ceil(value / pieces),
    });
  }
  w.emit({ kind: "chest", x: chest.x, y: chest.y, value });
}

// --- Ereignisse --------------------------------------------------------------------------------------

export function choose(w: World, option: number): void {
  const s = w.state;
  const event = s.event ? EVENTS.find((e) => e.id === s.event!.id) : undefined;
  const choice = event?.choices[option];
  if (!event || !choice || !affordable(choice, s.bank)) {
    return;
  }
  const effect = choice.effect;
  s.event = null;
  s.stats.events += 1;
  if (effect.scrap && effect.scrap > 0) {
    earn(s, effect.scrap);
  } else if (effect.scrap) {
    s.bank = Math.max(0, s.bank + effect.scrap);
  }
  if (effect.hullMax) {
    s.fort.baseHull += effect.hullMax;
    w.refreshFortress();
  }
  if (effect.hull) {
    s.fort.hull = clamp(s.fort.hull + effect.hull, 1, s.fort.hullMax);
  }
  if (effect.lead) {
    changeLead(w, effect.lead);
  }
  for (let i = 0; i < (effect.upgrade ?? 0); i += 1) {
    const options = s.modules.filter((m) => m.level < 3);
    const module = options[Math.floor(w.rng() * options.length)];
    if (module) {
      module.level += 1;
      module.hpMax = moduleHp(module.type, module.level);
      module.hp = module.hpMax;
      w.emit({ kind: "upgraded", uid: module.uid, type: module.type });
    } else {
      s.bank += 30;
    }
  }
  w.refreshFortress();
  w.emit({ kind: "choice", text: choice.result });
}
