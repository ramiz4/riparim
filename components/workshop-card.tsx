"use client";
import { storedSentinels, storedServices } from "@/lib/i18n/canonical-values";

import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { helpTextClassName } from "@/lib/presentation";
import { valueLabel } from "@/lib/i18n/values";
import { WorkshopNavigationLink } from "@/components/workshop-navigation-link";
import { MapPin, ArrowUpRight } from "lucide-react";
import { WorkshopRatings } from "@/components/workshop-ratings";
import {
  workshopDisplayLanguage,
  type WorkshopDisplayContent,
} from "@/lib/workshop-profile-content";
import { catalogueValues, type CatalogueChoice } from "@/lib/catalogue-filters";
import type { Workshop } from "@/lib/workshops";

export function WorkshopCard({
  workshop: w,
  selectedBrand = storedSentinels.allBrands,
  selectedService = storedServices.all,
  searchHref,
  distanceKm,
  distanceOrigin,
  display,
  hidden = false,
  headingLevel = 2,
  variant = "default",
  placementLabel,
  layout = "default",
  backgroundImage,
}: {
  variant?: "default" | "highlight";
  layout?: "default" | "catalogue";
  placementLabel?: string;
  backgroundImage?: string;
  headingLevel?: 2 | 3;
  display?: WorkshopDisplayContent;
  workshop: Workshop;
  selectedBrand?: CatalogueChoice;
  selectedService?: CatalogueChoice;
  searchHref?: string;
  distanceKm?: number | null;
  distanceOrigin?: string;
  hidden?: boolean;
}) {
  const { locale, t } = useI18n();
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const profileHref = `/werkstatt/${encodeURIComponent(w.id)}${searchHref ? `?${new URLSearchParams({ suche: searchHref })}` : ""}`;
  const details = w.services.length
    ? [...w.services]
        .sort(
          (a, b) =>
            Number(catalogueValues(selectedService).includes(b)) -
            Number(catalogueValues(selectedService).includes(a)),
        )
        .slice(0, 3)
    : w.serviceDetails.filter((detail) => detail.length <= 50).slice(0, 3);
  const shownBrands = [...w.brands]
    .sort(
      (a, b) =>
        Number(catalogueValues(selectedBrand).includes(b)) -
        Number(catalogueValues(selectedBrand).includes(a)),
    )
    .slice(0, 2);
  if (variant === "highlight")
    return (
      <article
        data-ui="workshop-card catalogue-card partner-card"
        className="relative isolate flex min-h-[300px] min-w-0 flex-col overflow-hidden rounded-[24px] border-0 bg-[#071e20] p-7 text-white shadow-none [&[hidden]]:hidden before:pointer-events-none before:absolute before:inset-0 before:z-[-1] before:content-[''] before:[background:linear-gradient(180deg,rgba(3,24,26,0.9),rgba(3,24,26,0.74)_42%,rgba(3,24,26,0.38)_62%,rgba(3,24,26,0.94)),linear-gradient(90deg,rgba(3,24,26,0.24),transparent)] has-[a:focus-visible]:[outline:3px_solid_#b7e0d3] has-[a:focus-visible]:outline-offset-[-4px] [@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:[transition:transform_0.2s_ease,box-shadow_0.2s_ease] [@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:hover:[transform:translateY(-4px)] [@media(hover:hover)_and_(prefers-reduced-motion:no-preference)]:hover:[box-shadow:0_16px_32px_#173b3312] at-most-1000:snap-start at-most-1000:p-6 at-most-720:min-h-[290px]"
        hidden={hidden}
      >
        {backgroundImage && (
          <div
            className="pointer-events-none absolute inset-0 z-[-2] bg-cover bg-center"
            style={{ backgroundImage: `url("${backgroundImage}")` }}
            aria-hidden="true"
          />
        )}
        {placementLabel && (
          <span
            data-ui="partner-label"
            className="mb-5 max-w-full self-start text-[12px] font-[550] leading-[1.5] text-[#f4f8f7]"
          >
            {placementLabel}
          </span>
        )}
        <div className="min-w-0">
          <Heading className="m-0 text-[24px] font-bold leading-[1.2] tracking-[-0.6px] text-inherit [overflow-wrap:anywhere]">
            <WorkshopNavigationLink
              className="after:absolute after:inset-0 after:z-[3] after:content-[''] focus-visible:[outline:3px_solid_#b7e0d3] focus-visible:outline-offset-4 dark:focus-visible:outline-ring supports-[selector(:has(*))]:focus-visible:outline-none"
              data-card-focus-target
              href={profileHref}
              aria-label={t("public.viewProfile", { name: w.name })}
              onFocus={(event) =>
                event.currentTarget
                  .closest("article")
                  ?.scrollIntoView({ block: "nearest", inline: "nearest" })
              }
            >
              {w.name}
            </WorkshopNavigationLink>
          </Heading>
          {details[0] && (
            <p
              className="mt-3 text-[16px] leading-[1.5] text-[#f4f8f7]"
              lang={
                w.services.includes(details[0])
                  ? undefined
                  : workshopDisplayLanguage(display, locale)
              }
            >
              {w.services.includes(details[0])
                ? valueLabel(locale, "service", details[0])
                : (display?.serviceDetails[
                    w.serviceDetails.indexOf(details[0])
                  ] ?? details[0])}
            </p>
          )}
        </div>
        <div className="relative z-[1] mt-auto flex items-end justify-between gap-3 pt-7">
          <div>
            <p className="flex items-center gap-[6px] text-[14px] leading-[1.5] text-[#f4f8f7]">
              <MapPin size={16} aria-hidden="true" />
              {w.city}
            </p>
            <WorkshopRatings
              workshop={w}
              hideUnavailable
              compact
              presentation="highlight"
            />
          </div>
          <span
            className="grid size-11 shrink-0 place-items-center rounded-full bg-[#b7e0d3] text-[#071e20]"
            aria-hidden="true"
          >
            <ArrowUpRight size={24} />
          </span>
        </div>
        {backgroundImage && (
          <span className="mt-3 text-[12px] leading-[1.5] text-[#d8e9e2]">
            {t("public.partnerImageNote")}
          </span>
        )}
        {display?.fallback && (
          <p
            className={cn(
              helpTextClassName,
              "font-normal",
              layout === "catalogue" && "at-least-1001:col-span-full",
            )}
          >
            {t("public.translationFallback")}
          </p>
        )}
      </article>
    );
  return (
    <article
      data-ui="workshop-card catalogue-card"
      className="relative flex min-w-0 rounded-xl border border-[#dce6df] bg-white [box-shadow:0_2px_5px_#143c2b04] [transition:border-color_0.15s,box-shadow_0.15s] [&[hidden]]:hidden hover:border-[var(--theme-accent)] hover:[box-shadow:0_8px_24px_#143c2b12] focus-within:border-[#096e61] dark:border-border dark:bg-card dark:hover:border-ring dark:focus-within:border-ring motion-reduce:transition-none"
      hidden={hidden}
    >
      <div
        className={cn(
          "group/card-link flex min-w-0 flex-1 cursor-auto flex-col gap-4 rounded-[inherit] p-[22px] text-inherit no-underline at-most-1000:p-[18px]",
          layout === "catalogue" &&
            "at-least-1001:grid at-least-1001:grid-cols-[minmax(0,1fr)_minmax(190px,0.8fr)] at-least-1001:items-start at-least-1001:gap-x-6 at-least-1001:gap-y-3 at-least-1001:px-6 at-least-1001:py-5",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-start gap-[13px]",
            layout === "catalogue" &&
              "at-least-1001:col-start-1 at-least-1001:row-span-2",
          )}
        >
          <div className="min-w-0 flex-1">
            <Heading className="m-0 text-[1.1875rem] font-[650] leading-[1.35] tracking-[-0.15px] text-[#254a38] [overflow-wrap:anywhere] [@media(hover:hover)]:group-hover/card-link:text-[#096e61] dark:text-foreground dark:group-hover/card-link:text-[var(--theme-accent)]">
              <WorkshopNavigationLink
                className="after:absolute after:inset-0 after:z-[1] after:rounded-[inherit] after:content-[''] focus-visible:outline-none focus-visible:after:[outline:3px_solid_#096e61] focus-visible:after:outline-offset-[3px] dark:focus-visible:after:outline-ring"
                data-card-focus-target
                href={profileHref}
                aria-label={t("public.viewProfile", { name: w.name })}
              >
                {w.name}
              </WorkshopNavigationLink>
            </Heading>
            <p className="mt-[5px] flex flex-wrap items-center gap-x-[7px] gap-y-[5px] text-[0.875rem] leading-[1.5] text-[#45644f] dark:text-muted-foreground">
              <MapPin size={16} aria-hidden="true" />
              {w.city}
              {distanceKm != null && (
                <span
                  className="inline-flex rounded-[5px] bg-[var(--theme-hover)] px-[6px] py-px text-[0.875rem] font-semibold leading-[1.5] text-[var(--theme-positive)] dark:text-muted-foreground"
                  title={t("public.distanceTitle", {
                    city: distanceOrigin ?? w.city,
                  })}
                >
                  {t("public.approxDistance", { distance: distanceKm })}
                </span>
              )}
            </p>
          </div>
        </div>
        <WorkshopRatings
          workshop={w}
          presentation="catalogue"
          className={
            layout === "catalogue"
              ? "at-least-1001:col-start-2 at-least-1001:row-start-1"
              : undefined
          }
        />
        {details.length > 0 && (
          <div
            data-ui="catalogue-card-services"
            className={cn(
              "flex flex-wrap gap-[6px]",
              layout === "catalogue" && "at-least-1001:col-start-2",
            )}
          >
            {details.map((detail) => (
              <span
                lang={
                  w.services.includes(detail)
                    ? undefined
                    : workshopDisplayLanguage(display, locale)
                }
                className={cn(
                  "rounded-[6px] border border-[#e0eae4] bg-[#eef5f1] px-2 py-[3px] text-[0.8125rem] leading-[1.5] text-[#365744] [overflow-wrap:anywhere] dark:border-border dark:bg-accent dark:text-[#c0e1d7]",
                  catalogueValues(selectedService).includes(detail) &&
                    "border-[#bcd8c6] bg-[#deeee4] font-semibold dark:border-[#38725f] dark:bg-[#225445] dark:text-[#b6efcf]",
                )}
                key={detail}
              >
                {w.services.includes(detail)
                  ? valueLabel(locale, "service", detail)
                  : (display?.serviceDetails[
                      w.serviceDetails.indexOf(detail)
                    ] ?? detail)}
              </span>
            ))}
          </div>
        )}
        {shownBrands.length > 0 && (
          <div
            className={cn(
              "flex flex-wrap gap-[6px]",
              layout === "catalogue" && "at-least-1001:col-start-2",
            )}
          >
            {shownBrands.map((brand) => (
              <span
                className="rounded-[5px] border border-[#e0e8e1] bg-[#f5f8f5] px-[7px] py-1 text-[0.875rem] leading-[1.5] text-[#506b56] [overflow-wrap:anywhere] dark:border-border dark:bg-secondary dark:text-muted-foreground"
                key={brand}
              >
                {valueLabel(locale, "sentinel", brand)}
              </span>
            ))}
          </div>
        )}
        {display?.fallback && (
          <p
            className={cn(
              helpTextClassName,
              "font-normal",
              layout === "catalogue" && "at-least-1001:col-span-full",
            )}
          >
            {t("public.translationFallback")}
          </p>
        )}
      </div>
    </article>
  );
}
