"use client";
import { storedEvidenceTypes } from "@/lib/i18n/canonical-values";

import { reviewServiceValues, reviewTextMaxLength } from "@/lib/review";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import {
  appButton,
  dialogCopyClassName,
  errorClassName,
  formClassName,
  formGridClassName,
  formHintClassName,
  formLabelClassName,
  helpTextClassName,
  inputClassName,
  noteClassName,
  textareaClassName,
} from "@/lib/presentation";
import {
  responseError,
  LocalizedError,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { LocaleAnchor } from "@/components/locale-anchor";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  FileCheck2,
  LoaderCircle,
  ShieldCheck,
  Star,
  Upload,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchablePicker } from "@/components/searchable-picker";
import { valueLabel } from "@/lib/i18n/values";
import { Field, FieldLabel } from "@/components/ui/field";
import { Picker } from "@/components/picker";
import {
  AccountStorageNotice,
  type AccountIdentity,
} from "@/components/account-storage-notice";
import { services, type Workshop } from "@/lib/workshops";
import type { Visit } from "@/app/journeys";

export type ReviewFormDraft = {
  submissionId: string;
  wid: string;
  kind: string;
  service: string | string[];
  vehicle: string;
  date: string;
  note: string;
  rating: number;
  review: string;
  consent: boolean;
  file: File | null;
  dirty: boolean;
};
type Props = {
  draft?: ReviewFormDraft;
  onDraftChange?: (draft: ReviewFormDraft) => void;
  workshop: Workshop | null;
  directory: Workshop[];
  signedIn: boolean;
  account?: AccountIdentity | null;
  existing?: Visit | null;
  formId?: string;
  showSubmit?: boolean;
  presentation?: "default" | "profile";
  returnTo: string;
  onSubmitted?: () => void;
  onBusyChange?: (busy: boolean) => void;
};
export function ReviewForm({
  workshop,
  directory,
  signedIn,
  existing = null,
  formId,
  showSubmit = true,
  presentation = "default",
  returnTo,
  onSubmitted,
  onBusyChange,
  draft,
  onDraftChange,
}: Props) {
  const { locale, t } = useI18n();
  const generatedId = useId(),
    id = formId ?? generatedId,
    consentId = useId();
  const consentCheckbox = useRef<HTMLButtonElement>(null),
    ratingGroup = useRef<HTMLDivElement>(null);
  const [submissionId] = useState(
    () => draft?.submissionId ?? existing?.id ?? crypto.randomUUID(),
  );
  const initialServices = existing
    ? reviewServiceValues(existing)
    : [workshop?.services[0] ?? directory[0]?.services[0] ?? services[1]];
  const [wid, setWid] = useState(
      draft?.wid ??
        existing?.workshop ??
        workshop?.id ??
        directory[0]?.id ??
        "",
    ),
    [kind, setKind] = useState(
      draft?.kind ?? existing?.evidence_type ?? storedEvidenceTypes.invoice,
    ),
    [service, setService] = useState<string | string[]>(
      draft?.service ?? initialServices,
    );
  const [vehicle, setVehicle] = useState(
      draft?.vehicle ?? existing?.vehicle ?? "",
    ),
    [date, setDate] = useState(draft?.date ?? existing?.date ?? ""),
    [note, setNote] = useState(draft?.note ?? existing?.evidence_note ?? ""),
    [rating, setRating] = useState(draft?.rating ?? existing?.rating ?? 0),
    [review, setReview] = useState(draft?.review ?? existing?.review ?? "");
  const [consent, setConsent] = useState(draft?.consent ?? false),
    [consentError, setConsentError] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const workshopName =
    directory.find((w) => w.id === wid)?.name ??
    workshop?.name ??
    existing?.workshop_name;
  const [selectedFile, setSelectedFile] = useState<File | null>(
    draft?.file ?? null,
  );
  const fileSelected = !!selectedFile,
    selectedServices = Array.isArray(service) ? service : [service];
  const dirty =
    signedIn &&
    !done &&
    (fileSelected ||
      wid !== (existing?.workshop ?? workshop?.id ?? directory[0]?.id ?? "") ||
      JSON.stringify(selectedServices) !== JSON.stringify(initialServices) ||
      vehicle !== (existing?.vehicle ?? "") ||
      date !== (existing?.date ?? "") ||
      note !== (existing?.evidence_note ?? "") ||
      rating !== (existing?.rating ?? 0) ||
      review !== (existing?.review ?? "") ||
      kind !== (existing?.evidence_type ?? storedEvidenceTypes.invoice) ||
      consent);
  useNavigationGuard({ busy, dirty });
  useEffect(() => {
    if (!done)
      onDraftChange?.({
        submissionId,
        wid,
        kind,
        service,
        vehicle,
        date,
        note,
        rating,
        review,
        consent,
        file: selectedFile,
        dirty,
      });
  }, [
    onDraftChange,
    done,
    submissionId,
    wid,
    kind,
    service,
    vehicle,
    date,
    note,
    rating,
    review,
    consent,
    selectedFile,
    dirty,
  ]);
  function changeBusy(value: boolean) {
    setBusy(value);
    onBusyChange?.(value);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedServices.length) {
      setError(t("customer.chooseWork"));
      document.getElementById(`${id}-service`)?.focus();
      return;
    }
    if (!rating) {
      setError(t("customer.chooseStars"));
      ratingGroup.current?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }
    if (!consent) {
      setConsentError(true);
      consentCheckbox.current?.focus();
      return;
    }
    changeBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    if (selectedFile) f.set("file", selectedFile);
    f.set("id", submissionId);
    f.set("workshop", wid);
    f.set("service", selectedServices[0]);
    f.set("services", JSON.stringify(selectedServices));
    f.set("evidenceType", kind);
    f.set("rating", String(rating));
    f.set("revision", String(existing?.revision ?? 0));
    f.set("consent", "true");
    if (existing?.file_name) f.set("keepEvidence", "true");
    try {
      const r = await fetch("/api/visits", {
          method: existing ? "PUT" : "POST",
          body: f,
        }),
        d = (await r.json()) as CodedResponse;
      if (!r.ok) throw responseError(t, d);
      setDone(true);
      onSubmitted?.();
    } catch (e) {
      setError(
        e instanceof LocalizedError
          ? e.message
          : t("customer.reviewUnavailable"),
      );
    } finally {
      changeBusy(false);
    }
  }
  if (!signedIn)
    return (
      <div
        className="flex flex-col items-center gap-5 p-5 text-center"
        data-ui="review-login-prompt"
      >
        <ShieldCheck
          size={25}
          className="text-[#327b52] dark:text-[var(--theme-positive)]"
        />
        <p className={dialogCopyClassName}>{t("customer.reviewLogin")}</p>
        {workshopName && (
          <p className={dialogCopyClassName}>
            <strong>
              {t("customer.workshop")}: {workshopName}
            </strong>
          </p>
        )}
        <LocaleAnchor
          className={appButton()}
          href={`/anmelden?weiter=${encodeURIComponent(returnTo)}`}
        >
          {t("customer.loginOrRegister")}
        </LocaleAnchor>
        <p className={cn(helpTextClassName, "leading-[1.65]")}>
          {t("customer.reviewPrivacy")}
        </p>
      </div>
    );
  if (done)
    return (
      <div
        className="flex flex-col gap-[13px] py-[10px]"
        role="status"
        data-ui="review-submission-success"
      >
        <FileCheck2
          size={30}
          className="text-[#26775e] dark:text-[var(--theme-positive)]"
        />
        <h3 className="m-0 text-[20px]">{t("customer.reviewSubmitted")}</h3>
        <p className="m-0 text-[14px] leading-[1.7] text-[#5d776b] dark:text-muted-foreground">
          {t("customer.reviewSubmittedNote")}
        </p>
        <AccountStorageNotice />
      </div>
    );
  if (!directory.length)
    return (
      <p className={cn(helpTextClassName, "leading-[1.65]")}>
        {t("customer.noWorkshop")}
      </p>
    );
  return (
    <form
      id={id}
      className={formClassName}
      data-ui="review-form"
      onSubmit={submit}
      aria-label={t("customer.reviewForm")}
    >
      {workshopName && (!workshop || existing) && (
        <p className={cn(noteClassName, dialogCopyClassName)}>
          <strong>
            {t("customer.workshop")}: {workshopName}
          </strong>
        </p>
      )}
      {existing?.moderator_note && (
        <div className={noteClassName}>
          <p className={dialogCopyClassName}>
            {t("customer.moderationNote", { note: existing.moderator_note })}
          </p>
        </div>
      )}
      {existing?.status === "published" && (
        <p className={cn(noteClassName, dialogCopyClassName)}>
          {t("customer.reviewRechecked")}
        </p>
      )}
      {!workshop && (
        <Field className="min-w-0 gap-[6px] border-0 bg-transparent p-0">
          <FieldLabel
            className="m-0 block text-[14px] leading-snug font-semibold text-foreground"
            htmlFor={`${id}-workshop`}
          >
            {t("customer.workshop")}
          </FieldLabel>
          <Picker
            presentation="form"
            id={`${id}-workshop`}
            value={wid}
            onChange={setWid}
            values={directory.map((w) => w.id)}
            label={t("customer.reviewedWorkshop")}
            displayLabels={Object.fromEntries(
              directory.map((w) => [w.id, w.name]),
            )}
          />
        </Field>
      )}
      <fieldset
        className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
        data-ui="review-experience"
      >
        <legend
          className={
            presentation === "profile"
              ? "mb-0 pr-[9px] text-[16px] font-[650] text-[#254b48] dark:text-foreground"
              : "sr-only"
          }
        >
          {t("customer.experience")}
        </legend>
        <div className={formGridClassName}>
          <label className={cn(formLabelClassName, "min-w-0")}>
            {t("customer.visitDate")}
            <input
              required
              name="date"
              type="date"
              className={cn(
                inputClassName,
                "box-border min-h-[46px] min-w-0 max-w-full appearance-none [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left",
              )}
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className={cn(formLabelClassName, "min-w-0")}>
            {t("customer.vehicle")}
            <input
              required
              name="vehicle"
              className={inputClassName}
              minLength={3}
              maxLength={100}
              placeholder={t("customer.vehicleExample")}
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            />
          </label>
        </div>
        <Field className="min-w-0 gap-[6px] border-0 bg-transparent p-0">
          <FieldLabel
            className="m-0 block text-[14px] leading-snug font-semibold text-foreground"
            htmlFor={`${id}-service`}
          >
            {t("customer.completedWork")}
          </FieldLabel>
          <SearchablePicker
            presentation="form"
            id={`${id}-service`}
            required
            multiple
            value={service}
            onChange={setService}
            values={services.slice(1)}
            displayLabels={Object.fromEntries(
              services
                .slice(1)
                .map((value) => [value, valueLabel(locale, "service", value)]),
            )}
            placeholder={t("customer.choose")}
            label={t("customer.completedWork")}
          />
        </Field>
        <div>
          <label className={formLabelClassName} id={`${id}-rating`}>
            {t("customer.yourStars")}
          </label>
          <div
            className="mt-[6px] flex flex-wrap items-center gap-[5px] at-most-720:gap-[2px]"
            data-ui="star-rating"
            role="radiogroup"
            aria-labelledby={`${id}-rating`}
            aria-required="true"
            ref={ratingGroup}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                className="grid min-h-[42px] min-w-10 place-items-center rounded-lg p-[5px] text-[#bc9137] hover:bg-[#fbf3dc] aria-checked:bg-[#fbf3dc] dark:text-[var(--theme-warning)] dark:hover:bg-[#3b3020] dark:aria-checked:bg-[#3b3020] at-most-720:min-w-[38px]"
                aria-checked={rating === value}
                aria-label={t("customer.stars", { count: value })}
                tabIndex={rating === value || (!rating && value === 1) ? 0 : -1}
                onClick={() => {
                  setRating(value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (
                    [
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowLeft",
                      "ArrowDown",
                      "Home",
                      "End",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    const next =
                      e.key === "Home"
                        ? 1
                        : e.key === "End"
                          ? 5
                          : Math.max(
                              1,
                              Math.min(
                                5,
                                value +
                                  (["ArrowRight", "ArrowUp"].includes(e.key)
                                    ? 1
                                    : -1),
                              ),
                            );
                    setRating(next);
                    e.currentTarget.parentElement
                      ?.querySelectorAll<HTMLButtonElement>("button")
                      [next - 1]?.focus();
                  }
                }}
              >
                <Star
                  size={26}
                  fill={value <= rating ? "currentColor" : "none"}
                />
              </button>
            ))}
            <span className="ml-[6px] text-[13px] text-muted-foreground at-most-720:text-[12px]">
              {rating ? `${rating} / 5` : t("customer.choose")}
            </span>
          </div>
        </div>
        <details
          data-ui="review-optional"
          open={!!existing?.review || !!draft?.review}
        >
          <summary className="cursor-pointer py-[6px] text-[14px] font-semibold focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px]">
            {t("customer.yourReview")}
          </summary>
          <textarea
            name="review"
            className={textareaClassName}
            aria-label={t("customer.yourReview")}
            maxLength={reviewTextMaxLength}
            rows={2}
            placeholder={t("customer.reviewPlaceholder")}
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />
        </details>
      </fieldset>
      <fieldset
        className="mt-[3px] flex min-w-0 flex-col gap-4 border-0 border-t border-[#e0e8ea] pt-[18px] dark:border-border"
        data-ui="review-evidence"
      >
        <legend
          className={cn(
            "pr-[9px] text-[15px] font-[650] text-[#254b48] dark:text-foreground",
            presentation === "profile" && "mb-3 text-[16px]",
          )}
        >
          {t("customer.privateEvidence")}
        </legend>
        <Field className="min-w-0 gap-[6px] border-0 bg-transparent p-0">
          <FieldLabel
            className="m-0 block text-[14px] leading-snug font-semibold text-foreground"
            htmlFor={`${id}-kind`}
          >
            {t("customer.evidenceType")}
          </FieldLabel>
          <Picker
            presentation="form"
            id={`${id}-kind`}
            value={kind}
            onChange={setKind}
            values={[
              storedEvidenceTypes.invoice,
              storedEvidenceTypes.workOrder,
              storedEvidenceTypes.other,
            ]}
            valueCategory="evidence"
            label={t("customer.evidenceType")}
          />
        </Field>
        {existing?.file_name && (
          <p className="flex flex-wrap items-center gap-[7px] rounded-lg bg-[#f2f7f5] px-[13px] py-[11px] text-[14px] leading-[1.65] text-[#566c71] [overflow-wrap:anywhere] dark:bg-[var(--theme-surface)] dark:text-muted-foreground">
            <FileCheck2 size={17} />
            {t("customer.existingReceipt", { name: existing.file_name })}
            <span className="w-full text-[12px] text-muted-foreground">
              {t("customer.keepReceipt")}
            </span>
          </p>
        )}
        <label
          className={cn(
            formLabelClassName,
            "flex flex-col items-center gap-1 rounded-[9px] border border-dashed border-[#95b39f] bg-[#f9fbf7] p-5 dark:border-border dark:bg-[var(--theme-surface)] dark:text-muted-foreground",
          )}
        >
          <Upload size={20} className="mb-[7px] text-[#639571]" />
          <strong>
            {existing?.file_name
              ? t("customer.replaceReceipt")
              : t("customer.uploadReceipt")}
          </strong>
          <span className={formHintClassName}>{t("customer.fileTypes")}</span>
          <input
            name="file"
            type="file"
            className="mt-[10px] w-full max-w-[320px] text-[13px] font-normal"
            onChange={(event) =>
              setSelectedFile(event.target.files?.[0] ?? null)
            }
            accept="application/pdf,image/jpeg,image/png"
            required={
              kind !== storedEvidenceTypes.other &&
              !existing?.file_name &&
              !selectedFile
            }
          />
          {selectedFile && (
            <span
              data-ui="review-selected-file"
              className={cn(
                formHintClassName,
                presentation === "profile" &&
                  "font-[550] text-foreground [overflow-wrap:anywhere]",
              )}
            >
              {selectedFile.name}
            </span>
          )}
        </label>
        {kind === storedEvidenceTypes.other ? (
          <label className={formLabelClassName}>
            {t("customer.describeEvidence")}
            <textarea
              name="evidenceNote"
              className={textareaClassName}
              rows={2}
              minLength={40}
              required
              maxLength={3000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("customer.evidenceExample")}
            />
          </label>
        ) : (
          <details
            data-ui="review-optional"
            open={!!existing?.evidence_note || !!draft?.note}
          >
            <summary className="cursor-pointer py-[6px] text-[14px] font-semibold focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px]">
              {t("customer.receiptNote")}
            </summary>
            <textarea
              name="evidenceNote"
              className={textareaClassName}
              aria-label={t("customer.receiptNote")}
              rows={2}
              maxLength={3000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("customer.evidenceHelp")}
            />
          </details>
        )}
        <p className={cn(helpTextClassName, "leading-[1.65]")}>
          {t("customer.redactNote")}
        </p>
      </fieldset>
      <div
        className={cn(
          "rounded-lg border border-[#d6e1d8] bg-[#f7faf6] p-4 dark:border-border dark:bg-[var(--theme-surface)] dark:text-muted-foreground at-most-720:p-[14px]",
          consentError &&
            "border-[#c4584b] bg-[#fff7f5] dark:border-[#75413e] dark:bg-[#3a2426] dark:text-[var(--theme-danger)]",
        )}
        data-ui="review-consent"
      >
        <label
          className={cn(formLabelClassName, "flex items-start gap-[10px]")}
          htmlFor={consentId}
        >
          <Checkbox
            id={consentId}
            ref={consentCheckbox}
            className="mt-[2px] shrink-0"
            checked={consent}
            onCheckedChange={(v) => {
              setConsent(v === true);
              if (v === true) setConsentError(false);
            }}
            aria-label={t("customer.consentTitle")}
            aria-invalid={consentError}
            aria-describedby={`${consentId}-help${consentError ? ` ${consentId}-error` : ""}`}
          />
          <span
            className="flex flex-col gap-[6px] text-[13px] font-normal leading-[1.7] text-[#697d6d] dark:text-muted-foreground"
            id={`${consentId}-help`}
          >
            {t("customer.consentNote")}
          </span>
        </label>
        {consentError && (
          <p
            className="mt-3 ml-[29px] text-[14px] font-semibold leading-[1.6] text-[#a73c30] dark:text-[var(--theme-danger)] at-most-720:ml-0"
            id={`${consentId}-error`}
            role="alert"
          >
            {t("customer.consentError")}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className={errorClassName}>
          {error}
        </p>
      )}
      {showSubmit && (
        <button
          type="submit"
          disabled={busy}
          className={cn(
            appButton(),
            "min-h-[45px] self-start px-[22px] at-most-720:w-full",
          )}
        >
          {busy ? (
            <>
              <LoaderCircle
                className="inline-block animate-[spin_1s_linear_infinite]"
                size={17}
              />
              {t("customer.submitting")}
            </>
          ) : (
            t("customer.submitReview")
          )}
        </button>
      )}
    </form>
  );
}
