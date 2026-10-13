/**
 * Farbrampen der Pixel-Welt: je vier Toene [Kante, Schatten, Grundton, Licht].
 *
 * Helden sind blaue Mechs (kuehle Blau- und Cyan-Toene), Gegner die goldene
 * Untoten-Armee aus dem Zeitriss (Bronze, Knochen, Gold), dazu das Violett des Risses.
 */

import type { Ramp } from "./pix";

/** Umriss um jede Figur: fast schwarz, leicht violett. */
export const OUTLINE = "#120f1e";

// --- Helden (Mechs) --------------------------------------------------------------------
export const BLUE: Ramp = ["#1d2142", "#4a5596", "#7c8ad4", "#b9c4f4"];
export const BLUE_DEEP: Ramp = ["#171a36", "#3a4482", "#5a68b4", "#8f9ce0"];
export const SKY: Ramp = ["#1f2a48", "#5b77b0", "#93b2e6", "#d2e2ff"];
export const WHITE: Ramp = ["#2a2f4a", "#8890b0", "#d0d6ec", "#ffffff"];
export const INDIGO: Ramp = ["#100e24", "#2a2860", "#43449a", "#6c70c8"];
export const GRAY: Ramp = ["#14141e", "#2c2d3c", "#45475c", "#6a6d88"];
export const VISOR: Ramp = ["#0c1020", "#16203a", "#24345c", "#3c5288"];
export const ORANGE: Ramp = ["#3a1606", "#a8481a", "#e8822e", "#ffc070"];
export const YELLOW: Ramp = ["#3a2a06", "#b8861a", "#f0c03a", "#fff090"];
export const CYAN = "#5ff2e0";
export const CYAN_LIGHT = "#d0fff8";
export const CYAN_DARK = "#1f8f96";

// --- Gegner (goldene Armee) ----------------------------------------------------------
export const BRONZE: Ramp = ["#2e1c0c", "#7a5426", "#b88a46", "#e6c27a"];
export const GOLD: Ramp = ["#3a2408", "#a8761c", "#eab43a", "#fff2a0"];
export const BONE: Ramp = ["#2a2620", "#8c8270", "#d8cfb8", "#f6f1e2"];
export const CREST: Ramp = ["#4a4c5c", "#a8aec0", "#e2e6f0", "#ffffff"];
export const CREST_RED: Ramp = ["#3c0e12", "#8e2028", "#c8383a", "#ee6a5a"];
export const LEATHER: Ramp = ["#24160c", "#5a3a20", "#86582e", "#b07c48"];
export const CLOTH_RED: Ramp = ["#2e0a10", "#6e1a24", "#a02c32", "#cc4c48"];
export const DEMON: Ramp = ["#0e0a14", "#2a2236", "#463a58", "#6a5a82"];
export const WOLF: Ramp = ["#0c0c12", "#23232e", "#3a3a4a", "#5a5a6e"];
export const STEEL: Ramp = ["#20222c", "#6a7080", "#aab0c0", "#e6eaf2"];
export const WOOD: Ramp = ["#22140a", "#5a3a1e", "#86582c", "#b08048"];

// --- Zeitriss, Feuer, Welt ---------------------------------------------------------------
export const RIFT: Ramp = ["#1e0a30", "#5a2690", "#9a52e0", "#d6a8ff"];
export const FIRE: Ramp = ["#3a0c04", "#c43a14", "#f08a28", "#ffe070"];
export const SAND: Ramp = ["#5a4428", "#a88a5c", "#c8aa76", "#e6cc98"];
export const MARBLE: Ramp = ["#4a4656", "#9a96a6", "#c8c4d0", "#ecebf2"];
export const STONE: Ramp = ["#2a2632", "#5a5466", "#7e788c", "#a49eb2"];
export const GRASS: Ramp = ["#1a2a14", "#3e5a2a", "#5e7e3a", "#86a650"];
export const EYE_RED = "#ff3b3b";
export const EYE_VIOLET = "#e08aff";

// --- Weitere Namen (Waffen, Welt, aeltere Teile) -------------------------------------------
export const OUT = OUTLINE;
export const RED_EYE = EYE_RED;
export const VIOLET = RIFT;
export const RED = CREST_RED;
export const FUR = WOLF;
export const MECH = BLUE;
export const MECH_DARK = GRAY;
export const MECH_PALE = WHITE;
export const HAZARD = YELLOW;
export const CYAN_HOT = CYAN_LIGHT;
export const ORANGE_HOT = "#ffd27a";
export const ORANGE_GLOW = "#ff8a2a";
export const GREEN = "#6cf27a";
export const MAGENTA = "#ff5ad2";
