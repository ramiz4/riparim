"use client";
import { useWorkshopContactAnalytics } from "@/components/analytics-consent";
import { storedSentinels } from "@/lib/i18n/canonical-values";
import { cn } from "@/lib/utils";
import {
  appButton,
  errorClassName,
  formLabelClassName,
  helpTextClassName,
  pageFrameClassName,
  textareaClassName,
} from "@/lib/presentation";

import { workshopEmailHref } from "@/lib/workshop-emails";
import { publicDataError } from "@/lib/i18n/public-errors";
import { useI18n } from "@/lib/i18n/client";
import { useNavigationGuard } from "@/lib/i18n/navigation-guard";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { reviewServicesLabel, valueLabel } from "@/lib/i18n/values";
import { localizeHref } from "@/lib/i18n/locale";
import { LocaleAnchor } from "@/components/locale-anchor";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  LoaderCircle,
  FileCheck2,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";
import { usePublicSession } from "@/components/use-public-session";
import { SiteHeader } from "@/components/site-header";
import { WorkshopRatings } from "@/components/workshop-ratings";
import { workshopMapsUrl, workshopRouteUrl } from "@/lib/google-maps-link";
import { WorkshopOpeningHours } from "@/components/opening-hours";
import {
  defaultCatalogueFilters,
  parseCatalogueFilters,
} from "@/lib/catalogue-filters";
import {
  workshopDisplayLanguage,
  displayServiceDetail,
  type WorkshopDisplayContent,
  groupWorkshopServices,
  profileSelection,
  workshopSelectionMatches,
  type ProfileSelection,
} from "@/lib/workshop-profile-content";
import {
  reviewDialogHref,
  reviewDialogRequested,
} from "@/lib/review-dialog-route";
import { ReviewForm, type ReviewFormDraft } from "@/components/review-form";
import { ModalContent } from "@/components/modal-shell";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import type { AccountIdentity } from "@/components/account-storage-notice";
import type { Review } from "@/app/journeys";
import { contactHref, type Workshop } from "@/lib/workshops";
import { readSearchSession } from "@/lib/search-session";
import { profileSearchHref } from "@/lib/profile-navigation";
import { WorkshopNavigationLink } from "@/components/workshop-navigation-link";
import { WorkshopSharing } from "@/components/workshop-sharing";

const sectionClassName =
  "mb-[25px] border-b border-[#e0e8e9] pb-[25px] [scroll-margin-top:100px] dark:border-border at-most-720:mb-[22px] at-most-720:pb-[22px]";
const sectionHeadingClassName =
  "mb-4 flex items-center justify-between gap-4 at-most-720:mb-[15px] at-most-720:flex-wrap at-most-720:items-start at-most-720:gap-[10px]";
const sectionTitleClassName =
  "m-0 text-[22px] font-[650] leading-[1.3] tracking-[-0.4px]";
const selectionLabelClassName =
  "inline-block rounded-[4px] bg-[#dceee2] px-[5px] py-[2px] text-[11px] font-[550] leading-[1.5] text-[#296448] dark:bg-[#225445] dark:text-[#b6efcf]";
const factsTitleClassName =
  "mt-0 mb-[10px] text-[14px] font-semibold text-[#58716d] dark:text-muted-foreground";
const sourceCopyClassName =
  "mt-2 text-[14px] leading-[1.6] text-[#73837f] dark:text-muted-foreground";
const mobileContactClassName =
  "min-h-12 min-w-0 flex-1 px-2 py-[10px] text-[14px] leading-[1.35] whitespace-normal [overflow-wrap:anywhere]";
const mobileWhatsAppClassName =
  "flex min-h-14 flex-col gap-1 px-[5px] py-2 leading-[1.25]";
const dialogOutlineClassName = cn(
  appButton({ variant: "outline" }),
  "min-h-[46px] at-most-720:min-h-[45px] at-most-720:px-[13px] at-most-720:text-[13px]",
);
const dialogPrimaryClassName = cn(
  appButton(),
  "min-h-[46px] at-most-720:min-h-[45px] at-most-720:flex-1 at-most-720:text-[13px]",
);

type Props = {
  publicOrigin?: string;
  publicSnapshot?: boolean;
  initialSearchHref?: string | null;
  display?: WorkshopDisplayContent;
  workshop: Workshop;
  directory: Workshop[];
  reviews: Review[];
  reviewError: string;
  signedIn: boolean;
  account: AccountIdentity | null;
  isAdmin: boolean;
};
export default function WorkshopProfile({
  publicOrigin,
  publicSnapshot = false,
  workshop: initialWorkshop,
  directory: initialDirectory,
  reviews: initialReviews,
  reviewError: initialReviewError,
  signedIn: initialSignedIn,
  account: initialAccount,
  isAdmin: initialAdmin,
  display: initialDisplay,
  initialSearchHref = null,
}: Props) {
  const { account, isAdmin } = usePublicSession(
    { account: initialAccount, isAdmin: initialAdmin },
    publicSnapshot,
  );
  const signedIn = publicSnapshot ? !!account : initialSignedIn;
  const [loadedReviews, setReviews] = useState(initialReviews),
    [loadedReviewError, setReviewError] = useState(initialReviewError),
    [reviewsLoading, setReviewsLoading] = useState(publicSnapshot),
    [reviewRevision, setReviewRevision] = useState(0);
  useEffect(() => {
    if (!publicSnapshot) return;
    let active = true;
    void fetch(
      `/api/reviews?workshop=${encodeURIComponent(initialWorkshop.id)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const value = (await response.json()) as { reviews?: Review[] };
        if (!response.ok || !Array.isArray(value.reviews))
          throw Error("Reviews unavailable");
        if (active) {
          setReviews(value.reviews);
          setReviewError("");
        }
      })
      .catch(() => {
        if (active) setReviewError("unavailable");
      })
      .finally(() => {
        if (active) setReviewsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [publicSnapshot, initialWorkshop.id, reviewRevision]);
  const reviews = publicSnapshot ? loadedReviews : initialReviews,
    reviewError = publicSnapshot ? loadedReviewError : initialReviewError;
  const { locale, t } = useI18n();
  const [live, setLive] = useState<{
    workshop: Workshop;
    directory: Workshop[];
    display?: WorkshopDisplayContent;
  }>({
    workshop: initialWorkshop,
    directory: initialDirectory,
    display: initialDisplay,
  });
  const {
    workshop: w,
    directory,
    display,
  } = publicSnapshot
    ? live
    : {
        workshop: initialWorkshop,
        directory: initialDirectory,
        display: initialDisplay,
      };
  useEffect(() => {
    if (!publicSnapshot) return;
    let active = true;
    void fetch(`/api/workshops?locale=${locale}`, { cache: "no-store" })
      .then(async (response) => {
        const value = (await response.json()) as {
          workshops?: Workshop[];
          displayById?: Record<string, WorkshopDisplayContent>;
        };
        if (!response.ok || !Array.isArray(value.workshops))
          throw Error("Directory unavailable");
        const workshop = value.workshops.find(
          (item) =>
            item.id === initialWorkshop.id && item.status === "published",
        );
        if (!workshop) {
          if (active) window.location.reload();
          return;
        }
        if (active)
          setLive({
            workshop,
            directory: value.workshops,
            display: value.displayById?.[workshop.id],
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [publicSnapshot, initialWorkshop.id, locale, reviewRevision]);
  const router = useRouter();
  const [reviewOpen, setReviewOpen] = useState(false),
    [reviewBusy, setReviewBusy] = useState(false),
    [contact, setContact] = useState(false),
    [message, setMessage] = useState(""),
    [initialMessage, setInitialMessage] = useState(""),
    [feedback, setFeedback] = useState(""),
    [backHref, setBackHref] = useState(() =>
      localizeHref(initialSearchHref ?? "/werkstaetten", locale),
    );
  const reviewFormId = useId(),
    reviewIdentity = `${w.id}:${account?.provider ?? "guest"}:${account?.email ?? "guest"}`;
  const [reviewDraft, setReviewDraft] = useState<{
      identity: string;
      value: ReviewFormDraft;
    } | null>(null),
    [reviewSubmitted, setReviewSubmitted] = useState<string | null>(null);
  const reviewOpenRef = useRef(false);
  // Busy-state URL resynchronization must preserve the success screen until a real reopen.
  const applyReviewOpen = useCallback((open: boolean) => {
    if (open && !reviewOpenRef.current) setReviewSubmitted(null);
    reviewOpenRef.current = open;
    setReviewOpen(open);
  }, []);
  const saveReviewDraft = useCallback(
    (value: ReviewFormDraft) =>
      setReviewDraft({ identity: reviewIdentity, value }),
    [reviewIdentity],
  );
  useNavigationGuard({
    busy: reviewBusy,
    dirty:
      (contact && message !== initialMessage) ||
      (reviewDraft?.identity === reviewIdentity && reviewDraft.value.dirty),
  });
  const [selection, setSelection] = useState<ProfileSelection>({
    brand: null,
    service: null,
  });
  const path = localizeHref(`/werkstatt/${encodeURIComponent(w.id)}`, locale);
  const reviewReturnTo = `${path}?${new URLSearchParams({ bewerten: "1", suche: backHref })}`;
  const mapHref = workshopMapsUrl(w);
  const routeHref = workshopRouteUrl(w);
  const phoneHref = contactHref(w, "phone");
  const trackContact = useWorkshopContactAnalytics(w.id);
  const serviceGroups = groupWorkshopServices(w),
    matches = workshopSelectionMatches(w, selection);
  const description = display?.description ?? w.description,
    specialty = display?.specialty ?? w.specialty;
  const contentLanguage = workshopDisplayLanguage(display, locale);
  // The server validates the public document return target; RAM only recovers client navigation.
  useEffect(() => {
    const session = readSearchSession(),
      explicit = profileSearchHref(
        new URLSearchParams(window.location.search).get("suche"),
        directory,
      ),
      remembered = profileSearchHref(session?.catalogueHref ?? null, directory),
      href = initialSearchHref ?? explicit ?? remembered;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore the validated public filters for profile highlights and the return link.
    setBackHref(localizeHref(href ?? "/werkstaetten", locale));
    const filters = href
      ? parseCatalogueFilters(
          new URL(href, window.location.origin).searchParams,
          directory,
        )
      : defaultCatalogueFilters;
    setSelection(profileSelection(filters));
  }, [directory, w.id, locale, initialSearchHref]);
  // The URL owns modal state, including legacy login returns and browser navigation.
  useEffect(() => {
    const sync = () => {
      const open = reviewDialogRequested(window.location.href);
      if (reviewBusy && !open) {
        window.history.pushState(
          {
            ...window.history.state,
            riparimReviewDialog: window.location.pathname,
          },
          "",
          reviewDialogHref(window.location.href, true),
        );
        return;
      }
      applyReviewOpen(open);
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [reviewBusy, w.id, applyReviewOpen]);
  function changeReviewOpen(open: boolean) {
    if (reviewBusy) return;
    const href = reviewDialogHref(window.location.href, open),
      current =
        window.location.pathname +
        window.location.search +
        window.location.hash;
    if (href !== current) {
      if (open)
        window.history.pushState(
          {
            ...window.history.state,
            riparimReviewDialog: window.location.pathname,
          },
          "",
          href,
        );
      else if (
        window.history.state?.riparimReviewDialog === window.location.pathname
      )
        window.history.back();
      else window.history.replaceState(window.history.state, "", href);
    }
    applyReviewOpen(open);
  }
  function openReview() {
    changeReviewOpen(true);
  }
  function startWhatsApp() {
    setFeedback("");
    const draft =
      t("public.whatsAppHello", { name: w.name }) + t("public.messageAsk");
    setInitialMessage(draft);
    setMessage(draft);
    setContact(true);
  }
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(label);
    } catch {
      setFeedback(t("public.copyManual"));
    }
  }
  const riparimReviews = (
    <div
      key="riparim"
      className={cn(
        !reviews.length &&
          !reviewError &&
          !reviewsLoading &&
          "flex flex-wrap items-center gap-x-[13px] gap-y-[6px] rounded-[10px] border border-dashed border-border bg-[var(--theme-surface)] px-4 py-[14px]",
      )}
      data-ui="profile-riparim-reviews"
    >
      <div>
        <h3 className="m-0 flex items-center gap-[7px] text-[16px] font-[650]">
          <ShieldCheck size={18} />
          Riparim
        </h3>
        {reviews.length > 0 && (
          <p className="mt-1 text-[14px] leading-[1.55] text-[#60746d] dark:text-muted-foreground">
            {t("public.reviewsProof")}
          </p>
        )}
      </div>
      {reviewsLoading ? (
        <p role="status">{t("public.loading")}</p>
      ) : reviewError ? (
        <p className={errorClassName} role="alert">
          {publicDataError(t, reviewError, "reviews")}
        </p>
      ) : reviews.length ? (
        <div
          className="mt-[18px] flex flex-col gap-[14px] at-most-720:gap-3"
          data-ui="public-review-list"
        >
          {reviews.map((review, index) => (
            <article
              className="min-w-0 rounded-[14px] border border-border bg-card p-5 at-most-720:p-4"
              data-ui="public-review"
              key={`${review.display_name}:${review.date}:${index}`}
            >
              <div className="flex items-start justify-between gap-3 text-[15px] at-most-720:gap-[10px]">
                <strong className="min-w-0 leading-[1.5] [overflow-wrap:anywhere]">
                  {review.display_name}
                </strong>
                <span className="flex shrink-0 items-center gap-[5px] rounded-lg bg-[color-mix(in_srgb,var(--theme-warning)_10%,var(--card))] px-[9px] py-[5px] text-[13px] font-[650] leading-[1.5] whitespace-nowrap text-[var(--theme-warning)]">
                  <Star size={15} fill="currentColor" aria-hidden="true" />
                  {formatNumber(locale, review.rating)} / 5
                </span>
              </div>
              <p className="mt-[14px] mb-0 flex flex-wrap gap-[6px] text-[12px] text-muted-foreground at-most-720:mt-3">
                <span className="max-w-full rounded-[6px] bg-[var(--theme-surface)] px-2 py-1 leading-[1.5] [overflow-wrap:anywhere]">
                  {review.vehicle}
                </span>
                <span className="max-w-full rounded-[6px] bg-[var(--theme-surface)] px-2 py-1 leading-[1.5] [overflow-wrap:anywhere]">
                  {reviewServicesLabel(locale, review)}
                </span>
              </p>
              {review.review && (
                <p className="my-4 text-[16px] leading-[1.7] whitespace-pre-wrap text-foreground [overflow-wrap:anywhere] at-most-720:text-[15px]">
                  {review.review}
                </p>
              )}
              <footer className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-[5px] rounded-[6px] bg-[color-mix(in_srgb,var(--theme-positive)_10%,var(--card))] px-[9px] py-[5px] text-[12px] leading-[1.5] text-[var(--theme-positive)]">
                  <ShieldCheck size={14} aria-hidden="true" />
                  {t("public.proofChecked")}
                </span>
                <time
                  className="ml-auto text-[12px] leading-[1.5] whitespace-nowrap text-muted-foreground"
                  dateTime={review.date}
                >
                  {formatDate(locale, review.date, { dateOnly: true })}
                </time>
              </footer>
            </article>
          ))}
          {w.count > reviews.length && (
            <p className={helpTextClassName}>
              {t("public.latestReviews", { count: reviews.length })}
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 p-0 text-[14px] leading-[1.6] text-muted-foreground">
          {t("public.noProofReviews")}
        </p>
      )}
    </div>
  );
  return (
    <>
      <SiteHeader
        account={account}
        isAdmin={isAdmin}
        publicSnapshot={publicSnapshot}
      />
      <main
        className={cn(
          pageFrameClassName,
          "pt-6 pb-16 at-most-720:pt-[18px] at-most-720:pb-[calc(108px_+_env(safe-area-inset-bottom))]",
        )}
        data-riparim-page="workshop"
        data-workshop-id={w.id}
        data-analytics-workshop-id={w.status === "published" ? w.id : undefined}
      >
        <WorkshopNavigationLink
          className="mb-5 inline-flex items-center gap-[7px] text-[14px] text-[#617578] dark:text-muted-foreground at-most-720:mb-[17px]"
          href={backHref}
        >
          <ArrowLeft size={16} />
          {t("public.backSearch")}
        </WorkshopNavigationLink>
        {display?.fallback && (
          <p className={helpTextClassName}>{t("public.translationFallback")}</p>
        )}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-7 gap-y-[22px] pb-6 at-most-960:grid-cols-1 at-most-960:gap-[18px] at-most-720:pb-[18px]">
          <div className="block min-w-0">
            <h1 className="m-0 text-[clamp(28px,2.8vw,36px)] font-[650] leading-[1.2] tracking-[-0.7px] text-balance [overflow-wrap:anywhere] at-most-720:text-[28px]">
              {w.name}
            </h1>
            <p className="mt-[10px] flex flex-wrap items-center gap-[5px] text-[14px] leading-[1.5] text-[#6c8080] dark:text-muted-foreground">
              <MapPin size={15} />
              <span>{w.city}</span>
              {specialty && (
                <span
                  className="ml-[5px] border-l border-border pl-[10px]"
                  lang={contentLanguage}
                >
                  {specialty}
                </span>
              )}
            </p>
          </div>
          <div className="flex max-w-[330px] shrink-0 flex-wrap justify-end gap-[9px] pt-0 at-most-960:max-w-none at-most-960:justify-start at-most-720:hidden">
            {w.whatsapp && (
              <button
                className={cn(appButton(), "min-h-[45px] px-[15px] py-[10px]")}
                onClick={startWhatsApp}
              >
                <MessageCircle size={17} />
                WhatsApp
              </button>
            )}
            {phoneHref && (
              <LocaleAnchor
                className={cn(
                  appButton({ variant: w.whatsapp ? "outline" : "primary" }),
                  "min-h-[45px] px-[15px] py-[10px] whitespace-nowrap",
                )}
                href={phoneHref}
                onClick={() => trackContact("phone")}
              >
                <Phone size={17} />
                {t("public.call")}
              </LocaleAnchor>
            )}
            <LocaleAnchor
              className={cn(
                appButton({ variant: "outline" }),
                "min-h-[45px] px-[15px] py-[10px] whitespace-nowrap",
              )}
              href={routeHref}
              onClick={() => trackContact("directions")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={17} />
              {t("public.route")}
            </LocaleAnchor>
          </div>
          <div className="col-span-full grid grid-cols-[minmax(0,1fr)_minmax(240px,0.85fr)] gap-x-6 gap-y-5 rounded-xl border border-border bg-[var(--theme-surface)] px-5 py-4 at-most-960:grid-cols-1 at-most-720:gap-3 at-most-720:px-4 at-most-720:py-[14px]">
            <WorkshopRatings
              key={w.id}
              workshop={w}
              compact
              presentation="profile"
            />
            <WorkshopOpeningHours
              className="m-0 max-w-none border-l border-border pl-6 at-most-960:border-t at-most-960:border-l-0 at-most-960:pt-[14px] at-most-960:pl-0 at-most-720:mt-0 at-most-720:pt-3"
              importedHours={w.importedOpeningHours}
              hours={w.openingHours}
              confirmedAt={w.openingHoursConfirmedAt}
            />
          </div>
        </header>
        <div className="mt-7 grid grid-cols-[minmax(0,1fr)_300px] items-start gap-[46px] at-most-960:grid-cols-[minmax(0,1fr)_265px] at-most-960:gap-[27px] at-most-720:grid-cols-1 at-most-720:gap-5">
          <div className="min-w-0">
            <section className={sectionClassName} id="leistungen">
              <div className={sectionHeadingClassName}>
                <h2 className={sectionTitleClassName}>
                  {w.brands.length
                    ? t("public.servicesBrands")
                    : t("public.services")}
                </h2>
              </div>
              {(selection.brand || selection.service) && (
                <div className="mb-[19px] rounded-[0_8px_8px] border-l-[3px] border-[#328361] bg-[#f0f7f3] px-[15px] py-3 [overflow-wrap:anywhere] dark:border-[#38725f] dark:bg-accent dark:text-[#b6efcf]">
                  <p className="m-0 text-[14px] font-semibold leading-[1.6] text-[#355c47] dark:text-[#b6efcf]">
                    {t("public.yourSearch")}
                    {selection.brand ? `: ${selection.brand}` : ""}
                  </p>
                  <div className="mt-[5px] flex flex-wrap gap-x-4 gap-y-[6px] empty:hidden">
                    {matches.brand && (
                      <span className="inline-flex items-start gap-[5px] text-[13px] leading-[1.6] text-[#527261] dark:text-[#b6efcf]">
                        <Check size={14} className="mt-[3px] shrink-0" />
                        {t("public.brandMatch", { brand: selection.brand! })}
                      </span>
                    )}
                    {matches.service && (
                      <span className="inline-flex items-start gap-[5px] text-[13px] leading-[1.6] text-[#527261] dark:text-[#b6efcf]">
                        <Check size={14} className="mt-[3px] shrink-0" />
                        {t("public.serviceMatch", {
                          service: valueLabel(
                            locale,
                            "service",
                            selection.service!,
                          ),
                        })}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {description && (
                <p
                  className="mt-0 mb-[18px] text-[16px] leading-[1.65] text-[#5b706f] [overflow-wrap:anywhere] dark:text-muted-foreground"
                  lang={contentLanguage}
                >
                  {description}
                </p>
              )}
              <div
                className="grid grid-cols-2 gap-x-[22px] gap-y-[19px] at-most-960:grid-cols-1 at-most-960:gap-[19px] at-most-720:gap-[17px]"
                aria-label={t("public.offeredServices")}
              >
                {serviceGroups.map((group) => (
                  <section
                    key={group.title}
                    className={cn(
                      "min-w-0 pb-[3px]",
                      matches.service &&
                        group.title === selection.service &&
                        "rounded-[9px] border border-[#b9d8c6] bg-[#edf6f0] px-[14px] py-3 dark:border-[#38725f] dark:bg-accent dark:text-[#b6efcf]",
                    )}
                  >
                    <h3 className="mt-0 mb-2 flex flex-wrap items-baseline gap-[7px] text-[16px] font-[650] leading-[1.5] text-[#365d4c] [overflow-wrap:anywhere] dark:text-foreground">
                      {group.title === storedSentinels.additionalServices
                        ? t("public.otherServices")
                        : valueLabel(locale, "service", group.title)}
                      {matches.service && group.title === selection.service && (
                        <span className={selectionLabelClassName}>
                          {t("public.yourSelection")}
                        </span>
                      )}
                    </h3>
                    {group.items.length > 0 && (
                      <ul className="m-0 list-disc pl-[18px] text-[16px] leading-[1.65] text-[#5a7065] dark:text-muted-foreground">
                        {group.items.map((service) => (
                          <li
                            className="my-[6px] pl-px [overflow-wrap:anywhere] marker:text-[#7b9b89] dark:marker:text-[#82bba4]"
                            key={service.sourceIndex}
                            lang={contentLanguage}
                          >
                            {displayServiceDetail(service, display, locale)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
              {(w.brands.length > 0 || w.languages.length > 0) && (
                <div className="mt-[22px] grid grid-cols-2 gap-5 border-t border-[#e4ebeb] pt-[19px] dark:border-border at-most-960:grid-cols-1">
                  {w.brands.length > 0 && (
                    <div>
                      <h3 className={factsTitleClassName}>
                        {t("public.brands")}
                      </h3>
                      <div className="flex flex-wrap gap-[6px]">
                        {w.brands.map((brand) => (
                          <span
                            key={brand}
                            className={cn(
                              "rounded-[5px] border border-[#e7ecee] bg-[#f5f7f8] px-[10px] py-1 text-[14px] text-[#51666b] dark:border-border dark:bg-secondary dark:text-muted-foreground",
                              matches.brand &&
                                (brand === selection.brand ||
                                  brand === storedSentinels.allBrands) &&
                                "inline-flex flex-wrap items-center gap-[7px] border-[#89b99e] bg-[#edf6f0] text-[#245c43] dark:border-[#38725f] dark:bg-accent dark:text-[#b6efcf]",
                            )}
                          >
                            {valueLabel(locale, "sentinel", brand)}
                            {matches.brand &&
                              (brand === selection.brand ||
                                brand === storedSentinels.allBrands) && (
                                <span className={selectionLabelClassName}>
                                  {t("public.yourSelection")}
                                </span>
                              )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {w.languages.length > 0 && (
                    <div>
                      <h3 className={factsTitleClassName}>
                        {t("public.consultationLanguages")}
                      </h3>
                      <p className="m-0 flex items-start gap-[5px] text-[16px] leading-[1.6] text-[#5f7370] dark:text-muted-foreground">
                        <Globe size={15} />
                        {w.languages
                          .map((language) =>
                            valueLabel(locale, "language", language),
                          )
                          .join(" · ")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
            <Dialog open={reviewOpen} onOpenChange={changeReviewOpen}>
              <section
                className={cn(
                  sectionClassName,
                  "mb-0 border-b-0 at-most-720:mb-0",
                )}
                id="bewertungen"
              >
                <div className={sectionHeadingClassName}>
                  <h2 className={sectionTitleClassName}>
                    {t("public.reviews")}
                  </h2>
                  <DialogTrigger asChild>
                    <button
                      data-ui="profile-write-review"
                      className={cn(
                        appButton({ variant: "text" }),
                        "m-0 inline-flex min-h-11 items-center gap-[7px] rounded-lg border border-border bg-card px-3 py-2 no-underline hover:bg-[var(--theme-hover)] focus-visible:[outline:3px_solid_var(--ring)] focus-visible:outline-offset-[3px]",
                      )}
                      onClick={openReview}
                    >
                      {t("public.writeReview")}
                    </button>
                  </DialogTrigger>
                </div>
                <div className="flex flex-col gap-[23px]">{riparimReviews}</div>
                <ModalContent
                  className="h-[min(90dvh,820px)] max-w-[min(720px,calc(100vw_-_32px))] sm:max-w-[min(720px,calc(100vw_-_32px))] at-most-720:h-[calc(100dvh_-_24px)] at-most-720:max-h-[calc(100dvh_-_24px)] at-most-720:w-[calc(100vw_-_24px)] at-most-720:max-w-none"
                  data-ui="profile-review-dialog"
                  title={t("public.writeReview")}
                  description={w.name}
                  closeDisabled={reviewBusy}
                  onEscapeKeyDown={(event) => {
                    if (reviewBusy) event.preventDefault();
                  }}
                  onPointerDownOutside={(event) => {
                    if (reviewBusy) event.preventDefault();
                  }}
                  footer={
                    <>
                      <button
                        type="button"
                        className={dialogOutlineClassName}
                        disabled={reviewBusy}
                        onClick={() => changeReviewOpen(false)}
                      >
                        {t("common.close")}
                      </button>
                      {signedIn && reviewSubmitted !== reviewIdentity && (
                        <button
                          type="submit"
                          form={reviewFormId}
                          className={dialogPrimaryClassName}
                          disabled={reviewBusy}
                        >
                          {reviewBusy ? (
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
                    </>
                  }
                >
                  <ReviewForm
                    key={reviewIdentity}
                    formId={reviewFormId}
                    showSubmit={false}
                    presentation="profile"
                    workshop={w}
                    directory={directory}
                    signedIn={signedIn}
                    account={account}
                    draft={
                      reviewDraft?.identity === reviewIdentity
                        ? reviewDraft.value
                        : undefined
                    }
                    onDraftChange={saveReviewDraft}
                    returnTo={reviewReturnTo}
                    onBusyChange={setReviewBusy}
                    onSubmitted={() => {
                      setReviewDraft(null);
                      setReviewSubmitted(reviewIdentity);
                      if (publicSnapshot)
                        setReviewRevision((value) => value + 1);
                      else router.refresh();
                    }}
                  />
                </ModalContent>
              </section>
            </Dialog>
            <details
              className="group border-t border-[#e0e8e9] pt-[18px] [scroll-margin-top:100px] dark:border-border"
              id="quellen"
            >
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[14px] text-[#52736b] focus-visible:rounded-[5px] focus-visible:[outline:3px_solid_#57a88b] dark:focus-visible:outline-ring focus-visible:outline-offset-[3px] dark:text-[#c0e1d7] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <FileCheck2 size={17} />
                  {t("public.sourcesDate")}
                </span>
                <ChevronDown
                  className="transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                  size={18}
                />
              </summary>
              <div className="pb-4">
                <p className={sourceCopyClassName}>
                  {t("public.checkedAt", {
                    date: formatDate(locale, w.checkedAt, { dateOnly: true }),
                  })}
                </p>
                {w.phoneNote && (
                  <p className={sourceCopyClassName}>
                    {t("public.phoneContact")}{" "}
                    <span lang={contentLanguage}>
                      {display?.phoneNote ?? w.phoneNote}
                    </span>
                  </p>
                )}
                <ul className="mt-[14px] grid list-none gap-3 p-0">
                  {w.sources.map((source, index) => (
                    <li key={source.url}>
                      <LocaleAnchor
                        className="group/source flex flex-col gap-[5px] py-[5px] text-[#50766a] [overflow-wrap:anywhere] dark:text-[#c0e1d7]"
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <strong
                          className="text-[14px] font-[550] leading-[1.6] group-hover/source:underline group-hover/source:underline-offset-[3px]"
                          lang={contentLanguage}
                        >
                          {display?.sourceTitles[index] ?? source.title}
                        </strong>
                        <span className="text-[12px] text-[#819087] dark:text-muted-foreground">
                          {new URL(source.url).hostname}
                        </span>
                      </LocaleAnchor>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
          <aside className="sticky top-[103px] min-w-0 at-most-720:static at-most-720:row-start-1">
            <section
              className="rounded-[13px] border border-[#dce9e4] bg-[#f2f7f5] p-5 [scroll-margin-top:100px] dark:border-border dark:bg-[var(--theme-surface)] dark:text-[#c0e1d7] at-most-720:rounded-[11px] at-most-720:bg-[#f5f9f7] at-most-720:p-[18px] dark:at-most-720:bg-[var(--theme-surface)]"
              id="standort"
            >
              <h2
                className={cn(
                  sectionTitleClassName,
                  "mb-4 text-[20px] leading-[1.3] at-most-720:mb-3 at-most-720:text-[18px]",
                )}
              >
                {t("public.contactLocation")}
              </h2>
              <p className="m-0 flex items-start gap-[9px] text-[16px] leading-[1.6] text-[#4f6d65] dark:text-muted-foreground">
                <MapPin size={18} className="mt-[3px] shrink-0" />
                <span>{w.address}</span>
              </p>
              <LocaleAnchor
                className={cn(
                  appButton({ variant: "text" }),
                  "mt-2 text-[14px] leading-[1.6]",
                )}
                href={mapHref}
                onClick={() => trackContact("directions")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("public.viewMaps")}
              </LocaleAnchor>
              {phoneHref && (
                <LocaleAnchor
                  className="mt-5 mb-4 flex flex-row items-center gap-2 [overflow-wrap:anywhere] at-most-720:mt-[14px] at-most-720:mb-0"
                  href={phoneHref}
                  onClick={() => trackContact("phone")}
                >
                  <Phone size={17} />
                  <strong className="text-[18px] tracking-[0.1px] text-[#294c43] dark:text-foreground">
                    {w.phone}
                  </strong>
                </LocaleAnchor>
              )}
              {!!w.emails?.length && (
                <div className="my-5 min-w-0">
                  <h3 className="mt-0 mb-[0.6rem] text-[0.85rem] text-muted-foreground">
                    {t("common.workshopEmails")}
                  </h3>
                  {(
                    w.emailContacts ??
                    w.emails.map((address) => ({ address, verified: false }))
                  ).map((entry) => (
                    <div
                      className="my-[0.7rem]"
                      key={entry.address.toLowerCase()}
                    >
                      <LocaleAnchor
                        className="mt-2 mb-[0.1rem] flex min-h-8 items-start gap-2 text-[14px] leading-[1.5]"
                        href={workshopEmailHref(entry.address)}
                        onClick={() => trackContact("email")}
                      >
                        <Mail
                          size={17}
                          aria-hidden="true"
                          className="mt-[0.15rem] shrink-0"
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          {entry.address}
                        </span>
                      </LocaleAnchor>
                      <span className="block pl-[1.55rem] text-[0.75rem] text-muted-foreground">
                        {entry.verified
                          ? t("common.workshopEmailVerified")
                          : t("common.workshopEmailUnverified")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {w.whatsapp && (
                <div className="grid grid-cols-1 gap-[9px] at-most-720:mt-[14px]">
                  <button
                    className={cn(
                      appButton(),
                      "min-h-[46px] w-full text-[14px]",
                    )}
                    onClick={startWhatsApp}
                  >
                    <MessageCircle size={17} />
                    WhatsApp
                  </button>
                </div>
              )}
            </section>
            <WorkshopSharing
              key={`${w.id}:${locale}`}
              workshop={w}
              publicOrigin={publicOrigin}
            />
            {feedback && !contact && (
              <p className={helpTextClassName} role="status">
                {feedback}
              </p>
            )}
            <div className="border-t border-border pt-2 text-center">
              <LocaleAnchor
                className="inline-flex min-h-11 items-center text-[13px] leading-[1.5] text-muted-foreground underline underline-offset-[3px] hover:text-[var(--theme-accent)]"
                href={`/betriebe/beanspruchen?werkstatt=${encodeURIComponent(w.id)}`}
              >
                {t("public.owner")}
              </LocaleAnchor>
            </div>
          </aside>
        </div>
        <nav
          className="hidden items-center gap-[22px] text-[14px] text-[#65746e] dark:text-muted-foreground dark:border-border dark:bg-[#0b1d20f5] dark:[box-shadow:0_-4px_18px_#00000026] at-most-720:fixed at-most-720:inset-x-0 at-most-720:bottom-0 at-most-720:z-30 at-most-720:flex at-most-720:gap-[7px] at-most-720:border-t at-most-720:border-[#dce7e2] at-most-720:bg-white at-most-720:px-4 at-most-720:pt-3 at-most-720:pb-[calc(12px_+_env(safe-area-inset-bottom))] at-most-720:[box-shadow:0_-4px_18px_#193e340a] at-most-720:dark:border-border at-most-720:dark:bg-[#0b1d20f5] at-most-720:dark:[box-shadow:0_-4px_18px_#00000026] [body:has([data-slot=dialog-overlay])_&]:invisible"
          data-ui="profile-mobile-actions"
          aria-label={t("public.contactWorkshop")}
        >
          {w.whatsapp && (
            <button
              className={cn(
                appButton(),
                mobileContactClassName,
                mobileWhatsAppClassName,
              )}
              onClick={startWhatsApp}
            >
              <MessageCircle size={18} />
              WhatsApp
            </button>
          )}
          {phoneHref && (
            <LocaleAnchor
              className={cn(
                appButton({ variant: w.whatsapp ? "outline" : "primary" }),
                mobileContactClassName,
                w.whatsapp && mobileWhatsAppClassName,
              )}
              href={phoneHref}
              onClick={() => trackContact("phone")}
            >
              <Phone size={18} />
              {t("public.call")}
            </LocaleAnchor>
          )}
          <LocaleAnchor
            className={cn(
              appButton({ variant: "outline" }),
              mobileContactClassName,
              w.whatsapp && mobileWhatsAppClassName,
            )}
            href={routeHref}
            onClick={() => trackContact("directions")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Navigation size={18} />
            <span className={w.whatsapp ? "hidden" : undefined}>
              {t("public.route")}
            </span>
            <span className={w.whatsapp ? "inline" : "hidden"}>
              {t("public.routeShort")}
            </span>
          </LocaleAnchor>
        </nav>
      </main>
      <Dialog open={contact} onOpenChange={setContact}>
        <ModalContent
          title={t("public.prepareMessage")}
          description={w.name}
          footer={
            <>
              <button
                className={dialogOutlineClassName}
                onClick={() => void copy(message, t("public.messageCopied"))}
              >
                <Copy size={16} />
                {t("public.copyText")}
              </button>
              <LocaleAnchor
                className={dialogPrimaryClassName}
                href={contactHref(w, "whatsapp", message) ?? undefined}
                onClick={() => trackContact("whatsapp")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={18} />
                {t("public.openWhatsApp")}
              </LocaleAnchor>
            </>
          }
        >
          <label className={formLabelClassName}>
            {t("public.yourMessage")}
            <textarea
              className={textareaClassName}
              rows={5}
              value={message}
              maxLength={3000}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <p className={helpTextClassName}>{t("public.sendWhatsApp")}</p>
          {feedback && (
            <p className={helpTextClassName} role="status">
              {feedback}
            </p>
          )}
        </ModalContent>
      </Dialog>
    </>
  );
}
