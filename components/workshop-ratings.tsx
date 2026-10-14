"use client";
import { formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { MessageCircle, ShieldCheck, Star } from "lucide-react";
import type { Workshop } from "@/lib/workshops";
export function WorkshopRatings({
  workshop: w,
  details = false,
  hideUnavailable = false,
  compact = false,
  presentation = "default",
  className,
}: {
  workshop: Workshop;
  details?: boolean;
  hideUnavailable?: boolean;
  compact?: boolean;
  presentation?: "default" | "profile" | "catalogue" | "highlight";
  className?: string;
}) {
  const { locale, t } = useI18n();
  const decimal = (value: number) =>
    formatNumber(locale, value, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  const riparimRated = w.rating !== null && w.count > 0;
  if (hideUnavailable && !riparimRated) return null;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 mt-[17px] mb-3 border-y border-[#e5ecee] py-3 text-[14px] leading-[1.45] dark:border-border",
        details &&
          "mt-[14px] max-w-[430px] rounded-[10px] border border-[#dce6e8] bg-[#f7fafb] p-[14px] dark:bg-[var(--theme-surface)] dark:text-[#c0e1d7]",
        compact &&
          "mt-[15px] mb-0 flex-row flex-wrap gap-[10px] border-0 p-0 at-most-720:mt-[13px] at-most-720:gap-2",
        (presentation === "catalogue" || presentation === "highlight") &&
          "m-0 gap-[6px] border-0 p-0 at-most-720:mt-0 at-most-720:gap-[6px]",
        presentation === "highlight" && "mt-2 at-most-720:mt-2",
        presentation === "profile" &&
          "m-0 flex-col flex-nowrap items-start justify-center gap-2 at-most-720:mt-0 at-most-720:gap-x-4",
        className,
      )}
      data-ui="workshop-ratings"
      aria-label={t("public.ratingSources")}
    >
      {(!hideUnavailable || riparimRated) && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-3 gap-y-[6px]",
            compact &&
              "inline-flex min-h-[42px] justify-start gap-[10px] rounded-lg border border-[#e0e8e6] bg-[#f7faf8] px-3 py-2 dark:border-border dark:bg-[var(--theme-surface)] dark:text-[#c0e1d7] at-most-720:max-w-full at-most-720:gap-2 at-most-720:px-[10px] at-most-720:py-[7px]",
            !compact &&
              (presentation === "catalogue" || presentation === "highlight") &&
              "justify-start gap-x-[10px] gap-y-[6px]",
            presentation === "profile" &&
              "min-h-[30px] max-w-full rounded-none border-0 bg-transparent p-0 dark:bg-transparent at-most-720:p-0",
          )}
        >
          <span
            className={cn(
              "inline-flex items-center gap-[5px] font-[650] text-[#315954] dark:text-[#c0e1d7]",
              (presentation === "catalogue" || presentation === "highlight") &&
                "text-[0.8125rem] no-underline",
              presentation === "highlight" &&
                "text-[#f4f8f7] dark:text-[#f4f8f7]",
              presentation === "profile" && "text-[14px] leading-[1.45]",
            )}
          >
            <ShieldCheck size={15} aria-hidden="true" />
            Riparim
          </span>
          {riparimRated ? (
            <span
              className={cn(
                "inline-flex items-center gap-[5px] text-[#7e611c] dark:text-[var(--theme-warning)]",
                presentation === "highlight" && "[&>svg]:text-[#b7e0d3]",
                (presentation === "catalogue" ||
                  presentation === "highlight") &&
                  "[&>svg]:size-4",
              )}
              aria-label={t("public.ratingAria", {
                rating: decimal(w.rating!),
                count: w.count,
              })}
            >
              <Star size={14} fill="currentColor" aria-hidden="true" />
              <strong
                className={cn(
                  "text-[15px]",
                  (presentation === "catalogue" ||
                    presentation === "highlight") &&
                    "text-[1.25rem]",
                  compact && "text-[18px]",
                  (presentation === "catalogue" ||
                    presentation === "highlight") &&
                    "font-bold leading-[1.35]",
                  presentation === "highlight" && "text-[#f4f8f7]",
                )}
              >
                {decimal(w.rating!)}
              </strong>
              <span
                className={cn(
                  "text-muted-foreground",
                  (presentation === "catalogue" ||
                    presentation === "highlight") &&
                    "text-[0.875rem]",
                  presentation === "highlight" && "text-[#f4f8f7]",
                )}
              >
                {compact
                  ? `(${formatNumber(locale, w.count)})`
                  : t("common.reviewCount", { count: w.count })}
              </span>
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-[5px] text-[13px] text-muted-foreground",
                (presentation === "catalogue" ||
                  presentation === "highlight") &&
                  "text-[0.8125rem] [&>svg]:hidden",
                compact && "text-[14px]",
              )}
            >
              {compact ? (
                t("common.reviewCount", { count: 0 })
              ) : (
                <>
                  <MessageCircle size={14} aria-hidden="true" />
                  {t("public.noReviews")}
                </>
              )}
            </span>
          )}
        </div>
      )}
      {details && (
        <p className="mt-[5px] text-[13px] leading-[1.55] text-muted-foreground">
          {t("public.ratingExplanation")}
        </p>
      )}
    </div>
  );
}
