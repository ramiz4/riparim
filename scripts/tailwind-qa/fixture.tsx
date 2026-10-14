import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Finder from "@/app/finder";
import Catalogue from "@/app/[locale]/workshops/catalogue";
import Profile from "@/app/[locale]/workshop/[id]/profile";
import WorkshopNotFound from "@/app/[locale]/workshop/[id]/not-found";
import CatalogueLoading from "@/app/[locale]/workshops/loading";
import ProfileLoading from "@/app/[locale]/workshop/[id]/loading";
import PageError from "@/app/[locale]/error";
import { DeferredManagement } from "@/components/deferred-management";
import { DeferredReviews } from "@/components/deferred-reviews";
import { DeferredAuth } from "@/components/deferred-auth";
import { PrivacyContent } from "@/app/[locale]/privacy/content";
import { SiteHeader } from "@/components/site-header";
import { DirectoryFooter } from "@/components/directory-footer";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { I18nProvider } from "@/lib/i18n/client";
import { getMessages } from "@/lib/i18n/messages";
import { privacyMessages } from "@/lib/i18n/privacy-messages";
import { defaultCatalogueFilters } from "@/lib/catalogue-filters";
import { localizeHref } from "@/lib/i18n/locale";
import type { Workshop } from "@/lib/workshops";
import { cn } from "@/lib/utils";
import {
  pageFrameClassName,
  contentPageClassName,
  contentTitleClassName,
} from "@/lib/presentation";

const query = new URLSearchParams(window.location.search);
const scene = query.get("scene") ?? "landing";
const locale = (
  ["de", "sq", "en"].includes(query.get("locale") ?? "")
    ? query.get("locale")
    : "de"
) as "de" | "sq" | "en";
const state = query.get("state") ?? "ready";
const role =
  query.get("role") ??
  (scene.startsWith("admin")
    ? "admin"
    : ["login", "register", "recovery", "reset"].includes(scene)
      ? "guest"
      : "member");
const theme = query.get("theme") ?? "light";
localStorage.setItem("riparim-theme", theme);
document.documentElement.classList.toggle("dark", theme === "dark");
document.documentElement.lang = locale;
// Only fictional data lives in these standalone fixtures; no app server, secret,
// real provider or protected database is connected.
const account =
  role === "guest"
    ? null
    : {
        email: "member@example.test",
        displayName: "Fixture member with a longer translated account name",
        provider: "E-Mail",
      };
const workshop: Workshop = {
  id: "fixture-workshop",
  name: "Fixture Automotive Service and Diagnostics",
  city: "Prishtina",
  address: "Fictional Street 12",
  phone: "+38344123456",
  phoneNote: "",
  whatsapp: "+38344123456",
  brands: ["Volkswagen", "Audi", "BMW"],
  services: ["Inspektion & Wartung", "Diagnose & Elektronik"],
  serviceDetails: ["Regular maintenance", "Diagnostics"],
  languages: ["Deutsch", "Shqip", "English"],
  rating: 4.5,
  count: 12,
  initials: "FA",
  color: "#123b63",
  specialty: "Maintenance and diagnostics",
  description:
    "Fictional workshop details with a deliberately long description to test wrapping in narrow layouts. All accounts and records are isolated fixtures.",
  lat: 42.6629,
  lng: 21.1655,
  sources: [],
  checkedAt: "2026-10-04",
  status: "published",
  updatedAt: "2026-10-04T09:00:00Z",
  openingHours: {
    week: [
      { mode: "open", intervals: [{ start: "08:00", end: "18:00" }] },
      { mode: "open", intervals: [{ start: "08:00", end: "18:00" }] },
      { mode: "closed" },
      { mode: "closed" },
      { mode: "closed" },
      { mode: "appointment" },
      { mode: "unknown" },
    ],
    exceptions: [],
  },
};
const directory =
  state === "empty"
    ? []
    : Array.from({ length: 15 }, (_, index) => ({
        ...workshop,
        id: index === 0 ? workshop.id : "fixture-workshop-" + index,
        name:
          index === 0
            ? workshop.name
            : "Fixture workshop " + String(index + 1).padStart(2, "0"),
        city: index % 2 ? "Peja" : "Prishtina",
        rating: index === 1 ? null : 4.5,
        count: index === 1 ? 0 : 12,
      }));
const visit = {
  id: "11111111-1111-4111-8111-111111111111",
  workshop: workshop.id,
  workshop_name: workshop.name,
  date: "2026-10-04",
  vehicle: "Fixture car",
  service: "Inspektion & Wartung",
  services: ["Inspektion & Wartung"],
  evidence_type: "Rechnung",
  evidence_note: "Fictional private evidence note",
  status: "pending",
  moderator_note: "",
  display_name: "Fixture member",
  rating: 4,
  review: "Fictional review with text that wraps on a small screen.",
  file_name: "fixture-proof.png",
  created_at: "2026-10-04T10:00:00Z",
};
const request = {
  id: "fixture-claim",
  workshopId: workshop.id,
  workshopName: workshop.name,
  owner: "fixture-owner",
  status: "pending",
  moderatorNote: "",
  revision: 0,
  createdAt: "2026-10-04T10:00:00Z",
  evidence: "Private fictional company evidence explanation",
  evidenceLinks: [],
  documents: [
    {
      id: "fixture-document",
      name: "fixture-register.pdf",
      size: 1000,
      mimeType: "application/pdf",
    },
  ],
};
const requests: string[] = [];
const failures: string[] = [];
const response = (value: unknown, status = 200) =>
  Promise.resolve(Response.json(value, { status }));
window.fetch = async (input, options) => {
  const url = new URL(String(input), window.location.origin);
  requests.push((options?.method ?? "GET") + " " + url.pathname + url.search);
  if (url.origin !== window.location.origin) {
    failures.push("Blocked external request " + url.hostname);
    throw Error("External fixture requests are blocked");
  }
  if (state === "loading") return new Promise<Response>(() => {});
  if (state === "error") return response({ errorCode: "unavailable" }, 503);
  if (state === "revoked" && url.pathname !== "/api/session")
    return response({ errorCode: "forbidden" }, 403);
  if (url.pathname === "/api/session")
    return response({ account, isAdmin: role === "admin" });
  if (url.pathname === "/api/auth-options")
    return response({
      enabled: state !== "unconfigured",
      email: true,
      emailSignup: true,
      emailRecovery: true,
      google: true,
    });
  if (url.pathname === "/api/account")
    return response({
      account: account
        ? {
            email: account.email,
            name: account.displayName,
            provider: account.provider,
            protected: false,
          }
        : null,
      deletionReady: false,
      deletionStarted: false,
    });
  if (url.pathname === "/api/workshops")
    return response({ workshops: directory });
  if (url.pathname === "/api/premium-workshops")
    return response({
      preview: true,
      workshops: directory.slice(0, 3),
      displayById: {},
      active: false,
    });
  if (url.pathname === "/api/visits")
    return response({
      visits: state === "empty" ? [] : [visit],
      nextCursor: null,
      pendingCount: state === "empty" ? 0 : 1,
    });
  if (url.pathname === "/api/business")
    return response({
      workshops: state === "empty" ? [] : [workshop],
      claims: state === "empty" ? [] : [request],
      changes: [],
      pendingClaims: state === "empty" ? [] : [request],
      pendingChangeRequestIds: [],
      pendingChangeWorkshopIds: [],
      nextClaimCursor: null,
      nextChangeCursor: null,
    });
  if (url.pathname === "/api/users")
    return response({
      users:
        state === "empty"
          ? []
          : [
              {
                id: "fixture-member",
                name: account?.displayName ?? "Fixture member",
                email: "member@example.test",
                role: "user",
                protected: false,
                active: true,
                confirmed: true,
                providers: ["email"],
                createdAt: "2026-10-04",
                lastSignInAt: null,
              },
              {
                id: "fixture-admin",
                name: "Fixture administrator",
                email: "admin@example.test",
                role: "admin",
                protected: true,
                active: true,
                confirmed: true,
                providers: ["email"],
                createdAt: "2026-10-04",
                lastSignInAt: null,
              },
            ],
      pendingDeletions: [],
      page: 1,
      perPage: 20,
      hasMore: false,
      configured: state !== "unconfigured",
    });
  if (url.pathname === "/api/notifications")
    return response({ notifications: [], nextCursor: null, configured: true });
  if (url.pathname === "/api/auth-settings")
    return response({
      config:
        state === "unconfigured"
          ? null
          : {
              provider: "supabase",
              projectUrl: "https://auth.example.test",
              publicKey: "fictional-public-key",
              enabled: true,
              emailDeliveryConfirmed: true,
            },
    });
  if (url.pathname === "/api/google-places")
    return response({ enabled: false });
  if (url.pathname === "/api/reviews") return response({ reviews: [] });
  if (url.pathname.startsWith("/api/auth/"))
    return response({ errorCode: "invalid_email" }, 400);
  if (options?.method && options.method !== "GET")
    return response({ errorCode: "unavailable" }, 503);
  failures.push("Unhandled fixture endpoint " + url.pathname);
  return response({ errorCode: "unavailable" }, 503);
};
window.addEventListener("error", (event) => failures.push(event.message));
window.addEventListener("unhandledrejection", (event) =>
  failures.push(String(event.reason)),
);
const routes: Record<string, string> = {
  landing: "/",
  catalogue: "/werkstaetten",
  profile: "/werkstatt/fixture-workshop",
  privacy: "/datenschutz",
  login: "/login",
  register: "/registrieren",
  recovery: "/passwort-vergessen",
  reset: "/passwort-zuruecksetzen",
  settings: "/einstellungen",
  reviews: "/bewertungen",
  business: "/betriebe",
  requests: "/antraege",
  claim: "/betriebe/beanspruchen?werkstatt=fixture-workshop",
  admin: "/verwaltung",
  "admin-users": "/verwaltung/benutzer",
  "admin-reviews": "/verwaltung/bewertungen",
  "admin-businesses": "/verwaltung/betriebe",
  "admin-auth": "/verwaltung/anmeldung",
};
const originalQuery = window.location.search;
const fixturePath = window.location.pathname;
history.replaceState({}, "", localizeHref(routes[scene] ?? "/", locale));
const common = { account, isAdmin: role === "admin" };
function Controls() {
  const [checked, setChecked] = useState(false);
  return (
    <main
      className={cn(
        pageFrameClassName,
        contentPageClassName,
        "min-h-[calc(100svh_-_180px)]",
      )}
    >
      <h1 className={cn(contentTitleClassName, "mb-[var(--content-page-gap)]")}>
        Shared control fixture
      </h1>
      <ThemeToggle />
      <div
        style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 24 }}
      >
        <label>
          <Switch
            checked={checked}
            onCheckedChange={setChecked}
            aria-label="Default switch"
          />{" "}
          Default switch
        </label>
        <label>
          <Switch checked size="sm" aria-label="Small checked switch" /> Small
          checked
        </label>
        <label>
          <Switch disabled aria-label="Disabled switch" /> Disabled
        </label>
        <label>
          <Checkbox aria-label="Unchecked consent" /> Unchecked
        </label>
        <label>
          <Checkbox checked aria-label="Checked consent" /> Checked
        </label>
        <label>
          <Checkbox checked="indeterminate" aria-label="Mixed consent" /> Mixed
        </label>
        <label>
          <Checkbox disabled aria-label="Disabled consent" /> Disabled
        </label>
        <Button>Shared button</Button>
        <Button disabled>Disabled button</Button>
      </div>
    </main>
  );
}
function Scene() {
  const kinds = {
    settings: "settings",
    business: "business",
    requests: "applications",
    claim: "claim",
    admin: "workshops",
    "admin-users": "users",
    "admin-reviews": "reviews",
    "admin-businesses": "claims",
    "admin-auth": "auth",
  } as const;
  if (scene in kinds)
    return <DeferredManagement kind={kinds[scene as keyof typeof kinds]} />;
  if (["login", "register", "recovery", "reset"].includes(scene))
    return (
      <DeferredAuth
        screen={scene as "login" | "register" | "recovery" | "reset"}
      />
    );
  if (scene === "reviews") return <DeferredReviews />;
  if (scene === "privacy")
    return (
      <>
        <SiteHeader {...common} />
        <PrivacyContent text={privacyMessages[locale]} />
        <DirectoryFooter />
      </>
    );
  if (scene === "profile")
    return (
      <Profile
        workshop={workshop}
        directory={directory}
        reviews={
          state === "empty"
            ? []
            : [
                {
                  display_name: "Fixture reviewer",
                  date: "2026-10-04",
                  vehicle: "Fixture car",
                  service: "Inspektion & Wartung",
                  services: ["Inspektion & Wartung"],
                  rating: 4,
                  review: "Fictional published review for layout verification.",
                },
              ]
        }
        reviewError={state === "error" ? "unavailable" : ""}
        signedIn={!!account}
        {...common}
      />
    );
  if (scene === "catalogue")
    return (
      <Catalogue
        initialWorkshops={state === "loading" ? [] : directory}
        initialError={state === "error" ? "unavailable" : ""}
        initialFilters={defaultCatalogueFilters}
        publicSnapshot={state === "loading"}
        {...common}
      />
    );
  if (scene === "not-found") return <WorkshopNotFound />;
  if (scene === "page-error")
    return <PageError error={new Error("Fixture failure")} reset={() => {}} />;
  if (scene === "catalogue-loading") return <CatalogueLoading />;
  if (scene === "profile-loading") return <ProfileLoading />;
  if (scene === "controls") return <Controls />;
  return (
    <Finder
      initialWorkshops={directory}
      initialError={state === "error" ? "unavailable" : ""}
      {...common}
    />
  );
}
createRoot(document.getElementById("root")!).render(
  <I18nProvider locale={locale} messages={getMessages(locale)}>
    <ThemeProvider>
      <Scene />
    </ThemeProvider>
  </I18nProvider>,
);
function measure() {
  const nodes = [
    ...document.querySelectorAll(
      "main,header,footer,nav,[role=dialog],[role=alertdialog],[data-slot=switch],[data-slot=switch-thumb],[data-slot=checkbox],h1,input[type=date],gmp-advanced-place-details",
    ),
  ];
  const geometries = nodes.map((node, index) => {
    const rect = node.getBoundingClientRect(),
      style = getComputedStyle(node);
    return {
      index,
      tag: node.tagName,
      role: node.getAttribute("role"),
      slot: node.getAttribute("data-slot"),
      text: node.textContent?.trim().slice(0, 70),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      display: style.display,
      position: style.position,
      translate: style.translate,
      transform: style.transform,
      color: style.color,
      background: style.backgroundColor,
      overflow: style.overflow,
      minWidth: style.minWidth,
      maxWidth: style.maxWidth,
      border: style.border,
      padding: style.padding,
    };
  });
  const report = {
    scene,
    state,
    role,
    locale,
    theme,
    width: innerWidth,
    height: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > innerWidth,
    ready: !!document.querySelector("main"),
    requests,
    failures,
    preferences: {
      coarsePointer: matchMedia("(pointer:coarse)").matches,
      reducedMotion: matchMedia("(prefers-reduced-motion:reduce)").matches,
      reducedTransparency: matchMedia("(prefers-reduced-transparency:reduce)")
        .matches,
    },
    geometries,
    fixturePath,
    originalQuery,
  };
  document.documentElement.dataset.qaReady = String(report.ready);
  window.parent.postMessage(
    { type: "riparim-qa-report", report },
    window.location.origin,
  );
}
window.addEventListener("message", (event) => {
  if (event.origin === location.origin && event.data === "riparim-qa-measure")
    measure();
});
setTimeout(measure, 800);
