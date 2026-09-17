/**
 * Ein Protokoll des Verbindungsaufbaus - sichtbar auf dem Handy.
 *
 * WARUM NICHT EINFACH `console.log`: Auf einem iPhone gibt es keine Konsole.
 * Ein Fehler, der nur beim Verbinden zweier echter Geraete auftritt, laesst
 * sich damit nicht untersuchen - genau der Fall, um den es hier geht. Also
 * landen die Zeilen in einem Ringpuffer und werden mit `?debug=netz` auf dem
 * Bildschirm angezeigt.
 *
 * Zusaetzlich geht alles auch an die Konsole, damit es am Rechner bequem
 * bleibt.
 */

/** So viele Zeilen werden aufgehoben. Aeltere fallen hinten raus. */
const MAX_LINES = 60;

const lines: string[] = [];
let listener: (lines: readonly string[]) => void = () => {};
const startedAt = Date.now();

/**
 * Macht unsichtbare Unterschiede sichtbar.
 *
 * Ein Raumcode, der "richtig aussieht", kann ein Leerzeichen, ein
 * geschuetztes Leerzeichen oder einen Buchstaben aus einem anderen Alphabet
 * enthalten - auf dem Bildschirm sieht man das nicht. Deshalb wird neben dem
 * Text auch die Laenge und jeder Zeichencode ausgegeben.
 */
export function describeString(label: string, value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return `${label}=<nichts>`;
  }
  const codes = [...value].map((character) => character.codePointAt(0) ?? 0);
  return `${label}="${value}" (${value.length} Zeichen) [${codes.join(" ")}]`;
}

export function netLog(message: string): void {
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(2);
  const line = `${seconds.padStart(6)}s ${message}`;
  lines.push(line);
  if (lines.length > MAX_LINES) {
    lines.shift();
  }
  console.log(`[netz] ${line}`);
  listener(lines);
}

export function onNetLog(handler: (lines: readonly string[]) => void): void {
  listener = handler;
  handler(lines);
}

export function netLogLines(): readonly string[] {
  return lines;
}
