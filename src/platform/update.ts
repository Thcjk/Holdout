/**
 * Selbst-Aktualisierung der installierten App.
 *
 * Hintergrund: Die App auf dem Startbildschirm ist eine PWA - eine Website, die
 * ein "Service Worker" (ein kleines Programm, das der Browser neben der Seite
 * laufen laesst) offline verfuegbar haelt. Der Service Worker liefert die
 * gespeicherten Dateien aus. Ohne Zutun merkt er erst beim naechsten kompletten
 * Neustart, dass es eine neue Version gibt - und "kompletter Neustart" passiert
 * auf dem Handy selten, weil Apps im Hintergrund nur eingefroren werden.
 *
 * Dieses Modul sorgt dafuer, dass das Spiel von selbst aktuell bleibt:
 *
 * 1. Es fragt regelmaessig nach, ob eine neue Version bereitliegt.
 * 2. Wenn ja, laedt der Service Worker sie im Hintergrund - und zwar nur die
 *    Dateien, die sich wirklich geaendert haben. Phaser wiegt gut anderthalb
 *    Megabyte und wird nur neu geladen, wenn es sich tatsaechlich aendert.
 * 3. Neu geladen wird die Seite erst, wenn es gerade nicht stoert - also nie
 *    mitten in einer Runde.
 *
 * Niemand muss die App dafuer loeschen und neu hinzufuegen.
 */

// Wie oft nachgefragt wird, solange die App im Vordergrund ist.
const CHECK_INTERVAL_MS = 60_000;

// Darf gerade neu geladen werden? Nur im Hauptmenue. Mitten in einer Runde
// waere ein Neustart der Verlust der Runde, im Ergebnisbildschirm wuerde er die
// erreichte Punktzahl wegwischen, bevor man sie gelesen hat, und in der Lobby
// wuerde er den Raum verlassen.
let reloadSafe = false;

// Neue Version liegt bereit und wartet nur noch auf einen guten Moment.
let updateWaiting = false;

// Schutz gegen eine Schleife aus "neu laden -> neu laden -> ...".
let reloading = false;

/**
 * Meldet, ob ein Neustart gerade unbedenklich waere. Jede Szene sagt das beim
 * Start selbst: das Menue `true`, alle anderen `false`. Kommt man ins Menue
 * zurueck und wartet eine neue Version, wird genau dann geladen.
 */
export function setReloadSafe(safe: boolean): void {
  reloadSafe = safe;
  if (safe) applyIfReady();
}

/** Laedt neu, sobald es gefahrlos ist - also im Menue. */
function applyIfReady(): void {
  if (!updateWaiting || !reloadSafe || reloading) return;
  reloading = true;
  // location.reload() genuegt: Der neue Service Worker hat die Kontrolle bereits
  // uebernommen und liefert ab jetzt die neuen Dateien aus.
  window.location.reload();
}

/**
 * Startet die Ueberwachung. Wird aus `main.ts` aufgerufen, nachdem das Spiel
 * lief - ein Fehler hier darf den Start nie verhindern, deshalb ist alles in
 * try/catch und hinter Existenzpruefungen.
 */
export function startUpdateWatch(): void {
  if (!("serviceWorker" in navigator)) return;

  // Gab es beim Laden schon einen Service Worker? Beim allerersten Besuch nicht.
  // Der Unterschied ist wichtig: Uebernimmt zum ersten Mal einer die Kontrolle,
  // ist das keine Aktualisierung, sondern die Erstinstallation - dann waere ein
  // Neuladen unnoetig und wuerde nur als Ruckler auffallen.
  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    updateWaiting = true;
    applyIfReady();
  });

  void navigator.serviceWorker.ready
    .then((registration) => {
      const check = (): void => {
        // Ohne Netz hat Nachfragen keinen Zweck.
        if (navigator.onLine === false) return;
        void registration.update().catch(() => {
          // Kein Netz, Server nicht erreichbar - beim naechsten Mal wieder.
        });
      };

      // Regelmaessig, solange die App sichtbar ist.
      window.setInterval(() => {
        if (document.visibilityState === "visible") check();
      }, CHECK_INTERVAL_MS);

      // Und zusaetzlich immer dann, wenn die App wieder in den Vordergrund
      // kommt. Genau das ist der haeufigste Fall auf dem Handy: Die App war
      // tagelang eingefroren und wird wieder geoeffnet.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      window.addEventListener("online", check);

      check();
    })
    .catch(() => {
      // Kein Service Worker registriert (z. B. ohne HTTPS) - dann gibt es auch
      // nichts zu aktualisieren.
    });
}
