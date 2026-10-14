import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
const dom = new JSDOM('<html lang="de"><div id="root"></div></html>', {
  url: "https://riparim.example.test/werkstatt/fixture",
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLFormElement",
  "HTMLSelectElement",
  "customElements",
  "DocumentFragment",
  "Element",
  "Node",
  "NodeFilter",
  "MutationObserver",
  "CustomEvent",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "getComputedStyle",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
  dom.window,
);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.setPointerCapture = () => {};
window.HTMLElement.prototype.releasePointerCapture = () => {};
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const observations = new Map();
globalThis.IntersectionObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  observe(element) {
    observations.set(this, element);
  }
  disconnect() {
    observations.delete(this);
  }
};
let visibleTab = true;
Object.defineProperty(document, "visibilityState", {
  get: () => (visibleTab ? "visible" : "hidden"),
});
const counters = {
    configs: [],
    individualDetails: [],
    individualRatings: [],
    widgets: [],
    widgetConnections: [],
    widgetDisconnections: [],
    photoResources: [],
  },
  identities = [];
const seenPhotos = new WeakSet();
const photoObserver = new MutationObserver((records) => {
  for (const record of records)
    for (const node of record.addedNodes)
      if (node instanceof Element)
        for (const image of [
          ...(node.matches("img") ? [node] : []),
          ...node.querySelectorAll("img"),
        ])
          if (
            image.src.includes("places.googleapis.com") &&
            !seenPhotos.has(image)
          ) {
            seenPhotos.add(image);
            counters.photoResources.push(image.src);
          }
});
photoObserver.observe(document.body, { childList: true, subtree: true });
const nativeTimeout = globalThis.setTimeout,
  nativeClearTimeout = globalThis.clearTimeout,
  expiries = new Map(),
  timeouts = new Map();
let timerId = 100000;
globalThis.setTimeout = (fn, delay, ...args) => {
  if (delay === 1800000 || delay === 12000) {
    const id = ++timerId;
    (delay === 1800000 ? expiries : timeouts).set(id, () => fn(...args));
    return id;
  }
  return nativeTimeout(fn, delay, ...args);
};
globalThis.clearTimeout = (id) => {
  expiries.delete(id);
  timeouts.delete(id);
  return nativeClearTimeout(id);
};
window.google = {
  maps: {
    importLibrary: async () => ({
      Place: class {
        constructor(options) {
          this.options = options;
        }
        async fetchFields(options) {
          counters.individualRatings.push({
            place: this.options,
            fields: options.fields,
          });
        }
      },
    }),
  },
};
for (const tag of [
  "gmp-advanced-place-details",
  "gmp-advanced-place-details-compact",
])
  customElements.define(
    tag,
    class extends HTMLElement {
      connectedCallback() {
        counters.widgetConnections.push(this);
        if (!counters.widgets.includes(this)) counters.widgets.push(this);
      }
      disconnectedCallback() {
        counters.widgetDisconnections.push(this);
      }
    },
  );
globalThis.fetch = async (url) => {
  if (url === "/api/google-places") {
    counters.configs.push(url);
    return Response.json({ enabled: true, browserKey: "fixture-key" });
  }
  if (String(url).startsWith("/api/google-places/")) {
    identities.push(String(url));
    if (String(url).endsWith("disabled"))
      return Response.json({ placeId: null });
    return Response.json({ placeId: "ChIJ" + String(url).split("/").at(-1) });
  }
  if (String(url).startsWith("https://places.googleapis.com/")) {
    counters.individualDetails.push({ url: String(url) });
    throw Error("Browser REST photos are prohibited");
  }
  throw Error("Unexpected fixture request " + url);
};
const output = ".test-runtime/google-profile-requests";
await mkdir(output, { recursive: true });
await build({
  stdin: {
    contents: `export {default as Profile} from './app/[locale]/workshop/[id]/profile';export {GooglePlaceReviews} from './components/google-place-reviews';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';export {formatDate} from './lib/i18n/format';`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: output + "/ui.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "navigation-fixture",
      setup(b) {
        b.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents:
            args.path === "next/link"
              ? `import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children);}`
              : `export function useRouter(){return {push(){},refresh(){},prefetch(){}};}export function usePathname(){return '/werkstatt/fixture';}export function useSearchParams(){return new URLSearchParams();}`,
        }));
      },
    },
  ],
});
const api = await import(new URL("../" + output + "/ui.mjs", import.meta.url)),
  React = await import("react"),
  { createRoot } = await import("react-dom/client");
const root = createRoot(document.getElementById("root")),
  h = React.createElement;
const workshop = {
  id: "fixture",
  name: "Fixture",
  city: "Prishtina",
  address: "Fixture street",
  phone: "+38349123456",
  whatsapp: "",
  lat: 42.66,
  lng: 21.16,
  rating: 4,
  count: 1,
  specialty: "",
  description: "",
  services: [],
  serviceDetails: [],
  brands: [],
  languages: [],
  sources: [],
  checkedAt: "2026-10-10",
  status: "published",
  googleRating: {
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query_place_id=ChIJfixture",
    rating: 1,
    count: 999,
  },
};
const props = {
  workshop,
  directory: [workshop],
  reviews: [],
  reviewError: "",
  signedIn: false,
  account: null,
  isAdmin: false,
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const render = async (locale, node) => {
  document.documentElement.lang = locale;
  await React.act(async () => {
    root.render(
      h(
        api.I18nProvider,
        { locale, messages: api.getMessages(locale, ["common", "public"]) },
        node,
      ),
    );
    await settle();
  });
};
const tab = async (value) => {
  await React.act(async () => {
    visibleTab = value;
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
  });
};
try {
  const hours = {
    week: Array.from({ length: 7 }, () => ({
      mode: "open",
      intervals: [
        { start: "08:00", end: "12:00" },
        { start: "13:00", end: "18:00" },
      ],
    })),
    exceptions: [{ date: "2026-12-25", day: { mode: "closed" } }],
  };
  for (const locale of ["de", "sq", "en"]) {
    await render(locale, null);
    const value = {
      ...workshop,
      openingHours: hours,
      openingHoursConfirmedAt: "2026-10-13T10:00:00Z",
    };
    await render(
      locale,
      h(React.StrictMode, null, h(api.Profile, { ...props, workshop: value })),
    );
    const t = api.createTranslator(api.getMessages(locale));
    const trigger = document.querySelector(".opening-hours-trigger");
    assert(trigger, "Today is the only schedule trigger");
    assert(trigger.textContent.includes(t("common.hoursToday")));
    assert(
      !document.querySelector(".workshop-opening-hours details"),
      "The schedule must not expand the overview layout",
    );
    await React.act(async () => {
      trigger.click();
      await settle();
    });
    assert(
      document
        .querySelector(".opening-hours-popover")
        .textContent.includes(t("common.hoursSource")),
    );
    assert(
      document
        .querySelector(".opening-week")
        .textContent.includes("08:00–12:00, 13:00–18:00"),
    );
    assert(
      document.querySelector(".opening-week dt").textContent ===
        t("public.monday"),
      "weekdays use project translations even when browser ICU omits Albanian",
    );
    assert.equal(
      document.querySelectorAll('.opening-hours-popover [aria-current="date"]')
        .length,
      1,
      "The current local weekday is highlighted",
    );
    await React.act(async () => {
      document.activeElement.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await settle();
    });
    await React.act(settle);
    assert(
      !document.querySelector(".opening-hours-popover"),
      "Escape closes the floating schedule",
    );
    assert(
      document.activeElement === trigger,
      "Closing restores focus to Today",
    );
    assert(!document.querySelector("gmp-advanced-place-details"));
    assert(!document.querySelector(".profile-google-reviews"));
    for (const link of document.querySelectorAll('a[href*="google.com/maps"]'))
      assert(
        new URL(link.href).searchParams.get("query_place_id") ===
          "ChIJfixture" ||
          new URL(link.href).searchParams.get("destination_place_id") ===
            "ChIJfixture",
      );
    await tab(false);
    await tab(true);
    await render(
      locale,
      h(api.Profile, { ...props, workshop: { ...value, openingHours: null } }),
    );
    assert(
      document
        .querySelector(".workshop-opening-hours")
        .textContent.includes(t("common.hoursMissing")),
    );
    await render(
      locale,
      h(api.Profile, {
        ...props,
        workshop: {
          ...workshop,
          openingHours: null,
          importedOpeningHours: hours,
        },
      }),
    );
    const importedSection = document.querySelector(".workshop-opening-hours");
    assert(importedSection.textContent.includes("08:00–12:00"));
    assert(!importedSection.querySelector(".opening-status"));
    assert(!importedSection.textContent.includes(t("common.hoursSource")));
    assert(!importedSection.querySelector(".help"));
    await render(
      locale,
      h(api.Profile, {
        ...props,
        workshop: {
          ...value,
          importedOpeningHours: {
            week: Array(7).fill({ mode: "closed" }),
            exceptions: [],
          },
        },
      }),
    );
    if (!document.querySelector(".opening-week"))
      await React.act(async () => {
        document.querySelector(".opening-hours-trigger").click();
        await settle();
      });
    assert(
      document
        .querySelector(".opening-week")
        .textContent.includes("08:00–12:00"),
    );
  }
  const originalFetch = globalThis.fetch,
    review = {
      display_name: "Fixture reviewer",
      vehicle: "Fixture vehicle",
      service: "Fixture service",
      date: "2026-10-10",
      rating: 5,
      review: "Fixture own review",
    };
  globalThis.fetch = async (url) =>
    url === "/api/session"
      ? Response.json({ account: null, isAdmin: false })
      : String(url).startsWith("/api/workshops?")
        ? Response.json({ workshops: [{ ...workshop, openingHours: hours }] })
        : String(url).startsWith("/api/reviews?")
          ? Response.json({ reviews: [review] })
          : originalFetch(url);
  await render("de", null);
  await render("de", h(api.Profile, { ...props, publicSnapshot: true }));
  assert(
    document
      .querySelector(".public-review-list")
      .textContent.includes(review.review),
  );
  if (!document.querySelector(".opening-week"))
    await React.act(async () => {
      document.querySelector(".opening-hours-trigger").click();
      await settle();
    });
  assert(
    document.querySelector(".opening-week").textContent.includes("08:00–12:00"),
  );
  assert.equal(counters.configs.length, 0);
  assert.equal(identities.length, 0);
  assert.equal(counters.widgets.length, 0);
  assert.equal(counters.individualRatings.length, 0);
  assert.equal(counters.individualDetails.length, 0);
  console.log(
    "Profile DE/SQ/EN: own opening hours and reviews, empty state, live hydration and Maps links; zero Google config, identity, widget or provider calls",
  );
} finally {
  await React.act(async () => root.unmount());
  photoObserver.disconnect();
  dom.window.close();
  globalThis.setTimeout = nativeTimeout;
  globalThis.clearTimeout = nativeClearTimeout;
}
