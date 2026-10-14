"use client";
import { formatNumber } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/client";
import { MessageCircle, ShieldCheck, Star } from "lucide-react";
import type { Workshop } from "@/lib/workshops";
export function WorkshopRatings({
  workshop: w,
  details = false,
  hideUnavailable = false,
  compact = false,
}: {
  workshop: Workshop;
  details?: boolean;
  hideUnavailable?: boolean;
  compact?: boolean;
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
      className={`workshop-ratings${details ? " workshop-ratings-detailed" : ""}${compact ? " workshop-ratings-compact" : ""}`}
      aria-label={t("public.ratingSources")}
    >
      {(!hideUnavailable || riparimRated) && (
        <div className="workshop-rating-row riparim-rating">
          <span className="rating-provider">
            <ShieldCheck size={15} aria-hidden="true" />
            Riparim
          </span>
          {riparimRated ? (
            <span
              className="rating-value"
              aria-label={t("public.ratingAria", {
                rating: decimal(w.rating!),
                count: w.count,
              })}
            >
              <Star size={14} fill="currentColor" aria-hidden="true" />
              <strong>{decimal(w.rating!)}</strong>
              <span>
                {compact
                  ? `(${formatNumber(locale, w.count)})`
                  : t("common.reviewCount", { count: w.count })}
              </span>
            </span>
          ) : (
            <span className="rating-unavailable">
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
        <p className="rating-explanation">{t("public.ratingExplanation")}</p>
      )}
    </div>
  );
}
