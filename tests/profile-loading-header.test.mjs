import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { JSDOM, VirtualConsole } from "jsdom";

const out = ".test-runtime/profile-loading-header";
await mkdir(out, { recursive: true });
await build({
  stdin: {
    contents:
      "export {default as ProfileLoading} from './app/[locale]/workshop/[id]/loading';export {SiteHeader} from './components/site-header';export {I18nProvider} from './lib/i18n/client';export {getMessages} from './lib/i18n/messages';export {invalidatePublicSession} from './components/use-public-session';",
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  outfile: out + "/ui.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  packages: "external",
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "link-boundary",
      setup(b) {
        b.onResolve({ filter: /^next\/link$/ }, () => ({
          path: "link",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents:
            "import {createElement} from 'react';export default function Link({href,children,...props}){return createElement('a',{href,...props},children);}",
        }));
      },
    },
  ],
});
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
  "HTMLFormElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "getComputedStyle",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
window.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement: h, act } = await import("react"),
  { createRoot } = await import("react-dom/client"),
  { renderToStaticMarkup } = await import("react-dom/server");
const {
  ProfileLoading,
  SiteHeader,
  I18nProvider,
  getMessages,
  invalidatePublicSession,
} = await import(new URL("../" + out + "/ui.mjs", import.meta.url));
const member = {
  account: {
    email: "fixture@example.test",
    displayName: "Fixture Member",
    provider: "E-Mail",
  },
  isAdmin: false,
};
let requests = 0;
globalThis.fetch = async (url) => {
  assert.equal(
    url,
    "/api/session",
    "The loading boundary never requests private records or live services",
  );
  requests++;
  return Response.json(member);
};
const root = createRoot(document.getElementById("root"));
const wrap = (locale, node) =>
  h(I18nProvider, { locale, messages: getMessages(locale, ["common"]) }, node);
try {
  for (const locale of ["de", "sq", "en"]) {
    // The actual route Suspense fallback must include navigation even on SSR.
    delete globalThis.window;
    let markup;
    try {
      markup = renderToStaticMarkup(wrap(locale, h(ProfileLoading)));
    } finally {
      Object.defineProperty(globalThis, "window", {
        value: dom.window,
        configurable: true,
      });
    }
    const server = new JSDOM(markup);
    try {
      assert(
        server.window.document.querySelector("header.header"),
        "The profile loading fallback preserves the site header",
      );
      assert.equal(
        server.window.document.querySelector('main [role="status"]')
          .textContent,
        getMessages(locale).common.loadingProfile,
      );
      assert.equal(
        !!server.window.document.querySelector(".header-auth"),
        false,
        "An unknown server session never claims the visitor is signed out",
      );
      assert(
        !markup.includes(member.account.email),
        "Browser identity never enters the server loading document",
      );
    } finally {
      server.window.close();
    }
    await act(async () => root.render(null));
    invalidatePublicSession();
    await act(async () =>
      root.render(
        wrap(locale, h(SiteHeader, { account: null, publicSnapshot: true })),
      ),
    );
    assert(
      document.querySelector(".user-menu-trigger"),
      "The previous route has a verified account",
    );
    const before = requests;
    await act(async () => root.render(wrap(locale, h(ProfileLoading))));
    assert(
      document.querySelector("header.header"),
      "The cold profile route keeps the header mounted in its loading fallback",
    );
    assert(
      document.querySelector(".user-menu-trigger"),
      "The loading fallback retains the known account instead of removing its menu",
    );
    assert.equal(!!document.querySelector(".header-auth"), false);
    assert.equal(
      requests,
      before,
      "The fallback reuses the shared session and does not add an identity request",
    );
    const logo = document.querySelector("header a");
    logo.focus();
    assert.equal(
      document.activeElement,
      logo,
      "Loading navigation remains keyboard reachable",
    );
    assert.equal(
      document.querySelector('main [role="status"]').textContent,
      getMessages(locale).common.loadingProfile,
    );
    assert.equal(
      document.querySelectorAll(
        'main a,main button,main input,[role="status"] [tabindex]',
      ).length,
      0,
      "The loading indicator adds no keyboard stop",
    );
  }
  console.log(
    "Profile loading: actual Suspense fallback keeps the header, shared account, keyboard navigation and localized status in DE/SQ/EN; no server identity leak",
  );
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
