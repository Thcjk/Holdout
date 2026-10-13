/**
 * Die Crew der Wanderfestung: sechs blaue Mechs (Entwurf), 64 x 64, Fuesse bei y = 62.
 *
 * Gleicher Bauplan wie die bisherigen Mechs (`mechBody`), aber neue Rollen,
 * die zur Festung passen:
 *   Schrauber       - Startheld. Schweissvisier, Riesen-Schraubenschluessel, Nietkanone
 *   Kanonier        - Schulterkanone ueber dem Kopf, Zielmonokel, Munitionsgurt
 *   Brecher         - breit, Rammschild mit Warnstreifen, Hoerner am Helm
 *   Bergungslaeuferin - schlank, Staubbrille, Stirnlampe, Schal, Harpune mit Seilwinde
 *   Funkerin        - Panoramavisier, Headset, Drohnen-Hangar auf dem Ruecken
 *   Sturmspringer   - Raubvogelhelm, Sprungduesen mit Flammen, Energielanze
 * Jede Figur schaut nach rechts.
 */

import { hazard } from "./buildings";
import { bolt, glowLight, mechBody, neck, seam, shine } from "./heroes";
import {
  BLUE,
  BLUE_DEEP,
  CYAN,
  CYAN_DARK,
  CYAN_LIGHT,
  FIRE,
  GRAY,
  INDIGO,
  LEATHER,
  ORANGE,
  OUTLINE,
  SKY,
  STEEL,
  VISOR,
  WHITE,
  YELLOW,
} from "./palette";
import { ellipse, minus, Pix, poly, rect, thick, union, type Ramp } from "./pix";

export type CrewId = "schrauber" | "kanonier" | "brecher" | "bergung" | "funkerin" | "springer";

export const CREW: readonly { id: CrewId; name: string }[] = [
  { id: "schrauber", name: "Schrauber" },
  { id: "kanonier", name: "Kanonier" },
  { id: "brecher", name: "Brecher" },
  { id: "bergung", name: "Bergungsläuferin" },
  { id: "funkerin", name: "Funkerin" },
  { id: "springer", name: "Sturmspringer" },
];

const AMBER: Ramp = [OUTLINE, "#a8481a", "#f0a040", "#ffe0a0"];
const RED_LENS: Ramp = [OUTLINE, "#a01818", "#ff4a3a", "#ffb0a0"];
const SCARF: Ramp = ["#3a2418", "#8a5a3c", "#c48a5a", "#e8b884"];
const ROPE = "#d8b878";

// --- Schrauber --------------------------------------------------------------------------

function schrauber(p: Pix): void {
  // Riesiger Schraubenschluessel schraeg auf dem Ruecken
  p.shape(thick(11, 42, 20, 10, 5), STEEL, { shade: 1 });
  p.shape(minus(ellipse(21, 7, 7, 6), poly(19, 6, 27, -2, 31, 4)), STEEL, { shade: 1 });
  p.shape(thick(9, 46, 12, 39, 6), STEEL, { shade: 1 });
  mechBody(p, { armor: BLUE, trim: YELLOW });
  // Werkzeuggurt mit Taschen
  p.shape(rect(21, 41, 22, 3), LEATHER, { shade: 0 });
  p.shape(rect(23, 42, 5, 5), LEATHER, { shade: 1 });
  p.shape(rect(36, 42, 5, 5), LEATHER, { shade: 1 });
  p.line(25, 40, 25, 38, STEEL[2]);
  neck(p);
  // Kantiger Helm
  p.shape(union(rect(19, 10, 23, 17), ellipse(30.5, 11, 11.5, 5)), BLUE, { shade: 3 });
  seam(p, 21, 20, 29, 20, BLUE);
  shine(p, 22, 12, 27, 8);
  // Schweissvisier, halb hochgeklappt
  p.shape(poly(31, 10, 47, 7, 49, 23, 32, 26), GRAY, { shade: 2 });
  p.shape(poly(35, 13, 46, 11, 47, 18, 36, 20), VISOR, { shade: 0 });
  p.hline(38, 45, 15, CYAN);
  p.hline(39, 44, 14, CYAN_LIGHT);
  p.shape(ellipse(31, 18, 2.6, 2.6), YELLOW, { shade: 1 });
  // Arbeitslampe oben auf dem Helm
  p.shape(rect(23, 3, 8, 5), YELLOW, { shade: 1 });
  p.hline(30, 31, 4, "#fff6c0");
  p.hline(30, 31, 5, "#fff6c0");
  // Nietkanone in der vorderen Hand
  p.shape(rect(43, 43, 14, 7), GRAY, { shade: 1 });
  p.shape(rect(56, 44, 7, 4), STEEL, { shade: 0 });
  p.shape(rect(47, 49, 5, 7), YELLOW, { shade: 1 });
  p.hline(48, 51, 51, YELLOW[0]);
  p.hline(48, 51, 53, YELLOW[0]);
  p.px(62, 45, "#fff6c0");
  bolt(p, 45, 45, GRAY);
}

// --- Kanonier ----------------------------------------------------------------------------

function kanonier(p: Pix): void {
  // Munitionskasten auf dem Ruecken
  p.shape(rect(9, 20, 12, 15), GRAY, { shade: 2 });
  hazard(p, rect(10, 30, 10, 3), 3);
  mechBody(p, { armor: BLUE_DEEP, trim: ORANGE, glow: [OUTLINE, ORANGE[1], ORANGE[2], ORANGE[3]] });
  // Munitionsgurt quer ueber die Brust
  for (let i = 0; i < 9; i += 1) {
    const x = 22 + i * 2;
    const y = 30 + i * 1.4;
    p.px(x, y, YELLOW[2]);
    p.px(x, y + 1, YELLOW[1]);
    p.px(x + 1, y + 1, LEATHER[1]);
  }
  neck(p);
  // Runder Helm mit Gesichtsplatte
  p.shape(ellipse(31, 18, 11.5, 10.5), BLUE_DEEP, { shade: 3 });
  p.shape(poly(30, 15, 44, 14, 45, 23, 31, 25), VISOR, { shade: 1 });
  p.hline(34, 40, 18, ORANGE[2]);
  seam(p, 21, 21, 28, 25, BLUE_DEEP);
  shine(p, 22, 13, 27, 10);
  // Zielmonokel
  p.line(39, 19, 43, 19, GRAY[2]);
  p.shape(ellipse(45, 18, 4.2, 4.2), GRAY, { shade: 1 });
  p.shape(ellipse(45, 18, 2.6, 2.6), RED_LENS, { shade: 1, edge: false });
  p.px(44, 17, "#ffffff");
  // Schulterkanone: Drehlager hinten, langer Lauf ueber dem Kopf
  p.shape(ellipse(17, 14, 6.5, 6.5), BLUE_DEEP, { shade: 2 });
  p.shape(thick(18, 9, 57, 4, 7), GRAY, { shade: 2 });
  p.shape(rect(54, 0, 8, 9), STEEL, { shade: 1 });
  p.fill(rect(60, 2, 2, 5), OUTLINE);
  for (const x of [30, 42]) {
    p.line(x, 4, x + 1, 11, GRAY[0]);
    p.line(x + 1, 4, x + 2, 11, GRAY[3]);
  }
  bolt(p, 16, 13, BLUE_DEEP);
  // Zuendlicht
  p.px(24, 7, ORANGE[3]);
}

// --- Brecher -----------------------------------------------------------------------------

function brecher(p: Pix): void {
  // Hydraulikkolben auf dem Ruecken
  p.shape(rect(10, 20, 5, 18), GRAY, { shade: 1 });
  p.shape(rect(11, 14, 3, 8), STEEL, { shade: 0 });
  mechBody(p, { armor: BLUE_DEEP, trim: SKY, bulk: 3, glow: [OUTLINE, YELLOW[1], YELLOW[2], YELLOW[3]] });
  // Breiter, tiefer Kopf mit Hoernern
  p.shape(rect(23, 22, 18, 8), GRAY, { shade: 1 });
  p.shape(poly(37, 13, 47, 6, 49, 9, 41, 17), WHITE, { shade: 1 });
  p.shape(poly(24, 13, 17, 5, 15, 8, 21, 16), WHITE, { shade: 1 });
  p.shape(union(ellipse(31, 18, 10.5, 8), rect(20, 16, 22, 10)), BLUE_DEEP, { shade: 2 });
  p.shape(rect(27, 17, 14, 4), VISOR, { shade: 0 });
  p.hline(30, 39, 19, YELLOW[2]);
  p.hline(31, 38, 18, YELLOW[3]);
  // Kinnschutz wie ein Pflug
  p.shape(poly(26, 23, 43, 22, 45, 27, 30, 28), GRAY, { shade: 1 });
  shine(p, 23, 13, 28, 11);
  // Kolben zum Rammschild
  p.shape(rect(44, 30, 9, 4), STEEL, { shade: 1 });
  p.shape(rect(44, 44, 9, 4), STEEL, { shade: 1 });
  // Rammschild vorn
  p.shape(poly(50, 18, 61, 21, 62, 55, 50, 58), BLUE, { shade: 2 });
  p.shape(poly(52, 22, 59, 24, 60, 44, 52, 45), SKY, { shade: 1 });
  hazard(p, poly(51, 47, 61, 46, 61, 55, 51, 57), 3);
  bolt(p, 53, 21, BLUE);
  bolt(p, 58, 23, BLUE);
  seam(p, 52, 34, 59, 34, SKY);
}

// --- Bergungslaeuferin ---------------------------------------------------------------------

function bergung(p: Pix): void {
  // Seilwinde auf dem Ruecken
  p.shape(rect(9, 28, 6, 12), GRAY, { shade: 1 });
  p.shape(ellipse(14, 30, 6.5, 7.5), GRAY, { shade: 2 });
  p.shape(ellipse(14, 30, 4, 5), [OUTLINE, "#8a6a3a", ROPE, "#f4e0b0"], { shade: 1, edge: false });
  for (const y of [27, 29, 31, 33]) {
    p.line(11, y, 17, y + 1, "#8a6a3a");
  }
  mechBody(p, { armor: SKY, trim: WHITE, bulk: -1 });
  neck(p);
  // Schal, weht nach hinten
  p.shape(poly(37, 25, 24, 24, 14, 22, 5, 25, 9, 29, 16, 28, 24, 31, 37, 31), SCARF, { shade: 1 });
  p.line(9, 26, 20, 26, SCARF[3]);
  // Runder Helm mit breiter Staubbrille und Stirnlampe
  p.shape(ellipse(31.5, 17, 11, 10), SKY, { shade: 3 });
  // Mundschutz mit Filter
  p.shape(poly(33, 21, 42, 21, 41, 27, 34, 27), WHITE, { shade: 1 });
  p.line(36, 23, 36, 25, WHITE[1]);
  p.line(39, 23, 39, 25, WHITE[1]);
  // Staubbrille: Band mit zwei runden Glaesern
  p.shape(rect(21, 13, 22, 6), LEATHER, { shade: 1 });
  p.shape(ellipse(34, 16, 3.6, 3.6), GRAY, { shade: 1 });
  p.shape(ellipse(40.5, 16, 3.6, 3.6), GRAY, { shade: 1 });
  p.shape(ellipse(34, 16, 2.3, 2.3), AMBER, { shade: 1, edge: false });
  p.shape(ellipse(40.5, 16, 2.3, 2.3), AMBER, { shade: 1, edge: false });
  p.px(33, 15, "#ffffff");
  p.px(40, 15, "#ffffff");
  p.shape(ellipse(28, 8, 3.4, 2.6), YELLOW, { shade: 1 });
  p.px(29, 7, "#fffbe0");
  shine(p, 23, 11, 27, 8);
  // Harpune vorn, Seil zurueck zur Winde
  p.shape(rect(41, 44, 12, 6), GRAY, { shade: 1 });
  p.shape(rect(52, 45, 7, 3), STEEL, { shade: 0 });
  p.shape(poly(58, 43, 64, 46.5, 58, 50), STEEL, { shade: 0 });
  for (let x = 20; x < 42; x += 3) {
    p.px(x, 40 + (x - 20) * 0.2, ROPE);
  }
}

// --- Funkerin ------------------------------------------------------------------------------

function funkerin(p: Pix): void {
  // Drohnen-Hangar auf dem Ruecken mit Antennenmast
  p.line(11, 18, 11, 2, GRAY[2]);
  p.line(12, 18, 12, 2, GRAY[1]);
  p.hline(8, 15, 6, GRAY[2]);
  p.px(11, 1, "#ff4a4a");
  p.px(12, 1, "#ff4a4a");
  p.shape(rect(6, 17, 15, 24), GRAY, { shade: 2 });
  for (const y of [20, 29]) {
    p.shape(rect(8, y, 11, 7), VISOR, { shade: 0 });
    p.shape(ellipse(13.5, y + 4, 3.5, 2), WHITE, { shade: 0 });
    p.px(15, y + 4, CYAN);
  }
  mechBody(p, { armor: WHITE, trim: SKY });
  neck(p);
  // Helm mit Panoramavisier und Headset
  p.shape(ellipse(31, 18, 11.5, 10.5), WHITE, { shade: 3 });
  p.shape(poly(27, 13, 46, 13, 47, 21, 28, 22), VISOR, { shade: 1 });
  p.hline(30, 45, 17, CYAN_DARK);
  p.hline(31, 44, 16, CYAN);
  for (const x of [33, 37, 41]) {
    p.px(x, 19, CYAN_DARK);
  }
  p.shape(ellipse(24, 19, 4, 5), GRAY, { shade: 1 });
  p.px(24, 19, CYAN);
  p.line(26, 23, 34, 26, GRAY[2]);
  shine(p, 22, 12, 27, 9);
  // Steuerpult in der vorderen Hand
  p.shape(rect(44, 45, 10, 6), GRAY, { shade: 1 });
  p.fill(rect(46, 46, 6, 3), CYAN_DARK);
  p.px(47, 46, CYAN_LIGHT);
  // Drohne fliegt vorn oben
  p.shape(ellipse(54, 9, 5.5, 3.2), WHITE, { shade: 1 });
  p.hline(46, 62, 4, GRAY[2]);
  p.line(54, 5, 54, 6, GRAY[1]);
  p.px(57, 9, CYAN);
  p.px(56, 13, CYAN_DARK);
}

// --- Sturmspringer --------------------------------------------------------------------------

function springer(p: Pix): void {
  // Sprungduesen mit Flammen
  p.shape(poly(8, 41, 15, 41, 12, 52), FIRE, { shade: 0, light: 0 });
  p.shape(poly(14, 40, 20, 40, 17, 49), FIRE, { shade: 0, light: 0 });
  p.fill(poly(10, 41, 13, 41, 12, 46), FIRE[3]);
  p.shape(union(rect(7, 22, 8, 19), ellipse(11, 22, 4, 2.5)), GRAY, { shade: 2 });
  p.shape(union(rect(13, 24, 7, 16), ellipse(16.5, 24, 3.5, 2.2)), GRAY, { shade: 2 });
  p.shape(rect(7, 38, 8, 3), STEEL, { shade: 0 });
  // Finnen
  p.shape(poly(18, 25, 1, 13, 4, 21, 15, 30), INDIGO, { shade: 1 });
  mechBody(p, { armor: INDIGO, trim: BLUE });
  neck(p);
  // Raubvogelhelm mit Schnabel nach vorn
  p.shape(poly(22, 10, 12, 2, 16, 2, 28, 8), BLUE, { shade: 1 });
  p.shape(union(ellipse(30, 17, 11, 10), poly(36, 11, 53, 19, 38, 26)), INDIGO, { shade: 3 });
  p.shape(poly(33, 15, 48, 18.5, 34, 21), VISOR, { shade: 0 });
  p.line(36, 17, 45, 18, CYAN);
  p.line(37, 16, 43, 17, CYAN_LIGHT);
  seam(p, 22, 20, 28, 25, INDIGO);
  shine(p, 22, 12, 28, 9);
  // Energielanze schraeg nach vorn oben
  p.shape(thick(34, 60, 58, 34, 3), GRAY, { shade: 0 });
  p.shape(poly(56, 32, 63, 25, 61, 36), [OUTLINE, CYAN_DARK, CYAN, CYAN_LIGHT], { shade: 1, edge: false });
  p.px(62, 27, "#ffffff");
  glowLight(p, 46, 46, 2, 2, [OUTLINE, CYAN_DARK, CYAN, CYAN_LIGHT]);
}

/** Malt einen Mech der Crew (64 x 64). */
export function paintCrew(id: CrewId): Pix {
  const p = new Pix(64, 64, 13);
  switch (id) {
    case "schrauber":
      schrauber(p);
      break;
    case "kanonier":
      kanonier(p);
      break;
    case "brecher":
      brecher(p);
      break;
    case "bergung":
      bergung(p);
      break;
    case "funkerin":
      funkerin(p);
      break;
    case "springer":
      springer(p);
      break;
  }
  p.outline(OUTLINE);
  return p;
}
