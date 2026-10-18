import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://riparim.example.test/",
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
  "Option",
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
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const out = ".test-runtime/analytics-ui/fixture.mjs";
const bundle = await build({
  stdin: {
    contents: `export {AnalyticsConsent,AnalyticsSettings} from './components/analytics-consent';export {default as Profile} from './app/[locale]/workshop/[id]/profile';export {default as CityDirectory} from './app/[locale]/workshops/[city]/city-directory';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export {analyticsMessages} from './lib/i18n/analytics-messages';export {localizeHref} from './lib/i18n/locale';`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: out,
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  packages: "external",
  external: ["react", "react/jsx-runtime"],
  plugins: [
    {
      name: "routing-boundary",
      setup(b) {
        b.onResolve({ filter: /^next\/(navigation|link)$/ }, (a) => ({
          path: a.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "js",
          contents:
            a.path === "next/link"
              ? `import {createElement} from 'react';export default function Link({children,href,...props}){return createElement('a',{...props,href},children);}`
              : `export function useRouter(){return {push(){},refresh(){},prefetch(){}};}export function usePathname(){return window.location.pathname;}export function useSearchParams(){return new URLSearchParams(window.location.search);}`,
        }));
      },
    },
  ],
});
await mkdir(".test-runtime/analytics-ui", { recursive: true });
await writeFile(out, bundle.outputFiles[0].text);
const {
  AnalyticsConsent,
  AnalyticsSettings,
  Profile,
  CityDirectory,
  I18nProvider,
  getMessages,
  analyticsMessages,
  localizeHref,
} = await import("../" + out);
const React = await import("react"),
  { createRoot } = await import("react-dom/client"),
  h = React.createElement;
let root = createRoot(document.getElementById("root"));
const config = {
    key: "phc_analytics_ui_fixture",
    host: "https://eu.i.posthog.com",
    testMode: true,
  },
  events = [];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith(config.host)) {
    events.push(JSON.parse(init.body));
    return Response.json({ status: 1 });
  }
  if (url === "/api/google-places") return Response.json({ enabled: false });
  if (url === "/api/session")
    return Response.json({ account: null, isAdmin: false });
  throw Error("Unexpected fixture request: " + url);
};
document.addEventListener("click", (event) => {
  if (event.target.closest("a")) event.preventDefault();
});
const workshop = {
  id: "issue-205-fixture",
  name: "Issue 205 Fixture Workshop",
  city: "Prishtina",
  address: "Private fixture address",
  phone: "+38349000205",
  phoneNote: "",
  whatsapp: "+38349000205",
  emails: ["issue-205@example.test"],
  lat: null,
  lng: null,
  rating: null,
  count: 0,
  specialty: "Fixture specialty",
  description: "Fixture description",
  services: [],
  serviceDetails: [],
  brands: [],
  languages: [],
  sources: [],
  checkedAt: "2026-10-18",
  status: "published",
  googleRating: null,
};
const profile = h(Profile, {
  workshop,
  directory: [workshop],
  reviews: [],
  reviewError: "",
  signedIn: false,
  account: null,
  isAdmin: false,
});
const flush = () =>
  React.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
async function render(locale, path, view) {
  window.history.pushState({}, "", localizeHref(path, locale));
  await React.act(async () =>
    root.render(
      h(
        I18nProvider,
        {
          locale,
          messages: getMessages(locale, [
            "common",
            "public",
            "customer",
            "city",
          ]),
        },
        h(AnalyticsConsent, { config }, view),
      ),
    ),
  );
  await flush();
}
async function click(node) {
  assert(node, "Expected control exists");
  await React.act(async () => {
    node.focus();
    node.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        detail: 0,
      }),
    );
  });
  await flush();
}
const byText = (text) =>
  [...document.querySelectorAll("button")].find(
    (button) => button.textContent === text,
  );
for (const locale of ["de", "sq", "en"]) {
  window.localStorage.clear();
  window.sessionStorage.clear();
  events.length = 0;
  const text = analyticsMessages[locale];
  await render(
    locale,
    "/",
    h("main", { "data-riparim-page": "home" }, "Public fixture"),
  );
  const banner = document.querySelector('[data-ui="analytics-consent"]');
  assert(banner);
  assert.equal(
    banner.getAttribute("aria-labelledby"),
    "analytics-consent-title",
  );
  assert.equal(banner.querySelector("h2").textContent, text.title);
  assert.equal(
    events.length,
    0,
    "Initial public rendering sends nothing before consent",
  );
  await click(byText(text.decline));
  assert.equal(document.querySelector('[data-ui="analytics-consent"]'), null);
  assert.equal(events.length, 0);
  await render(locale, "/einstellungen", h("main", null, h(AnalyticsSettings)));
  assert.equal(
    document.querySelector('[data-ui="analytics-consent"]'),
    null,
    "Private settings never shows public banner",
  );
  await click(byText(text.accept));
  assert.equal(
    events.length,
    0,
    "Accepting in settings does not capture private page",
  );
  await render(
    locale,
    "/werkstaetten?q=private-search#anchor",
    h("main", { "data-riparim-page": "catalogue" }, "Search fixture"),
  );
  assert.deepEqual(
    events.map(({ event }) => event),
    ["$pageview", "workshop_search_viewed"],
  );
  await render(
    locale,
    "/werkstaetten?q=different-private-search#another",
    h("main", { "data-riparim-page": "catalogue" }, "Updated filters"),
  );
  assert.equal(
    events.filter(({ event }) => event === "$pageview").length,
    1,
    "Filter/hash rerender sends no duplicate",
  );
  const cityPage = h(CityDirectory, {
    city: { slug: "prishtina", name: "Prishtina" },
    initialWorkshops: [workshop],
    initialDisplayById: {},
    initialError: false,
    publicSnapshot: false,
  });
  await render(
    locale,
    "/workshops/prishtina?q=private-city-search#private-fragment",
    cityPage,
  );
  assert.equal(
    events.filter(({ event }) => event === "workshop_search_viewed").length,
    2,
    "The actual city listing joins the existing discovery funnel",
  );
  assert.equal(events.at(-1).properties.page_type, "city");
  assert.equal(
    events.at(-1).properties.page_path,
    localizeHref("/workshops/prishtina", locale),
  );
  const cityEvents = events.length;
  await render(locale, "/workshops/prishtina?q=another-city-secret", cityPage);
  assert.equal(
    events.length,
    cityEvents,
    "City query changes cannot duplicate or leak into events",
  );
  await render(locale, "/werkstatt/issue-205-fixture", profile);
  assert.equal(
    events.filter(({ event }) => event === "workshop_profile_viewed").length,
    1,
    "Published actual Profile becomes a funnel step",
  );
  for (let restore = 0; restore < 2; restore++) {
    const views = events.filter(({ event }) => event === "$pageview").length;
    await React.act(async () =>
      window.dispatchEvent(
        new window.PageTransitionEvent("pagehide", { persisted: true }),
      ),
    );
    await flush();
    await React.act(async () =>
      window.dispatchEvent(
        new window.PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    await flush();
    assert.equal(
      events.filter(({ event }) => event === "$pageview").length,
      views + 1,
      "Restoring a cached published profile captures a new pageview",
    );
    assert.equal(events.at(-1).event, "workshop_profile_viewed");
    const restored = events.length;
    await React.act(async () => {
      window.dispatchEvent(
        new window.PageTransitionEvent("pageshow", { persisted: true }),
      );
      window.dispatchEvent(
        new window.PageTransitionEvent("pageshow", { persisted: false }),
      );
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new window.PopStateEvent("popstate"));
    });
    await flush();
    assert.equal(
      events.length,
      restored,
      "Repeated pageshow, normal loads, focus and history scans do not duplicate the restored view",
    );
  }
  const phones = [...document.querySelectorAll('main a[href^="tel:"]')];
  assert.equal(
    phones.length,
    3,
    "Header, sidebar and mobile telephone controls exist",
  );
  for (const phone of phones) await click(phone);
  await click(document.querySelector('main a[href^="mailto:"]'));
  const directions = [
    ...document.querySelectorAll('main a[target="_blank"]'),
  ].filter(
    (link) =>
      new URL(link.href).hostname === "www.google.com" ||
      new URL(link.href).hostname === "maps.google.com",
  );
  assert(
    directions.length >= 2,
    "Desktop and mobile directions controls exist",
  );
  for (const link of directions) await click(link);
  const contactsBefore = events.filter(
    ({ event }) => event === "workshop_contact_clicked",
  ).length;
  await click(
    document.querySelector(
      'main[data-riparim-page="workshop"] > header button',
    ),
  );
  assert.equal(
    events.filter(({ event }) => event === "workshop_contact_clicked").length,
    contactsBefore,
    "Opening WhatsApp draft is not a contact conversion",
  );
  const textarea = document.querySelector('[role="dialog"] textarea');
  assert(textarea);
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    ).set.call(textarea, "Private issue-205 message must not reach analytics");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(
    document.querySelector('[role="dialog"] a[href^="https://wa.me/"]'),
  );
  assert.equal(
    events.filter(({ event }) => event === "workshop_contact_clicked").at(-1)
      .properties.contact_channel,
    "whatsapp",
  );
  const serialized = JSON.stringify(events);
  for (const personal of [
    "private-search",
    "private-city-search",
    "private-fragment",
    "another-city-secret",
    "Private issue-205",
    "+38349000205",
    "issue-205@example.test",
    "Private fixture address",
  ])
    assert(!serialized.includes(personal), `Payload excludes ${personal}`);
  assert(
    events.every(
      ({ properties }) =>
        properties.locale === locale && properties.is_verification === true,
    ),
  );
  await React.act(async () =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  await flush();
  await render(locale, "/einstellungen", h("main", null, h(AnalyticsSettings)));
  await click(byText(text.revoke));
  assert.equal(
    window.localStorage.getItem("riparim.analytics.browser.v1"),
    null,
  );
  const afterRevoke = events.length;
  await render(locale, "/werkstatt/issue-205-fixture", profile);
  await click(document.querySelector('main a[href^="tel:"]'));
  assert.equal(
    events.length,
    afterRevoke,
    "Actual contact remains usable and silent after revocation",
  );
  // Recreate the provider like a reload so each locale independently starts without consent.
  await React.act(async () => root.unmount());
  document.getElementById("root").replaceChildren();
  root = createRoot(document.getElementById("root"));
}
// Unpublished/loading profiles cannot become analytics pages or show an opt-in prompt.
window.localStorage.clear();
events.length = 0;
await render(
  "de",
  "/werkstatt/issue-205-fixture",
  h(
    "main",
    {
      "data-riparim-page": "workshop",
      "data-public-profile-id": "issue-205-fixture",
    },
    "Loading",
  ),
);
assert.equal(document.querySelector('[data-ui="analytics-consent"]'), null);
assert.equal(events.length, 0);
await React.act(async () => root.unmount());
dom.window.close();
console.log(
  "Analytics real consent/settings/profile UI: DE/SQ/EN, actual contacts, privacy and revocation passed",
);
