import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";
import { compileApplicationCss } from "./helpers/compiled-tailwind.mjs";
import { cssForDom } from "./helpers/style-fixture.mjs";

const client = new JSDOM(
  '<html><head><style id="focus-style"></style></head><body><div id="root"></div></body></html>',
  {
    url: "https://riparim.example.test/en/workshop/fixture",
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
  },
);
for (const name of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLButtonElement",
  "HTMLInputElement",
  "HTMLFormElement",
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
  Object.defineProperty(globalThis, name, {
    value: client.window[name],
    configurable: true,
  });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = client.window.requestAnimationFrame.bind(
  client.window,
);
globalThis.cancelAnimationFrame = client.window.cancelAnimationFrame.bind(
  client.window,
);
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
});
window.scrollTo = () => {};
HTMLElement.prototype.scrollIntoView = () => {};
globalThis.fetch = async () => {
  throw Error("Focus fixtures must not make network requests");
};

const output = ".test-runtime/native-focus-styles";
await mkdir(output, { recursive: true });
await build({
  stdin: {
    contents: `
      export {default as AuthForm} from './app/auth-form';
      export {default as Profile} from './app/[locale]/workshop/[id]/profile';
      export {WorkshopPhotos, WorkshopGoogleMap, WorkshopOpeningHours} from './components/workshop-google-details';
      export {ModalBody} from './components/modal-shell';
      export {I18nProvider} from './lib/i18n/client';
      export {getMessages} from './lib/i18n/messages';
    `,
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
      name: "focus-transport-boundaries",
      setup(builder) {
        builder.onResolve(
          { filter: /^(next\/(link|navigation)|@\/lib\/google-maps-browser)$/ },
          (args) => ({ path: args.path, namespace: "focus-fixture" }),
        );
        builder.onLoad(
          { filter: /.*/, namespace: "focus-fixture" },
          (args) => ({
            loader: "js",
            resolveDir: process.cwd(),
            contents:
              args.path === "next/link"
                ? "import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children)}"
                : args.path === "next/navigation"
                  ? "export function useRouter(){return {push(){},replace(){},refresh(){}};}export function usePathname(){return '/en/workshop/fixture';}export function useSearchParams(){return new URLSearchParams();}"
                  : "export async function showConfirmedGoogleMap(){throw Error('Focus fixtures must not request a provider map');}",
          }),
        );
      },
    },
  ],
});
const api = await import(new URL("../" + output + "/ui.mjs", import.meta.url));
const { createElement: h, act } = await import("react"),
  { renderToStaticMarkup } = await import("react-dom/server"),
  { createRoot } = await import("react-dom/client");
const { source, production } = await compileApplicationCss();
const workshop = {
  id: "fixture",
  name: "Fictional focus workshop",
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
  description: "",
  specialty: "",
  lat: null,
  lng: null,
  sources: [],
  checkedAt: "2026-10-14",
  status: "published",
};
const photos = [1, 2].map((number) => ({
  resource: `places/fixture/photos/photo-${number}`,
  authors: [],
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Fixture",
}));
const googleProfile = {
  placeId: "fixture-place",
  loadedAt: 0,
  businessStatus: "OPERATIONAL",
  location: null,
  rating: { rating: null, count: null, mapsUrl: "", attributions: [] },
  hours: {
    openNow: false,
    weekdays: ["Monday: 08:00–18:00"],
    periods: [],
    nextOpenTime: null,
    nextCloseTime: null,
  },
  photos,
};
const identity = { placeId: "fixture-place", browserKey: "fictional-key" };
const translated = (children) =>
  h(
    api.I18nProvider,
    { locale: "en", messages: api.getMessages("en") },
    children,
  );
const scenes = renderToStaticMarkup(
  translated(
    h(
      "div",
      null,
      h(api.AuthForm, {
        account: null,
        screen: "login",
        emailReady: true,
        googleReady: true,
        isOwner: false,
        returnTo: "/",
      }),
      h(api.Profile, {
        workshop,
        directory: [workshop],
        reviews: [],
        reviewError: "",
        signedIn: false,
        account: null,
        isAdmin: false,
      }),
      h(api.WorkshopGoogleMap, {
        name: workshop.name,
        profile: googleProfile,
        identity,
        status: "ready",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Fixture",
      }),
      h(api.WorkshopOpeningHours, {
        profile: googleProfile,
        status: "ready",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=Fixture",
      }),
      h(api.ModalBody, null, "Fictional dialog content"),
    ),
  ),
);

function assertFocus(
  dom,
  node,
  css,
  dark,
  expectedColor,
  context,
  width = 3,
  offset = 3,
) {
  assert(node, `${context}: the real component renders its control`);
  dom.window.document.querySelector("style").textContent = "";
  dom.window.document.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
  );
  node.focus();
  assert.equal(
    dom.window.document.activeElement,
    node,
    `${context}: focus reaches the control`,
  );
  assert(
    node.matches(":focus-visible"),
    `${context}: keyboard focus is visible`,
  );
  dom.window.document.querySelector("style").textContent = cssForDom(css, {
    dark,
    document: dom.window.document,
  });
  const style = dom.window.getComputedStyle(node);
  // The locked jsdom CSSOM retains outline shorthands without expanding their
  // longhands. Read that computed shorthand only when a longhand is absent.
  const color =
    style.outlineColor ||
    style.outline.match(/#[\da-f]{3,8}|rgba?\([^)]*\)/i)?.[0];
  const outlineWidth =
    style.outlineWidth || style.outline.match(/[\d.]+px/)?.[0];
  const normalized = dom.window.document.createElement("span");
  normalized.style.color = color;
  assert.equal(
    normalized.style.color,
    expectedColor,
    `${context}: visible focus keeps the effective theme color`,
  );
  assert.equal(
    outlineWidth,
    `${width}px`,
    `${context}: focus width is preserved`,
  );
  assert.equal(
    style.outlineOffset,
    `${offset}px`,
    `${context}: focus offset is preserved`,
  );
}

const root = createRoot(document.getElementById("root"));
try {
  for (const [variant, css] of [
    ["source", source],
    ["production", production],
  ]) {
    for (const dark of [false, true]) {
      const dom = new JSDOM(
        `<html class="${dark ? "dark" : ""}"><head><style></style></head><body>${scenes}</body></html>`,
        { pretendToBeVisual: true, virtualConsole: new VirtualConsole() },
      );
      try {
        for (const [selector, color, label] of [
          ['[data-ui="auth-google"]', "rgb(128, 181, 174)", "Google sign-in"],
          [
            'button[aria-label="Show password"]',
            "rgb(128, 181, 174)",
            "password visibility",
          ],
          ["#quellen > summary", "rgb(87, 168, 139)", "profile sources"],
          [
            '[data-ui="profile-map"] > summary',
            "rgb(87, 168, 139)",
            "Google map disclosure",
          ],
          [
            '[data-ui="google-opening-hours"] summary',
            "rgb(87, 168, 139)",
            "weekly opening hours",
          ],
        ])
          assertFocus(
            dom,
            dom.window.document.querySelector(selector),
            css,
            dark,
            dark ? "rgb(128, 221, 201)" : color,
            `${variant}, dark=${dark}: ${label}`,
          );
        assertFocus(
          dom,
          dom.window.document.querySelector('[data-slot="dialog-body"]'),
          css,
          dark,
          "rgb(140, 199, 184)",
          `${variant}, dark=${dark}: dialog body div`,
          2,
          -2,
        );
      } finally {
        dom.window.close();
      }

      document.documentElement.classList.toggle("dark", dark);
      await act(async () =>
        root.render(
          translated(
            h(api.WorkshopPhotos, {
              name: workshop.name,
              profile: { photos, attributions: [] },
              identity,
              status: "ready",
            }),
          ),
        ),
      );
      const opener = document.querySelector('button[aria-haspopup="dialog"]');
      assertFocus(
        client,
        opener,
        css,
        dark,
        dark ? "rgb(128, 221, 201)" : "rgb(87, 168, 139)",
        `${variant}, dark=${dark}: photo strip`,
      );
      await act(async () => opener.click());
      const gallery = document.querySelector('[role="dialog"]');
      assert(gallery, "The real photo button opens the Radix gallery");
      for (const [selector, label] of [
        ['button[aria-label="Previous image"]', "previous photo"],
        ['button[aria-label="Next image"]', "next photo"],
        ['button[data-slot="dialog-close"]', "gallery close"],
        ['button[aria-label="Show photo 1"]', "gallery thumbnail"],
      ])
        assertFocus(
          client,
          gallery.querySelector(selector),
          css,
          dark,
          dark ? "rgb(128, 221, 201)" : "rgb(217, 242, 227)",
          `${variant}, dark=${dark}: ${label}`,
        );
      await act(async () => root.render(null));
    }
  }
} finally {
  await act(async () => root.unmount());
  client.window.close();
}
console.log(
  "Native focus: real auth/profile/Google/gallery controls retain light and dark outlines in compiled source/production; dialog body keeps its separate div focus contract",
);
