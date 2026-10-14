"use client";
import {
  dialogHeaderClassName,
  dialogTitleClassName,
  dialogDescriptionClassName,
  dialogFooterClassName,
  confirmationCancelClassName,
  appButton,
  confirmationDialogClassName,
} from "@/lib/presentation";
import { cn } from "@/lib/utils";

import { invalidatePublicSession } from "./use-public-session";
import { useI18n } from "@/lib/i18n/client";
import {
  responseError,
  LocalizedError,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";

import {
  deletePhrases,
  deleteConfirmation,
} from "@/lib/i18n/delete-confirmation";
import { valueLabel } from "@/lib/i18n/values";
import Link from "@/components/locale-link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { Save, LoaderCircle } from "lucide-react";
import { validAccountName } from "@/lib/account-name";
import type { LocalSettingsPreview } from "@/lib/auth/local-seed";
import { LocaleAnchor } from "./locale-anchor";
import { Dialog, DialogClose } from "./ui/dialog";
import { ModalContent, ModalBody } from "./modal-shell";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const accountSectionClassName =
  "mt-7 min-w-0 rounded-none border-0 border-t border-[color-mix(in_srgb,var(--foreground)_28%,var(--background))] bg-transparent pt-7 [overflow-wrap:anywhere] at-most-720:mt-6 at-most-720:pt-6";
const accountButtonClassName =
  "inline-flex min-h-11 cursor-pointer items-center justify-center justify-self-start gap-2 rounded-lg border border-input bg-card px-4 py-2.5 text-[14px] font-semibold text-foreground no-underline enabled:hover:border-[var(--theme-accent)] enabled:hover:bg-[var(--theme-hover)] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)] disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 at-most-720:max-w-full at-most-720:whitespace-normal";

type Account = {
  email: string;
  name: string;
  provider: string;
  protected: boolean;
};
type AccountState = CodedResponse & {
  account: Account | null;
  deletionReady: boolean;
  deletionStarted: boolean;
  error?: string;
  preview?: boolean;
};

function previewState(account: LocalSettingsPreview): AccountState {
  return {
    account: {
      email: account.email,
      name: account.name,
      provider: account.provider,
      protected: account.protected,
    },
    preview: true,
    deletionReady: false,
    deletionStarted: false,
  };
}
export function AccountSettings({
  localPreviewAccount,
  appearance,
}: {
  localPreviewAccount?: LocalSettingsPreview;
  appearance?: ReactNode;
} = {}) {
  const { locale, t } = useI18n(),
    phrase = deletePhrases[locale],
    networkError = t("customer.accountNetwork");
  const id = useId(),
    router = useRouter();
  const [state, setState] = useState<AccountState | null>(
      localPreviewAccount ? previewState(localPreviewAccount) : null,
    ),
    [name, setName] = useState(localPreviewAccount?.name ?? ""),
    [password, setPassword] = useState("");
  const [loading, setLoading] = useState(!localPreviewAccount),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const accountHeading = useRef<HTMLHeadingElement>(null),
    focusAfterDeletion = useRef(false);
  const previewPasswordOpener = useRef<HTMLButtonElement>(null),
    confirmationInput = useRef<HTMLInputElement>(null);
  const ready = !!state && (state.deletionReady || state.deletionStarted);
  const [previewPasswordOpen, setPreviewPasswordOpen] = useState(false),
    [previewPasswordError, setPreviewPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState(""),
    [passwordError, setPasswordError] = useState("");
  useNavigationGuard({
    busy,
    dirty:
      !!password ||
      !!confirmation ||
      (!!state?.account && name !== state.account.name),
  });
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (localPreviewAccount) {
        setState(previewState(localPreviewAccount));
        setName(localPreviewAccount.name);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/account", {
            cache: "no-store",
            signal,
          }),
          data = (await response.json()) as AccountState;
        if (!response.ok) throw responseError(t, data);
        if (signal?.aborted) return;
        setState(data);
        setName(data.account?.name ?? "");
        if (data.deletionReady || data.deletionStarted) setOpen(true);
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof TypeError
              ? networkError
              : e instanceof LocalizedError
                ? e.message
                : networkError,
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [t, networkError, localPreviewAccount],
  );
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load only the authenticated account, including an interrupted deletion, on mount.
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    if (open && ready) confirmationInput.current?.focus();
  }, [open, ready]);
  useEffect(() => {
    if (!focusAfterDeletion.current || state?.account || state?.deletionStarted)
      return;
    focusAfterDeletion.current = false;
    // Radix first attempts to restore the now-removed delete trigger. Give the
    // completed action a persistent target, without overriding later user focus.
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body || !active.isConnected)
        accountHeading.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [state?.account, state?.deletionStarted, message]);

  async function mutate(
    method: string,
    body: Record<string, unknown>,
    url = "/api/account",
  ): Promise<CodedResponse & { name?: string; url?: string; ok?: boolean }> {
    // Preview props come only from a development request for the verified seed
    // identity. Simulated actions never reach account APIs or Auth providers.
    if (localPreviewAccount) {
      if (method === "PATCH") {
        const next = validAccountName(body.name);
        if (!next) throw new LocalizedError(t("customer.invalidName"));
        return { name: next };
      }
      if (localPreviewAccount.kind === "admin")
        throw new Error("Protected preview account");
      return { ok: true };
    }
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as CodedResponse & {
      name?: string;
      url?: string;
      ok?: boolean;
    };
    if (!response.ok) throw responseError(t, data);
    return data;
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await mutate("PATCH", { name });
      setState((old) =>
        old?.account
          ? { ...old, account: { ...old.account, name: data.name! } }
          : old,
      );
      setName(data.name!);
      setMessage(t("customer.nameSaved"));
      if (!localPreviewAccount) {
        invalidatePublicSession({ displayName: data.name });
        router.refresh();
      }
    } catch (e) {
      setError(
        e instanceof TypeError
          ? networkError
          : e instanceof LocalizedError
            ? e.message
            : networkError,
      );
    } finally {
      setBusy(false);
    }
  }
  async function requestPasswordLink() {
    if (
      busy ||
      !state?.account ||
      localPreviewAccount?.kind === "admin" ||
      state.account.provider !== "E-Mail"
    )
      return;
    setBusy(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      await mutate(
        "POST",
        { email: state.account.email, locale },
        "/api/auth/recovery",
      );
      setPasswordMessage(
        t(
          localPreviewAccount
            ? "customer.previewPasswordLinkSent"
            : "customer.passwordLinkSent",
        ),
      );
    } catch (e) {
      setPasswordError(
        e instanceof TypeError
          ? networkError
          : e instanceof LocalizedError
            ? e.message
            : networkError,
      );
    } finally {
      setBusy(false);
    }
  }
  async function reauthenticate() {
    if (busy || !state?.account) return;
    setBusy(true);
    setError("");
    setMessage("");
    let navigating = false;
    try {
      if (state.account.provider === "Google" && !localPreviewAccount) {
        const data = await mutate(
          "POST",
          { locale, reauthenticate: true },
          "/api/auth/google",
        );
        navigating = true;
        window.location.assign(data.url!);
      } else {
        await mutate("POST", { password });
        setPassword("");
        setState((old) => (old ? { ...old, deletionReady: true } : old));
      }
    } catch (e) {
      navigating = false;
      setPassword("");
      setError(
        e instanceof TypeError
          ? networkError
          : e instanceof LocalizedError
            ? e.message
            : networkError,
      );
    } finally {
      if (!navigating) setBusy(false);
    }
  }
  async function remove() {
    if (
      busy ||
      !deleteConfirmation(locale, confirmation) ||
      (!state?.deletionReady && !state?.deletionStarted)
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await mutate("DELETE", {
        confirmation: deleteConfirmation(locale, confirmation),
      });
      focusAfterDeletion.current = true;
      setOpen(false);
      setConfirmation("");
      setPassword("");
      setState({ account: null, deletionReady: false, deletionStarted: false });
      setMessage(
        t(
          localPreviewAccount
            ? "customer.previewAccountDeleted"
            : "customer.accountDeleted",
        ),
      );
      if (!localPreviewAccount) {
        invalidatePublicSession({ signedOut: true });
        router.refresh();
      }
    } catch (e) {
      const failure =
        e instanceof TypeError
          ? networkError
          : e instanceof LocalizedError
            ? e.message
            : networkError;
      await load();
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  function previewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (localPreviewAccount?.kind !== "email") return;
    const form = event.currentTarget,
      data = new FormData(form);
    if (
      String(data.get("password") ?? "").length < 12 ||
      String(data.get("password") ?? "").length > 128
    ) {
      setPreviewPasswordError(t("customer.invalidPassword"));
      return;
    }
    if (data.get("password") !== data.get("passwordRepeat")) {
      setPreviewPasswordError(t("customer.passwordMismatch"));
      return;
    }
    form.reset();
    setPreviewPasswordError("");
    setPreviewPasswordOpen(false);
    setPasswordMessage(t("customer.previewPasswordChanged"));
  }
  return (
    <div className="w-full min-w-0" aria-busy={loading || busy}>
      {localPreviewAccount && (
        <aside
          className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--foreground)_28%,var(--background))] pt-3 pb-[18px] at-most-720:items-start"
          aria-label={t("customer.previewTitle")}
        >
          <p className="m-0 min-w-[220px] flex-1 text-[13px] leading-[1.5] text-muted-foreground at-most-720:min-w-0 at-most-720:basis-full">
            {t("customer.previewTitle")}
          </p>
          <nav
            className="flex flex-wrap gap-1.5"
            aria-label={t("customer.previewViews")}
          >
            <LocaleAnchor
              className="inline-flex min-h-11 items-center rounded-lg border border-input bg-card px-3 py-2 text-[13px] font-[550] text-foreground aria-[current=page]:border-[var(--theme-accent)] aria-[current=page]:bg-accent aria-[current=page]:text-[var(--theme-accent)] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]"
              href="/einstellungen"
              aria-current={
                localPreviewAccount.kind === "admin" ? "page" : undefined
              }
            >
              {t("customer.previewAdmin")}
            </LocaleAnchor>
            <LocaleAnchor
              className="inline-flex min-h-11 items-center rounded-lg border border-input bg-card px-3 py-2 text-[13px] font-[550] text-foreground aria-[current=page]:border-[var(--theme-accent)] aria-[current=page]:bg-accent aria-[current=page]:text-[var(--theme-accent)] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]"
              href="/einstellungen?vorschau=email"
              aria-current={
                localPreviewAccount.kind === "email" ? "page" : undefined
              }
            >
              {t("customer.previewEmail")}
            </LocaleAnchor>
            <LocaleAnchor
              className="inline-flex min-h-11 items-center rounded-lg border border-input bg-card px-3 py-2 text-[13px] font-[550] text-foreground aria-[current=page]:border-[var(--theme-accent)] aria-[current=page]:bg-accent aria-[current=page]:text-[var(--theme-accent)] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]"
              href="/einstellungen?vorschau=google"
              aria-current={
                localPreviewAccount.kind === "google" ? "page" : undefined
              }
            >
              {t("customer.previewGoogle")}
            </LocaleAnchor>
          </nav>
        </aside>
      )}
      <section
        className="min-w-0 [overflow-wrap:anywhere]"
        aria-labelledby={`${id}-heading`}
      >
        <h2
          className="mb-3 text-[22px] leading-[1.3] font-[650] tracking-[-0.3px]"
          ref={accountHeading}
          tabIndex={-1}
          id={`${id}-heading`}
        >
          {t("customer.yourAccount")}
        </h2>
        {loading ? (
          <p
            className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground"
            role="status"
          >
            {t("customer.accountLoading")}
          </p>
        ) : state?.account ? (
          <>
            <form onSubmit={save} className="my-4 grid w-full gap-[9px]">
              <label
                className="text-[14px] font-semibold"
                htmlFor={`${id}-name`}
              >
                {t("customer.fullName")}
              </label>
              <div className="flex min-w-0 items-stretch gap-2.5 at-most-380:gap-2">
                <input
                  className="min-h-[46px] min-w-0 rounded-lg border border-[color-mix(in_srgb,var(--foreground)_55%,var(--background))] bg-card px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)] flex-1 w-0 disabled:opacity-100 disabled:bg-muted disabled:text-foreground"
                  id={`${id}-name`}
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy || state.deletionStarted}
                />
                <button
                  className={cn(
                    accountButtonClassName,
                    "shrink-0 gap-2 at-most-380:px-3",
                  )}
                  type="submit"
                  aria-label={t("customer.saveName")}
                  disabled={
                    busy ||
                    state.deletionStarted ||
                    name.trim() === state.account.name
                  }
                >
                  {busy ? (
                    <LoaderCircle
                      size={17}
                      className="inline-block animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save size={17} aria-hidden="true" />
                  )}
                  <span className="at-most-380:hidden">
                    {t(busy ? "customer.wait" : "customer.saveNameShort")}
                  </span>
                </button>
              </div>
            </form>
            <dl className="mt-[18px] grid grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] gap-5 at-most-720:grid-cols-1 at-most-720:gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="mb-1 text-[14px] text-muted-foreground">
                  {t("customer.email")}
                </dt>
                <dd className="m-0 text-[15px] leading-[1.5] font-[550] text-foreground">
                  {state.account.email}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="mb-1 text-[14px] text-muted-foreground">
                  {t("customer.signInMethod")}
                </dt>
                <dd className="m-0 text-[15px] leading-[1.5] font-[550] text-foreground">
                  {localPreviewAccount?.kind === "admin"
                    ? t("customer.localPreview")
                    : valueLabel(locale, "provider", state.account.provider)}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <dt className="mb-1 text-[14px] text-muted-foreground">
                  {t("customer.accountStatus")}
                </dt>
                <dd className="m-0 text-[15px] leading-[1.5] font-[550] text-foreground">
                  {t(
                    localPreviewAccount?.kind === "admin"
                      ? "customer.localAccountStatus"
                      : "customer.verifiedAccount",
                  )}
                </dd>
              </div>
            </dl>
          </>
        ) : state?.deletionStarted ? (
          <p className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground">
            {t("customer.deletionStarted")}
          </p>
        ) : state ? (
          localPreviewAccount ? null : (
            <p className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground">
              {t("customer.loginAccountStart")}{" "}
              <Link href="/anmelden?weiter=/einstellungen">
                {t("customer.googleOrEmail")}
              </Link>{" "}
              {t("customer.loginAccountEnd")}
            </p>
          )
        ) : (
          <button
            className={accountButtonClassName}
            onClick={() => {
              setError("");
              void load();
            }}
          >
            {t("customer.reload")}
          </button>
        )}
        {error && !open && (
          <p
            className="my-2.5 text-[14px] leading-[1.6] text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground"
            role="status"
          >
            {message}
          </p>
        )}
        {localPreviewAccount && !state?.account && (
          <button
            className={accountButtonClassName}
            onClick={() => {
              setMessage("");
              setPasswordMessage("");
              setOpen(false);
              setConfirmation("");
              void load();
            }}
          >
            {t("customer.previewReset")}
          </button>
        )}
      </section>
      {state?.account && (
        <section
          className={accountSectionClassName}
          aria-labelledby={`${id}-password-heading`}
        >
          <h2
            className="mb-3 text-[22px] leading-[1.3] font-[650] tracking-[-0.3px]"
            id={`${id}-password-heading`}
          >
            {t("customer.accountPassword")}
          </h2>
          {localPreviewAccount?.kind === "admin" ? (
            <p className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground">
              {t("customer.localPasswordNote")}
            </p>
          ) : state.account.provider === "E-Mail" ? (
            <>
              <p className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground">
                {t("customer.passwordSettingsNote")}
              </p>
              <button
                className={accountButtonClassName}
                disabled={busy || loading || state.deletionStarted}
                onClick={() => void requestPasswordLink()}
              >
                {busy ? t("customer.wait") : t("customer.passwordChange")}
              </button>
            </>
          ) : (
            <>
              <p className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground">
                {t("customer.googlePasswordNote")}
              </p>
              {localPreviewAccount ? (
                <button
                  className={accountButtonClassName}
                  onClick={() =>
                    setPasswordMessage(t("customer.previewGooglePassword"))
                  }
                >
                  {t("customer.openGoogleAccount")}
                </button>
              ) : (
                <a
                  className={accountButtonClassName}
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("customer.openGoogleAccount")}
                </a>
              )}
            </>
          )}
          {passwordError && (
            <p
              className="my-2.5 text-[14px] leading-[1.6] text-destructive"
              role="alert"
            >
              {passwordError}
            </p>
          )}
          {passwordMessage && (
            <p
              className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground"
              role="status"
            >
              {passwordMessage}
            </p>
          )}
          {localPreviewAccount?.kind === "email" && passwordMessage && (
            <button
              ref={previewPasswordOpener}
              className={accountButtonClassName}
              onClick={() => {
                setPreviewPasswordError("");
                setPreviewPasswordOpen(true);
              }}
            >
              {t("customer.previewPasswordForm")}
            </button>
          )}
        </section>
      )}
      {appearance}
      {state && (state.account || state.deletionStarted) && (
        <section
          className={accountSectionClassName}
          aria-labelledby={`${id}-delete-heading`}
        >
          <h2
            className="mb-3 text-[22px] leading-[1.3] font-[650] tracking-[-0.3px]"
            id={`${id}-delete-heading`}
          >
            {t("customer.deleteAccount")}
          </h2>
          <p className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground">
            {t(
              state.account?.protected
                ? "customer.protectedAccount"
                : "customer.deleteAccountNote",
            )}
          </p>
          {(state.deletionStarted ||
            (state.account && !state.account.protected)) && (
            <AlertDialog
              open={open}
              onOpenChange={(value) => {
                if (!busy) {
                  setOpen(value);
                  setConfirmation("");
                  setPassword("");
                  setError("");
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <button
                  className={cn(
                    accountButtonClassName,
                    "border-destructive text-destructive",
                  )}
                  disabled={busy || loading}
                >
                  {state.deletionStarted
                    ? t("customer.continueDeletion")
                    : t("customer.deleteAccount")}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent
                className={cn(
                  confirmationDialogClassName,
                  "max-w-[min(560px,calc(100vw_-_32px))] data-[size=default]:sm:max-w-[min(560px,calc(100vw_-_32px))]",
                )}
                onEscapeKeyDown={(event) => {
                  if (busy) event.preventDefault();
                }}
              >
                <AlertDialogHeader className={dialogHeaderClassName}>
                  <AlertDialogTitle className={dialogTitleClassName}>
                    {t("customer.deleteAccountTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription
                    className={dialogDescriptionClassName}
                  >
                    {t("customer.deleteAccountDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <ModalBody>
                  {localPreviewAccount && (
                    <p className="mt-0 mb-4 text-[13px] text-muted-foreground">
                      {t("customer.previewTitle")}
                    </p>
                  )}
                  {!ready ? (
                    <div className="my-4 grid gap-[9px]">
                      <p className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground">
                        {t("customer.reauthNote")}
                      </p>
                      {state.account?.provider === "E-Mail" && (
                        <>
                          <label
                            className="text-[14px] font-semibold"
                            htmlFor={`${id}-password`}
                          >
                            {t("customer.currentPassword")}
                          </label>
                          <input
                            className="min-h-[46px] min-w-0 w-full rounded-lg border border-[color-mix(in_srgb,var(--foreground)_55%,var(--background))] bg-card px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]"
                            id={`${id}-password`}
                            type="password"
                            autoComplete={
                              localPreviewAccount ? "off" : "current-password"
                            }
                            placeholder={
                              localPreviewAccount
                                ? t("customer.previewPasswordHint")
                                : undefined
                            }
                            maxLength={128}
                            value={password}
                            onChange={(event) =>
                              setPassword(event.target.value)
                            }
                            disabled={busy}
                          />
                        </>
                      )}
                      <button
                        className={accountButtonClassName}
                        disabled={
                          busy ||
                          (state.account?.provider === "E-Mail" && !password)
                        }
                        onClick={() => void reauthenticate()}
                      >
                        {busy
                          ? t("customer.identityChecking")
                          : state.account?.provider === "Google"
                            ? t("customer.googleReauth")
                            : t("customer.confirmPassword")}
                      </button>
                    </div>
                  ) : (
                    <div className="my-4 grid gap-[9px]">
                      <label
                        className="text-[14px] font-semibold"
                        htmlFor={`${id}-confirmation`}
                      >
                        {t("customer.enterDeletePhrase", { phrase })}
                      </label>
                      <input
                        className="min-h-[46px] min-w-0 w-full rounded-lg border border-[color-mix(in_srgb,var(--foreground)_55%,var(--background))] bg-card px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]"
                        ref={confirmationInput}
                        id={`${id}-confirmation`}
                        autoComplete="off"
                        value={confirmation}
                        onChange={(event) =>
                          setConfirmation(event.target.value)
                        }
                        disabled={busy}
                      />
                      {state.deletionStarted && (
                        <p className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground">
                          {t("customer.deletionRetryNote")}
                        </p>
                      )}
                    </div>
                  )}
                  {error && (
                    <p className="text-destructive" role="alert">
                      {error}
                    </p>
                  )}
                </ModalBody>
                <AlertDialogFooter className={dialogFooterClassName}>
                  <AlertDialogCancel
                    className={confirmationCancelClassName}
                    disabled={busy}
                  >
                    {t("customer.cancel")}
                  </AlertDialogCancel>
                  {ready && (
                    <button
                      className={cn(
                        accountButtonClassName,
                        "border-destructive text-destructive",
                      )}
                      disabled={
                        busy || !deleteConfirmation(locale, confirmation)
                      }
                      onClick={() => void remove()}
                    >
                      {busy
                        ? t("customer.accountDeleting")
                        : state.deletionStarted
                          ? t("customer.retryDeletion")
                          : t("customer.deletePermanently")}
                    </button>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </section>
      )}
      {localPreviewAccount?.kind === "email" && (
        <Dialog
          open={previewPasswordOpen}
          onOpenChange={(value) => {
            setPreviewPasswordOpen(value);
            setPreviewPasswordError("");
          }}
        >
          <ModalContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              previewPasswordOpener.current?.focus();
            }}
            className="max-w-[min(560px,calc(100vw_-_32px))] sm:max-w-[min(560px,calc(100vw_-_32px))]"
            title={t("customer.authReset")}
            description={t("customer.previewTitle")}
            footer={
              <>
                <DialogClose asChild>
                  <button
                    className={cn(
                      appButton({ variant: "outline" }),
                      "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:px-[13px]",
                    )}
                  >
                    {t("customer.cancel")}
                  </button>
                </DialogClose>
                <button
                  className={cn(
                    appButton(),
                    "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:flex-1",
                  )}
                  form={`${id}-preview-password-form`}
                  type="submit"
                >
                  {t("customer.savePassword")}
                </button>
              </>
            }
          >
            <form
              id={`${id}-preview-password-form`}
              className="my-4 grid gap-[9px]"
              onSubmit={previewPassword}
            >
              <label
                className="text-[14px] font-semibold"
                htmlFor={`${id}-new-password`}
              >
                {t("customer.password")}
              </label>
              <input
                className="min-h-[46px] min-w-0 w-full rounded-lg border border-[color-mix(in_srgb,var(--foreground)_55%,var(--background))] bg-card px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]"
                id={`${id}-new-password`}
                name="password"
                type="password"
                autoComplete="off"
                required
                minLength={12}
                maxLength={128}
                aria-describedby={`${id}-password-minimum`}
              />
              <p
                className="my-2.5 text-[14px] leading-[1.6] text-muted-foreground"
                id={`${id}-password-minimum`}
              >
                {t("customer.passwordMinimum")}
              </p>
              <label
                className="text-[14px] font-semibold"
                htmlFor={`${id}-repeat-password`}
              >
                {t("customer.repeatPassword")}
              </label>
              <input
                className="min-h-[46px] min-w-0 w-full rounded-lg border border-[color-mix(in_srgb,var(--foreground)_55%,var(--background))] bg-card px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]"
                id={`${id}-repeat-password`}
                name="passwordRepeat"
                type="password"
                autoComplete="off"
                required
                minLength={12}
                maxLength={128}
              />
              {previewPasswordError && (
                <p
                  className="my-2.5 text-[14px] leading-[1.6] text-destructive"
                  role="alert"
                >
                  {previewPasswordError}
                </p>
              )}
            </form>
          </ModalContent>
        </Dialog>
      )}
    </div>
  );
}
