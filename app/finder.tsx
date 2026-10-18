"use client";
import { publicDataError } from "@/lib/i18n/public-errors";
import { useI18n } from "@/lib/i18n/client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useId, useRef } from "react";
import { Wrench, MapPin, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  appButton,
  errorClassName,
  pageFrameClassName,
} from "@/lib/presentation";
import { DiscoverWorkshops } from "@/components/discover-workshops";
import { ReviewInvitation } from "@/components/review-invitation";
import { LoadingIndicator } from "@/components/loading-indicator";
import { SiteHeader } from "@/components/site-header";
import { Picker } from "@/components/picker";
import { DirectoryFooter } from "@/components/directory-footer";
import type { AccountIdentity } from "@/components/account-storage-notice";
import {
  catalogueHref,
  defaultCatalogueFilters,
  matchCatalogue,
} from "@/lib/catalogue-filters";
import { rememberSearchSession } from "@/lib/search-session";
import { cities, services, type Workshop } from "@/lib/workshops";

type Props = {
  initialWorkshops: Workshop[];
  initialError: string;
  account: AccountIdentity | null;
  isAdmin: boolean;
  publicSnapshot?: boolean;
};
export default function Finder({
  initialWorkshops,
  initialError,
  account,
  isAdmin,
  publicSnapshot = false,
}: Props) {
  const { locale, t } = useI18n();
  const router = useRouter(),
    id = useId();
  const [service, setService] = useState(services[0]),
    [city, setCity] = useState(cities[0]),
    [info, setInfo] = useState(false);
  const [navigating, setNavigating] = useState(false),
    navigationStarted = useRef(false),
    loadingMain = useRef<HTMLElement>(null);
  useEffect(() => {
    if (navigating) {
      loadingMain.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [navigating]);
  function navigate(href: string) {
    if (navigationStarted.current) return;
    navigationStarted.current = true;
    setNavigating(true);
    try {
      router.push(href);
    } catch (error) {
      navigationStarted.current = false;
      setNavigating(false);
      throw error;
    }
  }
  const directory = initialWorkshops,
    directoryReady = !initialError;
  function navigateQuick(nextService = service, nextCity = city) {
    const filters = {
        ...defaultCatalogueFilters,
        service: nextService,
        city: nextCity,
      },
      href = catalogueHref(filters, locale);
    rememberSearchSession({
      catalogueHref: href,
      visibleCount: 12,
      scrollY: 0,
    });
    navigate(href);
  }
  useEffect(() => {
    const mc = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (!mc?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      mc.registerTool(
        {
          name: "configure_workshop_search",
          title: t("public.searchToolTitle"),
          description: t("public.searchToolDescription"),
          inputSchema: {
            type: "object",
            properties: {
              service: { type: "string", enum: services },
              city: { type: "string", enum: cities },
            },
            required: ["service", "city"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          async execute(input: unknown) {
            if (!directoryReady) throw Error(t("public.directoryUnavailable"));
            if (!input || typeof input !== "object")
              throw Error(t("common.invalidRequest"));
            const value = input as { service: string; city: string };
            if (
              !services.includes(value.service) ||
              !cities.includes(value.city) ||
              Object.keys(value).some(
                (key) => !["service", "city"].includes(key),
              )
            )
              throw Error(t("common.invalidRequest"));
            const filters = {
                ...defaultCatalogueFilters,
                service: value.service,
                city: value.city,
              },
              href = catalogueHref(filters, locale);
            rememberSearchSession({
              catalogueHref: href,
              visibleCount: 12,
              scrollY: 0,
            });
            router.push(href);
            const response = await fetch("/api/workshops", {
              cache: "no-store",
            });
            if (!response.ok) throw Error(t("public.directoryUnavailable"));
            const data = (await response.json()) as { workshops: Workshop[] };
            return {
              workshops: matchCatalogue(data.workshops, filters).map((w) => ({
                id: w.id,
                name: w.name,
                city: w.city,
                reviewCount: w.count,
              })),
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch((error) => console.warn("WebMCP registration", error));
    return () => lifecycle.abort();
  }, [directory, directoryReady, router, locale, t]);
  return (
    <>
      <SiteHeader
        account={account}
        isAdmin={isAdmin}
        publicSnapshot={publicSnapshot}
        hero={!navigating}
      />
      {navigating ? (
        <main
          ref={loadingMain}
          tabIndex={-1}
          className={cn(
            pageFrameClassName,
            "pt-[34px] pb-[52px] text-[1rem] at-most-1000:pt-3 at-most-1000:pb-[34px]",
          )}
          data-riparim-page="catalogue"
        >
          <LoadingIndicator label={t("common.loadingWorkshops")} />
        </main>
      ) : (
        <main className="bg-white dark:bg-background" data-riparim-page="home">
          <section
            className="relative isolate flex items-center bg-[#071e20] text-white"
            aria-labelledby="hero-title"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Preoptimized static WebP variants preserve responsive selection and hero priority across all runtimes. */}
            <img
              className="pointer-events-none absolute top-[calc(-1_*_var(--site-header-height))] right-0 bottom-0 left-0 z-[-2] h-[calc(100%_+_var(--site-header-height))] w-full object-cover [object-position:center_44%] at-most-720:[object-position:69%_center]"
              src="/workshop-1536.webp"
              srcSet="/workshop-640.webp 640w, /workshop-1024.webp 1024w, /workshop-1536.webp 1536w"
              sizes="100vw"
              width={1536}
              height={1024}
              fetchPriority="high"
              alt=""
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute top-[calc(-1_*_var(--site-header-height))] right-0 bottom-0 left-0 z-[-1] h-[calc(100%_+_var(--site-header-height))] w-full [background:linear-gradient(90deg,rgba(3,24,26,0.96)_0%,rgba(3,24,26,0.92)_24%,rgba(3,24,26,0.78)_39%,rgba(3,24,26,0.22)_63%,rgba(3,24,26,0.03)_100%),linear-gradient(0deg,rgba(3,24,26,0.2),transparent_50%)] at-most-1000:[background:linear-gradient(90deg,rgba(3,24,26,0.94),rgba(3,24,26,0.74)_47%,rgba(3,24,26,0.18))] at-most-720:[background:linear-gradient(90deg,rgba(3,24,26,0.87),rgba(3,24,26,0.7)_56%,rgba(3,24,26,0.46)),linear-gradient(0deg,rgba(3,24,26,0.36),transparent_65%)]"
              aria-hidden="true"
            />
            <div
              className={cn(
                pageFrameClassName,
                "flex min-h-[calc(100svh_-_var(--site-header-height))] min-w-0 flex-col items-start justify-start pt-14 pb-[104px] at-most-720:pt-7 at-most-720:pb-14",
              )}
            >
              <h1
                className="m-0 mt-[calc(clamp(32px,20svh,280px)_+_176px)] max-w-[560px] text-[clamp(3.25rem,5.2vw,4.5rem)] font-[750] leading-[1.04] tracking-[-0.04em] text-white at-most-1000:mt-auto at-most-720:text-[clamp(2.125rem,8.4vw,2.75rem)] at-most-720:leading-[1.1] at-most-720:tracking-[-0.035em]"
                id="hero-title"
              >
                {t("public.heroCar")}
                <span className="block text-[#b7e0d3]">
                  {t("public.heroWorkshop")}
                </span>
              </h1>
              <p className="mt-5 mb-8 max-w-[460px] text-[1.125rem] leading-[1.55] text-[#f4f8f7] at-most-1000:mb-[88px] at-most-720:mt-4 at-most-720:mb-16 at-most-720:text-[1rem]">
                {t("public.heroBenefit")}
              </p>
              <section
                id="suche"
                className="mx-0 mt-auto mb-0 w-full min-w-0 shrink-0 scroll-mt-24 rounded-[16px] border border-white/70 p-5 text-card-foreground [background:rgba(255,255,255,0.96)] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.5),0_10px_32px_#00000020] outline-offset-4 focus-visible:[outline:3px_solid_var(--ring)] dark:border-white/18 dark:[background:rgba(16,43,47,0.96)] dark:[box-shadow:inset_0_1px_0_rgba(255,255,255,0.08),0_10px_32px_#00000030] can-blur:[background:rgba(255,255,255,0.72)] can-blur:dark:[background:rgba(16,43,47,0.72)] can-blur:[backdrop-filter:blur(18px)] can-blur:[-webkit-backdrop-filter:blur(18px)] at-most-1000:mt-0 at-most-720:scroll-mt-[86px] at-most-720:p-[14px] at-most-720:[backdrop-filter:blur(12px)] at-most-720:[-webkit-backdrop-filter:blur(12px)] reduced-transparency:[background:var(--card)] reduced-transparency:[backdrop-filter:none] reduced-transparency:[-webkit-backdrop-filter:none]"
                aria-label={t("public.searchLabel")}
                tabIndex={-1}
              >
                <form
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-[14px] rounded-none border-0 bg-transparent p-0 shadow-none at-most-720:grid-cols-[minmax(0,1fr)]"
                  onSubmit={(event) => {
                    event.preventDefault();
                    navigateQuick();
                  }}
                >
                  <label
                    className="block min-w-0 border-r border-[#dce6e7] py-1 pr-[18px] pl-[18px] at-most-1000:pl-3 at-most-720:border-r-0 at-most-720:border-b at-most-720:px-0 at-most-720:pt-0 at-most-720:pb-3 dark:border-border"
                    htmlFor={`${id}-service`}
                  >
                    <span className="mb-[3px] flex items-center gap-[7px] text-[13px] font-medium text-[#40565b] dark:text-muted-foreground">
                      <Wrench size={16} />
                      {t("public.service")}
                    </span>
                    <Picker
                      presentation="search"
                      sortLabels
                      id={`${id}-service`}
                      value={service}
                      onChange={setService}
                      values={services}
                      valueCategory="service"
                      label={t("public.service")}
                    />
                  </label>
                  <label
                    className="block min-w-0 px-[18px] py-1 at-most-1000:px-3 at-most-720:px-0 at-most-720:pt-0 at-most-720:pb-[10px]"
                    htmlFor={`${id}-city`}
                  >
                    <span className="mb-[3px] flex items-center gap-[7px] text-[13px] font-medium text-[#40565b] dark:text-muted-foreground">
                      <MapPin size={16} />
                      {t("public.city")}
                    </span>
                    <Picker
                      presentation="search"
                      sortLabels
                      id={`${id}-city`}
                      value={city}
                      onChange={setCity}
                      values={cities}
                      valueCategory="sentinel"
                      label={t("public.city")}
                    />
                  </label>
                  <button
                    type="submit"
                    className={cn(
                      appButton(),
                      "m-0 min-h-12 self-center justify-center px-[25px] at-most-1000:px-[18px] at-most-720:whitespace-normal",
                    )}
                  >
                    <Search size={18} />
                    {t("public.findWorkshops")}
                  </button>
                </form>
                {!directoryReady && (
                  <p className={errorClassName} role="alert">
                    {publicDataError(t, initialError, "directory")}
                  </p>
                )}
              </section>
            </div>
          </section>
          <DiscoverWorkshops />
          <ReviewInvitation />
          <section
            id="so-gehts"
            className={cn(
              pageFrameClassName,
              "mb-0 grid grid-cols-[0.92fr_1fr] items-center gap-16 rounded-none border-0 bg-white py-[45px] dark:bg-background at-most-1000:gap-9 at-most-720:grid-cols-1 at-most-720:gap-6 at-most-720:py-[30px]",
            )}
            aria-labelledby="trust-title"
          >
            <figure className="relative m-0 h-80 overflow-hidden rounded-[16px] at-most-1000:h-[315px] at-most-720:order-2 at-most-720:h-[195px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- Preoptimized static WebP variants already provide responsive delivery without a runtime optimizer. */}
              <img
                className="block size-full object-cover"
                src="/diagnostics-1024.webp"
                srcSet="/diagnostics-640.webp 640w, /diagnostics-1024.webp 1024w, /diagnostics-1536.webp 1536w"
                sizes="(max-width: 720px) calc(100vw - 32px), (max-width: 1280px) 50vw, 600px"
                width="1536"
                height="1024"
                loading="lazy"
                decoding="async"
                alt={t("public.mechanicAlt")}
              />
            </figure>
            <div className="min-w-0">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-[6px] text-[13px] font-semibold text-[#096e61] dark:text-[var(--theme-accent)]">
                  <ShieldCheck size={16} /> {t("public.verifiedReviews")}
                </span>
                <h2
                  className="mt-3 mb-6 text-[28px] font-[650] leading-[1.2] tracking-[-0.7px] at-most-720:mt-[11px] at-most-720:mb-[22px] at-most-720:text-[26px]"
                  id="trust-title"
                >
                  {t("public.stepsTitle")}
                </h2>
              </div>
              <div className="flex flex-col gap-5 p-0 at-most-720:gap-[18px]">
                <div className="flex items-start gap-[13px]">
                  <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border-0 bg-[#e7f3ef] text-[13px] font-[650] text-[#096e61] dark:bg-accent dark:text-[var(--theme-accent)]">
                    1
                  </span>
                  <div>
                    <h3 className="mb-[3px] text-[15px] font-[650]">
                      {t("public.chooseWorkshop")}
                    </h3>
                    <p className="text-[14px] leading-[1.5] text-muted-foreground">
                      {t("public.compare")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-[13px]">
                  <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border-0 bg-[#e7f3ef] text-[13px] font-[650] text-[#096e61] dark:bg-accent dark:text-[var(--theme-accent)]">
                    2
                  </span>
                  <div>
                    <h3 className="mb-[3px] text-[15px] font-[650]">
                      {t("public.contactDirect")}
                    </h3>
                    <p className="text-[14px] leading-[1.5] text-muted-foreground">
                      {t("public.arrange")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-[13px]">
                  <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] border-0 bg-[#e7f3ef] text-[13px] font-[650] text-[#096e61] dark:bg-accent dark:text-[var(--theme-accent)]">
                    3
                  </span>
                  <div>
                    <h3 className="mb-[3px] text-[15px] font-[650]">
                      {t("public.reviewAfter")}
                    </h3>
                    <p className="text-[14px] leading-[1.5] text-muted-foreground">
                      {t("public.submitReview")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}
      <DirectoryFooter open={info} onOpenChange={setInfo} />
    </>
  );
}
