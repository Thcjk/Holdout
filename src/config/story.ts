/**
 * Die Geschichte des Runs: Rahmen, Regionen, Ortsnamen.
 *
 * Bewusst klein gehalten (Entscheidung 2026-09-25: "Rahmen + Ortstexte"):
 * ein Ziel, vier Regionen mit je einem Satz, Namen fuer die Orte. Das gibt
 * der Karte eine Richtung - man zieht nicht von Knoten zu Knoten, sondern
 * vom Stadtrand zur Kueste, wo das letzte Schiff ablegt.
 *
 * Alles hier ist Text und Farbe, keine Spielregel. Welche Orte in einem
 * Gebiet STEHEN (Tankstelle, Hof ...), entscheidet `NodeArenaGenerator`
 * anhand von `theme`.
 */

/** Das Thema einer Region - bestimmt Boden und Orte im Gebiet. */
export type RegionTheme = "suburb" | "industry" | "forest" | "coast";

export interface Region {
  name: string;
  theme: RegionTheme;
  /** Ein Satz beim ersten Betreten der Region. */
  intro: string;
  /** Hintergrundfarbe des Streifens auf der Karte. */
  mapColor: number;
  /** Orte, aus denen die Knoten ihre Namen bekommen. */
  places: readonly string[];
}

/** Der Rahmen - steht oben auf der Karte, solange man am Start ist. */
export const STORY = {
  title: "Der letzte Hafen",
  intro:
    "Die Stadt ist gefallen. Über Funk: Ein Schiff holt Überlebende an der Küste ab. " +
    "Schlag dich durch – oder steig vorher aus, solange du noch etwas tragen kannst.",
  /** Wenn der Ende-Boss faellt. */
  victory: "Der Wächter des Hafens ist gefallen. Das Schiff legt ab – mit dir an Bord.",
};

/**
 * Die Regionen von links (Start) nach rechts (Ende-Boss). Jede deckt einen
 * gleich grossen Teil der Schichten ab (`regionOfLayer`).
 */
export const REGIONS: readonly Region[] = [
  {
    name: "Stadtrand",
    theme: "suburb",
    intro: "Vorgärten, Tankstellen, verlassene Autos. Hier ist es noch ruhig – noch.",
    mapColor: 0x5b6b4a,
    places: [
      "Tankstelle an der B7",
      "Einkaufszentrum Nord",
      "Bushof Lindenweg",
      "Siedlung am Hang",
      "Apotheke Marktplatz",
      "Schrebergärten",
    ],
  },
  {
    name: "Industriegebiet",
    theme: "industry",
    intro: "Lagerhallen und Güterzüge. Viel Deckung – und viele, die sich darin verstecken.",
    mapColor: 0x6b6259,
    places: [
      "Güterbahnhof",
      "Spedition Kramer",
      "Raffinerie Ost",
      "Schrottplatz",
      "Kraftwerk",
      "Containerlager",
    ],
  },
  {
    name: "Wälder am Pass",
    theme: "forest",
    intro: "Die Strasse windet sich durch den Wald. Wer hier langsam ist, wird eingeholt.",
    mapColor: 0x3f5a3c,
    places: [
      "Rastplatz Adlerhorst",
      "Försterei",
      "Campingplatz Seeblick",
      "Sägewerk",
      "Passhöhe",
      "Alte Mühle",
    ],
  },
  {
    name: "Die Küste",
    theme: "coast",
    intro: "Salzluft. Irgendwo da vorn liegt das Schiff. Die Horde weiss das auch.",
    mapColor: 0x6d7f8c,
    places: [
      "Fischerdorf",
      "Leuchtturm",
      "Strandbad",
      "Hafenmeisterei",
      "Fährterminal",
      "Dünenweg",
    ],
  },
];

/** Welche Region gehoert zu dieser Schicht der Karte? */
export function regionIndexOfLayer(layer: number, depth: number): number {
  return Math.min(REGIONS.length - 1, Math.floor((layer * REGIONS.length) / depth));
}

export function regionOfLayer(layer: number, depth: number): Region {
  return REGIONS[regionIndexOfLayer(layer, depth)] as Region;
}

/**
 * Der Name eines Knotens - fest aus Seed und Nummer, damit alle im Koop
 * denselben lesen. Rast, Extraktion und Boss haben feste Namen.
 */
export function placeName(
  node: { id: number; layer: number; type: string },
  depth: number,
  seed: number,
): string {
  if (node.type === "start") return "Stadtmitte";
  if (node.type === "boss") return "Der Hafen";
  if (node.type === "rest") return "Unterschlupf";
  if (node.type === "extraction") return "Evakuierungspunkt";
  const region = regionOfLayer(node.layer, depth);
  const hash = Math.abs(Math.imul(seed ^ (node.id * 0x9e3779b1), 0x85ebca6b) >> 3);
  return region.places[hash % region.places.length] as string;
}
