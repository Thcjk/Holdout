/**
 * Teile fuer die Mechs: eins am Arm, eins auf dem Ruecken.
 *
 * Man findet sie in Ruinen-Truhen oder kauft sie beim Haendler. Ein neues Teil
 * ersetzt das alte im selben Platz - ausser es ist dasselbe: dann wird es eine
 * Stufe besser (hoechstens 3).
 */

import type { PartId } from "../types";

export interface PartSpec {
  id: PartId;
  slot: "arm" | "back";
  name: string;
  /** Was es auf Stufe 1 tut. */
  text: string;
  /** Preis beim Haendler. */
  cost: number;
  /** Wert pro Stufe (z. B. 0,2 = +20 % je Stufe). */
  value: number;
}

export const PART_IDS: readonly PartId[] = [
  "schnellfeuer",
  "schwerer_lauf",
  "weitschuss",
  "durchschlag",
  "panzerung",
  "turbine",
  "sammler",
  "kuehler",
  "werkzeug",
];

export const PARTS: Record<PartId, PartSpec> = {
  schnellfeuer: {
    id: "schnellfeuer",
    slot: "arm",
    name: "Schnellfeuer",
    text: "Schießt 20 % schneller.",
    cost: 45,
    value: 0.2,
  },
  schwerer_lauf: {
    id: "schwerer_lauf",
    slot: "arm",
    name: "Schwerer Lauf",
    text: "25 % mehr Schaden.",
    cost: 45,
    value: 0.25,
  },
  weitschuss: {
    id: "weitschuss",
    slot: "arm",
    name: "Weitschuss",
    text: "20 % mehr Reichweite.",
    cost: 35,
    value: 0.2,
  },
  durchschlag: {
    id: "durchschlag",
    slot: "arm",
    name: "Durchschlag",
    text: "Geschosse treffen einen Gegner mehr.",
    cost: 50,
    value: 1,
  },
  panzerung: {
    id: "panzerung",
    slot: "back",
    name: "Panzerung",
    text: "+35 Leben.",
    cost: 35,
    value: 35,
  },
  turbine: {
    id: "turbine",
    slot: "back",
    name: "Turbine",
    text: "Läuft 15 % schneller.",
    cost: 35,
    value: 0.15,
  },
  sammler: {
    id: "sammler",
    slot: "back",
    name: "Sammelmagnet",
    text: "Zieht Schrott aus 50 Pixeln weiter heran.",
    cost: 30,
    value: 50,
  },
  kuehler: {
    id: "kuehler",
    slot: "back",
    name: "Kühler",
    text: "Fähigkeit 20 % schneller wieder bereit.",
    cost: 45,
    value: 0.2,
  },
  werkzeug: {
    id: "werkzeug",
    slot: "back",
    name: "Werkzeugkiste",
    text: "Flickt Module in der Nähe (+5 je Sekunde).",
    cost: 40,
    value: 5,
  },
};

/** Wert eines Teils auf seiner Stufe (0, wenn der Mech es nicht hat). */
export function partValue(
  parts: { arm: { id: PartId; level: number } | null; back: { id: PartId; level: number } | null },
  id: PartId,
): number {
  const slot = PARTS[id].slot;
  const part = parts[slot];
  return part && part.id === id ? PARTS[id].value * part.level : 0;
}
