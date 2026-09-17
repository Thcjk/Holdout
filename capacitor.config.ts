/**
 * Capacitor packt das fertige Web-Spiel in eine echte Android-App.
 *
 * Technisch ist das eine App mit einer einzigen WebView, die den Inhalt von
 * `dist/` aus dem App-Paket laedt - nicht aus dem Internet. Deshalb startet die
 * App auch offline, und deshalb muss `npm run build` vor jedem `cap sync` laufen.
 */

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Umgekehrte Domain, so verlangt es Android. Sie muss eindeutig sein und
  // darf sich nach der ersten Veroeffentlichung nicht mehr aendern.
  appId: "ch.thcjk.arenashooter",
  appName: "Koop-Arena-Shooter",
  webDir: "dist",
  android: {
    // Der Hintergrund, der waehrend des Ladens zu sehen ist. Ohne ihn blitzt
    // kurz Weiss auf - das faellt bei einem dunklen Spiel sofort auf.
    backgroundColor: "#11161f",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
