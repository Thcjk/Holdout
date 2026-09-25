/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VitePWA } from "vite-plugin-pwa";

// Auf GitHub Pages liegt das Spiel unter /<reponame>/ - ohne passenden base-Pfad
// findet der Browser die Dateien nicht. Lokal bleibt es "/".
const base = process.env.VITE_BASE_PATH ?? "/";

// Die Versionsnummer wandert ins Spiel: Sie steht im Menue und auf dem
// Fehlerbildschirm. Nur so laesst sich aus der Ferne sagen, welcher Stand
// auf einem Geraet tatsaechlich laeuft - gerade wenn ein Service Worker
// noch eine aeltere Fassung ausliefert.
const version = JSON.parse(readFileSync("./package.json", "utf-8")).version;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    VitePWA({
      // Eine neue Version wird im Hintergrund geladen und beim naechsten Start aktiv.
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "Holdout",
        short_name: "Holdout",
        description: "Holdout: Haltet gemeinsam gegen immer stärkere Wellen durch.",
        lang: "de",
        start_url: base,
        scope: base,
        display: "standalone",
        // Feste Kennung, damit eine neue Version als dieselbe App erkannt wird.
        id: "koop-arena-shooter",
        categories: ["games"],
        orientation: "landscape",
        background_color: "#11161f",
        theme_color: "#11161f",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Ohne diese Zeile zeigt ein Start ohne Internet eine Fehlerseite statt
        // des Spiels: Der Service Worker weiss sonst nicht, was er bei einem
        // Seitenaufruf ausliefern soll.
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        // Phaser ist gross - die Voreinstellung von 2 MB wuerde es vom
        // Offline-Zwischenspeicher ausschliessen.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,ogg,m4a,json,glb,xml}"],
        /*
         * Das hochgeladene Kenney-Paket liegt komplett unter `public/` -
         * Vorschaubilder, 51 SVG-Haeute, UI-Paket, Sci-Fi-RTS-Grafiken. Das
         * Spiel benutzt davon (noch) nichts direkt: Die Haeute sind als kleine
         * PNGs unter `models/skins/` umgewandelt. Ohne diese Liste luede jedes
         * Handy bei der Installation 6,9 MB statt rund 2, fuer nichts.
         * Wer spaeter etwas davon im Spiel benutzt, nimmt es hier heraus.
         *
         * Seit dem UI-Paket gebraucht und deshalb NICHT mehr auf der Liste:
         * `Spritesheet/` (ein Bild plus Koordinatendatei, `config/ui.ts`). Die
         * Einzelbilder derselben Grafiken unter `PNG/` bleiben draussen.
         */
        globIgnores: [
          "Skins/**",
          "PNG/**",
          "Vector/**",
          "Source/**",
          "Animals/**",
          "Textures/**",
          "assets/Unit/**",
          "assets/Structure/**",
          "assets/Environment/**",
          "assets/Tile/**",
          "assets/scifi*",
          // Vorschaubilder und Einzel-SVGs direkt in public/ (Blaster Kit,
          // Tiere). favicon.svg kommt trotzdem mit - ueber `includeAssets`.
          "*.png",
          "*.svg",
        ],
        /*
         * ================================================================
         * DER FEHLER, DER DIE MUSIK ZWEIMAL "NICHT GETAUSCHT" AUSSEHEN LIESS
         * ================================================================
         *
         * Workbox merkt sich zu jeder Datei eine Kennung ("revision"), an der
         * es erkennt, ob sie sich geaendert hat. Steht dort `null`, heisst das:
         * "Der DATEINAME enthaelt schon eine Version, diese Datei aendert sich
         * nie." Solche Dateien werden nach der ersten Installation NIE WIEDER
         * geladen.
         *
         * Fuer `assets/index-Cx-XINIv.js` stimmt das - der Name enthaelt einen
         * Hash und wechselt bei jeder Aenderung. Fuer `assets/audio/menu.ogg`
         * stimmt es NICHT: Der Name bleibt immer gleich.
         *
         * Die Voreinstellung von vite-plugin-pwa nimmt aber pauschal ALLES
         * unter `assets/` als unveraenderlich an - und dort landet auch alles
         * aus `public/assets/`: Musik, Tilesheet, Vorschaubilder. Folge: Der
         * Tausch der beiden Musikstuecke wurde zwar ausgeliefert, aber auf
         * einem Geraet mit installierter App nie abgeholt. Die Versionsnummer
         * sprang auf 1.16.0 (der Bundle-Name hat ja einen Hash), die Musik
         * blieb die alte. Nachgestellt und gemessen:
         *
         *   1) alter Stand installiert   menu.ogg = 52630 Bytes
         *      Deploy: auf dem Server liegt menu.ogg mit 364365 Bytes
         *   3) nach dem Update  Bundle = index-oufIWByq.js  (neu!)
         *      ausgeliefert     menu.ogg = 52630 Bytes      (alt!)
         *
         * Deshalb gilt "unveraenderlich" jetzt nur noch fuer Dateien, deren
         * Name wirklich einen Hash traegt. Alles andere bekommt eine echte
         * Kennung und wird bei Aenderung neu geladen.
         */
        dontCacheBustURLsMatching: /assets\/[^/]+-[\w-]{8,}\.(?:js|css)$/,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
  },
  server: {
    port: 5173,
    open: false,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
