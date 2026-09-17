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

**Phase 1 bis 7 sind umgesetzt**, dazu eine Erweiterung nach Phase 7: Das Spiel
läuft ausschliesslich auf Touchgeräten und wird installiert statt im Browser
gespielt (siehe „Nur Handy" weiter unten). Der V1-Umfang aus dem Briefing steht
vollständig im Code. Was aussteht, ist kein Code, sondern dein Urteil:

- **Phase 2 ist ein Gefühlstest.** Ob sich die Steuerung auf dem Handy gut
  anfühlt, lässt sich nicht messen. Fühlt sie sich zäh an: Werte in
  `src/config/balance.ts` (`speed`, `accelerationTime`) und
  `src/config/constants.ts` (`TOUCH`) anpassen.
- **Phase 6 ist erst auf zwei echten Geräten in verschiedenen Netzen bestanden.**
  Geprüft ist bisher: zwei Browser-Tabs über den lokalen Transport, und Host plus
  Client im Test mit 30 % künstlichem Paketverlust. Echtes WebRTC konnte hier
  nicht geprüft werden, weil der PeerJS-Signalisierungsserver aus der
  Entwicklungsumgebung nicht erreichbar ist.
- **Balancing ist ein Vorschlag, kein Ergebnis.** Siehe unten.

## Nur Handy, und installiert statt im Browser

Nach Phase 7 gewünschte Änderung, bewusst ausserhalb des Briefings:

- **Am Desktop startet das Spiel nicht.** `src/platform/device.ts` prüft
  Fähigkeiten (Touchpunkte plus grober Zeiger), nicht den User-Agent-Text: Der
  lässt sich fälschen und ändert sich mit jeder Browserversion. Wer kein
  Touchgerät hat, bekommt `DesktopNotice` mit QR-Code – Phaser wird gar nicht
  erst geladen.
- **Tastatur und Maus sind entfernt.** Der im Briefing vorgesehene
  Desktop-Fallback wäre Code, den niemand mehr benutzen kann.
  **Folge fürs Entwickeln:** Entweder auf dem Handy testen oder in den
  Entwicklerwerkzeugen die Geräteansicht einschalten (F12, dann Strg+Umschalt+M).
- **Zwei Wege zur Installation.** Android bekommt eine echte APK über Capacitor
  (`android/`, Workflow `android-apk.yml`). Android und iPhone können die Seite
  zusätzlich als PWA installieren (`src/platform/install.ts`). Eine iOS-App ist
  ohne Mac und Apple-Entwicklerkonto nicht baubar - deshalb bleibt die PWA dort
  der einzige Weg.
- **Signatur:** Ohne hinterlegten Schlüssel baut der Workflow einen Debug-Build,
  dessen Schlüssel bei jedem Lauf wechselt - eine so gebaute App lässt sich nicht
  über die vorherige Version installieren. Die vier Secrets dafür stehen im README.

## Steuerung und Fähigkeiten

Zwei Änderungen nach dem ersten Spieltest, beide über das Briefing hinaus:

- **Der Schussknopf sitzt fest.** Im Briefing war rechts ein zweiter
  schwebender Joystick vorgesehen, der beim Loslassen feuert. In der Praxis
  hiess das: Man musste den Gegner treffen, statt einfach zu schiessen. Jetzt
  liegt unten rechts ein fester **FEUER**-Knopf. Halten feuert dauerhaft (so
  schnell, wie Munition und Schusstakt es zulassen), Ziehen zielt mit Linie,
  blosses Halten überlässt der Simulation die Zielsuche. `InputState.fire` ist
  deshalb ein **gehaltener Zustand**, kein einmaliger Wunsch - auch im
  Netzwerkprotokoll. Einmalig sind nur noch Super und Aufwertung.
- **Fähigkeiten lassen sich aufwerten** (`src/systems/skills.ts`,
  `src/ui/SkillPanel.ts`): ein Punkt je geschaffter Welle, verteilbar auf Waffe,
  Panzerung, Tempo und Super, je fünf Stufen. Die Auswahl erscheint nur in der
  Pause - ein Menü mitten im Gefecht wäre im Weg. Wichtig für den Koop: Die
  Stufen werden **nicht** in die Grundwerte hineingerechnet, sondern bei jeder
  Benutzung frisch angewendet. Sonst summieren sich Rundungsfehler, und Host
  und Client laufen auseinander.

## Die Architektur-Grundregel

**Spiellogik und Darstellung sind strikt getrennt.** Das ist die eine Entscheidung,
die man später nicht mehr billig nachholen kann.

- Alles unter `src/systems/` ist **reine Logik auf Datenobjekten** und
  **importiert nichts aus Phaser**. Der Host rechnet damit die Runde für alle,
  und Tests spielen damit ganze Runden ohne Browser durch
  (`tests/systems/round.test.ts`).
- `src/render/` und `src/scenes/` zeichnen nur. Sie lesen den Zustand und stellen
  ihn dar; sie entscheiden nichts über Positionen, Leben oder Schaden.
- `src/input/` und `src/ui/` übersetzen Geräte-Eingaben in einen einheitlichen
  `InputState`. Die Simulation weiss nicht, ob eine Eingabe von Tastatur, Daumen
  oder aus dem Netz kommt - erst dadurch war Phase 6 überhaupt machbar.
- `src/net/` verbindet beides: `GameSession` ist die einzige Schnittstelle, die
  die Spielszene kennt. Ob solo, als Host oder als Client gespielt wird, sieht
  sie nicht.

Vor jedem neuen Modul die Frage stellen: _Muss der Host das rechnen können, ohne
zu zeichnen?_ Wenn ja, gehört es nach `systems/`.

## Entscheidungen und Abweichungen vom Briefing

| Thema                 | Entscheidung                                                              | Warum                                                                                                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phaser-Version        | Phaser 3 (3.90), nicht Phaser 4                                           | Briefing gibt Phaser 3 vor. Für Einsteiger zählt vor allem, dass Tutorials, Forenantworten und Beispiele passen - dieses Material gibt es fast ausschliesslich für Phaser 3.                                                                                                                                                           |
| Phaser Arcade Physics | Wird **nicht** benutzt                                                    | Das Briefing nennt Arcade Physics für die Gegner-KI (Abschnitt 4), aber die Architektur-Grundregel (Abschnitt 5) ist stärker: Die Simulation muss ohne Phaser laufen. Kollision Kreis gegen Rechteck steht deshalb selbst in `systems/collision.ts` - rund 60 Zeilen, testbar.                                                         |
| Sprites               | Werden beim Start gezeichnet statt von Kenney geladen                     | kenney.nl und itch.io sind aus dieser Entwicklungsumgebung nicht erreichbar. Entscheidend ist, dass die Schnittstelle stimmt: Im Spielcode steht nur `FRAMES.runner`. Auf echte Sprites zu wechseln heisst, `buildAtlas` in `src/assets/textures.ts` durch ein `scene.load.atlas` zu ersetzen - eine Datei, nicht fünfzig Fundstellen. |
| Ton                   | Wird mit der Web-Audio-API synthetisiert statt als .ogg geladen           | Gleicher Grund. Gleiche Schnittstelle: Im Spielcode steht nur `audio.play("hit")`, siehe `src/audio/`.                                                                                                                                                                                                                                 |
| HUD und Touch         | Eigene Szene (`HudScene`)                                                 | Die Spielkamera zoomt je nach Spielerabstand, und alles in ihrer Kamera zoomt mit - auch Text und Joysticks, die fest am Bildschirmrand kleben sollen. Eine zweite Szene hat ihre eigene Kamera ohne Zoom.                                                                                                                             |
| Spielerform           | Kreis statt Rechteck                                                      | Ein Kreis gleitet an Wänden und Ecken entlang, ein Rechteck verhakt sich. Genau dieses Verhaken lässt Top-down-Steuerung zäh wirken.                                                                                                                                                                                                   |
| Rundenablauf          | Vorbereitung nur vor Welle 1, danach Welle → Pause → Welle                | Die Pause kündigt laut Briefing selbst die nächste Welle an. Eine zusätzliche Vorbereitung dazwischen wären 15 Sekunden Warten zwischen zwei Wellen.                                                                                                                                                                                   |
| Repo                  | Ersetzt den früheren Inhalt von `thistle-and-crown` (ein Babylon.js-MOBA) | So entschieden am 2026-09-17. Der alte Stand ist über die Git-Historie auf `main` erreichbar. Der Repo-Name bleibt, deshalb bleibt `base: /thistle-and-crown/`.                                                                                                                                                                        |

## Projektstruktur

```
src/
  main.ts                 Phaser-Konfiguration, Szenenliste
  config/
    balance.ts            ALLE Spielwerte
    constants.ts          Arena, Bildschirm, Tickrate, Kamera, Touch, Farben
    arena.ts              Arena als reine Daten: Wände, Büsche, Spawnzonen
  systems/                PHASER-FREI - die Simulation
    types.ts              Datentypen und Ereignisse
    world.ts              Weltzustand, ein Tick
    Simulation.ts         fester Zeitschritt + Interpolation
    movement.ts           Beschleunigung, Dash
    collision.ts          Kreis gegen Rechteck, Gleiten
    combat.ts             Schüsse, Munition, Schaden, Wiederbelebung
    projectiles.ts        Projektile mit Object Pooling
    enemies.ts            Gegner-KI, Sichtlinie
    supers.ts             die drei Super-Fähigkeiten
    skills.ts             Aufwertungen zwischen den Wellen
    waves.ts              Wellenformel und Rundenablauf
    targeting.ts          wer sieht wen
    rng.ts                wiederholbarer Zufall (Mulberry32)
  net/                    Koop
    protocol.ts           Nachrichten zwischen Host und Clients
    Transport.ts          Verbindungsschnittstelle
    PeerTransport.ts      WebRTC über PeerJS
    LocalTransport.ts     zwei Tabs desselben Browsers (ohne Server)
    Lobby.ts              Raum, Spielerliste, Start
    HostSession.ts        autoritative Simulation
    ClientSession.ts      Eingaben senden
    ClientView.ts         Interpolation und Vorhersage
    SoloSession.ts        Einzelspieler
    GameSession.ts        die Schnittstelle, die die Spielszene kennt
  render/                 Darstellung
    ArenaRenderer, EntityRenderer, CameraController, Juice
  scenes/                 Boot, Menu, Lobby, Game, Hud, GameOver
  input/InputManager.ts   Touch -> InputState
  ui/                     VirtualJoystick, TouchControls, SkillPanel, Button, HudModel
  audio/                  synthetisierte Klänge und Musik
  assets/textures.ts      Texture Atlas
  storage/highscore.ts    lokaler Rekord
  platform/               Geräte-Erkennung, Desktop-Sperre, PWA-Installation
android/                  Capacitor-Projekt für die Android-App
tools/                    Hilfsskripte (App-Icons erzeugen)
tests/
  systems/                Simulation, inklusive ganzer Runden ohne Browser
  net/                    Protokoll, Raumcodes, Host und Client im selben Prozess
```

## Balancing

**Alle Spielwerte stehen in `src/config/balance.ts`.** Kein anderes Modul
verdrahtet Spielwerte fest.

`npm run test` gibt bei jedem Lauf eine Messung aus
(`tests/systems/balanceProbe.test.ts`): Ein einfacher Bot spielt jeden Charakter
fünfmal durch und meldet, wie weit er kommt. Stand jetzt:

| Charakter | Erreichte Wellen (Bot) |
| --------- | ---------------------- |
| Scout     | ~5                     |
| Tank      | ~8                     |
| Sniper    | ~8                     |

Der Bot verteilt seine Skillpunkte reihum. Ohne Aufwertungen kam er nur auf 5
bis 7 Wellen - die Fähigkeiten sind also spürbar, nicht Kosmetik.

Der Scout bleibt in der Messung zurück, aber das ist vermutlich ein Artefakt:
Seine Stärke ist Beweglichkeit, und genau die nutzt ein Bot mit grobem
Ausweichen am wenigsten. Vor einer Anpassung an seinen Werten lohnt es sich,
ihn selbst zu spielen.

Der Bot ist **schlechter als ein Mensch**: Er nutzt keine Deckung, keine Büsche
(in denen Gegner ihn gar nicht sehen) und weicht Projektilen nicht aus. Seine
Zahlen sind eine Untergrenze. Das Briefing nennt 8–15 Wellen als realistische
Runde - ob das stimmt, zeigt erst dein eigenes Spielen.

In Phase 7 wurden nur Werte angepasst, die **nicht** im Briefing stehen:
`ENEMY_CONTACT_INTERVAL` (0,6 → 1,0 s), `PLAYER.shootCooldown` (0,25 → 0,18 s),
`WAVES.spawnIntervalSeconds` (0,35 → 0,6 s), `PLAYER.breakHealFraction`
(45 → 60 %), `ENEMIES.shooter.preferredRange` (420 → 340 px) und der
Streuwinkel des Scouts (18 → 9 Grad). Alle Zahlen, die das Briefing nennt -
Leben, Schaden, Tempo, Nachladezeiten, Wellenformel - sind unverändert.

Der wichtigste Fund dabei: Ein Schütze, der zurückweicht und dabei weiter
schiesst, als der Spieler reicht, ist für Nahkämpfer unerreichbar - die Welle
endet dann nie. Deshalb ist sein Wunschabstand jetzt kleiner als jede
Spielerreichweite, und er weicht erst bei echter Nähe zurück.

## Befehle

| Befehl              | Zweck                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `npm run dev`       | Entwicklungsserver, auch im WLAN erreichbar (`--host` ist gesetzt) |
| `npm run test`      | Tests der Simulation und des Netzwerks, plus Balancing-Messung     |
| `npm run typecheck` | TypeScript prüfen                                                  |
| `npm run lint`      | ESLint                                                             |
| `npm run build`     | Produktionsbuild nach `dist/`                                      |
| `npm run preview`   | Produktionsbuild lokal ansehen                                     |

Vor jedem Commit: `npm run typecheck && npm run lint && npm run test && npm run build`.
Genau das prüft auch `quality-check.yml`.

## Deployment

- Push auf `main` startet `.github/workflows/deploy-pages.yml`
- Der Workflow setzt `VITE_BASE_PATH=/thistle-and-crown/`; ohne diesen Basispfad
  findet der Browser auf GitHub Pages die Dateien nicht
- Ergebnis: `https://thcjk.github.io/thistle-and-crown/`
- Einmalig nötig: **Settings → Pages → Source: GitHub Actions**

## Bekannte offene Punkte

- **Echtes WebRTC ist ungetestet.** Der Signalisierungsserver war aus der
  Entwicklungsumgebung nicht erreichbar. Reihenfolge zum Prüfen (aus dem
  Briefing): zwei Tabs (geht bereits über „Lokaler Test"), dann zwei Geräte im
  WLAN, dann Mobilfunk. In manchen Mobilfunknetzen scheitert WebRTC
  grundsätzlich - dafür bräuchte es einen TURN-Server. Die Antwort darauf ist
  laut Briefing die Fehlermeldung plus der Solo-Modus, nicht ein eigener Server.
- **Bildrate auf echtem Gerät ungeprüft.** Im Container laufen selbst fast leere
  Szenen nur mit ~50 fps (Software-Rendering ohne GPU), das Spiel mit ~32 fps.
  Diese Zahlen sagen nichts über ein Handy aus. Auf einem echten Gerät messen.
- **Kein TURN-Server, keine Host-Migration.** Verlässt der Host, endet die Runde
  mit Hinweis - so im Briefing vorgesehen.
- **Bundle ist gross** (~1,6 MB, gzip ~370 kB), weil Phaser komplett eingebunden
  ist. Ein massgeschneiderter Phaser-Build wäre der nächste Hebel.
- **Die APK ist hier nie gebaut worden.** Das Android-SDK fehlt in der
  Entwicklungsumgebung, und `dl.google.com` ist gesperrt. Gebaut wird sie auf
  GitHub Actions - der erste Lauf des Workflows ist der eigentliche Test.
- **Arena ist keine Tilemap**, sondern eine Liste von Rechtecken in
  `config/arena.ts`. Die Schnittstelle zur Simulation bleibt dieselbe, eine
  Tilemap kann sie später füllen.

## Was bewusst NICHT gebaut wird (V1)

PvP · Accounts und Login · Server-Datenbank · Matchmaking mit Fremden ·
Online-Ranglisten · freischaltbare Charaktere, Skins, Shop, Währungen ·
mehrere Karten oder Spielmodi · Cutscenes, Story, Tutorial-Level.

**Projektregel:** Was nicht in der V1-Liste des Briefings steht, wird nicht gebaut –
auch dann nicht, wenn es "schnell noch" machbar wäre.

## Arbeitsweise

- Nach jeder Änderung selbst spielen und deployen, bevor es weitergeht.
- Vor grösseren Änderungen den Plan zeigen, dann erst Code schreiben.
- Erklären, was gebaut wurde und warum – besonders bei Phaser-Begriffen wie
  Scenes, Groups oder dem Scale Manager.
- Am Ende der Sitzung diese Datei aktualisieren.
