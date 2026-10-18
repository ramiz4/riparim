import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const result = await build({
  stdin: {
    contents: `export { default as CityPage,generateMetadata } from './app/[locale]/workshops/[city]/page';export {default as CityDirectory} from './app/[locale]/workshops/[city]/city-directory';export {I18nProvider} from './lib/i18n/client';export {getMessages,createTranslator} from './lib/i18n/messages';export {workshopCities,cityWorkshops} from './lib/workshop-cities';export {publicSitemapResponse} from './lib/public-seo';`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  packages: "external",
  external: ["react", "react-dom", "react/jsx-runtime"],
  plugins: [
    {
      name: "city-fixtures",
      setup(b) {
        const modules = {
          "next/navigation": `export function notFound(){throw Error('NOT_FOUND');}export function useRouter(){return {push(){},prefetch(){}};}export function usePathname(){return globalThis.fixtureCityPath || '/werkstaetten/prishtina';}`,
          "next/link": `import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children);}`,
          "@/lib/auth/request-context": `export function authRequestState(){return {rsc:globalThis.fixtureCityRsc ?? false};}`,
          "@/lib/auth/config": `export function siteOrigin(){return 'https://riparim.example.test';}`,
          "@/db/directory": `export async function listWorkshops(){if(globalThis.fixtureCityUnavailable)throw Error('Isolated database unavailable');return globalThis.fixtureCityDirectory;}`,
          "cloudflare:workers": `export const env=globalThis.fixtureCityEnv;`,
          "@/components/site-header": `export function SiteHeader(){return null;}`,
          "@/components/workshop-ratings": `export function WorkshopRatings(){return null;}`,
        };
        b.onResolve(
          {
            filter:
              /^(next\/(navigation|link)|@\/lib\/(auth\/(request-context|config))|@\/db\/directory|cloudflare:workers|@\/components\/(site-header|workshop-ratings))$/,
          },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents: modules[a.path],
          loader: "js",
        }));
        b.onLoad({ filter: /\.css$/ }, () => ({
          contents: "export default {};",
          loader: "js",
        }));
      },
    },
  ],
});
await mkdir(".test-runtime", { recursive: true });
await writeFile(".test-runtime/city-pages.mjs", result.outputFiles[0].text);
globalThis.fixtureCityEnv = {};
const api = await import(
  new URL("../.test-runtime/city-pages.mjs", import.meta.url)
);
const React = await import("react"),
  { renderToStaticMarkup } = await import("react-dom/server");
const h = React.createElement;
const wrap = (locale, node) =>
  h(api.I18nProvider, { locale, messages: api.getMessages(locale) }, node);
const fixture = {
  id: "issue-208-public",
  name: "Issue 208 Synthetic City Workshop",
  city: "Prishtina",
  address: "Issue 208 Fictional Road 1",
  phone: "+38344123456",
  phoneNote: "",
  whatsapp: "",
  brands: [],
  services: ["Inspektion"],
  serviceDetails: ["Synthetic inspection"],
  languages: [],
  rating: null,
  count: 0,
  initials: "IT",
  color: "#123456",
  specialty: "Synthetic",
  description: "Issue 208 fictional public workshop",
  lat: null,
  lng: null,
  sources: [],
  checkedAt: "2026-10-18",
  status: "published",
  updatedAt: "2026-10-18T00:00:00Z",
};
globalThis.fixtureCityDirectory = [
  fixture,
  {
    ...fixture,
    id: "issue-208-private",
    name: "Private City Draft",
    status: "draft",
  },
  {
    ...fixture,
    id: "issue-208-other",
    name: "Other City Workshop",
    city: "Prizren",
  },
];
for (const locale of ["de", "sq", "en"])
  for (const city of api.workshopCities) {
    const props = { params: Promise.resolve({ locale, city: city.slug }) };
    const page = await api.CityPage(props);
    const doc = new JSDOM(renderToStaticMarkup(wrap(locale, page))).window
      .document;
    const expected = api
      .cityWorkshops(globalThis.fixtureCityDirectory, city)
      .map((w) => w.id);
    assert.deepEqual(
      [...doc.querySelectorAll("[data-workshop-id]")].map(
        (el) => el.dataset.workshopId,
      ),
      expected,
    );
    assert.equal(doc.querySelectorAll("h1").length, 1);
    assert(!doc.body.textContent.includes("Private City Draft"));
    assert.equal(
      doc.querySelectorAll('nav[aria-label] a[aria-current="page"]').length,
      1,
    );
    const metadata = await api.generateMetadata(props);
    const prefix =
      locale === "de"
        ? "/werkstaetten"
        : locale === "sq"
          ? "/sq/serviset"
          : "/en/workshops";
    assert.equal(
      metadata.alternates.canonical,
      `https://riparim.example.test${prefix}/${city.slug}`,
    );
    assert.deepEqual(Object.keys(metadata.alternates.languages), [
      "de",
      "sq",
      "en",
      "x-default",
    ]);
    assert(metadata.title.includes(city.name));
    assert(metadata.description.includes(city.name));
    if (city.slug === "prishtina") {
      assert(
        doc.querySelector(
          'a[href*="ort=prishtina"][href*="leistung=inspektion"]',
        ),
      );
      assert(
        doc.querySelector(
          `a[href^="${locale === "de" ? "/werkstatt" : locale === "sq" ? "/sq/servis" : "/en/workshop"}/issue-208-public"]`,
        ),
      );
    }
  }
const sitemapResponse = await api.publicSitemapResponse();
assert.equal(sitemapResponse.status, 200);
const sitemap = new JSDOM(await sitemapResponse.text(), {
  contentType: "application/xml",
}).window.document;
const locations = [...sitemap.querySelectorAll("loc")].map(
  (node) => node.textContent,
);
for (const city of api.workshopCities)
  for (const prefix of ["/werkstaetten", "/sq/serviset", "/en/workshops"])
    assert(
      locations.includes(`https://riparim.example.test${prefix}/${city.slug}`),
      "Sitemap advertises every supported city locale",
    );
assert(
  !locations.some(
    (path) => path.includes("unknown") || path.includes("issue-208-private"),
  ),
);
for (const city of ["unknown", "Prishtina", "prishtina/extra"])
  await assert.rejects(
    () => api.CityPage({ params: Promise.resolve({ locale: "en", city }) }),
    /NOT_FOUND/,
  );
globalThis.fixtureCityUnavailable = true;
const previous = console.error;
console.error = () => {};
const errorPage = await api.CityPage({
  params: Promise.resolve({ locale: "en", city: "prishtina" }),
});
console.error = previous;
assert(
  renderToStaticMarkup(wrap("en", errorPage)).includes(
    "Workshops could not be loaded.",
  ),
);
globalThis.fixtureCityUnavailable = false;
for (const mode of ["shell", "rsc"]) {
  globalThis.fixtureCityEnv.PUBLIC_RELEASE_RENDER =
    mode === "shell" ? "shell" : undefined;
  globalThis.fixtureCityRsc = mode === "rsc";
  const page = await api.CityPage({
    params: Promise.resolve({ locale: "en", city: "prishtina" }),
  });
  const html = renderToStaticMarkup(wrap("en", page));
  assert(
    !html.includes("data-workshop-id="),
    "Stale-release/client-navigation shells contain no catalogue data",
  );
  assert(html.includes("Loading workshops"));
}
globalThis.fixtureCityEnv.PUBLIC_RELEASE_RENDER = undefined;
globalThis.fixtureCityRsc = false;
const dom = new JSDOM('<div id="root"></div>', {
  url: "https://riparim.example.test/en/workshops/prishtina",
  pretendToBeVisual: true,
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "Element",
  "Node",
  "MutationObserver",
  "CustomEvent",
  "Event",
  "MouseEvent",
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
const { createRoot } = await import("react-dom/client");
const root = createRoot(document.getElementById("root"));
let resolveFetch;
globalThis.fetch = () =>
  new Promise((resolve) => {
    resolveFetch = resolve;
  });
const node = () =>
  wrap(
    "en",
    h(api.CityDirectory, {
      city: api.workshopCities[0],
      initialWorkshops: [],
      initialDisplayById: {},
      initialError: false,
      publicSnapshot: true,
    }),
  );
await React.act(async () => root.render(node()));
assert(document.querySelector('[role="status"]'));
await React.act(async () =>
  resolveFetch(Response.json({ error: "PRIVATE_ERROR" }, { status: 503 })),
);
assert(document.querySelector('[role="alert"]'));
assert(!document.body.textContent.includes("PRIVATE_ERROR"));
const retry = document.querySelector('[role="alert"] button');
await React.act(async () => retry.click());
assert(document.querySelector('[role="status"]'));
await React.act(async () =>
  resolveFetch(Response.json({ workshops: [{ ...fixture, status: "draft" }] })),
);
assert(document.body.textContent.includes("No profile is currently published"));
assert.equal(document.querySelectorAll("[data-workshop-id]").length, 0);
await React.act(async () => root.unmount());
console.log(
  "City components: five-city DE/SQ/EN membership, metadata, profile/filter links, 404, no-data shells, loading/error/retry/empty and draft privacy passed",
);
