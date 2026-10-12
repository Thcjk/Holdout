# Holdout

Brotato-artiger Wellen-Shooter fürs Handy, solo oder im Online-Koop (1–4 Spieler).

Du steuerst nur die Bewegung – die Waffen schießen von selbst. Überlebe 20 Wellen,
sammle Material, kaufe zwischen den Wellen Waffen und Gegenstände, steige im Level
auf und baue dir einen Build. Sechs Charaktere brechen jeweils eine Regel.

> **Das Spiel läuft nur auf Handys und Tablets** (Querformat). Am Desktop zeigt es
> einen QR-Code. Zum Entwickeln gibt es `?desktop` (siehe unten).

## Installieren

- **Android und iPhone, ohne Store:** https://thcjk.github.io/Holdout/ auf dem Handy
  öffnen, dann „App installieren“ (Android) bzw. „Teilen → Zum Home-Bildschirm“ (iPhone).
- **Android-APK:** unter [Releases](https://github.com/Thcjk/Holdout/releases) die
  Datei `holdout.apk` laden (gebaut über den Workflow „Android APK“).

## Spielprinzip

| Teil | Inhalt |
| --- | --- |
| Gefecht | Arena 900 × 440, schwebender Daumenstick links, Waffen zielen und feuern automatisch |
| Wellen | 20 Wellen, jede mit Zeitlimit; Gegner erscheinen nach einem roten Kreuz am Boden |
| Material | Gegner lassen Material fallen, es wird eingesammelt und ist die Währung im Shop |
| Shop | Nach jeder Welle: vier Angebote (Waffen und Gegenstände), halten, neu würfeln, Waffen verkaufen oder verschmelzen, Werte ansehen |
| Level-Ups | Jedes Level bringt eine Auswahl aus vier Verbesserungen |
| Charaktere | Kartoffel, Raufbold, Jäger, Panzer, Glückspilz, Schatten – mit eigenen Regeln und Startwaffen |
| Koop | Host rechnet für alle, Raumcode über WebRTC (PeerJS); der Shop wartet, bis alle „Weiter“ gedrückt haben |

## Entwickeln

```bash
npm install
npm run dev
```

Nützliche Adress-Zusätze:

| Zusatz | Wirkung |
| --- | --- |
| `?desktop` | Spiel auch am Desktop starten (Maus ersetzt den Daumen) |
| `?debug=lokal` | Koop ohne Server zwischen zwei Tabs (Raum `LOCAL1`) |
| `?debug=werte` | Bildrate und Werte einblenden |
| `?debug=netz` | Protokoll des Verbindungsaufbaus |
| `?seed=123` | Feste Welt-Zufallszahl (nur solo) |

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver (auch im WLAN erreichbar) |
| `npm run test` | Tests: Simulation, Koop-Sitzungen, Verbindungsweg |
| `npm run balance` | Bot spielt alle Charaktere durch und gibt aus, wie weit sie kommen |
| `npm run typecheck` / `npm run lint` | Prüfen |
| `npm run build` | Produktionsbuild nach `dist/` |

## Aufbau

```
src/
  game/       Spielkern ohne Phaser und ohne Netz: Simulation, Daten, Shop
    data/     Waffen, Gegenstände, Charaktere, Gegner, Level-Ups, Werte
  net/        Koop: Transport (PeerJS/lokal), Lobby, Host- und Client-Sitzung
  scenes/     Boot, Titel, Charakterwahl, Lobby, Spiel, Ergebnis
  ui/         Stick, HUD, Shop, Knöpfe, Menü-Look
  platform/   Geräte-Erkennung, Sicherheitsränder, Updates
  config/     Bildschirm, Assets, UI-Grafiken
tests/        Simulation und Netz im Speicher, ohne Browser
tools/        Balance-Messung, App-Icons
android/      Capacitor-Projekt
docs/archiv/  Alte Dokumente des früheren Arena-Shooters
```

Die Simulation (`src/game/`) läuft mit festem 60-Hz-Takt und weiß nichts von
Phaser oder dem Netz. Solo rechnet sie lokal, im Koop auf dem Host (Zustand 15×/s
an die Clients, Eingaben 30×/s zurück). Mehr dazu in `CLAUDE.md`.

## Deployment

Push auf `main` veröffentlicht die Website über `.github/workflows/deploy-pages.yml`
(Basispfad wird aus dem Repo-Namen abgeleitet). Ein Tag `v*` baut die Android-APK.
Einmalig nötig: **Settings → Pages → Source: GitHub Actions**.

Grafik: Kenney „Topdown Shooter Pixel“, „UI Pack RPG“, „Blaster Kit“ (CC0).
