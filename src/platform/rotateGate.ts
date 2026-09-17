/**
 * Der Startbildschirm, der auf das Querformat wartet.
 *
 * WARUM ES IHN GIBT (der Fehler, den er behebt):
 *
 * Das Spiel misst beim Start den Bildschirm, um seine Zeichenflaeche genau
 * darauf zuzuschneiden (`fitViewportToScreen`). Wird die App hochkant
 * geoeffnet und erst danach gedreht, war diese Messung fuer das falsche
 * Format - und es blieben links und rechts Balken stehen. Genau das war auf
 * dem iPhone zu sehen.
 *
 * Statt die Flaeche nachtraeglich umzubauen (was jede Szene, jeden Knopf und
 * jede HUD-Position neu setzen muesste, mitten im Spiel), wird das Spiel
 * einfach erst gestartet, wenn das Handy quer ist. Dann stimmt die Messung
 * beim ersten Mal, und es gibt nichts nachzubessern.
 *
 * DER NOTAUSGANG: Wer die Rotationssperre eingeschaltet hat - auf dem iPhone
 * der Normalfall - bei dem meldet der Browser niemals "quer", egal wie man das
 * Geraet haelt. Ohne Ausweg waere das eine Sackgasse, und genau eine solche
 * Sackgasse hat dieses Projekt schon einmal lahmgelegt. Deshalb erscheint nach
 * ein paar Sekunden ein Knopf "Trotzdem starten". Wer einfach dreht, sieht ihn
 * nie.
 */

/** Nach so vielen Millisekunden erscheint der Notausgang. */
const ANYWAY_AFTER_MS = 4000;

/**
 * Hat jemand "Trotzdem starten" gewaehlt?
 *
 * Modulweit, weil beide Funktionen es wissen muessen: Wer den Notausgang
 * genommen hat, spielt bewusst hochkant - der Startbildschirm darf ihn dann
 * nicht beim naechsten Groessenwechsel erneut aufhalten.
 */
let forcedStart = false;

function gateElement(): HTMLElement | null {
  return document.getElementById("rotate-gate");
}

/** Liegt das Geraet quer? Gemessen am sichtbaren Bereich, nicht am Sensor. */
export function isLandscape(): boolean {
  return window.innerWidth >= window.innerHeight;
}

/**
 * Wartet, bis das Geraet quer liegt - oder bis jemand "Trotzdem starten"
 * drueckt. Danach ist der Startbildschirm weg.
 */
export function waitForLandscape(): Promise<void> {
  const gate = gateElement();
  if (!gate) {
    // Kein Startbildschirm im HTML (sollte nicht vorkommen) - dann nicht warten.
    return Promise.resolve();
  }

  if (isLandscape()) {
    gate.hidden = true;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const anyway = gate.querySelector<HTMLButtonElement>(".gate-anyway");

    const finish = (): void => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
      window.clearInterval(poll);
      window.clearTimeout(showAnyway);
      gate.hidden = true;
      resolve();
    };

    function check(): void {
      if (isLandscape()) {
        finish();
      }
    }

    // Nach dem Drehen meldet der Browser die neuen Masse erst ein paar Bilder
    // spaeter, und nicht jedes Geraet feuert zuverlaessig ein Ereignis.
    // Deshalb zusaetzlich alle 200 ms nachsehen.
    const poll = window.setInterval(check, 200);
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);

    const showAnyway = window.setTimeout(() => {
      if (anyway) {
        anyway.style.display = "block";
      }
    }, ANYWAY_AFTER_MS);

    anyway?.addEventListener(
      "click",
      () => {
        forcedStart = true;
        finish();
      },
      { once: true },
    );
  });
}

/**
 * Zeigt den Startbildschirm wieder, solange hochkant gehalten wird.
 *
 * Das Spiel laeuft dahinter weiter - es wird nur verdeckt. Anhalten waere im
 * Koop falsch: Der Host rechnet fuer alle weiter, und ein angehaltener Client
 * wuerde nur aus dem Takt geraten.
 */
export function watchOrientation(): void {
  const gate = gateElement();
  if (!gate) {
    return;
  }

  const anyway = gate.querySelector<HTMLButtonElement>(".gate-anyway");
  anyway?.addEventListener("click", () => {
    // Wer einmal "Trotzdem starten" gewaehlt hat, will nicht bei jedem
    // Verdrehen wieder aufgehalten werden.
    forcedStart = true;
    gate.hidden = true;
  });

  const update = (): void => {
    gate.hidden = forcedStart || isLandscape();
  };

  // Der Knopf muss von Anfang an sichtbar sein, wenn der Startbildschirm im
  // Spiel wieder auftaucht - dort gibt es keine Wartezeit mehr, die ihn
  // einblendet.
  if (anyway) {
    anyway.style.display = "block";
  }

  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", () => {
    window.setTimeout(update, 120);
    window.setTimeout(update, 400);
  });
}
