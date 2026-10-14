# Holdout – Die Wanderfestung

Eure Basis läuft: Eine Mech-Crew flieht auf einer sechsbeinigen Festung durch die
Wüste, die goldene Armee dicht dahinter. Ihr kämpft auf dem Deck oder springt ab,
um Schrott zu holen – aber die Festung wartet nicht. Fürs Handy, Pixel-Art.

> **Das Spiel läuft nur auf Handys und Tablets** (Querformat). Am Desktop zeigt es
> einen QR-Code. Zum Entwickeln gibt es `?desktop` (siehe unten).

## Stand

Das Spiel wird in sechs Baustufen neu gebaut (der frühere Brotato-artige
Wellen-Shooter liegt auf dem Zweig `alt-3.9.2`).

| Baustufe | Inhalt                                                                                                                                              | Stand  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1        | Laufende Festung, Deck und Boden, Strickleiter, Seilwinde, Sandläufer, Schrott, Rast                                                                | fertig |
| 2        | Module aufs Deck bauen, aufrüsten, Nachbar-Boni, zufälliges Angebot; Angriffe von allen Seiten                                                      | fertig |
| 3        | Gegner mit Aufgaben (Enterer, Phalanx, Skarabäus, Sandpriester, Streitwagen, Ballista, Belagerungsturm, Goldener Koloss); Module können kaputtgehen | fertig |
| 4        | Routenkarte mit Abzweigungen (Ruine, Oase, Händler, Schrottfeld, Sturm, Ereignis, Endgegner), Vorsprung vor der Armee, Heerschar, Akt 1 komplett    | fertig |
| 5        | Crew (6 Mechs), Teile, Werft, Altgold, Erfolge                                                                                                      | offen  |
| 6        | Koop, Akte 2 und 3, Ton, Feinschliff                                                                                                                | offen  |

## Installieren

- **Android und iPhone, ohne Store:** https://thcjk.github.io/Holdout/ auf dem Handy
  öffnen, dann „App installieren“ (Android) bzw. „Teilen → Zum Home-Bildschirm“ (iPhone).
- **Android-APK:** unter [Releases](https://github.com/Thcjk/Holdout/releases) (Workflow „Android APK“).

## Entwickeln

```bash
npm install
npm run dev
```

Nützliche Adress-Zusätze:

| Zusatz         | Wirkung                                                   |
| -------------- | --------------------------------------------------------- |
| `?desktop`     | Spiel auch am Desktop starten (Maus ersetzt den Daumen)   |
| `?debug=kurz`  | Märsche nur ein Zehntel so lang (Stationen schnell sehen) |
| `?debug=reich` | 999 Schrott zum Start (alle Module ausprobieren)          |
| `?debug=werte` | Bildrate und Gegnerzahl einblenden                        |
| `?seed=123`    | Feste Zufallszahl                                         |

## Befehle

| Befehl                               | Zweck                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `npm run dev`                        | Entwicklungsserver                                                                        |
| `npm run test`                       | Tests: Spielkern, Verbindungsweg                                                          |
| `npm run balance -- 10 klug`         | Bot spielt den Probelauf und baut aus (`klug` springt ab und sammelt, `deck` bleibt oben) |
| `npx tsx tools/analyse.ts 4 klug`    | Welche Gegnerart wie viel Rumpf kostet                                                    |
| `npm run typecheck` / `npm run lint` | Prüfen                                                                                    |
| `npm run build`                      | Produktionsbuild nach `dist/`                                                             |

## Aufbau

```
src/
  game/       Spielkern ohne Phaser und ohne Netz: Simulation (Dirigent), systems/ (Mechs,
              Module, Gegner, Kampf), Festung, Daten
  net/        Sitzungen (solo) und die Verbindungsschicht für den späteren Koop
  scenes/     Boot, Titel, Spiel, Bau-Ansicht, Routenkarte, Ergebnis
  ui/         HUD, Knöpfe, Stick, Rast-Tafel; pixel/ malt alle Bilder per Code; world/ zeichnet Boden, Festung, Module, Gegner, Warnungen
  platform/   Geräte-Erkennung, Sicherheitsränder, Updates
tests/        Spielkern ohne Browser, Bot für die Balance
tools/        Balance-Messung, App-Icons und Splash
android/      Capacitor-Projekt
docs/archiv/  Alte Dokumente
```

Die Simulation (`src/game/`) läuft mit festem 60-Hz-Takt und weiß nichts von
Phaser oder dem Netz. Mehr dazu in `CLAUDE.md`.

## Deployment

Push auf `main` veröffentlicht die Website über `.github/workflows/deploy-pages.yml`
(Basispfad wird aus dem Repo-Namen abgeleitet). Ein Tag `v*` baut die Android-APK.
Einmalig nötig: **Settings → Pages → Source: GitHub Actions**.

Grafik: alles per Code gemalte Pixel-Art (`src/ui/pixel/`). Schriften: Jersey 10 und Pixelify Sans (OFL).
