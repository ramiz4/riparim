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
globalThis.IntersectionObserver = class {
  observe() {}
  disconnect() {}
};
window.scrollTo = () => {};
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
globalThis.fetch = async (url) => {
  if (String(url).startsWith("/api/premium-workshops?"))
    return Response.json({ workshops: [], preview: true });
  assert.equal(url, "/api/google-places");
  return Response.json({ enabled: false });
};

const output = ".test-runtime/public-performance";
await mkdir(output, { recursive: true });
await build({
  stdin: {
    contents: `export {DiscoverWorkshops} from './components/discover-workshops';export {default as CatalogueLoading} from './app/[locale]/workshops/loading';export {default as Finder} from './app/finder';export {default as Catalogue} from './app/[locale]/workshops/catalogue';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';export {defaultCatalogueFilters} from './lib/catalogue-filters';`,
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
              : `export function useRouter(){return {push(href){globalThis.fixtureNavigations.push(href);},replace(){},refresh(){}};}export function usePathname(){return '/werkstaetten';}export function useSearchParams(){return new URLSearchParams();}`,
        }));
      },
    },
  ],
});
const {
  DiscoverWorkshops,
  CatalogueLoading,
  Finder,
  Catalogue,
  I18nProvider,
  getMessages,
  createTranslator,
  defaultCatalogueFilters,
} = await import(new URL("../" + output + "/ui.mjs", import.meta.url));
const { createElement: h, act } = await import("react"),
  { renderToStaticMarkup } = await import("react-dom/server"),
  { createRoot } = await import("react-dom/client");
const workshops = Array.from({ length: 25 }, (_, i) => ({
  id: `fixture-${String(i).padStart(2, "0")}`,
  name: `Fixture ${String(i).padStart(2, "0")}`,
  city: "Prishtina",
  address: "Fixture address",
  phone: "+38349123456",
  whatsapp: "",
  lat: null,
  lng: null,
  rating: null,
  count: 0,
  specialty: "Fixture",
  description: "Fixture description",
  services: ["Bremsen & Fahrwerk"],
  serviceDetails: [],
  brands: ["Volvo"],
  languages: ["Deutsch"],
  sources: [],
  checkedAt: "2026-10-04",
  status: "published",
  googleRating: null,
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
globalThis.fixtureNavigations = [];
try {
  for (const locale of ["de", "sq", "en"]) {
    const t = createTranslator(getMessages(locale));
    const loadingLabels = {
      de: "Werkstätten werden geladen …",
      sq: "Duke ngarkuar serviset …",
      en: "Loading workshops …",
    };
    const loadingDom = new JSDOM(
      renderToStaticMarkup(wrap(locale, h(CatalogueLoading))),
    );
    try {
      const main = loadingDom.window.document.querySelector("main");
      assert.equal(
        main.querySelectorAll("h1,h2,article").length,
        0,
        `${locale}: pending catalogue has no repeated title or skeleton cards`,
      );
      assert.equal(
        main.children.length,
        1,
        "Pending catalogue contains only its status, without empty placeholder rows",
      );
      assert.equal(main.textContent, loadingLabels[locale]);
      assert.equal(
        main.querySelectorAll('[role="status"]').length,
        1,
        "One status announces loading without a second English spinner label",
      );
      const status = main.querySelector('[role="status"]');
      assert.equal(status.textContent, t("common.loadingWorkshops"));
      assert.equal(
        status.querySelector("svg").getAttribute("aria-hidden"),
        "true",
        "The loading graphic is decorative beside localized text",
      );
      assert.equal(
        main.querySelectorAll("button,a,input,[tabindex]").length,
        0,
        "A passive loading indicator adds no keyboard stop",
      );
    } finally {
      loadingDom.window.close();
    }
    for (const Page of [Finder, Catalogue]) {
      const ssr = new JSDOM(renderToStaticMarkup(wrap(locale, h(Page, props))));
      try {
        const doc = ssr.window.document;
        for (const picker of doc.querySelectorAll('[role="combobox"]'))
          assert(
            (
              picker.querySelector('[data-slot="select-value"]') ??
              picker.closest("[data-ui~=picker-control]")?.querySelector("span")
            )?.textContent.trim(),
            `${locale}: selected values must be readable before JavaScript loads`,
          );
        assert(
          !doc.querySelector(
            "main [name=vehicle],main [name=model],main [name=year]",
          ),
          "public pages have a single search path without the vehicle wizard",
        );
        if (Page === Finder) {
          assert(
            doc
              .querySelector("section[aria-labelledby='hero-title']")
              .nextElementSibling.matches(
                "section[aria-labelledby='discover-title']",
              ),
            "discovery sits directly after the hero",
          );
          const partnerHeader = doc.querySelector(
            "section[aria-labelledby='discover-title'] > div:first-child",
          );
          assert.equal(
            partnerHeader.textContent,
            t("public.partnerTitle"),
            "partner header contains only the title",
          );
          assert(
            partnerHeader.querySelector("h2 svg"),
            "partner title includes its decorative icon",
          );
          assert.equal(
            partnerHeader.querySelectorAll("p,button,a").length,
            0,
            "partner header has no extra copy or actions",
          );
          assert(
            !doc.querySelector("main a[href*='leistung=']"),
            "the old location and service link section is removed",
          );
          const invitation = doc.querySelector(
            "[data-ui~='review-invitation']",
          );
          assert(
            invitation.previousElementSibling.matches(
              "section[aria-labelledby='discover-title']",
            ),
            "review invitation follows the workshop cards",
          );
          assert.equal(
            invitation.querySelector("a").getAttribute("href"),
            locale === "de"
              ? "/werkstaetten"
              : locale === "sq"
                ? "/sq/serviset"
                : "/en/workshops",
            "review invitation selects a public workshop in the active locale",
          );
          assert.equal(
            invitation.querySelector("a").textContent,
            t("public.reviewInviteAction"),
            "review action clearly asks visitors to select the workshop they visited",
          );
          assert(
            doc.querySelector(
              "section[aria-labelledby='hero-title'] #suche form",
            ),
            "quick search is inside the hero before JavaScript loads",
          );
          assert.equal(
            doc.querySelector("#hero-title + p").textContent,
            t("public.heroBenefit"),
          );
          assert.equal(
            doc.querySelectorAll("main form").length,
            1,
            "landing has one search form",
          );
          assert.equal(
            doc.querySelectorAll('#suche [role="combobox"]').length,
            2,
            "only service and location are requested",
          );
        }
      } finally {
        ssr.window.close();
      }
    }
    const pendingDom = new JSDOM(
      renderToStaticMarkup(
        wrap(
          locale,
          h(Catalogue, {
            ...props,
            publicSnapshot: true,
            initialWorkshops: [],
          }),
        ),
      ),
    );
    try {
      const main = pendingDom.window.document.querySelector("main");
      const status = [...main.querySelectorAll('[role="status"]')].find(
        (node) => node.textContent === loadingLabels[locale],
      );
      assert(
        status,
        "The catalogue live-data loading state uses localized status text",
      );
      assert.equal(
        status.querySelector("svg").getAttribute("aria-hidden"),
        "true",
      );
      assert.equal(
        status.querySelectorAll('[role="status"]').length,
        0,
        "The shared graphic creates no nested status announcement",
      );
    } finally {
      pendingDom.window.close();
    }
    Object.defineProperty(window, "scrollY", { value: 96, configurable: true });
    await act(async () => root.render(wrap(locale, h(Finder, props))));
    assert.equal(
      document.querySelector("[data-ui~='site-header']").dataset.scrolled,
      "true",
      "header restores its glass state when entering an already scrolled page",
    );
    for (const [position, expected] of [
      [0, "false"],
      [20, "true"],
      [0, "false"],
    ]) {
      Object.defineProperty(window, "scrollY", {
        value: position,
        configurable: true,
      });
      await act(async () => window.dispatchEvent(new Event("scroll")));
      assert.equal(
        document.querySelector("[data-ui~='site-header']").dataset.scrolled,
        expected,
        "header glass follows scroll and clears at the top",
      );
    }
    const form = document.querySelector("#suche form"),
      before = fixtureNavigations.length;
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    assert.equal(
      fixtureNavigations.length,
      before + 1,
      "Rapid repeated submission starts only one navigation",
    );
    assert.equal(
      fixtureNavigations.at(-1),
      locale === "de"
        ? "/werkstaetten"
        : locale === "sq"
          ? "/sq/serviset"
          : "/en/workshops",
    );
    const immediateStatus = document.querySelector('main [role="status"]');
    assert.equal(
      immediateStatus?.textContent,
      loadingLabels[locale],
      "Search responds before the router returns any data",
    );
    assert(
      !document.querySelector("section[aria-labelledby='hero-title']"),
      "Pending navigation immediately shows the destination loading view",
    );
    assert.equal(
      document.activeElement,
      document.querySelector("main"),
      "Keyboard focus follows the immediate loading view",
    );
    await act(async () =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
    assert.equal(
      fixtureNavigations.length,
      before + 1,
      "Repeated submission cannot start another navigation",
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    assert.equal(
      document.querySelector('main [role="status"]').textContent,
      loadingLabels[locale],
      "Feedback stays visible while navigation is stalled",
    );
    await act(async () => root.render(null));
    await act(async () => root.render(wrap(locale, h(Catalogue, props))));
    assert.equal(
      document.querySelectorAll("[data-ui~='catalogue-card']").length,
      12,
    );
    const more = () =>
      [...document.querySelectorAll("button")].find(
        (button) => button.textContent === t("public.showMore"),
      );
    more().focus();
    await act(async () => more().click());
    await new Promise((resolve) => requestAnimationFrame(resolve));
    assert.equal(
      document.querySelectorAll("[data-ui~='catalogue-card']").length,
      24,
    );
    assert.equal(
      document.activeElement,
      document.querySelectorAll("[data-card-focus-target]")[12],
      "Keyboard users continue at the first newly added workshop",
    );
    more().focus();
    await act(async () => more().click());
    await new Promise((resolve) => requestAnimationFrame(resolve));
    assert.equal(
      document.querySelectorAll("[data-ui~='catalogue-card']").length,
      25,
    );
    assert.equal(
      document.activeElement,
      document.querySelectorAll("[data-card-focus-target]")[24],
      "Focus survives the removal of the final show-more button",
    );
    await act(async () => root.render(null));
  }
  for (const locale of ["de", "sq", "en"]) {
    const t = createTranslator(getMessages(locale));
    let finish;
    globalThis.fetch = async (url) =>
      String(url).startsWith("/api/premium-workshops?")
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Response.json({ enabled: false });
    await act(async () => root.render(wrap(locale, h(DiscoverWorkshops))));
    assert.equal(
      document.querySelector(
        "section[aria-labelledby='discover-title'] [role=\"status\"]",
      ).textContent,
      t("public.loadingWorkshops"),
    );
    const published = [...workshops.slice(0, 5)].reverse();
    await act(async () =>
      finish(
        Response.json({
          preview: true,
          workshops: [
            {
              ...workshops[0],
              id: "hidden",
              name: "AAA hidden",
              status: "draft",
            },
            ...published,
          ],
        }),
      ),
    );
    assert.equal(
      document.querySelectorAll(
        "[data-ui~='discover-grid'] [data-ui~='catalogue-card']",
      ).length,
      3,
      "discovery is bounded to three published cards",
    );
    assert(
      [...document.querySelectorAll("[data-ui~='discover-grid'] h3")].every(
        (node) => /^Fixture 0[0-4]$/.test(node.textContent),
      ),
      "random discovery includes published records only",
    );
    assert.equal(
      document.querySelectorAll("[data-ui~='partner-label']").length,
      0,
      "fallback workshop cards have no example-placement label",
    );
    assert(
      [...document.querySelectorAll("[data-ui~='discover-grid'] a")].every(
        (node) =>
          published.some((workshop) =>
            node.getAttribute("href").includes(workshop.id),
          ),
      ),
      "cards link to actual selected profiles",
    );
    await act(async () => root.render(null));
    globalThis.fetch = async () =>
      Response.json({ workshops: [], preview: true });
    await act(async () => root.render(wrap(locale, h(DiscoverWorkshops))));
    assert(
      document
        .querySelector(
          "section[aria-labelledby='discover-title'] > div:last-child",
        )
        .textContent.includes(t("public.directoryEmpty")),
    );
    assert.equal(
      document.querySelectorAll("[data-ui~='catalogue-card']").length,
      0,
      "empty catalogues never fabricate workshops",
    );
    await act(async () => root.render(null));
    let fail = true;
    globalThis.fetch = async (url) =>
      String(url).startsWith("/api/premium-workshops?")
        ? fail
          ? Response.json({ error: "private provider detail" }, { status: 503 })
          : Response.json({ workshops: [workshops[0]], preview: false })
        : Response.json({ enabled: false });
    await act(async () => root.render(wrap(locale, h(DiscoverWorkshops))));
    assert(
      document
        .querySelector('[role="alert"]')
        .textContent.includes(t("public.directoryUnavailable")),
    );
    assert(!document.body.textContent.includes("private provider detail"));
    fail = false;
    await act(async () =>
      document
        .querySelector(
          "section[aria-labelledby='discover-title'] > div:last-child button",
        )
        .click(),
    );
    assert.equal(
      document.querySelectorAll(
        "[data-ui~='discover-grid'] [data-ui~='catalogue-card']",
      ).length,
      1,
      "retry replaces the safe error with current profiles",
    );
    assert.equal(
      document.querySelector("[data-ui~='partner-label']").textContent,
      t("public.partnerAd"),
      "confirmed paid placement is labelled as advertising",
    );
    await act(async () => root.render(null));
  }
  console.log(
    "Public performance UI: accessible catalogue loading, SSR selections, integrated quick search without vehicle wizard, instant navigation, duplicate submission protection and keyboard pagination passed in DE/SQ/EN; no live requests.",
  );
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
