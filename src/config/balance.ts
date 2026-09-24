/**
 * ALLE Spielwerte an einem Ort.
 *
 * Diese Zahlen sind Startwerte aus dem Briefing, keine Wahrheiten. Sie zu aendern
 * ist der Sinn dieser Datei: Balancing merkt man nur beim Spielen. Kein anderes
 * Modul darf Spielwerte fest verdrahten - sonst sucht man sie spaeter an zwanzig Stellen.
 */

import type { CharacterId } from "../systems/types";

export const PLAYER = {
  /** Grundtempo in Pixel pro Sekunde (je Charakter ueberschrieben). */
  speed: 220,
  /**
   * Wie weit die automatische Zielsuche reicht, als Anteil der
   * Waffenreichweite.
   *
   * ETAPPE 10: 1,15 -> 0,69 (rund 40 % weniger, Vorgabe des
   * Arbeitsdokuments). Vorher suchte sie sogar ETWAS UEBER die eigene
   * Reichweite hinaus, damit ein Gegner am Rand nicht verloren ging. Folge:
   * Man traf ohne hinzusehen, was irgendwo im Bild war. Jetzt nimmt sie nur
   * noch Gegner im inneren Teil der Reichweite; alles dahinter bekommt einen
   * Schuss in Blickrichtung. Einen Kegel gibt es nicht - gesucht wird rundum,
   * das war schon vorher so.
   */
  autoAimRangeFactor: 0.69,
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
  /**
   * Anteil des Lebens, der je Sekunde in der sicheren Startzone zurueckkommt.
   *
   * NACHFOLGER DER PAUSENHEILUNG: Frueher heilte die Pause zwischen zwei Wellen
   * 60 % des Lebens. Ohne Wellen gibt es diese Pause nicht mehr - und ohne
   * Ersatz gaebe es im ganzen Run keine Heilung ausser der Tank-Faehigkeit.
   * Ein Run waere dann nach wenigen Minuten zwangslaeufig vorbei.
   *
   * Jetzt heilt der sichere Ring um den Startpunkt. Das kostet den Weg zurueck
   * und passt damit genau zur Entscheidung, um die sich der Run dreht: weiter
   * vorruecken oder erst einmal durchatmen. 0,1 heisst rund zehn Sekunden fuer
   * volles Leben.
   */
  safeZoneHealPerSecond: 0.1,
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
      name: "Aufklärungsschuss",
      description: "Deckt Gegner im Umkreis auf: +50 % Schaden fürs Team, 6 s",
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
     * GESCHICHTE: zuerst "Schildwand" (blockte Schuesse - passte nicht zu
     * jemandem, der mitten im Getuemmel steht), dann "Zweite Luft" (heilte
     * sofort 1000 nur den Tank selbst).
     *
     * SEIT ETAPPE 10: "Heilfeld", Werte aus dem Arbeitsdokument
     * (`tankHeal`). Ein Feld um den Tank heilt drei Sekunden lang ALLE
     * stehenden Mitspieler darin, auch ihn selbst. Das macht aus dem
     * Selbstversorger den, um den sich das Team sammelt - und loest nebenbei
     * den Widerspruch aus CLAUDE.md, dass der Tank zwei Heilungen fuer sich
     * allein hatte.
     *
     * Deutlich weniger Heilung fuer den Tank selbst als vorher: 80 x 3 = 240
     * statt 1000. Dafuer wirkt sie bei vier Spielern bis zu viermal.
     */
    name: "Heilfeld",
    short: "HEILFELD",
    description: "Heilt alle im Umkreis ueber drei Sekunden",
    /** Wirkt um einen selbst - es gibt nichts zu zielen. */
    aimStyle: "self",
    cooldown: 12,
    /** Radius des Felds um den Tank. Gezeichnet wird genau dieser Kreis. */
    radius: 220,
    /** Heilung je Sekunde fuer jeden Stehenden im Feld. */
    healPerSecond: 80,
    /** So lange haelt das Feld. */
    duration: 3,
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
    /*
     * SEIT ETAPPE 10: "Aufklaerungsschuss" statt "Zielscheinwerfer", Werte
     * aus dem Arbeitsdokument (`scoutRecon`).
     *
     * Vorher markierte der Super EINEN Gegner, der 5 s doppelten Schaden nahm.
     * Jetzt fliegt ein Geschoss, und wo es einschlaegt - Gegner, Wand oder
     * Ende der Reichweite -, werden ALLE Gegner im Umkreis aufgedeckt: Sie
     * leuchten, stehen auf der Karte und nehmen vom ganzen Team 50 % mehr
     * Schaden. Aus einem Einzelschuss wird eine Teamansage.
     *
     * NICHT UEBERNOMMEN: `cooldown: 14` aus dem Dokument. Ein Super laedt
     * sich in diesem Spiel ueber ausgeteilten Schaden auf, nicht ueber Zeit
     * (`PLAYER.superChargePerDamage`). Eine zusaetzliche Abklingzeit waere
     * eine zweite Regel fuer denselben Knopf - siehe CLAUDE.md, Etappe 10.
     */
    name: "Aufklärungsschuss",
    /** Fluggeschwindigkeit des Geschosses. */
    projectileSpeed: 700,
    /** So weit fliegt es hoechstens - die Reichweite der eigenen Waffe. */
    range: 900,
    /** Umkreis um den Einschlag, in dem aufgedeckt wird. */
    revealRadius: 500,
    /** So lange bleiben die Gegner aufgedeckt. */
    revealDuration: 6,
    /** Zusaetzlicher Schaden, den aufgedeckte Gegner vom ganzen Team nehmen. */
    teamDamageBonus: 0.5,
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

  /**
   * Der Boss - Mini-Boss und Ende-Boss in einem Typ.
   *
   * WARUM NUR EIN EINTRAG FUER BEIDE: `EnemyState` kennt schon ein Feld
   * `isBoss`, und `createEnemy` macht daraus seit jeher funffaches Leben,
   * funffache Punkte und doppelte Groesse. Diese Werte hier sind also der
   * MINI-Boss; derselbe Typ mit `isBoss: true` ist der Ende-Boss. Eine zweite
   * Skalierungslogik daneben waere nur eine Stelle mehr, an der zwei Zahlen
   * auseinanderlaufen koennen.
   *
   * Zum Einordnen: 9000 Leben sind gut dreimal der Brocken (2800). Ein Scout
   * macht rechnerisch rund 1500 Schaden je Sekunde, braucht also etwa sechs
   * Sekunden Dauerfeuer - beim Ende-Boss (45000) eine gute halbe Minute, in
   * der man ausweichen muss.
   */
  boss: {
    name: "Wächter",
    health: 9000,
    /** Langsamer als der Spieler: Weglaufen muss moeglich bleiben. */
    speed: 105,
    contactDamage: 600,
    score: 300,
    radius: 34,
  },
} as const;

/**
 * ================================================================
 * DIE ANGRIFFE DES BOSSES
 * ================================================================
 *
 * Zwei Muster, und sie ergaenzen sich absichtlich:
 *
 *   SCHOCKWELLE  Flaechenschaden rundherum, wenn jemand nah ist.
 *   SALVE        Faecher aus Geschossen, wenn alle weiter weg sind.
 *
 * Nur das eine oder das andere waere ein Boss mit einem toten Winkel: Mit
 * blosser Flaeche bliebe man einfach auf Abstand und er waere harmlos, mit
 * blosser Salve kaeme der Tank (250 px Reichweite) nie heran. Zusammen gibt es
 * keine Ecke, in der man sicher steht.
 *
 * DER VORWARNKREIS IST NICHT VERHANDELBAR. In `systems/abilities.ts` steht die
 * Regel "eine Faehigkeit muss binnen einer Sekunde sichtbar sein". Beim Gegner
 * gilt sie gespiegelt: Ein Treffer, den man nicht kommen sieht, fuehlt sich
 * nicht schwer an, sondern unfair. Die 0,8 Sekunden Vorwarnung sind das, was
 * aus "ich bin gestorben" ein "ich haette ausweichen koennen" macht.
 */
export const BOSS = {
  /** Flaechenangriff. */
  slam: {
    /** Ab diesem Abstand zum naechsten Spieler stampft der Boss statt zu schiessen. */
    triggerRange: 320,
    /** Wie lange der Warnkreis steht, bevor es wehtut. */
    windupSeconds: 0.8,
    /** Wirkradius - genau der Kreis, der vorher angezeigt wird. */
    radius: 260,
    damage: 900,
    /** Rueckstoss, damit man aus der Flaeche herausgeschoben wird. */
    knockback: 520,
    cooldown: 4.5,
  },

  /** Einzelzielangriff auf Distanz. */
  salvo: {
    bullets: 5,
    /** Gesamter Faecherwinkel in Grad. */
    spread: 30,
    damage: 260,
    /** Langsamer als ein Spielerschuss - man soll ausweichen koennen. */
    speed: 300,
    cooldown: 3.0,
  },
} as const;

/**
 * ================================================================
 * ENCOUNTER UND EXTRAKTION
 * ================================================================
 *
 * Beides wird aus demselben Seed platziert wie die Karte selbst
 * (`systems/WorldGenerator.ts`), und zwar NACH Waenden und Bueschen. Die
 * Reihenfolge ist Teil der Zusicherung: Host und Clients ziehen dieselben
 * Zufallszahlen in derselben Folge und bekommen dadurch dieselben Positionen,
 * ohne dass eine einzige Koordinate uebers Netz geht.
 */
export const ENCOUNTERS = {
  /** Ab dieser Zone steht je Zone ein Mini-Boss. Naeher am Start waere er eine Falle. */
  miniFromZone: 2,
  /**
   * Wie nah man kommen muss, damit der Boss erwacht - UND der Radius des
   * Warnrings auf dem Boden.
   *
   * EINE ZAHL FUER BEIDES, und das ist der Punkt. Im ersten Versuch waren es
   * zwei (Ring 300, Ausloeser 420). Im Bild sah man dann einen Kreis, der
   * enger war als seine Wirkung: Der Boss erwachte, waehrend man noch ausserhalb
   * des Rings stand. Eine Warnung, die zu spaet kommt, ist keine - dieselbe
   * Regel wie beim Zielhinweis der Faehigkeiten (siehe CLAUDE.md).
   */
  triggerRadius: 420,

  /** Anzahl Extraktionspunkte und die Zonen, ueber die sie verteilt werden. */
  extractionCount: 6,
  extractionFromZone: 1,
  extractionToZone: 8,
  /** Radius der betretbaren Zone. */
  extractionRadius: 220,
  /** So lange muss das Team drinstehen. */
  extractionSeconds: 5,
  /**
   * Ab dieser Entfernung gilt ein Ausstieg als entdeckt.
   *
   * 1400 px ist knapp eine Bildschirmbreite bei Zoom 0,8 (1461 px). Das ist
   * Absicht: Entdeckt wird, was man tatsaechlich haette sehen koennen - nicht
   * mehr und nicht weniger. Waere der Wert groesser, bekaeme man Punkte
   * geschenkt, die nie im Bild waren; waere er kleiner, stuende man davor,
   * ohne dass der Kompass es merkt.
   */
  discoverRadius: 1400,
} as const;

/**
 * ================================================================
 * LOOT - was faellt, wo es liegt und wie man es aufhebt
 * ================================================================
 *
 * Der Katalog selbst steht in `config/items.ts`. Hier stehen nur die Zahlen,
 * mit denen gerechnet wird - wie bei allem anderen auch.
 */
export const LOOT = {
  /**
   * Wahrscheinlichkeit, dass ein Gegner beim Tod etwas fallen laesst.
   *
   * Nach Typ gestaffelt statt einheitlich: Ein Laeufer ist Kanonenfutter und
   * kommt zu Dutzenden - waere seine Chance so hoch wie die eines Brockens,
   * laege der Boden nach einer Minute voll, und Aufheben waere kein Fund
   * mehr, sondern Hausarbeit.
   */
  /*
   * Seit Etappe 8 die Werte aus dem Arbeitsdokument (vorher 8/28/16 %).
   * Laeufer fast doppelt so oft - der Boden fuellt sich schneller, das ist
   * gewollt: Mit dem Gitter-Rucksack wird Aufheben zur Entscheidung, was
   * mitkommt, statt zur Frage, ob ueberhaupt etwas liegt.
   */
  dropChance: {
    runner: 0.15,
    brute: 0.3,
    shooter: 0.2,
    // Ein Boss laesst IMMER etwas fallen. Ein Encounter, der nach zwei
    // Minuten Kampf nichts hergibt, waere die Enttaeuschung, die einen davon
    // abhaelt, es noch einmal zu versuchen.
    boss: 1,
  } as Record<string, number>,

  /** Wie viele Gegenstaende ein Boss hinterlaesst. */
  bossDrops: 2,
  finalBossDrops: 4,
  /**
   * Garantiert hoehere Seltenheit bei Bossen: Die unteren Stufen fallen weg.
   * Nach einem Boss ist Schrott eine Beleidigung.
   */
  bossMinRarity: 2,
  finalBossMinRarity: 3,

  /**
   * Wie stark die Tiefe die Seltenheit anhebt.
   *
   * Das ist die Belohnung fuer genau die Entscheidung, um die sich der ganze
   * Umbau dreht: weitergehen oder aussteigen. Ohne besseres Loot weiter
   * draussen waere Tiefe nur Risiko ohne Gegenwert.
   *
   * Gerechnet wird als Gewichtsverschiebung, nicht als harte Stufe: Auch in
   * Zone 9 faellt noch Schrott, nur seltener.
   */
  rarityPerZone: 0.16,

  /** Aufsammelradius in Pixeln. */
  pickupRadius: 46,

  /**
   * Fundorte auf der Karte, je Gebaeude.
   *
   * Sie liegen INNERHALB der Gebaeude - das ist der Grund, warum ein Haus
   * mehr ist als Deckung. Wer hineingeht, ist drinnen in der Falle (ein
   * Ausgang, enge Raeume) und bekommt dafuer etwas.
   */
  spotsPerBuildingMin: 1,
  spotsPerBuildingMax: 3,

  /**
   * Wie lange ein liegengebliebener Gegenstand sichtbar bleibt (Sekunden).
   *
   * 0 hiesse "fuer immer", und das waere kein Geschenk: Nach einer halben
   * Stunde laegen hunderte Punkte herum, jeder davon im Netzprotokoll und in
   * der Aufsammelpruefung. Drei Minuten sind lang genug, um zurueckzukommen.
   * Fundorte aus der Weltgenerierung verfallen NICHT - sie gehoeren zum Ort.
   */
  dropLifetime: 180,
} as const;

/**
 * ================================================================
 * DER RUCKSACK - Gittergroesse und das unverlierbare Starter-Set
 * ================================================================
 *
 * DIE GROESSE IST GEMESSEN, NICHT GESCHAETZT. Ein Bot-Durchlauf ueber drei
 * Charaktere und vier Seeds ergab pro Run im Schnitt 2,4 Gegenstaende und
 * 6,2 belegte Zellen, im besten Lauf 15 Zellen. Der Bot betritt allerdings
 * keine Gebaeude - und genau dort liegen die Fundorte. Ein Mensch, der
 * durchsucht, kommt also deutlich hoeher.
 *
 * 8 x 4 = 32 Zellen geben darauf das Zwei- bis Fuenffache Luft. Zwei Grenzen
 * sind dabei hart:
 *
 *  - Der groesste Gegenstand (Gewehr und Railgun, 4x2) muss in BEIDE
 *    Richtungen passen. Gedreht ist er 2x4, also braucht das Gitter
 *    mindestens 4 Zellen Hoehe - sonst waere die Drehung fuer genau die
 *    Gegenstaende unmoeglich, bei denen sie am meisten brachte.
 *  - Voll ausgereizt soll der Rucksack sein. Waere er so gross, dass alles
 *    hineinpasst, gaebe es nichts zu entscheiden - und die Entscheidung ist
 *    der Sinn des Gitters.
 *
 * SEIT ETAPPE 9: 8 x 6 = 48 Zellen, weil das Arbeitsdokument es so vorgibt.
 * Das ist die Haelfte mehr als gemessen noetig - mit den ebenfalls
 * angehobenen Dropquoten (Etappe 8) und Fundorten in Gebaeuden wird sich
 * erst im Spiel zeigen, ob sich der Rucksack noch voll anfuehlt.
 */
export const INVENTORY = {
  width: 8,
  height: 6,

  /**
   * Das Lager links im Packbildschirm: Starter-Set plus alles, was man aus
   * dem Rucksack herausgenommen hat.
   *
   * Nur fuenf Spalten breit, weil beide Gitter nebeneinander auch auf einem
   * 16:9-Geraet (Entwurfsbreite 960) Platz haben muessen - bei 64er Zellen:
   * 5 x 64 + 8 x 64 = 832, bleiben 128 fuer Raender und den Drehknopf.
   */
  stashWidth: 5,
  stashHeight: 6,

  /**
   * Kantenlaenge einer Zelle in Entwurfseinheiten.
   *
   * GEGEN DEN DAUMEN GERECHNET, nicht gegen die Maus. Apple nennt 44 x 44
   * Punkte als kleinstes Ziel, das sich zuverlaessig treffen laesst. Auf
   * einem iPhone 13 quer werden 540 Entwurfseinheiten auf 390 Bildschirmpunkte
   * abgebildet, der Faktor ist also 0,722:
   *
   *     44 Punkte / 0,722 = 61 Entwurfseinheiten Mindestgroesse
   *
   * 64 liegt knapp darueber - ein 1x1-Gegenstand ist damit rund 46 Punkte
   * gross und bleibt auch fuer einen breiten Daumen treffbar. Das ganze
   * Gitter misst 8 x 64 = 512 auf 6 x 64 = 384 Einheiten - bei 540 Hoehe
   * bleibt darueber Platz fuer die Ueberschrift und darunter fuer die
   * Knoepfe.
   */
  cellSize: 64,

  /**
   * Das Starter-Set: die unverlierbare Grundausruestung.
   *
   * Laut Briefing (Abschnitt 4) das Sicherheitsnetz gegen komplettes
   * Leerlaufen - ohne es koennte ein Team nach einem Wipe ohne alles
   * dastehen und haette keinen Weg zurueck.
   *
   * Fest im Code, weil es das dauerhafte Lager erst in Phase 13 gibt. Steht
   * hier als Liste von Katalog-Schluesseln und nicht als Indizes: Ein Index
   * verschiebt sich, wenn jemand im Katalog etwas einfuegt, ein Schluessel
   * nicht.
   */
  starterSet: ["pistol", "bandage", "bandage", "ammoBox"] as readonly string[],
} as const;

/** Wie oft ein Gegner durch Beruehrung Schaden macht (Sekunden). */
export const ENEMY_CONTACT_INTERVAL = 1.0;

/**
 * ================================================================
 * DIE WELT - was der Generator hineinstreut
 * ================================================================
 *
 * Seit Phase 8 gibt es keine feste Arena mehr, sondern eine Karte, die pro Run
 * aus einem Seed entsteht (`systems/WorldGenerator.ts`).
 *
 * WARUM DIESE GROESSE: 9600 Pixel sind 200 Kacheln a 48 Pixel - 48-mal die
 * Flaeche der alten Arena (1600x1200). Das klingt nach einem Leistungsproblem,
 * ist aber keins: Die Grenze aus dem Briefing (Abschnitt 7) ist die ANZAHL
 * Objekte, nicht die Flaeche, und die steht weiterhin bei 40 Gegnern. Eine
 * groessere Welt erzeugt keine zusaetzlichen Gegner, sie verteilt sie nur.
 * Was wirklich mit der Flaeche waechst, ist das Zeichnen des Bodens - deshalb
 * blendet `ArenaRenderer` ihn kachelweise nach Kamerasicht ein und aus.
 *
 * Der Start liegt in der MITTE, nicht am Rand: Weil die Schwierigkeit mit der
 * Entfernung waechst, hat das Team so in alle Richtungen die Wahl, wie viel
 * Risiko es nimmt. Am Rand gaebe es nur eine sinnvolle Richtung.
 */
export const WORLD = {
  /**
   * Kantenlaenge der quadratischen Welt in Pixeln.
   *
   * GEMESSEN NACHGEBESSERT: Der erste Versuch waren 9600. Damit lagen vom Start
   * in der Mitte nur 4800 Pixel bis zum Rand, also sechs Zonen - der Bot
   * erreichte in ALLEN fuenf Durchlaeufen genau Zone 5 und stand dann an der
   * Mauer. Gemessen wurde damit nicht mehr die Schwierigkeit, sondern die
   * Kartengroesse.
   *
   * 16000 ergibt 8000 Pixel Radius und damit zehn Zonen - beim tiefsten Gegner
   * also Faktor 1,08^10 = 2,16 auf das Leben. Das entspricht genau dem, was
   * frueher Welle 10 war, und die galt als gute Runde.
   *
   * Die Flaeche ist damit 133-mal die der alten Arena. Das ist gemessen
   * unbedenklich: Der Boden wird kachelweise nach Kamerasicht gezeichnet, und
   * ein Tick kostete bei 124 Waenden 0,057 ms von 33 ms Budget.
   */
  size: 16000,
  /**
   * Das Kachelraster der Welt: eine Kachel des Sheets (16 px) mal
   * `WORLD_SCALE` (3) aus `config/assets.ts`. Hier noch einmal als Zahl, weil
   * `systems/` nichts aus der Darstellung importieren darf -
   * `tests/systems/worldGenerator.test.ts` prueft, dass beide gleich sind.
   *
   * SEIT 2026-09-24 liegt jede Wand auf diesem Raster. Vorher waren
   * Deckungsbloecke 60 px breit, eine Kachel erscheint aber mit 48 - Wandstuecke
   * mit Ecken und Endkappen aus dem Sheet (Etappe 5) passen nur, wenn jede
   * Wand ein ganzes Vielfaches einer Kachel ist. Sonst sitzt eine Ecke mitten
   * in der Wand.
   */
  grid: 48,
  /** Dicke der Aussenmauer - genau eine Kachel. Sie haelt alle im Feld. */
  wallThickness: 48,

  /**
   * DAS RASTER IST DIE GARANTIE, DASS DIE KARTE ZUSAMMENHAENGT.
   *
   * Zufaellig gestreute Rechtecke koennen eine Flaeche einschliessen - dann
   * steht Loot (ab Phase 10) hinter einer Mauer, an die niemand herankommt.
   * Statt hinterher zu pruefen und neu zu wuerfeln, macht es der Aufbau
   * unmoeglich: Jedes Hindernis liegt vollstaendig in einer Rasterzelle und
   * haelt zu deren Rand mindestens `minGap / 2` Abstand. Zwischen zwei
   * benachbarten Zellen bleibt damit IMMER eine Gasse von `minGap` Breite -
   * der Spieler ist 36 Pixel dick, es passen also gut drei nebeneinander.
   *
   * `tests/systems/worldGenerator.test.ts` prueft es trotzdem mit einer
   * Flutfuellung nach: Eine Zusicherung, die man nur behauptet, ist keine.
   */
  cellSize: 800,
  /** Kleinste Gasse zwischen zwei Hindernissen. */
  minGap: 160,

  /** Radius um den Start, in dem weder Deckung steht noch Gegner erscheinen. */
  safeRadius: 700,

  /**
   * Anteil der Rasterzellen mit Deckung, und wie viele Bloecke je Zelle.
   *
   * GEMESSEN AN DER ALTEN ARENA: Die hatte 8 Deckungsbloecke auf 1600 x 1200,
   * also einen je 0,24 Millionen Pixel. Der erste Versuch (0,62 und hoechstens
   * zwei je Zelle) ergab einen je 0,82 Millionen - gut dreimal so duenn. Im
   * Bild war das deutlich zu sehen: eine weite, leere Flaeche mit einem
   * einzelnen Block am Rand.
   *
   * Das ist kein Geschmacksurteil, sondern ein Rueckschritt gegenueber einem
   * Stand, der sich gut angefuehlt hat - Deckung ist das, was einen Top-down-
   * Shooter taktisch macht. Mit 0,85 und drei Bloecken je Zelle liegt die
   * Dichte wieder in der Groessenordnung der Arena.
   */
  coverChance: 0.85,
  coverPerCell: 3,
  /**
   * Laenge und Dicke eines Deckungsblocks. Bis 2026-09-24 waren es
   * 140-320 x 60 wie in der alten Arena; jetzt aufs Kachelraster gerundet
   * (siehe `grid`). Die Dicke ist damit 12 px duenner - dafuer passen die
   * Wandstuecke aus dem Sheet genau.
   */
  coverLongMin: 144,
  coverLongMax: 336,
  coverShort: 48,

  /**
   * Anteil der Zellen mit einem Buschfeld, und dessen Kantenlaengen.
   *
   * Aus demselben Grund angehoben wie die Deckung: Die alte Arena hatte vier
   * Buschfelder auf 1,92 Millionen Pixel, also eines je 0,48 Millionen. 0,4 je
   * Zelle waeren eines je 1,6 Millionen gewesen.
   */
  bushChance: 0.75,
  /** Aussenmass eines Buschfelds, aufs Kachelraster gerundet. */
  bushMin: 192,
  bushMax: 384,
  /**
   * Wie viel von jeder Ecke eines Buschfelds weggeknabbert werden darf, als
   * Anteil der Kantenlaenge. Aus Rechtecken werden so unregelmaessige
   * Haufen - das Arbeitsdokument verlangt Cluster statt Kaesten. Unter 0,5,
   * damit das Kreuz in der Mitte immer stehen bleibt und das Feld
   * zusammenhaengt.
   */
  bushCornerBite: 0.45,

  /*
   * ================================================================
   * GEBAEUDE - gegen "die Welt fuehlt sich zu leer an"
   * ================================================================
   *
   * Deckungsbloecke sind Hindernisse, mehr nicht: Man laeuft daran vorbei und
   * merkt sich nichts. Ein Gebaeude ist ein ORT - es hat ein Innen und ein
   * Aussen, einen Eingang, und man kann sagen "wir treffen uns beim Haus mit
   * dem Loch in der Wand". Genau das hat der offenen Welt gefehlt.
   *
   * Ab Phase 10 liegt darin auch das Loot, dann ist das Hineingehen eine
   * Entscheidung: drinnen ist man in Deckung, aber auch in der Falle.
   */

  /** Erst ab dieser Distanzzone stehen Gebaeude. Um den Start bleibt es offen. */
  buildingFromZone: 1,
  /**
   * Wahrscheinlichkeit je Zelle, Grundwert und Zuwachs je Zone.
   *
   * Steigend mit der Distanz, wie Gegnerdichte und Boss-Staerke auch: Je
   * tiefer man kommt, desto mehr gibt es zu durchsuchen - und desto weniger
   * Uebersicht hat man. Bei 0,55 ist Schluss, sonst entstuende eine
   * geschlossene Stadt statt einzelner Ruinen.
   */
  buildingChance: 0.09,
  buildingChancePerZone: 0.022,
  buildingChanceMax: 0.30,
  /**
   * Kantenlaenge. Untergrenze 288, damit innen mindestens 192 px bleiben -
   * der Spieler ist 36 px dick, und drinnen soll man sich noch bewegen und
   * ausweichen koennen, nicht nur stehen.
   */
  buildingMin: 288,
  buildingMax: 384,
  /**
   * Die Obergrenze waechst mit der Zone - tiefer draussen stehen groessere
   * Gebaeude (Arbeitsdokument, Etappe 5: "Dichte/Groesse steigen mit d").
   * Bei 624 ist Schluss: Mehr passt nicht in eine Zelle von 800 abzueglich
   * der Gasse von 160.
   */
  buildingMaxPerZone: 24,
  buildingMaxCap: 624,
  /** Dicke der Gebaeudewaende - genau eine Kachel. */
  buildingWall: 48,
  /**
   * Breite des Eingangs.
   *
   * 144 px (drei Kacheln) bei 36 px Spielerdicke - grosszuegig, und das ist Absicht. Eine
   * Tuer, die man im Gefecht auf den ersten Versuch trifft, ist eine Tuer;
   * eine, an der man haengenbleibt, waehrend hinter einem drei Laeufer
   * ankommen, ist eine Falle. Ausserdem haengt daran der Zusammenhang der
   * Karte: Passt hier niemand durch, ist der Innenraum unerreichbar.
   */
  buildingDoor: 144,
} as const;

/**
 * ================================================================
 * SCHWIERIGKEIT NACH DISTANZ - die Formel, die die Wellen ersetzt
 * ================================================================
 *
 * Frueher stieg die Schwierigkeit mit der WELLENNUMMER, also mit der Zeit. Man
 * konnte nichts dagegen tun ausser besser zu spielen. Jetzt steigt sie mit der
 * ENTFERNUNG zum Start - und damit entscheidet das Team selbst, wie gefaehrlich
 * es gerade wird. Das ist der Kern des Umbaus: aus einem Schicksal wird eine
 * Entscheidung.
 *
 * Eine "Zone" ist ein Ring um den Startpunkt. Zone 0 ist der sichere Anfang,
 * jede weitere ist `zoneSize` Pixel weiter draussen.
 *
 * Statt einer Welle mit fester Gegnerzahl gibt es eine ZIELBEVOELKERUNG rund um
 * die Spieler: So viele Gegner sollen gleichzeitig unterwegs sein. Faellt die
 * Zahl darunter, erscheint Nachschub knapp ausserhalb des Sichtfelds; wer weit
 * genug wegläuft, laesst Gegner hinter sich zurueck.
 */
export const DIFFICULTY = {
  /** Breite einer Distanzzone in Pixeln. */
  zoneSize: 800,

  /**
   * Zielbevoelkerung in Zone 0, und wieviel je weiterer Zone dazukommt.
   *
   * GEMESSEN NACHGEBESSERT: Mit 3 + 1,6 je Zone waren zu keinem Zeitpunkt mehr
   * als neun Gegner gleichzeitig unterwegs - die Welt wirkte leer, wo die alten
   * Wellen ueber zwanzig gleichzeitig brachten. Jetzt: Zone 0 vier Gegner,
   * Zone 5 rund sechzehn, Zone 10 rund neunundzwanzig. Die Obergrenze von 40
   * aus dem Briefing wird damit erst jenseits von Zone 14 ueberhaupt erreicht.
   */
  baseEnemies: 4,
  enemiesPerZone: 2.5,

  /** Ab welcher Zone es Schuetzen bzw. Brocken gibt. */
  shooterFromZone: 2,
  bruteFromZone: 4,
  /** Anteil Schuetzen und Brocken an der Bevoelkerung, sobald sie auftauchen. */
  shooterShare: 0.3,
  bruteShare: 0.2,

  /** Leben +8 % je Zone, Schaden +4 % - dieselben Zahlen wie frueher je Welle. */
  healthGrowth: 1.08,
  damageGrowth: 1.04,

  /** Gegnerzahl * (0.6 + 0.4 * Spielerzahl) - unveraendert aus der Wellenformel. */
  playerCountBase: 0.6,
  playerCountFactor: 0.4,

  /**
   * Ring, in dem Nachschub erscheint: knapp ausserhalb des Sichtfelds.
   *
   * Die Kamera zeigt rund 1170 Entwurfseinheiten Breite, also etwa 585 nach
   * jeder Seite. 700 liegt sicher dahinter - Gegner sollen auftauchen, aber
   * nicht vor den Augen des Spielers aus dem Nichts erscheinen.
   */
  spawnRadiusMin: 700,
  spawnRadiusMax: 1200,

  /** Abstand zwischen zwei Spawns in Sekunden. */
  spawnIntervalSeconds: 1.2,
  /** Vorwarnzeit der Spawnmarkierung in Sekunden. */
  spawnWarningSeconds: 1,

  /**
   * Weiter als das entfernt, wird ein Gegner wieder entfernt.
   *
   * Ohne diese Zeile sammelt sich die halbe Karte hinter dem Team an und
   * stoesst an die Obergrenze von 40 - dann erschiene vorne nichts mehr,
   * obwohl man tief im gefaehrlichen Gebiet steht.
   */
  despawnRadius: 2600,
} as const;

/** Harte Obergrenzen fuer die Handy-Leistung (Briefing, Abschnitt 7). */
export const LIMITS = {
  maxEnemies: 40,
  maxProjectiles: 60,
} as const;

/**
 * Die Knoten-Karte eines Runs (BRIEFING Abschnitt 2 und 4).
 *
 * Das Muster: Schichten vom Start bis zum Ende-Boss. In jeder Schicht liegen
 * bis zu `columns` Knoten nebeneinander. Mehrere Pfade laufen von Schicht zu
 * Schicht, jeweils nur in eine NACHBARspalte - so entstehen parallele Wege,
 * die sich trennen und wieder treffen, ohne sich zu kreuzen.
 *
 * Die Knotentypen sind die des Briefings: Standard-Kampf (haeufigster),
 * Elite/Mini-Boss, Lager/Rast, Extraktion, Ende-Boss. Tiefe, Spaltenzahl
 * und Gewichte sind Vorschlaege zum Justieren.
 */
export const NODE_MAP = {
  /** Anzahl Schichten, Start und Ende-Boss eingeschlossen. */
  depth: 12,
  /** Spalten nebeneinander. 4 passt quer auf ein Handy, ohne zu scrollen. */
  columns: 4,
  /**
   * Wie viele Pfade gezogen werden. Mehr Pfade = mehr Verzweigungen. Zwei
   * Pfade starten garantiert in verschiedenen Spalten, sonst gaebe es
   * gleich am Anfang keine Wahl.
   */
  paths: 5,
  /**
   * Gewichte der Knotentypen fuer die Schichten dazwischen. Ein Gewicht ist
   * kein Prozentwert - 5 gegen 1 heisst "fuenfmal so haeufig". Kampf ist
   * laut Briefing der haeufigste Typ.
   */
  typeWeights: {
    combat: 5,
    elite: 1,
    rest: 1,
    extraction: 1.2,
  },
  /** Ab welcher Schicht Elite-Knoten vorkommen duerfen (0 = Start). */
  eliteFromLayer: 4,
  /** Ab welcher Schicht Rastplaetze vorkommen duerfen. */
  restFromLayer: 3,
  /**
   * Ab welcher Schicht Extraktionen vorkommen duerfen. Nicht gleich am
   * Anfang: Wer nach einem Knoten schon aussteigen kann, hat nichts riskiert.
   */
  extractionFromLayer: 2,
  /**
   * Gefahrenstufe g: Grundwert je Schicht. Knoten in Schicht n haben
   * mindestens `1 + floor(n * dangerPerLayer)`.
   */
  dangerPerLayer: 0.75,
  /** Elite-Knoten liegen so viele Stufen ueber ihrer Schicht. */
  eliteDangerBonus: 1,
  /**
   * Beute-Potenzial (Eckdaten-Balken): Gefahr plus Aufschlag je Typ.
   * Rast, Extraktion und Start haben keine Kampfbeute - dort ist es 0.
   */
  lootBonus: { combat: 0, elite: 2, boss: 3 },
  /**
   * Kartengroesse (1 klein, 2 mittel, 3 gross) - Gewichte fuer normale
   * Knoten. Elite ist immer klein (eng und heftig), der Boss immer gross.
   */
  sizeWeights: [3, 4, 2] as readonly number[],
} as const;

/**
 * Das Gebiet eines Knotens (NodeArenaGenerator, BRIEFING Abschnitt 4).
 *
 * ================================================================
 * DICHTE WIE DIE GEGNERDICHTE: PROPORTIONAL ZU g
 * ================================================================
 *
 * Gleiche Logik wie die Gegnerformel im Briefing: Anzahl = Grundwert +
 * Faktor x g, mit Obergrenze. Ein Knoten mit g = 1 ist eine offene Flaeche
 * mit wenig Deckung; bei g = 8 steht Kiste an Kiste, und die Haeuser sind
 * groesser. Mehr Deckung heisst dort nicht "leichter": Gegner kommen dann
 * auch von hinter der Deckung.
 *
 * Die Obergrenzen sind die Leistungsgrenze fuers Handy (siehe CLAUDE.md,
 * "Leistungsbudget"): Eine Kiste hat rund 630 Dreiecke.
 */
export const NODE_ARENA = {
  /** Kantenlaenge je Kartengroesse (1 klein, 2 mittel, 3 gross), in Kacheln (1 m). */
  sizeTiles: [40, 48, 56] as readonly number[],
  /** Mindestabstand zwischen zwei Hindernissen (Pixel): zwei Kacheln Gasse. */
  minGap: 96,
  /** Um den Startpunkt bleibt so viel frei (Pixel). */
  spawnClear: 336,
  buildings: { base: 1, perDanger: 0.35, max: 5 },
  /** Gebaeudegroesse in Kacheln; die Obergrenze waechst mit g. */
  buildingTiles: { min: 6, max: 8, maxPerDanger: 0.3, maxCap: 12 },
  /** Deckung aus Kistenstapeln: Anzahl Stapelreihen. */
  cover: { base: 6, perDanger: 1.5, max: 20 },
  /** Laenge einer Kistenreihe in Kacheln (je Kiste zwei Kacheln). */
  coverTiles: [2, 4, 6] as readonly number[],
  /** Anteil der Kisten, auf denen eine zweite liegt - hoehere Deckung. */
  stackChance: 0.45,
  /** Einzelne Beutekisten (mit Glanz markiert). */
  lootCrates: { base: 2, perDanger: 0.3, max: 5 },
  /** Buschhaufen - Verstecke, unabhaengig von g. */
  bushes: 3,
  /** Deko ohne Kollision: Zielscheiben und Rauch. */
  deco: { base: 6, perDanger: 1, max: 16 },
  /** Harte Obergrenze fuer Kisten je Knoten (Leistung). */
  maxCrates: 70,
  /**
   * Beute-Qualitaet steigt mit g (Briefing): Grundgewichte der Seltenheiten
   * 1 bis 4, und je Stufe g wird jede hoehere Seltenheit um diesen Anteil
   * wahrscheinlicher. Bei g = 1 ist Stufe 4 selten, bei g = 8 so haeufig
   * wie Stufe 1.
   */
  lootRarityBase: [6, 3, 1.5, 0.6] as readonly number[],
  lootRarityPerDanger: 0.25,
  /** Ausstieg bzw. Boss liegen so weit vom Start (Anteil der Kantenlaenge). */
  landmarkDistance: 0.34,
} as const;
