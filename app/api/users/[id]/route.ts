import { legacyMessages } from "@/lib/i18n/legacy-messages";
import { ValidationError } from "@/lib/validation-error";
import { getAdminUser } from "@/app/auth";
import { resolveProviderAccount } from "@/lib/auth/identities";
import { normalizeAuthSubject } from "@/lib/auth/provider";
import { getAuthAdmin } from "@/lib/auth/admin";
import { blockAccount } from "@/lib/auth/account-status";
import { changeAccountRole } from "@/lib/auth/roles";
import { storage, moderatorEmail } from "@/db/storage";
import { deleteAccount } from "@/lib/auth/delete-account";
import { json, readJson, sameOrigin } from "@/lib/http";
import {
  protectedUser,
  userView,
  validUserId,
  parseUserFields,
  providerFailure,
  notConfigured,
} from "@/lib/admin-users";
import type { AuthUserAttributes } from "@/lib/auth/contract";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const admin = await getAdminUser();
    if (!admin)
      return json(
        {
          error: legacyMessages.authenticationRequired,
          errorCode: "authentication_required",
        },
        401,
      );
    if (!admin.isModerator || !sameOrigin(request))
      return json(
        {
          error: legacyMessages.usersForbidden,
          errorCode: "forbidden",
        },
        403,
      );
    let id = (await params).id;
    if (!validUserId(id))
      return json(
        { error: legacyMessages.invalidUserId, errorCode: "invalid_user_id" },
        400,
      );
    if (!request.headers.get("content-type")?.includes("application/json"))
      return json(
        { error: legacyMessages.invalidRequest, errorCode: "invalid_request" },
        400,
      );
    let fields;
    try {
      fields = parseUserFields(await readJson(request, 8192));
    } catch (e) {
      return json(
        {
          error:
            e instanceof ValidationError
              ? e.message
              : legacyMessages.checkInputs,
          errorCode: e instanceof ValidationError ? e.code : "invalid_request",
        },
        400,
      );
    }
    const auth = await getAuthAdmin();
    if (!auth) return notConfigured();
    const subject = normalizeAuthSubject(auth.provider, id);
    if (!subject)
      return json(
        { error: legacyMessages.invalidUserId, errorCode: "invalid_user_id" },
        400,
      );
    id = subject;
    const { data: current, error: lookupError } =
      await auth.client.getUserById(id);
    if (lookupError || !current.user) return providerFailure(lookupError);
    const user = current.user,
      accountId = await resolveProviderAccount(auth, id),
      db = storage().db;
    if (
      (await protectedUser(user, admin, auth)) &&
      ("role" in fields ||
        "active" in fields ||
        (fields.email !== undefined &&
          fields.email !== user.email?.toLowerCase()))
    )
      return json(
        {
          error: legacyMessages.userProtected,
          errorCode: "user_protected",
        },
        403,
      );
    if (
      fields.email === moderatorEmail() &&
      fields.email !== user.email?.toLowerCase()
    )
      return json(
        {
          error: legacyMessages.userEmailReserved,
          errorCode: "user_email_reserved",
        },
        403,
      );
    const status = await db
      .prepare("SELECT status FROM auth_account_status WHERE account_id=?")
      .bind(accountId)
      .first<{ status: string }>();
    if (status?.status === "deleted")
      return json(
        {
          error: legacyMessages.userDeletionStarted,
          errorCode: "user_deletion_started",
        },
        409,
      );
    if (fields.role !== undefined) {
      const before = await userView(user, admin, auth);
      const roleChanged = before.role !== fields.role;
      if (roleChanged)
        try {
          await changeAccountRole(accountId, fields.role, admin);
        } catch (e) {
          if (e instanceof Error && e.message === "ROLE_CHANGE_FORBIDDEN")
            return json(
              {
                error: legacyMessages.roleChangeForbidden,
                errorCode: "role_change_forbidden",
              },
              403,
            );
          throw e;
        }
      return json({
        user: await userView(user, admin, auth),
        roleChanged,
        messageCode: "saved",
      });
    }
    const attributes: AuthUserAttributes = {};
    if (fields.name !== undefined) attributes.name = fields.name;
    if (
      fields.email !== undefined &&
      fields.email !== user.email?.toLowerCase()
    )
      attributes.email = fields.email;
    if (fields.password !== undefined) attributes.password = fields.password;
    if (fields.active !== undefined) {
      if (!fields.active) await blockAccount(accountId, "inactive");
      attributes.active = fields.active;
    }
    if (attributes.email || attributes.password)
      await db
        .prepare("UPDATE auth_sessions SET revoked=1 WHERE account_id=?")
        .bind(accountId)
        .run();
    const { data, error } = await auth.client.updateUserById(id, attributes);
    if (error || !data.user) return providerFailure(error);
    if (fields.active === true)
      await db
        .prepare(
          "DELETE FROM auth_account_status WHERE account_id=? AND status='inactive'",
        )
        .bind(accountId)
        .run();
    return json({
      user: await userView(data.user, admin, auth),
      messageCode: "saved",
    });
  } catch {
    return providerFailure(null);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const admin = await getAdminUser();
    if (!admin)
      return json(
        {
          error: legacyMessages.authenticationRequired,
          errorCode: "authentication_required",
        },
        401,
      );
    if (!admin.isModerator || !sameOrigin(request))
      return json(
        {
          error: legacyMessages.usersForbidden,
          errorCode: "forbidden",
        },
        403,
      );
    let id = (await params).id;
    if (!validUserId(id))
      return json(
        { error: legacyMessages.invalidUserId, errorCode: "invalid_user_id" },
        400,
      );
    const auth = await getAuthAdmin();
    if (!auth) return notConfigured();
    const subject = normalizeAuthSubject(auth.provider, id);
    if (!subject)
      return json(
        { error: legacyMessages.invalidUserId, errorCode: "invalid_user_id" },
        400,
      );
    id = subject;
    const { data, error } = await auth.client.getUserById(id);
    if (error?.status === 404 || error?.code === "not_found") {
      const accountId = await resolveProviderAccount(auth, id);
      if (accountId === admin.userId)
        return json(
          {
            error: legacyMessages.userDeleteProtected,
            errorCode: "user_delete_protected",
          },
          403,
        );
      const tombstone = await storage()
        .db.prepare(
          "SELECT account_id FROM auth_account_status WHERE account_id=? AND status='deleted'",
        )
        .bind(accountId)
        .first();
      if (!tombstone) return providerFailure(error);
    } else if (error || !data.user) return providerFailure(error);
    if (data.user && (await protectedUser(data.user, admin, auth)))
      return json(
        {
          error: legacyMessages.userDeleteProtected,
          errorCode: "user_delete_protected",
        },
        403,
      );
    await deleteAccount(auth, id);
    return json({ ok: true, messageCode: "saved" });
  } catch {
    return json(
      {
        error: legacyMessages.userDeleteIncomplete,
        errorCode: "user_delete_incomplete",
      },
      503,
    );
  }
}
