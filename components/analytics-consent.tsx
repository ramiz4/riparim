"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  createAnalyticsController,
  publicAnalyticsPage,
  type AnalyticsConfig,
} from "@/lib/analytics";
import { analyticsMessages } from "@/lib/i18n/analytics-messages";
import { useI18n } from "@/lib/i18n/client";
import { appButton } from "@/lib/presentation";
import { cn } from "@/lib/utils";
import { LocaleAnchor } from "./locale-anchor";

type Controller = ReturnType<typeof createAnalyticsController>;
const Context = createContext<Controller | null>(null);
const noSubscribe = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;
const unknownConsent = () => "unknown" as const;
const emptyStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
function browserStorage(name: "localStorage" | "sessionStorage") {
  try {
    return window[name];
  } catch {
    return emptyStorage;
  }
}
function useConsent(controller: Controller | null) {
  return useSyncExternalStore(
    controller?.subscribe ?? noSubscribe,
    controller?.getConsent ?? unknownConsent,
    unknownConsent,
  );
}
export function AnalyticsConsent({
  config,
  children,
}: {
  config: AnalyticsConfig;
  children: ReactNode;
}) {
  const { locale } = useI18n(),
    pathname = usePathname();
  const mounted = useSyncExternalStore(
    noSubscribe,
    clientMounted,
    serverMounted,
  );
  // Runtime analytics configuration is immutable within a published release.
  const [controller] = useState(() =>
    createAnalyticsController({
      config: { key: config.key, host: config.host, testMode: config.testMode },
      href: () => window.location.href,
      storage: browserStorage("localStorage"),
      sessionStorage: browserStorage("sessionStorage"),
      load: () => import("@/lib/analytics-provider"),
    }),
  );
  const [publicPage, setPublicPage] = useState(false);
  const consent = useConsent(controller),
    text = analyticsMessages[locale];
  useEffect(() => {
    if (!mounted) return;
    function currentPage() {
      const main = document.querySelector<HTMLElement>(
          "main[data-riparim-page]",
        ),
        page = publicAnalyticsPage(
          window.location.href,
          main?.dataset.analyticsWorkshopId,
        ),
        ready =
          page &&
          main?.dataset.riparimPage ===
            (
              {
                home: "home",
                search: "catalogue",
                city: "city",
                guide: "guide",
                profile: "workshop",
                privacy: "privacy",
              } as const
            )[page.type];
      setPublicPage(!!ready);
      return ready ? page : null;
    }
    function scan() {
      controller.navigate(currentPage());
    }
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-riparim-page", "data-analytics-workshop-id"],
    });
    scan();
    const sync = () => {
      controller.syncConsent();
      scan();
    };
    const leave = () => controller.leave();
    const resume = (event: PageTransitionEvent) => {
      if (event.persisted) controller.resume(currentPage());
    };
    window.addEventListener("popstate", scan);
    window.addEventListener("hashchange", scan);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", resume);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", scan);
      window.removeEventListener("hashchange", scan);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", resume);
    };
  }, [controller, mounted, pathname, locale]);
  return (
    <Context.Provider value={mounted ? controller : null}>
      {children}
      {mounted &&
        controller.available() &&
        publicPage &&
        consent === "unknown" && (
          <aside
            className="fixed inset-x-4 bottom-[calc(16px_+_env(safe-area-inset-bottom))] z-50 mx-auto max-h-[65svh] max-w-[680px] overflow-y-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl at-most-720:p-4"
            aria-labelledby="analytics-consent-title"
            data-ui="analytics-consent"
          >
            <h2
              className="text-[18px] leading-[1.4] font-semibold"
              id="analytics-consent-title"
            >
              {text.title}
            </h2>
            <p className="mt-2 text-[14px] leading-[1.65] text-muted-foreground">
              {text.description}{" "}
              <LocaleAnchor
                className="underline underline-offset-3"
                href="/datenschutz#privacy-analytics"
              >
                {text.privacy}
              </LocaleAnchor>
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                onClick={() => controller.setConsent("declined")}
              >
                {text.decline}
              </button>
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                onClick={() => controller.setConsent("accepted")}
              >
                {text.accept}
              </button>
            </div>
          </aside>
        )}
    </Context.Provider>
  );
}
export function AnalyticsSettings() {
  const controller = useContext(Context),
    consent = useConsent(controller),
    { locale } = useI18n(),
    text = analyticsMessages[locale];
  return (
    <section
      className="mt-7 min-w-0 border-t border-border pt-7 [overflow-wrap:anywhere]"
      aria-labelledby="analytics-settings-title"
      id="analytics-settings"
      data-ui="analytics-settings"
    >
      <h2
        className="mb-3 text-[22px] leading-[1.3] font-[650]"
        id="analytics-settings-title"
      >
        {text.title}
      </h2>
      <p className="text-[14px] leading-[1.65] text-muted-foreground">
        {text.description}
      </p>
      <p className="mt-3 text-[14px] leading-[1.65] text-muted-foreground">
        {text.settings}
      </p>
      <p className="mt-3 text-[14px] font-medium" role="status">
        {!controller?.available()
          ? text.unavailable
          : consent === "accepted"
            ? text.accepted
            : text.declined}
      </p>
      {controller?.available() && (
        <div className="mt-4 flex flex-wrap gap-3">
          {consent === "accepted" ? (
            <button
              type="button"
              className={appButton({ variant: "outline" })}
              onClick={() => controller.setConsent("declined")}
            >
              {text.revoke}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                onClick={() => controller.setConsent("declined")}
              >
                {text.decline}
              </button>
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                onClick={() => controller.setConsent("accepted")}
              >
                {text.accept}
              </button>
            </>
          )}
        </div>
      )}
      <LocaleAnchor
        className={cn(
          "mt-3 inline-flex min-h-11 items-center text-[14px] underline underline-offset-3",
        )}
        href="/datenschutz#privacy-analytics"
      >
        {text.privacy}
      </LocaleAnchor>
    </section>
  );
}
export function useWorkshopContactAnalytics(workshopId: string) {
  const controller = useContext(Context);
  return (channel: Parameters<Controller["contact"]>[1]) =>
    controller?.contact(workshopId, channel);
}
