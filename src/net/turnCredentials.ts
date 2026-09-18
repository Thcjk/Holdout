/**
 * TURN-Zugangsdaten beim Anbieter abholen, statt sie fest einzutragen.
 *
 * WARUM UEBERHAUPT? In `peerConfig.ts` stehen oeffentliche Open-Relay-Daten,
 * die jeder mitbenutzen darf. Sie funktionieren, teilen sich aber ein
 * gemeinsames Kontingent mit allen anderen, die sie benutzen - ist es
 * aufgebraucht, geht die Verbindung nicht mehr, und man sieht nicht warum.
 * Mit einem eigenen Schluessel bekommt man ein eigenes Kontingent und kann
 * beim Anbieter nachsehen, wie viel davon verbraucht ist.
 *
 * ================================================================
 * WICHTIG, UND ES KLINGT ANDERS ALS ES IST:
 * DER SCHLUESSEL IST IN DER AUSGELIEFERTEN APP NICHT GEHEIM.
 * ================================================================
 *
 * Er steht in einer `.env`-Datei, die nicht ins Repo geht - das ist richtig
 * und verhindert, dass er in der Git-Historie landet, aus der man ihn nie
 * wieder herausbekommt. Aber: Vite setzt jeden `VITE_*`-Wert beim BAUEN fest
 * in das JavaScript ein, das an die Handys ausgeliefert wird. Holdout ist eine
 * statische Seite ohne eigenen Server - es gibt keinen Ort, an dem ein
 * Geheimnis bleiben koennte. Wer die Seite oeffnet und in die Dateien schaut,
 * findet den Schluessel.
 *
 * Was man daraus mitnehmen sollte:
 *   - Nur einen Schluessel mit Gratis-Kontingent verwenden, nie einen mit
 *     hinterlegter Zahlung.
 *   - Beim Anbieter gelegentlich die Nutzung ansehen.
 *   - Wird er missbraucht: beim Anbieter zurueckziehen, neuen erzeugen, neu
 *     bauen. Genau dafuer ist die Umgebungsvariable da.
 *
 * Wirklich geheim ginge nur mit einem kleinen eigenen Server, der die Daten
 * ausgibt - und der passt nicht zu "statische Seite auf GitHub Pages".
 */

import { netLog } from "./netLog";
import { ICE_SERVERS } from "./peerConfig";

/**
 * Zugangsdaten des Anbieters. Beides kommt aus `.env`, siehe `.env.example`.
 *
 * `import.meta.env` ist Vites Weg, an Umgebungsvariablen zu kommen. Nur Namen
 * mit dem Praefix `VITE_` werden ueberhaupt eingesetzt - alles andere bleibt
 * absichtlich draussen, damit nicht versehentlich Serverdaten im Browser
 * landen.
 */
const API_KEY = import.meta.env.VITE_TURN_API_KEY as string | undefined;

/**
 * Name der TURN-App beim Anbieter. Er bildet den Abrufpfad
 * `https://<name>.metered.live/...` und ist kein Geheimnis - deshalb ein
 * Standardwert, falls der Eintrag in `.env` fehlt. Nur der Schluessel ist
 * zwingend: Ohne ihn wird gar nicht erst abgerufen.
 */
const APP_NAME = (import.meta.env.VITE_TURN_APP as string | undefined) ?? "holdout-turn";

/**
 * Wie lange auf den Abruf gewartet wird.
 *
 * Kurz gehalten: Das hier steht zwischen "Raum erstellen" getippt und "Raum
 * ist da". Haengt der Anbieter, soll das Spiel nach vier Sekunden mit den
 * bisherigen Daten weitermachen, statt den Spieler warten zu lassen.
 */
const FETCH_TIMEOUT_MS = 4000;

/**
 * Einmal geholte Daten fuer die restliche Sitzung.
 *
 * Als Promise gespeichert, nicht als Ergebnis: Fragen zwei Stellen
 * gleichzeitig (Host oeffnet Raum, Lobby baut sich auf), warten beide auf
 * denselben Abruf, statt zwei zu starten.
 */
let cached: Promise<RTCIceServer[]> | null = null;

/** Sind eigene Zugangsdaten hinterlegt? Nur fuer die Protokollausgabe. */
export function hasOwnTurnKey(): boolean {
  return Boolean(API_KEY);
}

/**
 * Die ICE-Server fuer diese Sitzung - moeglichst die eigenen, sonst die
 * oeffentlichen.
 *
 * Faellt der Abruf aus, wird NICHT abgebrochen: Dann gelten die Daten aus
 * `peerConfig.ts`. Eingeschraenkt zu funktionieren ist besser, als wegen einer
 * fehlgeschlagenen Nebensaechlichkeit gar nicht zu starten - und im selben
 * WLAN braucht es TURN ohnehin meist nicht.
 */
export function ensureIceServers(): Promise<RTCIceServer[]> {
  cached ??= loadIceServers();
  return cached;
}

/**
 * Baut den Abrufpfad zusammen.
 *
 * Der Schluessel steckt als Parameter drin, nicht fest im Text - genau das ist
 * der Zweck der Umgebungsvariablen. `encodeURIComponent` ist Pflicht und nicht
 * Zierde: Enthielte ein Schluessel ein `&`, wuerde die Adresse ohne ihn an
 * dieser Stelle auseinanderfallen.
 */
export function credentialsUrl(appName: string, apiKey: string): string {
  return `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
}

/**
 * Fuegt die abgerufenen Server mit dem oeffentlichen STUN-Eintrag zusammen.
 *
 * STUN zuerst, weil es der billigste Weg ist: Klappt die Verbindung direkt,
 * wird gar kein TURN gebraucht und kein Kontingent verbraucht. WebRTC probiert
 * ohnehin alle Wege und nimmt den besten - die Reihenfolge ist eine
 * Absichtserklaerung, keine Vorgabe.
 */
export function mergeWithStun(fetched: readonly RTCIceServer[]): RTCIceServer[] {
  return [{ urls: "stun:stun.l.google.com:19302" }, ...fetched];
}

async function loadIceServers(): Promise<RTCIceServer[]> {
  if (!API_KEY) {
    netLog("TURN: kein eigener Schluessel hinterlegt - oeffentliche Open-Relay-Daten");
    return ICE_SERVERS;
  }

  const url = credentialsUrl(APP_NAME, API_KEY);

  try {
    const fetched = await fetchIceServers(url);
    if (fetched.length === 0) {
      netLog("TURN: Abruf lieferte keine Server - oeffentliche Daten");
      return ICE_SERVERS;
    }

    const servers = mergeWithStun(fetched);
    netLog(`TURN: ${fetched.length} eigene Server abgerufen`);
    return servers;
  } catch (error) {
    // Kein Netz, Anbieter nicht erreichbar, Schluessel abgelaufen - in jedem
    // dieser Faelle ist Weiterspielen besser als Abbrechen.
    netLog(`TURN: Abruf fehlgeschlagen (${describeError(error)}) - oeffentliche Daten`);
    return ICE_SERVERS;
  }
}

/**
 * Holt die Server ab, mit Zeitbegrenzung.
 *
 * `fetch` kennt von sich aus keine Frist: Antwortet der Server nie, wartet es
 * ewig. `AbortController` ist der vorgesehene Weg, das abzubrechen.
 *
 * `fetchImpl` ist die Naht fuer den Test: Der echte Endpunkt ist aus der
 * Entwicklungsumgebung gesperrt, und ein Test, der vom Netz abhaengt, ist
 * ohnehin kein Test, sondern eine Wettervorhersage.
 */
export async function fetchIceServers(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RTCIceServer[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    return toIceServers(data);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Antwort des Anbieters in das Format bringen, das WebRTC erwartet.
 *
 * Geprueft wird jeder Eintrag einzeln, statt der Antwort zu vertrauen: Ein
 * fehlendes `urls`-Feld faellt hier auf und nicht erst als stiller
 * Verbindungsfehler auf dem Handy. Das ist fremder Inhalt aus dem Netz - er
 * bekommt dieselbe Skepsis wie jede andere Eingabe.
 */
export function toIceServers(data: unknown): RTCIceServer[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const servers: RTCIceServer[] = [];
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const urls = record.urls;
    if (typeof urls !== "string" && !Array.isArray(urls)) {
      continue;
    }

    const server: RTCIceServer = { urls: urls as string | string[] };
    if (typeof record.username === "string") {
      server.username = record.username;
    }
    if (typeof record.credential === "string") {
      server.credential = record.credential;
    }
    servers.push(server);
  }
  return servers;
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Zeitueberschreitung";
  }
  return error instanceof Error ? error.message : String(error);
}
