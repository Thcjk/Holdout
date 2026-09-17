/**
 * Zufallszahlen, die sich wiederholen lassen.
 *
 * `Math.random()` waere hier falsch: Im Koop muessen Host und Client dieselbe
 * Folge bekommen, und ein fehlgeschlagener Test muss sich mit demselben Startwert
 * nachstellen lassen. Der Generator heisst Mulberry32 - klein, schnell, gut genug
 * fuer ein Spiel (nicht fuer Kryptografie).
 *
 * Der Zustand ist eine einzige Zahl und liegt im Weltzustand, damit er ueber das
 * Netz mitwandern kann.
 */

export interface RngHolder {
  rngState: number;
}

/** Naechste Zufallszahl zwischen 0 (einschliesslich) und 1 (ausschliesslich). */
export function nextRandom(holder: RngHolder): number {
  holder.rngState = (holder.rngState + 0x6d2b79f5) | 0;
  let t = holder.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Zufallszahl zwischen `min` und `max`. */
export function randomRange(holder: RngHolder, min: number, max: number): number {
  return min + nextRandom(holder) * (max - min);
}

/** Zufaellige ganze Zahl von 0 bis `count - 1`. */
export function randomIndex(holder: RngHolder, count: number): number {
  return Math.floor(nextRandom(holder) * count) % Math.max(1, count);
}
