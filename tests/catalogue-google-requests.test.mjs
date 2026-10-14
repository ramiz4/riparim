import { localizeHref } from "../scripts/lib/locale.mjs";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";

const dom = new JSDOM('<div id="root"></div>', {
  url: "https://riparim.example.test/werkstaetten",
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole(),
});
for (const key of [
  "window",
  "document",
  "navigator",
  "customElements",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLFormElement",
  "HTMLSelectElement",
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
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.HTMLElement.prototype.hasPointerCapture = () => false;
window.HTMLElement.prototype.setPointerCapture = () => {};
window.HTMLElement.prototype.releasePointerCapture = () => {};
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
let visibleTab = true;
Object.defineProperty(document, "visibilityState", {
  get: () => (visibleTab ? "visible" : "hidden"),
});
const placeRequests = [],
  widgets = [],
  connections = [],
  disconnections = [],
  catalogueRefreshRequests = [],
  identityRequests = [],
  configurationRequests = [];
window.google = {
  maps: {
    importLibrary: async () => ({
      Place: class {
        constructor(options) {
          this.options = options;
        }
        async fetchFields() {
          placeRequests.push(this.options);
          throw Error("Enterprise details are prohibited");
        }
      },
    }),
  },
};
customElements.define(
  "gmp-advanced-place-details-compact",
  class extends HTMLElement {
    connectedCallback() {
      connections.push(this);
      if (!widgets.includes(this)) widgets.push(this);
    }
    disconnectedCallback() {
      disconnections.push(this);
    }
  },
);
globalThis.fetch = async (url) => {
  if (url === "/api/session")
    return Response.json({ account: null, isAdmin: false });
  if (String(url).startsWith("/api/workshops?locale=")) {
    catalogueRefreshRequests.push(String(url));
    return Response.json({ workshops, displayById: {} });
  }
  if (url === "/api/google-places") {
    configurationRequests.push(String(url));
    return Response.json({ enabled: true, browserKey: "fixture-key" });
  }
  assert(
    String(url).startsWith("/api/google-places/"),
    "no browser REST photos or provider identity search",
  );
  identityRequests.push(String(url));
  return Response.json({ placeId: "ChIJ" + String(url).split("/").at(-1) });
};

const output = ".test-runtime/catalogue-google-requests";
await mkdir(output, { recursive: true });
await build({
  stdin: {
    contents: `export {default as Catalogue} from './app/[locale]/werkstaetten/catalogue';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';export {defaultCatalogueFilters,parseCatalogueFilters} from './lib/catalogue-filters';`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: output + "/ui.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
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
              : `export function useRouter(){return {push(){},replace(){},refresh(){}};}export function usePathname(){return '/werkstaetten';}export function useSearchParams(){return new URLSearchParams();}`,
        }));
      },
    },
  ],
});
const {
  Catalogue,
  I18nProvider,
  getMessages,
  createTranslator,
  defaultCatalogueFilters,
  parseCatalogueFilters,
} = await import(new URL("../" + output + "/ui.mjs", import.meta.url));
const { createElement: h, act } = await import("react"),
  { createRoot } = await import("react-dom/client");
const scenarioCounts = [];
const workshops = Array.from({ length: 160 }, (_, i) => ({
  id: `fixture-${String(i).padStart(3, "0")}`,
  name: `Fixture ${String(i).padStart(3, "0")}`,
  city: "Prishtina",
  address: "Fixture address",
  phone: "+38349123456",
  whatsapp: "",
  lat: 42.6629,
  lng: 21.1655,
  rating: 4,
  count: 1,
  specialty: "Fixture",
  description: "Fixture description",
  services: ["Bremsen & Fahrwerk"],
  serviceDetails: [],
  brands: ["Volvo"],
  languages: ["Deutsch"],
  sources: [],
  checkedAt: "2026-10-04",
  status: "published",
  googleRating: { rating: 1, count: 999 },
}));
const props = {
  initialWorkshops: workshops,
  initialError: "",
  account: null,
  isAdmin: false,
  initialFilters: defaultCatalogueFilters,
};
const wrap = (locale, node) =>
  h(
    I18nProvider,
    { locale, messages: getMessages(locale, ["common", "public"]) },
    node,
  );
const root = createRoot(document.getElementById("root"));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const render = async (locale, node) => {
  document.documentElement.lang = locale;
  await act(async () => {
    root.render(wrap(locale, node));
    await settle();
  });
};
const intersect = async (index = 0) => {
  const card = document.querySelectorAll(".catalogue-card:not([hidden])")[
    index
  ];
  for (let pass = 0; pass < 3; pass++)
    await act(async () => {
      for (const [observer, element] of [...observations])
        if (element.closest(".catalogue-card") === card)
          observer.callback([{ isIntersecting: true }]);
      await settle();
    });
};
const search = async (value) => {
  const input = document.querySelector('input[type="search"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
  });
};
const tab = async (value) => {
  await act(async () => {
    visibleTab = value;
    document.dispatchEvent(new Event("visibilitychange"));
    await settle();
  });
};
try {
  for (const locale of ["de", "sq", "en"]) {
    await render(locale, null);
    window.sessionStorage.clear();
    window.history.replaceState(
      null,
      "",
      `/${locale}/werkstaetten?sort=google`,
    );
    const initialFilters = parseCatalogueFilters(
      new URLSearchParams("sort=google"),
      workshops,
    );
    await render(locale, h(Catalogue, { ...props, initialFilters }));
    assert(!window.location.search.includes("sort=google"));
    assert.equal(
      document.querySelectorAll(".catalogue-card:not([hidden])").length,
      12,
    );
    assert(
      document.querySelector(".riparim-rating .rating-value"),
      "published Riparim ratings remain visible",
    );
    const sort = document.querySelector(
      '.catalogue-panel-sort [role="combobox"]',
    );
    await act(async () => sort.click());
    const t = createTranslator(getMessages(locale));
    assert.deepEqual(
      [...document.querySelectorAll('[role="option"]')].map(
        (x) => x.textContent,
      ),
      [
        t("public.sortName"),
        t("public.sortRiparim"),
        t("public.sortChooseCity"),
      ],
    );
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    await tab(false);
    await tab(true);
    for (let i = 0; i < 12; i++) await intersect(i);
    await search("No fixture match");
    assert.equal(
      document.querySelectorAll(".catalogue-card:not([hidden])").length,
      0,
    );
    await search("");
    await act(async () => {
      document.querySelector(".catalogue-pagination button").click();
      await settle();
    });
    assert.equal(
      document.querySelectorAll(".catalogue-card:not([hidden])").length,
      24,
    );
    for (let i = 0; i < 24; i++) await intersect(i);
    assert.equal(
      widgets.length,
      0,
      "visible cards, filters and pagination never mount Google widgets",
    );
    assert.equal(
      identityRequests.length,
      0,
      "catalogue never requests Google identities",
    );
    assert.equal(
      configurationRequests.length,
      0,
      "catalogue never loads Google configuration or SDK",
    );
    assert(!document.querySelector(".google-rating-panel"));
    scenarioCounts.push({
      locale,
      firstTwelve: 0,
      filterAdditional: 0,
      nextTwelveAdditional: 0,
    });
    await render(locale, null);
    const path = localizeHref("/werkstaetten", locale),
      refreshes = catalogueRefreshRequests.length;
    window.history.replaceState(
      null,
      "",
      `${path}?sort=google&q=Fixture+00&ort=prishtina&leistung=bremsen-fahrwerk&marke=volvo&sprache=de`,
    );
    await render(
      locale,
      h(Catalogue, { ...props, publicSnapshot: true, initialWorkshops: [] }),
    );
    assert.equal(catalogueRefreshRequests.length, refreshes + 1);
    assert.equal(
      document.querySelectorAll(".catalogue-card:not([hidden])").length,
      11,
    );
    const actual = new URLSearchParams(window.location.search);
    assert.equal(window.location.pathname, path);
    assert.equal(actual.get("sort"), null);
    for (const [key, value] of [
      ["q", "Fixture 00"],
      ["ort", "prishtina"],
      ["leistung", "bremsen-fahrwerk"],
      ["marke", "volvo"],
      ["sprache", "de"],
    ])
      assert.equal(actual.get(key), value);
    await intersect();
    assert.equal(
      widgets.length,
      0,
      "live catalogue hydration never loads Google",
    );
    await render(locale, null);
    window.history.replaceState(null, "", path);
    await render(
      locale,
      h(Catalogue, {
        ...props,
        initialWorkshops: [{ ...workshops[0], rating: null, count: 0 }],
      }),
    );
    assert(
      document
        .querySelector(".rating-unavailable")
        .textContent.includes(t("public.noReviews")),
      "unrated cards show the existing localized empty state",
    );
  }
  // Live retirement still removes profiles retained while filtered away.
  await render("de", null);
  window.sessionStorage.clear();
  const initialFetch = globalThis.fetch;
  let releaseLive;
  const liveGate = new Promise((resolve) => {
    releaseLive = resolve;
  });
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("/api/workshops?locale=")) {
      await liveGate;
      return Response.json({
        workshops: workshops.filter((w) => w.id !== workshops[0].id),
        displayById: {},
      });
    }
    return initialFetch(url, options);
  };
  try {
    await render("de", h(Catalogue, { ...props, publicSnapshot: true }));
    await search("No fixture match");
    await act(async () => {
      releaseLive();
      await settle();
    });
    assert(
      !document.querySelector(
        '.catalogue-card-target[href*="' + workshops[0].id + '"]',
      ),
      "retired profiles are removed even while filtered away",
    );
    await search("");
    assert(
      !document.querySelector(
        '.catalogue-card-target[href*="' + workshops[0].id + '"]',
      ),
    );
  } finally {
    releaseLive();
    globalThis.fetch = initialFetch;
  }
  assert.equal(
    placeRequests.length,
    0,
    "no Enterprise fetchFields is called anywhere in the catalogue",
  );
  console.log(
    JSON.stringify({
      catalogueSize: 160,
      individualDetails: 0,
      catalogueGoogleRequests: 0,
      scenarioCounts,
      liveProviderCalls: false,
    }),
  );
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
