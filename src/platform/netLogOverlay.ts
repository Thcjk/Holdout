/**
 * Zeigt das Verbindungsprotokoll auf dem Bildschirm - mit `?debug=netz`.
 *
 * Bewusst ein normales HTML-Element ueber dem Spiel und keine Phaser-Szene:
 * Es muss auch dann noch lesbar sein, wenn die Lobby gerade eine
 * Fehlermeldung anzeigt oder die Szene wechselt.
 *
 * Der Text laesst sich markieren und kopieren (`user-select`), damit man ihn
 * verschicken kann, statt ihn abzutippen.
 */

import { onNetLog } from "../net/netLog";
import { SHOW_NET_LOG } from "./debugFlags";

let element: HTMLPreElement | null = null;

export function installNetLogOverlay(): void {
  if (!SHOW_NET_LOG || element) {
    return;
  }

  const node = document.createElement("pre");
  node.setAttribute("data-holdout-netlog", "");
  node.style.cssText = [
    "position:fixed",
    "left:0",
    "right:0",
    "bottom:0",
    "max-height:52vh",
    "overflow:auto",
    "z-index:60",
    "margin:0",
    "padding:8px 10px",
    "box-sizing:border-box",
    "font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace",
    "color:#dce8f7",
    "background:rgba(17,22,31,.92)",
    "border-top:1px solid rgba(220,232,247,.3)",
    "white-space:pre-wrap",
    "word-break:break-all",
    // Ausdruecklich markierbar - der Rest des Spiels ist es nicht.
    "-webkit-user-select:text",
    "user-select:text",
  ].join(";");
  document.body.appendChild(node);
  element = node;

  onNetLog((lines) => {
    node.textContent = lines.join("\n");
    // Immer die neueste Zeile zeigen.
    node.scrollTop = node.scrollHeight;
  });
}
