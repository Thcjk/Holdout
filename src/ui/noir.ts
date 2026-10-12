/**
 * Die Farbpalette des Spiels: handgemalt, gedaempft, warm - wie ein Maerchenbuch-Poster.
 *
 * Dunkle Tinte, Teal und Salbei, Creme fuer Papier und Text,
 * Rost und Senfgelb als Akzente. (Die Namen stammen aus der duesteren Fassung.) Alles Gezeichnete
 * (Figuren, Waffen, Oberflaeche, Logo) nimmt die Farben von hier.
 */

export const NOIR = {
  ink: "#1d1c19",
  night: "#242a2b",
  steel0: "#2c3a3c",
  steel1: "#3e5558",
  steel2: "#587a7c",
  steel3: "#7f9c98",
  bone: "#f0e4c8",
  boneDark: "#cdbf9b",
  blood: "#b5532f",
  bloodDark: "#7d3519",
  amber: "#dba636",
  amberDark: "#a87a1c",
  teal: "#4f9aa0",
  toxic: "#8da64f",
  violet: "#6a5f8f",
} as const;

/** Dieselben Farben als Zahlen fuer Phasers Graphics. */
export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}
