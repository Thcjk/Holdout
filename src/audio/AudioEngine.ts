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
  | "waveStart"
  | "gameOver";

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
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
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.context.currentTime, 0.02);
    }
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
      case "waveStart":
        this.tone(440, 0.12, "square", 0.13);
        this.tone(554, 0.12, "square", 0.13, 554, 0.1);
        this.tone(659, 0.2, "square", 0.13, 659, 0.2);
        break;
      case "gameOver":
        this.tone(440, 0.3, "triangle", 0.2, 220);
        this.tone(330, 0.5, "triangle", 0.18, 150, 0.22);
        break;
    }
  }

  /**
   * Ein ruhiger Musikteppich: alle vier Sekunden ein weicher Akkord, dazu ein
   * Basston. Bewusst schlicht - Musik soll hier tragen, nicht ablenken.
   */
  startMusic(): void {
    if (!this.context || this.musicTimer !== null) {
      return;
    }

    const play = (): void => this.musicChord();
    play();
    this.musicTimer = window.setInterval(play, 4000);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
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
