"use client";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { appButton } from "@/lib/presentation";
import { LocaleAnchor } from "@/components/locale-anchor";
import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { loadGooglePlaces } from "@/lib/google-maps-browser";
import type { GoogleProfileStatus } from "@/lib/google-workshop-profile";
import type {
  GoogleWorkshopIdentity,
  RequestGoogleIdentity,
} from "./use-google-workshop-profile";
import { useGoogleVisibility } from "./use-google-visibility";
import { workshopMapsUrl } from "@/lib/google-maps-link";
import type { Workshop } from "@/lib/workshops";

const googleHostClassName =
  "block min-w-0 w-full rounded-xl border border-border [color-scheme:inherit] [--gmp-mat-color-surface:var(--theme-surface)] [--gmp-mat-color-on-surface:var(--foreground)] [--gmp-mat-color-on-surface-variant:var(--muted-foreground)] [--gmp-mat-color-primary:var(--theme-accent)] [--gmp-mat-color-secondary-container:var(--primary)] [--gmp-mat-color-on-secondary-container:var(--primary-foreground)] [--gmp-mat-color-neutral-container:var(--muted)] [--gmp-mat-color-on-neutral-container:var(--muted-foreground)] [--gmp-mat-color-outline-decorative:var(--border)] [--gmp-mat-font-family:Inter,Arial,Helvetica,sans-serif] [--gmp-mat-font-display-small:normal_600_20px/28px_Inter,Arial,Helvetica,sans-serif] [--gmp-mat-font-body-medium:normal_400_14px/22px_Inter,Arial,Helvetica,sans-serif]";
const googleHostVariants = {
  rating: "max-w-[500px]",
  overview:
    "h-auto max-w-none rounded-none border-0 [--gmp-mat-spacing-large:8px] [--gmp-mat-spacing-medium:8px] [--gmp-mat-spacing-extra-large:0px] [--gmp-mat-spacing-two-extra-large:0px]",
  reviews: "h-[480px] max-w-none",
} as const;
const googleDetailsActionClassName = cn(
  appButton({ variant: "text" }),
  "m-0 inline-flex min-h-9 items-center gap-[5px] py-1 text-[13px] leading-[1.5] focus-visible:rounded-[3px] focus-visible:[outline:2px_solid_var(--ring)] focus-visible:outline-offset-[3px] [@media(max-width:720px),(pointer:coarse)]:min-h-11",
);

type Props = {
  workshop: Workshop;
  identity: GoogleWorkshopIdentity | null;
  status: GoogleProfileStatus;
  requestIdentity?: RequestGoogleIdentity;
  variant?: "rating" | "overview" | "reviews";
};
export function GooglePlaceReviews(props: Props) {
  const { locale } = useI18n();
  return (
    <GoogleDetails
      key={`${props.workshop.id}:${locale}:${props.identity?.placeId ?? ""}:${props.variant ?? "reviews"}`}
      {...props}
    />
  );
}
function GoogleDetails({
  workshop,
  identity,
  status,
  requestIdentity,
  variant = "reviews",
}: Props) {
  const { locale, t } = useI18n(),
    { ref, canLoad, isVisible } = useGoogleVisibility(),
    compact = variant === "rating";
  const container = useRef<HTMLDivElement>(null),
    [started, setStarted] = useState(false),
    [revision, setRevision] = useState(0);
  const [widgetStatus, setWidgetStatus] =
      useState<GoogleProfileStatus>("loading"),
    [loadedAt, setLoadedAt] = useState<number | null>(null),
    [expired, setExpired] = useState(false),
    [needsReload, setNeedsReload] = useState(false);
  const mapsUrl = workshopMapsUrl(workshop, identity?.placeId);
  useEffect(() => {
    if (canLoad) return requestIdentity?.(isVisible);
  }, [canLoad, isVisible, requestIdentity]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Start a provider widget only after both its panel and browser tab become visible.
    if (canLoad && identity && isVisible() && !started) setStarted(true);
  }, [canLoad, identity, isVisible, started]);
  useEffect(() => {
    if (!started || !identity || !container.current) return;
    let active = true,
      element: HTMLElement | null = null,
      expiry: ReturnType<typeof setTimeout> | undefined;
    const host = container.current;
    setWidgetStatus("loading");
    setLoadedAt(null);
    setExpired(false);
    setNeedsReload(false);
    const fail = () => {
      if (active) {
        clearTimeout(timeout);
        setWidgetStatus("unavailable");
        setNeedsReload(!element);
        element?.remove();
        active = false;
      }
    };
    const timeout = setTimeout(fail, 12000);
    void (async () => {
      const library = await loadGooglePlaces(identity.browserKey);
      if (!active) return;
      const tag = compact
        ? "gmp-advanced-place-details-compact"
        : "gmp-advanced-place-details";
      await customElements.whenDefined(tag);
      if (!active) return;
      // Visibility may change while the SDK loads; defer mounting the billable widget.
      if (!isVisible()) {
        clearTimeout(timeout);
        setStarted(false);
        return;
      }
      element = document.createElement(tag);
      element.className = cn(googleHostClassName, googleHostVariants[variant]);
      if (compact) element.setAttribute("orientation", "horizontal");
      const request = document.createElement("gmp-place-details-place-request");
      (request as HTMLElement & { place: unknown }).place = new library.Place({
        id: identity.placeId,
        requestedLanguage: locale,
      });
      element.appendChild(request);
      // Advanced custom content keeps attribution without duplicate names, actions or unrelated details.
      const content =
        variant === "rating"
          ? ["gmp-place-rating"]
          : variant === "overview"
            ? ["gmp-place-rating", "gmp-place-opening-hours"]
            : ["gmp-place-reviews"];
      for (const name of [...content, "gmp-place-attribution"])
        element.appendChild(document.createElement(name));
      element.addEventListener(
        "gmp-load",
        () => {
          if (active) {
            clearTimeout(timeout);
            setWidgetStatus("ready");
            setLoadedAt(Date.now());
            expiry = setTimeout(() => {
              if (active) setExpired(true);
            }, 1800000);
          }
        },
        { once: true },
      );
      element.addEventListener("gmp-error", fail, { once: true });
      host.appendChild(element);
    })().catch(fail);
    return () => {
      active = false;
      clearTimeout(timeout);
      clearTimeout(expiry);
      element?.remove();
    };
  }, [identity, locale, started, revision, isVisible, variant, compact]);
  const unavailable =
    widgetStatus === "unavailable" || (status === "unavailable" && !identity);
  if (compact && (unavailable || expired)) return null;
  return (
    <div
      ref={ref}
      className="min-w-0 w-full max-w-none"
      data-ui="google-place-details"
      data-google-variant={variant}
    >
      <div
        ref={container}
        className={cn("empty:hidden", (expired || unavailable) && "hidden")}
        data-ui="google-official-widget"
        aria-label={t(
          variant === "rating"
            ? "public.googleRatingWidgetAria"
            : variant === "overview"
              ? "public.googleDetailsAria"
              : "public.googleReviewsAria",
          { name: workshop.name },
        )}
      />
      {unavailable || expired ? (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-0 text-[13px] leading-[1.5] text-muted-foreground"
          data-ui="google-details-fallback"
        >
          <p
            className="m-0 text-[13px] leading-[1.5] text-muted-foreground"
            role="status"
          >
            {t(
              unavailable
                ? "public.googleDetailsFailed"
                : variant === "rating"
                  ? "public.googleRatingStale"
                  : "public.googleDetailsStale",
            )}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0">
            {identity && (
              <button
                type="button"
                className={cn(
                  googleDetailsActionClassName,
                  "disabled:cursor-default disabled:opacity-50",
                )}
                aria-label={
                  needsReload
                    ? t("public.googleDetailsReload")
                    : `${t("public.reload")}: ${t("public.googleDetailsRefresh")}`
                }
                disabled={!canLoad}
                onClick={() => {
                  if (isVisible()) {
                    if (needsReload) window.location.reload();
                    else setRevision((value) => value + 1);
                  }
                }}
              >
                <RefreshCw size={14} aria-hidden="true" className="shrink-0" />
                {t(
                  needsReload ? "public.googleDetailsReload" : "public.reload",
                )}
              </button>
            )}
            <LocaleAnchor
              className={googleDetailsActionClassName}
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("public.checkMaps")}
            </LocaleAnchor>
          </div>
        </div>
      ) : (
        !loadedAt &&
        canLoad && (
          <p
            className="m-0 text-[13px] leading-[1.5] text-muted-foreground"
            role="status"
          >
            {t("public.googleDetailsLoading")}
          </p>
        )
      )}
    </div>
  );
}
