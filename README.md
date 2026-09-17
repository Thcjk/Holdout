# Koop-Arena-Shooter

Top-down-Arena-Shooter fürs Handy: 1–4 Spieler halten gemeinsam gegen immer
stärkere Gegnerwellen durch.

> **Das Spiel läuft nur auf Handys und Tablets.** Am Desktop startet es nicht,
> sondern zeigt einen QR-Code zum Öffnen auf dem Handy. Die ganze Steuerung
> besteht aus zwei Daumen – mit Maus und Tastatur wäre sie nicht schlechter,
> sondern falsch bedienbar.

## Installieren

**Android – App herunterladen**

1. [Releases](https://github.com/Thcjk/thistle-and-crown/releases) öffnen und
   die Datei `koop-arena-shooter.apk` auf dem Handy herunterladen
2. Beim Öffnen fragt Android einmalig nach der Erlaubnis, Apps aus dieser
   Quelle zu installieren – bestätigen
3. Installieren, fertig

**Android und iPhone – ohne Store, direkt aus dem Browser**

1. https://thcjk.github.io/thistle-and-crown/ auf dem Handy öffnen
2. Android: im Menü auf **App installieren** tippen.
   iPhone: **Teilen → Zum Home-Bildschirm**
3. Danach startet das Spiel ohne Browserleisten und auch ohne Internet

Für iPhones gibt es keine App-Datei: Eine iOS-App braucht einen Mac und ein
Apple-Entwicklerkonto. Der Weg über den Home-Bildschirm liefert dort dasselbe
Ergebnis.

## Was drin ist

- Drei Charaktere, die sich grundlegend anders spielen: **Scout** (beweglich,
  Fächerschuss), **Tank** (Schrotschuss, hält aus), **Sniper** (Reichweite,
  Durchschuss) – jeder mit eigener Super-Fähigkeit
- Wellensystem mit steigender Schwierigkeit, drei Gegnertypen, Boss alle fünf
  Wellen, Score und lokaler Rekord
- Fähigkeiten aufwerten: Für jede geschaffte Welle ein Punkt, verteilbar auf
  Waffe, Panzerung, Tempo oder Super – je fünf Stufen
- Twin-Stick-Touchsteuerung: schwebender Joystick links, Zielen und Schiessen
  rechts, Super-Knopf
- Koop über WebRTC mit sechsstelligem Raumcode, bis zu vier Spieler
- Als Android-App zum Herunterladen und als installierbare Website; solo läuft
  beides ohne Internet

## Steuerung

| Eingabe                  | Wirkung                                                      |
| ------------------------ | ------------------------------------------------------------ |
| Linker Daumen            | Laufen (Joystick erscheint, wo du hintippst)                 |
| Rechter Daumen           | Ziehen zielt, Loslassen feuert; nur Tippen zielt automatisch |
| Super-Knopf unten rechts | Super-Fähigkeit (leuchtet, wenn geladen)                     |
| `W` `A` `S` `D`          | Laufen                                                       |
| Maus                     | Zielen, Linksklick feuert                                    |
| Leertaste                | Super                                                        |
| `Esc`                    | zurück ins Menü                                              |

## Technik

TypeScript · Vite · Phaser 3 · PeerJS · Capacitor · vite-plugin-pwa · Vitest ·
ESLint · Prettier · GitHub Actions / Pages

Die Simulation läuft mit festem Takt (30 Ticks pro Sekunde) und ist strikt von
der Darstellung getrennt: Alles unter `src/systems/` ist reine Logik ohne Phaser.
Deshalb kann im Koop ein Gerät die Runde für alle rechnen, und deshalb spielen
die Tests ganze Runden ohne Browser durch. Warum das die wichtigste Entscheidung
im Projekt ist, steht in `CLAUDE.md`.

## Voraussetzungen

- Node.js 20 oder neuer
- npm 10 oder neuer
- Für die APK zusätzlich: Android Studio – oder gar nichts, wenn GitHub sie baut

## Entwickeln

```bash
npm install
npm run dev
```

Der Entwicklungsserver ist auch im lokalen Netz erreichbar (`--host` ist gesetzt).
Weil das Spiel am Desktop nicht startet, gibt es zwei Wege zum Ausprobieren:

- **Auf dem Handy:** die zweite Adresse aus der Ausgabe von `npm run dev` im
  Handy-Browser öffnen. Das ist der ehrliche Test – Touch und Leistung sind dort
  anders als auf dem Rechner.
- **Am Rechner:** Entwicklerwerkzeuge öffnen (F12) und die Geräteansicht
  einschalten (Strg+Umschalt+M). Damit meldet der Browser Touch und einen groben
  Zeiger, und das Spiel startet.

## Android-App bauen

Am einfachsten über GitHub: Ein Tag `v1.0.0` oder ein Klick auf _Run workflow_
bei **Android APK** baut die App und hängt sie an ein Release. Auf den
GitHub-Runnern ist das Android-SDK vorinstalliert, lokal braucht es dafür
Android Studio.

Lokal, wenn Android Studio da ist:

```bash
npm run android:apk    # baut dist/, kopiert es und erzeugt die APK
npm run android:open   # öffnet das Projekt in Android Studio
```

**Aktualisierbare Installation:** Android installiert eine neue Version nur über
eine alte, wenn beide mit demselben Schlüssel signiert sind. Ohne hinterlegten
Schlüssel baut der Workflow einen Debug-Build, dessen Schlüssel sich bei jedem
Lauf ändert – die alte App muss dann vor der neuen deinstalliert werden. Für
echte Updates einmalig einen Schlüssel anlegen:

```bash
keytool -genkey -v -keystore release.keystore -alias arena \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore    # Ausgabe kopieren
```

und als GitHub-Secrets hinterlegen: `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
Die Datei `release.keystore` gehört **nicht** ins Repo – geht sie verloren,
lässt sich die App nie wieder aktualisieren.

## Koop testen

In dieser Reihenfolge, so schlägt es das Briefing vor:

1. **Zwei Tabs, ein Rechner:** Menü → _Zusammen spielen_ → im ersten Tab
   _Lokaler Test: Raum_, im zweiten _Lokaler Test: beitreten_. Läuft über
   `BroadcastChannel`, ganz ohne Internet.
2. **Zwei Geräte im WLAN:** _Raum erstellen_ zeigt einen Raumcode, das zweite
   Gerät gibt ihn unter _Beitreten_ ein. Ein Link mit `?room=CODE` füllt ihn
   automatisch aus.
3. **Über Mobilfunk:** gleicher Weg. In manchen Netzen scheitert WebRTC
   grundsätzlich – dann kommt eine Fehlermeldung, und der Solo-Modus geht immer.

## Befehle

| Befehl              | Zweck                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| `npm run dev`       | Entwicklungsserver mit Hot Reload                                       |
| `npm run test`      | Tests – und eine Balancing-Messung, die ausgibt, wie weit ein Bot kommt |
| `npm run typecheck` | TypeScript prüfen                                                       |
| `npm run lint`      | ESLint                                                                  |
| `npm run format`    | Prettier über das Projekt laufen lassen                                 |
| `npm run build`     | Produktionsbuild nach `dist/`                                           |
| `npm run preview`   | Produktionsbuild lokal ansehen                                          |

## Balancing

Alle Spielwerte stehen in `src/config/balance.ts` – Leben, Schaden, Tempo,
Nachladezeiten, Wellenformel. Diese Zahlen zu ändern ist der Sinn der Datei,
nicht ein Zeichen, dass etwas falsch war. `npm run test` zeigt nach jeder
Änderung, wie weit ein einfacher Bot damit kommt.

## Projektstruktur

```
src/
  config/     Spielwerte, Technisches, Arena
  systems/    reine Spiellogik, ohne Phaser
  net/        Koop: Transport, Lobby, Host und Client
  render/     Arena, Figuren, Kamera, Effekte
  scenes/     Boot, Menü, Lobby, Spiel, HUD, Game Over
  input/ ui/  Eingaben und Bedienelemente
  platform/   Geräte-Erkennung, Desktop-Sperre, Installation
  audio/      synthetisierte Klänge
  assets/     Texture Atlas
android/      Capacitor-Projekt für die Android-App
tools/        Hilfsskripte (App-Icons erzeugen)
tests/        Simulation und Netzwerk, ohne Browser
```

## Deployment

Zwei Workflows:

- **Deploy GitHub Pages** – jeder Push auf `main` veröffentlicht die
  installierbare Website
- **Android APK** – ein Tag `v*` baut die App und hängt sie an ein Release

Der Pages-Workflow läuft über `.github/workflows/deploy-pages.yml`. Der Workflow setzt dabei
`VITE_BASE_PATH=/thistle-and-crown/` – ohne diesen Basispfad findet der Browser
die Dateien auf Pages nicht.

Einmalig nötig: **Settings → Pages → Source: GitHub Actions**.

## Dokumentation

- `BRIEFING.md` – der vollständige Auftrag: Spielkonzept, Werte, Architektur, Phasenplan
- `CLAUDE.md` – aktueller Stand, Architekturentscheide, offene Punkte

## Lizenz

MIT, siehe `LICENSE`.
