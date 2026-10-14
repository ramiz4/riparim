import { legacyMessages } from "@/lib/i18n/legacy-messages";
import { researchedEmailsSql } from "@/db/workshop-email-values";
import { z } from "zod";
import { storage } from "@/db/storage";
import { ownerPair, type AppUser } from "./auth/app-user";
import {
  decodeProfile,
  ensureInitialCatalog,
  listWorkshops,
} from "@/db/directory";
import {
  businessProfileSchema,
  claimSchema,
  claimDocumentViews,
  type BusinessRequest,
  type BusinessState,
} from "./business-contract";
import { BusinessError } from "./business-error";
import { ValidationError } from "./validation-error";
import { json } from "./http";

function view(
  row: Record<string, unknown>,
  kind: "claim" | "change",
): BusinessRequest {
  return {
    id: String(row.id),
    workshopId: String(row.workshop_id),
    workshopName: String(row.workshop_name ?? row.workshop_id),
    owner: String(row.owner),
    status: String(row.status),
    moderatorNote: String(row.moderator_note),
    revision: Number(row.revision),
    createdAt: String(row.created_at),
    ...(kind === "claim"
      ? {
          fileName: row.file_name ? String(row.file_name) : null,
          documents: claimDocumentViews(row),
          evidence: String(row.evidence),
          evidenceLinks: claimSchema.shape.evidenceLinks.parse(
            JSON.parse(String(row.evidence_links)),
          ),
        }
      : {
          profile: businessProfileSchema.parse(JSON.parse(String(row.profile))),
          baseUpdatedAt: String(row.base_updated_at),
        }),
  };
}
function parseCursor(value?: string | null) {
  if (!value) return null;
  try {
    if (value.length > 512) throw Error();
    return z
      .object({
        date: z
          .string()
          .max(30)
          .refine((value) => Number.isFinite(Date.parse(value))),
        id: z.string().uuid(),
      })
      .strict()
      .parse(JSON.parse(atob(value)));
  } catch {
    throw new BusinessError(legacyMessages.invalidPage, 400, "invalid_page");
  }
}
export async function businessState(
  user: AppUser,
  moderation = false,
  cursors: { claims?: string | null; changes?: string | null } = {},
): Promise<BusinessState> {
  await ensureInitialCatalog();
  const db = storage().db,
    owners = ownerPair(user);
  const read = async (
    table: "workshop_claims" | "workshop_changes",
    kind: "claim" | "change",
    cursorValue?: string | null,
  ) => {
    const cursor = parseCursor(cursorValue),
      predicate = moderation ? "r.status='pending'" : "r.owner IN (?,?)";
    const rows = await db
      .prepare(
        `SELECT r.*,w.name AS workshop_name FROM ${table} r JOIN workshops w ON w.id=r.workshop_id WHERE ${predicate}${cursor ? " AND (r.created_at<? OR (r.created_at=? AND r.id<?))" : ""} ORDER BY r.created_at DESC,r.id DESC LIMIT 51`,
      )
      .bind(
        ...(moderation ? [] : owners),
        ...(cursor ? [cursor.date, cursor.date, cursor.id] : []),
      )
      .all<Record<string, unknown>>();
    const items = rows.results.slice(0, 50).map((row) => view(row, kind)),
      last = items.at(-1);
    return {
      items,
      next:
        rows.results.length > 50 && last
          ? btoa(JSON.stringify({ date: last.createdAt, id: last.id }))
          : null,
    };
  };
  const owned = moderation
    ? await listWorkshops(true)
    : (
        await db
          .prepare(
            `SELECT w.*, ${researchedEmailsSql} AS researched_emails FROM workshops w JOIN workshop_owners o ON o.workshop_id=w.id WHERE o.account_id IN (?,?) ORDER BY w.name`,
          )
          .bind(...owners)
          .all<Record<string, unknown>>()
      ).results.map((row) => decodeProfile(row, { emailEditing: true }));
  const claims = await read("workshop_claims", "claim", cursors.claims),
    changes = await read("workshop_changes", "change", cursors.changes);
  // Current guidance and edit locks must not depend on a page of historical decisions.
  const pendingClaims = moderation
    ? []
    : (
        await db
          .prepare(
            "SELECT r.id,r.workshop_id,w.name AS workshop_name,r.created_at,r.file_name,r.file_key,r.file_type,r.documents FROM workshop_claims r JOIN workshops w ON w.id=r.workshop_id WHERE r.owner IN (?,?) AND r.status='pending' ORDER BY r.created_at DESC,r.id DESC",
          )
          .bind(...owners)
          .all<Record<string, unknown>>()
      ).results.map((row) => ({
        id: String(row.id),
        workshopId: String(row.workshop_id),
        workshopName: String(row.workshop_name),
        createdAt: String(row.created_at),
        fileName: row.file_name ? String(row.file_name) : null,
        documents: claimDocumentViews(row),
      }));
  const pendingChangeWorkshopIds = moderation
    ? []
    : (
        await db
          .prepare(
            "SELECT DISTINCT c.workshop_id FROM workshop_changes c JOIN workshop_owners o ON o.workshop_id=c.workshop_id WHERE o.account_id IN (?,?) AND c.status='pending' ORDER BY c.workshop_id",
          )
          .bind(...owners)
          .all<Record<string, unknown>>()
      ).results.map((row) => String(row.workshop_id));
  const pendingChangeRequestIds = moderation
    ? []
    : (
        await db
          .prepare(
            "SELECT id FROM workshop_changes WHERE owner IN (?,?) AND status='pending' ORDER BY created_at DESC,id DESC",
          )
          .bind(...owners)
          .all<Record<string, unknown>>()
      ).results.map((row) => String(row.id));
  return {
    pendingClaims,
    pendingChangeWorkshopIds,
    pendingChangeRequestIds,
    claims: claims.items,
    changes: changes.items,
    workshops: owned,
    nextClaimCursor: claims.next,
    nextChangeCursor: changes.next,
  };
}

export function businessFailure(error: unknown) {
  if (error instanceof BusinessError)
    return json({ error: error.message, errorCode: error.code }, error.status);
  if (error instanceof ValidationError)
    return json(
      { error: error.message, errorCode: error.code },
      error.code === "file_too_large" ? 413 : 400,
    );
  if (error instanceof z.ZodError)
    return json(
      {
        error: legacyMessages.businessInvalidInput,
        errorCode: "business_invalid_input",
      },
      400,
    );
  console.error(
    "business-operation-failed",
    error instanceof Error ? error.name : "unknown",
  );
  return json(
    {
      error: legacyMessages.businessUnavailable,
      errorCode: "business_unavailable",
    },
    503,
  );
}
export async function businessReadResponse(
  request: Request,
  auth: {
    getAppUser(): Promise<AppUser | null>;
    getAdminUser(): Promise<AppUser | null>;
  },
) {
  const { getAppUser, getAdminUser } = auth;
  try {
    const params = new URL(request.url).searchParams,
      moderation = params.get("moderation") === "1",
      user = moderation ? await getAdminUser() : await getAppUser();
    if (!user)
      return json(
        {
          error: legacyMessages.authenticationRequired,
          errorCode: "authentication_required",
        },
        401,
      );
    if (moderation && !user.isModerator)
      return json(
        { error: legacyMessages.moderationForbidden, errorCode: "forbidden" },
        403,
      );
    return json(
      await businessState(user, moderation, {
        claims: params.get("claimCursor"),
        changes: params.get("changeCursor"),
      }),
    );
  } catch (e) {
    return businessFailure(e);
  }
}
