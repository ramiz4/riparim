import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
export async function createGoogleStyleFixture(name) {
  const dom = new JSDOM(
    '<html><head><style id="fixture-style"></style></head><body><div id="root"></div></body></html>',
    { url: "https://riparim.example.test", pretendToBeVisual: true },
  );
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLFormElement",
    "HTMLButtonElement",
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
    "customElements",
  ])
    Object.defineProperty(globalThis, key, {
      value: dom.window[key],
      configurable: true,
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
    dom.window,
  );
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(
    dom.window,
  );
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  for (const tag of [
    "gmp-advanced-place-details",
    "gmp-advanced-place-details-compact",
  ])
    customElements.define(tag, class extends HTMLElement {});
  const output = ".test-runtime/" + name;
  await mkdir(output, { recursive: true });
  await build({
    stdin: {
      contents:
        "export {GooglePlaceReviews} from './components/google-place-reviews';export {ReviewForm} from './components/review-form';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';",
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    outfile: output + "/ui.mjs",
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    jsx: "automatic",
    plugins: [
      {
        name: "provider-and-router-fixtures",
        setup(builder) {
          builder.onResolve(
            {
              filter: /^(@\/lib\/google-maps-browser|next\/(link|navigation))$/,
            },
            (args) => ({ path: args.path, namespace: "fixture" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            loader: "js",
            resolveDir: process.cwd(),
            contents:
              args.path === "@/lib/google-maps-browser"
                ? "export async function loadGooglePlaces(){return {Place:class{constructor(value){Object.assign(this,value)}}};}"
                : args.path === "next/link"
                  ? "import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children);}"
                  : "export function useRouter(){return {push(){},replace(){},refresh(){}};}export function usePathname(){return window.location.pathname;}",
          }));
        },
      },
    ],
  });
  const api = await import(
    new URL("../../" + output + "/ui.mjs", import.meta.url)
  );
  const { createElement: h, act } = await import("react"),
    { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root"));
  const workshop = {
    id: "fixture-workshop",
    name: "Fictional workshop",
    city: "Prishtina",
    address: "Fictional address",
    phone: "",
    phoneNote: "",
    whatsapp: "",
    brands: [],
    services: ["Inspektion & Wartung"],
    serviceDetails: [],
    languages: [],
    rating: null,
    count: 0,
    initials: "FW",
    color: "#123456",
    specialty: "",
    description: "",
    lat: null,
    lng: null,
    sources: [],
    checkedAt: "2026-10-04",
    status: "published",
    updatedAt: "2026-10-04",
  };
  const render = async (locale, children) => {
    await act(async () => root.render(null));
    await act(async () =>
      root.render(
        h(
          api.I18nProvider,
          { locale, messages: api.getMessages(locale) },
          children,
        ),
      ),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  };
  return {
    dom,
    document,
    h,
    api,
    workshop,
    render,
    widget: (variant) =>
      h(api.GooglePlaceReviews, {
        workshop,
        variant,
        identity: { placeId: "ChIJFixture", browserKey: "fixture-key" },
        status: "ready",
      }),
    close: async () => {
      await act(async () => root.unmount());
      dom.window.close();
    },
  };
}
