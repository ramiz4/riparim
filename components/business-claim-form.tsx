"use client";
import { cn } from "@/lib/utils";
import {
  contentTitleClassName,
  appButton,
  formLabelClassName,
  errorClassName,
} from "@/lib/presentation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  LoaderCircle,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import {
  responseError,
  LocalizedError,
  errorCodeMessage,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { LocaleAnchor } from "@/components/locale-anchor";
import {
  SelectWithOther,
  selectedChoiceText,
  type SelectionDraft,
} from "@/components/select-with-other";
import { claimDocumentsError } from "@/lib/business-contract";
import type { Workshop } from "@/lib/workshops";

const claimConnections = [
  {
    value: "owner",
    label: "management.claimRoleOwner",
    evidence: "management.claimRoleOwnerStatement",
  },
  {
    value: "director",
    label: "management.claimRoleDirector",
    evidence: "management.claimRoleDirectorStatement",
  },
  {
    value: "authorized",
    label: "management.claimRoleAuthorized",
    evidence: "management.claimRoleAuthorizedStatement",
  },
  {
    value: "other",
    label: "management.claimRoleOther",
    evidence: "management.claimRoleOther",
  },
] as const;

export function BusinessClaimForm({ workshop }: { workshop: Workshop | null }) {
  const { t } = useI18n(),
    id = useId(),
    fileInput = useRef<HTMLInputElement>(null),
    confirmation = useRef<HTMLHeadingElement>(null);
  const [connection, setConnection] = useState<SelectionDraft>({
      choice: "",
      detail: "",
    }),
    [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [submitted, setSubmitted] = useState(false),
    [error, setError] = useState("");
  const evidence = selectedChoiceText(
    connection,
    claimConnections.map((role) => ({
      value: role.value,
      label: t(role.evidence),
    })),
  );
  useNavigationGuard({
    busy,
    dirty: !!connection.choice || !!connection.detail || files.length > 0,
  });
  useEffect(() => {
    if (submitted) confirmation.current?.focus();
  }, [submitted]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!workshop || busy || submitted) return;
    if (evidence.trim().length < 40) {
      setError(t("management.claimConnectionRequired"));
      document
        .getElementById(
          connection.choice === "other"
            ? `${id}-connection-details`
            : `${id}-connection`,
        )
        ?.focus();
      return;
    }
    const selectionError = claimDocumentsError(files);
    if (selectionError) {
      setError(errorCodeMessage(t, selectionError));
      fileInput.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("workshopId", workshop.id);
      body.set("evidence", evidence);
      for (const file of files) body.append("file", file);
      const response = await fetch("/api/business", { method: "POST", body }),
        data = (await response.json()) as CodedResponse;
      if (!response.ok) throw responseError(t, data);
      setConnection({ choice: "", detail: "" });
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      setSubmitted(true);
    } catch (error) {
      setError(
        error instanceof LocalizedError
          ? error.message
          : t("management.businessNetwork"),
      );
    } finally {
      setBusy(false);
    }
  }
  function addFiles(selected: File[]) {
    if (!selected.length) return;
    const next = [...files, ...selected],
      selectionError = claimDocumentsError(next);
    if (selectionError) setError(errorCodeMessage(t, selectionError));
    else {
      setFiles(next);
      setError("");
    }
    if (fileInput.current) fileInput.current.value = "";
  }
  function removeFile(index: number) {
    setFiles(files.filter((_, position) => position !== index));
    setError("");
    fileInput.current?.focus();
  }
  return (
    <div
      data-ui="business-panel business-claim"
      className="mt-0 [overflow-wrap:anywhere]"
      aria-busy={busy}
    >
      {workshop && (
        <LocaleAnchor
          className="inline-flex min-h-10 items-center gap-[7px] text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring"
          href={`/werkstatt/${encodeURIComponent(workshop.id)}`}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t("management.claimBack")}
        </LocaleAnchor>
      )}
      <h1
        className={cn(
          contentTitleClassName,
          "focus:outline-none mt-2 mb-[18px] text-[28px] leading-[1.25] at-most-720:text-[26px]",
        )}
      >
        {t("management.claimTitle")}
      </h1>
      {workshop ? (
        <>
          <section
            data-ui="claim-workshop"
            className="flex items-start gap-3 border-b border-border pb-4 at-most-720:pb-3.5"
          >
            <Building2
              className="mt-0.5 shrink-0 text-[var(--theme-accent)]"
              size={22}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h2 className="tracking-[-0.3px] m-0 text-[17px] leading-[1.4] font-semibold at-most-720:text-[16px]">
                {workshop.name}
              </h2>
              <p className="text-muted-foreground mt-1 mb-0 text-[12px] leading-[1.5]">
                {workshop.city} · {workshop.address}
              </p>
            </div>
          </section>
          {submitted ? (
            <section data-ui="claim-confirmation" className="pt-6">
              <CheckCircle2
                className="text-[var(--theme-accent)]"
                size={30}
                aria-hidden="true"
              />
              <h2
                className="font-[650] tracking-[-0.3px] my-3 text-[22px] leading-[1.35] focus:outline-none"
                ref={confirmation}
                tabIndex={-1}
              >
                {t("management.claimSuccessTitle")}
              </h2>
              <p
                className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground"
                role="status"
              >
                {t("management.claimSubmitted")}
              </p>
              <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
                {t("management.claimPendingHelp")}
              </p>
              <LocaleAnchor
                className={cn(
                  appButton(),
                  "text-[var(--theme-accent)] mt-2 inline-flex",
                )}
                href="/antraege"
              >
                {t("management.myApplications")}
              </LocaleAnchor>
            </section>
          ) : (
            <>
              <p className="text-muted-foreground my-4 text-[14px] leading-[1.5]">
                {t("management.claimIntro")}
              </p>
              <form
                data-ui="business-form claim-form"
                className="min-w-0"
                onSubmit={submit}
              >
                <fieldset className="grid min-w-0 gap-[18px]" disabled={busy}>
                  <div className="grid min-w-0 gap-[7px]">
                    <SelectWithOther
                      presentation="claim"
                      id={`${id}-connection`}
                      label={t("management.claimEvidenceLabel")}
                      placeholder={t("management.claimChooseConnection")}
                      options={claimConnections.map((role) => ({
                        value: role.value,
                        label: t(role.label),
                      }))}
                      value={connection}
                      onChange={(value) => {
                        setConnection(value);
                        setError("");
                      }}
                      detailLabel={t("management.claimConnectionDetails")}
                      detailPlaceholder={t(
                        "management.claimEvidencePlaceholder",
                      )}
                      minLength={40}
                      maxLength={4000}
                      disabled={busy}
                      describedBy={
                        connection.choice === "other"
                          ? `${id}-evidence-help`
                          : undefined
                      }
                    />
                    {connection.choice === "other" && (
                      <small
                        className="text-[12px] leading-[1.5] font-normal text-muted-foreground"
                        id={`${id}-evidence-help`}
                      >
                        {t("management.claimEvidenceHint")}
                      </small>
                    )}
                  </div>
                  <div className="grid min-w-0 gap-[7px]">
                    <label
                      className={cn(
                        formLabelClassName,
                        "text-foreground flex flex-wrap items-baseline gap-1.5",
                      )}
                      htmlFor={`${id}-file`}
                    >
                      {t("management.claimDocumentLabel")}
                    </label>
                    <div
                      data-ui="claim-upload"
                      className="relative flex min-h-[76px] items-center gap-3 rounded-[10px] border border-dashed border-input bg-card p-3.5 hover:border-[var(--theme-accent)] focus-within:outline-[3px] focus-within:outline-offset-3 focus-within:outline-ring has-[:disabled]:opacity-65"
                    >
                      <Upload
                        className="shrink-0 text-[var(--theme-accent)]"
                        size={22}
                        aria-hidden="true"
                      />
                      <div className="grid min-w-0 gap-1">
                        <strong className="text-[14px] font-semibold">
                          {files.length
                            ? t("management.claimReplaceDocument")
                            : t("management.claimChooseDocument")}
                        </strong>
                        <small
                          className="text-[12px] leading-[1.5] font-normal text-muted-foreground"
                          id={`${id}-file-help`}
                        >
                          {t("management.claimFileTypes")}
                        </small>
                      </div>
                      <input
                        className="absolute inset-0 h-full w-full cursor-pointer border-0 p-0 opacity-0"
                        ref={fileInput}
                        id={`${id}-file`}
                        type="file"
                        multiple
                        required={!files.length}
                        accept="application/pdf,image/jpeg,image/png"
                        aria-describedby={`${id}-file-help`}
                        onChange={(event) =>
                          addFiles(Array.from(event.target.files ?? []))
                        }
                      />
                    </div>
                    {files.map((file, index) => (
                      <div
                        data-ui="claim-selected-file"
                        className="flex min-w-0 items-center gap-2 text-[13px] text-foreground"
                        key={`${index}-${file.name}`}
                      >
                        <FileText
                          className="shrink-0 text-[var(--theme-accent)]"
                          size={18}
                          aria-hidden="true"
                        />
                        <span
                          className="min-w-0 flex-1 [overflow-wrap:anywhere]"
                          aria-live="polite"
                        >
                          {file.name}
                        </span>
                        <button
                          data-ui="claim-remove-file"
                          type="button"
                          className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring"
                          aria-label={t("management.claimRemoveDocument", {
                            name: file.name,
                          })}
                          onClick={() => removeFile(index)}
                        >
                          <X size={18} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {error && (
                    <p
                      className={cn(
                        errorClassName,
                        "mt-2.5 mb-4 text-[14px] leading-[1.7]",
                      )}
                      role="alert"
                    >
                      {error}
                    </p>
                  )}
                  <div data-ui="claim-submit" className="grid gap-[9px]">
                    <p className="text-muted-foreground m-0 flex items-start gap-[7px] text-[12px] leading-[1.5]">
                      <ShieldCheck
                        className="mt-px shrink-0 text-[var(--theme-accent)]"
                        size={16}
                        aria-hidden="true"
                      />
                      {t("management.claimPrivacy")}
                    </p>
                    <button
                      className={cn(
                        appButton(),
                        "flex min-h-[46px] w-full items-center justify-center gap-2",
                      )}
                      type="submit"
                    >
                      {busy && (
                        <LoaderCircle
                          className="inline-block animate-spin motion-reduce:animate-none"
                          size={18}
                          aria-hidden="true"
                        />
                      )}
                      {busy
                        ? t("management.claimSending")
                        : t("management.submitClaim")}
                    </button>
                    <small className="text-[12px] leading-[1.5] font-normal text-muted-foreground text-center">
                      {t("management.claimManualReview")}
                    </small>
                  </div>
                </fieldset>
              </form>
            </>
          )}
        </>
      ) : (
        <>
          <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
            {t("management.claimFromProfile")}
          </p>
          <LocaleAnchor className={appButton()} href="/werkstaetten">
            {t("management.findWorkshop")}
          </LocaleAnchor>
        </>
      )}
    </div>
  );
}
