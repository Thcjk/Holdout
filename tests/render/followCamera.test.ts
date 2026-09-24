/**
 * Joystick-Richtung = Bildschirm-Richtung, auch mit schraeger 3D-Kamera.
 *
 * Das ist die Stelle, an der Bildschirm und Welt am leichtesten
 * auseinanderlaufen: Ein falsches Vorzeichen, eine vertauschte Achse oder
 * eine vergessene Neigung - und die Figur laeuft schraeg, wenn man geradeaus
 * drueckt. Im Spiel merkt man das nur als "Steuerung fuehlt sich komisch an".
 *
 * Deshalb wird hier nicht die Formel mit sich selbst verglichen, sondern mit
 * einer ECHTEN Three.js-Kamera: Stick-Richtung -> Bodenrichtung (wie im
 * InputManager) -> Punkt am Boden -> durch die Kamera auf den Bildschirm
 * projiziert. Die Richtung auf dem Bildschirm muss die des Sticks sein.
 */

import { afterEach, describe, expect, it } from "vitest";
import { VIEW3D } from "../../src/config/constants";
import {
  TOP_DOWN,
  groundToScreen,
  screenToGround,
} from "../../src/input/viewMapping";
import type { ViewOrientation } from "../../src/input/viewMapping";
import { FollowCamera } from "../../src/render/FollowCamera";
import { toThree } from "../../src/render/space3d";
import type { Vec2 } from "../../src/systems/types";

const ASPECT = 1184 / 540;
const ORIGINAL = { ...VIEW3D };

afterEach(() => {
  Object.assign(VIEW3D, ORIGINAL);
});

/** Kamera mit gegebener Neigung/Drehung (Grad) ueber der Figur bei `at`. */
function cameraAt(at: Vec2, pitch: number, yaw: number): FollowCamera {
  VIEW3D.pitch = pitch;
  VIEW3D.yaw = yaw;
  const follow = new FollowCamera();
  follow.follow(at, 16, ASPECT);
  return follow;
}

/**
 * Wohin bewegt sich ein Bodenpunkt auf dem Bildschirm, wenn er um `ground`
 * (Pixel) verschoben wird? Ergebnis in Bildschirmrichtung: x rechts, y UNTEN,
 * beide Achsen im selben Massstab (sonst verzoege das Seitenverhaeltnis den
 * Winkel).
 */
function screenMotion(follow: FollowCamera, from: Vec2, ground: Vec2): Vec2 {
  const a = toThree(from, 0).project(follow.camera);
  const b = toThree({ x: from.x + ground.x, y: from.y + ground.y }, 0).project(follow.camera);
  return { x: (b.x - a.x) * ASPECT, y: -(b.y - a.y) };
}

function angleBetween(a: Vec2, b: Vec2): number {
  const dot = a.x * b.x + a.y * b.y;
  const cross = a.x * b.y - a.y * b.x;
  return Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);
}

/** 16 Stick-Richtungen rundum, auch die schraegen. */
const STICK: Vec2[] = Array.from({ length: 16 }, (_, index) => {
  const angle = (index / 16) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

const PLAYER: Vec2 = { x: 8000, y: 8000 };

/** Groesste Abweichung Stick -> Bildschirm ueber alle 16 Richtungen, in Grad. */
function worstDeviation(follow: FollowCamera, mapping: ViewOrientation): number {
  let worst = 0;
  for (const stick of STICK) {
    const ground = screenToGround(stick, mapping);
    // Kurzer Schritt (eine halbe Kachel) - genau das, was die Figur in
    // wenigen Bildern zuruecklegt.
    const step = { x: ground.x * 24, y: ground.y * 24 };
    worst = Math.max(worst, angleBetween(stick, screenMotion(follow, PLAYER, step)));
  }
  return worst;
}

describe("Stick-Richtung gegen echte 3D-Kamera", () => {
  const cases: Array<[pitch: number, yaw: number]> = [
    [55, 0], // der Richtwert
    [40, 0],
    [75, 0],
    [55, 45],
    [55, 90],
    [55, 180],
    [60, -30],
  ];

  for (const [pitch, yaw] of cases) {
    it(`Neigung ${pitch} Grad, Drehung ${yaw} Grad: Figur laeuft auf dem Bildschirm, wohin der Daumen zeigt`, () => {
      const follow = cameraAt(PLAYER, pitch, yaw);
      // Unter 1 Grad: Der Rest ist die Perspektive, weil der Blickpunkt auf
      // Brusthoehe liegt und der Fuss der Figur knapp unter der Bildmitte.
      expect(worstDeviation(follow, follow.orientation)).toBeLessThan(1);
    });
  }

  it("Stick nach oben heisst bei Drehung 0 nach Norden (Sim-y kleiner), wie in 2D", () => {
    const follow = cameraAt(PLAYER, 55, 0);
    const ground = screenToGround({ x: 0, y: -1 }, follow.orientation);
    expect(ground.x).toBeCloseTo(0);
    expect(ground.y).toBeCloseTo(-1);
    // ... und rechts bleibt rechts.
    const right = screenToGround({ x: 1, y: 0 }, follow.orientation);
    expect(right.x).toBeCloseTo(1);
    expect(right.y).toBeCloseTo(0);
  });

  it("GEGENPROBE: Mit falscher Drehung faellt der Test deutlich durch", () => {
    // Kamera um 45 Grad gedreht, die Umrechnung glaubt aber an 0 Grad.
    const follow = cameraAt(PLAYER, 55, 45);
    const wrong = { yaw: 0, pitch: follow.orientation.pitch };
    expect(worstDeviation(follow, wrong)).toBeGreaterThan(30);
  });

  it("GEGENPROBE: Nur drehen ohne Neigungsausgleich laege schraeg um mehrere Grad daneben", () => {
    // Genau der Fehler, den man leicht macht: "Die Kamera ist ja nicht
    // gedreht, also passt der Stick 1:1." Bei 55 Grad Neigung stimmt das nur
    // fuer die vier Hauptrichtungen.
    const follow = cameraAt(PLAYER, 55, 0);
    const naive = { yaw: 0, pitch: Math.PI / 2 };
    expect(worstDeviation(follow, naive)).toBeGreaterThan(4);
  });
});

describe("Umrechnung Bildschirm <-> Boden", () => {
  const views: ViewOrientation[] = [
    TOP_DOWN,
    { yaw: 0, pitch: (55 * Math.PI) / 180 },
    { yaw: 1.1, pitch: 0.8 },
    { yaw: -2.5, pitch: 1.3 },
  ];

  it("behaelt die Laenge: halber Ausschlag bleibt halbes Tempo, in jede Richtung", () => {
    for (const view of views) {
      for (const stick of STICK) {
        const half = { x: stick.x * 0.5, y: stick.y * 0.5 };
        const ground = screenToGround(half, view);
        expect(Math.hypot(ground.x, ground.y)).toBeCloseTo(0.5, 6);
      }
    }
  });

  it("ist von oben gesehen die Identitaet - die 2D-Ansicht aendert sich nicht", () => {
    for (const stick of STICK) {
      const ground = screenToGround(stick, TOP_DOWN);
      expect(ground.x).toBeCloseTo(stick.x, 9);
      expect(ground.y).toBeCloseTo(stick.y, 9);
    }
  });

  it("hin und zurueck ergibt wieder die Stick-Richtung", () => {
    for (const view of views) {
      for (const stick of STICK) {
        const back = groundToScreen(screenToGround(stick, view), view);
        expect(back.x).toBeCloseTo(stick.x, 9);
        expect(back.y).toBeCloseTo(stick.y, 9);
      }
    }
  });

  it("laesst den losgelassenen Stick bei null", () => {
    const ground = screenToGround({ x: 0, y: 0 }, views[1] as ViewOrientation);
    expect(ground).toEqual({ x: 0, y: 0 });
  });
});
