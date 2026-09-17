/**
 * Querformat erzwingen - auch auf einem Handy mit Rotationssperre.
 *
 * Das Problem: Das Spiel ist für Querformat gebaut. Vorher stand im Hochformat
 * nur „Bitte das Handy quer halten“ - wer die Rotationssperre an hat (auf dem
 * iPhone der Normalfall), kam da nie wieder raus.
 *
 * Zwei Wege, in dieser Reihenfolge:
 *
 * 1. `screen.orientation.lock("landscape")`. Klappt auf Android im Vollbild.
 *    iOS Safari kennt die Sperre nicht - dort schlägt sie still fehl.
 * 2. Das Spiel per CSS um 90 Grad drehen. Damit sieht der Spieler Querformat,
 *    egal wie er das Gerät hält.
 *
 * Der zweite Weg hat einen Haken, den man leicht übersieht: Eine CSS-Drehung
 * dreht nur das BILD, nicht die Berührungen. Phaser rechnet Fingerpositionen
 * weiter so um, als stünde nichts auf dem Kopf - der Daumen landet dann an der
 * falschen Stelle. Deshalb wird die Umrechnung hier mitgedreht.
 */

import Phaser from "phaser";

/** Klasse am <html>-Element; das Stylesheet in index.html hängt daran. */
const ROTATED_CLASS = "rotate-to-landscape";

interface PointerLike {
  position: { x: number; y: number };
  prevPosition: { x: number; y: number };
  smoothFactor: number;
}

/** Phasers Umrechnung von Seiten- in Spielkoordinaten, so weit wir sie brauchen. */
interface TransformableInput {
  transformPointer?: (pointer: PointerLike, pageX: number, pageY: number, wasMove: boolean) => void;
}

let rotated = false;

/** Ist das Fenster höher als breit? */
function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

export function isRotatedToLandscape(): boolean {
  return rotated;
}

/**
 * Richtet die Drehung ein und hält sie aktuell.
 * Wird einmal beim Start aufgerufen, nachdem das Spiel existiert.
 */
export function enforceLandscape(game: Phaser.Game): void {
  void lockOrientation();
  patchPointerTransform(game);

  const apply = (): void => {
    const shouldRotate = isPortrait();
    if (shouldRotate === rotated) {
      return;
    }

    rotated = shouldRotate;
    document.documentElement.classList.toggle(ROTATED_CLASS, rotated);

    // Phaser misst seinen Platz neu - sonst behält die Zeichenfläche die
    // Grösse aus der alten Lage.
    game.scale.refresh();
  };

  apply();
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
}

/**
 * Bittet das Gerät um Querformat. Erlaubt ist das nur im Vollbild und nur auf
 * Geräten, die es unterstützen - ein Fehlschlag ist der Normalfall, kein Problem.
 */
async function lockOrientation(): Promise<void> {
  const orientation = screen.orientation as
    (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;

  try {
    await orientation?.lock?.("landscape");
  } catch {
    // Kein Vollbild, oder iOS - dann übernimmt die CSS-Drehung.
  }
}

/**
 * Dreht Phasers Berührungs-Umrechnung mit.
 *
 * Die Rechnung: Die Zeichenfläche wird an ihrer linken oberen Ecke um 90 Grad
 * gedreht und um die Bildschirmbreite nach rechts geschoben. Ein Punkt (x, y)
 * darauf landet dadurch bei (Bildschirmbreite - y, x) auf dem Bildschirm.
 * Umgekehrt wird aus einer Berührung (sx, sy) also (sy, Bildschirmbreite - sx).
 *
 * Dass die Ecke wirklich bei (0, 0) liegt, stellt das Stylesheet sicher: Es
 * setzt die Zentrier-Ränder, die Phaser selbst schreibt, im gedrehten Zustand
 * auf null.
 */
function patchPointerTransform(game: Phaser.Game): void {
  const input = game.input as unknown as TransformableInput;
  const original = input.transformPointer;

  if (typeof original !== "function") {
    // Andere Phaser-Version als erwartet: lieber ungedreht weiterspielen als
    // mit Berührungen, die ins Leere gehen.
    return;
  }

  input.transformPointer = function (pointer, pageX, pageY, wasMove) {
    if (!rotated) {
      original.call(this, pointer, pageX, pageY, wasMove);
      return;
    }

    // Den Massstab selbst ausrechnen, nicht von Phaser übernehmen: Phaser
    // leitet ihn aus dem Rechteck ab, das die Zeichenfläche auf dem Bildschirm
    // einnimmt - und das ist im gedrehten Zustand hochkant, also vertauscht.
    // Die Layoutgrösse (offsetWidth/offsetHeight) dreht sich dagegen nicht mit.
    const canvas = game.canvas;
    const scaleX = game.scale.gameSize.width / canvas.offsetWidth;
    const scaleY = game.scale.gameSize.height / canvas.offsetHeight;

    const x = pageY * scaleX;
    const y = (window.innerWidth - pageX) * scaleY;

    const current = pointer.position;
    const previous = pointer.prevPosition;
    previous.x = current.x;
    previous.y = current.y;

    // Dieselbe Glättung wie in Phaser: Bei Bewegungen wird der neue Wert mit
    // dem alten gemischt, damit die Figur nicht an jedem Messfehler zuckt.
    const smoothing = pointer.smoothFactor;
    if (!wasMove || smoothing === 0) {
      current.x = x;
      current.y = y;
    } else {
      current.x = x * smoothing + previous.x * (1 - smoothing);
      current.y = y * smoothing + previous.y * (1 - smoothing);
    }
  };
}
