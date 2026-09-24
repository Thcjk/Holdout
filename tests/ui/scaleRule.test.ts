/**
 * Die Massstab-Regel aus dem Arbeitsdokument (Etappe 6): Eine Figur soll beim
 * Standardzoom etwa 5-7 % der Bildschirmhoehe einnehmen.
 *
 * Gemessen wird der sichtbare KOERPER, nicht die Kachel: Bei allen Figuren des
 * Pakets belegt er senkrecht genau 12 der 16 Sheetpixel (siehe
 * `SPRITE_BODY_RADIUS` in `config/assets.ts`). Die Entwurfshoehe ist fest 540
 * und wird formatfuellend auf den Bildschirm skaliert - der Anteil gilt also
 * auf jedem Geraet.
 */

import { describe, expect, it } from "vitest";
import { SPRITE_BODY_RADIUS } from "../../src/config/assets";
import { PLAYER } from "../../src/config/balance";
import { CAMERA, VIEWPORT } from "../../src/config/constants";

describe("Massstab der Figuren", () => {
  it("nimmt beim Standardzoom 5-7 % der Bildhoehe ein", () => {
    const spriteScale = PLAYER.radius / SPRITE_BODY_RADIUS;
    const bodyWorld = SPRITE_BODY_RADIUS * 2 * spriteScale;
    const share = (bodyWorld * CAMERA.maxZoom) / VIEWPORT.height;

    // 36 Weltpixel x 0,8 = 28,8 von 540 = 5,3 %.
    expect(share).toBeGreaterThanOrEqual(0.05);
    expect(share).toBeLessThanOrEqual(0.07);
  });
});
