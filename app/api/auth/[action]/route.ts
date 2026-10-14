import { legacyMessages } from "@/lib/i18n/legacy-messages";
import { validAccountName } from "@/lib/account-name";
import {
  requestLocale,
  localizedReturnPath,
  authCallbackUrl,
} from "@/lib/auth/locale";
import { localizeHref } from "@/lib/i18n/locale";
import {
  getAuthConfig,
  siteOrigin,
  providerAvailability,
} from "@/lib/auth/config";
import { resolveProviderAccount, resolveAccount } from "@/lib/auth/identities";
import { authClient } from "@/lib/auth/client";
import {
  getAppUser,
  recordPasswordSession,
  revokeCurrentSession,
} from "@/app/auth";
import { json, readJson, sameOrigin } from "@/lib/http";
import { storage } from "@/db/storage";
import { cookies } from "next/headers";
import { accountBlocked, providerBlocked } from "@/lib/auth/account-status";
import { rateLimit } from "@/lib/auth/rate-limit";
import { deletionProtected } from "@/lib/auth/deletion-grant";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  if (
    !sameOrigin(request) ||
    !request.headers.get("content-type")?.includes("application/json")
  )
    return json(
      { error: legacyMessages.invalidRequest, errorCode: "invalid_request" },
      403,
    );
  const { action } = await params;
  if (
    !["login", "register", "recovery", "reset", "logout", "google"].includes(
      action,
    )
  )
    return json(
      { error: legacyMessages.invalidAction, errorCode: "invalid_request" },
      404,
    );
  let body: Record<string, unknown>;
  try {
    body = await readJson(request, 8192);
  } catch {
    return json(
      { error: legacyMessages.checkInputs, errorCode: "invalid_request" },
      400,
    );
  }
  const locale = requestLocale(body.locale);
  if (!locale)
    return json(
      { error: legacyMessages.invalidLocale, errorCode: "invalid_locale" },
      400,
    );
  try {
    const c = await getAuthConfig();
    if (!c?.enabled)
      return json(
        {
          error: legacyMessages.authSetupPending,
          errorCode: "auth_unavailable",
        },
        503,
      );
    if (action === "recovery" && !c.emailDeliveryConfirmed)
      return json(
        {
          error: legacyMessages.emailDeliveryUnavailable,
          errorCode: "email_unavailable",
        },
        503,
      );
    if (["login", "register", "recovery", "reset"].includes(action)) {
      const ready = await providerAvailability(c),
        available =
          action === "register"
            ? ready.emailSignup
            : action === "recovery"
              ? ready.emailRecovery
              : ready.email;
      if (!available)
        return json(
          {
            error: legacyMessages.emailLoginUnavailable,
            errorCode: "email_unavailable",
          },
          503,
        );
    }
    const client = await authClient(c);
    if (action === "google") {
      if (!(await providerAvailability(c)).google)
        return json(
          {
            error: legacyMessages.googleUnavailable,
            errorCode: "google_unavailable",
          },
          503,
        );
      if (await rateLimit(request, action, ""))
        return json(
          {
            error: legacyMessages.rateLimited,
            errorCode: "rate_limited",
          },
          429,
        );
      const reauth = body.reauthenticate === true;
      const current = reauth ? await getAppUser() : null;
      if (
        reauth &&
        (!current ||
          current.provider !== "Google" ||
          (await deletionProtected(current)))
      )
        return json(
          {
            error: legacyMessages.selfDeletionProtected,
            errorCode: "deletion_protected",
          },
          403,
        );
      const flow = crypto.randomUUID(),
        next = reauth
          ? localizeHref("/einstellungen", locale)
          : localizedReturnPath(body.returnTo, siteOrigin(), locale);
      const callback = authCallbackUrl(siteOrigin(), locale, next, {
        anbieter: "google",
        fluss: flow,
      });
      const { data, error } = await client.beginGoogle(callback);
      if (error || !data.url)
        return json(
          {
            error: legacyMessages.googleUnavailable,
            errorCode: "google_unavailable",
          },
          503,
        );
      const local = ["localhost", "127.0.0.1"].includes(
        new URL(request.url).hostname,
      );
      (await cookies()).set("riparim-google-flow", flow, {
        httpOnly: true,
        secure: !local,
        sameSite: "lax",
        path: "/auth/bestaetigen",
        maxAge: 600,
      });
      if (reauth)
        (await cookies()).set(
          "riparim-deletion-flow",
          JSON.stringify({
            flow,
            accountId: current!.userId,
            expiresAt: Date.now() + 600000,
          }),
          {
            httpOnly: true,
            secure: !local,
            sameSite: "lax",
            path: "/auth/bestaetigen",
            maxAge: 600,
          },
        );
      else
        (await cookies()).set("riparim-deletion-flow", "", {
          httpOnly: true,
          secure: !local,
          sameSite: "lax",
          path: "/auth/bestaetigen",
          maxAge: 0,
        });
      return json({ url: data.url });
    }
    let resetUser = null;
    if (action === "reset") {
      const {
        data: { user },
        error,
      } = await client.getUser();
      if (
        !(await client.recoveryReady()) ||
        (user &&
          (error ||
            !user.emailVerified ||
            providerBlocked(user) ||
            (await accountBlocked(
              await resolveProviderAccount(c, user.identity.subject),
            ))))
      )
        return json(
          {
            error: legacyMessages.recoveryLinkOrLoginRequired,
            errorCode: "recovery_required",
          },
          401,
        );
      resetUser = user;
    }
    const rateIdentity = resetUser
      ? await resolveProviderAccount(c, resetUser.identity.subject)
      : String(body.email ?? "")
          .trim()
          .toLowerCase();
    if (action !== "logout" && (await rateLimit(request, action, rateIdentity)))
      return json(
        {
          error: legacyMessages.retryRateLimited,
          errorCode: "rate_limited",
        },
        429,
      );
    if (action === "logout") {
      await revokeCurrentSession(client);
      const { error } = await client.signOut({ scope: "local" });
      if (error)
        return json(
          {
            error: legacyMessages.logoutFailed,
            errorCode: "unknown",
          },
          503,
        );
      return json({ returnTo: localizeHref("/anmelden", locale) });
    }
    const email = String(body.email ?? "")
        .trim()
        .toLowerCase(),
      password = String(body.password ?? ""),
      next = localizedReturnPath(body.returnTo, siteOrigin(), locale);
    if (
      ["login", "register", "recovery"].includes(action) &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    )
      return json(
        {
          error: legacyMessages.invalidEmail,
          errorCode: "invalid_email",
        },
        400,
      );
    if (
      ["register", "reset"].includes(action) &&
      (password.length < 12 || password.length > 128)
    )
      return json(
        {
          error: legacyMessages.invalidPassword,
          errorCode: "invalid_password",
        },
        400,
      );
    if (action === "login") {
      const { data, error } = await client.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user?.emailVerified)
        return json(
          {
            error: legacyMessages.loginFailed,
            errorCode: "login_failed",
          },
          401,
        );
      try {
        await recordPasswordSession(data.user, client);
      } catch (e) {
        await client.signOut({ scope: "local" });
        if (e instanceof Error && e.message === "ACCOUNT_DISABLED")
          return json(
            {
              error: legacyMessages.accountBlockedContactAdmin,
              errorCode: "account_blocked",
            },
            403,
          );
        throw e;
      }
      return json({ returnTo: next });
    }
    if (action === "register") {
      const name = validAccountName(body.name);
      if (!name)
        return json(
          {
            error: legacyMessages.invalidName,
            errorCode: "invalid_name",
          },
          400,
        );
      const { data, error } = await client.signUp({
        email,
        password,
        name,
        preferredLocale: locale,
        redirectTo: authCallbackUrl(siteOrigin(), locale, next),
      });
      if (error) {
        if (error.status === 429 || error.code === "rate_limited")
          return json(
            {
              error: legacyMessages.registrationRateLimited,
              errorCode: "rate_limited",
            },
            429,
          );
        if (error.code === "email_unavailable")
          return json(
            {
              error: legacyMessages.confirmationDeliveryUnavailable,
              errorCode: "confirmation_unavailable",
            },
            503,
          );
        return json(
          {
            error: legacyMessages.registrationCheckInputs,
            errorCode: "registration_failed",
          },
          error.status && error.status >= 500 ? 503 : 400,
        );
      }
      // Signup never grants access before email confirmation and a separate login.
      if (data.session) {
        await client.signOut({ scope: "local" });
        return json(
          {
            error: legacyMessages.confirmationUnavailable,
            errorCode: "confirmation_unavailable",
          },
          503,
        );
      }
      if (!data.user)
        return json(
          {
            error: legacyMessages.registrationFailed,
            errorCode: "registration_failed",
          },
          503,
        );
      return json({
        message: legacyMessages.confirmationSent,
        messageCode: "confirm_email",
      });
    }
    if (action === "recovery") {
      const { error } = await client.requestRecovery(
        email,
        authCallbackUrl(siteOrigin(), locale, "/passwort-neu"),
      );
      if (error)
        return json(
          {
            error: legacyMessages.recoveryFailed,
            errorCode: "recovery_failed",
          },
          503,
        );
      return json({
        message: legacyMessages.recoverySent,
        messageCode: "recovery_sent",
      });
    }
    if (!(await client.recoveryReady()))
      return json(
        {
          error: legacyMessages.recoveryLinkRequired,
          errorCode: "recovery_required",
        },
        401,
      );
    const { data: updated, error } = await client.resetPassword(password);
    if (error)
      return json(
        {
          error: legacyMessages.passwordUpdateFailed,
          errorCode: "password_update_failed",
        },
        400,
      );
    await storage()
      .db.prepare("UPDATE auth_sessions SET revoked=1 WHERE account_id=?")
      .bind(await resolveAccount(updated.identity!))
      .run();
    await client.signOut({ scope: "global" });
    return json({
      message: legacyMessages.passwordUpdated,
      messageCode: "password_changed",
      returnTo: localizeHref("/anmelden?hinweis=passwort-geaendert", locale),
    });
  } catch (e) {
    console.error(
      "auth-action-unavailable",
      e instanceof Error ? e.name : "unknown",
    );
    return json(
      {
        error: legacyMessages.authUnavailable,
        errorCode: "auth_unavailable",
      },
      503,
    );
  }
}
