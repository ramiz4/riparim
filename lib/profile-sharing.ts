import { localizeHref, type Locale } from "./i18n/locale";
import type { Workshop } from "./workshops";

export function publicProfileShare(
  workshop: Pick<Workshop, "id" | "name" | "status">,
  locale: Locale,
  origin = "https://riparim.com",
): { title: string; url: string } | null {
  if (
    workshop.status !== "published" ||
    !/^[a-z0-9][a-z0-9-]{2,80}$/.test(workshop.id) ||
    !workshop.name.trim()
  )
    return null;
  try {
    const base = new URL(origin);
    const localDevelopment =
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (
      (base.protocol !== "https:" && !localDevelopment) ||
      base.username ||
      base.password
    )
      return null;
    return {
      title: workshop.name,
      url: new URL(
        localizeHref(`/werkstatt/${workshop.id}`, locale),
        base.origin,
      ).href,
    };
  } catch {
    return null;
  }
}

// An isolated document prints only the public card, even while private UI is open.
export function profilePrintFrame(card: HTMLElement, title: string) {
  const returnFocus = document.activeElement;
  const frame = document.createElement("iframe");
  frame.title = title;
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:600px;height:600px;border:0";
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) throw Error("Printing unavailable");
    doc.title = title;
    doc.documentElement.lang = card.lang;
    const style = doc.createElement("style");
    style.textContent = `
      @page { margin: 20mm; }
      body { margin: 0; color: #000; background: #fff; font: 16px/1.5 sans-serif; }
      article { max-width: 110mm; padding: 10mm; border: 1px solid #888; text-align: center; break-inside: avoid; }
      h2 { margin: 0 0 5mm; font-size: 24px; overflow-wrap: anywhere; }
      p { margin: 5mm 0 0; }
      a { color: #000; text-decoration: none; overflow-wrap: anywhere; }
      svg { display: block; width: 50mm; height: 50mm; margin: auto; }
    `;
    doc.head.appendChild(style);
    doc.body.appendChild(card.cloneNode(true));
    frame.contentWindow.addEventListener(
      "afterprint",
      () => {
        frame.remove();
        if (returnFocus instanceof HTMLElement && returnFocus.isConnected)
          returnFocus.focus();
      },
      {
        once: true,
      },
    );
    frame.contentWindow.focus();
    frame.contentWindow.print();
    return frame;
  } catch {
    frame.remove();
    return null;
  }
}
