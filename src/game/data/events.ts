/**
 * Ereignisse an Stationen: eine kurze Lage, zwei Moeglichkeiten.
 * Jedes Ereignis kommt hoechstens einmal pro Lauf.
 */

export interface Effect {
  scrap?: number;
  hull?: number;
  /** Rumpf-Hoechstwert dauerhaft hoeher. */
  hullMax?: number;
  lead?: number;
  /** So viele zufaellige Module eine Stufe hoeher. */
  upgrade?: number;
}

export interface EventChoice {
  label: string;
  /** Was dabei herauskommt (steht auf dem Knopf darunter). */
  result: string;
  effect: Effect;
}

export interface EventSpec {
  id: string;
  title: string;
  text: string;
  choices: readonly [EventChoice, EventChoice];
}

export const EVENTS: readonly EventSpec[] = [
  {
    id: "karawane",
    title: "Verschüttete Karawane",
    text: "Aus einer Düne ragen Wagenräder. Darunter liegt bestimmt Brauchbares – Graben braucht aber Zeit.",
    choices: [
      { label: "Ausgraben", result: "+45 Schrott, −1 Vorsprung", effect: { scrap: 45, lead: -1 } },
      { label: "Weiterziehen", result: "+1 Vorsprung", effect: { lead: 1 } },
    ],
  },
  {
    id: "werkstatt",
    title: "Alte Werkstatt",
    text: "Eine verlassene Schmiede, die Esse ist noch warm. Ihr könntet ein Modul verbessern – oder euch ausruhen.",
    choices: [
      {
        label: "Schmieden",
        result: "Ein zufälliges Modul eine Stufe höher",
        effect: { upgrade: 1 },
      },
      { label: "Ausruhen", result: "+120 Rumpf", effect: { hull: 120 } },
    ],
  },
  {
    id: "schrein",
    title: "Goldener Schrein",
    text: "Ein Schrein der Sonnenkönige, voller Gold. Die Armee wird es merken, wenn ihr ihn plündert.",
    choices: [
      {
        label: "Gold abschlagen",
        result: "+70 Schrott, −2 Vorsprung",
        effect: { scrap: 70, lead: -2 },
      },
      { label: "In Ruhe lassen", result: "nichts", effect: {} },
    ],
  },
  {
    id: "sturm",
    title: "Sandsturm zieht auf",
    text: "Eine braune Wand rollt heran. Mitten hindurch hängt ihr die Armee ab, aber der Sand schleift am Rumpf.",
    choices: [
      { label: "Hindurch", result: "−70 Rumpf, +2 Vorsprung", effect: { hull: -70, lead: 2 } },
      { label: "Abwarten", result: "+60 Rumpf, −1 Vorsprung", effect: { hull: 60, lead: -1 } },
    ],
  },
  {
    id: "wrack",
    title: "Gestrandete Festung",
    text: "Eine kleinere Lauf-Festung liegt umgekippt im Sand. Ihre Panzerung ist noch gut.",
    choices: [
      {
        label: "Panzerung abbauen",
        result: "Rumpf dauerhaft +80",
        effect: { hullMax: 80, hull: 80 },
      },
      { label: "Ausschlachten", result: "+40 Schrott", effect: { scrap: 40 } },
    ],
  },
  {
    id: "spaeher",
    title: "Späher der Armee",
    text: "Ein goldener Späher beobachtet euch von einer Düne. Ihn zu jagen kostet Zeit, sonst meldet er euch.",
    choices: [
      { label: "Jagen", result: "+20 Schrott, −1 Vorsprung", effect: { scrap: 20, lead: -1 } },
      {
        label: "Schnell weiter",
        result: "+1 Vorsprung, −40 Rumpf",
        effect: { lead: 1, hull: -40 },
      },
    ],
  },
  {
    id: "brunnen",
    title: "Tiefer Brunnen",
    text: "Kühles Wasser für die Dampfkessel. Mit vollen Kesseln läuft die Festung leichter.",
    choices: [
      { label: "Kessel füllen", result: "+1 Vorsprung", effect: { lead: 1 } },
      { label: "Rumpf kühlen", result: "+90 Rumpf", effect: { hull: 90 } },
    ],
  },
];

/** Kann man sich diese Wahl leisten? (Schrott darf nicht unter 0 fallen.) */
export function affordable(choice: EventChoice, bank: number): boolean {
  return (choice.effect.scrap ?? 0) >= 0 || bank >= -(choice.effect.scrap ?? 0);
}
