/**
 * Installation als App - der Weg zum "Herunterladen" ohne Store.
 *
 * Android/Chrome: Der Browser meldet mit `beforeinstallprompt`, dass er das
 * Spiel installieren koennte. Dieses Ereignis muss abgefangen werden, bevor
 * irgendetwas anderes laeuft - es kommt genau einmal und sehr frueh. Deshalb
 * haengt der Empfaenger hier im Modulrumpf und nicht in einer Szene.
 *
 * iPhone: Safari kennt `beforeinstallprompt` nicht. Dort geht Installation nur
 * ueber "Teilen -> Zum Home-Bildschirm", also ueber eine Anleitung.
 */

import { isInstalledApp, isIos } from "./device";

/** Das abgefangene Browser-Ereignis. Nicht in den Standard-Typen enthalten. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pendingPrompt: InstallPromptEvent | null = null;
let installed = false;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Das voreingestellte Banner unterdruecken - wir fragen selbst, an einer
    // Stelle, an der es passt (im Menue statt mitten im Gefecht).
    event.preventDefault();
    pendingPrompt = event as InstallPromptEvent;
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    pendingPrompt = null;
  });
}

/** Kann der Browser das Spiel auf Knopfdruck installieren? */
export function canPromptInstall(): boolean {
  return pendingPrompt !== null && !installed && !isInstalledApp();
}

/** Braucht dieses Geraet stattdessen eine Anleitung? */
export function needsManualInstructions(): boolean {
  return !installed && !isInstalledApp() && !canPromptInstall() && isIos();
}

/**
 * Fragt den Browser nach der Installation.
 * @returns true, wenn der Nutzer zugestimmt hat.
 */
export async function promptInstall(): Promise<boolean> {
  const prompt = pendingPrompt;
  if (!prompt) {
    return false;
  }

  // Das Ereignis laesst sich nur einmal verwenden.
  pendingPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;

  if (choice.outcome === "accepted") {
    installed = true;
    return true;
  }
  return false;
}

/** Anleitung fuer Geraete ohne Installationsknopf. */
export function manualInstructions(): string[] {
  if (isIos()) {
    return [
      "1. Unten auf das Teilen-Symbol tippen",
      "2. „Zum Home-Bildschirm“ wählen",
      "3. Bestätigen – fertig",
    ];
  }

  return [
    "1. Browsermenü öffnen (drei Punkte)",
    "2. „App installieren“ oder „Zum Startbildschirm“ wählen",
    "3. Bestätigen – fertig",
  ];
}
