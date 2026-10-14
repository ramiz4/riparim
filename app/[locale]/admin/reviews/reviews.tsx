"use client";
import { cn } from "@/lib/utils";
import {
  pageFrameClassName,
  errorClassName,
  appButton,
  noteClassName,
  helpTextClassName,
  emptyStateClassName,
  emptyStateCopyClassName,
} from "@/lib/presentation";
import { AdminLoading } from "@/components/admin-loading";
import {
  responseError,
  LocalizedError,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { completeReview } from "@/lib/review";
import { reviewServicesLabel, valueLabel } from "@/lib/i18n/values";
import { formatDate } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/client";
import { evidenceHref } from "@/lib/i18n/evidence";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { LocaleAnchor } from "@/components/locale-anchor";
import { NotificationStatus } from "@/components/notification-status";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  FileCheck2,
  LoaderCircle,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { AdminNavigation } from "@/components/admin-navigation";
import { Picker } from "@/components/picker";
import {
  SelectWithOther,
  selectedChoiceText,
  type SelectionDraft,
} from "@/components/select-with-other";
import type { AccountIdentity } from "@/components/account-storage-notice";
import { type Visit } from "@/app/journeys";

const reviewReasons = [
  {
    value: "confirmed_visit",
    label: "management.reviewReasonConfirmed",
    decision: "published",
  },
  {
    value: "workshop_unclear",
    label: "management.reviewReasonWorkshop",
    decision: "needs_more",
  },
  {
    value: "date_missing",
    label: "management.reviewReasonDate",
    decision: "needs_more",
  },
  {
    value: "work_unclear",
    label: "management.reviewReasonWork",
    decision: "needs_more",
  },
  {
    value: "possible_duplicate",
    label: "management.reviewReasonDuplicate",
    decision: "needs_more",
  },
  { value: "other", label: "management.otherReason", decision: null },
] as const;
const publishableStatuses = ["pending", "approved", "needs_more"];

export default function AdminReviews({
  account,
}: {
  account: AccountIdentity;
}) {
  const { locale, t } = useI18n();
  const [items, setItems] = useState<Visit[]>([]),
    [loading, setLoading] = useState(true),
    [loaded, setLoaded] = useState(false),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
    [mutating, setMutating] = useState<string | null>(null),
    [drafts, setDrafts] = useState<Record<string, SelectionDraft>>({}),
    [filter, setFilter] = useState("open"),
    [query, setQuery] = useState("");
  useNavigationGuard({
    busy: !!mutating,
    dirty: Object.values(drafts).some(
      (draft) => !!draft.choice || !!draft.detail,
    ),
  });
  const [targeted, setTargeted] = useState(false),
    [showNotifications, setShowNotifications] = useState(false),
    [notificationRefresh, setNotificationRefresh] = useState(0);
  const selectedVisit = useRef<string | null | undefined>(undefined);
  const requestGeneration = useRef(0),
    controller = useRef<AbortController | null>(null),
    nextCursor = useRef<string | null>(null);
  const cancelLoad = useCallback(() => {
    controller.current?.abort();
    requestGeneration.current++;
  }, []);
  const load = useCallback(
    async (append = false) => {
      const generation = ++requestGeneration.current;
      controller.current?.abort();
      const c = new AbortController();
      controller.current = c;
      setLoading(true);
      setError("");
      if (selectedVisit.current === undefined) {
        const target = new URLSearchParams(window.location.search).get(
          "einreichung",
        );
        selectedVisit.current =
          target && /^[0-9a-f-]{36}$/.test(target) ? target : null;
        if (selectedVisit.current) setFilter("all");
      }
      setTargeted(!!selectedVisit.current);
      const params = new URLSearchParams({ moderation: "1" });
      if (selectedVisit.current) params.set("id", selectedVisit.current);
      if (append && nextCursor.current)
        params.set("cursor", nextCursor.current);
      try {
        const r = await fetch(`/api/visits?${params}`, { signal: c.signal }),
          d = (await r.json()) as CodedResponse & {
            visits: Visit[];
            nextCursor: string | null;
            error?: string;
          };
        if (generation !== requestGeneration.current) return;
        if (!r.ok) {
          if (r.status === 401 || r.status === 403) {
            setItems([]);
            setCursor(null);
            nextCursor.current = null;
            setLoaded(false);
          }
          throw responseError(t, d);
        }
        nextCursor.current = d.nextCursor;
        setCursor(d.nextCursor);
        setItems((old) => (append ? [...old, ...d.visits] : d.visits));
        setLoaded(true);
      } catch (e) {
        if (generation === requestGeneration.current && !c.signal.aborted)
          setError(
            e instanceof LocalizedError
              ? e.message
              : t("management.submissionsLoadFailed"),
          );
      } finally {
        if (generation === requestGeneration.current) setLoading(false);
      }
    },
    [t],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This management page starts its authorized remote queue load on mount.
    void load();
    return cancelLoad;
  }, [load, cancelLoad]);
  function noteFor(id: string) {
    return selectedChoiceText(
      drafts[id] ?? { choice: "", detail: "" },
      reviewReasons.map((reason) => ({
        value: reason.value,
        label: t(reason.label),
      })),
    );
  }
  function canModerate(visit: Visit, status: "published" | "needs_more") {
    const reason = reviewReasons.find(
      (reason) => reason.value === drafts[visit.id]?.choice,
    );
    return (
      !!reason &&
      (reason.decision === null || reason.decision === status) &&
      noteFor(visit.id).length >= 10 &&
      visit.status !== "deleting" &&
      (status === "needs_more" ||
        (publishableStatuses.includes(visit.status) && completeReview(visit)))
    );
  }
  async function moderate(visit: Visit, status: "published" | "needs_more") {
    if (mutating || loading || !canModerate(visit, status)) return;
    setMutating(visit.id);
    setError("");
    setFeedback("");
    try {
      const r = await fetch("/api/visits", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "moderate",
            id: visit.id,
            status,
            revision: visit.revision,
            note: noteFor(visit.id),
          }),
        }),
        d = (await r.json()) as CodedResponse;
      if (!r.ok) throw responseError(t, d);
      setNotificationRefresh((value) => value + 1);
      setFeedback(
        status === "published"
          ? t("management.reviewPublished")
          : t("management.reviewHidden"),
      );
      setDrafts((old) => {
        const next = { ...old };
        delete next[visit.id];
        return next;
      });
      await load();
    } catch (e) {
      setError(
        e instanceof LocalizedError
          ? e.message
          : t("management.reviewSaveFailed"),
      );
    } finally {
      setMutating(null);
    }
  }
  const busy = loading || !!mutating;
  const shown = items.filter(
    (visit) =>
      (filter === "all" ||
        (filter === "open"
          ? ["pending", "approved"].includes(visit.status)
          : visit.status === filter)) &&
      `${visit.workshop_name ?? ""} ${visit.display_name ?? ""} ${visit.vehicle}`
        .toLocaleLowerCase(locale)
        .includes(query.toLocaleLowerCase(locale)),
  );
  return (
    <>
      <SiteHeader account={account} isAdmin />
      <AdminNavigation active="reviews" />
      <main className={cn(pageFrameClassName, "pt-8 pb-[60px]")}>
        <div
          data-ui="admin-title"
          className="at-most-720:items-start flex items-center justify-between gap-[30px] at-most-1000:items-start at-most-720:flex-col at-most-720:gap-[18px]"
        >
          <h1 className="text-[32px] leading-[1.2] font-semibold tracking-[-1px] at-most-720:text-[28px] m-0">
            {t("management.moderateReviews")}
          </h1>
        </div>
        <div
          data-ui="moderation-toolbar"
          className="mt-[27px] mb-[23px] flex items-center gap-[17px] at-most-960:flex-wrap at-most-720:mt-[21px] at-most-720:gap-[11px]"
        >
          <label className="flex flex-1 items-center gap-2 rounded-[9px] border border-[#dce5e6] bg-white px-3.5 py-[11px] dark:border-border dark:bg-card at-most-960:min-w-60 at-most-720:w-full at-most-720:min-w-0 at-most-720:basis-full at-most-720:p-3">
            <Search
              className="shrink-0 text-[#78918a] dark:text-muted-foreground"
              size={16}
            />
            <input
              className="w-full min-w-0 bg-transparent text-[14px] outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("management.reviewSearchExample")}
              aria-label={t("management.reviewSearch")}
            />
          </label>
          <Picker
            className="min-w-40 max-w-[180px] rounded-lg border border-[#dce5e6] bg-white px-3 py-[9px] text-[14px] leading-[1.55] focus-visible:border-[#dce5e6] dark:border-border dark:bg-card dark:hover:bg-card dark:focus-visible:border-border at-most-720:min-h-[41px] at-most-720:min-w-0 at-most-720:max-w-none at-most-720:flex-1 at-most-720:text-[14px]"
            value={filter}
            onChange={setFilter}
            values={["open", "needs_more", "published", "all"]}
            displayLabels={{
              open: t("management.awaitingReview"),
              needs_more: t("management.needsMore"),
              published: t("management.published"),
              all: t("management.allStatuses"),
            }}
            label={t("management.filterReviewStatus")}
          />
        </div>
        {feedback && (
          <p
            className="mb-4 rounded-lg bg-[#eef6e9] px-[15px] py-3 text-[14px] text-[#527d4d] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
            role="status"
          >
            {feedback}
          </p>
        )}
        {error && (
          <>
            <p className={errorClassName} role="alert">
              {error}
            </p>
            <button
              className={cn(
                appButton({ variant: "outline" }),
                "px-[13px] py-2 mb-[23px]",
              )}
              disabled={busy}
              onClick={() => void load()}
            >
              {t("management.retrySubmissions")}
            </button>
          </>
        )}
        {loading && !loaded && (
          <AdminLoading>{t("management.submissionsLoading")}</AdminLoading>
        )}
        {targeted && (
          <button
            className={cn(appButton({ variant: "outline" }), "px-[13px] py-2")}
            disabled={busy}
            onClick={() => {
              selectedVisit.current = null;
              setTargeted(false);
              void load();
            }}
          >
            {t("management.showAllSubmissions")}
          </button>
        )}
        <div
          data-ui="moderation-list"
          className="flex flex-col gap-3"
          aria-busy={loading}
        >
          {shown.map((visit) => {
            const complete = completeReview(visit),
              draft = drafts[visit.id] ?? { choice: "", detail: "" };
            return (
              <details
                data-ui="moderation-entry"
                className="overflow-hidden rounded-[11px] border border-[#dce5e6] bg-white dark:border-border dark:bg-card"
                key={visit.id}
              >
                <summary className="flex cursor-pointer list-none items-center gap-[15px] px-5 py-[18px] in-open:bg-[#f7faf8] dark:in-open:bg-secondary [&::-webkit-details-marker]:hidden at-most-720:flex-wrap at-most-720:gap-2.5 at-most-720:p-[15px]">
                  <div className="flex min-w-0 flex-1 flex-col gap-[5px] at-most-720:order-0 at-most-720:basis-[calc(100%_-_35px)]">
                    <strong className="text-[16px] text-[#325a4e] [overflow-wrap:anywhere] dark:text-foreground at-most-720:text-[15px]">
                      {visit.workshop_name ?? t("management.formerWorkshop")}
                    </strong>
                    <span className="text-[12px] leading-[1.5] text-[#7b8d83] [overflow-wrap:anywhere] dark:text-muted-foreground">
                      {visit.display_name ?? t("management.missingReview")} ·{" "}
                      {formatDate(locale, visit.date, { dateOnly: true })}
                      {visit.rating ? ` · ${visit.rating}/5` : ""}
                    </span>
                  </div>
                  <span
                    data-ui="visit-status"
                    data-status={visit.status}
                    className={cn(
                      "rounded-[5px] px-2 py-[3px] text-[12px] whitespace-nowrap at-most-720:order-2 at-most-720:text-[11px]",
                      visit.status === "approved" ||
                        visit.status === "published"
                        ? "bg-[#e7f3e8] text-[#2c784b] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
                        : visit.status === "needs_more"
                          ? "bg-[#ffefe7] text-[#934832] dark:border-[#75413e] dark:bg-[#3a2426] dark:text-[var(--theme-danger)]"
                          : "bg-[#f3efe1] text-[#80713a] dark:bg-[#3b3020] dark:text-[var(--theme-warning)]",
                    )}
                  >
                    {valueLabel(locale, "status", visit.status)}
                  </span>
                  <ChevronDown
                    className="shrink-0 text-[#709283] transition-transform duration-150 ease-[ease] in-open:rotate-180 at-most-720:order-1"
                    size={18}
                  />
                </summary>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-[27px] gap-y-0 border-t border-[#e0e9e5] px-[22px] pb-[22px] dark:border-border at-most-720:grid-cols-1 at-most-720:gap-0 at-most-720:px-4 at-most-720:pb-[18px]">
                  <section className="min-w-0 pt-5">
                    <h2 className="mt-0 mb-[13px] flex items-center gap-[7px] text-[16px] font-semibold text-[#3e6658] dark:text-foreground at-most-720:text-[15px]">
                      {t("management.review")}
                    </h2>
                    <p
                      data-ui="review-meta"
                      className="mt-[5px] mb-2.5 text-[12px] text-[#8b978c] dark:text-muted-foreground"
                    >
                      {visit.vehicle} · {reviewServicesLabel(locale, visit)}
                    </p>
                    {complete ? (
                      <>
                        <p
                          data-ui="moderation-review-rating"
                          className="m-0 flex items-center gap-1.5 text-[13px] text-[#a27d32] dark:text-[var(--theme-warning)]"
                        >
                          <Star size={16} fill="currentColor" />
                          {visit.rating} / 5 · {visit.display_name}
                        </p>
                        {visit.review && (
                          <p className="my-4 text-[16px] leading-[1.7] text-foreground whitespace-pre-wrap [overflow-wrap:anywhere] at-most-720:text-[15px]">
                            {visit.review}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className={noteClassName}>
                        {t("management.oldIncompleteReview")}
                      </p>
                    )}
                  </section>
                  <section
                    data-ui="moderation-evidence"
                    className="min-w-0 pt-5 at-most-720:mt-4 at-most-720:border-t at-most-720:border-[#e2eae6]"
                  >
                    <h2 className="mt-0 mb-[13px] flex items-center gap-[7px] text-[16px] font-semibold text-[#3e6658] dark:text-foreground at-most-720:text-[15px]">
                      <FileCheck2 size={18} />
                      {t("management.privateVisitEvidence")}
                    </h2>
                    <p className="text-[14px] text-[#6f8277] dark:text-muted-foreground">
                      {valueLabel(locale, "evidence", visit.evidence_type)}
                    </p>
                    {visit.file_name && (
                      <LocaleAnchor
                        className={cn(
                          appButton({ variant: "outline" }),
                          "mt-3 text-[13px] px-[13px] py-2",
                        )}
                        href={evidenceHref(visit.id, locale)}
                      >
                        <FileCheck2 size={16} />
                        {t("management.downloadReceipt")}
                      </LocaleAnchor>
                    )}
                    {visit.evidence_note && (
                      <p className="text-[#6f8277] [overflow-wrap:anywhere] mt-[15px] bg-[#f5f7f3] p-3 text-[14px] leading-[1.7] whitespace-pre-wrap dark:border-border dark:bg-[var(--theme-surface)] dark:text-muted-foreground">
                        {visit.evidence_note}
                      </p>
                    )}
                    {!visit.file_name && !visit.evidence_note && (
                      <p className={cn(helpTextClassName, "text-[14px]")}>
                        {t("management.noEvidence")}
                      </p>
                    )}
                  </section>
                  <section
                    data-ui="moderation-decision"
                    className="min-w-0 pt-5 col-span-full mt-6 border-t border-[#e2eae6] dark:border-border at-most-720:col-auto at-most-720:mt-[19px]"
                  >
                    <h2 className="mt-0 mb-[13px] flex items-center gap-[7px] text-[16px] font-semibold text-[#3e6658] dark:text-foreground at-most-720:text-[15px]">
                      {t("management.reviewDecision")}
                    </h2>
                    {visit.moderator_note && (
                      <p
                        className={cn(
                          helpTextClassName,
                          "mt-[11px] text-[13px] leading-[1.6]",
                        )}
                      >
                        {t("management.previousNote", {
                          note: visit.moderator_note,
                        })}
                      </p>
                    )}
                    <SelectWithOther
                      presentation="moderation"
                      id={`moderation-reason-${visit.id}`}
                      label={t("management.reviewNote")}
                      placeholder={t("management.chooseReason")}
                      options={reviewReasons.map((reason) => ({
                        value: reason.value,
                        label: t(reason.label),
                        disabled:
                          reason.decision === "published" &&
                          (!complete ||
                            !publishableStatuses.includes(visit.status)),
                      }))}
                      value={draft}
                      onChange={(value) =>
                        setDrafts((old) => ({ ...old, [visit.id]: value }))
                      }
                      detailLabel={t("management.customReason")}
                      detailPlaceholder={t("management.customReasonHint")}
                      minLength={10}
                      maxLength={1000}
                      disabled={busy}
                      describedBy={`moderation-help-${visit.id}`}
                    />
                    <p
                      className={cn(
                        helpTextClassName,
                        "mt-[11px] text-[13px] leading-[1.6]",
                      )}
                      id={`moderation-help-${visit.id}`}
                    >
                      {t("management.reviewPrivateHelp")}
                    </p>
                    <div className="mt-[19px] flex flex-wrap gap-[11px] at-most-720:flex-col at-most-720:gap-[9px]">
                      {publishableStatuses.includes(visit.status) && (
                        <button
                          className={cn(
                            appButton(),
                            "min-h-[43px] text-[14px] at-most-720:w-full at-most-720:text-[13px]",
                          )}
                          disabled={busy || !canModerate(visit, "published")}
                          onClick={() => void moderate(visit, "published")}
                        >
                          <ShieldCheck size={16} />
                          {t("management.reviewPublish")}
                        </button>
                      )}
                      <button
                        className={cn(
                          appButton({ variant: "outline" }),
                          "min-h-[43px] text-[14px] at-most-720:w-full at-most-720:text-[13px]",
                        )}
                        disabled={busy || !canModerate(visit, "needs_more")}
                        onClick={() => void moderate(visit, "needs_more")}
                      >
                        {visit.status === "published"
                          ? t("management.hideRequestMore")
                          : t("management.requestMore")}
                      </button>
                    </div>
                  </section>
                </div>
              </details>
            );
          })}
        </div>
        {loaded && !loading && !error && !shown.length && (
          <div className={emptyStateClassName}>
            <ShieldCheck size={27} />
            <h2 className="text-[21px] font-semibold">
              {t("management.noSubmissions")}
            </h2>
            <p className={emptyStateCopyClassName}>
              {cursor
                ? t("management.moreSubmissionsPossible")
                : t("management.filterEmpty")}
            </p>
          </div>
        )}
        {cursor && (
          <button
            className={cn(
              appButton({ variant: "outline" }),
              "mx-auto mt-[23px] flex min-h-11",
            )}
            disabled={busy}
            onClick={() => void load(true)}
          >
            {loading ? (
              <>
                <LoaderCircle
                  className="inline-block animate-spin motion-reduce:animate-none"
                  size={16}
                />
                {t("management.loading")}
              </>
            ) : (
              t("management.loadMoreSubmissions")
            )}
          </button>
        )}
        {loaded && (
          <p
            data-ui="moderation-loaded-count"
            className={cn(helpTextClassName, "mt-[17px] text-center")}
          >
            {t("management.submissionsCount", {
              count: items.length,
              shown: shown.length,
            })}
          </p>
        )}
        <details
          data-ui="notification-details"

          onToggle={(event) => setShowNotifications(event.currentTarget.open)}
        >
          <summary>{t("management.notificationsTitle")}</summary>
          {showNotifications && (
            <NotificationStatus refreshKey={notificationRefresh} />
          )}
        </details>
      </main>
    </>
  );
}
