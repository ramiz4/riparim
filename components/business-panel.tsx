"use client";
import {
  dialogHeaderClassName,
  dialogTitleClassName,
  dialogDescriptionClassName,
  dialogFooterClassName,
  confirmationCancelClassName,
  appButton,
  contentTitleClassName,
  errorClassName,
  formLabelClassName,
  confirmationDialogClassName,
} from "@/lib/presentation";
import { cn } from "@/lib/utils";

import { Building2, Clock3, Download, MapPin, PencilLine } from "lucide-react";
import { WorkshopEmailsEditor } from "./workshop-emails";
import {
  sameWorkshopEmailEdits,
  workshopEmailEditsSchema,
} from "@/lib/workshop-emails";
import { AdminLoading } from "@/components/admin-loading";
import {
  OpeningHoursEditor,
  OpeningHoursDetails,
} from "@/components/opening-hours";
import { useI18n } from "@/lib/i18n/client";
import {
  responseError,
  LocalizedError,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { valueLabel } from "@/lib/i18n/values";
import { formatDate } from "@/lib/i18n/format";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { LocaleAnchor } from "@/components/locale-anchor";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { services, type Workshop } from "@/lib/workshops";
import {
  editableBusinessProfile,
  type BusinessProfile,
  type BusinessRequest,
  type BusinessState,
} from "@/lib/business-contract";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import {
  SelectWithOther,
  selectedChoiceText,
  type SelectionDraft,
} from "@/components/select-with-other";
import { ModalBody, ModalContent } from "@/components/modal-shell";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const businessDecisionReasons = {
  claim: {
    approved: [
      {
        value: "ownership_verified",
        label: "management.businessReasonOwnershipVerified",
      },
    ],
    rejected: [
      {
        value: "ownership_unproven",
        label: "management.businessReasonOwnershipUnproven",
      },
      {
        value: "evidence_incomplete",
        label: "management.businessReasonEvidenceIncomplete",
      },
      {
        value: "evidence_mismatch",
        label: "management.businessReasonEvidenceMismatch",
      },
      {
        value: "already_assigned",
        label: "management.businessReasonAlreadyAssigned",
      },
    ],
  },
  change: {
    approved: [
      {
        value: "changes_verified",
        label: "management.businessReasonChangesVerified",
      },
    ],
    rejected: [
      {
        value: "changes_unverified",
        label: "management.businessReasonChangesUnverified",
      },
      {
        value: "contact_unverified",
        label: "management.businessReasonContactUnverified",
      },
      {
        value: "inconsistent_details",
        label: "management.businessReasonInconsistentDetails",
      },
    ],
  },
} as const;

function restoreDialogFocus(
  event: Event,
  opener: HTMLButtonElement | null,
  fallback: HTMLElement | null,
) {
  event.preventDefault();
  // Keep a later intentional focus move made after the dialog closed.
  if (
    document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body &&
    document.activeElement.isConnected
  )
    return;
  const target =
    opener?.isConnected && !opener.disabled
      ? opener
      : fallback?.isConnected
        ? fallback
        : null;
  if (target) {
    if (target !== opener) target.tabIndex = -1;
    target.focus();
  }
}

export function BusinessPanel({
  moderation = false,
  view = "businesses",
}: {
  moderation?: boolean;
  view?: "businesses" | "requests";
}) {
  const { locale, t } = useI18n();
  const editorFormId = useId(),
    editOpener = useRef<HTMLButtonElement | null>(null),
    pageHeading = useRef<HTMLHeadingElement | null>(null),
    decisionOpener = useRef<HTMLButtonElement | null>(null),
    claimQueueHeading = useRef<HTMLHeadingElement | null>(null),
    changeQueueHeading = useRef<HTMLHeadingElement | null>(null);
  const [decisionQueue, setDecisionQueue] = useState<"claim" | "change">(
    "claim",
  );
  const showProfiles = !moderation && view === "businesses",
    showRequests = moderation || view === "requests";
  const statusLabels: Record<string, string> = {
    pending: t("management.businessPending"),
    approved: t("management.businessApproved"),
    rejected: t("management.businessRejected"),
  };
  const errorMessage = useCallback(
    (error: unknown) =>
      error instanceof LocalizedError
        ? error.message
        : t("management.businessNetwork"),
    [t],
  );
  const [state, setState] = useState<BusinessState | null>(null),
    [loading, setLoading] = useState(true),
    [loadFailed, setLoadFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState<Workshop | null>(null),
    [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [decision, setDecision] = useState<{
      request: BusinessRequest;
      kind: "claim" | "change";
      approve: boolean;
    } | null>(null),
    [decisionDraft, setDecisionDraft] = useState<SelectionDraft>({
      choice: "",
      detail: "",
    });
  useNavigationGuard({
    busy,
    dirty:
      !!decisionDraft.choice ||
      !!decisionDraft.detail ||
      (!!editing &&
        !!profile &&
        JSON.stringify(profile) !==
          JSON.stringify(editableBusinessProfile(editing))),
  });
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setLoadFailed(false);
      setError("");
      try {
        const response = await fetch(
            `/api/business${moderation ? "?moderation=1" : ""}`,
            { cache: "no-store", signal },
          ),
          data = (await response.json()) as BusinessState;
        if (!response.ok) throw responseError(t, data);
        if (signal?.aborted) return;
        setState(data);
        return true;
      } catch (e) {
        if (!signal?.aborted) {
          setLoadFailed(true);
          setError(errorMessage(e));
        }
        return false;
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [moderation, t, errorMessage],
  );
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the authorized request queue or owned profiles when this panel mounts.
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function loadMore(kind: "claim" | "change") {
    const cursor =
      kind === "claim" ? state?.nextClaimCursor : state?.nextChangeCursor;
    if (!cursor || busy) return;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        [kind === "claim" ? "claimCursor" : "changeCursor"]: cursor,
      });
      if (moderation) params.set("moderation", "1");
      const response = await fetch(`/api/business?${params}`, {
          cache: "no-store",
        }),
        data = (await response.json()) as BusinessState;
      if (!response.ok) throw responseError(t, data);
      setState((old) =>
        old
          ? kind === "claim"
            ? {
                ...old,
                workshops: data.workshops,
                pendingClaims: data.pendingClaims,
                pendingChangeWorkshopIds: data.pendingChangeWorkshopIds,
                pendingChangeRequestIds: data.pendingChangeRequestIds,
                claims: [...old.claims, ...data.claims],
                nextClaimCursor: data.nextClaimCursor,
              }
            : {
                ...old,
                workshops: data.workshops,
                pendingClaims: data.pendingClaims,
                pendingChangeWorkshopIds: data.pendingChangeWorkshopIds,
                pendingChangeRequestIds: data.pendingChangeRequestIds,
                changes: [...old.changes, ...data.changes],
                nextChangeCursor: data.nextChangeCursor,
              }
          : old,
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function mutate(method: string, body: unknown) {
    const response = await fetch("/api/business", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      data = (await response.json()) as CodedResponse;
    if (!response.ok) throw responseError(t, data);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing || !profile || busy || loading) return;
    setBusy(true);
    setError("");
    setFeedback("");
    const proposal = { ...profile };
    // An unchanged empty owner plan must not suppress imported fallback hours.
    if (
      JSON.stringify(profile.openingHours ?? null) ===
      JSON.stringify(editing.openingHours ?? null)
    )
      delete proposal.openingHours;
    try {
      const parsedEmails = workshopEmailEditsSchema.safeParse(
        (profile.emailEntries ?? [])
          .map((entry) => ({ ...entry, address: entry.address.trim() }))
          .filter((entry) => entry.address),
      );
      if (!parsedEmails.success)
        throw new LocalizedError(t("common.invalidRequest"));
      proposal.emailEntries = parsedEmails.data;
      if (
        sameWorkshopEmailEdits(
          proposal.emailEntries,
          editableBusinessProfile(editing).emailEntries ?? [],
        )
      )
        delete proposal.emailEntries;
      await mutate("POST", {
        kind: "change",
        workshopId: editing.id,
        profile: proposal,
      });
      setEditing(null);
      setProfile(null);
      const refreshed = await load();
      setFeedback(t("management.draftSubmitted"));
      if (!refreshed) setError(t("management.businessSavedReloadFailed"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const decisionOptions = decision
    ? [
        ...businessDecisionReasons[decision.kind][
          decision.approve ? "approved" : "rejected"
        ].map((reason) => ({ value: reason.value, label: t(reason.label) })),
        { value: "other", label: t("management.otherReason") },
      ]
    : [];
  const decisionNote = selectedChoiceText(decisionDraft, decisionOptions);
  async function decide() {
    if (!decision || busy || decisionNote.length < 10) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      await mutate("PATCH", {
        kind: decision.kind,
        id: decision.request.id,
        revision: decision.request.revision,
        decision: decision.approve ? "approved" : "rejected",
        note: decisionNote,
      });
      setDecision(null);
      setDecisionDraft({ choice: "", detail: "" });
      await load();
      setFeedback(t("management.decisionSaved"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const documentLinks = (
    request: Pick<BusinessRequest, "id" | "fileName" | "documents">,
  ) => {
    const documents =
      request.documents ??
      (request.fileName ? [{ id: "", fileName: request.fileName }] : []);
    return documents.length ? (
      <ul className="mt-5 mb-0 grid list-none gap-2 border-t border-border pt-4 pl-0">
        {documents.map((document) => (
          <li key={document.id}>
            <LocaleAnchor
              className="group flex min-h-11 w-fit max-w-full items-center gap-2.5 rounded text-[var(--theme-accent)] no-underline focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-ring"
              aria-label={t("management.ownershipDownload", {
                name: document.fileName,
              })}
              href={`/api/business/evidence/${request.id}?locale=${locale}${document.id ? `&document=${document.id}` : ""}`}
            >
              <Download size={18} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold underline underline-offset-[3px] group-hover:decoration-2">
                  {t("management.ownershipDocument")}
                </span>
                <span className="block text-[12px] leading-[1.5] text-muted-foreground [overflow-wrap:anywhere]">
                  {document.fileName}
                </span>
              </span>
            </LocaleAnchor>
          </li>
        ))}
      </ul>
    ) : null;
  };
  function requestList(requests: BusinessRequest[], kind: "claim" | "change") {
    return requests.map((request) => {
      const proposal = request.profile && (
        <dl
          data-ui="business-proposal"
          className="my-4 grid grid-cols-[150px_minmax(0,1fr)] gap-2 text-[14px] leading-[1.6] at-most-720:grid-cols-1 at-most-720:gap-[3px]"
        >
          <dt className="font-semibold">{t("management.phone")}</dt>
          <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
            {request.profile.phone}
          </dd>
          <dt className="font-semibold">{t("management.phoneNote")}</dt>
          <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
            {request.profile.phoneNote || "–"}
          </dd>
          <dt className="font-semibold">WhatsApp</dt>
          <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
            {request.profile.whatsapp || "–"}
          </dd>
          <dt className="font-semibold">{t("management.services")}</dt>
          <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
            {request.profile.services
              .map((service) => valueLabel(locale, "service", service))
              .join(", ")}{" "}
            · {request.profile.serviceDetails.join(", ")}
          </dd>
          <dt className="font-semibold">{t("management.description")}</dt>
          <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
            {request.profile.description}
          </dd>
          <dt className="font-semibold">{t("common.workshopEmails")}</dt>
          <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
            {request.profile.emailEntries === undefined
              ? t("common.workshopEmailsUnchanged")
              : request.profile.emailEntries
                  .map(
                    (e) =>
                      `${e.address} (${e.active ? t("common.workshopEmailActive") : t("common.workshopEmailInactive")}; ${e.verified ? t("common.workshopEmailVerified") : t("common.workshopEmailUnverified")})`,
                  )
                  .join(", ") || "–"}
          </dd>
          <dt className="font-semibold">{t("common.hoursTitle")}</dt>
          <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
            {request.profile.openingHours === undefined ? (
              <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
                {t("common.hoursUnchanged")}
              </p>
            ) : (
              <OpeningHoursDetails hours={request.profile.openingHours} />
            )}
          </dd>
        </dl>
      );
      const RequestHeading = moderation || kind === "change" ? "h3" : "h2";
      return (
        <article
          data-ui="business-request"
          className="mt-4 rounded-[10px] border border-border bg-card p-6 [overflow-wrap:anywhere] at-most-720:p-3.5"
          key={request.id}
        >
          <div className="flex items-start justify-between gap-3 at-most-720:block">
            <RequestHeading
              className={cn(
                "m-0 min-w-0 text-[18px] leading-[1.4]",
                moderation || kind === "change"
                  ? "font-semibold"
                  : "font-[650] tracking-[-0.3px]",
              )}
            >
              {request.workshopName}
            </RequestHeading>
            <span
              data-ui="business-status"
              data-status={request.status}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[20px] px-2.5 py-1 text-[12px] leading-[1.5] font-semibold whitespace-nowrap before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-[''] at-most-720:mt-2",
                request.status === "pending"
                  ? "bg-[#fff1ce] text-[#795510] dark:bg-[#3b3020] dark:text-[#f2ca75]"
                  : request.status === "approved"
                    ? "bg-[#e5f4ea] text-[#22663c] dark:bg-[#163e32] dark:text-[#85dbac]"
                    : request.status === "rejected"
                      ? "bg-accent text-destructive"
                      : "bg-accent text-foreground",
              )}
            >
              {kind === "change" && request.status === "approved"
                ? t("management.businessChangeApproved")
                : (statusLabels[request.status] ?? request.status)}
            </span>
          </div>
          <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
            {kind === "claim"
              ? t("management.claimType")
              : t("management.draftType")}{" "}
            · {formatDate(locale, request.createdAt)}
          </p>
          {moderation && kind === "claim" && (
            <>
              <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
                {t("management.applicant", { owner: request.owner })}
              </p>
              <p
                data-ui="business-evidence"
                className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground whitespace-pre-wrap"
              >
                {request.evidence}
              </p>
              {request.evidenceLinks?.length ? (
                <ul>
                  {request.evidenceLinks.map((link) => (
                    <li key={link}>
                      <LocaleAnchor
                        className="text-[var(--theme-accent)] underline underline-offset-[3px]"
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link}
                      </LocaleAnchor>
                    </li>
                  ))}
                </ul>
              ) : (
                !request.documents?.length &&
                !request.fileName && (
                  <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
                    {t("management.noProofLinks")}
                  </p>
                )
              )}
            </>
          )}
          {kind === "claim" && documentLinks(request)}
          {request.profile &&
            (moderation ? (
              proposal
            ) : (
              <details>
                <summary className="min-h-11 cursor-pointer py-2.5 text-[14px] text-[var(--theme-accent)] focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring">
                  {t("management.submittedDetails")}
                </summary>
                {proposal}
              </details>
            ))}
          {moderation && kind === "change" && (
            <>
              <details data-ui="business-current">
                <summary>{t("management.approvedDetails")}</summary>
                {state?.workshops
                  .filter((workshop) => workshop.id === request.workshopId)
                  .map((workshop) => (
                    <dl
                      data-ui="business-proposal"
                      className="my-4 grid grid-cols-[150px_minmax(0,1fr)] gap-2 text-[14px] leading-[1.6] at-most-720:grid-cols-1 at-most-720:gap-[3px]"
                      key={workshop.id}
                    >
                      <dt className="font-semibold">{t("management.phone")}</dt>
                      <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
                        {workshop.phone}
                      </dd>
                      <dt className="font-semibold">
                        {t("management.phoneNote")}
                      </dt>
                      <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
                        {workshop.phoneNote || "–"}
                      </dd>
                      <dt className="font-semibold">WhatsApp</dt>
                      <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
                        {workshop.whatsapp || "–"}
                      </dd>
                      <dt className="font-semibold">
                        {t("management.services")}
                      </dt>
                      <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
                        {workshop.services
                          .map((service) =>
                            valueLabel(locale, "service", service),
                          )
                          .join(", ")}{" "}
                        · {workshop.serviceDetails.join(", ")}
                      </dd>
                      <dt className="font-semibold">
                        {t("management.description")}
                      </dt>
                      <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
                        {workshop.description}
                      </dd>
                      <dt className="font-semibold">
                        {t("common.workshopEmails")}
                      </dt>
                      <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
                        {workshop.editableEmailContacts
                          ?.map(
                            (e) =>
                              `${e.address} (${e.active ? t("common.workshopEmailActive") : t("common.workshopEmailInactive")}; ${e.verified ? t("common.workshopEmailVerified") : t("common.workshopEmailUnverified")})`,
                          )
                          .join(", ") || "–"}
                      </dd>
                      <dt className="font-semibold">
                        {t("common.hoursTitle")}
                      </dt>
                      <dd className="whitespace-pre-wrap at-most-720:mb-2.5">
                        <OpeningHoursDetails hours={workshop.openingHours} />
                      </dd>
                    </dl>
                  ))}
              </details>
              <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
                {t("management.checkChanges")}
              </p>
            </>
          )}
          {!moderation && (
            <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
              {kind === "claim"
                ? request.status === "pending"
                  ? t("management.claimPendingHelp")
                  : request.status === "approved"
                    ? t("management.claimApprovedHelp")
                    : request.status === "rejected"
                      ? t("management.claimRejectedHelp")
                      : null
                : request.status === "pending"
                  ? t("management.draftPending")
                  : request.status === "approved"
                    ? t("management.changeApprovedHelp")
                    : request.status === "rejected"
                      ? t("management.changeRejectedHelp")
                      : null}
            </p>
          )}
          {request.moderatorNote && (
            <p
              data-ui="business-note"
              className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground whitespace-pre-wrap"
            >
              {t("management.moderatorNote", { note: request.moderatorNote })}
            </p>
          )}
          {moderation && (
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                className={cn(appButton(), "px-[13px] py-2")}
                disabled={busy}
                onClick={(event) => {
                  decisionOpener.current = event.currentTarget;
                  setDecisionQueue(kind);
                  setDecision({ request, kind, approve: true });
                  setDecisionDraft({ choice: "", detail: "" });
                  setError("");
                }}
              >
                {t("management.approve")}
              </button>
              <button
                className={cn(
                  appButton({ variant: "outline" }),
                  "px-[13px] py-2",
                )}
                disabled={busy}
                onClick={(event) => {
                  decisionOpener.current = event.currentTarget;
                  setDecisionQueue(kind);
                  setDecision({ request, kind, approve: false });
                  setDecisionDraft({ choice: "", detail: "" });
                  setError("");
                }}
              >
                {t("management.reject")}
              </button>
            </div>
          )}
        </article>
      );
    });
  }
  const visibleClaims =
    state?.claims.filter(
      (request) => moderation || request.status !== "pending",
    ) ?? [];
  const pendingChangeRequestIds = state?.pendingChangeRequestIds ?? [];
  const visibleChanges =
    state?.changes.filter(
      (request) =>
        moderation ||
        request.status !== "pending" ||
        pendingChangeRequestIds.includes(request.id),
    ) ?? [];
  return (
    <div
      data-ui="business-panel"
      className={moderation ? "mt-[18px]" : "mt-0"}
      aria-busy={busy || loading}
    >
      {!moderation && (
        <header className="mb-[var(--content-page-gap)]">
          <div className="min-w-0">
            <h1
              className={cn(contentTitleClassName, "focus:outline-none")}
              ref={pageHeading}
              tabIndex={-1}
            >
              {t(
                view === "requests"
                  ? "management.myApplications"
                  : "management.myBusiness",
              )}
            </h1>
            <p className="text-muted-foreground mt-2 mb-0 text-[15px] leading-[1.6]">
              {t(
                view === "requests"
                  ? "management.applicationsIntro"
                  : "management.businessIntro",
              )}
            </p>
          </div>
        </header>
      )}
      {error && !decision && !(showProfiles && editing) && (
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
      {feedback && (
        <p
          className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground"
          role="status"
        >
          {feedback}
        </p>
      )}
      {loadFailed && (
        <button
          className={cn(appButton({ variant: "outline" }), "px-[13px] py-2")}
          disabled={busy || loading}
          onClick={() => void load()}
        >
          {t("management.retryBusiness")}
        </button>
      )}
      {loading &&
        state &&
        (moderation ? (
          <AdminLoading compact>
            {t("management.businessRefreshing")}
          </AdminLoading>
        ) : (
          <p
            className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground"
            role="status"
          >
            {t("management.businessRefreshing")}
          </p>
        ))}
      {loading && !state ? (
        moderation ? (
          <AdminLoading>{t("management.businessLoading")}</AdminLoading>
        ) : (
          <p
            className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground"
            role="status"
          >
            {t("management.businessLoading")}
          </p>
        )
      ) : state ? (
        <>
          {showProfiles && state.workshops.length === 0 && (
            <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
              {t("management.businessEmpty")}
            </p>
          )}
          {!moderation &&
            view === "requests" &&
            state.pendingClaims.length === 0 &&
            visibleClaims.length === 0 &&
            visibleChanges.length === 0 &&
            !state.nextClaimCursor &&
            !state.nextChangeCursor && (
              <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
                {t("management.applicationsEmpty")}
              </p>
            )}
          {showProfiles && state.workshops.length > 0 && (
            <div className="mt-7 grid gap-3.5">
              {state.workshops.map((workshop) => (
                <article
                  data-ui="business-request"
                  className="border border-border bg-card [overflow-wrap:anywhere] m-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 rounded-[14px] p-6 transition-[border-color] duration-150 ease-[ease] hover:border-[color-mix(in_srgb,var(--theme-accent)_45%,var(--border))] motion-reduce:transition-none at-most-720:grid-cols-[minmax(0,1fr)] at-most-720:gap-[18px] at-most-720:p-5"
                  key={workshop.id}
                >
                  <div className="flex min-w-0 items-center gap-[18px] at-most-720:items-start at-most-720:gap-3">
                    <span
                      className="grid size-14 flex-[0_0_56px] place-items-center rounded-full bg-accent text-[var(--theme-accent)] at-most-720:size-11 at-most-720:basis-11"
                      aria-hidden="true"
                    >
                      <Building2 size={24} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="m-0 text-[19px] leading-[1.4] font-[650] tracking-[-0.25px] at-most-720:text-[17px]">
                        {workshop.name}
                      </h2>
                      <p className="text-muted-foreground mt-2 mb-0 flex items-start gap-1.5 text-[13px] leading-[1.5]">
                        <MapPin
                          className="mt-0.5"
                          size={15}
                          aria-hidden="true"
                        />
                        <span>
                          <strong className="font-medium">
                            {workshop.city}
                          </strong>
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">
                            {workshop.address}
                          </span>
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    className={cn(
                      appButton({ variant: "outline" }),
                      "px-[13px] py-2 min-h-11 bg-transparent whitespace-nowrap at-most-720:ml-14 at-most-720:justify-self-start",
                    )}
                    aria-label={`${t("management.editDraft")}: ${workshop.name}`}
                    disabled={
                      busy ||
                      loading ||
                      state.pendingChangeWorkshopIds.includes(workshop.id)
                    }
                    onClick={(event) => {
                      editOpener.current = event.currentTarget;
                      setEditing(workshop);
                      setProfile(editableBusinessProfile(workshop));
                      setError("");
                    }}
                  >
                    <PencilLine size={16} aria-hidden="true" />
                    {t("management.editDraft")}
                  </button>
                  {state.pendingChangeWorkshopIds.includes(workshop.id) && (
                    <p className="text-muted-foreground col-span-full m-0 flex items-start gap-2 border-t border-border pt-3.5 text-[13px] leading-[1.5] at-most-720:col-start-1">
                      <Clock3
                        className="mt-0.5 text-[var(--theme-warning)]"
                        size={16}
                        aria-hidden="true"
                      />
                      {t("management.draftPending")}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
          <Dialog
            open={showProfiles && !!editing && !!profile}
            onOpenChange={(open) => {
              if (!open && !busy) {
                setEditing(null);
                setProfile(null);
                setError("");
              }
            }}
          >
            <ModalContent
              className="max-w-[min(750px,calc(100%_-_32px))] sm:max-w-[min(750px,calc(100%_-_32px))]"
              title={t("management.draftFor", { name: editing?.name ?? "" })}
              description={t("management.identityProtected")}
              closeDisabled={busy}
              onEscapeKeyDown={(event) => {
                if (busy) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (busy) event.preventDefault();
              }}
              onCloseAutoFocus={(event) =>
                restoreDialogFocus(
                  event,
                  editOpener.current,
                  pageHeading.current,
                )
              }
              footer={
                <>
                  <DialogClose asChild>
                    <button
                      className={cn(
                        appButton({ variant: "outline" }),
                        "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:px-[13px]",
                      )}
                      disabled={busy}
                    >
                      {t("management.cancel")}
                    </button>
                  </DialogClose>
                  <button
                    className={cn(
                      appButton(),
                      "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:flex-1",
                    )}
                    type="submit"
                    form={editorFormId}
                    disabled={busy || loading}
                  >
                    {busy
                      ? t("management.saving")
                      : t("management.submitDraft")}
                  </button>
                </>
              }
            >
              {editing && profile && (
                <form
                  data-ui="business-form"
                  id={editorFormId}
                  className="min-w-0"
                  onSubmit={save}
                >
                  <fieldset
                    className="grid min-w-0 gap-4 border-0 p-0"
                    disabled={busy || loading}
                  >
                    <label
                      className={cn(
                        formLabelClassName,
                        "grid gap-[7px] text-foreground",
                      )}
                    >
                      {t("management.phone")}
                      <input
                        className="w-full min-w-0 min-h-11 rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring"
                        required
                        maxLength={30}
                        value={profile.phone}
                        onChange={(event) =>
                          setProfile({ ...profile, phone: event.target.value })
                        }
                      />
                    </label>
                    <label
                      className={cn(
                        formLabelClassName,
                        "grid gap-[7px] text-foreground",
                      )}
                    >
                      {t("management.phoneNote")}
                      <input
                        className="w-full min-w-0 min-h-11 rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring"
                        maxLength={150}
                        value={profile.phoneNote}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            phoneNote: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label
                      className={cn(
                        formLabelClassName,
                        "grid gap-[7px] text-foreground",
                      )}
                    >
                      {t("management.whatsAppOptional")}
                      <input
                        className="w-full min-w-0 min-h-11 rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring"
                        maxLength={30}
                        value={profile.whatsapp}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            whatsapp: event.target.value,
                          })
                        }
                      />
                    </label>
                    <WorkshopEmailsEditor
                      presentation="business"
                      emails={profile.emailEntries ?? []}
                      onChange={(emailEntries) =>
                        setProfile({ ...profile, emailEntries })
                      }
                    />
                    <OpeningHoursEditor
                      hours={profile.openingHours}
                      onChange={(openingHours) =>
                        setProfile({ ...profile, openingHours })
                      }
                    />
                    <fieldset className="grid min-w-0 gap-4 grid-cols-2 at-most-720:grid-cols-1">
                      <legend className="mb-3 text-[14px] font-semibold">
                        {t("management.services")}
                      </legend>
                      {services.slice(1).map((service) => (
                        <label
                          className={cn(
                            formLabelClassName,
                            "text-foreground flex min-h-11 items-center gap-2.5 font-normal",
                          )}
                          key={service}
                        >
                          <input
                            className="size-[18px] accent-[var(--theme-accent)]"
                            type="checkbox"
                            checked={profile.services.includes(service)}
                            onChange={(event) =>
                              setProfile({
                                ...profile,
                                services: event.target.checked
                                  ? [...profile.services, service]
                                  : profile.services.filter(
                                      (value) => value !== service,
                                    ),
                              })
                            }
                          />
                          {valueLabel(locale, "service", service)}
                        </label>
                      ))}
                    </fieldset>
                    <label
                      className={cn(
                        formLabelClassName,
                        "grid gap-[7px] text-foreground",
                      )}
                    >
                      {t("management.specificWork")}
                      <textarea
                        className="w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring min-h-[110px] resize-y font-normal"
                        required
                        maxLength={6030}
                        value={profile.serviceDetails.join("\n")}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            serviceDetails: event.target.value.split("\n"),
                          })
                        }
                      />
                    </label>
                    <label
                      className={cn(
                        formLabelClassName,
                        "grid gap-[7px] text-foreground",
                      )}
                    >
                      {t("management.description")}
                      <textarea
                        className="w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring min-h-[110px] resize-y font-normal"
                        required
                        minLength={20}
                        maxLength={2000}
                        value={profile.description}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            description: event.target.value,
                          })
                        }
                      />
                    </label>
                    {error && (
                      <p
                        className={cn(errorClassName, "leading-[1.65]")}
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                  </fieldset>
                </form>
              )}
            </ModalContent>
          </Dialog>
          {showRequests &&
            (moderation ||
              state.pendingClaims.length > 0 ||
              visibleClaims.length > 0 ||
              state.nextClaimCursor) && (
              <section
                data-ui="business-section"
                className="mt-[var(--content-page-gap)] min-w-0"
              >
                {moderation && (
                  <h2
                    className="mb-3 text-[22px] leading-[1.3] font-[650] tracking-[-0.3px]"
                    ref={claimQueueHeading}
                    tabIndex={-1}
                  >
                    {t("management.claimsReview")}
                  </h2>
                )}
                {!moderation &&
                  state.pendingClaims.map((request) => (
                    <article
                      data-ui="business-request"
                      className="mt-4 rounded-[10px] border border-border bg-card p-6 [overflow-wrap:anywhere] at-most-720:p-3.5"
                      key={request.id}
                    >
                      <div className="flex items-start justify-between gap-3 at-most-720:block">
                        <h2 className="font-[650] tracking-[-0.3px] m-0 min-w-0 text-[18px] leading-[1.4]">
                          {request.workshopName}
                        </h2>
                        <span
                          data-ui="business-status"
                          data-status="pending"
                          className="inline-flex items-center gap-1.5 rounded-[20px] px-2.5 py-1 text-[12px] leading-[1.5] font-semibold whitespace-nowrap before:size-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-[''] at-most-720:mt-2 bg-[#fff1ce] text-[#795510] dark:bg-[#3b3020] dark:text-[#f2ca75]"
                        >
                          {t("management.businessPending")}
                        </span>
                      </div>
                      <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
                        {t("management.claimType")} ·{" "}
                        {formatDate(locale, request.createdAt)}
                      </p>
                      <div
                        data-ui="business-claim-progress"
                        className="mt-[22px] flex items-start gap-3"
                      >
                        <Clock3
                          className="mt-[3px] text-[var(--theme-accent)]"
                          size={20}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <strong className="block text-[15px] leading-[1.5] font-semibold">
                            {t("management.claimPendingTitle")}
                          </strong>
                          <p className="text-[14px] leading-[1.7] text-muted-foreground mt-1 mb-0">
                            {t("management.claimPendingHelp")}
                          </p>
                        </div>
                      </div>
                      <p className="text-muted-foreground mt-3.5 mb-0 text-[13px] leading-[1.7]">
                        {t("management.claimPendingNext")}
                      </p>
                      {documentLinks(request)}
                    </article>
                  ))}
                {visibleClaims.length ? (
                  requestList(visibleClaims, "claim")
                ) : moderation ? (
                  <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
                    {t("management.noClaimsReview")}
                  </p>
                ) : null}
                {state.nextClaimCursor && (
                  <button
                    className={cn(
                      appButton({ variant: "outline" }),
                      "px-[13px] py-2",
                    )}
                    disabled={busy || loading}
                    onClick={() => void loadMore("claim")}
                  >
                    {t("management.moreClaims")}
                  </button>
                )}
              </section>
            )}
          {showRequests &&
            (moderation ||
              visibleChanges.length > 0 ||
              state.nextChangeCursor) && (
              <section
                data-ui="business-section"
                className="mt-[var(--content-page-gap)] min-w-0"
              >
                <h2
                  className="mb-3 text-[22px] leading-[1.3] font-[650] tracking-[-0.3px]"
                  ref={changeQueueHeading}
                  tabIndex={-1}
                >
                  {moderation
                    ? t("management.draftsReview")
                    : t("management.ownDrafts")}
                </h2>
                {visibleChanges.length ? (
                  requestList(visibleChanges, "change")
                ) : (
                  <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
                    {t("management.noDrafts")}
                  </p>
                )}
                {state.nextChangeCursor && (
                  <button
                    className={cn(
                      appButton({ variant: "outline" }),
                      "px-[13px] py-2",
                    )}
                    disabled={busy || loading}
                    onClick={() => void loadMore("change")}
                  >
                    {t("management.moreDrafts")}
                  </button>
                )}
              </section>
            )}
        </>
      ) : (
        <p className="mt-2.5 mb-4 text-[14px] leading-[1.7] text-muted-foreground">
          {t("management.businessReload")}
        </p>
      )}
      <AlertDialog
        open={!!decision}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDecision(null);
            setDecisionDraft({ choice: "", detail: "" });
            setError("");
          }
        }}
      >
        <AlertDialogContent
          className={confirmationDialogClassName}
          onCloseAutoFocus={(event) =>
            restoreDialogFocus(
              event,
              decisionOpener.current,
              decisionQueue === "claim"
                ? claimQueueHeading.current
                : changeQueueHeading.current,
            )
          }
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <AlertDialogHeader className={dialogHeaderClassName}>
            <AlertDialogTitle className={dialogTitleClassName}>
              {decision?.approve
                ? t("management.approveRequest")
                : t("management.rejectRequest")}
            </AlertDialogTitle>
            <AlertDialogDescription className={dialogDescriptionClassName}>
              {decision?.request.workshopName}:{" "}
              {decision?.approve
                ? decision.kind === "claim"
                  ? t("management.claimDecisionHelp")
                  : t("management.changeDecisionHelp")
                : t("management.rejectDecisionHelp")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ModalBody>
            <SelectWithOther
              id={`${editorFormId}-decision-reason`}
              label={t("management.reason")}
              placeholder={t("management.chooseReason")}
              options={decisionOptions}
              value={decisionDraft}
              onChange={setDecisionDraft}
              detailLabel={t("management.customReason")}
              detailPlaceholder={t("management.customReasonHint")}
              minLength={10}
              maxLength={2000}
              disabled={busy}
            />
            {error && (
              <p className={errorClassName} role="alert">
                {error}
              </p>
            )}
          </ModalBody>
          <AlertDialogFooter className={dialogFooterClassName}>
            <AlertDialogCancel
              className={confirmationCancelClassName}
              disabled={busy}
            >
              {t("management.cancel")}
            </AlertDialogCancel>
            <button
              className={appButton()}
              disabled={busy || decisionNote.length < 10}
              onClick={() => void decide()}
            >
              {busy
                ? t("management.savingDecision")
                : t("management.saveDecision")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
