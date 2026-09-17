# CLAUDE.md – Projektgedächtnis

Diese Datei wird bei jedem Start gelesen. Sie hält fest, wo das Projekt steht,
welche Entscheidungen getroffen wurden und was bewusst noch fehlt.
**Am Ende jeder Sitzung aktualisieren.**

Der vollständige Auftrag steht in `BRIEFING.md`. Diese Datei ersetzt ihn nicht,
sondern ergänzt ihn um den aktuellen Stand.

---

## Was das hier ist

Holdout, ein Koop-Arena-Shooter im Stil von Brawl Stars: Top-down, 1–4 Spieler halten gemeinsam
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
- **Das Bild füllt den Bildschirm.** Die Entwurfsauflösung war fest 960×540,
  also 16:9. Ein iPhone im Querformat ist eher 19,5:9 – im Modus `FIT` blieben
  links und rechts je rund 75 Pixel schwarz, das Spiel sass in einem
  Briefkasten. Jetzt bleibt die **Höhe** fest bei 540 und die **Breite folgt dem
  Gerät** (`fitViewportToScreen` in `config/constants.ts`), begrenzt auf 960 bis
  1600. Gemessen auf dem iPhone 13 quer: vorher 693×390 mit 151 px Balken,
  jetzt 844×390 ohne.

  Die Obergrenze ist eine Notbremse gegen absurde Werte, kein enges Korsett –
  zu eng, und es entstünden genau wieder die Balken, die der Umbau beseitigen
  soll. 1600 entspricht 2,96:1, breiter ist kein Handy. Zum Vergleich: 16:9
  ergibt 960, das übliche 19,5:9 ergibt 1170, und Safari im Querformat mit
  eingeblendeter Adressleiste (rund 2,6:1) bleibt mit 1424 darunter.

  **Warum `FIT` und nicht `ENVELOP` oder `RESIZE`** (beides erwogen):
  - `ENVELOP` skaliert formatfüllend und schneidet den Überstand ab. Genau an
    den Rändern sitzen hier aber FEUER, SUPER, Punktzahl und Wellenanzeige –
    abgeschnitten würde also die Bedienung.
  - `RESIZE` gibt jedem Gerät seine eigene Weltansicht. Auf einem breiten Handy
    sähe man deutlich mehr Arena als auf einem schmalen; im Koop wäre das ein
    echter Vorteil.
  - `FIT` auf einer abgeleiteten Auflösung hat beides nicht: nichts wird
    abgeschnitten, und die Grenze 960–1280 hält den Unterschied zwischen
    Geräten bei höchstens einem Drittel Breite.

  **Folge fürs Weiterbauen:** `VIEWPORT.width` steht erst fest, wenn das Spiel
  startet. Wer sie beim Laden einer Datei ausliest (eine Konstante auf
  Modulebene), bekommt die alte 960 – genau das war bei den Mitten der
  Touch-Knöpfe der Fall, sie sind jetzt Funktionen.
- **Das Spiel startet erst im Querformat** (`src/platform/rotateGate.ts` plus
  `#rotate-gate` in `index.html`). Vorher lief es auch hochkant an.

  **Der Fehler, den das behebt:** Das Spiel misst beim Start den Bildschirm, um
  seine Zeichenfläche darauf zuzuschneiden. Wird die App **hochkant geöffnet
  und erst danach gedreht** – der normale Ablauf auf dem Handy –, war diese
  Messung für das falsche Format. Übrig blieben Balken links und rechts. Genau
  das war auf dem iPhone zu sehen, und genau diesen Fall hatte ich beim Testen
  übersprungen: Ich habe immer direkt im Querformat gestartet.

  Statt die Fläche nachträglich umzubauen – was jede Szene, jeden Knopf und
  jede HUD-Position neu setzen müsste, mitten im Spiel – wartet der Start
  einfach. Reihenfolge in `main.ts`: **erst quer, dann messen, dann Phaser
  bauen.** Danach gibt es nichts nachzubessern.

  Der Startbildschirm steht **direkt im HTML**, nicht im Spielcode: So ist er
  sofort da, noch bevor Phaser geladen ist.

  **Der Notausgang.** Wer die Rotationssperre eingeschaltet hat – auf dem
  iPhone der Normalfall –, bei dem meldet der Browser nie „quer", egal wie man
  das Gerät hält. Ohne Ausweg wäre das eine Sackgasse, und genau eine solche
  hat dieses Projekt schon einmal lahmgelegt. Deshalb erscheint nach vier
  Sekunden ein Knopf **„Trotzdem starten"**. Wer einfach dreht, sieht ihn nie.
  Die Wahl merkt sich das Modul (`forcedStart`) – sonst würde derselbe
  Bildschirm beim nächsten Grössenwechsel wieder aufhalten.

  Während des Spiels hochkant gehalten, kommt der Startbildschirm zurück. Das
  Spiel läuft dahinter **weiter** und wird nicht angehalten: Im Koop rechnet
  der Host für alle weiter, ein angehaltener Client geriete nur aus dem Takt.
- **Querformat wird zusätzlich verlangt, wo es geht** (`src/platform/orientation.ts`).
  `screen.orientation.lock` greift auf Android in der installierten App;
  **iOS Safari kann es nicht**, weder im Browser noch auf dem Startbildschirm.
  Dort übernimmt der Startbildschirm oben. Im PWA-Manifest steht
  `orientation: landscape`; Android beachtet das, iOS ignoriert es.

  **Die CSS-Drehung um 90 Grad ist bewusst nicht zurückgekommen.** Sie
  funktionierte im Emulator, hatte aber zwei Fallen: CSS dreht das Bild, nicht
  die Finger (Phasers `transformPointer` musste ersetzt werden), und gedreht
  werden darf nur die Zeichenfläche, nicht ihr Rahmen (Phaser misst den Rahmen
  zum Einpassen und bekäme sonst die hochkanten Masse).
- **Auf Grössenänderung wird reagiert**, aber nur mit `game.scale.refresh()`.
  Die **Entwurfsauflösung wird dabei nicht neu berechnet**: Sie steckt in den
  Positionen aller Knöpfe, Texte und Anzeigen; sie mitten im Spiel zu ändern
  hiesse, jede Szene neu aufzubauen. Da das Spiel nur quer startet, ändert sich
  das Verhältnis danach ohnehin kaum noch.
- **Die installierte App aktualisiert sich selbst** (`src/platform/update.ts`).
  Ein Service Worker haelt die App offline verfuegbar - und liefert deshalb von
  sich aus weiter die gespeicherte Fassung. Das Modul fragt regelmaessig nach
  (jede Minute im Vordergrund, zusaetzlich bei jeder Rueckkehr in den
  Vordergrund und sobald wieder Netz da ist), laedt Geaendertes im Hintergrund
  und startet erst dann neu, wenn es nicht stoert: **nur im Hauptmenue**. Jede
  Szene meldet das selbst (`setReloadSafe`) - Menue `true`, Spiel, Lobby und
  Ergebnisbildschirm `false`. Sonst waere ein Neustart der Verlust der Runde
  oder der Punktzahl. Niemand muss die App loeschen und neu hinzufuegen.
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
- **Antippen geht nicht mehr verloren.** `InputState.fire` wird jedes Bild frisch
  vom Finger abgelesen, aber nicht jedes Bild rechnet einen Tick: Bei 60 Bildern
  und 30 Ticks je Sekunde ist es nur jedes zweite. Ein kurzes Antippen, das
  genau dazwischen begann und endete, wurde deshalb stillschweigend verschluckt
  - das war die Ursache für „Schiessen geht nur ab und zu". `TouchControls`
  hinterlegt jetzt bei jedem Druck einen **gemerkten Schuss**, der liegen bleibt,
  bis die Simulation ihn gesehen hat. Genau einer pro Druck, kein Doppelschuss.
  Wird gezogen, bekommt er beim Loslassen noch die gezogene Richtung mit - so
  trifft auch ein schnelles Wischen dorthin, wohin gezielt wurde.
- **Fähigkeiten lassen sich aufwerten** (`src/systems/skills.ts`,
  `src/ui/SkillPanel.ts`): ein Punkt je geschaffter Welle, verteilbar auf Waffe,
  Panzerung, Tempo und Super, je fünf Stufen. Die Auswahl erscheint nur in der
  Pause - ein Menü mitten im Gefecht wäre im Weg. Wichtig für den Koop: Die
  Stufen werden **nicht** in die Grundwerte hineingerechnet, sondern bei jeder
  Benutzung frisch angewendet. Sonst summieren sich Rundungsfehler, und Host
  und Client laufen auseinander.

### Treffer werden auf der ganzen Flugstrecke geprüft

Der grösste Fund beim Überarbeiten des Schiessens, und er stand in keiner
Fehlermeldung: Ein Projektil fliegt 600 Pixel je Sekunde, ein Tick dauert eine
dreissigstel Sekunde - pro Schritt springt es also **20 Pixel** weit. Geprüft
wurde bisher nur der Endpunkt dieses Sprungs. Ein Läufer hat mit Projektil
zusammen 23 Pixel Trefferradius; alles, was den Rand streift, wurde damit rund
jedes fünfte Mal übersprungen. Der Schuss sass, gezählt wurde er nicht - und es
fühlte sich an wie „danebengezielt".

`systems/projectiles.ts` rechnet jetzt die Strecke als Linie gegen den Gegner
als Kreis (`sweepHitTime`, eine quadratische Gleichung, exakt und ohne
Abtasten). Wände werden abgetastet, in Schritten von höchstens einem
Projektilradius. Wer zuerst auf der Strecke liegt, wird zuerst getroffen -
sonst schösse man durch Deckung hindurch oder träfe den hinteren von zwei
Gegnern. `tests/systems/projectileSweep.test.ts` hält das fest; der erste Test
fällt auf dem alten Code durch.

**Nebenwirkung, die man kennen muss:** Auch Gegnerprojektile treffen jetzt
zuverlässig. Das Spiel ist dadurch messbar schwerer geworden - die
Balancing-Messung fiel beim Tank von 8,4 auf 6,6 Wellen.

### Sehen, womit gerechnet wird

`?debug=hitbox` an die Adresse gehängt zeichnet die Trefferradien als Umriss:
Spieler grün, Gegner rot, Projektile gelb samt der Strecke, die sie im nächsten
Tick zurücklegen. `?debug=werte` blendet Zahlen ein, `?debug=all` beides. Die
Radien werden aus dem Weltzustand gelesen, nicht noch einmal aufgeschrieben -
sonst zeigte die Anzeige etwas anderes an, als getroffen wird, und würde lügen
statt zu helfen. Ohne `?debug=` kostet das nichts (`platform/debugFlags.ts`).

Auf dem Handy gibt es keine Entwicklerwerkzeuge - die Adresszeile ist der
einzige Weg, im echten Spiel auf dem echten Gerät etwas sichtbar zu machen.

## Der Name

Das Spiel heisst **Holdout**. Umbenannt wurde alles Sichtbare: Browser-Titel,
PWA-Manifest, Menü, Sperrseite, Android-App, APK-Dateiname, Release-Titel.

Drei Dinge behalten bewusst den alten Namen:

| Was                       | Wert                                             | Warum                                                                                                                                                |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android-`applicationId`   | `ch.thcjk.arenashooter`                          | Ändert man sie, ist es für Android eine andere App - Updates über die installierte Version gehen dann nicht mehr.                                    |
| Speicherschlüssel         | `arena-shooter.highscore`, `arena-shooter.muted` | Ein neuer Schlüssel bedeutet: Rekord weg, Ton-Einstellung weg.                                                                                       |
| Peer-Präfix und Kanalname | `koop-arena-`                                    | Sichtbar ist davon nichts. Eine Änderung würde nur bewirken, dass zwei Geräte mit unterschiedlichen Versionen sich nicht mehr im selben Raum finden. |

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
| Repo                  | Ersetzt den früheren Inhalt von `thistle-and-crown` (ein Babylon.js-MOBA) | So entschieden am 2026-09-17. Der alte Stand ist über die Git-Historie auf `main` erreichbar. Das Repo heisst inzwischen `Holdout`; der Basispfad wird deshalb aus dem Repo-Namen abgeleitet statt eingetragen.                                                                                                                                                                        |

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
  platform/               Geräte-Erkennung, Desktop-Sperre, Absturzanzeige,
                          Selbst-Aktualisierung, Installation
android/                  Capacitor-Projekt für die Android-App
tools/                    Hilfsskripte (App-Icons erzeugen)
tests/
  systems/                Simulation, inklusive ganzer Runden ohne Browser
  net/                    Protokoll, Raumcodes, Host und Client im selben Prozess
```

## Balancing

**Alle Spielwerte stehen in `src/config/balance.ts`.** Kein anderes Modul
verdrahtet Spielwerte fest.

### Zwei Messungen bei jedem `npm run test`

- `tests/systems/balanceProbe.test.ts` – die kurze: Wie weit kommt ein Bot je
  Charakter (fünf Durchläufe)?
- `tests/systems/balanceReport.test.ts` – das Protokoll: je Welle Dauer,
  ausgeteilter und erlittener Schaden, Kills, Leben danach. Dazu die
  rechnerische Zeit, einen Gegner zu töten. **Rechnerisch** heisst „wenn jede
  Kugel trifft" – beim Tank (34 Grad Streuung) ist das eine Wunschzahl,
  **gemessen** ist, was wirklich passiert ist.

Der Bot steht in `tests/bot.ts` und wird von beiden benutzt. Er ist absichtlich
mittelmässig, muss aber zwei Dinge können, sonst misst er Unsinn:

1. **Auf die eigene Reichweite achten.** Ein früherer Bot hielt pauschal 300 px
   Abstand – der Tank reicht nur 250. Er floh damit aus seiner eigenen
   Reichweite und schoss minutenlang ins Leere.
2. **Merken, wann er zuletzt getroffen hat.** Trifft er drei Sekunden nichts,
   obwohl Gegner leben, steht eine Wand dazwischen – dann geht er stur nach
   vorne, statt Abstand zu halten.

### Stand nach der Messung vom 2026-09-17

| Charakter | Wellen (Bot) |
| --------- | ------------ |
| Scout     | 10,8         |
| Tank      | 10,0         |
| Sniper    | 9,0          |

Vorher: Scout 5,0 · Tank 10,4 · Sniper 9,0. Der Scout starb in **allen fünf**
Durchläufen in Welle 5.

### Drei Fehler, die die Messung aufgedeckt hat

Alle drei sahen nach schlechtem Balancing aus und waren Fehler im Code:

1. **Schützen blieben hinter Deckung stehen.** Sie hielten Abstand, ohne zu
   prüfen, ob sie den Spieler überhaupt sehen. Schiessen konnten sie nicht
   (braucht Sicht), getroffen wurden sie auch nicht (die Wand fängt die
   Schüsse). Wellen dauerten dann 290 bis 400 Sekunden statt dreissig. Jetzt
   hält ein Schütze nur Abstand, **wenn er Sicht hat**; sonst geht er vor.
2. **Der Dash schlug durch die Aussenmauer.** Die Mauer ist 40 px dick, ein
   Tick dauert 1/30 s. Ab 1200 px/s springt der Spieler in einem Tick weiter,
   als die Mauer dick ist, und `resolveAgainstWalls` schiebt ihn nach **aussen**.
   Zwei Gegenmassnahmen: Dash-Tempo bleibt bei 1150 (Reichweite kommt über die
   Dauer), und `clampToArena` hält Spieler und Gegner als Notbremse im Feld.
   `state.bounds` gab es schon – es wurde nur nie benutzt.
3. **Der Super lud je Treffer, nicht je Schaden.** Der Scout feuert drei Kugeln
   je Schuss, der Sniper eine – der Scout lud dreimal so schnell, obwohl er pro
   Schuss weniger Schaden macht (660 gegen 900). Gemessen: Scout-Super alle
   0,9 s, Sniper-Super alle 4,4 s. Jetzt lädt er **je 1000 Punkten Schaden**.

### Änderungen an den Werten (jede mit Begründung im Code)

| Wert                             | Alt  | Neu  | Warum                                                                      |
| -------------------------------- | ---- | ---- | -------------------------------------------------------------------------- |
| `scout.shot.spread`              | 9°   | 6°   | Bei 9° lagen die äusseren Kugeln auf 450 px rund 35 px neben der Mitte, der Trefferradius ist 23 – auf Distanz traf nur die mittlere. |
| `SUPERS.scout.duration`          | 0,22 | 0,30 | Der Dash trug 250 px – weniger als die Reichweite eines Schützen, als Flucht also wirkungslos. Jetzt 345 px.                      |
| `SUPERS.scout.damage`            | 300  | 500  | Der schwächste der drei Supers (Tank 800 Fläche, Sniper doppelter Schaden 5 s).                                                    |
| `SUPERS.scout.invulnerableTime`  | –    | 0,30 | **Die wirksamste Änderung.** Der Scout kassierte in Welle 5 mehr Schaden als der Tank (2677 gegen 1342) bei 57 % von dessen Leben. Genau so lang wie der Dash: „Während du dashst, kann dir nichts passieren." |
| `PLAYER.superChargePerHit`       | 17   | –    | Ersetzt durch…                                                             |
| `PLAYER.superChargePerDamage`    | –    | 26   | …Aufladung je 1000 Schaden. Neutral gegenüber der Kugelzahl.                |

Der Bot ist **schlechter als ein Mensch**: keine Deckung, keine Büsche, kein
Ausweichen vor einzelnen Projektilen. Seine Zahlen sind eine Untergrenze. Das
Briefing nennt 8–15 Wellen als realistische Runde – ob das stimmt, zeigt erst
dein eigenes Spielen.

### Werte ohne Neubau probieren

`?tune=` überschreibt Zahlen aus `balance.ts` direkt in der Adresszeile
(`src/config/tuning.ts`):

```
?tune=characters.scout.health=3200
?tune=player.shootCooldown=0.1,enemies.runner.speed=140
?tune=supers.scout.invulnerableTime=0.5&debug=werte
```

Gesetzt wird nur, wo vorher schon eine Zahl stand – ein Tippfehler ändert also
nichts, sondern erscheint in der Liste „Nicht übernommen". `?debug=werte` blendet
Bildrate, Gegnerzahl, Munition, Leben, Superladung und Schaden/s ein, dazu alle
aktiven Überschreibungen.

**Nur solo brauchbar:** Im Koop rechnet der Host für alle. Ein Client mit eigenen
Werten sagt seine Bewegung falsch voraus und ruckelt. Das steht auch im Spiel auf
dem Bildschirm.

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
- Der Workflow liest den Basispfad aus dem Repo-Namen
  (`VITE_BASE_PATH=/${GITHUB_REPOSITORY#*/}/`) statt ihn fest einzutragen.
  Ohne den richtigen Basispfad zeigen alle Dateipfade ins Leere und man sieht
  nur die Hintergrundfarbe
- Ergebnis: `https://thcjk.github.io/Holdout/`
- Einmalig nötig: **Settings → Pages → Source: GitHub Actions**

### Die Lehre vom 2026-09-17: Umbenennen bricht den Basispfad

Das Repo hiess `thistle-and-crown` und heisst jetzt `Holdout`. Damit änderte
sich die Pages-Adresse von `/thistle-and-crown/` auf `/Holdout/` - aber im
Workflow stand der alte Pfad fest verdrahtet. Ergebnis auf dem iPhone: Die
Seite lud, jede Spieldatei darin zeigte auf `/thistle-and-crown/...` und war
dort nicht mehr da. Zu sehen war nur die Hintergrundfarbe - ein blaues Bild,
ohne Fehlermeldung.

Zwei Konsequenzen, beide im Code:

1. **Der Pfad wird abgeleitet, nicht eingetragen.** Beide Pages-Workflows
   bestimmen ihn aus `$GITHUB_REPOSITORY`. Das nächste Umbenennen tut nichts
   mehr weh.
2. **Stilles Scheitern gibt es nicht mehr.** `index.html` enthält einen
   Wächter in einfachem JavaScript (kein Modul, kein Import - er läuft
   also auch dann, wenn genau das Laden von Modulen kaputt ist): Ist nach
   8 Sekunden weder `window.__holdoutBooted` gesetzt noch ein Canvas da,
   erscheint eine deutsche Meldung mit der Adresse der Seite und einem Knopf,
   der Service Worker und Zwischenspeicher leert. Dazu fängt
   `src/platform/crashScreen.ts` Ausnahmen ab und zeigt sie samt Version an.
   Die Version steht ausserdem unten rechts im Menü - damit sieht man am
   Handy, welcher Stand wirklich installiert ist.

## Bekannte offene Punkte

- **Querformat lässt sich auf dem iPhone nicht technisch erzwingen.**
  `screen.orientation.lock` gibt es in iOS Safari nicht. Gelöst über den
  Startbildschirm, der auf das Drehen wartet – inklusive Notausgang für alle
  mit Rotationssperre. Siehe „Nur Handy".
- **Version 1.1.0 ist ein kaputter Stand** (falscher Basispfad, weisse bzw.
  blaue Seite). Heruntergeladen hat sie niemand (0 Downloads). Ab 1.1.1 ist es
  behoben; ob das alte Release gelöscht wird, entscheidet der Nutzer.
- **Die Balance ist am Bot gemessen, nicht am Menschen.** Scout 10,8 · Tank
  10,0 · Sniper 9,0 Wellen. Der Bot nutzt keine Deckung und keine Büsche – das
  sind Untergrenzen. Ob 8–15 Wellen stimmen, zeigt erst eigenes Spielen.
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
- **Die APK baut, ist aber nur debug-signiert.** Der Workflow lief am
  2026-09-17 auf Anhieb durch (rund 2 Minuten, 6,7 MB). Lokal ist sie nicht
  baubar: Das Android-SDK fehlt in der Entwicklungsumgebung und
  `dl.google.com` ist gesperrt. Ohne hinterlegten Keystore wechselt der
  Signaturschlüssel bei jedem Lauf - eine neue Version lässt sich dann nicht
  über die alte installieren, sondern erst nach dem Deinstallieren. Die vier
  Secrets dafür stehen im README.
- **Die APK ist auf keinem echten Gerät installiert worden.** Dass sie baut,
  heisst noch nicht, dass sie startet - das zeigt erst das Handy.
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
