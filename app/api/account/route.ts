import { canonicalDeleteConfirmation } from "@/lib/i18n/delete-confirmation";
import { legacyMessages } from "@/lib/i18n/legacy-messages";
import { accountReadResponse } from "@/lib/account-read";
import { ValidationError } from "@/lib/validation-error";
import { isLocale } from "@/lib/i18n/locale";
import { getAppUser } from "@/app/auth";
import { resolveProviderAccount } from "@/lib/auth/identities";
import { authClient } from "@/lib/auth/client";
import { getAuthConfig } from "@/lib/auth/config";
import { getAuthAdmin } from "@/lib/auth/admin";
import { accountBlocked } from "@/lib/auth/account-status";
import { isBootstrapAccount } from "@/lib/auth/roles";
import {
  clearDeletionGrant,
  deletionProtected,
  issueDeletionGrant,
  matchesDeletionGrant,
  readDeletionGrant,
  startDeletion,
} from "@/lib/auth/deletion-grant";
import { deleteAccount } from "@/lib/auth/delete-account";
import { verifyPassword } from "@/lib/auth/password-proof";
import { rateLimit } from "@/lib/auth/rate-limit";
import { parseUserFields } from "@/lib/admin-users";
import { json, readJson, sameOrigin } from "@/lib/http";

export const dynamic = "force-dynamic";
function logFailure(operation: string, error: unknown) {
  console.error("account-operation-failed", {
    operation,
    reason: error instanceof Error ? error.name : "unknown",
  });
}
const unavailable = () =>
  json(
    {
      error: legacyMessages.accountUnavailable,
      errorCode: "account_unavailable",
    },
    503,
  );
async function currentAccount() {
  const user = await getAppUser(),
    config = await getAuthConfig();
  if (
    !user ||
    !config?.enabled ||
    !["Google", "E-Mail"].includes(user.provider)
  )
    return null;
  const client = await authClient(config),
    { data, error } = await client.getUser();
  if (
    error ||
    !data.user?.emailVerified ||
    user.userId !==
      (await resolveProviderAccount(config, data.user.identity.subject))
  )
    return null;
  return { user, config, client, providerUser: data.user };
}
async function input(request: Request) {
  if (
    !sameOrigin(request) ||
    !request.headers.get("content-type")?.includes("application/json")
  )
    throw Error("INVALID_REQUEST");
  return readJson(request, 2048);
}
export async function GET() {
  return accountReadResponse({
    currentAccount,
    readDeletionGrant,
    getAuthConfig,
  });
}
export async function PATCH(request: Request) {
  let body;
  try {
    body = await input(request);
  } catch {
    return json(
      { error: legacyMessages.invalidRequest, errorCode: "invalid_request" },
      400,
    );
  }
  try {
    const current = await currentAccount();
    if (!current)
      return json(
        {
          error: legacyMessages.googleOrEmailRequired,
          errorCode: "authentication_required",
        },
        401,
      );
    if (
      Object.keys(body).length !== 1 ||
      (!("name" in body) && !("preferredLocale" in body)) ||
      ("preferredLocale" in body && !isLocale(body.preferredLocale))
    )
      return json(
        {
          error: legacyMessages.invalidAccountPatch,
          errorCode: "invalid_account_patch",
        },
        400,
      );
    const preference = "preferredLocale" in body;
    let fields;
    try {
      fields = preference ? {} : parseUserFields(body);
    } catch (e) {
      return json(
        {
          error:
            e instanceof ValidationError ? e.message : legacyMessages.checkName,
          errorCode: e instanceof ValidationError ? e.code : "invalid_request",
        },
        400,
      );
    }
    if (await accountBlocked(current.user.userId))
      return json(
        {
          error: legacyMessages.accountDeletionStarted,
          errorCode: "account_blocked",
        },
        409,
      );
    const auth = await getAuthAdmin();
    if (
      !auth ||
      auth.projectUrl !== current.config.projectUrl ||
      auth.provider !== current.config.provider
    )
      return unavailable();
    const { data, error } = await auth.client.updateUserById(
      current.providerUser.identity.subject,
      preference
        ? { preferredLocale: String(body.preferredLocale) }
        : { name: fields.name },
    );
    if (error || !data.user) return unavailable();
    return json(
      preference
        ? { preferredLocale: body.preferredLocale, messageCode: "saved" }
        : { name: fields.name, messageCode: "saved" },
    );
  } catch (e) {
    logFailure("rename", e);
    return unavailable();
  }
}
export async function POST(request: Request) {
  let body;
  try {
    body = await input(request);
  } catch {
    return json(
      { error: legacyMessages.invalidRequest, errorCode: "invalid_request" },
      400,
    );
  }
  try {
    const current = await currentAccount();
    if (!current)
      return json(
        {
          error: legacyMessages.authenticationRequired,
          errorCode: "authentication_required",
        },
        401,
      );
    if (
      current.user.provider !== "E-Mail" ||
      (await deletionProtected(current.user))
    )
      return json(
        {
          error: legacyMessages.selfDeletionProtected,
          errorCode: "deletion_protected",
        },
        403,
      );
    if (
      Object.keys(body).length !== 1 ||
      typeof body.password !== "string" ||
      !body.password.length ||
      body.password.length > 128
    )
      return json(
        {
          error: legacyMessages.currentPasswordRequired,
          errorCode: "current_password_required",
        },
        400,
      );
    if (await rateLimit(request, "account-reauth", current.user.userId))
      return json(
        {
          error: legacyMessages.rateLimited,
          errorCode: "rate_limited",
        },
        429,
      );
    if (
      !(await verifyPassword(
        current.config,
        current.providerUser.identity.subject,
        current.providerUser.email!,
        body.password,
      ))
    )
      return json(
        {
          error: legacyMessages.passwordProofFailed,
          errorCode: "password_proof_failed",
        },
        401,
      );
    if (await accountBlocked(current.user.userId))
      return json(
        { error: legacyMessages.accountBlocked, errorCode: "account_blocked" },
        403,
      );
    await issueDeletionGrant(
      current.user,
      current.config,
      current.providerUser.identity.subject,
    );
    return json({ ok: true });
  } catch (e) {
    logFailure("reauthenticate", e);
    return unavailable();
  }
}
export async function DELETE(request: Request) {
  let body;
  try {
    body = await input(request);
  } catch {
    return json(
      { error: legacyMessages.invalidRequest, errorCode: "invalid_request" },
      400,
    );
  }
  if (
    Object.keys(body).length !== 1 ||
    body.confirmation !== canonicalDeleteConfirmation
  )
    return json(
      {
        error: legacyMessages.deletionConfirmationRequired,
        errorCode: "deletion_confirmation_required",
      },
      400,
    );
  try {
    const grant = await readDeletionGrant(),
      config = await getAuthConfig();
    if (
      !grant ||
      !config?.enabled ||
      !(await matchesDeletionGrant(grant, config))
    )
      return json(
        {
          error: legacyMessages.reauthenticationRequired,
          errorCode: "reauthentication_required",
        },
        401,
      );
    if (!grant.started) {
      const current = await currentAccount();
      if (!current || current.user.userId !== grant.account_id)
        return json(
          {
            error: legacyMessages.reauthenticationRequired,
            errorCode: "reauthentication_required",
          },
          401,
        );
      if (await deletionProtected(current.user))
        return json(
          {
            error: legacyMessages.adminSelfDeletionProtected,
            errorCode: "deletion_protected",
          },
          403,
        );
    }
    const auth = await getAuthAdmin();
    if (
      !auth ||
      auth.projectUrl !== config.projectUrl ||
      auth.provider !== config.provider
    )
      return unavailable();
    const lookup = await auth.client.getUserById(grant.user_id);
    if (
      lookup.error &&
      lookup.error.status !== 404 &&
      lookup.error.code !== "not_found"
    )
      return unavailable();
    if (isBootstrapAccount(lookup.data.user?.email))
      return json(
        {
          error: legacyMessages.originalAdminProtected,
          errorCode: "deletion_protected",
        },
        403,
      );
    await startDeletion(grant);
    await deleteAccount(auth, grant.user_id);
    await clearDeletionGrant(grant);
    // Local tombstones and removed session grants deny any surviving provider JWT.
    try {
      await (await authClient(config)).signOut({ scope: "local" });
    } catch {}
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === "DELETION_FORBIDDEN")
      return json(
        {
          error: legacyMessages.adminSelfDeletionProtected,
          errorCode: "deletion_protected",
        },
        403,
      );
    logFailure("delete", e);
    return json(
      {
        error: legacyMessages.deletionIncomplete,
        errorCode: "deletion_incomplete",
      },
      503,
    );
  }
}
