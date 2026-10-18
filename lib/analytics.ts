import {
  localizeHref,
  localeFromPath,
  pageIdentityPath,
  type Locale,
} from "./i18n/locale";

export type AnalyticsPage = {
  path: string;
  locale: Locale;
  type: "home" | "search" | "profile" | "privacy";
  workshopId?: string;
};
export type AnalyticsConsent = "unknown" | "accepted" | "declined";
export type ContactChannel = "phone" | "whatsapp" | "directions" | "email";
export type AnalyticsConfig = { key: string; host: string; testMode: boolean };
export type AnalyticsEvent = {
  timestamp: string;
  event:
    | "$pageview"
    | "$pageleave"
    | "workshop_search_viewed"
    | "workshop_profile_viewed"
    | "workshop_contact_clicked";
  properties: Record<string, string | number | boolean>;
};
export type AnalyticsTransport = {
  send: (
    config: AnalyticsConfig,
    event: AnalyticsEvent,
    signal: AbortSignal,
  ) => Promise<void>;
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export const analyticsStorageKeys = {
  consent: "riparim.analytics.consent.v1",
  browser: "riparim.analytics.browser.v1",
  session: "riparim.analytics.session.v1",
  verification: "riparim.analytics.verification",
} as const;
const consentLifetime = 180 * 24 * 60 * 60 * 1000;
const sessionLifetime = 30 * 60 * 1000;
const maxSessionLifetime = 24 * 60 * 60 * 1000;
const safeId = /^[a-z0-9][a-z0-9-]{2,80}$/;
const anonymousId = /^riparim_[a-f0-9-]{36}$/;
const sessionId =
  /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function sessionStartedAt(id: string): number {
  return sessionId.test(id)
    ? Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16)
    : Number.NaN;
}
function newSessionId(time: number, randomUuid: string): string {
  const timestamp = Math.floor(time).toString(16).padStart(12, "0"),
    random = randomUuid.replaceAll("-", "").slice(-19);
  // UUIDv7 stores the Unix millisecond timestamp, version and RFC9562 variant.
  const variant = ((Number.parseInt(random[3], 16) & 3) | 8).toString(16);
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8)}-7${random.slice(0, 3)}-${variant}${random.slice(4, 7)}-${random.slice(7)}`;
}
function validSession(
  visit: { id: string; lastActivity: number },
  time: number,
): boolean {
  const startedAt = sessionStartedAt(visit.id);
  return (
    Number.isFinite(visit.lastActivity) &&
    startedAt <= visit.lastActivity &&
    visit.lastActivity <= time &&
    time - startedAt < maxSessionLifetime &&
    time - visit.lastActivity < sessionLifetime
  );
}

// Only published page identities cross this boundary; URL values never become properties.
export function publicAnalyticsPage(
  href: string,
  publishedWorkshopId?: string,
): AnalyticsPage | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    return null;
  const identity = pageIdentityPath(url.pathname),
    locale = localeFromPath(url.pathname);
  if (
    ["besuche", "einreichung", "nachweis", "bewerten"].some((key) =>
      url.searchParams.has(key),
    ) ||
    url.hash === "#bewerten"
  )
    return null;
  const type =
    identity === "/"
      ? "home"
      : identity === "/workshops"
        ? "search"
        : identity === "/privacy"
          ? "privacy"
          : null;
  if (type) return { path: localizeHref(identity, locale), locale, type };
  if (
    publishedWorkshopId &&
    safeId.test(publishedWorkshopId) &&
    identity === `/workshop/${publishedWorkshopId}`
  )
    return {
      path: localizeHref(identity, locale),
      locale,
      type: "profile",
      workshopId: publishedWorkshopId,
    };
  return null;
}
export function analyticsEnabled(
  config: AnalyticsConfig,
  href: string,
): boolean {
  if (
    !/^phc_[A-Za-z0-9_-]{10,160}$/.test(config.key) ||
    config.host !== "https://eu.i.posthog.com"
  )
    return false;
  try {
    const url = new URL(href);
    return (
      config.testMode ||
      (url.protocol === "https:" &&
        ["riparim.com", "www.riparim.com"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}
function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}
function write(storage: Storage, key: string, value: string | null) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    /* Browser storage can be unavailable; consent remains in memory. */
  }
}
export function createAnalyticsController(options: {
  config: AnalyticsConfig;
  href: () => string;
  storage: Storage;
  sessionStorage: Storage;
  load: () => Promise<AnalyticsTransport>;
  now?: () => number;
  uuid?: () => string;
}) {
  const now = options.now ?? Date.now,
    uuid = options.uuid ?? (() => crypto.randomUUID());
  const listeners = new Set<() => void>();
  let lastStored = read(options.storage, analyticsStorageKeys.consent);
  let consentExpiresAt = 0;
  function storedConsent(): AnalyticsConsent {
    try {
      const choice = JSON.parse(lastStored ?? "null");
      consentExpiresAt =
        choice &&
        typeof choice.expiresAt === "number" &&
        Number.isFinite(choice.expiresAt)
          ? choice.expiresAt
          : 0;
      return choice &&
        ["accepted", "declined"].includes(choice.value) &&
        consentExpiresAt > now()
        ? choice.value
        : "unknown";
    } catch {
      return "unknown";
    }
  }
  let consent = storedConsent(),
    page: AnalyticsPage | null = null,
    capturedPath: string | null = null;
  let browserId: string | null = null,
    visit: { id: string; lastActivity: number } | null = null;
  let transport: Promise<AnalyticsTransport> | null = null,
    epoch = 0,
    abort = new AbortController();
  let pageviewId = "",
    pageSessionId = "",
    enteredAt = 0,
    left = true;
  const available = () => analyticsEnabled(options.config, options.href());
  function clearIdentity() {
    browserId = null;
    visit = null;
    write(options.storage, analyticsStorageKeys.browser, null);
    write(options.sessionStorage, analyticsStorageKeys.session, null);
  }
  if (consent !== "accepted") clearIdentity();
  function identity() {
    if (!browserId) {
      const stored = read(options.storage, analyticsStorageKeys.browser);
      browserId =
        stored && anonymousId.test(stored) ? stored : `riparim_${uuid()}`;
      write(options.storage, analyticsStorageKeys.browser, browserId);
    }
    if (!visit) {
      try {
        const stored = JSON.parse(
          read(options.sessionStorage, analyticsStorageKeys.session) ?? "null",
        );
        if (
          stored &&
          typeof stored.id === "string" &&
          validSession(stored, now())
        )
          visit = stored;
      } catch {
        /* A malformed session starts a new visit. */
      }
    }
    if (!visit || !validSession(visit, now()))
      visit = { id: newSessionId(now(), uuid()), lastActivity: now() };
    visit.lastActivity = now();
    write(
      options.sessionStorage,
      analyticsStorageKeys.session,
      JSON.stringify(visit),
    );
    return { distinct_id: browserId, $session_id: visit.id };
  }
  function emit(
    event: AnalyticsEvent["event"],
    target: AnalyticsPage,
    extras: Record<string, string | number | boolean> = {},
  ) {
    if (consent !== "accepted" || !available()) return;
    try {
      const properties = {
        ...identity(),
        $process_person_profile: false,
        $geoip_disable: true,
        $current_url: `https://riparim.com${target.path}`,
        $pathname: target.path,
        $host: "riparim.com",
        page_path: target.path,
        page_type: target.type,
        locale: target.locale,
        is_verification:
          options.config.testMode ||
          read(options.sessionStorage, analyticsStorageKeys.verification) ===
            "true",
        ...(target.workshopId ? { workshop_id: target.workshopId } : {}),
        ...extras,
      };
      const expected = epoch,
        signal = abort.signal,
        timestamp = new Date(now()).toISOString();
      transport ??= options.load();
      void transport
        .then((provider) => {
          if (epoch === expected && consent === "accepted" && !signal.aborted)
            return provider.send(
              options.config,
              { event, properties, timestamp },
              signal,
            );
        })
        .catch(() => {
          transport = null;
        });
    } catch {
      /* Analytics must never interrupt the public journey. */
    }
  }
  function leave() {
    syncConsent();
    if (!page || left || !capturedPath) return;
    left = true;
    // A suspended page can outlive its original session. Do not attach an invalid
    // late exit to that expired session or create a new visit solely for an exit.
    const sessionAge = now() - sessionStartedAt(pageSessionId);
    if (!(sessionAge >= 0 && sessionAge < maxSessionLifetime)) return;
    const duration = Math.max(
      0,
      Math.min((now() - enteredAt) / 1000, 24 * 60 * 60),
    );
    emit("$pageleave", page, {
      $pageview_id: pageviewId,
      $session_id: pageSessionId,
      $prev_pageview_duration: duration,
      $prev_pageview_pathname: page.path,
      duration_seconds: duration,
    });
  }
  function capturePage() {
    if (
      !page ||
      consent !== "accepted" ||
      !available() ||
      capturedPath === page.path ||
      publicAnalyticsPage(options.href(), page.workshopId)?.path !== page.path
    )
      return;
    capturedPath = page.path;
    enteredAt = now();
    left = false;
    try {
      pageviewId = uuid();
      pageSessionId = identity().$session_id;
    } catch {
      return;
    }
    emit("$pageview", page, { $pageview_id: pageviewId });
    if (page.type === "search") emit("workshop_search_viewed", page);
    if (page.type === "profile") emit("workshop_profile_viewed", page);
  }
  function updateConsent(value: AnalyticsConsent) {
    if (consent === value) return;
    consent = value;
    epoch++;
    abort.abort();
    abort = new AbortController();
    capturedPath = null;
    left = true;
    if (value !== "accepted") clearIdentity();
    else capturePage();
    for (const listener of listeners) listener();
  }
  function syncConsent() {
    const current = read(options.storage, analyticsStorageKeys.consent);
    if (current !== lastStored) {
      lastStored = current;
      updateConsent(storedConsent());
    } else if (consentExpiresAt && consentExpiresAt <= now()) {
      updateConsent("unknown");
    }
  }
  return {
    available,
    getConsent: () => consent,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    syncConsent,
    setConsent(value: Exclude<AnalyticsConsent, "unknown">) {
      consentExpiresAt = now() + consentLifetime;
      write(
        options.storage,
        analyticsStorageKeys.consent,
        JSON.stringify({ value, expiresAt: consentExpiresAt }),
      );
      lastStored = read(options.storage, analyticsStorageKeys.consent);
      updateConsent(value);
    },
    navigate(target: AnalyticsPage | null) {
      syncConsent();
      if (page?.path === target?.path) {
        capturePage();
        return;
      }
      leave();
      page = target;
      capturedPath = null;
      capturePage();
    },
    resume(target: AnalyticsPage | null) {
      if (!left) {
        syncConsent();
        return;
      }
      // The restored DOM and URL must establish eligibility before consent can
      // trigger capture; a cached public page must not leak into a private route.
      page = target;
      capturedPath = null;
      syncConsent();
      capturePage();
    },
    contact(workshopId: string, channel: ContactChannel) {
      syncConsent();
      if (
        !page ||
        page.type !== "profile" ||
        page.workshopId !== workshopId ||
        !["phone", "whatsapp", "directions", "email"].includes(channel)
      )
        return;
      // Check the live URL again when dialogs or history changes precede React effects.
      if (publicAnalyticsPage(options.href(), workshopId)?.path !== page.path)
        return;
      emit("workshop_contact_clicked", page, { contact_channel: channel });
    },
    leave,
  };
}
