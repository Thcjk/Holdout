/**
 * Zeichnet die Zielvorschau - in 2D oder 3D, mit DERSELBEN Logik davor.
 *
 * Welche Linie und welcher Kreis zu sehen sind, entscheidet `GameScene`
 * (`drawAbilityAim`) aus den echten Spielwerten. Das bleibt eine Stelle. Nur
 * WIE gezeichnet wird, haengt an der Ansicht: in 2D mit Phaser-Graphics, in
 * 3D als flache Formen am Boden. Zwei Kopien der Entscheidungslogik liefen
 * frueher oder spaeter auseinander - und eine Vorschau, die etwas anderes
 * zeigt, als wirkt, ist schlimmer als keine.
 *
 * Alle Angaben in SIMULATIONSKOORDINATEN (Pixel). Die 3D-Seite rechnet selbst
 * um.
 */

import type Phaser from "phaser";
import type { Vec2 } from "../systems/types";

export interface AimPainter {
  clear(): void;
  line(from: Vec2, to: Vec2, width: number, color: number, alpha: number): void;
  circle(center: Vec2, radius: number, width: number, color: number, alpha: number): void;
}

/** Die 2D-Fassung: genau die Aufrufe, die vorher direkt in der Szene standen. */
export function graphicsPainter(graphics: Phaser.GameObjects.Graphics): AimPainter {
  return {
    clear: () => graphics.clear(),
    line: (from, to, width, color, alpha) => {
      graphics.lineStyle(width, color, alpha);
      graphics.lineBetween(from.x, from.y, to.x, to.y);
    },
    circle: (center, radius, width, color, alpha) => {
      graphics.lineStyle(width, color, alpha);
      graphics.strokeCircle(center.x, center.y, radius);
    },
  };
}
