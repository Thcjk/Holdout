/**
 * Spielwerte aus der Adresszeile ueberschreiben - ohne neuen Build.
 *
 * Balancing lebt vom Ausprobieren, und ein Durchlauf von `npm run build` plus
 * Hochladen dauert Minuten. Auf dem Handy ist das der Unterschied zwischen
 * "zehn Werte an einem Abend probiert" und "zwei".
 *
 * Beispiele (alles hinter `?tune=`, mehrere mit Komma getrennt):
 *
 *   ?tune=characters.scout.health=3200
 *   ?tune=player.shootCooldown=0.1,enemies.runner.speed=140
 *   ?tune=supers.scout.invulnerableTime=0.5&debug=werte
 *
 * WICHTIG, und deshalb steht es auch im Spiel auf dem Bildschirm: Das gilt nur
 * fuer dieses eine Geraet. Im Koop rechnet der Host fuer alle - ein Client mit
 * eigenen Werten sagt seine eigene Bewegung falsch voraus und ruckelt. Zum
 * Ausprobieren also solo spielen.
 *
 * Absichtlich sehr einfach gehalten: Es werden nur Zahlen gesetzt, und nur
 * dort, wo vorher schon eine Zahl stand. Ein Tippfehler aendert damit nichts
 * und wird unten aufgelistet, statt still etwas kaputtzumachen.
 */

import { CHARACTERS, ENEMIES, LIMITS, PLAYER, PROJECTILE, SKILLS, SUPERS, WAVES } from "./balance";
import { CAMERA, TOUCH } from "./constants";

/** Die Wurzeln, unter denen gesucht wird. */
const ROOTS: Record<string, unknown> = {
  player: PLAYER,
  projectile: PROJECTILE,
  characters: CHARACTERS,
  supers: SUPERS,
  enemies: ENEMIES,
  waves: WAVES,
  skills: SKILLS,
  limits: LIMITS,
  // Auch das Steuerungsgefuehl laesst sich so ausprobieren, ohne neu zu bauen:
  // ?tune=touch.responseCurve=1.5,touch.stickRadius=70
  touch: TOUCH,
  camera: CAMERA,
};

/** Was tatsaechlich gesetzt wurde - fuer die Anzeige im Spiel. */
export const appliedTuning: string[] = [];

/** Was nicht gesetzt werden konnte, mit Grund. */
export const rejectedTuning: string[] = [];

function parseAssignments(raw: string): [string, string][] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const index = entry.indexOf("=");
      return index < 0
        ? (["", entry] as [string, string])
        : ([entry.slice(0, index).trim(), entry.slice(index + 1).trim()] as [string, string]);
    });
}

function applyOne(path: string, rawValue: string): void {
  const parts = path.split(".");
  const last = parts.pop();
  if (!last || parts.length === 0) {
    rejectedTuning.push(`${path}: kein gueltiger Pfad`);
    return;
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    rejectedTuning.push(`${path}: "${rawValue}" ist keine Zahl`);
    return;
  }

  let node: unknown = ROOTS[parts[0] as string];
  for (const part of parts.slice(1)) {
    if (typeof node !== "object" || node === null) {
      node = undefined;
      break;
    }
    node = (node as Record<string, unknown>)[part];
  }

  if (typeof node !== "object" || node === null) {
    rejectedTuning.push(`${path}: gibt es nicht`);
    return;
  }

  const target = node as Record<string, unknown>;
  // Nur ueberschreiben, wo vorher schon eine Zahl stand. Ein Tippfehler legt
  // damit kein neues Feld an, das nie jemand liest.
  if (typeof target[last] !== "number") {
    rejectedTuning.push(`${path}: keine Zahl an dieser Stelle`);
    return;
  }

  appliedTuning.push(`${path}: ${String(target[last])} -> ${value}`);
  target[last] = value;
}

/**
 * Liest `?tune=` und setzt die Werte. Muss laufen, BEVOR eine Runde startet -
 * `main.ts` ruft es ganz am Anfang.
 */
export function applyTuningFromUrl(): void {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(window.location.search).get("tune");
  } catch {
    return;
  }
  if (!raw) {
    return;
  }

  for (const [path, value] of parseAssignments(raw)) {
    applyOne(path, value);
  }
}
