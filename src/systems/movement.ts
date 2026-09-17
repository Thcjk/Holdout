/**
 * Bewegung eines Spielers fuer genau einen Simulationsschritt.
 *
 * Kein Phaser, keine Sprites - nur Zahlen. Dadurch ist das Bewegungsgefuehl
 * testbar (siehe tests/systems/) und im Koop auf Host und Client identisch.
 */

import { PLAYER } from "../config/balance";
import { resolveAgainstWalls } from "./collision";
import type { InputState, PlayerState, Rect, Vec2 } from "./types";

/** Laenge eines Vektors auf hoechstens 1 begrenzen (diagonal nicht schneller laufen). */
export function normalizeInput(move: Vec2): Vec2 {
  const length = Math.hypot(move.x, move.y);
  if (length <= 1e-6) {
    return { x: 0, y: 0 };
  }
  if (length <= 1) {
    return { x: move.x, y: move.y };
  }
  return { x: move.x / length, y: move.y / length };
}

/**
 * Bewegt `value` um hoechstens `maxDelta` in Richtung `target`.
 * So wird Vollgeschwindigkeit nach einer festen Zeit erreicht, unabhaengig von
 * der Bildrate - im Gegensatz zu einer Multiplikation wie `v *= 0.9`.
 */
function moveTowards(value: number, target: number, maxDelta: number): number {
  const difference = target - value;
  if (Math.abs(difference) <= maxDelta) {
    return target;
  }
  return value + Math.sign(difference) * maxDelta;
}

/**
 * Ein Bewegungsschritt: beschleunigen, verschieben, an Waenden abfangen.
 *
 * @param dt Laenge des Simulationsschritts in Sekunden (fest, siehe constants.ts).
 */
export function stepPlayerMovement(
  player: PlayerState,
  input: InputState,
  walls: readonly Rect[],
  dt: number,
): void {
  const direction = normalizeInput(input.move);

  // Beschleunigung in Pixel pro Sekunde im Quadrat: In `accelerationTime`
  // Sekunden von 0 auf Vollgeschwindigkeit. Dasselbe gilt beim Abbremsen.
  const acceleration = PLAYER.speed / PLAYER.accelerationTime;
  const maxDelta = acceleration * dt;

  const targetVelocityX = direction.x * PLAYER.speed;
  const targetVelocityY = direction.y * PLAYER.speed;

  player.velocity.x = moveTowards(player.velocity.x, targetVelocityX, maxDelta);
  player.velocity.y = moveTowards(player.velocity.y, targetVelocityY, maxDelta);

  player.position.x += player.velocity.x * dt;
  player.position.y += player.velocity.y * dt;

  resolveAgainstWalls(player.position, player.velocity, player.radius, walls);
}
