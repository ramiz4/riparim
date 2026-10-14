"use client";
import { cn } from "@/lib/utils";
import {
  pageFrameClassName,
  appButton,
  noteClassName,
  formClassName,
  formLabelClassName,
  helpTextClassName,
  inputClassName,
  textareaClassName,
  formHintClassName,
  errorClassName,
} from "@/lib/presentation";
import { AdminLoading } from "@/components/admin-loading";
import { useI18n } from "@/lib/i18n/client";
import {
  responseError,
  LocalizedError,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { LocaleAnchor } from "@/components/locale-anchor";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, LoaderCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { AdminNavigation } from "@/components/admin-navigation";
import type { AccountIdentity } from "@/components/account-storage-notice";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  confirmationEmailSubject,
  recoveryEmailSubject,
  confirmationEmailTemplate,
  recoveryEmailTemplate,
} from "@/lib/auth/email-templates";
export default function AuthSetup({ account }: { account: AccountIdentity }) {
  const { t } = useI18n();
  const [provider, setProvider] = useState<"supabase" | "pocketbase">(
      "supabase",
    ),
    [url, setUrl] = useState(""),
    [key, setKey] = useState(""),
    [enabled, setEnabled] = useState(false),
    [mail, setMail] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  useNavigationGuard({ busy, dirty });
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/auth-settings", { signal: c.signal })
      .then(async (r) => {
        const d = (await r.json()) as CodedResponse & {
          config: {
            provider?: "supabase" | "pocketbase";
            projectUrl: string;
            publicKey: string;
            enabled: boolean;
            emailDeliveryConfirmed: boolean;
          } | null;
          error?: string;
        };
        if (!r.ok) throw responseError(t, d);
        if (d.config) {
          setProvider(d.config.provider ?? "supabase");
          setUrl(d.config.projectUrl);
          setKey(d.config.publicKey);
          setEnabled(d.config.enabled);
          setMail(d.config.emailDeliveryConfirmed);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(
            e instanceof LocalizedError
              ? e.message
              : t("management.configNetwork"),
          );
      })
      .finally(() => setLoading(false));
    return () => c.abort();
  }, [t]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || loading) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/auth-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          projectUrl: url,
          publicKey: provider === "supabase" ? key : "",
          enabled,
          emailDeliveryConfirmed: mail,
        }),
      });
      const d = (await r.json()) as CodedResponse;
      if (!r.ok) throw responseError(t, d);
      setDirty(false);
      setMessage(
        enabled
          ? mail
            ? t("management.authActivated")
            : t("management.authProvidersActivated")
          : t("management.authDraftSaved"),
      );
    } catch (e) {
      setError(
        e instanceof LocalizedError ? e.message : t("management.saveFailed"),
      );
    } finally {
      setBusy(false);
    }
  }
  const [copyMessage, setCopyMessage] = useState(""),
    [copyError, setCopyError] = useState("");
  async function copyMail(source: string, label: string) {
    setCopyMessage("");
    setCopyError("");
    try {
      await navigator.clipboard.writeText(source);
      setCopyMessage(t("management.mailFieldCopied", { field: label }));
    } catch {
      setCopyError(t("management.mailCopyFailed"));
    }
  }
  const mailFields = [
    {
      id: "confirmation-subject",
      label: t("management.confirmationSubject"),
      source: confirmationEmailSubject,
    },
    {
      id: "confirmation-body",
      label: t("management.confirmationBody"),
      source: confirmationEmailTemplate,
    },
    {
      id: "recovery-subject",
      label: t("management.recoverySubject"),
      source: recoveryEmailSubject,
    },
    {
      id: "recovery-body",
      label: t("management.recoveryBody"),
      source: recoveryEmailTemplate,
    },
  ];
  const exportCommand =
    "npm run auth:email-templates -- --site-origin SITE_ORIGIN --provider-site-url PROVIDER_SITE_URL --output-dir NEW_DIRECTORY";
  return (
    <>
      <SiteHeader account={account} isAdmin />
      <AdminNavigation active="login" />
      <main
        className={cn(
          pageFrameClassName,
          "pt-[30px] pb-[70px] at-most-720:pt-7",
        )}
      >
        <div>
          <h1 className="my-2.5 text-[33px] leading-[1.2] font-[650] tracking-[-0.8px] at-most-720:text-[29px]">
            {t("management.connectAuth")}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground at-most-720:text-[13px]">
            {t("management.authSetupIntro", {
              provider: provider === "supabase" ? "Supabase" : "PocketBase",
            })}
          </p>
        </div>
        {loading && (
          <AdminLoading>{t("management.configLoading")}</AdminLoading>
        )}
        <div
          data-ui="auth-setup-layout"
          className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-6 [&[hidden]]:hidden at-most-900:grid-cols-1 at-most-720:gap-[18px]"
          hidden={loading}
        >
          <section
            data-ui="setup-instructions"
            className="min-w-0 rounded-xl border border-[#dfe7d9] p-[25px] dark:border-border dark:bg-card at-most-720:p-[21px]"
            aria-labelledby="setup-instructions-heading"
          >
            <h2
              className="mb-3 text-[18px] font-[650]"
              id="setup-instructions-heading"
            >
              {t("management.authChecklist")}
            </h2>
            {provider === "pocketbase" ? (
              <>
                <p className="my-2.5 text-[14px] text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground mt-0 mb-[18px] leading-[1.6]">
                  {t("management.pocketbaseSetup")}
                </p>
                <p className="my-2.5 text-[14px] text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground mt-0 mb-[18px] leading-[1.6]">
                  {t("management.pocketbaseCallbacks")}
                </p>
                <p className="my-2.5 text-[14px] text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground mt-0 mb-[18px] leading-[1.6]">
                  {t("management.authControlledSwitch")}
                </p>
                <LocaleAnchor
                  className="text-[#387d46] underline dark:text-[var(--theme-accent)]"
                  href="https://pocketbase.io/docs/authentication/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("management.pocketbaseDocs")}
                </LocaleAnchor>
              </>
            ) : (
              <>
                <p className="my-2.5 text-[14px] text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground mt-0 mb-[18px] leading-[1.6]">
                  {t("management.authReuseProject")}
                </p>
                <ol
                  data-ui="setup-steps"
                  className="m-0 grid list-decimal gap-4 pl-[22px] at-most-720:pl-[19px]"
                >
                  <li className="min-w-0 pl-1 marker:font-[650] marker:text-foreground">
                    <h3 className="m-0 text-[15px] font-[650] text-foreground">
                      {t("management.authChooseProject")}
                    </h3>
                    <p className="text-[14px] text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] leading-[1.6]">
                      {t("management.authProjectCheckBefore")}{" "}
                      <LocaleAnchor
                        className="text-[#387d46] underline dark:text-[var(--theme-accent)]"
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("management.supabaseProject")}
                      </LocaleAnchor>
                      {t("management.authProjectCheckAfter")}
                    </p>
                  </li>
                  <li className="min-w-0 pl-1 marker:font-[650] marker:text-foreground">
                    <h3 className="m-0 text-[15px] font-[650] text-foreground">
                      {t("management.authWebsiteMail")}
                    </h3>
                    <p className="text-[14px] text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] leading-[1.6]">
                      {t("management.authWebsiteMailCheck")}
                    </p>
                    <details className="mt-2 border-t border-border">
                      <summary className="min-h-11 cursor-pointer px-0.5 py-[11px] text-[13px] font-semibold text-foreground [overflow-wrap:anywhere] focus-visible:rounded-[3px] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]">
                        {t("management.authMailHelp")}
                      </summary>
                      <div className="px-0.5 pb-2.5 text-[13px] leading-[1.6]">
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.smtpHelp")}
                        </p>
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authSmtpFreeRule")}
                        </p>
                        <LocaleAnchor
                          className="text-[#387d46] underline dark:text-[var(--theme-accent)] mb-2 inline-block text-[13px] leading-[1.6] underline-offset-[3px]"
                          href="https://supabase.com/docs/guides/auth/auth-smtp"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("management.smtpDocs")}
                        </LocaleAnchor>
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authOriginRule")}
                        </p>
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authCallbackRule", {
                            callback:
                              "https://riparim.com/auth/bestaetigen\\?**",
                          })}
                        </p>
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authReleaseBackup")}
                        </p>
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authExportHelp")}
                        </p>
                        <pre
                          className="max-h-60 overflow-auto rounded-[7px] bg-[#f3f6ef] p-3 text-[12px] leading-[1.6] text-[#5c7550] whitespace-pre-wrap [overflow-wrap:anywhere] focus-visible:rounded-[3px] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)] dark:bg-secondary dark:text-muted-foreground"
                          aria-label="auth:email-templates"
                          tabIndex={0}
                        >
                          {exportCommand}
                        </pre>
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authOriginFailure")}
                        </p>
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authFieldPairHelp")}
                        </p>
                        {mailFields.map((field) => (
                          <details
                            className="mt-2 border-t border-border"
                            key={field.id}
                            data-auth-mail-field={field.id}
                          >
                            <summary className="min-h-11 cursor-pointer px-0.5 py-[11px] text-[13px] font-semibold text-foreground [overflow-wrap:anywhere] focus-visible:rounded-[3px] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]">
                              {field.label}
                            </summary>
                            <button
                              type="button"
                              className={cn(
                                appButton({ variant: "outline" }),
                                "px-[13px] py-2",
                              )}
                              aria-label={t("management.copyMailField", {
                                field: field.label,
                              })}
                              onClick={() =>
                                void copyMail(field.source, field.label)
                              }
                            >
                              {t("management.copyMailField", {
                                field: field.label,
                              })}
                            </button>
                            <pre
                              className="max-h-60 overflow-auto rounded-[7px] bg-[#f3f6ef] p-3 text-[12px] leading-[1.6] text-[#5c7550] whitespace-pre-wrap [overflow-wrap:anywhere] focus-visible:rounded-[3px] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)] dark:bg-secondary dark:text-muted-foreground"
                              aria-label={field.label}
                              tabIndex={0}
                            >
                              {field.source}
                            </pre>
                          </details>
                        ))}
                        {copyMessage && (
                          <p
                            className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]"
                            role="status"
                          >
                            {copyMessage}
                          </p>
                        )}
                        {copyError && (
                          <p
                            className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]"
                            role="alert"
                          >
                            {copyError}
                          </p>
                        )}
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authReadbackHelp")}
                        </p>
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authActivationFailure")}
                        </p>
                        <LocaleAnchor
                          className="text-[#387d46] underline dark:text-[var(--theme-accent)] mb-2 inline-block text-[13px] leading-[1.6] underline-offset-[3px]"
                          href="https://supabase.com/docs/guides/auth/auth-email-templates"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("management.authTemplatesDocs")}
                        </LocaleAnchor>
                      </div>
                    </details>
                  </li>
                  <li className="min-w-0 pl-1 marker:font-[650] marker:text-foreground">
                    <h3 className="m-0 text-[15px] font-[650] text-foreground">
                      {t("management.authTestDelivery")}
                    </h3>
                    <p className="text-[14px] text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] leading-[1.6]">
                      {t("management.authTestDeliveryCheck")}
                    </p>
                  </li>
                  <li className="min-w-0 pl-1 marker:font-[650] marker:text-foreground">
                    <h3 className="m-0 text-[15px] font-[650] text-foreground">
                      {t("management.authGoogleHeading")}
                    </h3>
                    <p className="text-[14px] text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] leading-[1.6]">
                      {t("management.authGoogleCheck")}
                    </p>
                    <details className="mt-2 border-t border-border">
                      <summary className="min-h-11 cursor-pointer px-0.5 py-[11px] text-[13px] font-semibold text-foreground [overflow-wrap:anywhere] focus-visible:rounded-[3px] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-[var(--theme-accent)]">
                        {t("management.authGoogleSettings")}
                      </summary>
                      <div className="px-0.5 pb-2.5 text-[13px] leading-[1.6]">
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.googleBefore")}{" "}
                          <strong className="font-[550] text-[#537848] dark:text-[var(--theme-accent)]">
                            https://riparim.com
                          </strong>{" "}
                          {t("management.googleAfter")}
                        </p>
                        <p className="text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground my-[5px] mt-2 mb-3 text-[13px]">
                          {t("management.authGoogleCredentials")}
                        </p>
                        <LocaleAnchor
                          className="text-[#387d46] underline dark:text-[var(--theme-accent)] mb-2 inline-block text-[13px] leading-[1.6] underline-offset-[3px]"
                          href="https://supabase.com/docs/guides/auth/social-login/auth-google"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t("management.googleDocs")}
                        </LocaleAnchor>
                      </div>
                    </details>
                  </li>
                </ol>
              </>
            )}
            <div className={cn(noteClassName, "mt-5")}>
              <ShieldCheck size={21} />
              <p className="text-[14px] leading-[1.8] text-[#7a896e] [overflow-wrap:anywhere] dark:text-muted-foreground m-0">
                {t("management.legacyProofHelp")}
              </p>
            </div>
          </section>
          <form
            className={cn(
              formClassName,
              "min-w-0 self-start rounded-xl border border-[#dfe7d9] bg-[#f9fbf6] p-[25px] dark:border-border dark:bg-[var(--theme-surface)] dark:text-muted-foreground at-most-900:-order-1 at-most-720:p-[21px]",
            )}
            onChange={() => setDirty(true)}
            onSubmit={save}
          >
            <h2 className="mb-3 text-[18px] font-[650]">
              {t("management.connectProject")}
            </h2>
            <label className={formLabelClassName}>
              {t("management.authProvider")}
              <select
                data-auth-provider
                disabled={loading || busy}
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as "supabase" | "pocketbase")
                }
              >
                <option value="supabase">Supabase</option>
                <option value="pocketbase">PocketBase</option>
              </select>
            </label>
            <p className={helpTextClassName}>
              {t("management.authControlledSwitch")}
            </p>
            <label className={formLabelClassName}>
              {t(
                provider === "supabase"
                  ? "management.projectUrl"
                  : "management.authEndpoint",
              )}
              <input
                className={inputClassName}
                disabled={loading || busy}
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  provider === "supabase"
                    ? "https://dein-projekt.supabase.co"
                    : "https://auth.example.com"
                }
                autoComplete="off"
              />
            </label>
            {provider === "supabase" && (
              <>
                <label className={formLabelClassName}>
                  {t("management.publishableKey")}
                  <textarea
                    className={textareaClassName}
                    disabled={loading || busy}
                    required
                    rows={3}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="sb_publishable_…"
                    autoComplete="off"
                  />
                </label>
                <p className={helpTextClassName}>
                  {t("management.publicKeyHelp")}
                </p>
              </>
            )}
            <label
              className={cn(formLabelClassName, "flex items-start gap-2.5")}
            >
              <Checkbox
                className="mt-1 shrink-0"
                disabled={loading || busy}
                checked={mail}
                onCheckedChange={(v) => {
                  setMail(v === true);
                  setDirty(true);
                }}
                aria-label={t("management.confirmDelivery")}
              />
              <span
                className={cn(
                  formHintClassName,
                  "text-[13px] leading-[1.7] text-[#697d6d] dark:text-muted-foreground",
                )}
              >
                {t("management.deliveryTested")}
              </span>
            </label>
            <label
              className={cn(formLabelClassName, "flex items-center gap-3")}
            >
              <Switch
                disabled={loading || busy}
                checked={enabled}
                onCheckedChange={(value) => {
                  setEnabled(value);
                  setDirty(true);
                }}
                aria-label={t("management.activateCustomerLogin")}
              />
              <span
                className={cn(
                  formHintClassName,
                  "text-[14px] text-[#506a48] dark:text-[var(--theme-accent)] at-most-720:leading-[1.5]",
                )}
              >
                {t("management.activateCustomerLogin")}
              </span>
            </label>
            {error && (
              <p className={errorClassName} role="alert">
                {error}
              </p>
            )}
            {message && (
              <p
                className="mb-4 rounded-lg bg-[#eef6e9] px-[15px] py-3 text-[14px] text-[#527d4d] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
                role="status"
              >
                {message}
              </p>
            )}
            <button
              type="submit"
              className={appButton()}
              disabled={loading || busy}
            >
              {busy ? (
                <>
                  <LoaderCircle
                    className="inline-block animate-spin motion-reduce:animate-none"
                    size={17}
                  />
                  {t("management.checkingConnection")}
                </>
              ) : enabled ? (
                t("management.checkActivate")
              ) : (
                t("management.saveConnectionDraft")
              )}
            </button>
            <div
              data-ui="auth-preview-links"
              className="flex flex-col gap-2.5 text-[13px] text-[#517b48] dark:text-[var(--theme-accent)]"
            >
              <LocaleAnchor
                className="underline underline-offset-[3px]"
                href="/anmelden"
              >
                {t("management.previewLogin")}
              </LocaleAnchor>
              <LocaleAnchor
                className="underline underline-offset-[3px]"
                href="/registrieren"
              >
                {t("management.previewRegistration")}
              </LocaleAnchor>
              <LocaleAnchor
                className="underline underline-offset-[3px]"
                href="/passwort-vergessen"
              >
                {t("management.previewRecovery")}
              </LocaleAnchor>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
