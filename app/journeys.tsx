"use client";
import {
  dialogHeaderClassName,
  dialogTitleClassName,
  dialogDescriptionClassName,
  dialogFooterClassName,
  confirmationCancelClassName,
  confirmationActionClassName,
  pageFrameClassName,
  contentTitleClassName,
  appButton,
  errorClassName,
  loadingStateClassName,
  emptyStateClassName,
  emptyStateCopyClassName,
  helpTextClassName,
  noteClassName,
  confirmationDialogClassName,
} from "@/lib/presentation";
import { cn } from "@/lib/utils";

import { useI18n } from "@/lib/i18n/client";
import {
  responseError,
  LocalizedError,
  type CodedResponse,
} from "@/lib/i18n/codes";
import { reviewServicesLabel, valueLabel } from "@/lib/i18n/values";
import { formatDate } from "@/lib/i18n/format";
import { evidenceHref } from "@/lib/i18n/evidence";
import { localizeHref } from "@/lib/i18n/locale";
import { ownReviewsHref, reviewSubmissionId } from "@/lib/own-reviews";
import { completeReview } from "@/lib/review";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { LocaleAnchor } from "@/components/locale-anchor";
import Link from "@/components/locale-link";
import { useState, useEffect, useRef, useId, useCallback } from "react";
import {
  ShieldCheck,
  MessageCircle,
  Star,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import { ModalContent, ModalBody } from "@/components/modal-shell";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import {
  AccountStorageNotice,
  type AccountIdentity,
} from "@/components/account-storage-notice";
import { ReviewForm } from "@/components/review-form";
import type { Workshop } from "@/lib/workshops";
export type Review = {
  display_name: string;
  vehicle: string;
  service: string;
  services?: string[];
  date: string;
  rating: number;
  review: string | null;
};
export type Visit = {
  id: string;
  workshop: string;
  workshop_name?: string;
  date: string;
  vehicle: string;
  service: string;
  services?: string[];
  evidence_type: string;
  evidence_note: string;
  status: string;
  moderator_note: string;
  display_name: string | null;
  rating: number | null;
  review: string | null;
  created_at: string;
  file_name: string | null;
  revision: number;
};

export function VisitForm({
  open,
  onClose,
  onCloseAutoFocus,
  workshop,
  directory,
  signedIn,
  account = null,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  workshop: Workshop | null;
  directory: Workshop[];
  signedIn: boolean;
  account?: AccountIdentity | null;
  existing: Visit | null;
}) {
  const { locale, t } = useI18n();
  const formId = useId();
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Each controlled opening starts a fresh form session.
      setBusy(false);
      setDone(false);
    }
  }, [open, existing?.id, workshop?.id]);
  const returnTo = localizeHref(ownReviewsHref(existing?.id), locale);
  return (
    <Dialog
      open={open && !!existing}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <ModalContent
        className="max-w-[min(700px,calc(100%_-_32px))] sm:max-w-[min(700px,calc(100%_-_32px))]"
        onCloseAutoFocus={onCloseAutoFocus}
        closeDisabled={busy}
        title={done ? t("customer.reviewSubmitted") : t("customer.editReview")}
        description={
          done
            ? t("customer.publishedAfterApproval")
            : t("customer.combinedSubmission")
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
                {done ? t("customer.close") : t("customer.cancel")}
              </button>
            </DialogClose>
            {signedIn && done ? (
              <LocaleAnchor
                className={cn(
                  appButton(),
                  "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:flex-1",
                )}
                href={ownReviewsHref(existing?.id)}
              >
                {t("customer.myReviews")}
              </LocaleAnchor>
            ) : signedIn && directory.length > 0 ? (
              <button
                type="submit"
                form={formId}
                disabled={busy}
                className={cn(
                  appButton(),
                  "at-most-720:min-h-[45px] at-most-720:text-[13px] at-most-720:flex-1",
                )}
              >
                {busy ? (
                  <>
                    <LoaderCircle
                      className="inline-block animate-spin motion-reduce:animate-none"
                      size={17}
                    />
                    {t("customer.submitting")}
                  </>
                ) : (
                  t("customer.submitReview")
                )}
              </button>
            ) : null}
          </>
        }
      >
        {open && (
          <ReviewForm
            key={`${existing?.id ?? workshop?.id ?? "new"}:${existing?.revision ?? 0}`}
            formId={formId}
            showSubmit={false}
            workshop={workshop}
            directory={directory}
            signedIn={signedIn}
            account={account}
            existing={existing}
            returnTo={returnTo}
            onBusyChange={setBusy}
            onSubmitted={() => setDone(true)}
          />
        )}
      </ModalContent>
    </Dialog>
  );
}

type OwnView = {
  items: Visit[];
  cursor: string | null;
  loaded: boolean;
  error: string;
};
const emptyView = (): OwnView => ({
  items: [],
  cursor: null,
  loaded: false,
  error: "",
});
export function MyVisits({
  directory,
  directoryUnavailable = false,
  signedIn,
  account = null,
  submissionId = null,
}: {
  directory: Workshop[];
  directoryUnavailable?: boolean;
  signedIn: boolean;
  account?: AccountIdentity | null;
  submissionId?: string | null;
}) {
  const { locale, t } = useI18n();
  const [view, setView] = useState<OwnView>(emptyView),
    [loading, setLoading] = useState(signedIn),
    [mutating, setMutating] = useState(false),
    [actionError, setActionError] = useState(""),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const [authenticationRequired, setAuthenticationRequired] = useState(false);
  const [editing, setEditing] = useState<Visit | null>(null),
    target = reviewSubmissionId(submissionId);
  useNavigationGuard({ busy: mutating });
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    cursor = useRef<string | null>(null),
    cacheIdentity = useRef("");
  const opener = useRef<{ button: HTMLButtonElement; href: string } | null>(
      null,
    ),
    pageHeading = useRef<HTMLHeadingElement>(null);
  const [restorePending, setRestorePending] = useState(false);
  const busy = loading || mutating;
  // Radix may close after the refresh render; consume its focus request with the current enabled actions.
  useEffect(() => {
    if (!restorePending || busy || editing || deleteId) return;
    setRestorePending(false);
    const previous = opener.current;
    if (
      !previous ||
      previous.href !== window.location.href ||
      document.activeElement !== document.body
    )
      return;
    opener.current = null;
    const destination =
      previous.button.isConnected && !previous.button.disabled
        ? previous.button
        : pageHeading.current;
    destination?.focus();
  }, [restorePending, busy, editing, deleteId]);
  function rememberFocus(button: HTMLButtonElement) {
    opener.current = { button, href: window.location.href };
    setRestorePending(false);
  }
  function closeAutoFocus(event: Event) {
    event.preventDefault();
    setRestorePending(true);
  }
  const cancelLoad = useCallback(() => {
    controller.current?.abort();
    generation.current++;
  }, []);
  const load = useCallback(
    async (append = false) => {
      const request = ++generation.current;
      controller.current?.abort();
      const c = new AbortController();
      controller.current = c;
      setLoading(true);
      setAuthenticationRequired(false);
      setView((old) => ({ ...old, error: "" }));
      const query = new URLSearchParams();
      if (target) query.set("id", target);
      if (append && cursor.current) query.set("cursor", cursor.current);
      try {
        const r = await fetch(`/api/visits${query.size ? `?${query}` : ""}`, {
            signal: c.signal,
          }),
          d = (await r.json()) as CodedResponse & {
            visits: Visit[];
            nextCursor: string | null;
          };
        if (request !== generation.current) return;
        if (!r.ok) {
          if (r.status === 401) setAuthenticationRequired(true);
          if ([401, 403, 404].includes(r.status)) {
            setView(emptyView());
            cursor.current = null;
          }
          throw responseError(t, d);
        }
        cursor.current = d.nextCursor;
        setView((old) => ({
          items: append ? [...old.items, ...d.visits] : d.visits,
          cursor: d.nextCursor,
          loaded: true,
          error: "",
        }));
      } catch (e) {
        if (request === generation.current && !c.signal.aborted)
          setView((old) => ({
            ...old,
            error:
              e instanceof LocalizedError
                ? e.message
                : t("customer.loadFailed"),
          }));
      } finally {
        if (request === generation.current) setLoading(false);
      }
    },
    [t, target],
  );
  useEffect(() => {
    if (signedIn) {
      const identity = `${account?.provider ?? ""}:${account?.email ?? ""}:${target ?? ""}`;
      if (cacheIdentity.current !== identity) {
        setView(emptyView());
        cursor.current = null;
        cacheIdentity.current = identity;
      }
      setActionError("");
      void load();
    }
    return () => {
      cancelLoad();
      opener.current = null;
    };
  }, [signedIn, account?.email, account?.provider, load, cancelLoad, target]);
  async function remove() {
    setMutating(true);
    setActionError("");
    try {
      const r = await fetch("/api/visits", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: deleteId }),
        }),
        d = (await r.json()) as CodedResponse;
      if (!r.ok) throw responseError(t, d);
      await load();
      setDeleteId(null);
    } catch (e) {
      setActionError(
        e instanceof LocalizedError ? e.message : t("customer.deleteFailed"),
      );
    } finally {
      setMutating(false);
    }
  }
  return (
    <>
      <main
        className={cn(
          pageFrameClassName,
          "min-h-[calc(100svh_-_180px)] pt-[var(--content-page-padding-top)] pb-[var(--content-page-padding-bottom)] [overflow-wrap:anywhere]",
        )}
      >
        <header
          data-ui="my-reviews-heading"
          className="mb-[var(--content-page-gap)] flex items-center justify-between gap-5 at-most-720:flex-wrap at-most-720:items-start at-most-720:gap-4"
        >
          <div>
            <h1
              className={cn(contentTitleClassName, "focus:outline-none")}
              ref={pageHeading}
              tabIndex={-1}
            >
              {t("customer.myReviews")}
            </h1>
            <p className="mt-2 text-[15px] leading-[1.6] text-muted-foreground">
              {t("customer.myReviewsNote")}
            </p>
          </div>
        </header>
        {!signedIn || authenticationRequired ? (
          <div
            data-ui="login-prompt"
            className="flex flex-col items-center gap-5 rounded-xl border border-border bg-card px-5 py-8 text-center"
          >
            <ShieldCheck
              className="text-[#327b52] dark:text-[var(--theme-positive)]"
              size={25}
            />
            <p>{t("customer.myReviewsLogin")}</p>
            <LocaleAnchor
              className={cn(
                appButton(),
                "focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring",
              )}
              href={`/anmelden?weiter=${encodeURIComponent(localizeHref(ownReviewsHref(target), locale))}`}
            >
              {t("customer.loginOrRegister")}
            </LocaleAnchor>
          </div>
        ) : (
          <>
            <AccountStorageNotice />
            {directoryUnavailable && (
              <p className={errorClassName} role="alert">
                {t("customer.workshopsUnavailable")}{" "}
                <LocaleAnchor
                  className="focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring"
                  reloadDocument
                  href={ownReviewsHref(target)}
                >
                  {t("customer.refresh")}
                </LocaleAnchor>
              </p>
            )}
            <div
              data-ui="visit-list"
              className="flex flex-col gap-[15px] pt-[13px]"
              aria-busy={loading}
            >
              {loading && !view.loaded && (
                <div className={loadingStateClassName} role="status">
                  <LoaderCircle
                    size={18}
                    className="inline-block animate-spin motion-reduce:animate-none"
                  />
                  <span>{t("customer.myReviewsLoading")}</span>
                </div>
              )}
              {view.error && (
                <>
                  <p className={errorClassName} role="alert">
                    {view.error}
                  </p>
                  <button
                    data-ui="my-reviews-retry"
                    className={cn(
                      cn(
                        appButton({ variant: "outline" }),
                        "focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring px-[13px] py-2 min-h-11",
                      ),
                      "min-h-11",
                    )}
                    disabled={busy}
                    onClick={() => void load()}
                  >
                    {t("common.retry")}
                  </button>
                </>
              )}
              {!loading && !view.error && view.loaded && !view.items.length && (
                <div className={emptyStateClassName}>
                  <MessageCircle size={25} />
                  <h3 className="text-[18px]">{t("customer.noReviews")}</h3>
                  <p className={emptyStateCopyClassName}>
                    {t("customer.noReviewsNote")}
                  </p>
                </div>
              )}
              {target && (
                <LocaleAnchor
                  className={cn(
                    appButton({ variant: "outline" }),
                    "focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring px-[13px] py-2",
                  )}
                  href="/bewertungen"
                >
                  {t("customer.allMyReviews")}
                </LocaleAnchor>
              )}
              {view.items.map((v) => (
                <article
                  data-ui="visit"
                  className="rounded-[11px] border border-[#dae5e6] bg-card p-[17px] dark:border-border at-most-720:p-[15px]"
                  key={v.id}
                >
                  <div
                    data-ui="visit-top"
                    className="flex items-start justify-between gap-3.5 text-[15px] at-most-720:flex-wrap at-most-720:gap-[9px]"
                  >
                    <strong className="min-w-0 at-most-720:text-[16px]">
                      {directory.some((w) => w.id === v.workshop) ? (
                        <Link
                          className="focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring"
                          href={`/werkstatt/${encodeURIComponent(v.workshop)}`}
                        >
                          {v.workshop_name ?? t("customer.workshopProfile")}
                        </Link>
                      ) : (
                        (v.workshop_name ?? t("customer.formerWorkshop"))
                      )}
                    </strong>
                    <span
                      data-ui="visit-status"
                      data-status={v.status}
                      className={cn(
                        "max-w-[55%] shrink-0 rounded-[5px] px-2 py-[3px] text-[12px] whitespace-normal at-most-720:max-w-full",
                        v.status === "approved" || v.status === "published"
                          ? "bg-[#e7f3e8] text-[#2c784b] dark:bg-[#163e32] dark:text-[var(--theme-positive)]"
                          : v.status === "needs_more"
                            ? "bg-[#ffefe7] text-[#934832] dark:border-[#75413e] dark:bg-[#3a2426] dark:text-[var(--theme-danger)]"
                            : "bg-[#f3efe1] text-[#80713a] dark:bg-[#3b3020] dark:text-[var(--theme-warning)]",
                      )}
                    >
                      {valueLabel(locale, "status", v.status)}
                    </span>
                  </div>
                  <p
                    data-ui="review-meta"
                    className="mt-[5px] mb-2.5 text-[12px] text-[#8b978c] dark:text-muted-foreground"
                  >
                    {v.vehicle} ·{" "}
                    {formatDate(locale, v.date, { dateOnly: true })} ·{" "}
                    {reviewServicesLabel(locale, v)}
                  </p>
                  {completeReview(v) ? (
                    <div
                      data-ui="submitted-review"
                      className="flex flex-col gap-[7px] py-3"
                    >
                      <span className="flex items-center gap-[5px] text-[13px] text-[#a98029] dark:text-[var(--theme-warning)]">
                        <Star size={15} fill="currentColor" />
                        {v.rating} / 5 · {v.display_name}
                      </span>
                      {v.review && (
                        <p className="text-[15px] whitespace-pre-wrap [overflow-wrap:anywhere]">
                          {v.review}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className={helpTextClassName}>
                      {t("customer.oldReview")}
                    </p>
                  )}
                  <details
                    data-ui="evidence-details"
                    className="mt-0.5 border-t border-[#e2e9eb] pt-3 dark:border-border"
                  >
                    <summary className="cursor-pointer text-[14px] font-[550] text-[#4c6f68] dark:text-muted-foreground focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring">
                      {t("customer.privateEvidenceSummary", {
                        type: valueLabel(locale, "evidence", v.evidence_type),
                      })}
                    </summary>
                    {v.file_name && (
                      <LocaleAnchor
                        data-ui="text-action"
                        className={cn(
                          appButton({ variant: "text" }),
                          "focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring",
                        )}
                        href={evidenceHref(v.id, locale)}
                      >
                        {t("customer.downloadReceipt")}
                      </LocaleAnchor>
                    )}
                    {v.evidence_note && (
                      <p className="mt-2.5 bg-[#f5f7f3] p-3 text-[14px] whitespace-pre-wrap dark:border-border dark:bg-[var(--theme-surface)] dark:text-muted-foreground">
                        {v.evidence_note}
                      </p>
                    )}
                  </details>
                  {v.moderator_note && (
                    <p className={noteClassName}>
                      {t("customer.moderationNote", { note: v.moderator_note })}
                    </p>
                  )}
                  <div
                    data-ui="visit-actions"
                    className="mt-3.5 flex items-center justify-start gap-[15px] at-most-720:flex-wrap at-most-720:items-start"
                  >
                    {[
                      "pending",
                      "approved",
                      "needs_more",
                      "published",
                    ].includes(v.status) &&
                      directory.some((w) => w.id === v.workshop) && (
                        <button
                          className={cn(
                            cn(
                              appButton({ variant: "outline" }),
                              "focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring px-[13px] py-2",
                            ),
                            "min-h-11",
                          )}
                          disabled={busy}
                          onClick={(event) => {
                            rememberFocus(event.currentTarget);
                            setEditing(v);
                          }}
                        >
                          {!completeReview(v)
                            ? t("customer.completeReview")
                            : v.status === "needs_more"
                              ? t("customer.supplement")
                              : t("customer.edit")}
                        </button>
                      )}
                    <button
                      data-ui="delete-button"
                      className={cn(
                        cn(
                          appButton({ variant: "danger" }),
                          "ml-auto focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring",
                        ),
                        "min-h-11",
                      )}
                      disabled={busy}
                      onClick={(event) => {
                        rememberFocus(event.currentTarget);
                        setActionError("");
                        setDeleteId(v.id);
                      }}
                    >
                      <Trash2 size={14} />
                      {t("customer.delete")}
                    </button>
                  </div>
                </article>
              ))}
              {view.cursor && (
                <button
                  className={cn(
                    cn(
                      appButton({ variant: "outline" }),
                      "focus-visible:outline-[3px] focus-visible:outline-offset-3 focus-visible:outline-ring",
                    ),
                    "min-h-11",
                  )}
                  disabled={busy}
                  onClick={() => void load(true)}
                >
                  {t("customer.moreReviews")}
                </button>
              )}
            </div>
            {actionError && (
              <p className={errorClassName} role="alert">
                {actionError}
              </p>
            )}
          </>
        )}
      </main>
      <VisitForm
        open={!!editing}
        existing={editing}
        workshop={
          directory.find((workshop) => workshop.id === editing?.workshop) ??
          null
        }
        directory={directory}
        signedIn={signedIn}
        account={account}
        onCloseAutoFocus={closeAutoFocus}
        onClose={() => {
          setEditing(null);
          void load();
        }}
      />
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => {
          if (!v && !mutating) setDeleteId(null);
        }}
      >
        <AlertDialogContent
          className={confirmationDialogClassName}
          onCloseAutoFocus={closeAutoFocus}
        >
          <AlertDialogHeader className={dialogHeaderClassName}>
            <AlertDialogTitle className={dialogTitleClassName}>
              {t("customer.deleteReviewTitle")}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <ModalBody>
            <AlertDialogDescription className={dialogDescriptionClassName}>
              {t("customer.deleteReviewNote")}
            </AlertDialogDescription>
            {actionError && (
              <p className={errorClassName} role="alert">
                {actionError}
              </p>
            )}
          </ModalBody>
          <AlertDialogFooter className={dialogFooterClassName}>
            <AlertDialogCancel
              className={confirmationCancelClassName}
              disabled={mutating}
            >
              {t("customer.keep")}
            </AlertDialogCancel>
            <AlertDialogAction
              className={confirmationActionClassName}
              disabled={mutating}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              {mutating ? t("customer.deleting") : t("customer.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
