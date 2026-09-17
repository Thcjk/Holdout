/**
 * Querformat, soweit das Geraet es zulaesst.
 *
 * Es gibt genau einen sauberen Weg, eine Seite ins Querformat zu zwingen:
 * `screen.orientation.lock`. Android kann das, sobald die Seite als App
 * installiert ist (im Browser-Tab nicht). **iOS Safari kann es nicht** - weder
 * im Browser noch als App auf dem Startbildschirm.
 *
 * Fuer iOS gab es hier schon einmal einen zweiten Weg: das Bild per CSS um 90
 * Grad drehen. Der ist entfernt, und das mit Absicht - die Erfahrung steht in
 * CLAUDE.md. Kurz: CSS dreht das Bild, aber nicht die Finger, und Phaser misst
 * den gedrehten Rahmen falsch. Beides liess sich reparieren, aber das Ergebnis
 * war fragil, und als parallel der Basispfad kaputtging, war nicht mehr zu
 * trennen, was woran lag.
 *
 * Deshalb jetzt ehrlich statt trickreich:
 *
 *   - Wo die Sperre geht, wird gesperrt.
 *   - Wo sie nicht geht, bleibt im Hochformat ein Hinweisstreifen stehen
 *     ("Quer halten fuer das volle Bild"). Er blendet das Spiel NICHT aus -
 *     eine Sperre im Hochformat war die alte Sackgasse fuer alle mit
 *     aktivierter Rotationssperre.
 *   - Im PWA-Manifest steht `orientation: landscape`. Android beachtet das beim
 *     Start der installierten App, iOS ignoriert es.
 */

/** Versucht die Sperre. Schlaegt sie fehl, ist das kein Fehler - nur ein Nein. */
export function lockLandscape(): void {
  try {
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;
    // `lock` gibt es nicht ueberall, und wo es existiert, lehnt es oft ab
      // (nicht im Vollbild, nicht installiert, iOS grundsaetzlich).
    void orientation?.lock?.("landscape").catch(() => {
      /* Nein ist eine gueltige Antwort. Der Hinweisstreifen uebernimmt. */
    });
  } catch {
    /* Kein screen.orientation - dann eben nicht. */
  }
}
