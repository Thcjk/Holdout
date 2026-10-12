/**
 * Die Farbpalette des Spiels: duester, hart, wenig Farbe.
 *
 * Fast schwarze Tinte, kuehles Stahlgrau, Knochenweiss fuer Text und Licht,
 * Blutrot und Bernstein als einzige kraeftige Akzente. Alles Gezeichnete
 * (Figuren, Waffen, Oberflaeche, Logo) nimmt die Farben von hier.
 */

export const NOIR = {
  ink: "#0a0910",
  night: "#12131c",
  steel0: "#1b1f2b",
  steel1: "#2a3040",
  steel2: "#3d4658",
  steel3: "#5b667c",
  bone: "#e9e4d4",
  boneDark: "#b9b19b",
  blood: "#c4262e",
  bloodDark: "#7c1219",
  amber: "#e8a317",
  amberDark: "#a56a0c",
  teal: "#3fb7b0",
  toxic: "#8fbf3f",
  violet: "#7a4fd0",
} as const;

/** Dieselben Farben als Zahlen fuer Phasers Graphics. */
export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}
