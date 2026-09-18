/**
 * ALLE Spielwerte an einem Ort.
 *
 * Diese Zahlen sind Startwerte aus dem Briefing, keine Wahrheiten. Sie zu aendern
 * ist der Sinn dieser Datei: Balancing merkt man nur beim Spielen. Kein anderes
 * Modul darf Spielwerte fest verdrahten - sonst sucht man sie spaeter an zwanzig Stellen.
 */

import type { CharacterId, SkillId } from "../systems/types";

export const PLAYER = {
  /** Grundtempo in Pixel pro Sekunde (je Charakter ueberschrieben). */
  speed: 220,
  /**
   * Zeit in Sekunden bis Vollgeschwindigkeit - 0,10 -> 0,06.
   *
   * Das ist der groesste Einzelposten an der gefuehlten Verzoegerung. Die Kette
   * vom Finger bis zur Figur ist: Beruehrung -> noch im selben Bild in eine
   * Richtung umgerechnet -> bis zu ein Simulationsschritt Wartezeit (0 bis
   * 33 ms) -> Beschleunigung auf Vollgeschwindigkeit. Der letzte Posten war mit
   * 100 ms laenger als die beiden davor zusammen.
   *
   * Nicht auf 0: Ohne jede Beschleunigung springt die Figur zwischen Stillstand
   * und Vollgas, und Richtungswechsel wirken wie ein Ruck.
   */
  accelerationTime: 0.06,
  /** Kollisionsradius in Pixeln. */
  radius: 18,
  /** Unverwundbarkeit nach einem Treffer, in Sekunden (mit Aufblinken). */
  invulnerabilityTime: 0.3,
  /** Dauer einer Wiederbelebung in Sekunden, in Reichweite bleiben. */
  reviveTime: 3.0,
  /** Hoechstabstand zum Wiederbeleben, in Pixeln. */
  reviveRange: 90,
  /** Munitionsladungen, die einzeln und parallel nachladen. */
  ammoCharges: 3,
  /**
   * Aufladung der Super-Faehigkeit je 1000 Punkten Schaden, in Prozent.
   *
   * Frueher war es je TREFFER, und das war ungerecht: Der Scout feuert drei
   * Kugeln je Schuss, der Sniper eine. Der Scout lud damit dreimal so schnell
   * wie der Sniper, obwohl er pro Schuss weniger Schaden macht (660 gegen 900).
   * Gemessen hiess das: Scout-Super etwa alle 0,9 Sekunden, Sniper-Super alle
   * 4,4 Sekunden. Beim Scout war der Super damit kein Hoehepunkt mehr, sondern
   * ein Dauerzustand - und jede Aenderung an seiner Staerke schlug sofort voll
   * durch (0,12 s Unverwundbarkeit: 5 Wellen, 0,35 s: 12,8 Wellen).
   *
   * Je Schaden ist neutral: Wer viel Schaden macht, laedt schnell - egal ob in
   * einer Kugel oder in fuenf. 26 Prozent je 1000 Schaden heisst rund vier
   * Sekunden Dauerfeuer bis zum Super, bei allen dreien.
   */
  superChargePerDamage: 26,
  /** Mindestabstand zwischen zwei Schuessen in Sekunden. */
  shootCooldown: 0.18,
  /** Anteil des Lebens, der in der Pause zwischen zwei Wellen zurueckkommt. */
  breakHealFraction: 0.6,
} as const;

/** Startwerte fuer Projektile. */
export const PROJECTILE = {
  speed: 600,
  radius: 7,
  /** Gegnerprojektile sind langsamer, damit man ihnen ausweichen kann. */
  enemySpeed: 380,
  enemyRadius: 9,
} as const;

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  role: string;
  health: number;
  speed: number;
  reloadTime: number;
  shot: {
    bullets: number;
    damage: number;
    range: number;
    /** Gesamter Fächerwinkel in Grad. */
    spread: number;
    piercing: boolean;
  };
  super: {
    name: string;
    description: string;
  };
}

/** Die drei Charaktere. Drei Archetypen, nicht drei Varianten derselben Figur. */
export const CHARACTERS: Record<CharacterId, CharacterDefinition> = {
  scout: {
    id: "scout",
    name: "Scout",
    role: "Beweglich, Dauerfeuer",
    health: 2400,
    speed: 250,
    reloadTime: 1.3,
    // Streuung 9 -> 6 Grad. Begruendung: Bei 9 Grad liegen die aeusseren beiden
    // Kugeln am Ende der Reichweite (450 px) rund 35 Pixel neben der Mitte -
    // der Trefferradius gegen einen Laeufer betraegt aber nur 23. Auf Distanz
    // traf also nur die mittlere Kugel, und der "Dauerfeuer"-Charakter hatte in
    // Wahrheit ein Drittel seines Schadens. Bei 6 Grad sind es 23 Pixel: alle
    // drei treffen noch, wenn man ordentlich zielt.
    shot: { bullets: 3, damage: 220, range: 450, spread: 6, piercing: false },
    super: { name: "Dash", description: "Kurzer Sprint, der Gegner auf dem Weg zurückstösst" },
  },
  tank: {
    id: "tank",
    name: "Tank",
    role: "Nahkampf, hält aus",
    health: 4200,
    speed: 190,
    reloadTime: 1.9,
    shot: { bullets: 5, damage: 320, range: 250, spread: 34, piercing: false },
    super: { name: "Bodenstampfer", description: "800 Flächenschaden im Radius 200, betäubt 1 s" },
  },
  sniper: {
    id: "sniper",
    name: "Sniper",
    role: "Reichweite, Präzision",
    health: 1800,
    speed: 220,
    reloadTime: 2.2,
    shot: { bullets: 1, damage: 900, range: 900, spread: 0, piercing: true },
    super: {
      name: "Zielscheinwerfer",
      description: "Markiert einen Gegner: doppelter Schaden für 5 s",
    },
  },
};

export const CHARACTER_ORDER: CharacterId[] = ["scout", "tank", "sniper"];

/**
 * Die zweite aktive Faehigkeit je Charakter.
 *
 * Unterschied zum Super: Der Super laedt sich ueber ausgeteilten Schaden auf
 * und ist der grosse Moment. Diese Faehigkeit hat eine feste Abklingzeit und
 * ist deshalb staendig verfuegbar - sie soll im Gefecht laufend eingesetzt
 * werden, nicht aufgespart.
 *
 * `aimStyle` bestimmt, was beim Halten des Knopfs angezeigt wird: eine Linie
 * fuer gerichtete Faehigkeiten, ein Kreis fuer Flaecheneffekte. WICHTIG: Die
 * Zahlen hier sind dieselben, mit denen die Simulation rechnet - die Anzeige
 * liest sie aus dieser Datei und zeigt deshalb genau die echte Reichweite.
 * Eine "optische" Reichweite, die von der echten abweicht, waere schlimmer als
 * gar keine Anzeige.
 */
export const ABILITIES = {
  scout: {
    /*
     * Frueher "Blendgranate": Sie blendete Gegner 1,5 s lang, die liefen dabei
     * aber unveraendert weiter und starben nicht. Gemessen half sie durchaus -
     * der erlittene Schaden halbierte sich (2400 -> 1200) -, nur SEHEN konnte
     * man davon nichts. Eine Wirkung, die man nicht sieht, ist im Gefecht
     * keine: Man haelt die Faehigkeit fuer kaputt und benutzt sie nicht mehr.
     * Jetzt macht derselbe Wurf Schaden, und Schaden sieht man sofort.
     */
    name: "Splittergranate",
    /** Kurzform fuer den Knopf - auf 40 Pixel Radius passt kein ganzes Wort. */
    short: "GRANATE",
    description: "Wurf: Flächenschaden im Umkreis",
    aimStyle: "circle",
    cooldown: 7,
    /** Wurfweite in Pixeln. Etwas kuerzer als die Schussreichweite (450). */
    range: 400,
    /** Fluggeschwindigkeit des Wurfgeschosses. */
    speed: 700,
    /** Explosionsradius - so weit reicht der Schaden. */
    blastRadius: 140,
    /**
     * Schaden an jedem Gegner im Radius.
     *
     * Zum Vergleich: Ein normaler Scout-Schuss macht 3 x 220 = 660, wenn alle
     * drei Kugeln sitzen. Die Granate liegt knapp darueber - ihr Wert liegt
     * aber darin, dass sie eine ganze Gruppe auf einmal trifft.
     */
    damage: 700,
  },
  tank: {
    /*
     * Frueher "Schildwand": eine Barriere, die gegnerische SCHUESSE blockte.
     * Zwei Gruende, warum sie nicht passte. Erstens kaempft der Tank auf 250
     * Pixel mitten im Getuemmel, und dort kommt der Schaden von Laeufern, die
     * einen beruehren - genau davor schuetzte die Wand nicht. Zweitens musste
     * man sie im Laufen vor sich hinstellen und dann dahinter bleiben; das ist
     * Stellungsspiel, und der Tank ist der Charakter, der genau das NICHT
     * noetig haben soll.
     *
     * Jetzt heilt er sich. Das passt zu seiner Rolle ("haelt aus"), ist die
     * einzige Heilung im Spiel ausser der Wiederbelebung - und es ist sofort zu
     * sehen: Der Lebensbalken springt hoch.
     *
     * Warum keine Schockwelle: Sein Super (Bodenstampfer) macht bereits
     * Flaechenschaden MIT Rueckstoss. Eine zweite Faehigkeit derselben Art
     * waere nur eine schwaechere Kopie davon.
     */
    name: "Zweite Luft",
    short: "HEILEN",
    description: "Heilt sofort einen Teil der Lebenspunkte",
    /** Wirkt auf einen selbst - es gibt nichts zu zielen. */
    aimStyle: "self",
    cooldown: 12,
    /**
     * Sofort geheilte Lebenspunkte.
     *
     * Der Tank hat 4200 Leben; 1000 sind knapp ein Viertel davon. Genug, dass
     * man es deutlich sieht und eine brenzlige Lage ueberlebt - zu wenig, um
     * sich damit aus jedem Fehler herauszuheilen.
     */
    heal: 1000,
  },
  sniper: {
    name: "Lähmschuss",
    short: "LÄHMEN",
    description: "Langsames Geschoss, wurzelt den Getroffenen fest",
    aimStyle: "line",
    cooldown: 9,
    /** Reichweite wie die eigene Waffe. */
    range: 900,
    /** Bewusst langsam - man muss vorhalten. */
    speed: 300,
    /** Weniger Schaden als ein normaler Schuss (900), dafuer der Wurzeleffekt. */
    damage: 200,
    /** So lange kann der Getroffene sich nicht bewegen. */
    rootDuration: 1.5,
  },
} as const;

/** Werte der drei Super-Faehigkeiten. */
export const SUPERS = {
  scout: {
    // Dauer 0,22 -> 0,30 s: Der Dash trug bisher rund 250 Pixel weit, weniger
    // als die Reichweite eines Schuetzen - als Fluchtmittel wirkungslos, und
    // Beweglichkeit ist die einzige Staerke des Scouts. Jetzt sind es rund 345.
    /** Dauer des Dashs in Sekunden. */
    duration: 0.3,
    /**
     * Tempo waehrend des Dashs in Pixel pro Sekunde.
     *
     * NICHT ueber 1200 erhoehen: Die Aussenmauer ist 40 Pixel dick, ein Tick
     * dauert 1/30 Sekunde. Ab 1200 Pixel/s springt der Spieler in einem Tick
     * weiter als die Mauer dick ist und wird nach draussen geschoben. Mehr
     * Reichweite gibt es ueber die Dauer, nicht ueber das Tempo. (Seit
     * `clampToArena` faengt eine Notbremse das ab - verlassen sollte man sich
     * darauf trotzdem nicht.)
     */
    speed: 1150,
    /** Rueckstoss auf Gegner, die der Dash streift. */
    knockback: 520,
    // Schaden 300 -> 500: Der Dash war der schwaechste der drei Supers (Tank
    // 800 Flaechenschaden, Sniper doppelter Schaden fuer 5 Sekunden). 500 auf
    // alles, was im Weg steht, ist im selben Bereich, ohne ihn zu ueberholen.
    damage: 500,
    /**
     * Unverwundbarkeit ab Beginn des Dashs, in Sekunden. NEU.
     *
     * Begruendung aus der Messung: Der Scout kassierte in Welle 5 mehr Schaden
     * als der Tank (2677 gegen 1342) - bei 57 Prozent von dessen Leben. Seine
     * Beweglichkeit zahlte sich nirgends aus, weil ein Ausweichen nichts
     * verhinderte, was schon unterwegs war. Der Dash ist die einzige Stelle,
     * an der "beweglich" ein Spielwert statt eines Rollentextes wird.
     *
     * Genau so lang wie der Dash (0,30 s) - keine Sekunde laenger. Das ist die
     * verstaendliche Regel: "Waehrend du dashst, kann dir nichts passieren."
     * Gemessen bringt das den Scout von 5,0 auf 10,8 Wellen und damit auf
     * Augenhoehe mit Tank (10,0) und Sniper (9,0). Mit 0,5 s waeren es 12,8 -
     * dann ist er der staerkste der drei.
     */
    invulnerableTime: 0.3,
  },
  tank: {
    radius: 200,
    damage: 800,
    stunDuration: 1.0,
    knockback: 420,
  },
  sniper: {
    /** Dauer der Markierung in Sekunden. */
    duration: 5.0,
    damageMultiplier: 2,
    /** Suchradius um die Zielrichtung. */
    searchRange: 900,
  },
} as const;

/** Die drei Gegnertypen. */
export const ENEMIES = {
  runner: {
    name: "Läufer",
    health: 600,
    speed: 180,
    contactDamage: 300,
    score: 10,
    radius: 16,
  },
  brute: {
    name: "Brocken",
    health: 2800,
    speed: 90,
    contactDamage: 800,
    score: 50,
    radius: 28,
  },
  shooter: {
    name: "Schütze",
    health: 900,
    speed: 140,
    contactDamage: 0,
    score: 25,
    radius: 18,
    shotDamage: 250,
    shotInterval: 2.0,
    /**
     * Wunschabstand zum Spieler.
     *
     * Bewusst kleiner als die Reichweite von Scout (450) und Sniper (900): Ein
     * Gegner, der zurueckweicht und dabei weiter schiesst, als man selbst
     * reicht, laesst sich nie stellen - die Welle endet dann nie, und das
     * Balancing-Protokoll in Phase 7 hat genau das gezeigt.
     */
    preferredRange: 340,
  },
} as const;

/** Wie oft ein Gegner durch Beruehrung Schaden macht (Sekunden). */
export const ENEMY_CONTACT_INTERVAL = 1.0;

/** Wellenformel aus dem Briefing, Abschnitt 4. */
export const WAVES = {
  preparationSeconds: 5,
  breakSeconds: 10,
  runnerBase: 3,
  runnerPerWave: 2,
  shooterFromWave: 3,
  bruteFromWave: 5,
  /** Gegnerleben steigt um 8 % pro Welle, Schaden um 4 %. */
  healthGrowth: 1.08,
  damageGrowth: 1.04,
  /** Gegnerzahl * (0.6 + 0.4 * Spielerzahl), damit vier Spieler nicht durchrauschen. */
  playerCountBase: 0.6,
  playerCountFactor: 0.4,
  /** Alle 5 Wellen ein Brocken mit fuenffachem Leben und doppelter Groesse. */
  bossEveryWaves: 5,
  bossHealthMultiplier: 5,
  bossScaleMultiplier: 2,
  /** Vorwarnzeit der Spawnmarkierung in Sekunden. */
  spawnWarningSeconds: 1,
  /** Abstand zwischen zwei Gegnern derselben Welle in Sekunden. */
  spawnIntervalSeconds: 0.6,
} as const;

export interface SkillDefinition {
  id: SkillId;
  name: string;
  /** Kurztext auf dem Knopf - was eine Stufe bringt. */
  effect: string;
  maxLevel: number;
  /** Zuwachs je Stufe als Anteil, 0.08 heisst plus 8 Prozent. */
  perLevel: number;
}

/**
 * Fähigkeiten, die sich zwischen den Wellen aufwerten lassen.
 *
 * Bewusst vier klare Werte statt eigener Zauber: Man sieht sofort, was eine
 * Stufe bringt, und jede Wahl ist ein echter Verzicht auf die anderen drei.
 * Fünf Stufen sind die Obergrenze - voll ausgebaut ist eine Fähigkeit dann
 * spürbar, aber nicht allmächtig.
 */
export const SKILLS: Record<SkillId, SkillDefinition> = {
  weapon: { id: "weapon", name: "Waffe", effect: "+10 % Schaden", maxLevel: 5, perLevel: 0.1 },
  armor: { id: "armor", name: "Panzerung", effect: "+12 % Leben", maxLevel: 5, perLevel: 0.12 },
  speed: { id: "speed", name: "Tempo", effect: "+5 % Laufweg", maxLevel: 5, perLevel: 0.05 },
  super: { id: "super", name: "Super", effect: "+25 % Aufladung", maxLevel: 5, perLevel: 0.25 },
};

export const SKILL_ORDER: SkillId[] = ["weapon", "armor", "speed", "super"];

/** Skillpunkte je geschaffter Welle. */
export const SKILL_POINTS_PER_WAVE = 1;

/** Harte Obergrenzen fuer die Handy-Leistung (Briefing, Abschnitt 7). */
export const LIMITS = {
  maxEnemies: 40,
  maxProjectiles: 60,
} as const;
