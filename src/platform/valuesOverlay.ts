/**
 * Zahlenanzeige fuer das Balancing, sichtbar mit `?debug=werte`.
 *
 * Bewusst ein normales HTML-Element ueber dem Spiel statt Text in einer
 * Phaser-Szene: Es muss nichts ueber Kameras, Zoom oder Szenenwechsel wissen,
 * und es kann die Spieldarstellung nicht durcheinanderbringen.
 */

import { SAFE, VIEWPORT } from "../config/constants";
import { appliedTuning, rejectedTuning } from "../config/tuning";
import { SHOW_VALUES } from "./debugFlags";

let element: HTMLDivElement | null = null;
let lastUpdate = 0;

export interface OverlayValues {
  fps: number;
  zone: number;
  enemies: number;
  projectiles: number;
  ammo: number;
  health: number;
  maxHealth: number;
  superCharge: number;
  /** Ausgeteilter Schaden je Sekunde, gemittelt ueber die Runde. */
  dps: number;
}

function ensureElement(): HTMLDivElement | null {
  if (!SHOW_VALUES) {
    return null;
  }
  if (element) {
    return element;
  }

  element = document.createElement("div");
  element.setAttribute("data-holdout-values", "");
  element.style.cssText = [
    "position:fixed",
    "left:8px",
    "top:8px",
    "z-index:40",
    "pointer-events:none",
    "font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
    "color:#dce8f7",
    "background:rgba(17,22,31,.82)",
    "border:1px solid rgba(220,232,247,.25)",
    "border-radius:6px",
    "padding:6px 8px",
    "white-space:pre",
    "max-width:60vw",
  ].join(";");
  document.body.appendChild(element);
  return element;
}

/**
 * Aktualisiert die Anzeige. Wird jedes Bild gerufen, schreibt aber nur
 * viermal je Sekunde - flackernde Zahlen kann niemand lesen.
 */
export function updateValuesOverlay(values: OverlayValues, now: number): void {
  const node = ensureElement();
  if (!node || now - lastUpdate < 250) {
    return;
  }
  lastUpdate = now;

  const lines = [
    // Damit sich aus der Ferne klaeren laesst, was ein Geraet ueberhaupt
    // meldet: Flaeche, Bildschirm und die verdeckten Raender (Notch,
    // Home-Indikator). Sind die Raender ueberall 0, meldet das Geraet keine -
    // dann liegt es nicht am Spiel.
    `Flaeche ${VIEWPORT.width}x${VIEWPORT.height}  Schirm ${window.innerWidth}x${window.innerHeight}`,
    `Rand o${SAFE.top} r${SAFE.right} u${SAFE.bottom} l${SAFE.left}`,
    `fps ${values.fps.toFixed(0).padStart(3)}   Zone ${values.zone}`,
    `Gegner ${String(values.enemies).padStart(2)}  Projektile ${String(values.projectiles).padStart(2)}`,
    `Leben ${Math.round(values.health)}/${values.maxHealth}  Munition ${values.ammo}`,
    `Super ${values.superCharge.toFixed(0)}%   Schaden/s ${values.dps.toFixed(0)}`,
  ];

  if (appliedTuning.length > 0) {
    lines.push("", "Werte aus der Adresse (nur dieses Geraet, nicht im Koop):");
    for (const entry of appliedTuning) {
      lines.push(`  ${entry}`);
    }
  }
  if (rejectedTuning.length > 0) {
    lines.push("", "Nicht uebernommen:");
    for (const entry of rejectedTuning) {
      lines.push(`  ${entry}`);
    }
  }

  node.textContent = lines.join("\n");
}

/** Blendet die Anzeige aus, wenn die Spielszene endet. */
export function hideValuesOverlay(): void {
  element?.remove();
  element = null;
}
