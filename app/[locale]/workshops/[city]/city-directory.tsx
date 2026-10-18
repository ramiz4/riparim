"use client";
import { useEffect, useState } from "react";
import Link from "@/components/locale-link";
import { SiteHeader } from "@/components/site-header";
import { DirectoryFooter } from "@/components/directory-footer";
import { CityNavigation } from "@/components/city-navigation";
import { WorkshopCard } from "@/components/workshop-card";
import { useI18n } from "@/lib/i18n/client";
import { valueLabel } from "@/lib/i18n/values";
import {
  catalogueHref,
  defaultCatalogueFilters,
} from "@/lib/catalogue-filters";
import { cityWorkshops, type WorkshopCity } from "@/lib/workshop-cities";
import { appButton, pageFrameClassName } from "@/lib/presentation";
import type { Workshop } from "@/lib/workshops";
import type { WorkshopDisplayById } from "@/lib/workshop-profile-content";

export default function CityDirectory({
  city,
  initialWorkshops,
  initialDisplayById,
  initialError,
  publicSnapshot,
}: {
  city: WorkshopCity;
  initialWorkshops: Workshop[];
  initialDisplayById: WorkshopDisplayById;
  initialError: boolean;
  publicSnapshot: boolean;
}) {
  const { locale, t } = useI18n();
  const [data, setData] = useState({
    workshops: initialWorkshops,
    displayById: initialDisplayById,
  });
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    initialError
      ? "error"
      : publicSnapshot && !initialWorkshops.length
        ? "loading"
        : "ready",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!publicSnapshot && !attempt) return;
    let active = true;
    const controller = new AbortController();
    void fetch(`/api/workshops?locale=${locale}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = (await response.json()) as {
          workshops?: Workshop[];
          displayById?: WorkshopDisplayById;
        };
        if (!response.ok || !Array.isArray(value.workshops))
          throw Error("Directory unavailable");
        if (active) {
          setData({
            workshops: cityWorkshops(value.workshops, city),
            displayById: value.displayById ?? {},
          });
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setData({ workshops: [], displayById: {} });
          setStatus("error");
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [city, locale, publicSnapshot, attempt]);
  const workshops = cityWorkshops(data.workshops, city);
  const filters = { ...defaultCatalogueFilters, city: city.name };
  const searchHref = catalogueHref(filters);
  const serviceCounts = new Map<string, number>();
  for (const workshop of workshops)
    for (const service of new Set(workshop.services))
      serviceCounts.set(service, (serviceCounts.get(service) ?? 0) + 1);
  return (
    <>
      <SiteHeader account={null} publicSnapshot />
      <main
        className={`${pageFrameClassName} py-8`}
        data-riparim-page="city"
        data-city={city.slug}
      >
        <nav aria-label={t("public.backSearch")} className="mb-6">
          <Link
            href="/workshops"
            className="inline-flex min-h-11 items-center underline underline-offset-4"
          >
            {t("city.all")}
          </Link>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">
          {t("city.heading", { city: city.name })}
        </h1>
        <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">
          {t(`city.${city.slug}`)}
        </p>
        <div className="mt-5">
          <Link href={searchHref} className={appButton()}>
            {t("city.refine", { city: city.name })}
          </Link>
        </div>
        <section className="mt-10" aria-labelledby="city-results">
          <h2 id="city-results" className="text-xl font-semibold">
            {t("city.results", { city: city.name })}
          </h2>
          {status === "loading" ? (
            <p className="mt-4" role="status">
              {t("public.loadingWorkshops")}
            </p>
          ) : status === "error" ? (
            <div className="mt-4" role="alert">
              <p>{t("public.directoryUnavailable")}</p>
              <button
                type="button"
                className={`${appButton()} mt-3`}
                onClick={() => {
                  setStatus("loading");
                  setAttempt((value) => value + 1);
                }}
              >
                {t("common.retry")}
              </button>
            </div>
          ) : (
            <>
              <p className="mt-2 text-muted-foreground">
                {workshops.length
                  ? t("public.workshopCount", { count: workshops.length })
                  : t("city.empty", { city: city.name })}
              </p>
              <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-2">
                {workshops.map((workshop) => (
                  <div key={workshop.id} data-workshop-id={workshop.id}>
                    <WorkshopCard
                      headingLevel={3}
                      workshop={workshop}
                      display={data.displayById[workshop.id]}
                      searchHref={searchHref}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
        {status === "ready" && serviceCounts.size > 0 && (
          <section className="mt-10" aria-labelledby="city-services">
            <h2 id="city-services" className="text-xl font-semibold">
              {t("city.services")}
            </h2>
            <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
              {t("city.serviceHelp")}
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {[...serviceCounts].map(([service, count]) => (
                <li key={service}>
                  <Link
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                    href={catalogueHref({ ...filters, service })}
                  >
                    {t("city.serviceCount", {
                      service: valueLabel(locale, "service", service),
                      count,
                    })}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="my-10 max-w-3xl">
          <h2 className="text-xl font-semibold">{t("city.contactTitle")}</h2>
          <p className="mt-3 leading-7 text-muted-foreground">
            {t("city.contactHelp")}
          </p>
        </section>
        <CityNavigation current={city.slug} />
      </main>
      <DirectoryFooter />
    </>
  );
}
