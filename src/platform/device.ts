/**
 * Erkennt, ob das Spiel auf einem Handy laeuft.
 *
 * Das Spiel ist ausschliesslich fuer Touchgeraete gebaut: Die ganze Steuerung
 * besteht aus zwei Daumen, und die Arena ist auf einen Handybildschirm
 * zugeschnitten. Auf dem Desktop waere es nicht "schlechter spielbar", sondern
 * falsch bedienbar - deshalb wird dort gar nicht erst gestartet.
 *
 * Erkannt wird ueber Faehigkeiten, nicht ueber den User-Agent-Text. Ein
 * User-Agent laesst sich beliebig faelschen und aendert sich mit jeder
 * Browserversion; "hat dieses Geraet einen Finger statt einer Maus" ist stabil.
 */

/** Laeuft das Spiel in der nativen Android-App (Capacitor)? */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const native = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return native?.isNativePlatform?.() === true;
}

/** Laeuft das Spiel in einer installierten App (PWA oder Capacitor)? */
export function isInstalledApp(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (isNativeApp()) {
    return true;
  }

  // PWA vom Startbildschirm: kein Browserrahmen.
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  // Aelteres Safari auf dem iPhone kennt display-mode nicht.
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Ein Touchgeraet mit grobem Zeiger - also Handy oder Tablet.
 *
 * Tablets werden bewusst mitgezaehlt: Sie haben dieselbe Bedienung, und sie
 * zuverlaessig von grossen Handys zu unterscheiden ist nicht moeglich.
 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const hasTouchPoints = navigator.maxTouchPoints > 0;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  return hasTouchPoints && coarsePointer;
}

/** Darf das Spiel auf diesem Geraet starten? */
export function isSupportedDevice(): boolean {
  return isInstalledApp() || isTouchDevice();
}

/** iPhone oder iPad? Die Installation laeuft dort anders als auf Android. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  // iPadOS meldet sich seit Version 13 als Macintosh - daran erkennbar, dass
  // ein "Mac" ploetzlich Touch kann.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
