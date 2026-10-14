import { getAdminUser } from "@/app/auth";
import { listWorkshops } from "@/db/directory";
import { storage } from "@/db/storage";
import { json, readJson, sameOrigin } from "@/lib/http";
import { isLocale } from "@/lib/i18n/locale";
import { workshopDisplayById } from "@/lib/workshop-display.server";
export const dynamic = "force-dynamic";
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{2,80}$/.test(value);
async function admin() {
  const user = await getAdminUser();
  return !user
    ? json({ errorCode: "authentication_required" }, 401)
    : !user.isModerator
      ? json({ errorCode: "forbidden" }, 403)
      : null;
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    if (query.get("admin") === "1") {
      const denial = await admin();
      if (denial) return denial;
      const id = query.get("workshop");
      if (!validId(id)) return json({ errorCode: "invalid_request" }, 400);
      const row = await storage()
        .db.prepare("SELECT active FROM workshop_premium WHERE workshop_id=?")
        .bind(id)
        .first<{ active: number }>();
      return json({ active: row?.active === 1 });
    }
    const locale = query.get("locale") ?? "de";
    if (!isLocale(locale)) return json({ errorCode: "invalid_request" }, 400);
    const directory = await listWorkshops();
    const rows = await storage()
      .db.prepare("SELECT workshop_id FROM workshop_premium WHERE active=1")
      .all<{ workshop_id: string }>();
    const ids = new Set(rows.results.map((row) => row.workshop_id));
    const premium = directory.filter(
      (workshop) => workshop.status === "published" && ids.has(workshop.id),
    );
    const workshops = premium.length
      ? premium
      : directory.filter((workshop) => workshop.status === "published");
    return json({
      workshops,
      preview: premium.length === 0,
      displayById: await workshopDisplayById(workshops, locale),
    });
  } catch (error) {
    console.error(
      "premium-read",
      error instanceof Error ? error.name : "unknown",
    );
    return json({ errorCode: "unavailable" }, 503);
  }
}
export async function PUT(request: Request) {
  try {
    const denial = await admin();
    if (denial) return denial;
    if (!sameOrigin(request)) return json({ errorCode: "forbidden" }, 403);
    let body: Record<string, unknown>;
    try {
      body = await readJson(request);
    } catch {
      return json({ errorCode: "invalid_request" }, 400);
    }
    if (
      !validId(body.workshop) ||
      typeof body.active !== "boolean" ||
      Object.keys(body).some((key) => !["workshop", "active"].includes(key))
    )
      return json({ errorCode: "invalid_request" }, 400);
    const active = body.active ? 1 : 0;
    const result = await storage()
      .db.prepare(
        "INSERT INTO workshop_premium (workshop_id,active,updated_at) SELECT id,?,? FROM workshops WHERE id=? AND (?=0 OR status='published') ON CONFLICT(workshop_id) DO UPDATE SET active=excluded.active,updated_at=excluded.updated_at",
      )
      .bind(active, new Date().toISOString(), body.workshop, active)
      .run();
    return result.meta.changes
      ? json({ messageCode: "saved", active: body.active })
      : json({ errorCode: "not_found" }, 404);
  } catch (error) {
    console.error(
      "premium-save",
      error instanceof Error ? error.name : "unknown",
    );
    return json({ errorCode: "unavailable" }, 503);
  }
}
