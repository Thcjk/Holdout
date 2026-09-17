# Koop-Arena-Shooter – Projektbriefing für Claude Code

Stand: 2026-09-17

## 1. Ziel & Scope

**Ziel:** Ein Top-down-Arena-Shooter im Stil von Brawl Stars, spielbar im Handy-Browser, gehostet als statische PWA auf GitHub Pages. Kernmodus ist **Koop-Survival**: 1–4 Spieler halten gemeinsam gegen immer stärkere Gegnerwellen durch.

**Das ist Version 1 (V1):**

- Eine Arena mit Wänden, Hindernissen und Büschen
- Drei spielbare Charaktere mit unterschiedlicher Waffe und Super-Fähigkeit
- Wellensystem mit steigender Schwierigkeit, drei Gegnertypen
- Twin-Stick-Touchsteuerung (links laufen, rechts zielen und schiessen)
- Koop über WebRTC mit Raumcode, bis zu vier Spieler
- Score, Game Over, lokaler Highscore
- Als PWA auf dem Handy installierbar

**Das gehört bewusst NICHT zu V1** (später möglich, jetzt nicht bauen):

- PvP, also Spieler gegen Spieler
- Accounts, Login, Server-Datenbank, Cloud-Speicherstände
- Matchmaking mit Fremden, Online-Ranglisten
- Freischaltbare Charaktere, Skins, Shop, Währungen
- Mehrere Karten oder Spielmodi
- Cutscenes, Story, Tutorial-Level

**Wichtigste Projektregel:** Was nicht in der V1-Liste steht, wird nicht gebaut – auch dann nicht, wenn es "schnell noch" machbar wäre. Scope Creep ist bei Hobby-Spielprojekten die häufigste Todesursache.

**Kontext zum Entwickler:** Einsteiger in der Spieleentwicklung, mit Erfahrung aus eigenen Web-Projekten (Vite, GitHub Pages, PWA). Erklärungen auf Deutsch, Fachbegriffe beim ersten Auftreten kurz einordnen. Code lesbar und kommentiert, nicht maximal clever.

## 2. Spielkonzept & Core Loop

### Der Ablauf einer Runde

1. **Lobby:** Spieler wählt Charakter, erstellt einen Raum oder tritt per Raumcode bei. Host startet.
2. **Vorbereitung (5 Sekunden):** Countdown, Spieler positionieren sich, Wellennummer wird eingeblendet.
3. **Welle:** Gegner spawnen an den Kartenrändern und laufen auf die Spieler zu. Welle endet, wenn alle Gegner tot sind.
4. **Pause (10 Sekunden):** Heilung, kurzes Durchatmen, nächste Welle kündigt sich an.
5. **Wiederholen,** bis alle Spieler gleichzeitig am Boden sind → Game Over mit Score.

### Was die Spannung erzeugt

- **Kein Sieg, nur "wie weit kommst du":** Es gibt kein Ende. Der Reiz ist der eigene Rekord.
- **Wiederbelebung:** Ein gefallener Spieler ist nicht raus. Ein Mitspieler kann ihn durch 3 Sekunden danebenstehen wiederbeleben. Erst wenn alle gleichzeitig unten sind, ist die Runde vorbei. Das erzeugt die dramatischen Momente.
- **Munition als Ressource:** Jeder Charakter hat drei Munitionsladungen, die sich einzeln nachladen. Man kann nicht dauerfeuern, sondern muss Schüsse einteilen – das ist der Grund, warum Brawl Stars sich taktisch anfühlt und nicht wie Dauergeballer.
- **Super-Fähigkeit:** Lädt sich durch Treffer auf. Der Moment, in dem der Super bereit ist, ist der Moment, auf den man spielt.
- **Büsche:** Gegner sehen Spieler im Busch nicht. Rückzugsort, aber auch Falle.

### Kennzahlen

| Grösse             | Wert                                | Warum                                                                               |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Spieler pro Runde  | 1–4                                 | Auch allein voll spielbar                                                           |
| Arenagrösse        | 1600 × 1200 px Spielfeld            | Passt bei 4 Spielern auf einen Handy-Bildschirm, wenn die Kamera leicht herauszoomt |
| Dauer einer Welle  | 30–60 Sekunden                      | Kurz genug fürs Handy zwischendurch                                                 |
| Realistische Runde | 8–15 Wellen, 6–12 Minuten           | Lang genug für Fortschrittsgefühl                                                   |
| Zielbildrate       | 60 fps auf einem Mittelklasse-Handy | Bestimmt, wie viele Gegner gleichzeitig möglich sind                                |

### Kamera

Eine gemeinsame Kamera, die alle lebenden Spieler einrahmt und dabei automatisch zoomt (Phaser: `camera.startFollow` auf einen unsichtbaren Mittelpunkt, plus dynamischer Zoom je nach Spielerabstand). Minimum-Zoom festlegen, damit sich verstreute Spieler nicht gegenseitig die Sicht ruinieren. Wer zu weit weg läuft, bekommt einen Richtungspfeil am Bildschirmrand.

## 3. Steuerung & Game Feel

Das ist der wichtigste Abschnitt. Ein Spiel mit schlechter Steuerung ist unspielbar, egal wie gut der Rest ist. Hier lohnt sich mehr Zeit als irgendwo sonst.

### Twin-Stick auf Touch

- **Linker Daumen = Bewegung.** Virtueller Joystick, der dort erscheint, wo der Finger die linke Bildschirmhälfte berührt (nicht an fester Position – das ist der Unterschied zwischen "geht" und "fühlt sich gut an").
- **Rechter Daumen = Zielen und Schiessen.** Ziehen zeigt eine Ziellinie mit Reichweitenanzeige, Loslassen feuert. Nur antippen ohne Ziehen feuert automatisch auf den nächsten Gegner.
- **Super-Knopf** rechts unten, gleiche Zieh-Mechanik, ausgegraut solange nicht aufgeladen.
- **Tote Zone** von etwa 10 px, damit ein zitternder Daumen die Figur nicht ruckeln lässt.
- **Desktop-Fallback:** WASD zum Laufen, Maus zum Zielen, Linksklick feuert, Leertaste ist der Super. Zum Entwickeln und Testen unverzichtbar.

### Konkrete Feel-Parameter (Startwerte zum Justieren)

| Parameter                              | Wert                                            |
| -------------------------------------- | ----------------------------------------------- |
| Spielergeschwindigkeit                 | 220 px/s                                        |
| Beschleunigung bis Vollgeschwindigkeit | ca. 0,1 s (nicht sofort, nicht träge)           |
| Projektilgeschwindigkeit               | 600 px/s                                        |
| Nachladezeit pro Munitionsladung       | 1,6 s, Ladungen laden einzeln und parallel nach |
| Munitionsladungen                      | 3                                               |
| Unverwundbarkeit nach Treffer          | 0,3 s, mit Aufblinken                           |
| Wiederbelebungsdauer                   | 3,0 s in Reichweite bleiben                     |

### Juice – die kleinen Effekte

Ohne diese Effekte fühlt sich ein technisch korrektes Spiel tot an. Mit ihnen fühlt sich selbst ein simples Spiel gut an. Sie kosten wenig Aufwand und haben die grösste Wirkung pro Zeile Code:

- Kurzer Bildschirm-Shake beim eigenen Schuss und beim Gegnertod (sehr dezent, 2–4 px, sonst wird es übel)
- Aufblitzen des Gegners in Weiss bei Treffer
- Schadenszahlen, die kurz nach oben schweben
- Partikel beim Tod eines Gegners
- Rückstoss: Getroffene Gegner werden minimal zurückgestossen
- Kurzes Zeitlupen-Zucken (ca. 80 ms) beim Auslösen des Supers
- Spuranzeige hinter schnellen Projektilen

**Regel für Claude Code:** Juice-Effekte erst in Phase 3 einbauen, wenn die Mechanik steht – aber dann wirklich einbauen, nicht auf später verschieben.

## 4. Charaktere, Gegner & Wellen

### Die drei Charaktere

Drei Archetypen, die sich grundlegend unterschiedlich spielen – nicht drei Varianten derselben Figur.

|           | Scout                                                 | Tank                                                            | Sniper                                                             |
| --------- | ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Rolle     | Beweglich, Dauerfeuer                                 | Nahkampf, hält aus                                              | Reichweite, Präzision                                              |
| Leben     | 2400                                                  | 4200                                                            | 1800                                                               |
| Tempo     | 250 px/s                                              | 190 px/s                                                        | 220 px/s                                                           |
| Angriff   | 3 Kugeln im Fächer, je 220 Schaden, Reichweite 450 px | Schrotschuss, 5 Kugeln je 320 Schaden, Reichweite 250 px        | Ein Schuss, 900 Schaden, Reichweite 900 px, durchdringt Gegner     |
| Nachladen | 1,3 s                                                 | 1,9 s                                                           | 2,2 s                                                              |
| Super     | Kurzer Dash, der Gegner auf dem Weg zurückstösst      | Bodenstampfer: Flächenschaden 800 im Radius 200 px, betäubt 1 s | Zielscheinwerfer: markiert einen Gegner, doppelter Schaden für 5 s |

**Super-Aufladung** bei allen dreien: 100 % nach etwa 6 Treffern. Genau genommen: jeder Treffer lädt 17 %.

### Die drei Gegnertypen

|           | Läufer                                   | Brocken                             | Schütze                   |
| --------- | ---------------------------------------- | ----------------------------------- | ------------------------- |
| Verhalten | Rennt direkt auf den nächsten Spieler zu | Langsam, unaufhaltsam, viel Schaden | Hält Abstand und schiesst |
| Leben     | 600                                      | 2800                                | 900                       |
| Tempo     | 180 px/s                                 | 90 px/s                             | 140 px/s                  |
| Schaden   | 300 bei Berührung                        | 800 bei Berührung                   | 250 pro Schuss, alle 2 s  |
| Score     | 10                                       | 50                                  | 25                        |

**Gegner-KI:** bewusst simpel halten. Zielsuche über direkten Vektor plus einfache Hindernisvermeidung (Phaser Arcade Physics reicht, kein A\*-Pathfinding). Wenn Gegner an Ecken hängen bleiben, ist das anfangs akzeptabel – die Karte so bauen, dass es selten passiert.

### Wellenformel

Welle _n_ besteht aus:

- Läufer: `3 + n * 2` Stück
- Schützen: ab Welle 3, `floor(n / 2)` Stück
- Brocken: ab Welle 5, `floor(n / 4)` Stück
- Skalierung: Gegnerleben steigt um 8 % pro Welle (`leben * 1.08^n`), Schaden um 4 %
- Spieleranzahl: Gegnerzahl mal `0,6 + 0,4 * Spielerzahl`, damit vier Spieler nicht dieselbe Welle in Sekunden zerlegen
- Boss-Wellen: alle 5 Wellen ein Brocken mit fünffachem Leben und doppelter Grösse

Diese Zahlen sind ausdrücklich Startwerte. Nach Phase 4 wird gespielt und nachjustiert – sie gehören alle in **eine zentrale Konfigurationsdatei** (`src/config/balance.ts`), damit Anpassungen an einer Stelle passieren.

### Die Arena

Eine Karte, symmetrisch angelegt, mit: Aussenmauern; 6–8 Deckungsblöcken, die Schüsse blockieren; 3–4 Buschfeldern zum Verstecken; vier Spawnzonen an den Rändern, wo Gegner erscheinen (mit Warnmarkierung 1 s vorher); offener Mitte, damit es nicht zum Labyrinth wird. Als Tilemap bauen, nicht hart im Code – dann sind spätere Karten billig.

## 5. Technik-Stack & Projektstruktur

### Stack

| Bereich  | Wahl            | Begründung                                                                                                                                    |
| -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine   | Phaser 3        | 2D-Spiel-Framework mit Physik, Kollision, Sprites, Touch-Input, Tilemaps. Sehr gute Dokumentation, riesige Community, läuft gut auf dem Handy |
| Sprache  | TypeScript      | Typen fangen bei Spielcode viele Fehler vorab ab, gerade wenn Zustände zwischen Netzwerk und Spiel hin- und herwandern                        |
| Build    | Vite            | Kennst du schon, schneller Dev-Server, einfacher Build für Pages                                                                              |
| Netzwerk | PeerJS (WebRTC) | Direktverbindung zwischen Spielern, kein eigener Server nötig                                                                                 |
| PWA      | vite-plugin-pwa | Installierbar auf dem Handy, offline spielbar im Solo-Modus                                                                                   |
| Hosting  | GitHub Pages    | Wie bei deinen anderen Projekten, Deployment über GitHub Actions                                                                              |

Bewusst **nicht** verwendet: React oder ein anderes UI-Framework für das Spiel selbst. Das Spiel läuft komplett auf dem Phaser-Canvas, Menüs macht Phaser mit. Ein zusätzliches Framework wäre hier nur Reibung.

### Projektstruktur

```
src/
  main.ts                 Einstiegspunkt, Phaser-Konfiguration
  config/
    balance.ts            ALLE Spielwerte aus Abschnitt 4
    constants.ts          Bildschirmgrössen, Tiefenebenen, Farben
  scenes/
    BootScene.ts          Assets laden, Ladebalken
    MenuScene.ts          Charakterwahl, Raum erstellen/beitreten
    GameScene.ts          das eigentliche Spiel
    HudScene.ts           Overlay: Leben, Munition, Super, Welle, Score
    GameOverScene.ts      Ergebnis, Highscore, Neustart
  entities/
    Player.ts
    Enemy.ts
    Projectile.ts
    characters/           je Datei pro Charakter: Scout, Tank, Sniper
  systems/
    WaveManager.ts        Wellen berechnen und spawnen
    InputManager.ts       Twin-Stick + Tastatur, liefert einheitlichen InputState
    CombatSystem.ts       Schaden, Tod, Wiederbelebung
    ScoreSystem.ts
  net/
    NetworkManager.ts     PeerJS-Verbindungen, Raumcodes
    protocol.ts           Nachrichtentypen zwischen Host und Clients
    HostGame.ts           autoritative Simulation
    ClientGame.ts         Eingaben senden, Zustand darstellen
  ui/
    VirtualJoystick.ts
    Button.ts
public/
  assets/                 Sprites, Sounds, Tilemap
```

### Architektur-Grundregel

**Spiellogik und Darstellung strikt trennen.** Die Simulation (Positionen, Leben, Schaden) muss ohne Phaser-Rendering laufen können, weil der Host sie für alle rechnet. Konkret: keine Spiellogik in `update()` von Sprite-Klassen, sondern in den Systemen unter `systems/`, die auf reinen Datenobjekten arbeiten. Die Sprites lesen diesen Zustand nur aus und zeichnen ihn.

Das ist die eine Entscheidung, die man später nicht mehr billig nachholen kann. Alles andere im Projekt lässt sich umbauen, diese Trennung nicht.

### Fester Zeitschritt

Simulation mit festem Takt von **30 Ticks pro Sekunde** laufen lassen, Darstellung mit 60 fps und Interpolation dazwischen. Grund: Bei variablem Zeitschritt berechnen verschiedene Geräte unterschiedliche Ergebnisse, und im Mehrspielermodus driften die Spielstände auseinander.

### Deployment

- Repo unter `github.com/thcjk/<projektname>`, Pages aus dem GitHub-Actions-Workflow
- `vite.config.ts`: `base: '/<reponame>/'` – sonst laden auf Pages keine Assets
- Workflow bei jedem Push auf `main`: Build, dann Deploy
- Ab Phase 1 bereits live deployen, nicht erst am Ende. Auf dem echten Handy testen, nicht im Desktop-Browser mit schmalem Fenster – Touch-Verhalten und Leistung sind dort anders

## 6. Multiplayer-Architektur

### Das Modell: Host-authoritative Koop

Ein Spieler ist **Host**. Sein Gerät rechnet die komplette Simulation: Gegner, Treffer, Wellen, Leben. Die anderen sind **Clients**: Sie schicken nur ihre Eingaben und stellen dar, was der Host zurückmeldet.

Warum das hier funktioniert, obwohl es bei PvP problematisch wäre: Im Koop hat der Host keinen Vorteil davon zu schummeln – alle spielen gegen die KI. Und Verzögerung ist verzeihlicher, weil Gegner sich vorhersehbar bewegen.

```
Client                          Host
  │  Eingabe (30×/s)             │
  ├─────────────────────────────>│  simuliert alles
  │                              │
  │  Weltzustand (15×/s)         │
  │<─────────────────────────────┤
  │  interpoliert & zeichnet     │
```

### Verbindung über PeerJS

- Host erstellt Raum → bekommt eine Peer-ID → daraus wird ein 6-stelliger Raumcode erzeugt (lesbar, ohne verwechselbare Zeichen wie 0/O und 1/I)
- Clients geben den Code ein und verbinden sich direkt zum Host
- PeerJS nutzt einen öffentlichen Signalisierungs-Server nur zum Verbindungsaufbau; danach läuft der Datenverkehr direkt zwischen den Geräten
- Datenkanal auf `reliable: false` und `ordered: false` stellen – bei Spielzuständen ist die neueste Nachricht wichtiger als die vollständige Reihenfolge

**Bekannte Einschränkung, die eingeplant gehört:** WebRTC-Direktverbindungen scheitern bei manchen Mobilfunk-Netzen und strengen Firewalls (Stichwort NAT). Dann bräuchte es einen TURN-Server, den es nicht gratis gibt. Für V1 ist die Antwort darauf: Fehlermeldung mit dem Hinweis, es im WLAN zu versuchen, plus jederzeit nutzbarer Solo-Modus. Kein Grund, das Projekt daran aufzuhängen.

### Das Protokoll

Client → Host, 30× pro Sekunde:

```ts
type InputMessage = {
  t: "input";
  seq: number; // fortlaufende Nummer
  move: { x: number; y: number }; // normalisierter Richtungsvektor
  aim: { x: number; y: number } | null;
  fire: boolean;
  super: boolean;
};
```

Host → alle Clients, 15× pro Sekunde:

```ts
type StateMessage = {
  t: "state";
  tick: number;
  players: {
    id: string;
    x: number;
    y: number;
    hp: number;
    ammo: number;
    superCharge: number;
    down: boolean;
  }[];
  enemies: { id: number; type: number; x: number; y: number; hp: number }[];
  projectiles: { id: number; x: number; y: number; vx: number; vy: number }[];
  wave: number;
  score: number;
};
```

Dazu einzelne Ereignisnachrichten für Dinge, die nicht in jeden Zustand gehören: `enemy_died`, `player_down`, `player_revived`, `wave_start`, `game_over`.

**Datenmenge im Blick behalten:** Bei 20 Gegnern und 15 Zustandspaketen pro Sekunde kommt einiges zusammen. Zahlen auf eine Nachkommastelle runden, bevor sie verschickt werden. Reicht das nicht, nur Änderungen statt vollständiger Zustände senden – aber erst dann, nicht vorsorglich.

### Gegen das Gummiband-Gefühl

- **Client-side Prediction für die eigene Figur:** Der Client bewegt sich sofort auf eigene Eingabe, statt auf den Host zu warten. Widerspricht der Host, wird sanft korrigiert.
- **Interpolation für alle anderen Objekte:** Zustände 100 ms verzögert darstellen und zwischen zwei bekannten Positionen weich überblenden, statt sie springen zu lassen.

Beides ist für sich genommen nicht schwierig, aber es sind die zwei Dinge, die den Unterschied zwischen "spielbar" und "unspielbar" ausmachen.

### Host verlässt das Spiel

Für V1 die ehrliche Lösung: Runde endet für alle mit Hinweis "Host hat die Verbindung verlassen". Host-Migration ist aufwendig und lohnt sich für ein Spiel unter Freunden nicht.

## 7. Assets, Grafik & Audio

### Stil

Cartoon-Sprites in Top-down-Ansicht, kräftige Farben, klare Silhouetten. Wichtigstes Kriterium ist nicht Schönheit, sondern **Lesbarkeit auf einem kleinen Bildschirm**: Spieler, Gegner und Projektile müssen im Getümmel sofort unterscheidbar sein. Umsetzung über Farbkodierung – Spieler in hellen Blautönen, Gegner in Rot/Orange, eigene Projektile hell, gegnerische deutlich anders eingefärbt.

### Quellen (alle gratis und kommerziell nutzbar)

| Was                    | Wo                                                                    | Lizenz                         |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------ |
| Figuren, Waffen, Tiles | Kenney.nl – Pakete "Topdown Shooter", "Topdown Tanks", "Tiny Dungeon" | CC0, keine Namensnennung nötig |
| Weitere Sprites        | itch.io, Filter auf Free + Top-down                                   | je Paket prüfen                |
| Soundeffekte           | Kenney "Digital Audio"/"Impact Sounds", sonst freesound.org           | CC0 bzw. je Datei prüfen       |
| Musik                  | incompetech.com (Kevin MacLeod)                                       | CC-BY, Namensnennung nötig     |
| Icons für UI           | Kenney "Game Icons"                                                   | CC0                            |

Kenney ist für dieses Projekt die richtige Grundlage: ein einziger Stil über alle Pakete hinweg, sodass nichts zusammengewürfelt aussieht.

### Vorgehen

1. Phase 1–3 mit Platzhaltern bauen: farbige Kreise und Rechtecke, direkt in Phaser gezeichnet. Keine Zeit mit Grafik verlieren, solange sich die Mechanik noch ändert.
2. Ab Phase 5 echte Sprites einsetzen. Voraussetzung dafür ist, dass alle Grafikreferenzen von Anfang an über eine zentrale Asset-Datei laufen – dann ist der Austausch eine Stunde Arbeit statt drei Tage.
3. Sprites als Texture Atlas bündeln (Phaser lädt ein Bild statt fünfzig), spart deutlich Ladezeit auf dem Handy.

### Audio

Oft unterschätzt: Ton trägt mehr zum Spielgefühl bei als die Grafik. Minimalset für V1 – Schuss, Treffer, Gegnertod, eigener Schaden, Super bereit, Super ausgelöst, Wellenstart, Game Over. Dazu ein ruhiger Musikloop.

Als Audioformat `.ogg` mit `.m4a` als Rückfalloption. Wichtig fürs Handy: Web-Audio startet erst nach einer Nutzerinteraktion, der Ton muss also beim ersten Antippen initialisiert werden – sonst bleibt es auf iOS stumm. Stummschalt-Knopf im HUD nicht vergessen.

### Leistungsgrenzen fürs Handy

- **Object Pooling** für Projektile und Gegner: Objekte wiederverwenden statt ständig neu erzeugen und wegwerfen. Sonst ruckelt es durch die Speicherbereinigung – im Spielkontext der häufigste Leistungsfehler überhaupt.
- Maximal ~40 Gegner und ~60 Projektile gleichzeitig, mit hartem Limit im Code
- Partikeleffekte begrenzen, Textobjekte (Schadenszahlen) ebenfalls poolen
- Auf einem echten Handy testen, nicht nur im Desktop-Browser

## 8. Phasenplan

Jede Phase endet mit etwas, das **auf dem Handy läuft und deployed ist**. Keine Phase wird angefangen, bevor die vorherige abgeschlossen ist.

### Phase 1 – Fundament

Repo, Vite + Phaser + TypeScript, Ordnerstruktur, GitHub-Actions-Deployment, PWA-Grundgerüst. Eine leere Arena mit Wänden, ein steuerbares Rechteck mit Tastatur.

**Fertig, wenn:** Du auf `thcjk.github.io/<repo>/` ein Rechteck durch eine Arena bewegen kannst und es an Wänden stoppt.

### Phase 2 – Steuerung

Twin-Stick-Joysticks, Bewegung mit Beschleunigung, Zielen mit Ziellinie, Kamerafolge mit Zoom, Desktop-Fallback.

**Fertig, wenn:** Die Steuerung auf dem Handy Spass macht, bevor es überhaupt etwas zu tun gibt. Das ist ein Gefühlstest, kein technischer – wenn es sich zäh anfühlt, hier bleiben und nachjustieren.

### Phase 3 – Kampf

Schiessen mit Munitionssystem, Projektile mit Pooling, Läufer-Gegner mit simpler KI, Leben und Schaden, Tod, Juice-Effekte.

**Fertig, wenn:** Du Gegner erschiessen kannst, es sich befriedigend anfühlt und du sterben kannst.

### Phase 4 – Das Spiel entsteht

Wellensystem, alle drei Gegnertypen, Pausen zwischen Wellen, Score, Game-Over-Bildschirm, lokaler Highscore, HUD.

**Fertig, wenn:** Du eine vollständige Runde spielst, verlierst und sofort wieder anfangen willst. **Ab hier ist es ein echtes Spiel.** Zeige es jemandem. Das ist der Punkt, an dem die meisten Hobbyprojekte sterben – und der Grund, warum er absichtlich früh liegt.

### Phase 5 – Charaktere und Grafik

Die drei Charaktere mit eigenen Waffen und Supern, Charakterauswahl im Menü, Kenney-Sprites ersetzen die Platzhalter, Tilemap-Arena, Büsche, Sound.

**Fertig, wenn:** Alle drei Charaktere spielbar sind und sich spürbar unterschiedlich anfühlen.

### Phase 6 – Koop

PeerJS-Anbindung, Lobby mit Raumcode, Host-Simulation, Client-Darstellung, Prediction und Interpolation, Wiederbelebung, Verbindungsabbrüche abfangen.

**Fertig, wenn:** Du mit einer zweiten Person auf zwei Handys über verschiedene Netze zusammen spielen kannst.

Das ist die aufwendigste Phase – wahrscheinlich so lang wie Phase 1 bis 4 zusammen. Innerhalb der Phase in dieser Reihenfolge: erst zwei Browser-Tabs auf demselben Rechner, dann zwei Geräte im selben WLAN, dann über Mobilfunk.

### Phase 7 – Politur

Balancing nach echten Testrunden, Menüfeinschliff, Musik, PWA-Feinheiten (Icon, Splash Screen, Querformat erzwingen), Leistungsoptimierung, Fehlerbehebung.

**Fertig, wenn:** Du es Freunden schicken kannst, ohne etwas erklären zu müssen.

### Realistische Einschätzung

Phase 1–4 sind für einen Einsteiger mit Claude Code gut machbar. Phase 6 ist objektiv schwer – Netzwerkcode ist auch für erfahrene Entwickler unangenehm, weil Fehler sich als seltsames Verhalten statt als saubere Fehlermeldung zeigen. Wenn du dort stecken bleibst: Das Spiel ist nach Phase 5 bereits fertig und spielbar. Der Koop ist ein Bonus, kein Scheitern, wenn er länger dauert.

## 9. Arbeitsweise mit Claude Code

### Vorbereitung

1. Leeres GitHub-Repo anlegen, lokal klonen
2. Dieses Briefing als `BRIEFING.md` ins Repo legen
3. Claude Code im Projektordner starten

### Erster Prompt

> Lies BRIEFING.md. Wir bauen dieses Spiel gemeinsam in Phasen. Lege zuerst eine CLAUDE.md an, in der du die Architektur-Grundregeln und den aktuellen Stand festhältst. Danach setzen wir nur Phase 1 um – nichts aus späteren Phasen. Erkläre mir dabei auf Deutsch, was du tust, ich bin Einsteiger in der Spieleentwicklung.

### Die vier Regeln, die den Unterschied machen

1. **Eine Phase pro Sitzung.** Nicht "bau mal das ganze Spiel". Grosse Aufträge führen zu viel Code, den du nicht mehr überblickst – und wenn es dann nicht funktioniert, weiss niemand mehr, wo.
2. **Nach jeder Phase selbst spielen und deployen.** Erst dann weiter. Fehler, die man sofort findet, kosten Minuten; Fehler, die drei Phasen später auffallen, kosten Stunden.
3. **Lass dir erklären, was gebaut wurde.** Du willst programmieren lernen, nicht nur ein Spiel besitzen. Frag nach dem Warum, gerade bei Phaser-Konzepten wie Scenes, Groups und dem Physiksystem.
4. **CLAUDE.md aktuell halten.** Darin: aktuelle Phase, Architekturentscheide, bekannte Fehler, was absichtlich weggelassen wurde. Claude Code liest sie bei jedem Start – das ist dein Gedächtnis zwischen den Sitzungen.

### Typischer Sitzungsablauf

> Wir sind bei Phase 3. Lies CLAUDE.md für den Stand. Heute: Munitionssystem mit drei Ladungen und parallelem Nachladen, plus die Gegner-Projektile. Werte aus src/config/balance.ts verwenden. Zeig mir den Plan, bevor du Code schreibst.

Und am Ende der Sitzung:

> Aktualisiere CLAUDE.md mit dem, was wir heute gemacht haben und was als Nächstes ansteht.

### Wenn etwas nicht funktioniert

Beschreibe das **Verhalten**, nicht deine Vermutung über die Ursache: "Die Figur bleibt an der linken Wand hängen und zittert" ist zehnmal nützlicher als "die Kollision ist kaputt". Bei Spielcode ist das besonders wichtig, weil Fehler sich selten als Fehlermeldung zeigen, sondern als komisches Verhalten.

Bei Leistungsproblemen: Zahlen liefern. Bildrate, Anzahl Gegner, welches Handy.

### Was du selbst entscheiden solltest

Balancing und Game Feel. Claude Code kann dir jede Zahl ins System schreiben, aber ob sich das Spiel gut anfühlt, merkst nur du beim Spielen. Die Werte in `balance.ts` sind Vorschläge – dass du sie änderst, ist der Sinn der Sache, nicht ein Zeichen, dass etwas falsch war.
