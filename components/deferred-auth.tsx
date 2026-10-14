"use client";
import { parseAuthScreenQuery } from "@/lib/auth/screen-query";
import { DeferredStatus } from "./deferred-status";
import { useEffect, useState } from "react";
import { usePageQuery } from "./use-page-query";
import { useI18n } from "@/lib/i18n/client";
import { localizeHref } from "@/lib/i18n/locale";
import { validatedReturnPath } from "@/lib/auth/return-path";
import { useDeferredSession } from "./use-deferred-session";
import { SiteHeader } from "./site-header";
import AuthForm, {
  authPageClassName,
  authCardClassName,
  authTitleClassName,
  type AuthScreen,
} from "@/app/auth-form";

type Options = {
  enabled: boolean;
  email: boolean;
  emailSignup: boolean;
  emailRecovery: boolean;
  google: boolean;
};
export function DeferredAuth({ screen }: { screen: AuthScreen }) {
  const { locale, t } = useI18n(),
    query = parseAuthScreenQuery(usePageQuery()),
    {
      session,
      error: sessionError,
      pending: sessionPending,
      retry: retrySession,
    } = useDeferredSession();
  const [options, setOptions] = useState<Options | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0),
    [optionsPending, setOptionsPending] = useState(true);
  useEffect(() => {
    let active = true;
    void fetch("/api/auth-options", { cache: "no-store" })
      .then(async (response) => {
        const value: unknown = await response.json();
        if (
          !response.ok ||
          !value ||
          typeof value !== "object" ||
          ["enabled", "email", "emailSignup", "emailRecovery", "google"].some(
            (key) =>
              typeof (value as Record<string, unknown>)[key] !== "boolean",
          )
        )
          throw Error("Auth options unavailable");
        if (active) {
          setOptions(value as Options);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setOptionsPending(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const destination = localizeHref(
    validatedReturnPath(
      query.returnTo,
      typeof window === "undefined"
        ? "https://riparim.com"
        : window.location.origin,
    ),
    locale,
  );
  useEffect(() => {
    if (screen === "login" && options?.enabled && session?.account)
      window.location.replace(destination);
  }, [screen, options, session, destination]);
  const headings = {
    login: t("customer.authLogin"),
    register: t("customer.authRegister"),
    recovery: t("customer.authRecovery"),
    reset: t("customer.authReset"),
  };
  if (!session || !options)
    return (
      <>
        <SiteHeader
          account={session?.account ?? null}
          isAdmin={session?.isAdmin ?? false}
          publicSnapshot={!session}
        />
        <main className={authPageClassName} data-ui="auth-page">
          <section
            className={authCardClassName}
            data-ui="auth-card auth-compact"
          >
            <h1 className={authTitleClassName}>{headings[screen]}</h1>
            <DeferredStatus
              error={error || sessionError}
              pending={sessionPending || optionsPending}
              retry={() => {
                setOptionsPending(true);
                setAttempt((value) => value + 1);
                retrySession();
              }}
            />
          </section>
        </main>
      </>
    );
  return (
    <AuthForm
      screen={screen}
      account={session.account}
      emailReady={
        screen === "register"
          ? options.emailSignup
          : screen === "recovery"
            ? options.emailRecovery
            : options.email
      }
      googleReady={options.google}
      isOwner={session.isAdmin}
      returnTo={destination}
      notice={
        query.notice === "email-confirmed"
          ? t("customer.emailConfirmed")
          : query.notice === "password-changed"
            ? t("customer.passwordChanged")
            : undefined
      }
      errorHint={
        query.error === "confirmation"
          ? t("customer.invalidLink")
          : query.error === "google"
            ? t("customer.googleCancelled")
            : undefined
      }
    />
  );
}
