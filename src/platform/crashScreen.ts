/**
 * Fehler sichtbar machen, statt auf eine leere Fläche zu schauen.
 *
 * Warum das hier steht: Wenn beim Start etwas schiefgeht, zeigt der Browser
 * einfach die Hintergrundfarbe - ein blaues Bild, sonst nichts. Auf dem eigenen
 * Rechner sieht man die Ursache in der Entwicklerkonsole, auf einem fremden
 * Handy nicht. Dann bleibt nur Raten, und Raten hat dieses Spiel schon zweimal
 * kaputtgemacht.
 *
 * Deshalb: Jeder unbehandelte Fehler landet als Text auf dem Bildschirm, mit
 * einem Knopf, der den Zwischenspeicher leert. Der deckt gleich die zweite
 * häufige Ursache ab - ein Service Worker, der eine halb aktualisierte Version
 * ausliefert.
 *
 * Diese Datei wird als ALLERERSTES geladen, sonst fängt sie den Fehler nicht,
 * der sie selbst verhindert hätte.
 */

const BACKGROUND = "#11161f";
const TEXT = "#dce8f7";
const ACCENT = "#e4572e";

let shown = false;

export function installCrashScreen(version: string): void {
  window.addEventListener("error", (event) => {
    show(describe(event.error) || event.message, version);
  });

  window.addEventListener("unhandledrejection", (event) => {
    show(describe(event.reason), version);
  });
}

function describe(reason: unknown): string {
  if (reason instanceof Error) {
    return `${reason.name}: ${reason.message}`;
  }
  if (typeof reason === "string") {
    return reason;
  }
  return "Unbekannter Fehler";
}

/** Nur der erste Fehler zählt - die folgenden sind meist Folgefehler. */
function show(message: string, version: string): void {
  if (shown) {
    return;
  }
  shown = true;

  const page = document.createElement("div");
  page.setAttribute(
    "style",
    `position:fixed;inset:0;z-index:9999;overflow:auto;
     display:flex;flex-direction:column;align-items:center;justify-content:center;
     gap:16px;padding:24px;box-sizing:border-box;background:${BACKGROUND};
     color:${TEXT};font-family:system-ui,sans-serif;text-align:center;`,
  );

  page.appendChild(line("Das Spiel konnte nicht starten.", "19px", "700", ACCENT));
  page.appendChild(
    line(
      "Das ist ein Fehler im Spiel, nicht an deinem Gerät. Schick den Text unten weiter, dann lässt er sich beheben.",
      "14px",
      "400",
      "#8ea6c4",
    ),
  );

  const details = document.createElement("pre");
  details.textContent = `${message}\n\nVersion ${version}\n${navigator.userAgent}`;
  details.setAttribute(
    "style",
    `max-width:560px;width:100%;margin:0;padding:12px;box-sizing:border-box;
     background:#1e2734;border-radius:10px;color:${TEXT};font-size:12px;
     text-align:left;white-space:pre-wrap;word-break:break-word;`,
  );
  page.appendChild(details);

  page.appendChild(button("Zwischenspeicher leeren und neu laden", () => void hardReload()));

  document.body.appendChild(page);
}

function line(text: string, size: string, weight: string, color: string): HTMLElement {
  const element = document.createElement("div");
  element.textContent = text;
  element.setAttribute(
    "style",
    `font-size:${size};font-weight:${weight};color:${color};max-width:560px;line-height:1.5;`,
  );
  return element;
}

function button(text: string, onClick: () => void): HTMLElement {
  const element = document.createElement("button");
  element.textContent = text;
  element.setAttribute(
    "style",
    `padding:12px 20px;border:none;border-radius:10px;background:#4cc2ff;
     color:#11161f;font:600 15px system-ui,sans-serif;cursor:pointer;`,
  );
  element.addEventListener("click", onClick);
  return element;
}

/**
 * Service Worker abmelden, Zwischenspeicher leeren, neu laden.
 *
 * Das behebt den Fall, dass eine alte, zwischengespeicherte Version mit einer
 * neuen nicht zusammenpasst - auf dem Handy die häufigste Ursache für eine
 * Seite, die einfach nicht mehr startet.
 */
export async function hardReload(): Promise<void> {
  try {
    const registrations = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Kein Service Worker vorhanden oder nicht erlaubt - dann eben nicht.
  }

  try {
    const keys = (await caches?.keys?.()) ?? [];
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // Kein Zugriff auf den Zwischenspeicher - das Neuladen hilft trotzdem oft.
  }

  window.location.reload();
}
