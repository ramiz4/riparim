import type { AuthScreenQuery } from "@/lib/auth/screen-query";
import { publicReleaseRender } from "@/lib/public-release";
import { DeferredAuth } from "@/components/deferred-auth";
import { I18nMessages } from "@/lib/i18n/client";
import { getMessages, createTranslator } from "@/lib/i18n/messages";
import { isLocale, localizeHref } from "@/lib/i18n/locale";
import AuthForm, { type AuthScreen } from "./auth-form";
import { getAdminUser, getAppUser } from "./auth";
import {
  getAuthConfig,
  safeReturnPath,
  providerAvailability,
} from "@/lib/auth/config";
import { isLocalDevelopmentRequest } from "@/lib/auth/local-development";
import { redirect } from "next/navigation";
export default async function AuthScreenPage({
  screen,
  query,
  params,
}: {
  params: Promise<{ locale: string }>;
  screen: AuthScreen;
  query: AuthScreenQuery;
}) {
  const { locale: value } = await params,
    locale = isLocale(value) ? value : "de";
  if (publicReleaseRender())
    return (
      <I18nMessages messages={getMessages(locale, ["customer"])}>
        <DeferredAuth screen={screen} />
      </I18nMessages>
    );
  const c = await getAuthConfig(),
    q = query,
    u = await getAppUser(),
    a = await getAdminUser(u),
    next = localizeHref(safeReturnPath(q.returnTo), locale);
  if (screen === "login" && c?.enabled && u) redirect(next);
  const localSeedLogin =
    screen === "login" && (await isLocalDevelopmentRequest());
  const available = await providerAvailability(c),
    messages = getMessages(locale, ["customer"]),
    t = createTranslator(messages);
  return (
    <I18nMessages messages={messages}>
      <AuthForm
        account={
          u
            ? {
                email: u.email,
                displayName: u.displayName,
                provider: u.provider,
              }
            : null
        }
        screen={screen}
        localSeedLogin={localSeedLogin}
        emailReady={
          screen === "register"
            ? available.emailSignup
            : screen === "recovery"
              ? available.emailRecovery
              : available.email
        }
        googleReady={available.google}
        isOwner={!!a?.isModerator}
        returnTo={next}
        notice={
          q.notice === "email-confirmed"
            ? t("customer.emailConfirmed")
            : q.notice === "password-changed"
              ? t("customer.passwordChanged")
              : undefined
        }
        errorHint={
          q.error === "confirmation"
            ? t("customer.invalidLink")
            : q.error === "google"
              ? t("customer.googleCancelled")
              : undefined
        }
      />
    </I18nMessages>
  );
}
