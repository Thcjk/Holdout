/**
 * Ton - komplett im Browser erzeugt, ohne eine einzige Audiodatei.
 *
 * ABWEICHUNG VOM BRIEFING: Dort sind fertige Klaenge von Kenney und freesound
 * vorgesehen (.ogg mit .m4a als Rueckfall). Die liessen sich in dieser Umgebung
 * nicht herunterladen. Statt stummer Platzhalter werden die Klaenge hier mit der
 * Web-Audio-API synthetisiert: kurze Toene, Rauschen und Huellkurven. Das klingt
 * schlichter als echte Effekte, hat aber zwei Vorteile - null Ladezeit und keine
 * Lizenzfragen. Auf echte Dateien zu wechseln heisst, `play()` umzubauen.
 *
 * Wichtig fuers Handy (Briefing, Abschnitt 7): Ein Browser startet Ton erst nach
 * einer Nutzerinteraktion. Deshalb `unlock()` beim ersten Tippen - sonst bleibt
 * es auf iOS stumm.
 */

const MUTE_STORAGE_KEY = "arena-shooter.muted";

import { MUSIC_MENU, MUSIC_WAVE } from "../config/assets";

/**
 * Grundlautstaerke der Musik. `setMusic` multipliziert sie mit einem Faktor -
 * so bleibt "wie laut ist Musik ueberhaupt" an einer Stelle einstellbar.
 */
const MUSIC_BASE_VOLUME = 0.5;

/** Die beiden Musikstuecke. */
export type MusicTrack = "menu" | "wave";

export type SoundName =
  | "shoot"
  | "enemyShoot"
  | "hit"
  | "enemyDied"
  | "playerHit"
  | "playerDown"
  | "revive"
  | "superReady"
  | "superUsed"
  | "blast"
  | "healed"
  | "zoneReached"
  | "gameOver";

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  /** Die geladenen Musikstuecke. Leer, wenn der Browser kein Ogg kann. */
  private readonly tracks = new Map<MusicTrack, HTMLAudioElement>();
  /** Was gerade laufen soll - unabhaengig davon, ob es auch laeuft. */
  private currentTrack: MusicTrack | null = null;
  /** Wie laut, 0 bis 1. Zwischen den Wellen laeuft dasselbe Stueck leiser. */
  private currentVolume = 1;
  /** Zeitgeber des Ersatzklangs, falls kein Ogg moeglich ist. */
  private fallbackTimer: number | null = null;
  private muted = false;
  /** Rauschpuffer wird einmal erzeugt und immer wieder verwendet. */
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    this.muted = readMuted();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Muss aus einer echten Nutzerinteraktion heraus aufgerufen werden
   * (Tippen, Klick, Taste). Mehrfach aufzurufen ist harmlos.
   */
  unlock(): void {
    if (!this.context) {
      const Constructor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) {
        return;
      }
      this.context = new Constructor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.context.destination);

      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
    }

    void this.context.resume();

    /*
     * Erst jetzt die Musikdateien anlegen, nicht schon beim Laden der Seite:
     * `new Audio(...)` faengt sofort an zu laden, und vor der ersten Beruehrung
     * darf ohnehin nichts klingen. Ausserdem steht hier fest, dass der Nutzer
     * getippt hat - genau der Moment, in dem `play()` erlaubt ist.
     */
    this.prepareMusic();
    this.applyMusic();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.context.currentTime, 0.02);
    }
    // Die Musikstuecke haengen nicht am Web-Audio-Regler, sondern sind eigene
    // Elemente - sie muessen getrennt angehalten werden, sonst spielt die Musik
    // stumm geschaltet weiter.
    this.applyMusic();

    try {
      localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
    } catch {
      // Kein Speicher - die Einstellung gilt dann nur fuer diese Sitzung.
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  play(name: SoundName): void {
    if (!this.context || !this.master || this.muted) {
      return;
    }

    switch (name) {
      case "shoot":
        this.tone(760, 0.07, "square", 0.16, 240);
        this.noise(0.05, 0.05, 2600);
        break;
      case "enemyShoot":
        this.tone(300, 0.1, "sawtooth", 0.1, 150);
        break;
      case "hit":
        this.noise(0.045, 0.07, 3600);
        break;
      case "enemyDied":
        this.noise(0.22, 0.16, 1200);
        this.tone(180, 0.2, "triangle", 0.12, 70);
        break;
      case "playerHit":
        this.tone(140, 0.22, "sawtooth", 0.2, 60);
        break;
      case "playerDown":
        this.tone(200, 0.6, "triangle", 0.22, 50);
        break;
      case "revive":
        this.tone(420, 0.16, "triangle", 0.16, 640);
        this.tone(640, 0.22, "sine", 0.12, 860, 0.12);
        break;
      case "superReady":
        this.tone(660, 0.12, "sine", 0.16);
        this.tone(990, 0.2, "sine", 0.14, 990, 0.1);
        break;
      case "superUsed":
        this.tone(220, 0.35, "sawtooth", 0.2, 900);
        this.noise(0.25, 0.12, 1800);
        break;
      case "blast":
        // Tiefer Knall plus kurzes Rauschen - der Unterschied zum Schuss ist
        // die Tiefe, sonst ginge er im Dauerfeuer unter.
        this.tone(120, 0.3, "sawtooth", 0.22, 50);
        this.noise(0.2, 0.18, 900);
        break;
      case "healed":
        // Zwei steigende Toene: aufwaerts heisst "es wird besser".
        this.tone(520, 0.14, "sine", 0.16, 700);
        this.tone(780, 0.22, "sine", 0.12, 980, 0.1);
        break;
      case "zoneReached":
        /*
         * Eine neue Distanzzone ist zweierlei auf einmal, und der Klang muss
         * beides sagen: Man hat etwas geschafft (es gibt einen Skillpunkt),
         * und es wird ab hier gefaehrlicher.
         *
         * Deshalb erst hinauf (440-554-659, das alte Wellensignal - "Schwelle
         * ueberschritten"), dann ein tiefer Nachschlag, der offen stehen
         * bleibt. Ein reiner Dur-Dreiklang nach oben klaenge nach "geschafft,
         * durchatmen" - und genau das stimmt hier nicht, denn vor einem liegt
         * das schwerere Gebiet, nicht hinter einem.
         */
        this.tone(440, 0.12, "square", 0.13);
        this.tone(554, 0.12, "square", 0.13, 554, 0.1);
        this.tone(659, 0.18, "square", 0.13, 659, 0.2);
        this.tone(330, 0.34, "triangle", 0.12, 294, 0.3);
        break;
      case "gameOver":
        this.tone(440, 0.3, "triangle", 0.2, 220);
        this.tone(330, 0.5, "triangle", 0.18, 150, 0.22);
        break;
    }
  }

  /**
   * ================================================================
   * MUSIK
   * ================================================================
   *
   * Welches Stueck gerade laufen soll - oder `null` fuer Stille - und wie laut.
   *
   * DER WECHSEL IST DAS SIGNAL, NICHT DIE STILLE. Zwischen zwei Wellen laeuft
   * leise das ruhige Stueck; setzt das treibende in voller Lautstaerke ein,
   * beginnt die naechste Welle. Das hoert man auch dann, wenn man gerade nicht
   * hinschaut - man braucht keine Anzeige zu lesen.
   *
   * (Hier war zuerst wirklich Stille vorgesehen. Der Nutzer wollte stattdessen
   * leise Musik - deshalb der zweite Parameter.)
   *
   * Nur EINE Stelle steuert das (`setMusic`), statt frueher zwei (`startMusic`
   * und `stopMusic`). Mit zwei Schaltern und drei Szenen, die sie rufen, waere
   * schwer zu sagen, was gerade laufen sollte. Der Vergleich oben prueft
   * deshalb BEIDES: Dasselbe Stueck in anderer Lautstaerke ist eine Aenderung.
   */
  setMusic(track: MusicTrack | null, volume = 1): void {
    if (this.currentTrack === track && this.currentVolume === volume) {
      return;
    }
    this.currentTrack = track;
    this.currentVolume = volume;
    this.applyMusic();
  }

  /**
   * Spielt das gewuenschte Stueck und haelt alle anderen an.
   *
   * Wird auch beim Stummschalten und beim Freigeben des Tons gerufen - deshalb
   * steht die ganze Entscheidung an einer Stelle, statt an jeder Aufrufstelle
   * wiederholt zu werden.
   */
  private applyMusic(): void {
    const soll = this.muted ? null : this.currentTrack;

    for (const [name, element] of this.tracks) {
      if (name === soll) {
        continue;
      }
      element.pause();
      // Auf Anfang zuruecksetzen: Eine Welle soll mit ihrem Anfang beginnen,
      // nicht dort weitermachen, wo die vorige aufgehoert hat.
      element.currentTime = 0;
    }

    // Kein Stueck gewuenscht, oder die Dateien lassen sich nicht abspielen:
    // dann bleibt es still bzw. der Ersatzklang uebernimmt.
    if (soll === null) {
      this.stopFallbackMusic();
      return;
    }

    const element = this.tracks.get(soll);
    if (!element) {
      this.startFallbackMusic();
      return;
    }

    this.stopFallbackMusic();

    /*
     * Lautstaerke JEDES MAL neu setzen, nicht nur beim Anlegen.
     *
     * Zwischen den Wellen laeuft dasselbe Stueck wie im Menue, nur leiser -
     * ohne diese Zeile bliebe es auf der Lautstaerke stehen, mit der es zuletzt
     * lief, und der Unterschied zwischen "Gefecht" und "Verschnaufen" waere weg.
     */
    element.volume = MUSIC_BASE_VOLUME * this.currentVolume;

    /*
     * `play()` gibt ein Promise zurueck, das fehlschlagen DARF: Browser
     * verweigern Ton, bevor der Nutzer etwas angetippt hat. Das ist kein
     * Fehler, den man melden muesste - beim naechsten Antippen ruft `unlock()`
     * dieselbe Stelle noch einmal.
     */
    void element.play().catch(() => {
      /* noch nicht freigegeben - beim naechsten Antippen erneut */
    });
  }

  /**
   * Laedt die Musikdateien - wenn der Browser sie abspielen kann.
   *
   * WARUM DIE PRUEFUNG: Die Dateien sind Ogg Vorbis. Android kann das seit
   * jeher, Safari auf dem iPhone erst ab Version 17.4 (Maerz 2024). Auf einem
   * aelteren iPhone bliebe es sonst einfach stumm, ohne dass man den Grund
   * saehe. Kann der Browser kein Ogg, uebernimmt der bisherige synthetisierte
   * Klang - weniger schoen, aber besser als Stille.
   */
  private prepareMusic(): void {
    if (this.tracks.size > 0 || !this.canPlayOgg()) {
      return;
    }

    for (const [name, url] of [
      ["menu", MUSIC_MENU],
      ["wave", MUSIC_WAVE],
    ] as [MusicTrack, string][]) {
      const element = new Audio(url);
      element.loop = true;
      element.preload = "auto";
      element.volume = MUSIC_BASE_VOLUME;
      this.tracks.set(name, element);
    }
  }

  private canPlayOgg(): boolean {
    if (typeof Audio === "undefined") {
      return false;
    }
    // "" heisst "kann ich nicht", "maybe"/"probably" heissen "kann ich".
    return new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== "";
  }

  /** Ersatz, wenn der Browser kein Ogg kann: der bisherige Akkordteppich. */
  private startFallbackMusic(): void {
    if (!this.context || this.fallbackTimer !== null) {
      return;
    }
    const play = (): void => this.musicChord();
    play();
    this.fallbackTimer = window.setInterval(play, 4000);
  }

  private stopFallbackMusic(): void {
    if (this.fallbackTimer !== null) {
      window.clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private musicChord(): void {
    if (!this.context || !this.musicGain || this.muted) {
      return;
    }

    // A-Moll-Feld, tief und offen. Zwei Akkorde im Wechsel.
    const bank = [
      [110, 164.81, 220],
      [98, 146.83, 196],
    ];
    const chord = bank[Math.floor(this.context.currentTime / 8) % bank.length] ?? bank[0];
    if (!chord) {
      return;
    }

    for (const frequency of chord) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      const now = this.context.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.25, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.9);

      oscillator.connect(gain);
      gain.connect(this.musicGain);
      oscillator.start(now);
      oscillator.stop(now + 4);
    }
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
    sweepTo?: number,
    delay = 0,
  ): void {
    if (!this.context || !this.master) {
      return;
    }

    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (sweepTo !== undefined && sweepTo !== frequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), start + duration);
    }

    // Huellkurve: sofort laut, dann ausklingen. Ohne sie knackst jeder Ton.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(duration: number, gainValue: number, filterFrequency: number): void {
    if (!this.context || !this.master) {
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = this.getNoiseBuffer();

    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFrequency;

    const gain = this.context.createGain();
    const start = this.context.currentTime;
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration);
  }

  private getNoiseBuffer(): AudioBuffer | null {
    if (!this.context) {
      return null;
    }
    if (this.noiseBuffer) {
      return this.noiseBuffer;
    }

    const length = Math.floor(this.context.sampleRate * 0.5);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Eine Instanz fuer das ganze Spiel, damit Musik ueber Szenenwechsel weiterlaeuft. */
export const audio = new AudioEngine();
