"use client";
import { cn } from "@/lib/utils";
import { pageFrameClassName } from "@/lib/presentation";
import { useI18n } from "@/lib/i18n/client";
import { LoadingIndicator } from "@/components/loading-indicator";

export default function CatalogueLoading() {
  const { t } = useI18n();
  return (
    <main
      className={cn(
        pageFrameClassName,
        "pt-[34px] pb-[52px] text-[1rem] at-most-1000:pt-3 at-most-1000:pb-[34px]",
      )}
      data-riparim-page="catalogue"
    >
      <LoadingIndicator label={t("common.loadingWorkshops")} />
    </main>
  );
}
