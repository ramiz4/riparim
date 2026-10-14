"use client";
import { isErrorCode } from "@/lib/i18n/codes";
import { publicDataError } from "@/lib/i18n/public-errors";
import { formatNumber } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/client";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Filter, RefreshCw, Search } from "lucide-react";
import { LoadingIndicator } from "@/components/loading-indicator";
import { SiteHeader } from "@/components/site-header";
import { DirectoryFooter } from "@/components/directory-footer";
import { CatalogueFilterFields } from "@/components/catalogue-filter-fields";
import { WorkshopCard } from "@/components/workshop-card";
import { Picker } from "@/components/picker";
import { cn } from "@/lib/utils";
import {
  appButton,
  errorClassName,
  noteClassName,
  pageFrameClassName,
  emptyStateClassName,
  loadingStateClassName,
} from "@/lib/presentation";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ModalContent } from "@/components/modal-shell";
import {
  activeCatalogueFilters,
  catalogueValues,
  catalogueChoiceLabel,
  type CatalogueChoice,
  catalogueHref,
  defaultCatalogueFilters,
  hasPublishedRatings,
  hasCatalogueDistances,
  catalogueDistance,
  matchCatalogue,
  orderedCatalogue,
  parseCatalogueFilters,
  type CatalogueFilters,
} from "@/lib/catalogue-filters";
import { readSearchSession, rememberSearchSession } from "@/lib/search-session";
import { cities, services, type Workshop } from "@/lib/workshops";
import type { WorkshopDisplayById } from "@/lib/workshop-profile-content";
import type { AccountIdentity } from "@/components/account-storage-notice";

type Props = {
  publicSnapshot?: boolean;
  reviewEntry?: boolean;
  initialDisplayById?: WorkshopDisplayById;
  initialWorkshops: Workshop[];
  initialError: string;
  initialFilters: CatalogueFilters;
  account: AccountIdentity | null;
  isAdmin: boolean;
};
function SortControl({
  id,
  filters,
  onChange,
  ratingAvailable,
  distanceAvailable,
}: {
  id: string;
  filters: CatalogueFilters;
  onChange: (sort: CatalogueFilters["sort"]) => void;
  ratingAvailable: boolean;
  distanceAvailable: boolean;
}) {
  const { t } = useI18n();
  const disabledValues = [
    ...(ratingAvailable ? [] : ["rating"]),
    ...(distanceAvailable ? [] : ["distance"]),
  ];
  return (
    <div className="flex min-w-0 items-center gap-[11px] at-most-1000:block">
      <label
        className="shrink-0 text-[0.875rem] text-[#526c5c] dark:text-muted-foreground at-most-1000:sr-only"
        htmlFor={id}
      >
        {t("public.sort")}
      </label>
      <Picker
        presentation="sort"
        id={id}
        value={filters.sort}
        onChange={(value) => onChange(value as CatalogueFilters["sort"])}
        values={["name", "rating", "distance"]}
        displayLabels={{
          name: t("public.sortName"),
          rating: t("public.sortRiparim"),
          distance: distanceAvailable
            ? t("public.sortDistance")
            : catalogueValues(filters.city).length > 1
              ? t("public.sortSingleCity")
              : filters.city === defaultCatalogueFilters.city
                ? t("public.sortChooseCity")
                : t("public.sortNoLocation"),
        }}
        disabledValues={disabledValues}
        label={t("public.sort")}
      />
    </div>
  );
}

export default function Catalogue({
  publicSnapshot = false,
  reviewEntry = false,
  initialDisplayById = {},
  initialWorkshops,
  initialError,
  initialFilters,
  account,
  isAdmin,
}: Props) {
  const { locale, t } = useI18n();
  const [displayById, setDisplayById] = useState(initialDisplayById);
  const [directory, setDirectory] = useState(initialWorkshops),
    [filters, setFilters] = useState(initialFilters),
    [draft, setDraft] = useState(initialFilters),
    [ready, setReady] = useState(
      !initialError && !(publicSnapshot && initialWorkshops.length === 0),
    ),
    [error, setError] = useState(initialError),
    [refreshing, setRefreshing] = useState(false),
    [visibleCount, setVisibleCount] = useState(12),
    [hydrated, setHydrated] = useState(false),
    [filterOpen, setFilterOpen] = useState(false);
  const nameSearch = useRef<HTMLInputElement>(null),
    filterButton = useRef<HTMLButtonElement>(null),
    resultsHeading = useRef<HTMLParagraphElement>(null),
    restoreScroll = useRef<number | null>(null),
    searchSentinel = useRef<HTMLDivElement>(null),
    sortId = useId();
  const [searchDocked, setSearchDocked] = useState(false);
  const [retainedCards, setRetainedCards] = useState<{
    key: string;
    ids: string[];
  }>({ key: "", ids: [] });
  const resultsGrid = useRef<HTMLDivElement>(null),
    firstNewResult = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (firstNewResult.current === null) return;
    const index = firstNewResult.current;
    firstNewResult.current = null;
    resultsGrid.current
      ?.querySelectorAll<HTMLAnchorElement>(
        "article:not([hidden]) [data-card-focus-target]",
      )
      [index]?.focus();
  }, [visibleCount]);
  const matches = matchCatalogue(directory, filters, locale),
    chips = activeCatalogueFilters(filters),
    ratingAvailable = hasPublishedRatings(directory);
  const mobileFilterCount = chips
    .filter((key) => key !== "query" && key !== "language")
    .reduce((count, key) => count + catalogueValues(filters[key]).length, 0);
  const draftMatches = matchCatalogue(directory, draft, locale);
  const orderedDirectory = orderedCatalogue(directory, filters, locale),
    visibleMatches = matches.slice(0, visibleCount),
    visibleIds = new Set(visibleMatches.map((w) => w.id));
  // Keep already mounted cards connected across filtering; only IDs stay in local view state, never provider content.
  // A changed ordering starts a fresh view so keyboard order always follows the displayed order.
  const retainedKey = `${locale}:${filters.sort}:${filters.sort === "distance" ? filters.city : ""}:${orderedDirectory.map((w) => w.id).join(",")}`;
  if (retainedCards.key !== retainedKey)
    setRetainedCards({ key: retainedKey, ids: [...visibleIds] });
  else if (visibleMatches.some((w) => !retainedCards.ids.includes(w.id)))
    setRetainedCards({
      key: retainedKey,
      ids: [...new Set([...retainedCards.ids, ...visibleIds])],
    });
  const renderedIds = new Set(
    retainedCards.key === retainedKey ? retainedCards.ids : visibleIds,
  );

  const distanceAvailable = hasCatalogueDistances(matches, filters.city);
  useEffect(() => {
    const sentinel = searchSentinel.current;
    if (!sentinel) return;
    let observer: IntersectionObserver | null = null;
    const update = () => {
      observer?.disconnect();
      observer = null;
      if (!window.matchMedia("(max-width: 1000px)").matches)
        setFilterOpen(false);
      if (
        !window.matchMedia("(max-width: 1000px) and (min-height: 601px)")
          .matches
      ) {
        setSearchDocked(false);
        return;
      }
      const headerHeight = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--site-header-height",
        ),
      );
      setSearchDocked(sentinel.getBoundingClientRect().top < headerHeight);
      observer = new IntersectionObserver(
        ([entry]) =>
          setSearchDocked(
            !entry.isIntersecting &&
              entry.boundingClientRect.top < headerHeight,
          ),
        {
          root: document,
          rootMargin: `-${headerHeight}px 0px 0px 0px`,
          threshold: 0,
        },
      );
      observer.observe(sentinel);
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/workshops?locale=${locale}`),
        data = (await response.json()) as {
          workshops: Workshop[];
          displayById?: WorkshopDisplayById;
          errorCode?: string;
        };
      if (!response.ok) {
        setError(isErrorCode(data.errorCode) ? data.errorCode : "unknown");
        return;
      }
      const records = data.workshops.filter((w) => w.status === "published");
      setDirectory(records);
      setDisplayById(data.displayById ?? {});
      setFilters(
        parseCatalogueFilters(
          new URLSearchParams(window.location.search),
          records,
        ),
      );
      setReady(true);
    } catch {
      setError("unavailable");
    } finally {
      setRefreshing(false);
    }
  }, [locale]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Refresh the released snapshot against the live external directory after hydration.
    if (publicSnapshot) void refresh();
  }, [publicSnapshot, refresh]);
  useEffect(() => {
    const saved = readSearchSession();
    const actualFilters = publicSnapshot
      ? parseCatalogueFilters(
          new URLSearchParams(window.location.search),
          initialWorkshops,
        )
      : initialFilters;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Paging and scroll are restored after hydration, never from server props.
    setFilters(actualFilters);
    setVisibleCount(12);
    if (saved && saved.catalogueHref === catalogueHref(actualFilters, locale)) {
      setVisibleCount(Math.max(12, saved.visibleCount));
      restoreScroll.current = saved.scrollY;
    }
    setHydrated(true);
  }, [initialFilters, initialWorkshops, publicSnapshot, locale]);
  useEffect(() => {
    if (!hydrated) return;
    const persist = () =>
      rememberSearchSession({
        catalogueHref: catalogueHref(filters, locale),
        visibleCount,
        scrollY: window.scrollY,
      });
    persist();
    window.addEventListener("scroll", persist, { passive: true });
    return () => window.removeEventListener("scroll", persist);
  }, [hydrated, filters, visibleCount, locale]);
  useEffect(() => {
    if (!hydrated || restoreScroll.current === null) return;
    const y = restoreScroll.current;
    restoreScroll.current = null;
    const frame = requestAnimationFrame(() =>
      window.scrollTo({ top: y, behavior: "auto" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [hydrated, visibleCount]);
  useEffect(() => {
    if (!hydrated) return;
    const sync = () => {
      const next = parseCatalogueFilters(
        new URLSearchParams(window.location.search),
        directory,
      );
      setFilters(next);
      setVisibleCount(12);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [hydrated, directory]);
  useEffect(() => {
    if (hydrated && ready) {
      const href = catalogueHref(filters, locale);
      window.history.replaceState(
        window.history.state,
        "",
        reviewEntry
          ? `${href}${href.includes("?") ? "&" : "?"}bewerten=1`
          : href,
      );
    }
  }, [hydrated, ready, filters, locale, reviewEntry]);
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
            if (!ready) throw Error(t("public.directoryUnavailable"));
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
            const next = {
              ...defaultCatalogueFilters,
              service: value.service,
              city: value.city,
            };
            setFilters(next);
            setVisibleCount(12);
            window.history.replaceState(
              window.history.state,
              "",
              catalogueHref(next, locale),
            );
            return {
              workshops: matchCatalogue(directory, next).map((w) => ({
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
  }, [directory, ready, locale, t]);
  function commit(next: CatalogueFilters) {
    const value =
      next.sort === "distance" && !hasCatalogueDistances(directory, next.city)
        ? { ...next, sort: "name" as const }
        : next;
    setFilters(value);
    setVisibleCount(12);
    window.history.replaceState(
      window.history.state,
      "",
      catalogueHref(value, locale),
    );
  }
  function change(
    field: "query" | "service" | "city" | "brand" | "language",
    value: CatalogueChoice,
  ) {
    if ((field === "query" || field === "language") && Array.isArray(value))
      return;
    commit({ ...filters, [field]: value });
  }
  function reset() {
    commit({ ...defaultCatalogueFilters, sort: filters.sort });
  }
  function showMore() {
    firstNewResult.current = visibleCount;
    setVisibleCount((count) => count + 12);
  }
  function applyDraft() {
    commit(draft);
    setFilterOpen(false);
    requestAnimationFrame(() => {
      filterButton.current?.focus({ preventScroll: true });
      resultsHeading.current?.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
    });
  }

  return (
    <>
      <SiteHeader
        account={account}
        isAdmin={isAdmin}
        publicSnapshot={publicSnapshot}
      />
      <main
        className={cn(
          pageFrameClassName,
          "pt-[34px] pb-[52px] text-[1rem] at-most-1000:pt-3 at-most-1000:pb-[34px]",
        )}
        data-riparim-page="catalogue"
      >
        {(reviewEntry ||
          (publicSnapshot &&
            hydrated &&
            new URLSearchParams(window.location.search).get("bewerten") ===
              "1")) && (
          <p className={noteClassName} role="status">
            {t("public.reviewEntryHelp")}
          </p>
        )}
        <header className="mb-7 flex items-center justify-between gap-6 at-most-1000:mb-2 at-most-1000:flex-row at-most-1000:items-start at-most-1000:justify-start at-most-1000:gap-0">
          <div>
            <h1 className="m-0 text-[2.25rem] font-[650] leading-[1.2] tracking-[-0.8px] at-most-1000:sr-only">
              {t("public.workshops")}
            </h1>
          </div>
        </header>
        <div
          className="pointer-events-none -mb-px h-px"
          ref={searchSentinel}
          aria-hidden="true"
        />
        <div className="contents at-least-1001:grid at-least-1001:grid-cols-[260px_minmax(0,1fr)] at-least-1001:items-start at-least-1001:gap-[30px]">
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <section
              className="mb-0 grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-0 bg-transparent px-0 py-2 shadow-none sticky top-[var(--site-header-height)] z-20 at-least-1001:m-0 at-least-1001:flex at-least-1001:max-h-[calc(100dvh_-_var(--site-header-height)_-_40px)] at-least-1001:flex-col at-least-1001:gap-5 at-least-1001:overflow-y-auto at-least-1001:rounded-xl at-least-1001:border at-least-1001:border-[#d8e3df] at-least-1001:bg-[#f6f9f7] at-least-1001:p-5 at-least-1001:top-[calc(var(--site-header-height)_+_20px)] dark:at-least-1001:border-border dark:at-least-1001:bg-[var(--theme-surface)] [@media(max-width:1000px)_and_(max-height:600px)]:static at-most-1000:data-[docked=true]:px-[var(--page-gutter)] at-most-1000:data-[docked=true]:bg-background [@media(max-width:1000px)_and_(min-height:601px)]:data-[docked=true]:rounded-tl-none [@media(max-width:1000px)_and_(min-height:601px)]:data-[docked=true]:rounded-tr-none [@media(max-width:1000px)_and_(min-height:601px)]:data-[docked=true]:w-[calc(100%_+_2_*_var(--page-gutter))] [@media(max-width:1000px)_and_(min-height:601px)]:data-[docked=true]:mx-[calc(-1_*_var(--page-gutter))]"
              data-ui="catalogue-search-panel"
              data-docked={searchDocked}
              aria-label={t("public.searchWorkshops")}
            >
              <div
                className="min-w-0 at-most-1000:col-start-1 at-most-1000:row-start-1"
                data-ui="catalogue-name-search"
              >
                <label
                  className="mb-2 block text-[1rem] font-[550] text-[#315249] dark:text-foreground at-most-1000:sr-only"
                  htmlFor={`${sortId}-name`}
                >
                  {t("public.workshopName")}
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-[13px] [transform:translateY(-50%)] text-[#567261] dark:text-muted-foreground at-most-1000:left-[11px]"
                    size={18}
                    aria-hidden="true"
                  />
                  <Input
                    ref={nameSearch}
                    className="h-auto min-h-12 rounded-lg border border-[#c8d8d2] bg-white pt-3 pr-3 pb-3 pl-10 text-[1rem] md:text-[1rem] leading-[1.5] text-[#284c40] shadow-none focus-visible:border-[#c8d8d2] focus-visible:ring-0 dark:focus-visible:border-input dark:border-input dark:bg-card dark:text-foreground at-most-1000:min-h-11 at-most-1000:pt-[9px] at-most-1000:pr-[9px] at-most-1000:pb-[9px] at-most-1000:pl-9 at-most-1000:leading-[1.35]"
                    id={`${sortId}-name`}
                    type="search"
                    maxLength={100}
                    autoComplete="off"
                    placeholder={t("public.searchPlaceholder")}
                    value={filters.query}
                    onChange={(event) => change("query", event.target.value)}
                  />
                </div>
              </div>
              <CatalogueFilterFields
                presentation="sidebar"
                filters={filters}
                onChange={change}
                directory={directory}
                fields={["city", "service", "brand"]}
              />
              <DialogTrigger asChild>
                <button
                  className={cn(
                    appButton({ variant: "outline" }),
                    "min-h-11 self-center justify-self-start px-3 py-[9px] text-[0.875rem] at-least-1001:hidden at-most-1000:col-start-2 at-most-1000:row-start-1 at-most-1000:self-stretch at-most-1000:gap-[6px] at-most-1000:px-[10px] at-most-1000:whitespace-nowrap",
                  )}
                  data-ui="catalogue-filter-button"
                  ref={filterButton}
                  aria-label={
                    mobileFilterCount > 0
                      ? t("public.activeFilterCount", {
                          count: mobileFilterCount,
                        })
                      : t("public.filter")
                  }
                  onClick={() => setDraft({ ...filters })}
                >
                  <Filter size={18} aria-hidden="true" />
                  <span className="inline min-h-0 min-w-0 bg-transparent p-0 at-most-1000:hidden">
                    {t("public.moreFilters")}
                  </span>
                  <span className="hidden min-h-0 min-w-0 bg-transparent p-0 at-most-1000:inline">
                    {t("public.filter")}
                  </span>
                  {mobileFilterCount > 0 && (
                    <span className="inline-grid h-5 min-w-5 place-items-center rounded-[5px] bg-[#e6f1e9] px-1 text-[0.875rem] dark:bg-[#225445] dark:text-[#b6efcf] at-most-1000:grid at-most-1000:min-h-5 at-most-1000:px-[5px] at-most-1000:py-px">
                      {formatNumber(locale, mobileFilterCount)}
                    </span>
                  )}
                </button>
              </DialogTrigger>
              <button
                className="min-h-11 self-start p-0 text-left text-[0.875rem] text-[#4d6958] underline underline-offset-[3px] whitespace-normal dark:text-[var(--theme-accent)] at-most-1000:hidden"
                onClick={reset}
              >
                {t("public.resetAll")}
              </button>
            </section>
            <ModalContent
              onCloseAutoFocus={(event) => {
                if (!window.matchMedia("(max-width: 1000px)").matches) {
                  event.preventDefault();
                  nameSearch.current?.focus({ preventScroll: true });
                }
              }}
              className="max-w-[min(540px,calc(100%_-_32px))] sm:max-w-[min(540px,calc(100%_-_32px))] [&>[data-slot=dialog-footer]]:grid [&>[data-slot=dialog-footer]]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] at-most-1000:top-0 at-most-1000:left-0 at-most-1000:h-dvh at-most-1000:max-h-dvh at-most-720:max-h-dvh at-most-720:rounded-none at-most-1000:w-[min(90vw,400px)] at-most-1000:max-w-none at-most-1000:[translate:none] at-most-1000:[transform:none] at-most-1000:rounded-none at-most-1000:[border-width:0_1px_0_0] at-most-1000:data-[state=open]:[animation:catalogue-drawer-in_0.2s_ease-out] at-most-1000:data-[state=closed]:[animation:catalogue-drawer-out_0.15s_ease-in] at-most-1000:[&>[data-slot=dialog-header]]:pt-[max(24px,env(safe-area-inset-top))] at-most-1000:[&_[data-slot=dialog-title]]:text-[22px] at-most-1000:[&_[data-slot=dialog-description]]:text-[14px] at-most-1000:[&>[data-slot=dialog-body]]:px-[18px] [@media(max-width:1000px)_and_(min-height:521px)]:[&>[data-slot=dialog-body]]:py-[18px] at-most-1000:[&>[data-slot=dialog-footer]]:gap-[9px] at-most-1000:[&>[data-slot=dialog-footer]]:px-4 at-most-1000:[&>[data-slot=dialog-footer]]:pt-[13px] at-most-1000:[&>[data-slot=dialog-footer]]:pb-[max(16px,env(safe-area-inset-bottom))] [@media(max-height:520px)]:[&>[data-slot=dialog-header]]:pb-3 [@media(max-height:520px)_and_(min-width:1001px)]:[&>[data-slot=dialog-header]]:pt-3 [@media(max-height:520px)]:[&>[data-slot=dialog-body]]:py-[14px] [@media(max-width:1000px)_and_(max-height:520px)]:[&>[data-slot=dialog-footer]]:pt-[9px] [@media(max-height:520px)_and_(min-width:1001px)]:[&>[data-slot=dialog-footer]]:py-[9px] motion-reduce:animate-none"
              data-ui="catalogue-filter-dialog"
              title={t("public.filter")}
              description={t("public.drawerFilterHelp")}
              footer={
                <>
                  <button
                    className={cn(
                      appButton({ variant: "outline" }),
                      "min-h-12 px-[14px] py-[10px] text-[1rem] leading-[1.5] whitespace-normal [overflow-wrap:anywhere] at-most-1000:px-[10px] at-most-720:min-h-[45px] at-most-720:px-[13px] at-most-720:text-[13px] [@media(max-height:520px)]:py-2 [@media(max-height:520px)_and_(min-width:721px)]:min-h-11",
                    )}
                    onClick={() =>
                      setDraft((old) => ({
                        ...old,
                        city: defaultCatalogueFilters.city,
                        service: defaultCatalogueFilters.service,
                        brand: defaultCatalogueFilters.brand,
                        language: defaultCatalogueFilters.language,
                      }))
                    }
                  >
                    {t("public.reset")}
                  </button>
                  <button
                    className={cn(
                      appButton(),
                      "min-h-12 px-[14px] py-[10px] text-[1rem] leading-[1.5] whitespace-normal [overflow-wrap:anywhere] at-most-1000:px-[10px] at-most-720:min-h-[45px] at-most-720:text-[13px] [@media(max-height:520px)]:py-2 [@media(max-height:520px)_and_(min-width:721px)]:min-h-11",
                    )}
                    onClick={applyDraft}
                  >
                    {t("public.showResults")}
                    {ready
                      ? ` (${formatNumber(locale, draftMatches.length)})`
                      : ""}
                  </button>
                </>
              }
            >
              <CatalogueFilterFields
                presentation="dialog"
                filters={draft}
                onChange={(field, value) =>
                  setDraft((old) => ({ ...old, [field]: value }))
                }
                directory={directory}
                fields={["city", "service", "brand"]}
              />
              {ready && draftMatches.length === 0 && (
                <p className="rounded-[7px] bg-[#f3f7f3] p-[13px] text-[0.875rem] leading-[1.65] text-[#566c71] dark:text-muted-foreground">
                  {t("public.draftEmpty")}
                </p>
              )}
            </ModalContent>
          </Dialog>
          <div className="contents at-least-1001:block at-least-1001:min-w-0">
            {!ready ? (
              error ? (
                <div
                  className="max-w-[640px] py-7"
                  data-ui="catalogue-load-error"
                  role="alert"
                >
                  <h2 className="text-[1.375rem] leading-[1.4]">
                    {publicDataError(t, error, "directory")}
                  </h2>
                  <p className="mt-[13px] mb-5 text-[1rem] text-[#647064] dark:text-muted-foreground">
                    {t("public.retryHelp")}
                  </p>
                  <button
                    className={cn(appButton(), "min-h-12 text-[1rem]")}
                    disabled={refreshing}
                    onClick={() => void refresh()}
                  >
                    <RefreshCw size={16} />
                    {refreshing ? t("public.loading") : t("public.reload")}
                  </button>
                </div>
              ) : (
                <LoadingIndicator
                  className={loadingStateClassName}
                  label={t("public.loadingWorkshops")}
                />
              )
            ) : (
              <>
                <div
                  className="sticky top-[calc(var(--site-header-height)_+_12px)] z-[19] mb-[6px] flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b-0 bg-background pt-0 pb-3 before:absolute before:inset-x-0 before:top-[-12px] before:h-3 before:bg-background before:content-[''] at-most-1000:grid at-most-1000:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] at-most-1000:max-h-[calc(100dvh_-_32px)] at-most-1000:before:hidden [@media(max-width:1000px)_and_(min-height:601px)]:top-[calc(var(--site-header-height)_+_60px)] [@media(max-width:1000px)_and_(max-height:600px)]:static"
                  data-ui="catalogue-results-toolbar"
                >
                  <p
                    className="m-0 scroll-mt-[calc(var(--site-header-height)_+_20px)] text-[1.375rem] font-[650] leading-[1.45] text-[#234f3a] dark:text-foreground at-most-1000:min-w-0 at-most-1000:text-[1.125rem] at-most-1000:scroll-mt-[calc(var(--site-header-height)_+_100px)]"
                    data-ui="catalogue-result-count"
                    ref={resultsHeading}
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {t("public.workshopCount", { count: matches.length })}
                  </p>
                  <div className="ml-auto min-w-0 justify-self-end at-most-1000:ml-0 at-most-1000:w-full">
                    <SortControl
                      id={`${sortId}-results-sort`}
                      filters={filters}
                      onChange={(sort) => commit({ ...filters, sort })}
                      ratingAvailable={ratingAvailable}
                      distanceAvailable={distanceAvailable}
                    />
                  </div>
                  {refreshing && (
                    <LoadingIndicator
                      className="inline-flex items-center gap-[6px] text-[0.875rem] text-[#60766a] dark:text-muted-foreground at-most-1000:col-span-full"
                      label={t("public.updating")}
                    />
                  )}
                </div>
                {filters.sort === "distance" && (
                  <p className="mt-0 mb-[18px] ml-auto max-w-[640px] text-right text-[0.8125rem] leading-[1.6] text-[#576f60] dark:text-muted-foreground at-least-1001:max-w-none at-least-1001:text-left at-most-1000:ml-0 at-most-1000:text-left">
                    {t("public.distanceNote", {
                      city: catalogueChoiceLabel(filters.city),
                    })}
                  </p>
                )}
                {error && (
                  <div
                    className={cn(
                      errorClassName,
                      "mb-5 flex flex-wrap items-center justify-between gap-[14px]",
                    )}
                    role="alert"
                  >
                    {t("public.refreshFailed")}
                    <button
                      className="min-h-11 underline"
                      disabled={refreshing}
                      onClick={() => void refresh()}
                    >
                      {t("public.reload")}
                    </button>
                  </div>
                )}
                {directory.length === 0 ? (
                  <div
                    className={cn(
                      emptyStateClassName,
                      "mt-[6px] border-solid at-most-1000:px-[18px] at-most-1000:py-7 at-most-1000:[&_h2]:text-[1.25rem] at-most-1000:[&>div]:flex-col [&_h2]:mx-auto [&_h2]:max-w-[580px] [&_h2]:text-[1.375rem] [&_h2]:font-semibold [&_h2]:leading-[1.5] [&_h2]:text-[#2f583d] dark:[&_h2]:text-foreground [&_p]:mx-auto [&_p]:mt-[10px] [&_p]:mb-5 [&_p]:max-w-[460px] [&_p]:text-[1rem] [&_p]:leading-[1.65] [&_p]:text-muted-foreground [&>div]:flex [&>div]:flex-wrap [&>div]:justify-center [&>div]:gap-3",
                    )}
                  >
                    <Search size={27} />
                    <h2>{t("public.directoryEmpty")}</h2>
                    <p>{t("public.directoryEmptyHelp")}</p>
                  </div>
                ) : (
                  <>
                    {matches.length === 0 && (
                      <div
                        className={cn(
                          emptyStateClassName,
                          "mt-[6px] border-solid at-most-1000:px-[18px] at-most-1000:py-7 at-most-1000:[&_h2]:text-[1.25rem] at-most-1000:[&>div]:flex-col [&_h2]:mx-auto [&_h2]:max-w-[580px] [&_h2]:text-[1.375rem] [&_h2]:font-semibold [&_h2]:leading-[1.5] [&_h2]:text-[#2f583d] dark:[&_h2]:text-foreground [&_p]:mx-auto [&_p]:mt-[10px] [&_p]:mb-5 [&_p]:max-w-[460px] [&_p]:text-[1rem] [&_p]:leading-[1.65] [&_p]:text-muted-foreground [&>div]:flex [&>div]:flex-wrap [&>div]:justify-center [&>div]:gap-3",
                        )}
                      >
                        <Search size={27} />
                        <h2>
                          {filters.query
                            ? t("public.noNameMatch")
                            : t("public.noMatch")}
                        </h2>
                        <p>
                          {filters.language !== defaultCatalogueFilters.language
                            ? t("public.noLanguageMatch")
                            : t("public.changeFilter")}
                        </p>
                        <div>
                          {filters.language !==
                            defaultCatalogueFilters.language && (
                            <button
                              className={cn(
                                appButton(),
                                "min-h-12 text-[1rem] whitespace-normal",
                              )}
                              onClick={() =>
                                change(
                                  "language",
                                  defaultCatalogueFilters.language,
                                )
                              }
                            >
                              {t("public.removeLanguage")}
                            </button>
                          )}
                          <button
                            className={cn(
                              appButton({ variant: "outline" }),
                              "min-h-12 text-[1rem] whitespace-normal",
                            )}
                            onClick={reset}
                          >
                            {t("public.resetAll")}
                          </button>
                        </div>
                      </div>
                    )}
                    <div
                      key="results"
                      className="grid grid-cols-[minmax(0,1fr)] gap-4 [&[hidden]]:hidden at-most-1000:gap-3"
                      data-ui="catalogue-grid"
                      ref={resultsGrid}
                      hidden={matches.length === 0}
                    >
                      {orderedDirectory
                        .filter((workshop) => renderedIds.has(workshop.id))
                        .map((workshop) => (
                          <WorkshopCard
                            layout="catalogue"
                            hidden={!visibleIds.has(workshop.id)}
                            display={displayById[workshop.id]}
                            key={`${retainedKey}:${workshop.id}`}
                            workshop={workshop}
                            selectedBrand={filters.brand}
                            selectedService={filters.service}
                            searchHref={catalogueHref(filters, locale)}
                            distanceKm={catalogueDistance(
                              workshop,
                              filters.city,
                            )}
                            distanceOrigin={catalogueChoiceLabel(filters.city)}
                          />
                        ))}
                    </div>
                    {matches.length > 0 && (
                      <div
                        className="flex flex-col items-center gap-[14px] pt-[25px] text-center [&>p]:text-[0.875rem] [&>p]:text-[#5e7361] dark:[&>p]:text-muted-foreground"
                        data-ui="catalogue-pagination"
                      >
                        <p>
                          {t("public.shownCount", {
                            shown: Math.min(visibleCount, matches.length),
                            total: matches.length,
                          })}
                        </p>
                        {visibleCount < matches.length && (
                          <button
                            className={cn(
                              appButton({ variant: "outline" }),
                              "min-h-12 px-[22px] py-3 text-[1rem] whitespace-normal",
                            )}
                            onClick={showMore}
                          >
                            {t("public.showMore")}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <DirectoryFooter />
    </>
  );
}
