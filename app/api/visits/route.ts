import { visitsReadResponse } from "@/lib/visits-read";
import { publicAccountName, accountNameMaxLength } from "@/lib/account-name";
import {
  completeReview,
  submittedReviewServices,
  decodeReviewServices,
  validReviewRating,
  validReviewText,
  reviewTextMaxLength,
} from "@/lib/review";
import { ValidationError } from "@/lib/validation-error";
import { validateEvidenceFile } from "@/lib/evidence-file";
import { getAppUser, getAdminUser, ownsVisit, ownerPair } from "@/app/auth";
import { storage, cleanupVisitEvidence } from "@/db/storage";
import { publishedWorkshop } from "@/db/directory";
import { json, sameOrigin, readJson, validDate } from "@/lib/http";
import { accountBlocked } from "@/lib/auth/account-status";
import { moderationAuthority } from "@/lib/auth/moderation-authority";
import { triggerNotifications } from "@/lib/notifications/dispatch";
export const dynamic = "force-dynamic";
const failure = () =>
  json(
    {
      error:
        "Die Bewertung konnte gerade nicht verarbeitet werden. Deine Eingaben bleiben erhalten.",
      errorCode: "review_unavailable",
    },
    503,
  );
export async function GET(request: Request) {
  return visitsReadResponse(request, { getAppUser, getAdminUser });
}
export async function POST(request: Request) {
  return submitEvidence(request, false);
}
export async function PUT(request: Request) {
  return submitEvidence(request, true);
}
async function submitEvidence(request: Request, replacing: boolean) {
  const user = await getAppUser();
  if (!user)
    return json(
      {
        error: "Bitte melde dich an, bevor du eine Bewertung einreichst.",
        errorCode: "authentication_required",
      },
      401,
    );
  if (!sameOrigin(request))
    return json(
      { error: "Ungültige Anfrage.", errorCode: "invalid_request" },
      403,
    );
  if (Number(request.headers.get("content-length") ?? 0) > 6 * 1024 * 1024)
    return json(
      {
        error: "Die Datei ist zu groß. Maximal 5 MB.",
        errorCode: "file_too_large",
      },
      413,
    );
  let key: string | null = null,
    uploadKey: string | null = null;
  try {
    const { db, bucket } = storage(),
      f = await request.formData(),
      str = (key: string, max = 100) =>
        String(f.get(key) ?? "")
          .trim()
          .slice(0, max);
    const submittedServices = submittedReviewServices(f),
      id = str("id"),
      workshop = str("workshop"),
      date = str("date"),
      vehicle = str("vehicle"),
      service = submittedServices?.[0] ?? "",
      evidenceType = str("evidenceType"),
      evidenceNote = str("evidenceNote", 3000),
      displayName = publicAccountName(user.displayName),
      reviewValue = f.get("review"),
      review = typeof reviewValue === "string" ? reviewValue.trim() : "",
      rating = Number(f.get("rating"));
    let selectedServices = submittedServices;
    if (!validReviewText(reviewValue) || !validReviewRating(rating))
      return json(
        {
          error:
            "Bitte wähle 1–5 Sterne. Der optionale Text darf höchstens 2000 Zeichen enthalten.",
          errorCode: "invalid_review",
        },
        400,
      );
    if (f.get("consent") !== "true")
      return json(
        {
          error: "Bitte bestätige die Checkbox zur privaten Prüfung.",
          errorCode: "consent_required",
        },
        400,
      );
    if (
      !/^[0-9a-f-]{36}$/.test(id) ||
      !validDate(date) ||
      date > new Date().toISOString().slice(0, 10) ||
      vehicle.length < 3 ||
      !selectedServices ||
      !["Rechnung", "Service- oder Arbeitsbeleg", "Anderer Nachweis"].includes(
        evidenceType,
      )
    )
      return json(
        {
          error:
            "Bitte prüfe Werkstatt, Besuchsdatum, Fahrzeug, Leistung und Nachweisart.",
          errorCode: "invalid_visit",
        },
        400,
      );
    if (!(await publishedWorkshop(workshop)))
      return json(
        {
          error: "Bitte wähle eine veröffentlichte Werkstatt.",
          errorCode: "invalid_visit",
        },
        400,
      );
    const prior = await db
      .prepare(
        "SELECT owner,status,file_key,file_name,file_type,revision,service,services FROM visits WHERE id=?",
      )
      .bind(id)
      .first<{
        owner: string;
        status: string;
        file_key: string | null;
        file_name: string | null;
        file_type: string | null;
        revision: number;
        service: string;
        services: string | null;
      }>();
    if (!replacing && prior)
      return ownsVisit(user, prior.owner)
        ? json({ id, status: prior.status })
        : json(
            { error: "Ungültige Kennung.", errorCode: "review_conflict" },
            409,
          );
    if (
      replacing &&
      (!prior ||
        !ownsVisit(user, prior.owner) ||
        !["pending", "approved", "needs_more", "published"].includes(
          prior.status,
        ) ||
        prior.revision !== Number(str("revision")))
    )
      return json(
        {
          error:
            "Die Bewertung kann gerade nicht bearbeitet werden. Bitte aktualisiere deine Bewertungen.",
          errorCode: "review_conflict",
        },
        409,
      );
    if (replacing && !f.has("services") && prior?.service === service)
      selectedServices = decodeReviewServices(prior.service, prior.services);
    const storedServices = JSON.stringify(selectedServices);
    const recordOwner = prior?.owner ?? user.userId;
    // A block or account deletion can overtake an in-flight evidence upload.
    const accountGuard =
        "NOT EXISTS (SELECT 1 FROM auth_account_status WHERE status IN ('inactive','deleted') AND (account_id IN (?,?) OR account_id IN (SELECT account_id FROM auth_links WHERE legacy_owner IN (?,?))))",
      accountKeys = [...ownerPair(user), ...ownerPair(user)];
    const file = f.get("file");
    let fileName: string | null = null,
      fileType: string | null = null;
    if (file && typeof file !== "string" && file.size) {
      let validated;
      try {
        validated = await validateEvidenceFile(file);
      } catch (error) {
        if (error instanceof ValidationError)
          return json(
            { error: error.message, errorCode: error.code },
            error.code === "file_too_large" ? 413 : 400,
          );
        throw error;
      }
      const { bytes } = validated;
      key = `evidence/${recordOwner}/${id}/${crypto.randomUUID()}`;
      fileName = validated.fileName;
      fileType = validated.fileType;
      const tracked = await db
        .prepare(
          `INSERT INTO evidence_uploads (file_key,owner) SELECT ?,? WHERE ${accountGuard}`,
        )
        .bind(key, user.userId, ...accountKeys)
        .run();
      if (!tracked.meta.changes) {
        key = null;
        return json(
          {
            error:
              "Dein Konto ist gesperrt. Bitte melde dich bei der Verwaltung.",
            errorCode: "account_blocked",
          },
          401,
        );
      }
      uploadKey = key;
      // A delayed payload can only replace its own empty reservation. Deletion
      // removes that reservation, so R2 rejects a write arriving after cleanup.
      const reservation = await bucket.put(key, null, {
        customMetadata: { kind: "upload-reservation" },
      });
      const permitted = await db
        .prepare(
          `SELECT file_key FROM evidence_uploads WHERE file_key=? AND ${accountGuard}`,
        )
        .bind(key, ...accountKeys)
        .first();
      if (!permitted)
        return json(
          {
            error:
              "Dein Konto ist gesperrt. Bitte melde dich bei der Verwaltung.",
            errorCode: "account_blocked",
          },
          401,
        );
      const uploaded = await bucket.put(key, bytes, {
        httpMetadata: { contentType: fileType },
        onlyIf: { etagMatches: reservation.etag },
      });
      if (!uploaded)
        return json(
          {
            error:
              "Die Einreichung wurde inzwischen gelöscht oder geändert. Bitte aktualisiere deine Bewertungen.",
            errorCode: "review_conflict",
          },
          (await accountBlocked(user.userId)) ? 401 : 409,
        );
    }
    if (
      !key &&
      replacing &&
      prior?.file_key &&
      f.get("keepEvidence") === "true"
    ) {
      if (!(await bucket.head(prior.file_key)))
        return json(
          {
            error:
              "Der bisherige Beleg ist nicht verfügbar. Bitte lade ihn erneut hoch.",
            errorCode: "evidence_missing",
          },
          400,
        );
      key = prior.file_key;
      fileName = prior.file_name;
      fileType = prior.file_type;
    }
    if (
      !key &&
      (evidenceType !== "Anderer Nachweis" || evidenceNote.length < 40)
    )
      return json(
        {
          error:
            "Bitte lade einen Beleg hoch oder beschreibe einen anderen nachvollziehbaren Nachweis mit mindestens 40 Zeichen.",
          errorCode: "evidence_required",
        },
        400,
      );
    if (replacing) {
      const r = await db
        .prepare(
          `UPDATE visits SET workshop=?,date=?,vehicle=?,service=?,services=?,evidence_type=?,evidence_note=?,file_key=?,file_name=?,file_type=?,display_name=?,rating=?,review=?,status='pending',moderator_note='',moderated_at=NULL,moderated_by=NULL,revision=revision+1 WHERE id=? AND owner=? AND status IN ('pending','approved','needs_more','published') AND revision=? AND ${accountGuard}`,
        )
        .bind(
          workshop,
          date,
          vehicle,
          service,
          storedServices,
          evidenceType,
          evidenceNote,
          key,
          fileName,
          fileType,
          displayName,
          rating,
          review,
          id,
          recordOwner,
          prior!.revision,
          ...accountKeys,
        )
        .run();
      if (!r.meta.changes) {
        if (key && key !== prior!.file_key) await bucket.delete(key);
        if (await accountBlocked(user.userId))
          return json(
            {
              error:
                "Dein Konto ist gesperrt. Bitte melde dich bei der Verwaltung.",
              errorCode: "account_blocked",
            },
            401,
          );
        return json(
          {
            error:
              "Die Bewertung wurde zwischenzeitlich geändert. Bitte aktualisiere deine Bewertungen.",
            errorCode: "review_conflict",
          },
          409,
        );
      }
      if (prior!.file_key && prior!.file_key !== key) {
        try {
          await bucket.delete(prior!.file_key);
        } catch (e) {
          console.error("old-evidence-cleanup", e);
        }
      }
    } else {
      const r = await db
        .prepare(
          `INSERT INTO visits (id,owner,workshop,date,vehicle,service,services,evidence_type,evidence_note,file_key,file_name,file_type,display_name,rating,review,status,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',? WHERE ${accountGuard}`,
        )
        .bind(
          id,
          user.userId,
          workshop,
          date,
          vehicle,
          service,
          storedServices,
          evidenceType,
          evidenceNote,
          key,
          fileName,
          fileType,
          displayName,
          rating,
          review,
          new Date().toISOString(),
          ...accountKeys,
        )
        .run();
      if (!r.meta.changes) {
        if (key) await bucket.delete(key);
        return json(
          {
            error:
              "Dein Konto ist gesperrt. Bitte melde dich bei der Verwaltung.",
            errorCode: "account_blocked",
          },
          401,
        );
      }
    }
    return json({ id, status: "pending" }, replacing ? 200 : 201);
  } catch (e) {
    if (key) {
      try {
        const referenced = await storage()
          .db.prepare("SELECT id FROM visits WHERE file_key=?")
          .bind(key)
          .first();
        if (!referenced) await storage().bucket.delete(key);
      } catch {}
    }
    console.error("visit-submit", e);
    return failure();
  } finally {
    if (uploadKey)
      try {
        const { db, bucket } = storage();
        const referenced = await db
          .prepare("SELECT id FROM visits WHERE file_key=?")
          .bind(uploadKey)
          .first();
        if (!referenced) await bucket.delete(uploadKey);
        await db
          .prepare("DELETE FROM evidence_uploads WHERE file_key=?")
          .bind(uploadKey)
          .run();
      } catch {
        try {
          await storage()
            .db.prepare(
              "INSERT OR IGNORE INTO evidence_uploads (file_key,owner) VALUES (?,?)",
            )
            .bind(uploadKey, user.userId)
            .run();
        } catch {}
        console.error(
          "evidence-upload-cleanup-pending",
        ); /* Retain only cleanup inventory; a removed reservation cannot accept private bytes. */
      }
  }
}
export async function PATCH(request: Request) {
  if (!sameOrigin(request))
    return json(
      { error: "Ungültige Anfrage.", errorCode: "invalid_request" },
      403,
    );
  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json(
      { error: "Ungültige Eingaben.", errorCode: "invalid_request" },
      400,
    );
  }
  const user =
    body.action === "moderate" ? await getAdminUser() : await getAppUser();
  if (!user)
    return json(
      { error: "Bitte melde dich an.", errorCode: "authentication_required" },
      401,
    );
  try {
    const { db } = storage(),
      id = String(body.id ?? "");
    if (body.action === "moderate") {
      if (!user.isModerator)
        return json(
          { error: "Kein Zugriff auf die Prüfung.", errorCode: "forbidden" },
          403,
        );
      const status = String(body.status ?? ""),
        note = String(body.note ?? "")
          .trim()
          .slice(0, 1000),
        revision = Number(body.revision);
      if (
        !["published", "needs_more"].includes(status) ||
        note.length < 10 ||
        !Number.isInteger(revision)
      )
        return json(
          {
            error: "Bitte ergänze einen Prüfvermerk mit mindestens 10 Zeichen.",
            errorCode: "invalid_request",
          },
          400,
        );
      const prior = await db
        .prepare(
          "SELECT file_key,evidence_type,evidence_note,display_name,rating,review,revision,status FROM visits WHERE id=?",
        )
        .bind(id)
        .first<{
          file_key: string | null;
          evidence_type: string;
          evidence_note: string;
          display_name: string | null;
          rating: number | null;
          review: string | null;
          revision: number;
          status: string;
        }>();
      if (!prior || prior.revision !== revision || prior.status === "deleting")
        return json(
          {
            error:
              "Die Bewertung wurde zwischenzeitlich geändert. Bitte aktualisiere die Liste.",
            errorCode: "review_conflict",
          },
          409,
        );
      if (status === "published") {
        if (!completeReview(prior))
          return json(
            {
              error:
                "Diese ältere Einreichung enthält noch keine vollständige Bewertung. Sie muss zuerst ergänzt werden.",
              errorCode: "invalid_review",
            },
            400,
          );
        if (prior.file_key) {
          if (!(await storage().bucket.head(prior.file_key)))
            return json(
              {
                error:
                  "Der Besuchsbeleg fehlt. Fordere einen neuen Nachweis an.",
                errorCode: "evidence_missing",
              },
              409,
            );
        } else if (
          prior.evidence_type !== "Anderer Nachweis" ||
          prior.evidence_note.trim().length < 40
        )
          return json(
            {
              error: "Ein nachvollziehbarer Besuchsnachweis ist erforderlich.",
              errorCode: "evidence_required",
            },
            409,
          );
      }
      const allowed =
        status === "published"
          ? "('pending','needs_more','approved')"
          : "('pending','needs_more','approved','published')";
      const complete =
        status === "published"
          ? ` AND length(trim(display_name)) BETWEEN 2 AND ${accountNameMaxLength} AND rating BETWEEN 1 AND 5 AND rating=CAST(rating AS INTEGER) AND COALESCE(length(trim(review)),0)<=${reviewTextMaxLength} AND (file_key IS NOT NULL OR (evidence_type='Anderer Nachweis' AND length(trim(evidence_note))>=40)) AND EXISTS (SELECT 1 FROM workshops WHERE workshops.id=visits.workshop AND workshops.status='published')`
          : "";
      const eventId = `riparim-review-${id}-revision-${revision + 1}`,
        operation = crypto.randomUUID(),
        now = new Date().toISOString();
      // Reserve the decision event before its status write, in one transaction.
      // A stale retry cannot borrow a different request's event or emit a new mail.
      const actor = moderationAuthority(user),
        eligible = `id=? AND status IN ${allowed} AND revision=?${complete} AND ${actor.sql}`;
      const result = await db.batch([
        db
          .prepare(
            `INSERT OR IGNORE INTO review_notifications (id,visit_id,owner,revision,decision,operation_token,created_at,next_attempt_at) SELECT ?,id,owner,revision+1,?,?,?,? FROM visits WHERE ${eligible}`,
          )
          .bind(
            eventId,
            status,
            operation,
            now,
            Date.now(),
            id,
            revision,
            ...actor.values,
          ),
        db
          .prepare(
            `UPDATE visits SET status=?,moderator_note=?,moderated_at=?,moderated_by=?,revision=revision+1 WHERE ${eligible} AND EXISTS (SELECT 1 FROM review_notifications WHERE id=? AND operation_token=?)`,
          )
          .bind(
            status,
            note,
            now,
            user.userId,
            id,
            revision,
            ...actor.values,
            eventId,
            operation,
          ),
      ]);
      if (!result[1].meta.changes)
        return json(
          {
            error:
              "Die Bewertung wurde geändert oder die Werkstatt ist ausgeblendet. Bitte aktualisiere die Liste.",
            errorCode: "review_conflict",
          },
          409,
        );
      // Delivery runs separately from the committed moderation decision. Provider
      // outages retain the durable event; they never roll back a published review.
      try {
        await triggerNotifications({ id: eventId });
      } catch {
        console.error("review-notification-dispatch-deferred");
      }
      return json({ status });
    }
    if (body.action === "review")
      return json(
        {
          error:
            "Bitte reiche Bewertung und Nachweis gemeinsam ein. Nur die Verwaltung kann veröffentlichen.",
          errorCode: "invalid_request",
        },
        409,
      );
    return json(
      { error: "Ungültige Aktion.", errorCode: "invalid_request" },
      400,
    );
  } catch (e) {
    console.error("visit-update", e);
    return failure();
  }
}
export async function DELETE(request: Request) {
  const user = await getAppUser();
  if (!user)
    return json(
      { error: "Bitte melde dich an.", errorCode: "authentication_required" },
      401,
    );
  if (!sameOrigin(request))
    return json(
      { error: "Ungültige Anfrage.", errorCode: "invalid_request" },
      403,
    );
  let body: Record<string, unknown>;
  try {
    body = await readJson(request);
  } catch {
    return json(
      { error: "Ungültige Eingaben.", errorCode: "invalid_request" },
      400,
    );
  }
  try {
    const { db } = storage(),
      id = String(body.id ?? "");
    const v = await db
      .prepare(
        "UPDATE visits SET status='deleting',revision=revision+1 WHERE id=? AND owner IN (?,?) RETURNING file_key,owner",
      )
      .bind(id, ...ownerPair(user))
      .first<{ file_key: string | null; owner: string }>();
    if (!v)
      return json(
        { error: "Nachweis nicht gefunden.", errorCode: "not_found" },
        404,
      );
    await cleanupVisitEvidence(v.owner, id);
    await db.batch([
      db
        .prepare(
          "DELETE FROM review_notifications WHERE visit_id=? AND owner IN (?,?)",
        )
        .bind(id, ...ownerPair(user)),
      db
        .prepare(
          "DELETE FROM visits WHERE id=? AND owner IN (?,?) AND status='deleting'",
        )
        .bind(id, ...ownerPair(user)),
    ]);
    return json({ deleted: true });
  } catch (e) {
    console.error("visit-delete", e);
    return failure();
  }
}
