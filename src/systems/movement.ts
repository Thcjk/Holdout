/**
 * Bewegung eines Spielers fuer genau einen Simulationsschritt.
 *
 * Kein Phaser, keine Sprites - nur Zahlen. Dadurch ist das Bewegungsgefuehl
 * testbar (siehe tests/systems/) und im Koop auf Host und Client identisch.
 */

import { PLAYER, SUPERS } from "../config/balance";
import { speedFor } from "./skills";
import { moveAndCollide } from "./collision";
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
  // Ein Spieler am Boden bleibt liegen, bis ihn jemand wiederbelebt.
  if (player.down) {
    player.velocity.x = 0;
    player.velocity.y = 0;
    return;
  }

  if (player.dashTime > 0) {
    stepDash(player, walls, dt);
    return;
  }

  const speed = speedFor(player);
  const direction = normalizeInput(input.move);

  // Beschleunigung in Pixel pro Sekunde im Quadrat: In `accelerationTime`
  // Sekunden von 0 auf Vollgeschwindigkeit. Dasselbe gilt beim Abbremsen.
  const acceleration = speed / PLAYER.accelerationTime;
  const maxDelta = acceleration * dt;

  player.velocity.x = moveTowards(player.velocity.x, direction.x * speed, maxDelta);
  player.velocity.y = moveTowards(player.velocity.y, direction.y * speed, maxDelta);

  // Getrennt nach Achsen, damit die Figur an Waenden entlanggleitet, statt
  // stehenzubleiben - siehe moveAndCollide.
  moveAndCollide(player.position, player.velocity, player.radius, walls, dt);
}

/**
 * Waehrend des Scout-Supers: fester Kurs mit hohem Tempo, keine Steuerung.
 * Eine Wand beendet den Dash sofort, sonst bliebe die Figur daran kleben.
 */
function stepDash(player: PlayerState, walls: readonly Rect[], dt: number): void {
  const dashSpeed = SUPERS.scout.speed;
  player.velocity.x = player.dashDirection.x * dashSpeed;
  player.velocity.y = player.dashDirection.y * dashSpeed;

  const beforeX = player.position.x;
  const beforeY = player.position.y;

  moveAndCollide(player.position, player.velocity, player.radius, walls, dt);

  const movedX = player.position.x - beforeX;
  const movedY = player.position.y - beforeY;
  const blocked = Math.hypot(movedX, movedY) < dashSpeed * dt * 0.5;

  player.dashTime -= dt;
  if (blocked || player.dashTime <= 0) {
    player.dashTime = 0;
    // Nach dem Dash nicht mit voller Dashgeschwindigkeit weiterschlittern.
    const speed = speedFor(player);
    player.velocity.x = player.dashDirection.x * speed;
    player.velocity.y = player.dashDirection.y * speed;
  }
}

/**
 * Die letzte Notbremse: niemand verlaesst die Arena.
 *
 * Die Aussenmauern sind 40 Pixel dick, ein Tick dauert eine dreissigstel
 * Sekunde. Wer schneller ist als 1200 Pixel je Sekunde, springt in einem Tick
 * weiter als die Mauer dick ist - und `resolveAgainstWalls` schiebt ihn dann
 * auf die naechstgelegene Seite heraus, also nach draussen. Genau das ist mit
 * einem schnelleren Dash passiert: Der Spieler stand ausserhalb des Feldes und
 * die Welle endete nie.
 *
 * Statt das Dash-Tempo zu deckeln und beim naechsten schnellen Effekt wieder
 * hineinzulaufen, wird hier stumpf begrenzt. `state.bounds` gab es schon, es
 * wurde nur nie benutzt.
 */
export function clampToArena(position: Vec2, radius: number, bounds: Rect): void {
  const minX = bounds.x + radius;
  const maxX = bounds.x + bounds.width - radius;
  const minY = bounds.y + radius;
  const maxY = bounds.y + bounds.height - radius;

  position.x = position.x < minX ? minX : position.x > maxX ? maxX : position.x;
  position.y = position.y < minY ? minY : position.y > maxY ? maxY : position.y;
}
