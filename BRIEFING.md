# Koop-Arena-Shooter – Projektbriefing für Claude Code

Stand: 2026-09-23 (grosser Pivot, siehe Abschnitt 1). Die vorherige Fassung
vom 2026-09-17 steht in der Git-Historie.

## 1. Ziel & Scope

**Update (grosser Pivot):** Das Konzept hat sich von einem klassischen Wellen-Survival-Shooter zu einem **Koop-Roguelike mit Extraction-Loot** weiterentwickelt. Kern bleibt ein Top-down-Twin-Stick-Shooter im Handy-Browser (PWA, GitHub Pages), aber die Spielstruktur ist grundlegend anders.

**Ziel:** Prozedural generierte, offene Welt pro Durchlauf ("Run"). 1–4 Spieler kämpfen sich gemeinsam durch, sammeln Loot in einem gitterbasierten Rucksack-Inventar (Tarkov-Stil), und entscheiden sich entweder für einen frühen, sicheren Ausstieg an einem Extraktionspunkt oder fürs Risiko, bis zum Ende-Boss vorzudringen. Stirbt das ganze Team gleichzeitig (Team-Wipe), geht das im Run getragene Loot verloren. Bei Erfolg wandert es ins dauerhafte, lokal gespeicherte Lager.

**Das ist jetzt Teil des Konzepts (Erweiterung ggü. ursprünglichem V1):**

- Prozedural generierte, offene Welt statt einer festen Arena, pro Run neu (gemeinsamer Seed für Koop)
- Organische Gegnerdichte (steigt mit Entfernung vom Start) plus feste Mini-Boss-Encounter und ein Ende-Boss
- Mehrere Extraktionspunkte zum freiwilligen, vorzeitigen Ausstieg mit Loot
- Gitterbasiertes Rucksack-Inventar (unterschiedlich geformte Items, begrenzter Platz)
- Loadout-Auswahl vor dem Run, Loot-Verlust bei Team-Wipe, Loot-Sicherung bei Erfolg
- Dauerhaftes, lokal gespeichertes Lager zwischen Runs, inkl. geschütztem Starter-Set
- Gefundene Waffen ersetzen direkt die Basis-Waffe des Charakters
- Pausieren und Fortsetzen eines laufenden Runs (Speicherstand)

**Das ist weiterhin NICHT geplant:**

- PvP, also Spieler gegen Spieler
- Accounts, Login, zentraler Server, geräteübergreifende Cloud-Speicherstände (Fortschritt bleibt lokal auf dem Gerät)
- Matchmaking mit Fremden, Online-Ranglisten
- Skins, Kosmetik, Echtgeld-Shop
- Mehrere unterschiedliche Spielmodi nebeneinander (der Roguelike-Run ist jetzt der einzige Modus)
- Cutscenes, Story, Tutorial-Level

**Wichtigste Projektregel bleibt bestehen:** Was nicht in der Liste steht, wird nicht gebaut. Bei diesem grösseren Scope gilt das umso mehr – siehe Phasenplan (Abschnitt 8) für die genaue Reihenfolge.

**Kontext zum Entwickler:** Einsteiger in der Spieleentwicklung. Twin-Stick-Grundgerüst, Koop-Netzwerk und Pixel-Art-Integration aus dem ursprünglichen Konzept sind bereits umgesetzt und funktionsfähig – dieser Umbau baut darauf auf, ersetzt aber die Kernschleife (Wellen → offene Welt/Loot/Extraktion). Erklärungen auf Deutsch, Fachbegriffe beim ersten Auftreten kurz einordnen.

## 2. Spielkonzept & Core Loop

### Der Ablauf eines Runs

1. **Vorbereitung (Basis/Lager):** Charakter wählen (Scout/Tank/Sniper), Rucksack-Loadout aus dem eigenen Lager zusammenstellen – begrenzt durch die Gitterfläche. Starter-Set steht immer zur Verfügung.
2. **Lobby:** Host erstellt Raum, Freunde treten per Raumcode bei. Host generiert die Welt aus einem zufälligen Seed und teilt ihn mit allen Clients, damit alle exakt dieselbe Karte sehen.
3. **Erkundung:** Offene, zusammenhängende Welt. Grundgegner tauchen organisch auf, dichter je weiter man sich vom Startpunkt entfernt. Feste Mini-Boss-Encounter an bestimmten Stellen, plus verteilte Loot-Fundorte.
4. **Entscheidung unterwegs:** An Extraktionspunkten kann das Team jederzeit gemeinsam aussteigen und das bisherige Loot sichern – oder tiefer ins Risiko weiterziehen, Richtung Ende-Boss.
5. **Ende-Boss (optional):** Wer ihn besiegt, gilt als voller Erfolg – bestes Loot, maximale Belohnung.
6. **Tod eines Spielers:** Wie bisher – Mitspieler kann innerhalb von 3 Sekunden Nähe wiederbeleben. Sicher, kein Loot-Verlust dabei.
7. **Team-Wipe:** Sind alle Spieler GLEICHZEITIG unten, endet der Run – das gesamte im Rucksack getragene Loot dieses Runs ist verloren. Das Lager bleibt unberührt.
8. **Nach dem Run:** Bei Extraktion oder Bosssieg wandert das gesammelte Loot vom Rucksack ins dauerhafte Lager, von dort aus wird das nächste Loadout zusammengestellt.

### Was die Spannung erzeugt

- **Risiko vs. Belohnung:** Der zentrale Entscheidungsmoment ist immer "aussteigen oder weiter?" – ersetzt das alte "wie weit komme ich"-Prinzip durch eine aktive, wiederholte Entscheidung.
- **Verlustangst als Motor:** Weil man das eigene Loadout verlieren kann, fühlt sich jede Entscheidung im Run wichtiger an als in einem reinen Score-Loop.
- **Wiederbelebung bleibt der Teamrettungsanker:** Ein gefallener Spieler ist nicht sofort raus, solange ein Mitspieler noch steht.
- **Munition als Ressource:** Unverändert – drei einzeln nachladende Munitionsladungen, kein Dauerfeuer.
- **Super-Fähigkeiten:** Laden weiterhin durch Treffer auf, aber neue Werte für Tank und Sniper (siehe Abschnitt 4).

### Technische Kennzahlen (aktualisiert)

| Grösse | Wert | Warum |
| --- | --- | --- |
| Spieler pro Run | 1–4 | Auch allein voll spielbar |
| Weltgrösse | deutlich grösser als die bisherige 1600×1200-Arena, exakte Grösse in Phase 8 festlegen | Muss Raum für organische Gegnerdichte und mehrere Encounter-Punkte bieten |
| Run-Dauer | variabel: ca. 5–10 Min bei früher Extraktion, bis 25–30 Min bei Ende-Boss-Route | Bewusst variabel statt fest, das ist Teil der Risiko-Entscheidung |
| Zielbildrate | 60 fps auf einem Mittelklasse-Handy | Unverändert |

### Kamera

Unverändert: gemeinsame Kamera mit dynamischem Zoom je nach Spielerabstand. Bei der offenen Welt zusätzlich wichtig: Sichtweite bewusst begrenzen (kein "alles auf einen Blick"), damit die Welt bedrohlich/unübersichtlich bleibt – passt zum neuen Sniper-Super (Aufklärungsschuss), der genau dieses Problem gezielt löst.

## 3. Steuerung & Game Feel

Das ist der wichtigste Abschnitt. Ein Spiel mit schlechter Steuerung ist unspielbar, egal wie gut der Rest ist. Hier lohnt sich mehr Zeit als irgendwo sonst.

### Twin-Stick auf Touch

- **Linker Daumen = Bewegung.** Virtueller Joystick, der dort erscheint, wo der Finger die linke Bildschirmhälfte berührt (nicht an fester Position – das ist der Unterschied zwischen "geht" und "fühlt sich gut an").
- **Rechter Daumen = Zielen und Schiessen.** Ziehen zeigt eine Ziellinie mit Reichweitenanzeige, Loslassen feuert. Nur antippen ohne Ziehen feuert automatisch auf den nächsten Gegner.
- **Super-Knopf** rechts unten, gleiche Zieh-Mechanik, ausgegraut solange nicht aufgeladen.
- **Tote Zone** von etwa 10 px, damit ein zitternder Daumen die Figur nicht ruckeln lässt.
- **Desktop-Fallback:** WASD zum Laufen, Maus zum Zielen, Linksklick feuert, Leertaste ist der Super. Zum Entwickeln und Testen unverzichtbar.

### Konkrete Feel-Parameter (Startwerte zum Justieren)

| Parameter | Wert |
| --- | --- |
| Spielergeschwindigkeit | 220 px/s |
| Beschleunigung bis Vollgeschwindigkeit | ca. 0,1 s (nicht sofort, nicht träge) |
| Projektilgeschwindigkeit | 600 px/s |
| Nachladezeit pro Munitionsladung | 1,6 s, Ladungen laden einzeln und parallel nach |
| Munitionsladungen | 3 |
| Unverwundbarkeit nach Treffer | 0,3 s, mit Aufblinken |
| Wiederbelebungsdauer | 3,0 s in Reichweite bleiben |

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

## 4. Welt, Charaktere, Gegner & Loot

### Die Welt

Offene, zusammenhängende, prozedural generierte Karte pro Run (kein Raum-für-Raum-System). Generierung muss **deterministisch aus einem Seed** erfolgen, damit Host und alle Clients exakt dieselbe Welt sehen (wichtig für Koop, siehe Abschnitt 6).

- **Startpunkt:** klar erkennbar, ungefährliche Zone direkt darum.
- **Gegnerdichte:** steigt mit Distanz vom Startpunkt (organisch, kein festes Wellen-Timing mehr).
- **Encounter-Punkte:** feste, markierte Stellen mit Mini-Bossen – stärkerer Gegner oder kleine Gruppe, besserer Loot-Drop als Belohnung.
- **Ende-Boss:** ein Encounter-Punkt, meist am weitesten vom Start entfernt, deutlich stärker als Mini-Bosse.
- **Extraktionspunkte:** mehrere über die Karte verteilt, betretbare Zone mit kurzem Countdown/Bestätigung, danach verlässt das Team (gemeinsam) den Run mit dem gesammelten Loot.
- **Loot-Fundorte:** verteilt über die Karte (Kisten, Gegner-Drops), Häufigkeit/Qualität steigt mit Entfernung vom Start.

### Die drei Charaktere (aktualisiert)

|  | **Scout** | **Tank** | **Sniper** |
| --- | --- | --- | --- |
| Rolle | Beweglich, Dauerfeuer | Nahkampf, Team-Support | Reichweite, Präzision, Aufklärung |
| Leben | 2400 | 4200 | 1800 |
| Tempo | 250 px/s | 190 px/s | 220 px/s |
| Angriff | Aus dem Rucksack-Loadout | Aus dem Rucksack-Loadout | Aus dem Rucksack-Loadout |
| Zweite Fähigkeit | Blendgranate (Wurf, Radius 150px, blendet 1,5s) | Schildwand entfällt | Lähmschuss (900 Reichweite, wurzelt 1,5s) |
| Super | Kurzer Dash, stösst Gegner zurück | **Heilen:** grosser Radius, heilt ALLE Teammitglieder im Bereich | **Aufklärungsschuss** (neu, siehe unten) |

**Wichtige Änderung ggü. dem ursprünglichen Konzept:** Die Basis-Waffe kommt nicht mehr aus festen Charakterwerten, sondern aus dem Rucksack-Loadout (siehe Loot-System unten). Die Klassen-Identität (Leben, Tempo, zweite Fähigkeit, Super) bleibt fest an Scout/Tank/Sniper gebunden, unabhängig von der mitgeführten Waffe.

**Tank-Heilung (neu):** Ersetzt die bisherige Schildwand komplett. Grosser Wirkradius um den Tank, heilt alle Teammitglieder im Bereich über Zeit (genaue Werte in Phase 14 austesten). Macht den Tank zum echten Support-Anker der Gruppe.

**Sniper-Aufklärungsschuss (neu):** Spezielles Geschoss, das beim Einschlag alle Gegner, Loot und Punkte von Interesse in grossem Radius für das GESAMTE Team sichtbar macht (z.B. 6 Sekunden). Aufgedeckte Gegner nehmen dabei erhöhten Schaden von JEDEM Teammitglied, nicht nur vom Sniper. Team-Utility statt reinem Einzelschaden – wichtig gerade in der offenen, unübersichtlichen Welt.

### Auto-Aim-Anpassung (für alle Charaktere)

Reichweite/Zielkegel des automatischen Anvisierens (Basisangriff-Button, siehe Abschnitt 3) wird deutlich verkleinert. Manuelles Zielen (Ziehen zum Anvisieren) soll wieder mehr Gewicht bekommen – genaue neue Werte in Phase 14 austesten.

### Die drei Gegnertypen (unverändert in der Grundidee)

|  | **Läufer** | **Brocken** | **Schütze** |
| --- | --- | --- | --- |
| Verhalten | Rennt direkt auf den nächsten Spieler zu | Langsam, unaufhaltsam, viel Schaden | Hält Abstand und schiesst |
| Leben | 600 | 2800 | 900 |
| Tempo | 180 px/s | 90 px/s | 140 px/s |
| Schaden | 300 bei Berührung | 800 bei Berührung | 250 pro Schuss, alle 2s |

**Gegner-KI:** weiterhin bewusst simpel (direkter Vektor + einfache Hindernisvermeidung), jetzt organisch über die Welt verteilt statt in Wellen gespawnt.

### Schwierigkeitsformel (ersetzt die alte Wellenformel)

Statt einer Zeit-Wellenformel jetzt eine **Distanz-Formel**, abhängig von der Entfernung `d` zum Startpunkt (genau kalibrieren in Phase 8):

- **Gegnerdichte:** steigt proportional mit `d`
- **Gegnerleben/-schaden:** steigt mit `d` (ähnliches Prinzip wie bisher, aber Distanz-Zone statt Wellennummer)
- **Encounter-Stärke:** Mini-Bosse und Loot-Qualität skalieren ebenfalls mit `d`
- **Spieleranzahl:** wie bisher, Gegnerzahl mal `0,6 + 0,4 * Spielerzahl`

Alle Werte weiterhin zentral in `src/config/balance.ts`.

### Loot-System: Rucksack-Inventar

Gitterbasiertes Inventar (Tarkov-Prinzip): Items haben unterschiedliche Formen (1x1, 2x1, 2x2, L-Form usw.) und belegen mehrere Gitterzellen im Rucksack. Rucksackgrösse begrenzt, wie viel man mitnehmen/mitbringen kann.

- **Vor dem Run:** Loadout aus dem Lager zusammenstellen (Drag & Drop, Rotation von Items).
- **Während des Runs:** gefundenes Loot aufsammeln, wenn Platz im Rucksack ist.
- **Waffen als Loot:** ersetzen direkt die aktive Basis-Waffe, sobald ausgerüstet.
- **Bei Erfolg (Extraktion oder Bosssieg):** kompletter Rucksack-Inhalt wandert ins dauerhafte Lager.
- **Bei Team-Wipe:** kompletter Rucksack-Inhalt dieses Runs ist verloren. Lager bleibt unberührt.
- **Starter-Set:** feste, unverlierbare Grundausrüstung, unabhängig vom Rucksack-/Lagerzustand immer verfügbar – Sicherheitsnetz gegen komplettes Leerlaufen.

### Dauerhaftes Lager & Meta-Fortschritt

Lokal auf dem Gerät gespeichert (kein Server, siehe Abschnitt 1). Enthält das gesamte gesicherte Loot aus erfolgreichen Runs plus – Details in Phase 13 auszuarbeiten – eine Mischung aus mehreren Progressionsarten (z.B. dauerhafte Verbesserungen, freischaltbare Ausrüstung).

### Speichern/Fortsetzen eines laufenden Runs

Ein pausierter Run soll später an derselben Stelle fortsetzbar sein. Technisch anspruchsvoll, besonders im Koop (wer speichert den Weltzustand, wie wird beim Rejoinen synchronisiert?) – eigene Phase (15), bewusst spät im Plan.

## 5. Technik-Stack & Projektstruktur

### Stack

| Bereich | Wahl | Begründung |
| --- | --- | --- |
| Engine | **Phaser 3** | 2D-Spiel-Framework mit Physik, Kollision, Sprites, Touch-Input, Tilemaps. Sehr gute Dokumentation, riesige Community, läuft gut auf dem Handy |
| Sprache | **TypeScript** | Typen fangen bei Spielcode viele Fehler vorab ab, gerade wenn Zustände zwischen Netzwerk und Spiel hin- und herwandern |
| Build | **Vite** | Kennst du schon, schneller Dev-Server, einfacher Build für Pages |
| Netzwerk | **PeerJS** (WebRTC) | Direktverbindung zwischen Spielern, kein eigener Server nötig |
| PWA | **vite-plugin-pwa** | Installierbar auf dem Handy, offline spielbar im Solo-Modus |
| Hosting | **GitHub Pages** | Wie bei deinen anderen Projekten, Deployment über GitHub Actions |

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

- Host erstellt Raum → bekommt eine Peer-ID → daraus wird ein **6-stelliger Raumcode** erzeugt (lesbar, ohne verwechselbare Zeichen wie 0/O und 1/I)
- Clients geben den Code ein und verbinden sich direkt zum Host
- PeerJS nutzt einen öffentlichen Signalisierungs-Server nur zum Verbindungsaufbau; danach läuft der Datenverkehr direkt zwischen den Geräten
- Datenkanal auf `reliable: false` und `ordered: false` stellen – bei Spielzuständen ist die neueste Nachricht wichtiger als die vollständige Reihenfolge

**Bekannte Einschränkung, die eingeplant gehört:** WebRTC-Direktverbindungen scheitern bei manchen Mobilfunk-Netzen und strengen Firewalls (Stichwort NAT). Dann bräuchte es einen TURN-Server, den es nicht gratis gibt. Für V1 ist die Antwort darauf: Fehlermeldung mit dem Hinweis, es im WLAN zu versuchen, plus jederzeit nutzbarer Solo-Modus. Kein Grund, das Projekt daran aufzuhängen.

### Das Protokoll

Client → Host, 30× pro Sekunde:

```ts
type InputMessage = {
  t: 'input'
  seq: number          // fortlaufende Nummer
  move: { x: number; y: number }   // normalisierter Richtungsvektor
  aim: { x: number; y: number } | null
  fire: boolean
  super: boolean
}
```

Host → alle Clients, 15× pro Sekunde:

```ts
type StateMessage = {
  t: 'state'
  tick: number
  players: { id: string; x: number; y: number; hp: number; ammo: number;
             superCharge: number; down: boolean }[]
  enemies: { id: number; type: number; x: number; y: number; hp: number }[]
  projectiles: { id: number; x: number; y: number; vx: number; vy: number }[]
  wave: number
  score: number
}
```

Dazu einzelne Ereignisnachrichten für Dinge, die nicht in jeden Zustand gehören: `enemy_died`, `player_down`, `player_revived`, `wave_start`, `game_over`.

**Datenmenge im Blick behalten:** Bei 20 Gegnern und 15 Zustandspaketen pro Sekunde kommt einiges zusammen. Zahlen auf eine Nachkommastelle runden, bevor sie verschickt werden. Reicht das nicht, nur Änderungen statt vollständiger Zustände senden – aber erst dann, nicht vorsorglich.

### Gegen das Gummiband-Gefühl

- **Client-side Prediction** für die eigene Figur: Der Client bewegt sich sofort auf eigene Eingabe, statt auf den Host zu warten. Widerspricht der Host, wird sanft korrigiert.
- **Interpolation** für alle anderen Objekte: Zustände 100 ms verzögert darstellen und zwischen zwei bekannten Positionen weich überblenden, statt sie springen zu lassen.

Beides ist für sich genommen nicht schwierig, aber es sind die zwei Dinge, die den Unterschied zwischen "spielbar" und "unspielbar" ausmachen.

### Host verlässt das Spiel

Für V1 die ehrliche Lösung: Runde endet für alle mit Hinweis "Host hat die Verbindung verlassen". Host-Migration ist aufwendig und lohnt sich für ein Spiel unter Freunden nicht.

## 7. Assets, Grafik & Audio

### Stil

**Update:** Statt gratis Cartoon-Sprites wird das gekaufte Bundle **"Kenney Game Assets All-in-1 3.7.0"** verwendet, konkret das Paket **"Topdown Shooter (Pixel)"** aus den 2D-Assets. Das ändert den optischen Stil von glattem Cartoon zu **Pixel Art** – technisch gleichwertig, aber mit einer Konsequenz (siehe unten). Das Paket enthält laut Originalbeschreibung Tiles, Spielfiguren, Gegner und Objekte in top-down-tauglicher Perspektive (Charaktere drehen sich sichtbar in Bewegungs-/Zielrichtung). Das ebenfalls im Bundle enthaltene "Toon Characters"-Paket wird NICHT verwendet, da es für Seitenansicht/Plattformer gemacht ist und keine Top-down-Drehung hat.

### Wichtigste technische Konsequenz von Pixel Art

Phaser skaliert Bilder standardmässig mit weicher Kantenglättung. Bei Pixel-Art-Sprites macht das die Grafik verwaschen statt scharf. Muss explizit umgestellt werden:

```js
// In der Phaser-Spielkonfiguration:
pixelArt: true,
roundPixels: true
```

### Asset-Datei

Ordner: `2D assets/Topdown Shooter (Pixel)/Tilesheet/`

- `tilesheet_transparent.png` verwenden (echte Alpha-Transparenz), NICHT `tilesheet_magenta.png` (alte Kompatibilitätsvariante mit pinkem statt transparentem Hintergrund)
- Dazugehörige Koordinatendatei (XML oder JSON) im selben Ordner prüfen – legt fest, wo auf dem Sheet welches Einzelsprite liegt. Falls vorhanden, als Phaser-Atlas laden (`this.load.atlasXML(...)` bzw. `this.load.atlas(...)`)

### Weitere Quellen (falls das Shooter-Paket nicht alles abdeckt)

| Was | Wo | Lizenz |
| --- | --- | --- |
| Zusätzliche Tiles/Deckung | Weitere Pakete im gleichen Bundle, z.B. "Tiny Dungeon" | CC0 |
| Soundeffekte | "Digital Audio"/"Impact Sounds" im gleichen Bundle | CC0 |
| Musik | incompetech.com (Kevin MacLeod) | CC-BY, Namensnennung nötig |

### Vorgehen

1. **Phase 1–3 mit Platzhaltern bauen:** farbige Kreise/Rechtecke direkt in Phaser. Solange sich die Mechanik noch ändert, keine Zeit mit Grafik verlieren.
2. **Ab Phase 5 echte Sprites einsetzen**, sobald alle Grafikreferenzen über eine zentrale Asset-Datei laufen (dann ist der Austausch schnell erledigt).
3. Sprites liegen bereits als **ein zusammenhängendes Tilesheet** vor (kein manuelles Bündeln nötig) – spart Ladezeit auf dem Handy von Haus aus.

### Audio

Minimalset für V1 – Schuss, Treffer, Gegnertod, eigener Schaden, Super bereit, Super ausgelöst, Wellenstart, Game Over, dazu ein ruhiger Musikloop. Format `.ogg` mit `.m4a` als Rückfalloption. Web-Audio startet auf dem Handy erst nach einer Nutzerinteraktion – beim ersten Antippen initialisieren, sonst bleibt es auf iOS stumm. Stummschalt-Knopf im HUD nicht vergessen.

### Leistungsgrenzen fürs Handy

- **Object Pooling** für Projektile und Gegner: wiederverwenden statt ständig neu erzeugen/wegwerfen. Sonst ruckelt es durch Speicherbereinigung – häufigster Leistungsfehler bei Spielen.
- Maximal ~40 Gegner und ~60 Projektile gleichzeitig, hartes Limit im Code
- Partikeleffekte begrenzen, Textobjekte (Schadenszahlen) ebenfalls poolen
- Auf einem echten Handy testen, nicht nur im Desktop-Browser

## 8. Phasenplan

Jede Phase endet mit etwas, das **auf dem Handy läuft und deployed ist**. Keine Phase wird angefangen, bevor die vorherige abgeschlossen ist.

### Bereits umgesetzt (ursprüngliches Konzept)

Fundament, Steuerung, Kampfsystem, Wellensystem (wird jetzt ersetzt), Pixel-Art-Integration, Koop-Grundgerüst mit PeerJS und TURN-Server sind bereits gebaut und funktionsfähig. Dieser Umbau ersetzt primär die Kernschleife (Wellen → offene Welt) und erweitert das Charaktersystem (Loot, Inventar) – baut aber auf dem bestehenden Fundament auf. Twin-Stick-Steuerung, Host-authoritative Netzwerk-Architektur, Combat-System und Sprite-Integration bleiben grösstenteils erhalten.

### Phase 8 – Weltgenerierung-Fundament

Feste Arena durch prozedural generierte, offene Welt ersetzen. Deterministische Generierung aus einem Seed (gleicher Seed = exakt gleiche Welt, Voraussetzung für Koop-Sync). Alte Wellen-Logik entfernen, Gegner spawnen organisch nach Distanz zum Startpunkt. Noch OHNE Loot, Encounter-Punkte oder Extraktion.

**Fertig, wenn:** Eine generierte, offene Welt ist spielbar, Gegner tauchen organisch dichter werdend auf, alte Wellen-Logik ist entfernt.

### Phase 9 – Encounter- & Boss-System

Feste Mini-Boss-Encounter-Punkte platzieren. Boss-Gegnertyp bauen (mehr Leben, eigene Angriffsmuster). Extraktionspunkte als begehbare Zonen mit Countdown/Bestätigung – noch ohne echten Loot-Verlust/-Gewinn, nur die Mechanik selbst.

**Fertig, wenn:** Man kann auf einen Mini-Boss treffen, ihn besiegen, und sich an einem Extraktionspunkt oder beim Ende-Boss erfolgreich aus dem Run verabschieden.

### Phase 10 – Loot-Grundsystem

Items droppen von Gegnern/Encounter-Punkten, aufsammelbar. Vorerst simpel: Items als Datenobjekte mit Grösse/Form-Eigenschaft, nur Sammeln + einfache Liste – noch ohne visuelles Gitter-Interface.

**Fertig, wenn:** Gegner droppen Loot, das aufgesammelt und in einer einfachen Liste mitgeführt wird.

### Phase 11 – Rucksack-UI (Gitter-Inventar)

Das aufwendigste UI-Stück im ganzen Umbau. Gitterbasierter Rucksack mit Drag & Drop, Item-Rotation, unterschiedlichen Item-Formen, Platzvalidierung. Auf Touch/Handy eine eigene Herausforderung. Pre-Run-Loadout-Bildschirm zum Zusammenstellen aus dem Lager.

**Fertig, wenn:** Man kann vor dem Run einen Rucksack aus dem Lager befüllen (mit Rotation/Platzproblemen) und während des Runs neues Loot ins Gitter aufnehmen, wenn Platz da ist.

### Phase 12 – Waffen-als-Loot

Gefundene Waffen ersetzen tatsächlich die aktive Basis-Waffe. Datenmodell für unterschiedliche Waffentypen (Schaden, Reichweite, Feuerrate), Integration ins bestehende Combat-System.

**Fertig, wenn:** Eine im Run gefundene Waffe lässt sich ausrüsten und verändert spürbar, wie man kämpft. **Ab hier ist das Loot-Roguelike vollständig spielbar** (noch ohne dauerhaftes Lager) – zeig es jemandem.

### Phase 13 – Dauerhaftes Lager & Meta-Fortschritt

LocalStorage/IndexedDB-Speicherung des Lagers zwischen Runs. Starter-Set-Logik (fix, unverlierbar). Erfolgreicher Run speist das Lager, Team-Wipe verwirft nur den Rucksack-Inhalt des laufenden Runs.

**Fertig, wenn:** Nach einem erfolgreichen Run steht das gesammelte Loot beim nächsten Loadout-Bildschirm zur Verfügung; nach einem Team-Wipe ist es weg, aber das Starter-Set bleibt nutzbar.

### Phase 14 – Charakter-Rework

Tank: Schildwand entfernen, neue Heilfähigkeit mit grossem Team-Radius einbauen. Sniper: neue Super-Fähigkeit "Aufklärungsschuss" statt bisherigem Zielscheinwerfer. Alle Charaktere: Auto-Aim-Reichweite/Zielkegel verkleinern, danach ausgiebig testen.

**Fertig, wenn:** Alle drei Charaktere fühlen sich mit den neuen Fähigkeiten stimmig an, Auto-Aim ist spürbar schwerer als vorher.

### Phase 15 – Run pausieren & fortsetzen

Serialisierung des kompletten Weltzustands (Spielerpositionen, verbleibende Gegner, Loot auf dem Boden, aktueller Fortschritt). Technisch die komplexeste Phase neben dem Koop selbst – braucht eigene Recherche, besonders die Frage, wie das im Koop funktioniert.

**Fertig, wenn:** Ein pausierter Solo-Run lässt sich später fortsetzen. Koop-Fortsetzen ist ein Stretch-Goal dieser Phase, kein Muss.

### Phase 16 – Koop-Feinschliff mit neuem System

Sicherstellen, dass Weltgenerierung zwischen Host und Clients exakt synchron ist (Seed-Übertragung testen). Loot-Sync zwischen Spielern. Individuelle Rucksäcke pro Spieler korrekt über das bestehende Protokoll synchronisiert.

**Fertig, wenn:** Zwei Spieler sehen exakt dieselbe generierte Welt und können unabhängig voneinander Loot sammeln, ohne dass sich die Inventare durcheinanderbringen.

### Phase 17 – Politur

Balancing nach echten Testrunden (Schwierigkeitsformel, Loot-Drop-Raten), Menüfeinschliff (Loadout-Screen, Lager-Ansicht), Sound, PWA-Feinheiten, Leistungsoptimierung.

**Fertig, wenn:** Du es Freunden schicken kannst, ohne etwas erklären zu müssen.

### Realistische Einschätzung

Dieser Umbau ist deutlich grösser als das ursprüngliche V1 – im Kern ein zweites, komplexeres Projekt oben auf dem bestehenden Fundament. Phase 8–10 (Welt, Encounter, einfaches Loot) sind mit Claude Code gut zu schaffen und bauen direkt auf dem vorhandenen Combat-/Netzwerk-Code auf. Phase 11 (Gitter-Inventar-UI) ist eigenständig aufwendig, aber unabhängig vom Rest testbar. Phase 15 (Run speichern, besonders im Koop) ist objektiv die unsicherste Phase im ganzen Plan – dort realistisch mit Verzögerungen rechnen, im Zweifel zuerst nur Solo-Speichern umsetzen. Nach Phase 12 hast du bereits ein vollständig spielbares Loot-Roguelike ohne Meta-Lager.

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
4. **`CLAUDE.md` aktuell halten.** Darin: aktuelle Phase, Architekturentscheide, bekannte Fehler, was absichtlich weggelassen wurde. Claude Code liest sie bei jedem Start – das ist dein Gedächtnis zwischen den Sitzungen.

### Typischer Sitzungsablauf

> Wir sind bei Phase 3. Lies CLAUDE.md für den Stand. Heute: Munitionssystem mit drei Ladungen und parallelem Nachladen, plus die Gegner-Projektile. Werte aus `src/config/balance.ts` verwenden. Zeig mir den Plan, bevor du Code schreibst.

Und am Ende der Sitzung:

> Aktualisiere CLAUDE.md mit dem, was wir heute gemacht haben und was als Nächstes ansteht.

### Wenn etwas nicht funktioniert

Beschreibe das **Verhalten**, nicht deine Vermutung über die Ursache: "Die Figur bleibt an der linken Wand hängen und zittert" ist zehnmal nützlicher als "die Kollision ist kaputt". Bei Spielcode ist das besonders wichtig, weil Fehler sich selten als Fehlermeldung zeigen, sondern als komisches Verhalten.

Bei Leistungsproblemen: Zahlen liefern. Bildrate, Anzahl Gegner, welches Handy.

### Was du selbst entscheiden solltest

Balancing und Game Feel. Claude Code kann dir jede Zahl ins System schreiben, aber ob sich das Spiel gut anfühlt, merkst nur du beim Spielen. Die Werte in `balance.ts` sind Vorschläge – dass du sie änderst, ist der Sinn der Sache, nicht ein Zeichen, dass etwas falsch war.
