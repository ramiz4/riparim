import { legacyMessages } from "@/lib/i18n/legacy-messages";
import { validAccountName } from "@/lib/account-name";
import { ValidationError } from "@/lib/validation-error";
import type { AuthUser as User } from "@/lib/auth/contract";
import type { AppUser } from "@/app/auth";
import { resolveProviderAccount } from "@/lib/auth/identities";
import { storage } from "@/db/storage";
import { providerBlocked } from "@/lib/auth/account-status";
import { isBootstrapAccount } from "@/lib/auth/roles";
import { json } from "@/lib/http";
import type { AccountRole, ManagedUser } from "@/lib/user-contract";

export async function protectedUser(
  user: User,
  admin: AppUser,
  config: { provider: string; projectUrl: string },
) {
  return (
    (await resolveProviderAccount(config, user.identity.subject)) ===
      admin.userId || isBootstrapAccount(user.email)
  );
}
export async function userView(
  user: User,
  admin: AppUser,
  config: { provider: string; projectUrl: string },
): Promise<ManagedUser> {
  const accountId = await resolveProviderAccount(config, user.identity.subject);
  const state = await storage()
    .db.prepare(
      "SELECT (SELECT status FROM auth_account_status WHERE account_id=?) AS status,(SELECT role FROM auth_account_roles WHERE account_id=?) AS role",
    )
    .bind(accountId, accountId)
    .first<{ status: string | null; role: string | null }>();
  return {
    id: user.identity.subject,
    email: user.email ?? "",
    name: typeof user.name === "string" ? user.name : "",
    role:
      isBootstrapAccount(user.email) || state?.role === "admin"
        ? "admin"
        : "user",
    active: !state?.status && !providerBlocked(user),
    confirmed: !!user.emailVerified,
    createdAt: user.createdAt ?? null,
    lastSignInAt: user.lastSignInAt ?? null,
    providers: [...new Set(user.loginProviders)],
    protected: await protectedUser(user, admin, config),
  };
}
export function validUserId(id: string) {
  return !!id && id.length <= 512 && !/[\s\x00-\x1f]/.test(id);
}
export function parseUserFields(
  body: Record<string, unknown>,
  creating = false,
) {
  const allowed = creating
    ? ["name", "email", "password", "active"]
    : ["name", "email", "password", "active", "role"];
  if (
    !Object.keys(body).length ||
    Object.keys(body).some((key) => !allowed.includes(key))
  )
    throw new ValidationError("invalid_request", legacyMessages.checkInputs);
  if (
    !creating &&
    ("active" in body || "role" in body) &&
    Object.keys(body).length !== 1
  )
    throw new ValidationError(
      "account_fields_separate",
      legacyMessages.accountFieldsSeparate,
    );
  const fields: {
    name?: string;
    email?: string;
    password?: string;
    active?: boolean;
    role?: AccountRole;
  } = {};
  if (creating || "name" in body) {
    const name = validAccountName(body.name);
    if (!name)
      throw new ValidationError("invalid_name", legacyMessages.invalidName);
    fields.name = name;
  }
  if (creating || "email" in body) {
    if (
      typeof body.email !== "string" ||
      body.email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
    )
      throw new ValidationError("invalid_email", legacyMessages.invalidEmail);
    fields.email = body.email.trim().toLowerCase();
  }
  if (creating || "password" in body) {
    if (
      typeof body.password !== "string" ||
      body.password.length < 12 ||
      body.password.length > 128
    )
      throw new ValidationError(
        "invalid_password",
        legacyMessages.invalidPassword,
      );
    fields.password = body.password;
  }
  if ("active" in body) {
    if (typeof body.active !== "boolean")
      throw new ValidationError(
        "account_status_invalid",
        legacyMessages.accountStatusInvalid,
      );
    fields.active = body.active;
  } else if (creating) fields.active = true;
  if ("role" in body) {
    if (body.role !== "admin" && body.role !== "user")
      throw new ValidationError(
        "account_role_invalid",
        legacyMessages.accountRoleInvalid,
      );
    fields.role = body.role;
  }
  return fields;
}
export function providerFailure(
  error: { code?: string; status?: number } | null,
) {
  if (error?.code === "email_exists")
    return json(
      {
        error: "Diese E-Mail-Adresse wird bereits verwendet.",
        errorCode: "user_email_exists",
      },
      409,
    );
  if (error?.code === "not_found" || error?.status === 404)
    return json(
      { error: "Benutzer nicht gefunden.", errorCode: "user_not_found" },
      404,
    );
  if (error?.code === "weak_password")
    return json(
      {
        error: legacyMessages.userPasswordWeak,
        errorCode: "user_password_weak",
      },
      400,
    );
  return json(
    {
      error: legacyMessages.usersUnavailable,
      errorCode: "users_unavailable",
    },
    503,
  );
}
export const notConfigured = () =>
  json(
    {
      error: legacyMessages.usersConfigurationMissing,
      errorCode: "users_configuration_missing",
    },
    503,
  );
