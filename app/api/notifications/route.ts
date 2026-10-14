import { z } from "zod";
import { getAdminUser } from "@/app/auth";
import { storage } from "@/db/storage";
import { json, readJson, sameOrigin } from "@/lib/http";
import {
  canRetryNotification,
  notificationQueue,
} from "@/lib/notifications/outbox";
import { triggerNotifications } from "@/lib/notifications/dispatch";
import type { NotificationRow } from "@/lib/notifications/contract";

export const dynamic = "force-dynamic";
const actionSchema = z
  .object({
    action: z.literal("retry"),
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/),
  })
  .strict();
export async function GET(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin)
      return json(
        { error: "Bitte melde dich an.", errorCode: "authentication_required" },
        401,
      );
    if (!admin.isModerator)
      return json(
        {
          error: "Kein Zugriff auf den Benachrichtigungsversand.",
          errorCode: "forbidden",
        },
        403,
      );
    return json(
      await notificationQueue(new URL(request.url).searchParams.get("cursor")),
    );
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && e.message === "INVALID_CURSOR"
            ? "Ungültige Seitenangabe."
            : "Die Versandübersicht ist gerade nicht verfügbar.",
        errorCode:
          e instanceof Error && e.message === "INVALID_CURSOR"
            ? "invalid_page"
            : "notifications_unavailable",
      },
      e instanceof Error && e.message === "INVALID_CURSOR" ? 400 : 503,
    );
  }
}
export async function POST(request: Request) {
  if (
    !sameOrigin(request) ||
    !request.headers.get("content-type")?.includes("application/json")
  )
    return json(
      { error: "Ungültige Anfrage.", errorCode: "invalid_request" },
      403,
    );
  try {
    const admin = await getAdminUser();
    if (!admin)
      return json(
        { error: "Bitte melde dich an.", errorCode: "authentication_required" },
        401,
      );
    if (!admin.isModerator)
      return json(
        {
          error: "Kein Zugriff auf den Benachrichtigungsversand.",
          errorCode: "forbidden",
        },
        403,
      );
    let body;
    try {
      body = actionSchema.parse(await readJson(request, 2048));
    } catch {
      return json(
        { error: "Ungültige Aktion.", errorCode: "invalid_request" },
        400,
      );
    }

    const row = await storage()
      .db.prepare("SELECT * FROM review_notifications WHERE id=?")
      .bind(body.id)
      .first<NotificationRow>();
    if (!row)
      return json(
        {
          error: "Die Benachrichtigung ist nicht mehr vorhanden.",
          errorCode: "notification_not_found",
        },
        404,
      );
    if (!canRetryNotification(row))
      return json(
        {
          error:
            "Wiederholung derzeit nicht möglich: Wartezeit, Versuchslimit, laufender Versand oder abgeschlossene Nachricht.",
          errorCode: "notification_retry_forbidden",
        },
        409,
      );
    if (!(await triggerNotifications({ id: row.id, manual: true })))
      return json(
        {
          error:
            "Die Nachricht wird bereits verarbeitet oder kann derzeit nicht wiederholt werden.",
          errorCode: "notification_retry_forbidden",
        },
        409,
      );
    return json({ checked: true, messageCode: "saved" });
  } catch {
    return json(
      {
        error:
          "Die Versandprüfung konnte nicht gestartet werden. Das Ereignis bleibt gespeichert.",
        errorCode: "notification_start_failed",
      },
      503,
    );
  }
}
