/**
 * Bildschirmrichtung <-> Bodenrichtung, fuer eine fest angewinkelte Kamera.
 *
 * ================================================================
 * DAS PROBLEM
 * ================================================================
 *
 * Der Daumen schiebt den Joystick in BILDSCHIRM-Richtungen: rechts, oben,
 * schraeg. Die Simulation rechnet in BODEN-Richtungen (Sim-x, Sim-y). Solange
 * die Kamera senkrecht von oben schaute (2D), war beides dasselbe. Mit einer
 * schraeg stehenden 3D-Kamera nicht mehr:
 *
 *   1. DREHUNG (yaw): Steht die Kamera nicht im Sueden, ist "oben auf dem
 *      Bildschirm" nicht mehr Norden.
 *   2. STAUCHUNG (pitch): Eine schraeg blickende Kamera staucht die Tiefe.
 *      Ein Meter nach vorn erscheint auf dem Bildschirm nur sin(pitch) so
 *      lang wie ein Meter zur Seite. Wer den Stick genau schraeg nach oben
 *      rechts drueckt und die Figur 45 Grad am Boden laufen laesst, sieht sie
 *      bei 55 Grad Neigung um rund 6 Grad flacher laufen, als der Daumen zeigt.
 *
 * Beides wird hier ausgeglichen: Die Figur laeuft AUF DEM BILDSCHIRM genau in
 * die Richtung, in die der Daumen zeigt. Das ist die einzige Abbildung, bei
 * der man nie nachdenken muss.
 *
 * ================================================================
 * WAS DABEI GLEICH BLEIBT
 * ================================================================
 *
 * Die LAENGE des Vektors. Ein halber Joystick-Ausschlag bleibt halbes Tempo,
 * egal in welche Richtung - sonst liefe man nach vorn schneller als zur
 * Seite, und die Kennlinie aus `ui/stickResponse.ts` stimmte nicht mehr.
 *
 * Die Stauchung ist die Naeherung fuer die BILDMITTE (dort steht die eigene
 * Figur, weil die Kamera ihr folgt). Am Bildrand verzieht die Perspektive
 * zusaetzlich; das betrifft aber nichts, was man mit dem Daumen steuert.
 *
 * Bewusst ohne Phaser und ohne Three.js: Die Rechnung laeuft in Tests ohne
 * Browser, und `InputManager` braucht dafuer keine 3D-Bibliothek.
 */

import type { Vec2 } from "../systems/types";

/** Wie die Kamera auf den Boden blickt. Winkel im Bogenmass. */
export interface ViewOrientation {
  /** Drehung um die Hochachse. 0 = Kamera im Sueden, Blick nach Norden. */
  yaw: number;
  /** Neigung ueber dem Boden. PI/2 = senkrecht von oben (die alte 2D-Sicht). */
  pitch: number;
}

/** Senkrecht von oben, nicht gedreht: Bildschirm = Boden, wie in 2D. */
export const TOP_DOWN: ViewOrientation = { yaw: 0, pitch: Math.PI / 2 };

/**
 * Bildschirmrichtung (x rechts, y UNTEN, wie im Browser) -> Bodenrichtung
 * in Simulationskoordinaten. Die Laenge bleibt erhalten.
 */
export function screenToGround(screen: Vec2, view: ViewOrientation): Vec2 {
  const length = Math.hypot(screen.x, screen.y);
  if (length < 1e-9) {
    return { x: 0, y: 0 };
  }

  // Schritt 1: Stauchung rueckgaengig machen. "Nach oben auf dem Bildschirm"
  // muss am Boden um 1/sin(pitch) weiter reichen, damit es auf dem
  // Bildschirm so lang aussieht wie dieselbe Strecke zur Seite.
  const side = screen.x;
  const depth = screen.y / Math.max(Math.sin(view.pitch), 1e-3);

  // Schritt 2: Drehung um die Hochachse (Kamera-rechts / Kamera-vorn am Boden).
  const cos = Math.cos(view.yaw);
  const sin = Math.sin(view.yaw);
  const x = side * cos + depth * sin;
  const y = -side * sin + depth * cos;

  // Schritt 3: auf die urspruengliche Laenge bringen.
  const scale = length / Math.hypot(x, y);
  return { x: x * scale, y: y * scale };
}

/**
 * Die Gegenrichtung: Bodenrichtung -> Bildschirmrichtung. Gebraucht fuer
 * Anzeigen, die auf etwas am Boden zeigen (Kompass am Bildschirmrand).
 * Die Laenge bleibt erhalten.
 */
export function groundToScreen(ground: Vec2, view: ViewOrientation): Vec2 {
  const length = Math.hypot(ground.x, ground.y);
  if (length < 1e-9) {
    return { x: 0, y: 0 };
  }

  const cos = Math.cos(view.yaw);
  const sin = Math.sin(view.yaw);
  const side = ground.x * cos - ground.y * sin;
  const depth = (ground.x * sin + ground.y * cos) * Math.sin(view.pitch);

  const scale = length / Math.hypot(side, depth);
  return { x: side * scale, y: depth * scale };
}

/** Eine Bildschirmrichtung, die auch `null` sein darf ("zielt nicht selbst"). */
export function screenToGroundOrNull(screen: Vec2 | null, view: ViewOrientation): Vec2 | null {
  return screen ? screenToGround(screen, view) : null;
}
