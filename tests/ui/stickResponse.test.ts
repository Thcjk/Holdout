/**
 * Die Kennlinie des Bewegungs-Joysticks.
 *
 * Steuerungsgefuehl laesst sich nicht messen - aber die Kurve dahinter schon.
 * Diese Tests halten fest, was die Kurve leisten soll: unten fein, oben voll,
 * ohne Spruenge dazwischen.
 */

import { describe, expect, it } from "vitest";
import { TOUCH } from "../../src/config/constants";
import { stickStrength } from "../../src/ui/stickResponse";

describe("Joystick-Kennlinie", () => {
  it("bleibt in der toten Zone bei null", () => {
    expect(stickStrength(0)).toBe(0);
    expect(stickStrength(TOUCH.deadZone)).toBe(0);
  });

  it("erreicht am Stickrand volles Tempo", () => {
    expect(stickStrength(TOUCH.stickRadius)).toBeCloseTo(1, 6);
    // Weiter ziehen aendert nichts mehr.
    expect(stickStrength(TOUCH.stickRadius * 3)).toBeCloseTo(1, 6);
  });

  it("steigt durchgehend an, ohne Spruenge", () => {
    let previous = 0;
    let biggestJump = 0;
    for (let d = TOUCH.deadZone; d <= TOUCH.stickRadius; d += 1) {
      const value = stickStrength(d);
      expect(value).toBeGreaterThanOrEqual(previous);
      biggestJump = Math.max(biggestJump, value - previous);
      previous = value;
    }
    // Ein Pixel Daumenbewegung darf nie mehr als fuenf Prozent Tempo bedeuten.
    expect(biggestJump).toBeLessThan(0.05);
  });

  it("macht die Mitte fein - halber Weg ist deutlich weniger als halbes Tempo", () => {
    const half = TOUCH.deadZone + (TOUCH.stickRadius - TOUCH.deadZone) / 2;
    const value = stickStrength(half);
    console.log(
      `Halber Ausschlag ergibt ${(value * 100).toFixed(0)} % Tempo ` +
        `(geradlinig waeren es 50 %, Kurve ${TOUCH.responseCurve})`,
    );
    expect(value).toBeLessThan(0.4);
    expect(value).toBeGreaterThan(0.1);
  });
});
