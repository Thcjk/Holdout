/**
 * Kurze Texte zu den Modulen fuer die Bau-Ansicht: was es auf einer Stufe kann.
 */

import { MODULES, stat } from "../game/data/modules";
import type { ModuleId } from "../game/types";

const ROMAN = ["", "I", "II", "III"];

export function levelName(level: number): string {
  return ROMAN[level] ?? String(level);
}

function seconds(value: number): string {
  return value.toFixed(1).replace(".", ",");
}

/** Die wichtigsten Werte auf einer Stufe, eine Zeile. */
export function moduleStats(type: ModuleId, level: number): string {
  const m = MODULES[type];
  const damage = stat(m.damage, level);
  const cooldown = seconds(stat(m.cooldown, level));
  const range = stat(m.range, level);
  const area = stat(m.area, level);
  const power = stat(m.power, level);
  switch (type) {
    case "geschuetz":
      return `Schaden ${damage} · alle ${cooldown} s · Reichweite ${range}`;
    case "harpune":
      return `Schaden ${damage} · alle ${cooldown} s · Reichweite ${range}`;
    case "moerser":
      return `Schaden ${damage} im Umkreis ${area} · alle ${cooldown} s`;
    case "spule":
      return `Schaden ${damage} · springt auf ${area} Gegner · alle ${cooldown} s`;
    case "platte":
      return `+${power} Rumpf`;
    case "oel":
      return `${power} Schaden pro Sekunde unter der Kante`;
    case "generator":
      return `Nachbarn feuern ${Math.round(power * 100)} % schneller`;
    case "magnet":
      return `zieht Schrott aus ${power} Pixeln Umkreis`;
    case "motor":
      return `Festung ${Math.round(power * 100)} % schneller`;
    case "werkstatt":
      return `+${seconds(power)} Rumpf pro Sekunde im Marsch`;
  }
}
