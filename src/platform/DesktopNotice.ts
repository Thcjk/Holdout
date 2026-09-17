/**
 * Die Sperrseite fuer alles, was kein Handy ist.
 *
 * Bewusst ohne Phaser: Wer hier landet, soll das Spiel gar nicht erst laden.
 * Das spart am Desktop ein 1,5-MB-Bundle und macht unmissverstaendlich klar,
 * dass hier nichts kaputt ist, sondern das Geraet nicht gemeint war.
 *
 * Der QR-Code wird erst hier nachgeladen (`await import`), damit die
 * QR-Bibliothek nicht im Handy-Bundle landet, wo sie niemand braucht.
 */

const BACKGROUND = "#11161f";
const TEXT = "#dce8f7";
const DIM = "#8ea6c4";
const ACCENT = "#ffd166";

export async function showDesktopNotice(): Promise<void> {
  document.body.innerHTML = "";
  document.body.style.background = BACKGROUND;

  const page = document.createElement("div");
  page.setAttribute(
    "style",
    `min-height:100dvh;display:flex;flex-direction:column;align-items:center;
     justify-content:center;gap:22px;padding:32px 24px;box-sizing:border-box;
     color:${TEXT};font-family:system-ui,sans-serif;text-align:center;`,
  );

  page.appendChild(heading("Koop-Arena-Shooter", "34px", "700", TEXT));
  page.appendChild(heading("Dieses Spiel läuft nur auf dem Handy.", "19px", "400", ACCENT));
  page.appendChild(
    paragraph(
      "Die ganze Steuerung besteht aus zwei Daumen: links laufen, rechts zielen und schiessen. " +
        "Mit Maus und Tastatur wäre das nicht schlechter spielbar, sondern falsch bedienbar.",
    ),
  );

  const url = gameUrl();
  page.appendChild(await qrBlock(url));
  page.appendChild(linkLine(url));
  page.appendChild(
    paragraph(
      "Auf dem Handy öffnen, dann „Zum Startbildschirm hinzufügen“ – " +
        "danach startet es wie eine App, auch ohne Internet.",
    ),
  );

  document.body.appendChild(page);
}

function heading(text: string, size: string, weight: string, color: string): HTMLElement {
  const element = document.createElement("div");
  element.textContent = text;
  element.setAttribute("style", `font-size:${size};font-weight:${weight};color:${color};`);
  return element;
}

function paragraph(text: string): HTMLElement {
  const element = document.createElement("p");
  element.textContent = text;
  element.setAttribute(
    "style",
    `max-width:520px;margin:0;font-size:15px;line-height:1.55;color:${DIM};`,
  );
  return element;
}

function linkLine(url: string): HTMLElement {
  const link = document.createElement("a");
  link.href = url;
  link.textContent = url.replace(/^https?:\/\//, "");
  link.setAttribute(
    "style",
    `font-size:16px;color:${TEXT};text-decoration:none;border-bottom:1px solid ${DIM};
     word-break:break-all;`,
  );
  return link;
}

/** Der QR-Code - oder ein ehrlicher Hinweis, wenn er sich nicht zeichnen laesst. */
async function qrBlock(url: string): Promise<HTMLElement> {
  const frame = document.createElement("div");
  frame.setAttribute(
    "style",
    "background:#ffffff;padding:14px;border-radius:14px;line-height:0;min-height:40px;",
  );

  try {
    const { toCanvas } = await import("qrcode");
    const canvas = document.createElement("canvas");
    await toCanvas(canvas, url, {
      width: 208,
      margin: 0,
      color: { dark: "#11161f", light: "#ffffff" },
    });
    frame.appendChild(canvas);
  } catch {
    // Kein QR-Code ist kein Grund, die ganze Seite scheitern zu lassen.
    frame.remove();
    return paragraph("Adresse unten auf dem Handy eintippen:");
  }

  return frame;
}

/** Die Adresse, unter der das Spiel erreichbar ist - ohne Suchparameter. */
function gameUrl(): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}`;
}
