"use client";
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
    <div className="account-settings-group" aria-busy={loading || busy}>
      {localPreviewAccount && (
        <aside
          className="settings-preview"
          aria-label={t("customer.previewTitle")}
        >
          <p>{t("customer.previewTitle")}</p>
          <nav aria-label={t("customer.previewViews")}>
            <LocaleAnchor
              href="/einstellungen"
              aria-current={
                localPreviewAccount.kind === "admin" ? "page" : undefined
              }
            >
              {t("customer.previewAdmin")}
            </LocaleAnchor>
            <LocaleAnchor
              href="/einstellungen?vorschau=email"
              aria-current={
                localPreviewAccount.kind === "email" ? "page" : undefined
              }
            >
              {t("customer.previewEmail")}
            </LocaleAnchor>
            <LocaleAnchor
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
      <section className="account-settings" aria-labelledby={`${id}-heading`}>
        <h2 ref={accountHeading} tabIndex={-1} id={`${id}-heading`}>
          {t("customer.yourAccount")}
        </h2>
        {loading ? (
          <p role="status">{t("customer.accountLoading")}</p>
        ) : state?.account ? (
          <>
            <form onSubmit={save} className="account-name-form">
              <label htmlFor={`${id}-name`}>{t("customer.fullName")}</label>
              <div className="account-name-row">
                <input
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
                  className="account-button"
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
                      className="spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save size={17} aria-hidden="true" />
                  )}
                  <span>
                    {t(busy ? "customer.wait" : "customer.saveNameShort")}
                  </span>
                </button>
              </div>
            </form>
            <dl className="account-identity">
              <div>
                <dt>{t("customer.email")}</dt>
                <dd>{state.account.email}</dd>
              </div>
              <div>
                <dt>{t("customer.signInMethod")}</dt>
                <dd>
                  {localPreviewAccount?.kind === "admin"
                    ? t("customer.localPreview")
                    : valueLabel(locale, "provider", state.account.provider)}
                </dd>
              </div>
              <div>
                <dt>{t("customer.accountStatus")}</dt>
                <dd>
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
          <p>{t("customer.deletionStarted")}</p>
        ) : state ? (
          localPreviewAccount ? null : (
            <p>
              {t("customer.loginAccountStart")}{" "}
              <Link href="/anmelden?weiter=/einstellungen">
                {t("customer.googleOrEmail")}
              </Link>{" "}
              {t("customer.loginAccountEnd")}
            </p>
          )
        ) : (
          <button
            className="account-button"
            onClick={() => {
              setError("");
              void load();
            }}
          >
            {t("customer.reload")}
          </button>
        )}
        {error && !open && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {localPreviewAccount && !state?.account && (
          <button
            className="account-button"
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
          className="account-settings account-password-settings"
          aria-labelledby={`${id}-password-heading`}
        >
          <h2 id={`${id}-password-heading`}>{t("customer.accountPassword")}</h2>
          {localPreviewAccount?.kind === "admin" ? (
            <p>{t("customer.localPasswordNote")}</p>
          ) : state.account.provider === "E-Mail" ? (
            <>
              <p>{t("customer.passwordSettingsNote")}</p>
              <button
                className="account-button"
                disabled={busy || loading || state.deletionStarted}
                onClick={() => void requestPasswordLink()}
              >
                {busy ? t("customer.wait") : t("customer.passwordChange")}
              </button>
            </>
          ) : (
            <>
              <p>{t("customer.googlePasswordNote")}</p>
              {localPreviewAccount ? (
                <button
                  className="account-button"
                  onClick={() =>
                    setPasswordMessage(t("customer.previewGooglePassword"))
                  }
                >
                  {t("customer.openGoogleAccount")}
                </button>
              ) : (
                <a
                  className="account-button"
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
            <p className="account-error" role="alert">
              {passwordError}
            </p>
          )}
          {passwordMessage && <p role="status">{passwordMessage}</p>}
          {localPreviewAccount?.kind === "email" && passwordMessage && (
            <button
              ref={previewPasswordOpener}
              className="account-button"
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
          className="account-settings account-deletion-settings"
          aria-labelledby={`${id}-delete-heading`}
        >
          <h2 id={`${id}-delete-heading`}>{t("customer.deleteAccount")}</h2>
          <p>
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
                  className="account-button account-danger"
                  disabled={busy || loading}
                >
                  {state.deletionStarted
                    ? t("customer.continueDeletion")
                    : t("customer.deleteAccount")}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent
                className="app-dialog confirmation-dialog settings-delete-dialog"
                onEscapeKeyDown={(event) => {
                  if (busy) event.preventDefault();
                }}
              >
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("customer.deleteAccountTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("customer.deleteAccountDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <ModalBody>
                  {localPreviewAccount && (
                    <p className="settings-dialog-preview">
                      {t("customer.previewTitle")}
                    </p>
                  )}
                  {!ready ? (
                    <div className="account-confirmation">
                      <p>{t("customer.reauthNote")}</p>
                      {state.account?.provider === "E-Mail" && (
                        <>
                          <label htmlFor={`${id}-password`}>
                            {t("customer.currentPassword")}
                          </label>
                          <input
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
                        className="account-button"
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
                    <div className="account-confirmation">
                      <label htmlFor={`${id}-confirmation`}>
                        {t("customer.enterDeletePhrase", { phrase })}
                      </label>
                      <input
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
                        <p>{t("customer.deletionRetryNote")}</p>
                      )}
                    </div>
                  )}
                  {error && (
                    <p className="account-error" role="alert">
                      {error}
                    </p>
                  )}
                </ModalBody>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={busy}>
                    {t("customer.cancel")}
                  </AlertDialogCancel>
                  {ready && (
                    <button
                      className="account-button account-danger"
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
            className="settings-password-dialog"
            title={t("customer.authReset")}
            description={t("customer.previewTitle")}
            footer={
              <>
                <DialogClose asChild>
                  <button className="outline">{t("customer.cancel")}</button>
                </DialogClose>
                <button
                  className="primary"
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
              className="account-confirmation"
              onSubmit={previewPassword}
            >
              <label htmlFor={`${id}-new-password`}>
                {t("customer.password")}
              </label>
              <input
                id={`${id}-new-password`}
                name="password"
                type="password"
                autoComplete="off"
                required
                minLength={12}
                maxLength={128}
                aria-describedby={`${id}-password-minimum`}
              />
              <p id={`${id}-password-minimum`}>
                {t("customer.passwordMinimum")}
              </p>
              <label htmlFor={`${id}-repeat-password`}>
                {t("customer.repeatPassword")}
              </label>
              <input
                id={`${id}-repeat-password`}
                name="passwordRepeat"
                type="password"
                autoComplete="off"
                required
                minLength={12}
                maxLength={128}
              />
              {previewPasswordError && (
                <p className="account-error" role="alert">
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
