/**
 * Zufall mit festem Startwert (mulberry32).
 *
 * Gleicher Startwert, gleicher Ablauf: Tests koennen eine Welle nachspielen,
 * und ein Fehler laesst sich mit seinem Startwert wiederfinden.
 */

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Eine ganze Zahl von `min` bis `max` (beide eingeschlossen). */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Ein zufaelliges Element. Die Liste darf nicht leer sein. */
export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)] as T;
}
