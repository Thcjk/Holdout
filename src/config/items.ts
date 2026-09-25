/**
 * Der Item-Katalog.
 *
 * ================================================================
 * WARUM HIER UND NICHT IN `entities/Item.ts`
 * ================================================================
 *
 * Einen Ordner `entities/` gibt es in diesem Projekt nicht - der Name stammt
 * aus `BRIEFING.md` Abschnitt 5, der noch die urspruenglich geplante Struktur
 * beschreibt (in CLAUDE.md als eine von vier veralteten Stellen vermerkt).
 *
 * Entschieden hat die Architektur-Grundregel: *Muss der Host das rechnen
 * koennen, ohne zu zeichnen?* Bei Items lautet die Antwort ja, also liegen
 * die TYPEN in `systems/types.ts` und die LOGIK in `systems/loot.ts`. Was
 * hier steht, ist die Tabelle selbst - dieselbe Rolle, die `assets.ts` fuer
 * die Sprites hat: eine Datei, in der alles steht, damit ein neues Item eine
 * Zeile ist und keine Suche durch fuenfzig Fundstellen.
 *
 * Die ZAHLEN, mit denen das Spiel rechnet (Drop-Chancen, Seltenheitsgewichte,
 * Aufsammelradius), stehen dagegen in `balance.ts` - dort, wo alle Spielwerte
 * stehen.
 *
 * ================================================================
 * DIE FORM WIRD JETZT MITGEFUEHRT UND ERST IN PHASE 11 BENUTZT
 * ================================================================
 *
 * `width` und `height` sind GITTEREINHEITEN, keine Pixel: Der Rucksack ist ab
 * Phase 11 ein Gitter nach Tarkov-Vorbild, in dem ein 2x1-Item zwei Zellen
 * belegt. Bis dahin liest die Form niemand aus.
 *
 * Sie steht trotzdem schon jetzt da, und das ist Absicht: Ein Feld
 * nachtraeglich einzufuehren heisst, jedes bereits erzeugte Item damit zu
 * versorgen - in gespeicherten Staenden, im Netzprotokoll, in Tests. Jetzt
 * kostet es nichts.
 */

/**
 * Grobe Kategorien.
 *
 * Bewusst nur drei. Feiner zu unterteilen waere jetzt geraten: Was ein Item
 * wirklich TUT, entscheidet erst Phase 12 (Waffen) und Phase 13 (Lager).
 */
export type ItemType = "weapon" | "consumable" | "material" | "upgrade" | "attachment";

/**
 * Die vier Waffenaufsaetze (seit 2026-09-26). Jede Waffe hat feste Plaetze
 * fuer bestimmte Arten (`WEAPON_SLOTS` in `balance.ts`), die Wirkung steht in
 * `ATTACHMENTS`. Die Reihenfolge hier ist auch die Bit-Reihenfolge im
 * Rucksack-Code - nicht umsortieren.
 */
export const ATTACHMENT_KINDS = ["scope", "barrel", "mag", "grip"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export interface ItemDef {
  /** Stabiler Schluessel. Steht im Code, nie der Anzeigename. */
  id: string;
  name: string;
  type: ItemType;
  /**
   * Platzbedarf im Rucksackgitter, in Zellen.
   * Wird erst ab Phase 11 ausgewertet.
   */
  size: { width: number; height: number };
  /**
   * Seltenheit als Zahl von 1 (haeufig) bis 4 (selten).
   *
   * Eine ZAHL und keine Wortliste, damit sie sich gewichten und vergleichen
   * laesst, ohne dass irgendwo eine Reihenfolge von Woertern gepflegt werden
   * muss. Die Farbe in der Darstellung leitet sich daraus ab.
   */
  rarity: 1 | 2 | 3 | 4;
  /** Nur bei Aufsaetzen: welche Art (passt in den gleichnamigen Waffenplatz). */
  attachment?: AttachmentKind;
}

/**
 * Alle Items, die es gibt.
 *
 * DIE REIHENFOLGE IST TEIL DES NETZPROTOKOLLS. Uebertragen wird der Index in
 * dieser Liste, nicht der Name - genau wie bei `ENEMY_TYPE_ORDER`. Neue
 * Eintraege gehoeren deshalb ans ENDE; wer mittendrin einfuegt, sorgt dafuer,
 * dass ein Geraet mit aelterer Version andere Gegenstaende sieht als der Host.
 */
export const ITEMS: readonly ItemDef[] = [
  // --- Material: das Brot-und-Butter-Loot, klein und haeufig ---
  { id: "scrap", name: "Schrott", type: "material", size: { width: 1, height: 1 }, rarity: 1 },
  { id: "wire", name: "Kabelrolle", type: "material", size: { width: 1, height: 1 }, rarity: 1 },
  { id: "cell", name: "Energiezelle", type: "material", size: { width: 1, height: 2 }, rarity: 2 },
  { id: "circuit", name: "Platine", type: "material", size: { width: 2, height: 1 }, rarity: 3 },
  { id: "core", name: "Reaktorkern", type: "material", size: { width: 2, height: 2 }, rarity: 4 },

  // --- Verbrauchsgueter: wirken nur aus dem Guertel (Knopf im Kampf) ---
  { id: "bandage", name: "Verband", type: "consumable", size: { width: 1, height: 1 }, rarity: 1 },
  { id: "medkit", name: "Medipack", type: "consumable", size: { width: 2, height: 2 }, rarity: 3 },
  { id: "ammoBox", name: "Munitionskiste", type: "consumable", size: { width: 2, height: 1 }, rarity: 2 },

  // --- Waffen: gross, selten, und ab Phase 12 das eigentliche Ziel ---
  { id: "pistol", name: "Pistole", type: "weapon", size: { width: 2, height: 1 }, rarity: 1 },
  { id: "smg", name: "Maschinenpistole", type: "weapon", size: { width: 3, height: 1 }, rarity: 2 },
  { id: "rifle", name: "Gewehr", type: "weapon", size: { width: 4, height: 2 }, rarity: 3 },
  { id: "railgun", name: "Railgun", type: "weapon", size: { width: 4, height: 2 }, rarity: 4 },

  // --- Aufsaetze: kommen auf eine Waffe, nicht in den Rucksack ---
  { id: "scope", name: "Visier", type: "attachment", attachment: "scope", size: { width: 1, height: 1 }, rarity: 2 },
  { id: "barrel", name: "Lauf", type: "attachment", attachment: "barrel", size: { width: 1, height: 1 }, rarity: 2 },
  { id: "mag", name: "Magazin", type: "attachment", attachment: "mag", size: { width: 1, height: 1 }, rarity: 2 },
  { id: "grip", name: "Griff", type: "attachment", attachment: "grip", size: { width: 1, height: 1 }, rarity: 3 },

  // --- Erweiterung: kommt nicht in den Rucksack, sondern VERGROESSERT ihn ---
  { id: "pouch", name: "Tasche", type: "upgrade", size: { width: 1, height: 1 }, rarity: 2 },
] as const;

/** Nachschlagen nach Index - so, wie es aus dem Netz kommt. */
export function itemAt(index: number): ItemDef | null {
  return ITEMS[index] ?? null;
}

/** Nachschlagen nach Schluessel. Gibt den Index zurueck, oder -1. */
export function itemIndex(id: string): number {
  return ITEMS.findIndex((item) => item.id === id);
}

/**
 * Die Farbe einer Seltenheitsstufe.
 *
 * Steht hier statt in `constants.ts`, weil sie zur Tabelle gehoert: Wer eine
 * fuenfte Stufe einfuehrt, findet die fehlende Farbe sofort daneben.
 */
export const RARITY_COLORS: Record<number, number> = {
  1: 0x9fb3c8, // grau - haeufig
  2: 0x6ec8f0, // blau
  3: 0xb18cf0, // violett
  4: 0xffd166, // gold - selten
};
