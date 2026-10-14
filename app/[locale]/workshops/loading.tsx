"use client";
import { useI18n } from "@/lib/i18n/client";
import { LoadingIndicator } from "@/components/loading-indicator";

export default function CatalogueLoading() {
  const { t } = useI18n();
  return (
    <main className="catalogue-page wrap">
      <LoadingIndicator label={t("common.loadingWorkshops")} />
    </main>
  );
}
