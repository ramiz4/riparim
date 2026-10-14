import { legacyMessages } from "@/lib/i18n/legacy-messages";
import { listWorkshops } from "@/db/directory";
import {
  googlePlacesConfiguration,
  readConfirmedWorkshopGooglePlace,
} from "@/db/google-places";
import { json, sameOrigin } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return json(
      { errorCode: "invalid_request", error: legacyMessages.invalidRequest },
      403,
    );
  const { id } = await params;
  if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(id))
    return json(
      { errorCode: "not_found", error: legacyMessages.invalidWorkshop },
      404,
    );
  if (!googlePlacesConfiguration().enabled)
    return json({ enabled: false, placeId: null });
  try {
    const workshop = (await listWorkshops()).find((w) => w.id === id);
    if (!workshop)
      return json(
        { errorCode: "not_found", error: legacyMessages.workshopNotFound },
        404,
      ); // Display reuses only the already confirmed public ID; browsing cannot start provider research.
    const placeId = await readConfirmedWorkshopGooglePlace(workshop);
    return json({ enabled: true, placeId });
  } catch {
    return json(
      {
        errorCode: "unavailable",
        error: legacyMessages.googleDataUnavailable,
      },
      503,
    );
  }
}
