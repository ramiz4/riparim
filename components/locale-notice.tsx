"use client";
import { usePageQuery } from "./use-page-query";
import { useI18n } from "@/lib/i18n/client";
export function LocaleNotice() {
  const query = usePageQuery(),
    { t } = useI18n();
  return query.get("localeNotice") === "preference_not_saved" ? (
    <p className="wrap" role="status">
      {t("common.preferenceNotSaved")}
    </p>
  ) : null;
}
