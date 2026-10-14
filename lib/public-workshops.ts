import { listWorkshops } from "@/db/directory";
import { workshopDisplayById } from "./workshop-display.server";
import { isLocale } from "./i18n/locale";
import { json } from "./http";

// Shared by the framework route and the owned Worker's public GET fast path.
// Admin reads and all writes continue through the authenticated route.
export async function publicWorkshopResponse(request: Request) {
  try {
    const locale = new URL(request.url).searchParams.get("locale");
    if (locale !== null && !isLocale(locale))
      return json(
        { errorCode: "invalid_request", error: "Ungültige Sprache." },
        400,
      );
    const workshops = await listWorkshops();
    return json({
      workshops,
      ...(locale !== null && isLocale(locale)
        ? { displayById: await workshopDisplayById(workshops, locale) }
        : {}),
    });
  } catch (error) {
    console.error(
      "directory-read",
      error instanceof Error ? error.name : "unknown",
    );
    return json(
      {
        errorCode: "unavailable",
        error:
          "Die Werkstattdaten sind gerade nicht verfügbar. Bitte versuche es erneut.",
      },
      503,
    );
  }
}
