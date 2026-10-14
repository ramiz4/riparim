"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { appButton, pageFrameClassName } from "@/lib/presentation";
import { useI18n } from "@/lib/i18n/client";
import { selectPartnerWorkshops } from "@/lib/partner-selection";
import { Sparkles } from "lucide-react";
import { WorkshopCard } from "./workshop-card";
import { LoadingIndicator } from "./loading-indicator";
import type { Workshop } from "@/lib/workshops";
import type { WorkshopDisplayById } from "@/lib/workshop-profile-content";
import type { Locale } from "@/lib/i18n/locale";

type View = {
  locale: Locale;
  status: "loading" | "ready" | "error";
  preview: boolean;
  workshops: Workshop[];
  displayById: WorkshopDisplayById;
};
const partnerBackgrounds = [
  "/partner-maintenance-bg-v2.webp",
  "/partner-diagnostics-bg.webp",
  "/partner-bodywork-bg.webp",
];
export function DiscoverWorkshops() {
  const { locale, t } = useI18n();
  const [view, setView] = useState<View>({
      locale,
      status: "loading",
      preview: true,
      workshops: [],
      displayById: {},
    }),
    [attempt, setAttempt] = useState(0);
  const status = view.locale === locale ? view.status : "loading";
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/premium-workshops?locale=${locale}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          preview?: boolean;
          workshops?: Workshop[];
          displayById?: WorkshopDisplayById;
        };
        if (
          !response.ok ||
          !Array.isArray(data.workshops) ||
          typeof data.preview !== "boolean"
        )
          throw Error("Directory unavailable");
        if (!controller.signal.aborted)
          setView({
            locale,
            status: "ready",
            preview: data.preview,
            workshops: selectPartnerWorkshops(data.workshops),
            displayById: data.displayById ?? {},
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setView({
            locale,
            status: "error",
            preview: true,
            workshops: [],
            displayById: {},
          });
      });
    return () => controller.abort();
  }, [locale, attempt]);
  function retry() {
    setView({
      locale,
      status: "loading",
      preview: true,
      workshops: [],
      displayById: {},
    });
    setAttempt((value) => value + 1);
  }
  return (
    <section
      className={cn(
        pageFrameClassName,
        "mt-0 rounded-none border-0 bg-transparent py-20 at-most-720:py-12",
      )}
      aria-labelledby="discover-title"
    >
      <div className="mb-6">
        <h2
          className="flex items-center gap-[10px] text-[28px] font-[650] leading-[1.2] tracking-[-0.7px] at-most-720:text-[26px]"
          id="discover-title"
        >
          <Sparkles
            className="shrink-0 text-[var(--theme-accent)] at-most-720:size-[22px]"
            size={24}
            aria-hidden="true"
          />
          {t("public.partnerTitle")}
        </h2>
      </div>
      {status === "loading" ? (
        <LoadingIndicator label={t("public.loadingWorkshops")} />
      ) : status === "error" ? (
        <div
          className="flex flex-wrap items-center gap-4 py-6 text-muted-foreground"
          role="alert"
        >
          <p>{t("public.directoryUnavailable")}</p>
          <button
            type="button"
            className={appButton({ variant: "outline" })}
            onClick={retry}
          >
            {t("public.reload")}
          </button>
        </div>
      ) : view.workshops.length === 0 ? (
        <div className="flex flex-wrap items-center gap-4 py-6 text-muted-foreground">
          <p>{t("public.directoryEmpty")}</p>
          <p>{t("public.directoryEmptyHelp")}</p>
        </div>
      ) : (
        <div
          data-ui="discover-grid"
          className="grid grid-cols-3 gap-6 [&[hidden]]:hidden at-most-1000:auto-cols-[48%] at-most-1000:grid-flow-col at-most-1000:grid-cols-none at-most-1000:gap-4 at-most-1000:overflow-x-auto at-most-1000:px-[2px] at-most-1000:pt-1 at-most-1000:pb-5 at-most-1000:[scroll-snap-type:x_mandatory] at-most-1000:[scroll-padding-inline:2px] at-most-1000:[scrollbar-width:thin] at-most-720:auto-cols-[86%] at-most-720:[overscroll-behavior-inline:contain]"
        >
          {view.workshops.map((workshop, index) => (
            <WorkshopCard
              key={workshop.id}
              variant="highlight"
              backgroundImage={partnerBackgrounds[index]}
              placementLabel={view.preview ? undefined : t("public.partnerAd")}
              headingLevel={3}
              workshop={workshop}
              display={view.displayById[workshop.id]}
            />
          ))}
        </div>
      )}
    </section>
  );
}
