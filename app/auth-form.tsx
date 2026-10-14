"use client";
import { accountNameMinLength, accountNameMaxLength } from "@/lib/account-name";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import {
  appButton,
  errorClassName,
  helpTextClassName,
} from "@/lib/presentation";

import {
  responseError,
  LocalizedError,
  messageCodeMessage,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { LocaleAnchor } from "@/components/locale-anchor";
import { useId, useState, type FormEvent } from "react";
import { Mail, LockKeyhole, LoaderCircle, Eye, EyeOff } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { invalidatePublicSession } from "@/components/use-public-session";
import type { AccountIdentity } from "@/components/account-storage-notice";

export const authPageClassName =
  "mx-auto w-[min(980px,calc(100%_-_2_*_var(--page-gutter)))] max-w-[980px] pt-[35px] pb-[65px] at-most-720:pt-[25px] at-most-720:pb-7";
export const authCardClassName =
  "mx-auto max-w-[430px] rounded-2xl border border-[#dce6e8] bg-white p-[30px] shadow-[0_12px_38px_#153e3e0b] dark:border-border dark:bg-card dark:text-foreground at-most-720:px-[23px] at-most-720:py-[25px]";
export const authTitleClassName =
  "mt-0 mb-[9px] text-[29px] leading-[1.15] font-[650] tracking-[-0.7px] text-[#183337] dark:text-foreground at-most-720:text-[27px]";
const authLabelClassName =
  "block text-[13px] font-semibold text-[#29474d] dark:text-foreground";
const authInputClassName =
  "mt-1.5 block w-full rounded-[7px] border border-[#d8e1db] bg-white px-3 py-2.5 text-[16px] font-normal text-[#233d2e] outline-offset-2 focus:outline-2 focus:outline-[#35866a] disabled:bg-[#f6f8f8] disabled:text-[#7b8c8d] dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-[#8da7a7] dark:focus:outline-ring dark:disabled:bg-secondary dark:disabled:text-muted-foreground";

export type AuthScreen = "login" | "register" | "recovery" | "reset";
type Props = {
  account: AccountIdentity | null;
  screen: AuthScreen;
  emailReady: boolean;
  googleReady: boolean;
  isOwner: boolean;
  returnTo: string;
  errorHint?: string;
  notice?: string;
  localSeedLogin?: boolean;
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.1h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15.1Z"
      />
      <path
        fill="#34A853"
        d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"
      />
      <path
        fill="#FBBC05"
        d="M12.6 27.5a12 12 0 0 1 0-7V15.2H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z"
      />
      <path
        fill="#EA4335"
        d="M24 12.1c3 0 5.7 1 7.8 3l5.9-5.9A19.6 19.6 0 0 0 24 4 20 20 0 0 0 5.8 15.2l6.8 5.3c1.6-4.8 6.1-8.4 11.4-8.4Z"
      />
    </svg>
  );
}

export default function AuthForm({
  screen,
  emailReady,
  googleReady,
  isOwner,
  returnTo,
  errorHint,
  notice,
  account,
  localSeedLogin = false,
}: Props) {
  const { locale, t } = useI18n(),
    nameId = useId();
  const headings: Record<AuthScreen, string> = {
    login: t("customer.authLogin"),
    register: t("customer.authRegister"),
    recovery: t("customer.authRecovery"),
    reset: t("customer.authReset"),
  };
  const [error, setError] = useState(errorHint ?? ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState<"email" | "google" | null>(null),
    [showPassword, setShowPassword] = useState(false);
  const [dirty, setDirty] = useState(false);
  useNavigationGuard({ dirty: dirty && !message, busy: !!busy });
  const social = screen === "login" || screen === "register";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!emailReady || busy) return;
    const f = new FormData(e.currentTarget);
    if (screen === "reset" && f.get("password") !== f.get("passwordRepeat")) {
      setError(t("customer.passwordMismatch"));
      return;
    }
    setBusy("email");
    setError("");
    let navigating = false;
    try {
      const r = await fetch(`/api/auth/${screen}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          ...(screen === "register" ? { name: f.get("name") } : {}),
          email: f.get("email"),
          password: f.get("password"),
          returnTo,
        }),
      });
      const d = (await r.json()) as CodedResponse & { returnTo?: string };
      if (!r.ok) throw responseError(t, d);
      if (d.returnTo) {
        if (screen === "login") invalidatePublicSession({ signedIn: true });
        else if (screen === "reset")
          invalidatePublicSession({ signedOut: true });
        navigating = true;
        window.location.assign(d.returnTo);
      } else setMessage(messageCodeMessage(t, d.messageCode));
    } catch (e) {
      navigating = false;
      setError(
        e instanceof LocalizedError ? e.message : t("customer.tryAgain"),
      );
    } finally {
      if (!navigating) setBusy(null);
    }
  }
  async function google() {
    if (!googleReady || busy) return;
    setBusy("google");
    setError("");
    try {
      const r = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, returnTo }),
      });
      const d = (await r.json()) as CodedResponse & { url?: string };
      if (!r.ok || !d.url) throw responseError(t, d);
      window.location.assign(d.url);
    } catch (e) {
      setError(
        e instanceof LocalizedError ? e.message : t("customer.tryAgain"),
      );
      setBusy(null);
    }
  }
  return (
    <>
      <SiteHeader account={account} isAdmin={isOwner} />
      <main className={authPageClassName} data-ui="auth-page">
        <section
          className={authCardClassName}
          data-ui="auth-card auth-compact"
          aria-labelledby="auth-title"
        >
          <h1 className={authTitleClassName} id="auth-title">
            {headings[screen]}
          </h1>
          <p className="mt-0 mb-6 text-[14px] leading-[1.5] text-[#596b70] dark:text-muted-foreground">
            {screen === "login"
              ? t("customer.loginIntro")
              : screen === "register"
                ? t("customer.registerIntro")
                : screen === "recovery"
                  ? t("customer.recoveryIntro")
                  : t("customer.resetIntro")}
          </p>
          {screen === "login" && localSeedLogin && (
            <div className="mb-6">
              <a
                className={cn(
                  appButton(),
                  "flex w-full text-[14px] no-underline",
                )}
                href={`/dev/anmelden?weiter=${encodeURIComponent(returnTo)}`}
              >
                {t("customer.localSeedLogin")}
              </a>
              <p className="mt-2 text-center text-[12px] leading-[1.5] text-muted-foreground">
                {t("customer.localSeedLoginNote")}
              </p>
            </div>
          )}
          {notice && (
            <p
              className="mb-4 rounded-lg bg-[#eef6e9] px-[15px] py-3 text-[14px] text-[#527d4d] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
              role="status"
            >
              {notice}
            </p>
          )}
          {message ? (
            <div
              className="flex flex-col gap-[15px] rounded-[9px] border border-[#dbe9e3] bg-[#f1f7f5] p-[18px] dark:border-border dark:bg-accent dark:text-[var(--theme-positive)]"
              role="status"
              data-ui="auth-success"
            >
              <Mail
                className="text-[#5c8b55] dark:text-[var(--theme-positive)]"
                size={24}
              />
              <p className="text-[14px] leading-[1.7] text-[#738569] dark:text-muted-foreground">
                {message}
              </p>
              <LocaleAnchor
                className={appButton({ variant: "outline" })}
                href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}
              >
                {t("customer.backLogin")}
              </LocaleAnchor>
            </div>
          ) : (
            <>
              {social && (
                <>
                  <button
                    className="flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-[11px] rounded-lg border border-[#b8c8cc] bg-white text-[14px] font-semibold text-[#233d42] enabled:hover:border-[#587b7a] enabled:hover:bg-[#f4f8f8] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[#80b5ae] dark:focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-55 dark:border-input dark:bg-card dark:text-foreground dark:enabled:hover:border-ring dark:enabled:hover:bg-[var(--theme-hover)]"
                    data-ui="auth-google"
                    type="button"
                    disabled={!googleReady || !!busy}
                    onClick={() => void google()}
                  >
                    {busy === "google" ? (
                      <LoaderCircle
                        className="inline-block animate-spin motion-reduce:animate-none"
                        size={20}
                      />
                    ) : (
                      <GoogleMark />
                    )}
                    {t("customer.googleContinue")}
                  </button>
                  {!googleReady && (
                    <p className="mt-[9px] mb-0 text-center text-[12px] leading-[1.5] text-[#73878b] dark:text-muted-foreground">
                      {t("customer.googleSetup")}
                    </p>
                  )}
                  <div className="my-[22px] flex items-center gap-3 text-[12px] text-[#829296] before:h-px before:flex-1 before:bg-[#e1e9ea] before:content-[''] after:h-px after:flex-1 after:bg-[#e1e9ea] after:content-[''] dark:text-muted-foreground dark:before:bg-border dark:after:bg-border">
                    <span>{t("customer.orEmail")}</span>
                  </div>
                </>
              )}
              <form
                onChange={() => setDirty(true)}
                onSubmit={submit}
                className="mt-0 flex flex-col gap-4"
                data-ui="auth-email-form"
              >
                {screen === "register" && (
                  <div>
                    <label className="block text-[14px] font-semibold text-[#40594b] dark:text-foreground">
                      {t("customer.displayName")}
                      <input
                        className={authInputClassName}
                        name="name"
                        autoComplete="nickname"
                        required
                        minLength={accountNameMinLength}
                        maxLength={accountNameMaxLength}
                        placeholder={t("customer.nameExample")}
                        aria-describedby={`${nameId}-help`}
                        disabled={!emailReady || !!busy}
                      />
                    </label>
                    <p id={`${nameId}-help`} className={helpTextClassName}>
                      {t("customer.registrationNameNote")}
                    </p>
                  </div>
                )}
                {screen !== "reset" && (
                  <label className={authLabelClassName}>
                    {t("customer.email")}
                    <input
                      className={authInputClassName}
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      placeholder={t("customer.emailPlaceholder")}
                      disabled={!emailReady || !!busy}
                    />
                  </label>
                )}
                {screen !== "recovery" && (
                  <label className={authLabelClassName}>
                    <span className="m-0 flex items-center justify-between text-[13px] font-normal text-[#829084] dark:text-muted-foreground">
                      {t("customer.password")}
                      {screen === "login" && (
                        <LocaleAnchor
                          className="text-[12px] font-medium text-[#0b7164] dark:text-[var(--theme-accent)]"
                          href="/passwort-vergessen"
                        >
                          {t("customer.forgot")}
                        </LocaleAnchor>
                      )}
                    </span>
                    <span className="relative block font-normal text-[#829084] dark:text-muted-foreground">
                      <input
                        className={cn(authInputClassName, "pr-[45px]")}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={
                          screen === "login"
                            ? "current-password"
                            : "new-password"
                        }
                        required
                        minLength={screen === "login" ? 1 : 12}
                        maxLength={128}
                        placeholder={
                          screen === "login"
                            ? t("customer.yourPassword")
                            : t("customer.passwordMinimum")
                        }
                        disabled={!emailReady || !!busy}
                      />
                      <button
                        className="absolute top-0 right-0 grid h-full w-[42px] cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[#687e83] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[#80b5ae] dark:focus-visible:outline-ring dark:text-muted-foreground"
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword
                            ? t("customer.hidePassword")
                            : t("customer.showPassword")
                        }
                        aria-pressed={showPassword}
                        disabled={!emailReady}
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </span>
                  </label>
                )}
                {screen === "reset" && (
                  <label className={authLabelClassName}>
                    {t("customer.repeatPassword")}
                    <input
                      className={authInputClassName}
                      name="passwordRepeat"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                      disabled={!emailReady || !!busy}
                    />
                  </label>
                )}
                <button
                  className={cn(appButton(), "w-full text-[14px]")}
                  disabled={!emailReady || !!busy}
                  type="submit"
                >
                  {busy === "email" ? (
                    <>
                      <LoaderCircle
                        className="inline-block animate-spin motion-reduce:animate-none"
                        size={17}
                      />
                      {t("customer.oneMoment")}
                    </>
                  ) : screen === "login" ? (
                    t("customer.authLogin")
                  ) : screen === "register" ? (
                    t("customer.authRegister")
                  ) : screen === "recovery" ? (
                    t("customer.sendLink")
                  ) : (
                    t("customer.savePassword")
                  )}
                </button>
                {!emailReady && (
                  <p className="mt-[9px] mb-0 text-center text-[12px] leading-[1.5] text-[#73878b] dark:text-muted-foreground">
                    {screen === "register"
                      ? t("customer.registrationSetup")
                      : screen === "recovery"
                        ? t("customer.recoverySetup")
                        : t("customer.emailSetup")}
                  </p>
                )}
              </form>
              {error && (
                <p
                  className={cn(errorClassName, "mt-3.5 text-[13px]")}
                  role="alert"
                >
                  {error}
                </p>
              )}
              <p className="mt-[21px] mb-0 text-center text-[13px] leading-[1.7] text-[#61767b] dark:text-muted-foreground">
                {screen === "login" ? (
                  <>
                    {t("customer.noAccount")}{" "}
                    <LocaleAnchor
                      className="font-semibold text-[#086e61] underline dark:text-[var(--theme-accent)]"
                      href={`/registrieren?weiter=${encodeURIComponent(returnTo)}`}
                    >
                      {t("customer.register")}
                    </LocaleAnchor>
                  </>
                ) : screen === "register" ? (
                  <>
                    {t("customer.hasAccount")}{" "}
                    <LocaleAnchor
                      className="font-semibold text-[#086e61] underline dark:text-[var(--theme-accent)]"
                      href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}
                    >
                      {t("customer.authLogin")}
                    </LocaleAnchor>
                  </>
                ) : (
                  <LocaleAnchor
                    className="font-semibold text-[#086e61] underline dark:text-[var(--theme-accent)]"
                    href="/anmelden"
                  >
                    {t("customer.backLogin")}
                  </LocaleAnchor>
                )}
              </p>
            </>
          )}
          <div className="mt-[22px] flex items-center justify-center gap-[7px] border-t border-[#e2e8dd] pt-4 dark:border-border">
            <LockKeyhole className="m-0 text-[#65847c]" size={14} />
            <p className="text-[12px] leading-[1.4] text-[#73878b] dark:text-muted-foreground">
              {t("customer.privateReceipts")}{" "}
              <LocaleAnchor
                className="text-[14px] text-[var(--theme-accent)] underline underline-offset-[3px]"
                href="/datenschutz"
              >
                {t("customer.privacy")}
              </LocaleAnchor>
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
