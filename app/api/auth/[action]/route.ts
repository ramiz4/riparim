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
      { error: "Ungültige Anfrage.", errorCode: "invalid_request" },
      403,
    );
  const { action } = await params;
  if (
    !["login", "register", "recovery", "reset", "logout", "google"].includes(
      action,
    )
  )
    return json(
      { error: "Ungültige Aktion.", errorCode: "invalid_request" },
      404,
    );
  let body: Record<string, unknown>;
  try {
    body = await readJson(request, 8192);
  } catch {
    return json(
      { error: "Bitte prüfe die Eingaben.", errorCode: "invalid_request" },
      400,
    );
  }
  const locale = requestLocale(body.locale);
  if (!locale)
    return json(
      { error: "Ungültige Sprache.", errorCode: "invalid_locale" },
      400,
    );
  try {
    const c = await getAuthConfig();
    if (!c?.enabled)
      return json(
        {
          error:
            "Die Anmeldung wird gerade eingerichtet. Bitte versuche es später erneut.",
          errorCode: "auth_unavailable",
        },
        503,
      );
    if (action === "recovery" && !c.emailDeliveryConfirmed)
      return json(
        {
          error:
            "Der E-Mail-Versand ist derzeit noch nicht verfügbar. Bitte versuche es später erneut.",
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
            error:
              "E-Mail-Anmeldung ist gerade nicht verfügbar. Bitte versuche es später erneut.",
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
            error: "Google-Anmeldung ist gerade nicht verfügbar.",
            errorCode: "google_unavailable",
          },
          503,
        );
      if (await rateLimit(request, action, ""))
        return json(
          {
            error: "Zu viele Versuche. Bitte warte einige Minuten.",
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
            error: "Dieses Konto kann hier nicht gelöscht werden.",
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
            error: "Google-Anmeldung ist gerade nicht verfügbar.",
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
            error:
              "Öffne zuerst den gültigen Link aus deiner E-Mail oder melde dich an.",
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
          error:
            "Zu viele Versuche. Bitte warte einige Minuten und versuche es erneut.",
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
            error: "Abmelden fehlgeschlagen. Bitte versuche es erneut.",
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
          error: "Bitte gib eine gültige E-Mail-Adresse ein.",
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
          error: "Bitte nutze ein Passwort mit 12 bis 128 Zeichen.",
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
            error:
              "Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort und bestätige deine E-Mail-Adresse.",
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
              error:
                "Dieses Konto ist gesperrt. Bitte wende dich an die Verwaltung.",
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
            error: "Bitte gib einen Namen mit 2 bis 80 Zeichen ein.",
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
              error:
                "Zu viele Registrierungsversuche. Bitte warte einige Minuten und versuche es erneut.",
              errorCode: "rate_limited",
            },
            429,
          );
        if (error.code === "email_unavailable")
          return json(
            {
              error:
                "Die Bestätigungs-E-Mail kann derzeit nicht gesendet werden. Bitte versuche es später erneut.",
              errorCode: "confirmation_unavailable",
            },
            503,
          );
        return json(
          {
            error:
              "Registrierung konnte gerade nicht abgeschlossen werden. Prüfe die Eingaben oder versuche es später erneut.",
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
            error:
              "Die E-Mail-Bestätigung ist gerade nicht verfügbar. Bitte versuche es später erneut.",
            errorCode: "confirmation_unavailable",
          },
          503,
        );
      }
      if (!data.user)
        return json(
          {
            error:
              "Die Registrierung konnte gerade nicht abgeschlossen werden. Bitte versuche es später erneut.",
            errorCode: "registration_failed",
          },
          503,
        );
      return json({
        message:
          "Prüfe dein Postfach und bestätige deine E-Mail-Adresse. Danach kannst du dich anmelden.",
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
            error:
              "Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut.",
            errorCode: "recovery_failed",
          },
          503,
        );
      return json({
        message:
          "Wenn ein Konto existiert, erhältst du einen Link zum Zurücksetzen.",
        messageCode: "recovery_sent",
      });
    }
    if (!(await client.recoveryReady()))
      return json(
        {
          error: "Bitte öffne einen gültigen Wiederherstellungslink.",
          errorCode: "recovery_required",
        },
        401,
      );
    const { data: updated, error } = await client.resetPassword(password);
    if (error)
      return json(
        {
          error:
            "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.",
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
      message: "Dein Passwort wurde geändert. Bitte melde dich erneut an.",
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
        error:
          "Die Anmeldung ist gerade nicht verfügbar. Bitte versuche es später erneut.",
        errorCode: "auth_unavailable",
      },
      503,
    );
  }
}
