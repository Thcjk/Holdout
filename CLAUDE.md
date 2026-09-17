# CLAUDE.md – Projektgedächtnis

Diese Datei wird bei jedem Start gelesen. Sie hält fest, wo das Projekt steht,
welche Entscheidungen getroffen wurden und was bewusst noch fehlt.
**Am Ende jeder Sitzung aktualisieren.**

Der vollständige Auftrag steht in `BRIEFING.md`. Diese Datei ersetzt ihn nicht,
sondern ergänzt ihn um den aktuellen Stand.

---

## Was das hier ist

Koop-Arena-Shooter im Stil von Brawl Stars: Top-down, 1–4 Spieler halten gemeinsam
gegen immer stärkere Gegnerwellen durch. Läuft im Handy-Browser, gehostet als
statische PWA auf GitHub Pages.

Zielgruppe der Erklärungen: Einsteiger in der Spieleentwicklung, mit Web-Erfahrung.
**Alle Erklärungen auf Deutsch**, Fachbegriffe beim ersten Auftreten kurz einordnen.
Code lesbar und kommentiert, nicht maximal clever. Kommentare ebenfalls auf Deutsch.

## Aktueller Stand

**Phase 1 (Fundament) ist abgeschlossen.** Als Nächstes kommt Phase 2 (Steuerung).

Was läuft:

- Vite + Phaser 3 + TypeScript, Build und Deployment über GitHub Actions
- PWA-Grundgerüst (Manifest, Service Worker, Icons) über `vite-plugin-pwa`
- Arena 1600 × 1200 px mit Aussenmauern und acht Deckungsblöcken
- Steuerbare Spielfigur mit Tastatur (WASD / Pfeiltasten), Beschleunigung, Wandkollision
- Simulation mit festem Zeitschritt (30 Hz) und Interpolation beim Zeichnen
- Kamera folgt dem Spieler und bleibt in der Arena
- 21 Tests über die Simulation (`npm run test`)

## Die Architektur-Grundregel

**Spiellogik und Darstellung sind strikt getrennt.** Das ist die eine Entscheidung,
die man später nicht mehr billig nachholen kann.

- Alles unter `src/systems/` ist **reine Logik auf Datenobjekten** und darf
  **nichts aus Phaser importieren**. Diese Dateien müssen ohne Bildschirm laufen –
  weil ab Phase 6 der Host die Simulation für alle Spieler rechnet, und weil sich
  reine Logik testen lässt.
- `src/scenes/` zeichnet nur. Eine Szene liest den Zustand und stellt ihn dar;
  sie entscheidet nichts über Positionen, Leben oder Schaden.
- `src/input/` übersetzt Geräte-Eingaben (Tastatur, ab Phase 2 Touch, ab Phase 6
  Netzwerk) in einen einheitlichen `InputState`. Die Simulation weiss nicht,
  woher eine Eingabe kommt.

Vor jedem neuen Modul die Frage stellen: _Muss der Host das rechnen können, ohne
zu zeichnen?_ Wenn ja, gehört es nach `systems/`.

## Entscheidungen und Abweichungen vom Briefing

| Thema                     | Entscheidung                                                              | Warum                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phaser-Version            | Phaser 3 (3.90), nicht Phaser 4                                           | Briefing gibt Phaser 3 vor. Für Einsteiger zählt vor allem, dass Tutorials, Forenantworten und Beispiele passen – dieses Material gibt es fast ausschliesslich für Phaser 3.                                                                                                                                                                                                                                                                         |
| Phaser Arcade Physics     | Wird **nicht** benutzt                                                    | Das Briefing nennt Arcade Physics für die Gegner-KI (Abschnitt 4), aber die Architektur-Grundregel (Abschnitt 5) ist stärker: Die Simulation muss ohne Phaser laufen. Kollision Kreis gegen Rechteck steht deshalb selbst in `systems/collision.ts` – rund 60 Zeilen, testbar, für dieses Spiel ausreichend. Falls die Hindernisvermeidung der Gegner ab Phase 3 zu aufwendig wird, ist das die Stelle, an der diese Entscheidung neu zu prüfen ist. |
| Spielerform               | Kreis statt Rechteck                                                      | Ein Kreis gleitet an Wänden und Ecken entlang, ein Rechteck verhakt sich dort. Genau dieses Verhaken ist der häufigste Grund, warum sich Top-down-Steuerung zäh anfühlt. Als Platzhaltergrafik sind Kreise laut Briefing (Abschnitt 7) ohnehin vorgesehen.                                                                                                                                                                                           |
| `InputManager`            | Liegt unter `src/input/`, nicht unter `src/systems/`                      | Er liest Phaser-Tasten und darf deshalb nicht in den Phaser-freien Ordner. Der Rest der Struktur folgt dem Briefing.                                                                                                                                                                                                                                                                                                                                 |
| Deckungsblöcke in Phase 1 | Schon vorhanden                                                           | Phase 1 verlangt "eine leere Arena mit Wänden". Die acht Blöcke benutzen dieselbe Kollision wie die Aussenmauern und machen den Abnahmetest ("stoppt an Wänden") erst aussagekräftig.                                                                                                                                                                                                                                                                |
| Repo                      | Ersetzt den früheren Inhalt von `thistle-and-crown` (ein Babylon.js-MOBA) | So entschieden am 2026-09-17. Der alte Stand ist über die Git-Historie auf `main` weiter erreichbar. Der Repo-Name bleibt, deshalb bleibt auch `base: /thistle-and-crown/` für GitHub Pages.                                                                                                                                                                                                                                                         |

## Projektstruktur

```
src/
  main.ts                 Phaser-Konfiguration, startet das Spiel
  config/
    balance.ts            ALLE Spielwerte (Tempo, Leben, Schaden, Wellenformel)
    constants.ts          Arena- und Bildschirmgrösse, Tickrate, Ebenen, Farben
    arena.ts              Aufbau der Arena als reine Daten (Wandrechtecke)
  scenes/
    BootScene.ts          Startszene, später Ladebalken und Assets
    GameScene.ts          zeichnet die Arena und den Spieler, sammelt Eingaben
  input/
    InputManager.ts       Tastatur -> InputState (Touch kommt in Phase 2)
  systems/                PHASER-FREI
    types.ts              Datentypen der Simulation
    world.ts              Weltzustand, ein Tick
    movement.ts           Beschleunigung und Bewegung eines Spielers
    collision.ts          Kreis gegen Rechteck, Gleiten an Wänden
    Simulation.ts         fester Zeitschritt + Interpolation
tests/systems/            Tests der reinen Logik
public/
  icons/                  PWA-Icons
  favicon.svg
BRIEFING.md               der vollständige Auftrag
```

Die im Briefing aufgeführten Ordner `entities/`, `net/` und `ui/` gibt es noch
nicht. Sie entstehen in den Phasen, die sie brauchen – leere Platzhalterdateien
anzulegen wäre toter Code.

## Wichtige Zahlen und wo sie stehen

**Alle Spielwerte stehen in `src/config/balance.ts`.** Kein anderes Modul verdrahtet
Spielwerte fest. Dort stehen auch schon die Werte für spätere Phasen (Charaktere,
Gegner, Wellenformel), damit sie nicht später verstreut neu erfunden werden.

`src/config/constants.ts` enthält dagegen nur Technisches: Arenagrösse, Auflösung,
Tickrate, Zeichenebenen, Farben.

Die Werte sind Startwerte. Sie zu ändern ist der Sinn der Sache.

## Befehle

| Befehl              | Zweck                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `npm run dev`       | Entwicklungsserver, erreichbar auch im WLAN (`--host` ist gesetzt) |
| `npm run test`      | Tests der Simulation                                               |
| `npm run typecheck` | TypeScript prüfen                                                  |
| `npm run lint`      | ESLint                                                             |
| `npm run build`     | Produktionsbuild nach `dist/`                                      |
| `npm run preview`   | Produktionsbuild lokal ansehen                                     |

Vor jedem Commit: `npm run typecheck && npm run lint && npm run test && npm run build`.
Genau das prüft auch der Workflow `quality-check.yml`.

## Deployment

- Push auf `main` startet `.github/workflows/deploy-pages.yml`
- Der Workflow setzt `VITE_BASE_PATH=/thistle-and-crown/`; ohne diesen Basispfad
  findet der Browser auf GitHub Pages die Dateien nicht
- Ergebnis: `https://thcjk.github.io/thistle-and-crown/`
- Einmalig in den Repo-Einstellungen nötig: **Settings → Pages → Source: GitHub Actions**

## Bekannte offene Punkte

- **Keine Touch-Steuerung.** Auf dem Handy bewegt sich derzeit nichts – das ist
  Phase 2. Getestet wird bis dahin mit Tastatur.
- **Bundle ist gross** (~1,5 MB, gzip ~340 kB), weil Phaser komplett eingebunden
  ist. Erst in Phase 7 relevant; dann über einen massgeschneiderten Phaser-Build lösen.
- **Kein Ladebildschirm.** `BootScene` lädt noch nichts, weil alles gezeichnet wird.
- **Arena ist noch keine Tilemap**, sondern eine Liste von Rechtecken in
  `config/arena.ts`. Laut Briefing wird daraus in Phase 5 eine Tilemap. Die
  Schnittstelle zur Simulation (eine Liste von Rechtecken) bleibt dabei gleich.

## Was bewusst NICHT gebaut wird (V1)

PvP · Accounts und Login · Server-Datenbank · Matchmaking mit Fremden ·
Online-Ranglisten · freischaltbare Charaktere, Skins, Shop, Währungen ·
mehrere Karten oder Spielmodi · Cutscenes, Story, Tutorial-Level.

**Projektregel:** Was nicht in der V1-Liste des Briefings steht, wird nicht gebaut –
auch dann nicht, wenn es "schnell noch" machbar wäre.

## Arbeitsweise

- **Eine Phase pro Sitzung.** Keine Vorgriffe auf spätere Phasen.
- Nach jeder Phase selbst spielen und deployen, bevor es weitergeht.
- Vor grösseren Änderungen den Plan zeigen, dann erst Code schreiben.
- Erklären, was gebaut wurde und warum – besonders bei Phaser-Begriffen wie
  Scenes, Groups oder dem Scale Manager.
- Am Ende der Sitzung diese Datei aktualisieren.

## Nächste Phase: Phase 2 – Steuerung

Umfang laut Briefing: Twin-Stick-Joysticks für Touch (links laufen, rechts zielen),
Ziellinie mit Reichweitenanzeige, Kamerafolge mit dynamischem Zoom, tote Zone von
etwa 10 px, Desktop-Fallback mit Maus.

**Fertig, wenn** sich die Steuerung auf dem Handy gut anfühlt – das ist ein
Gefühlstest, kein technischer. Fühlt sie sich zäh an, wird in Phase 2 nachjustiert
statt weitergebaut.

Vorbereitet ist dafür: `InputState` liefert bereits einen normalisierten
Richtungsvektor, Teilausschläge (halb gedrückter Joystick) werden schon korrekt
durchgereicht. Der Touch-Joystick muss also nur diesen Vektor füllen.
